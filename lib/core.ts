import { COLLECTIONS } from './types.ts';
import type { Workspace, Item, Collection, Command, Proposal } from './types.ts';
import { cleanMarkers, cleanReview, cleanFile } from './exam-schema.ts';

export const MOMENTS = [
{id:'coffee',title:'Um café sem pressa',category:'Pausa',cost:40,icon:'coffee'},
{id:'book',title:'Um capítulo a mais',category:'Aprender',cost:60,icon:'book'},
{id:'trail',title:'Sair para uma trilha',category:'Explorar',cost:90,icon:'mountain'},
{id:'workout',title:'Superar sua marca',category:'Movimento',cost:100,icon:'dumbbell'},
{id:'cinema',title:'Uma noite de cinema',category:'Pausa',cost:80,icon:'film'},
{id:'meal',title:'Preparar seu prato',category:'Cuidado',cost:70,icon:'utensils'},
{id:'friends',title:'Encontrar os amigos',category:'Conexão',cost:90,icon:'users'},
{id:'music',title:'Descobrir um som',category:'Pausa',cost:50,icon:'music'},
{id:'travel',title:'Conhecer outro lugar',category:'Explorar',cost:180,icon:'compass'},
{id:'sunrise',title:'Ver o dia começar',category:'Cuidado',cost:60,icon:'sunrise'},
{id:'finish',title:'Tirar um plano do papel',category:'Conquistar',cost:140,icon:'flag'},
{id:'rest',title:'Descansar de verdade',category:'Cuidado',cost:50,icon:'moon'}
];
const VALID_KEYS = new Set(['title','id','date','time','endTime','repeat','repeatUntil','weekdays','category','section','priority','duration','notes','content','amount','direction','cardId','objectiveId','target','current','unit','deadline','status','day','month','workoutId','exercises','weight','waist','chest','arm','mood','tags','courseId','subject','url','pages','pagesRead','bookId','minutes','roomId','quantity','checked','clientId','phone','email','company','startDate','costPerDay','viceId','trigger','bedtime','waketime','quality','description','type','installmentGroup','installmentIndex','installmentCount','paidMonths','label','dueDate','startTime','color','closingDay','dueDay']);
const NUMBERS=new Set(['amount','target','current','duration','day','quantity','pages','pagesRead','minutes','weight','waist','chest','arm','mood','quality','costPerDay','closingDay','dueDay','installmentIndex','installmentCount']);
const DATES=new Set(['date','deadline','startDate','dueDate','repeatUntil']);
const TIMES=new Set(['time','endTime','bedtime','waketime','startTime']);
VALID_KEYS.add('appliedPages');NUMBERS.add('appliedPages');
for(const key of ['lab','markers','file','review','createdOn','dose','intervalDays','doctor','remind','remindedOn','snoozedUntil','protocolId','site'])VALID_KEYS.add(key);NUMBERS.add('dose');NUMBERS.add('intervalDays');for(const key of ['createdOn','remindedOn','snoozedUntil'])DATES.add(key);
// Coleções criadas depois do lançamento: espaços e backups antigos ganham a lista vazia.
const ADDED_COLLECTIONS=['labExams','trtProtocols','trtDoses'];
export function upgradeWorkspace<T>(raw:T):T{if(raw&&typeof raw==='object'){const s=raw as Record<string,unknown>;for(const key of ADDED_COLLECTIONS)if(s[key]===undefined)s[key]=[];}return raw;}
export function emptyWorkspace(name=''): Workspace {
 const result:any={profile:{name,timezone:'America/Sao_Paulo',theme:'light',budget:0,openingBalance:0,sleepGoal:480,bedtime:'23:00',waketime:'07:00',dailyTarget:3,assistantName:'GeoAI',xp:0,points:0,avatar:{skin:'#c48b68',hair:'#302c28',beard:true,shirt:'#24594c'},unlockedMoments:[]},completions:{},rewarded:[]};
 for(const key of COLLECTIONS)result[key]=[];return result;
}
export function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
export function addDays(value:string,days:number){if(!validDate(value))throw new Error('Data inválida');const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function todayInZone(zone='America/Sao_Paulo',now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function moneyToCents(input:string|number){const raw=String(input).trim().replace(/R\$\s*/g,'');const value=raw.includes(',')?Number(raw.replace(/\./g,'').replace(',','.')):Number(raw);if(!raw||!Number.isFinite(value)||value<0||value>1e9)throw new Error('Informe um valor válido');return Math.round((value+Number.EPSILON)*100);}
export function formatMoney(cents:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);}
export function allocateInstallments(total:number,count:number,date:string){if(!Number.isSafeInteger(total)||total<=0||!Number.isInteger(count)||count<1||count>120||!validDate(date))throw new Error('Parcelamento inválido');const [y,m,d]=date.split('-').map(Number);return Array.from({length:count},(_,i)=>{const anchor=new Date(Date.UTC(y,m-1+i,1,12));const last=new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+1,0)).getUTCDate();return {amount:Math.floor(total/count)+(i<total%count?1:0),date:anchor.toISOString().slice(0,8)+String(Math.min(d,last)).padStart(2,'0')};});}
export function occursOn(task:any,date:string){if(!validDate(date))return false;const start=task.date||task.startDate;if(start&&!validDate(start))return false;if(start&&date<start)return false;if(task.repeatUntil&&date>task.repeatUntil)return false;const repeat=task.repeat||'none';if(repeat==='none')return !start||date===start;const day=new Date(date+'T12:00:00Z').getUTCDay();if(repeat==='daily')return true;if(repeat==='weekdays')return day>0&&day<6;if(repeat==='weekly'){if(Array.isArray(task.weekdays)&&task.weekdays.length)return task.weekdays.includes(day);return !!start&&day===new Date(start+'T12:00:00Z').getUTCDay();}if(repeat==='monthly'){if(!start)return false;const last=new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0)).getUTCDate();return Number(date.slice(8))===Math.min(Number(start.slice(8)),last);}return false;}
export function consecutiveDays(dates:string[],today:string){const unique=new Set(dates.filter(validDate));let cursor=unique.has(today)?today:addDays(today,-1);let n=0;while(unique.has(cursor)){n++;cursor=addDays(cursor,-1);}return n;}
export function sleepDuration(bedtime:string,waketime:string){const parse=(v:string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw new Error('Horário inválido');const [h,m]=v.split(':').map(Number);return h*60+m;};const diff=parse(waketime)-parse(bedtime);return diff<=0?diff+1440:diff;}
export function validateItem(collection:string,raw:any):Item{
 if(!(COLLECTIONS as readonly string[]).includes(collection)||!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Registro inválido');
 if(typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>200)throw new Error('Informe um título de até 200 caracteres');
 const id=raw.id||crypto.randomUUID();if(typeof id!=='string'||!/^[\w-]{1,100}$/.test(id))throw new Error('Identificador inválido');
 const item:any={id,title:raw.title.trim()};
 for(const [key,value] of Object.entries(raw)){
  if(!VALID_KEYS.has(key)||key==='id'||key==='title'||value===''||value==null)continue;
  if(NUMBERS.has(key)){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)throw new Error('Valor inválido: '+key);if(['amount','costPerDay'].includes(key)&&!Number.isSafeInteger(value))throw new Error('Valores devem usar centavos inteiros');item[key]=value;}
  else if(DATES.has(key)){if(typeof value!=='string'||!validDate(value))throw new Error('Data inválida');item[key]=value;}
  else if(TIMES.has(key)){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Horário inválido');item[key]=value;}
  else if(key==='checked'||key==='remind'){if(typeof value!=='boolean')throw new Error('Campo de conclusão inválido');item[key]=value;}
  else if(key==='markers')item[key]=cleanMarkers(value);
  else if(key==='review')item[key]=cleanReview(value);
  else if(key==='file')item[key]=cleanFile(value);
  else if(typeof value==='string'){if(value.length>10000)throw new Error('Texto muito longo');item[key]=value;}
  else if(Array.isArray(value)&&['weekdays','paidMonths','tags'].includes(key)&&value.length<=100&&value.every(x=>typeof x==='string'||typeof x==='number'))item[key]=value;
  else throw new Error('Tipo inválido para '+key);
 }
 if(item.repeat&&!['none','daily','weekdays','weekly','monthly'].includes(item.repeat))throw new Error('Repetição inválida');
 if(['tasks','transactions','journal','sessions','measurements','activities','readingLogs','sleep','relapses','reviews','focusSessions','chores','labExams','trtDoses'].includes(collection)&&!item.date)throw new Error('Informe a data do registro');
 if(['transactions','bills'].includes(collection)&&(!Number.isSafeInteger(item.amount)||item.amount<=0))throw new Error('Informe um valor maior que zero');
 if(collection==='bills'&&(!Number.isInteger(item.day)||item.day<1||item.day>31))throw new Error('Informe um dia entre 1 e 31');
 if(['books','readingLogs'].includes(collection)&&(!Number.isInteger(item.pages)||item.pages<1))throw new Error('Informe a quantidade de páginas');
 if(collection==='readingLogs'&&item.appliedPages!==undefined&&(!Number.isInteger(item.appliedPages)||item.appliedPages>item.pages))throw new Error('Progresso de leitura inválido');
 if(collection==='vices'&&!item.startDate)throw new Error('Informe o início do acompanhamento');
 if(['focusSessions','sessions'].includes(collection)&&(!Number.isFinite(item.duration)||item.duration<1||item.duration>1440))throw new Error('Informe a duração em minutos');
 if(collection==='transactions'&&!['income','expense'].includes(item.direction))throw new Error('Tipo de transação inválido');
 if(collection==='journal'&&(!Number.isInteger(item.mood)||item.mood<1||item.mood>5))throw new Error('Humor inválido');
 if(collection==='sleep'&&(!Number.isInteger(item.quality)||item.quality<1||item.quality>5))throw new Error('Informe a qualidade da noite');
 if(collection==='sleep'){if(!item.date||!item.bedtime||!item.waketime)throw new Error('Preencha a noite e os horários');item.duration=sleepDuration(item.bedtime,item.waketime);}
 if(collection==='labExams'){item.status??='draft';if(!['draft','reviewed'].includes(item.status))throw new Error('Situação do exame inválida');item.markers??=[];}
 if(collection==='trtProtocols'){if(!item.startDate)throw new Error('Informe o início do protocolo');if(!(item.dose>0))throw new Error('Informe a dose');if(!Number.isInteger(item.intervalDays)||item.intervalDays<1||item.intervalDays>90)throw new Error('Informe o intervalo entre 1 e 90 dias');item.unit??='mg';if(!['mg','mL','g'].includes(item.unit))throw new Error('Unidade inválida');item.status??='active';if(!['active','paused'].includes(item.status))throw new Error('Situação do protocolo inválida');}
 if(collection==='trtDoses'){if(typeof item.protocolId!=='string'||!/^[\w-]{1,100}$/.test(item.protocolId))throw new Error('Escolha o protocolo');if(item.dose!==undefined&&!(item.dose>0))throw new Error('Dose inválida');}
 if(item.repeatUntil&&item.date&&item.repeatUntil<item.date)throw new Error('Término anterior ao início');
 return item;
}
export function validateWorkspace(raw:any):Workspace{
 raw=upgradeWorkspace(raw&&typeof raw==='object'?{...raw}:raw);
 if(!raw||typeof raw!=='object'||!raw.profile||COLLECTIONS.some(k=>!Array.isArray(raw[k])))throw new Error('Backup não reconhecido');
 const s=emptyWorkspace();s.profile=cleanProfile(raw.profile,s.profile);
 // Restore earned progress only from validated backup; this is personal progress, not a purchased balance.
 if(Number.isSafeInteger(raw.profile.xp)&&raw.profile.xp>=0)s.profile.xp=Math.min(raw.profile.xp,1e7);
 if(Number.isSafeInteger(raw.profile.points)&&raw.profile.points>=0)s.profile.points=Math.min(raw.profile.points,1e7);
 s.profile.unlockedMoments=Array.isArray(raw.profile.unlockedMoments)?raw.profile.unlockedMoments.filter((x:string)=>MOMENTS.some(m=>m.id===x)):[];
 for(const key of COLLECTIONS){if(raw[key].length>2000)throw new Error('Limite de registros excedido');s[key]=raw[key].map((x:any)=>validateItem(key,x));if(new Set(s[key].map(x=>x.id)).size!==s[key].length)throw new Error('Identificadores duplicados');}
 if(raw.completions&&typeof raw.completions==='object')for(const [key,value]of Object.entries(raw.completions))if(/^[\w-]+:\d{4}-\d{2}-\d{2}$/.test(key)&&typeof value==='boolean')s.completions[key]=value;
 s.rewarded=Array.isArray(raw.rewarded)?raw.rewarded.filter((x:any)=>typeof x==='string'&&x.length<160).slice(-20000):[];
 if(JSON.stringify(s).length>1000000)throw new Error('Backup muito grande');return s;
}
function cleanProfile(raw:any,previous:Workspace['profile']){
 const p=structuredClone(previous);
 for(const key of ['name','assistantName'] as const)if(typeof raw[key]==='string')p[key]=raw[key].trim().slice(0,80);
 if(typeof raw.timezone==='string'){try{new Intl.DateTimeFormat('en',{timeZone:raw.timezone});p.timezone=raw.timezone;}catch{throw new Error('Fuso horário inválido');}}
 if(['light','dark','system'].includes(raw.theme))p.theme=raw.theme;
 for(const key of ['budget','openingBalance','sleepGoal','dailyTarget'] as const)if(raw[key]!==undefined){if(!Number.isSafeInteger(raw[key])||raw[key]<0||raw[key]>1e12)throw new Error('Configuração inválida');p[key]=raw[key];}
 for(const key of ['bedtime','waketime'] as const)if(raw[key]){sleepDuration(raw[key],raw[key]);p[key]=raw[key];}
 if(raw.avatar){const a=raw.avatar;for(const key of ['skin','hair','shirt'] as const)if(typeof a[key]==='string'&&/^#[0-9a-f]{6}$/i.test(a[key]))p.avatar[key]=a[key];if(typeof a.beard==='boolean')p.avatar.beard=a.beard;}
 return p;
}
function reward(s:Workspace,key:string,points:number){if(s.rewarded.includes(key))return;s.rewarded.push(key);s.profile.xp+=points;s.profile.points+=points;}
export function applyCommand(state:Workspace,command:Command,today:string):Workspace{
 if(!validDate(today)||!command||typeof command.type!=='string')throw new Error('Comando inválido');const s=structuredClone(state);
 const get=(collection:Collection,id?:string)=>{const item=s[collection].find(x=>x.id===id);if(!item)throw new Error('Registro não encontrado');return item;};
 if(command.type==='upsert'){
  const col=command.collection as Collection;const item=validateItem(col,command.item);const index=s[col].findIndex(x=>x.id===item.id);
  if(index>=0&&command.item?._rev!==undefined&&command.item._rev!==(s[col][index]._rev||0))throw new Error('Este registro foi atualizado em outra aba. Feche o formulário e abra novamente.');
  item._rev=(index>=0?s[col][index]._rev||0:0)+1;
  if(['journal','sleep'].includes(col)&&s[col].some(x=>x.date===item.date&&x.id!==item.id))throw new Error('Já existe um registro para esta data. Edite o registro existente.');
  if(col==='readingLogs'){const previous=index>=0?s[col][index]:undefined;if(previous){const oldBook=s.books.find(x=>x.id===previous.bookId);if(oldBook){oldBook.pagesRead=Math.max(0,(oldBook.pagesRead||0)-(previous.appliedPages??previous.pages));if(oldBook.status==='done'&&oldBook.pagesRead<oldBook.pages)oldBook.status='active';}}const book=s.books.find(x=>x.id===item.bookId);if(!book)throw new Error('Selecione um livro da sua biblioteca');item.appliedPages=Math.min(item.pages,Math.max(0,book.pages-(book.pagesRead||0)));book.pagesRead=(book.pagesRead||0)+item.appliedPages;if(book.pagesRead>=book.pages)book.status='done';}
  if(index<0&&s[col].length>=2000)throw new Error('Limite da coleção atingido');if(index<0)s[col].push(item);else s[col][index]=item;
  if(col==='journal')reward(s,'journal:'+item.date,15);
  if(col==='sleep')reward(s,'sleep:'+item.date,10);
  if(col==='focusSessions')reward(s,'focus:'+item.id,20);
  if(col==='sessions')reward(s,'workout:'+item.id,25);
 }else if(command.type==='delete'){
  const col=command.collection as Collection;if(!(COLLECTIONS as readonly string[]).includes(col))throw new Error('Coleção inválida');get(col,command.id);
  if(col==='readingLogs'){const log=get(col,command.id);const book=s.books.find(x=>x.id===log.bookId);if(book){book.pagesRead=Math.max(0,(book.pagesRead||0)-(log.appliedPages??log.pages));if(book.status==='done'&&book.pagesRead<book.pages)book.status='active';}}
  if(col==='transactions')for(const bill of s.bills)bill.paidMonths=(bill.paidMonths||[]).filter((month:string)=>command.id!=='bill-'+bill.id+'-'+month);
  s[col]=s[col].filter(x=>x.id!==command.id);
  if(col==='objectives')s.tasks.forEach(t=>{if(t.objectiveId===command.id)delete t.objectiveId;});
  if(col==='rooms')s.chores.forEach(t=>{if(t.roomId===command.id)delete t.roomId;});
 }else if(command.type==='patch'){
  const col=command.collection as Collection;if(!(COLLECTIONS as readonly string[]).includes(col))throw new Error('Coleção inválida');const current=get(col,command.id);
  if(!command.item||typeof command.item!=='object')throw new Error('Alteração inválida');
  const item=validateItem(col,{...current,...command.item,id:current.id});item._rev=(current._rev||0)+1;s[col]=s[col].map(x=>x.id===current.id?item:x);
 }else if(command.type==='toggleTask'){
  const item=get('tasks',command.id);const date=command.date||today;if(date>today||!occursOn(item,date))throw new Error('Ocorrência indisponível');const key=item.id+':'+date;s.completions[key]=command.done===undefined?!s.completions[key]:!!command.done;
  if(s.completions[key])reward(s,'task:'+key,10);
 }else if(command.type==='toggleRecord'){
  const col=command.collection as Collection;if(!['chores','activities'].includes(col))throw new Error('Registro indisponível');const item=get(col,command.id);const date=command.date||today;if(date>today||!occursOn(item,date))throw new Error('Ocorrência indisponível');const key=col+'-'+item.id+':'+date;const done=command.done===undefined?!s.completions[key]:!!command.done;s.completions[key]=done;if(col==='activities')item.status=done?'done':'active';if(done)reward(s,'record:'+key,10);
 }else if(command.type==='profile'){s.profile=cleanProfile(command.profile||{},s.profile);
 }else if(command.type==='buyMoment'){
  const moment=MOMENTS.find(x=>x.id===command.id);if(!moment)throw new Error('Momento inválido');if(!s.profile.unlockedMoments.includes(moment.id)){if(s.profile.points<moment.cost)throw new Error('Continue sua rotina para ganhar mais pontos');s.profile.points-=moment.cost;s.profile.unlockedMoments.push(moment.id);}
 }else if(command.type==='payBill'){
  const bill=get('bills',command.id);const month=command.month||today.slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Mês inválido');
  const id='bill-'+bill.id+'-'+month;if(!s.transactions.some(x=>x.id===id)){s.transactions.push(validateItem('transactions',{id,title:bill.title,amount:bill.amount,direction:'expense',category:bill.category||'Contas',date:today,cardId:bill.cardId}));bill.paidMonths=[...new Set([...(bill.paidMonths||[]),month])];}
 }else if(command.type==='installments'){
  const raw=command.item;if(!raw?.title)throw new Error('Informe a compra');const group=raw.id||crypto.randomUUID();const rows=allocateInstallments(raw.amount,raw.installmentCount,raw.date);
  if(s.transactions.length+rows.length>2000)throw new Error('Limite de registros excedido');
  rows.forEach((r,i)=>{const id=group+'-part-'+(i+1);if(!s.transactions.some(x=>x.id===id))s.transactions.push(validateItem('transactions',{...raw,...r,id,title:raw.title+' ('+(i+1)+'/'+rows.length+')',direction:'expense',installmentGroup:group,installmentIndex:i+1,installmentCount:rows.length}));});
 }else if(command.type==='confirmPlan'){
  if(!Array.isArray(command.items)||command.items.length>30)throw new Error('Plano inválido');
  let result=s;for(const p of command.items)result=applyCommand(result,{type:'upsert',collection:p.collection,item:p.item},today);return result;
 }else if(command.type==='import'){return validateWorkspace(command.state);
 }else if(command.type==='reset'){return emptyWorkspace(s.profile.name);
 }else throw new Error('Ação não reconhecida');
 if(JSON.stringify(s).length>1000000)throw new Error('Seu backup excedeu o limite de armazenamento');return s;
}
export function planFromText(text:string,today:string):Proposal[]{
 if(typeof text!=='string'||text.length>4000)throw new Error('Descreva seu plano em até 4.000 caracteres');
 return text.split(/[;\n]+/).map(x=>x.trim()).filter(Boolean).slice(0,15).map(line=>{
  const financial=/(gastei|paguei|comprei|recebi|ganhei|r\$)/i.test(line);const match=line.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  const date=/amanh[ãa]/i.test(line)?addDays(today,1):today;const time=line.match(/(?:[àa]s?|\b)\s*([01]?\d|2[0-3])[:h]([0-5]\d)\b/i);
  if(financial&&match)return{collection:'transactions',item:{id:crypto.randomUUID(),title:line.slice(0,180),amount:moneyToCents(match[1]),direction:/(recebi|ganhei)/i.test(line)?'income':'expense',category:/(almo[cç]o|jantar|comida|caf[eé])/i.test(line)?'Alimentação':'Outros',date}};
  return{collection:'tasks',item:{id:crypto.randomUUID(),title:line.replace(/\bamanh[ãa]\b/gi,'').replace(/\s+[àa]s?\s+\d{1,2}[:h]\d{2}/gi,'').trim().slice(0,180),date,time:time?time[1].padStart(2,'0')+':'+time[2]:undefined,repeat:/(todo dia|diariamente|todos os dias)/i.test(line)?'daily':'none',section:'pessoal',type:/(todo dia|h[áa]bito)/i.test(line)?'habit':'task',priority:'normal'}};
 });
}
export function financeSummary(s:Workspace,month:string){const monthRows=s.transactions.filter(x=>x.date?.startsWith(month));const income=monthRows.filter(x=>x.direction==='income').reduce((a,x)=>a+x.amount,0);const expense=monthRows.filter(x=>x.direction==='expense').reduce((a,x)=>a+x.amount,0);const all=s.transactions.filter(x=>x.date<=month+'-31');const balance=s.profile.openingBalance+all.reduce((a,x)=>a+(x.direction==='income'?x.amount:-x.amount),0);return{income,expense,balance,remaining:s.profile.budget-expense};}
// Próxima aplicação de um protocolo: última aplicação (antes de `before`, quando informado) + intervalo; sem aplicações, a data de início.
export function nextApplicationDate(protocol:Item,doses:Item[],before?:string):string{const last=doses.filter(d=>d.protocolId===protocol.id&&validDate(d.date)&&(!before||d.date<before)).map(d=>d.date as string).sort().pop();return last?addDays(last,protocol.intervalDays||0):protocol.startDate;}
export function scheduledItems(s:Workspace,date:string):Item[]{
 // Aplicações de testosterona entram como compromissos calculados: não são salvas em tasks.
 const applications=s.trtProtocols.filter(p=>p.status==='active'&&nextApplicationDate(p,s.trtDoses,date)===date).map(p=>({id:p.id,title:'Aplicação: '+p.title,type:'event',section:'testosterona',_collection:'trtProtocols'}));
 return [...[...s.tasks.map(x=>({...x,_collection:'tasks'})),...s.chores.map(x=>({...x,_collection:'chores',type:'task',section:'casa'})),...s.activities.map(x=>({...x,_collection:'activities',type:'task',section:'estudos'}))].filter(x=>occursOn(x,date)),...applications];}
export function isComplete(s:Workspace,item:Item,date:string){const source=item._collection||'tasks';return !!s.completions[(source==='tasks'?'':source+'-')+item.id+':'+date]||(source==='activities'&&item.status==='done')||(source==='chores'&&item.checked&&item.date===date)||(source==='trtProtocols'&&s.trtDoses.some(d=>d.protocolId===item.id&&d.date===date));}

