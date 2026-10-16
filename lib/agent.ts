import type { UIMessage } from 'ai';
import { COLLECTIONS } from './types.ts';
import type { Workspace, Item, Proposal, Collection } from './types.ts';
import { validDate, addDays, scheduledItems, isComplete, financeSummary, formatMoney, validateItem } from './core.ts';

// Consultas e validações usadas pelas ferramentas do assistente. Puras: recebem o espaço já carregado do usuário.
export type AgentMessage = UIMessage<unknown,{proposals:{items:Proposal[]}}>;
export const PROPOSABLE = ['tasks','transactions','notes'] as const;
const LABELS:Record<string,string> = {tasks:'Tarefa',transactions:'Lançamento',notes:'Nota'};
const FIELDS = ['title','date','time','endTime','repeat','type','category','status','priority','amount','direction','costPerDay','content','notes','bedtime','waketime','duration','quality','mood','target','current','unit','deadline','pages','pagesRead','day','startDate','dueDate','checked','weight'];
const clip = (value:string,max=300) => value.length>max?value.slice(0,max)+'…':value;
const norm = (value:unknown) => String(value??'').toLocaleLowerCase('pt-BR');

export function agendaRange(s:Workspace,start:string,end:string){
 if(!validDate(start)||!validDate(end)||end<start)throw new Error('Período inválido');
 const days:{date:string;items:{title:string;time?:string;type:string;done:boolean}[]}[]=[];
 for(let d=start;d<=end;d=addDays(d,1)){
  if(days.length>=31)throw new Error('Consulte no máximo 31 dias por vez');
  const items=scheduledItems(s,d).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  days.push({date:d,items:items.map(x=>({title:x.title,...(x.time?{time:x.time}:{}),type:x.type||'task',done:!!isComplete(s,x,d)}))});
 }
 return days;
}

export function financeReport(s:Workspace,month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Mês inválido, use AAAA-MM');
 const sum=financeSummary(s,month),groups=new Map<string,{total:number;count:number}>();
 for(const x of s.transactions.filter(x=>x.date?.startsWith(month)&&x.direction==='expense')){const g=groups.get(x.category||'Outros')||{total:0,count:0};g.total+=x.amount;g.count++;groups.set(x.category||'Outros',g);}
 return {mes:month,receitas:formatMoney(sum.income),despesas:formatMoney(sum.expense),saldo:formatMoney(sum.balance),orcamento:s.profile.budget?formatMoney(s.profile.budget):'não definido',...(s.profile.budget?{orcamentoRestante:formatMoney(sum.remaining)}:{}),despesasPorCategoria:[...groups].sort((a,b)=>b[1].total-a[1].total).map(([categoria,g])=>({categoria,total:formatMoney(g.total),lancamentos:g.count}))};
}

export function searchRecords(s:Workspace,{collection,text,limit=20}:{collection?:string;text?:string;limit?:number}){
 if(collection&&!(COLLECTIONS as readonly string[]).includes(collection))throw new Error('Coleção desconhecida');
 const term=norm(text).trim(),max=Math.min(Math.max(Math.floor(limit)||20,1),50);
 const rows=(collection?[collection]:[...COLLECTIONS]).flatMap(c=>(s[c as keyof Workspace] as Item[]).map(item=>({collection:c,item})));
 return rows.filter(({item})=>!term||[item.title,item.content,item.notes,item.category].some(v=>norm(v).includes(term)))
  .sort((a,b)=>String(b.item.date||'').localeCompare(String(a.item.date||'')))
  .slice(0,max)
  .map(({collection,item})=>{const out:Record<string,unknown>={collection};for(const key of FIELDS){const v=item[key];if(v===undefined||v===null||v==='')continue;out[key]=['amount','costPerDay'].includes(key)&&typeof v==='number'?formatMoney(v):typeof v==='string'?clip(v):v;}return out;});
}

export function checkProposals(raw:unknown,today:string){
 const valid:Proposal[]=[],errors:string[]=[];
 for(const entry of (Array.isArray(raw)?raw:[]).slice(0,15)){
  // O id é descartado: confirmPlan faz upsert, e um id vindo do modelo poderia sobrescrever um registro existente.
  const {collection,...fields}=(entry&&typeof entry==='object'?entry:{}) as Record<string,unknown>;delete fields.id;
  try{
   if(!(PROPOSABLE as readonly unknown[]).includes(collection))throw new Error('só é possível sugerir tarefas, lançamentos e notas');
   const defaults=collection==='tasks'?{date:today,type:'task',repeat:'none',section:'pessoal',priority:'normal'}:collection==='transactions'?{date:today}:{};
   valid.push({collection:collection as Collection,item:validateItem(collection as Collection,{...defaults,...fields})});
  }catch(e){errors.push(String(fields.title||'Item').slice(0,80)+': '+(e instanceof Error?e.message:'inválido'));}
 }
 return {valid,errors};
}

export function assistantBrief(s:Workspace,today:string){
 const p=s.profile,weekday=new Date(today+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'long',timeZone:'UTC'});
 const counts=['tasks','objectives','transactions','notes','sleep','books'].map(c=>c+': '+(s[c as keyof Workspace] as Item[]).length).join(', ');
 return ['Usuário: '+p.name,'Hoje: '+today+' ('+weekday+')','Fuso horário: '+p.timezone,'Ações por dia que cabem na rotina: '+p.dailyTarget,'Orçamento mensal: '+(p.budget?formatMoney(p.budget):'não definido'),'Meta de sono: '+p.sleepGoal/60+'h','Registros salvos: '+counts].join('\n');
}

export function describeProposal(p:Proposal){return [p.collection==='transactions'?formatMoney(p.item.amount||0)+(p.item.direction==='income'?' · Receita':' · Despesa'):p.collection==='notes'?'Nota'+(p.item.category?' · '+p.item.category:''):p.item.type==='habit'?'Hábito':p.item.type==='event'?'Compromisso':'Tarefa',p.item.date,p.item.time].filter(Boolean).join(' · ');}

export function proposalsText(items:unknown){
 const lines=(Array.isArray(items)?items:[]).slice(0,15).map(entry=>{const p=(entry||{}) as {collection?:string;item?:Record<string,unknown>},i=p.item||{};return '- ['+(LABELS[p.collection||'']||'Registro')+'] '+String(i.title||'').slice(0,200)+(typeof i.amount==='number'?' · '+formatMoney(i.amount)+(i.direction==='income'?' (receita)':' (despesa)'):'')+(i.date?' · '+String(i.date):'')+(i.time?' '+String(i.time):'');});
 return 'Sugestões mostradas ao usuário, aguardando a confirmação dele:\n'+lines.join('\n');
}

export function cleanHistory(raw:unknown):AgentMessage[]{
 if(!Array.isArray(raw)||raw.length>200)throw new Error('Conversa inválida');
 const out:AgentMessage[]=[];
 for(const m of raw){
  if(!m||typeof m!=='object'||(m.role!=='user'&&m.role!=='assistant'))continue;
  const parts:AgentMessage['parts']=[];
  for(const p of Array.isArray(m.parts)?m.parts:[]){
   if(p?.type==='text'&&typeof p.text==='string'){if(m.role==='user'&&p.text.length>4000)throw new Error('Use até 4.000 caracteres');parts.push({type:'text',text:clip(p.text,8000)});}
   else if(m.role==='assistant'&&p?.type==='data-proposals'&&Array.isArray(p.data?.items))parts.push({type:'data-proposals',data:{items:p.data.items.slice(0,15)}});
  }
  if(parts.length)out.push({id:String(m.id||crypto.randomUUID()).slice(0,100),role:m.role,parts});
 }
 let recent=out.slice(-20);while(recent.length&&recent[0].role!=='user')recent=recent.slice(1);
 const last=recent.at(-1);
 if(!last||last.role!=='user'||!last.parts.some(p=>p.type==='text'&&p.text.trim()))throw new Error('Escreva o que você quer organizar');
 return recent;
}
