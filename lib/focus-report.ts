import type {Item} from './types.ts';
// Relatório de foco: só contam os focos concluídos; as sessões antigas, sem status, contam como concluídas.
export type ReportCard={id:string;number:number;title:string;estimate:number};
export type FocusReport={start:string;end:string;total:number;minutes:number;interrupted:number;byDay:{date:string;pomodoros:number;minutes:number}[];byCard:{cardId:string|null;code:string;title:string;pomodoros:number;minutes:number;estimated:number|null}[]};
const shift=(d:string,n:number)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
export function weekRange(today:string,offset=0){const dow=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7,start=shift(today,-dow+offset*7),last=shift(start,6);
 return {start,end:last>today?today:last,days:Array.from({length:7},(_,i)=>shift(start,i))};}
export function focusReport(sessions:Item[],cards:ReportCard[],start:string,end:string):FocusReport{
 if(!(start<=end))throw new Error('Período inválido');const span=Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;if(span>62)throw new Error('Consulte no máximo 62 dias por vez');
 const inRange=sessions.filter(x=>typeof x.date==='string'&&x.date>=start&&x.date<=end&&(x.kind??'focus')==='focus'),done=inRange.filter(x=>(x.status??'completed')==='completed');
 const byDay=Array.from({length:span},(_,i)=>{const date=shift(start,i),rows=done.filter(x=>x.date===date);return {date,pomodoros:rows.length,minutes:rows.reduce((s,x)=>s+(x.duration||0),0)};});
 const groups=new Map<string,{pomodoros:number;minutes:number}>();for(const x of done){const k=x.boardCardId||'',g=groups.get(k)||{pomodoros:0,minutes:0};g.pomodoros++;g.minutes+=x.duration||0;groups.set(k,g);}
 const byId=new Map(cards.map(c=>[c.id,c]));
 const byCard=[...groups].map(([k,g])=>{const c=k?byId.get(k):undefined;return {cardId:k||null,code:k?(c?'#'+c.number:'—'):'',title:k?(c?c.title:'Card excluído'):'Foco livre',...g,estimated:c?c.estimate:null};}).sort((a,b)=>b.pomodoros-a.pomodoros||b.minutes-a.minutes).slice(0,20);
 return {start,end,total:done.length,minutes:done.reduce((s,x)=>s+(x.duration||0),0),interrupted:inRange.filter(x=>x.status==='interrupted').length,byDay,byCard};}
export function formatMinutes(m:number){return m<60?m+' min':Math.floor(m/60)+'h'+String(m%60).padStart(2,'0');}
