import {normalizeGraphEvent,normalizeGoogleEvent,type ExternalEvent,type GoogleRaw,type GraphRaw,type Provider} from './external-calendar.ts';
// Leitura das agendas pelo Microsoft Graph e pela Google Calendar API. O fetch chega injetado para os testes.
export type Fetch=(url:string,init:RequestInit)=>Promise<Response>;
export const MAX_EVENTS=1000;const MAX_PAGES=10;
export class ProviderError extends Error{kind:'reconnect'|'error';constructor(kind:'reconnect'|'error'){super(kind==='reconnect'?'Precisa reconectar.':'Não foi possível atualizar agora.');this.kind=kind;}}
// Falhas vão para o log do servidor com o endereço, o status e um trecho da resposta; nunca com o token ou os cabeçalhos.
async function page(fetcher:Fetch,url:string,headers:Record<string,string>):Promise<Record<string,unknown>>{let r:Response;const host=new URL(url).host;
 try{r=await fetcher(url,{headers,signal:AbortSignal.timeout(10000)});}catch(e){console.error('calendar provider',host,e instanceof Error?e.name:'network');throw new ProviderError('error');}
 if(!r.ok){const excerpt=(await r.text().catch(()=>'')).replace(/\s+/g,' ').trim().slice(0,200);console.error('calendar provider',host,r.status,excerpt);throw new ProviderError(r.status===401||r.status===403?'reconnect':'error');}
 try{const body=await r.json();return body&&typeof body==='object'?body:{};}catch{throw new ProviderError('error');}}
const GRAPH='https://graph.microsoft.com/';
export async function fetchMicrosoft(fetcher:Fetch,token:string,from:Date,to:Date):Promise<ExternalEvent[]>{const out:ExternalEvent[]=[],headers={Authorization:'Bearer '+token,Prefer:'outlook.timezone="UTC"'};
 let url:string|undefined=GRAPH+'v1.0/me/calendarView?startDateTime='+encodeURIComponent(from.toISOString())+'&endDateTime='+encodeURIComponent(to.toISOString())+'&$select=id,subject,start,end,isAllDay,isCancelled,location,onlineMeeting,webLink,responseStatus&$orderby=start/dateTime&$top=200';
 for(let n=0;url&&n<MAX_PAGES&&out.length<MAX_EVENTS;n++){const body=await page(fetcher,url,headers);
  for(const raw of Array.isArray(body.value)?body.value as GraphRaw[]:[]){const e=normalizeGraphEvent(raw);if(e)out.push(e);}
  // O token só vai para o próprio Graph: um nextLink de outro endereço encerra a leitura.
  const next=body['@odata.nextLink'];url=typeof next==='string'&&next.startsWith(GRAPH)?next:undefined;}
 return out.slice(0,MAX_EVENTS);}
export async function fetchGoogle(fetcher:Fetch,token:string,from:Date,to:Date):Promise<ExternalEvent[]>{const out:ExternalEvent[]=[];let pageToken:string|undefined;
 for(let n=0;n<MAX_PAGES&&out.length<MAX_EVENTS;n++){
  const params=new URLSearchParams({timeMin:from.toISOString(),timeMax:to.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'250',fields:'items(id,status,summary,start,end,location,hangoutLink,conferenceData/entryPoints,htmlLink,attendees(self,responseStatus)),nextPageToken'});if(pageToken)params.set('pageToken',pageToken);
  const body=await page(fetcher,'https://www.googleapis.com/calendar/v3/calendars/primary/events?'+params,{Authorization:'Bearer '+token});
  for(const raw of Array.isArray(body.items)?body.items as GoogleRaw[]:[]){const e=normalizeGoogleEvent(raw);if(e)out.push(e);}
  pageToken=typeof body.nextPageToken==='string'?body.nextPageToken:undefined;if(!pageToken)break;}
 return out.slice(0,MAX_EVENTS);}
export const fetchEvents=(provider:Provider,fetcher:Fetch,token:string,from:Date,to:Date)=>provider==='microsoft'?fetchMicrosoft(fetcher,token,from,to):fetchGoogle(fetcher,token,from,to);
