import type { UIMessage } from 'ai';
import { COLLECTIONS } from './types.ts';
import type { Workspace, Item, Proposal, Collection, Gender } from './types.ts';
import { validDate, addDays, isComplete, financeSummary, formatMoney, validateItem, checkInvestmentEvent } from './core.ts';
import { positions, portfolio, incomeInYear, kindInfo, moveLabel, monthEnd, formatQty, formatPrice } from './invest.ts';
import { genderBrief, hiddenSections } from './gender.ts';
import { cyclePrediction, dailyStatus, injectionNext, iudStatus, preventiveStatus, METHOD_SHORT, PREVENTIVE_LABEL } from './female-health.ts';
import { protocolStatus, punctuality, finalOverall, classifyMarker, rangeText, valueText, STATUS_LABEL, OVERALL_LABEL } from './testosterone.ts';
import type { Marker } from './exam-schema.ts';
import { agendaItems, agendaOrder, type ExternalEvent } from './external-calendar.ts';
import { budgetView } from './finance.ts';

// Consultas e validações usadas pelas ferramentas do assistente. Puras: recebem o espaço já carregado do usuário.
export type AgentMessage = UIMessage<unknown,{proposals:{items:Proposal[]}}>;
export const PROPOSABLE = ['tasks','transactions','notes','trtDoses','periods','contraceptiveDoses','intimacy','investmentEvents'] as const;
const LABELS:Record<string,string> = {tasks:'Tarefa',transactions:'Lançamento',notes:'Nota',trtDoses:'Aplicação',periods:'Menstruação',contraceptiveDoses:'Uso do método',intimacy:'Relação',investmentEvents:'Investimento'};
const FIELDS = ['title','date','time','endTime','repeat','type','category','status','priority','amount','direction','costPerDay','content','notes','bedtime','waketime','duration','quality','mood','target','current','unit','deadline','pages','pagesRead','day','startDate','dueDate','checked','weight','dose','intervalDays','site','lab','protection','kind','ticker','broker','assetId','move','quantity','price','rate','indexer'];
const clip = (value:string,max=300) => value.length>max?value.slice(0,max)+'…':value;
const norm = (value:unknown) => String(value??'').toLocaleLowerCase('pt-BR');

export function agendaRange(s:Workspace,start:string,end:string,external:ExternalEvent[]=[]){
 if(!validDate(start)||!validDate(end)||end<start)throw new Error('Período inválido');
 const days:{date:string;items:{title:string;time?:string;endTime?:string;type:string;done?:boolean;readOnly?:boolean}[]}[]=[];
 for(let d=start;d<=end;d=addDays(d,1)){
  if(days.length>=31)throw new Error('Consulte no máximo 31 dias por vez');
  // Compromissos do Outlook e do Google vêm marcados como só leitura e sem conclusão.
  const items=agendaItems(s,external,d).sort(agendaOrder);
  days.push({date:d,items:items.map(x=>x._collection==='external'?{title:x.title,...(x.time?{time:x.time}:{}),...(x.endTime?{endTime:x.endTime}:{}),type:x.provider==='microsoft'?'outlook':'google',readOnly:true}:{title:x.title,...(x.time?{time:x.time}:{}),type:x.type||'task',done:!!isComplete(s,x,d)})});
 }
 return days;
}

const SITUACAO:Record<string,string>={none:'sem teto',ok:'dentro',near:'perto',over:'estourado'};
export function financeReport(s:Workspace,month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Mês inválido, use AAAA-MM');
 const sum=financeSummary(s,month),groups=new Map<string,{total:number;count:number}>();
 for(const x of s.transactions.filter(x=>x.date?.startsWith(month)&&x.direction==='expense')){const g=groups.get(x.category||'Outros')||{total:0,count:0};g.total+=x.amount;g.count++;groups.set(x.category||'Outros',g);}
 const b=budgetView(s,month);
 // Carteira no fim do mês pedido (movimentos nunca têm data futura, então no mês atual é a posição de hoje).
 const until=monthEnd(month),pos=positions(s.investments,s.investmentEvents,until).filter(p=>!p.closed),t=portfolio(pos);
 const investimentos=s.investments.length?{investimentos:{patrimonio:formatMoney(t.value),investido:formatMoney(t.invested),resultado:formatMoney(t.unrealized),resultadoPct:(t.pct>0?'+':'')+String(t.pct).replace('.',',')+'%',proventosNoAno:formatMoney(incomeInYear(s.investmentEvents,month.slice(0,4),until)),ativos:pos.slice(0,30).map(p=>({id:p.asset.id,nome:p.asset.title,...(p.asset.ticker?{codigo:p.asset.ticker}:{}),tipo:kindInfo(p.asset.kind).label,...(p.mode==='quantity'?{quantidade:formatQty(p.quantity)}:{}),valorAtual:formatMoney(p.value),resultado:formatMoney(p.unrealized),...(p.priceDate?{cotacaoEm:p.priceDate}:{})}))}}:{};
 return {mes:month,receitas:formatMoney(sum.income),despesas:formatMoney(sum.expense),saldo:formatMoney(sum.balance),orcamento:s.profile.budget?formatMoney(s.profile.budget):'não definido',...(s.profile.budget?{orcamentoRestante:formatMoney(sum.remaining)}:{}),despesasPorCategoria:[...groups].sort((a,b)=>b[1].total-a[1].total).map(([categoria,g])=>({categoria,total:formatMoney(g.total),lancamentos:g.count})),tetoDoMes:{teto:b.month.cap?formatMoney(b.month.cap):'não definido',gasto:formatMoney(b.month.spent),situacao:SITUACAO[b.month.state]},tetosPorCategoria:b.categories.filter(c=>c.cap).map(c=>({categoria:c.name,teto:formatMoney(c.cap),gasto:formatMoney(c.spent),restante:formatMoney(c.cap-c.spent),situacao:SITUACAO[c.state]})),...investimentos};
}

export function searchRecords(s:Workspace,{collection,text,limit=20}:{collection?:string;text?:string;limit?:number}){
 if(collection&&!(COLLECTIONS as readonly string[]).includes(collection))throw new Error('Coleção desconhecida');
 const term=norm(text).trim(),max=Math.min(Math.max(Math.floor(limit)||20,1),50);
 const rows=(collection?[collection]:[...COLLECTIONS]).flatMap(c=>(s[c as keyof Workspace] as Item[]).map(item=>({collection:c,item})));
 return rows.filter(({item})=>!term||[item.title,item.content,item.notes,item.category].some(v=>norm(v).includes(term)))
  .sort((a,b)=>String(b.item.date||'').localeCompare(String(a.item.date||'')))
  .slice(0,max)
  .map(({collection,item})=>{const out:Record<string,unknown>={collection};if(collection==='investments')out.id=item.id;for(const key of FIELDS){const v=item[key];if(v===undefined||v===null||v==='')continue;out[key]=['amount','costPerDay'].includes(key)&&typeof v==='number'?formatMoney(v):key==='price'&&typeof v==='number'?formatPrice(v):typeof v==='string'?clip(v):v;}return out;});
}

function proposalDefaults(collection:unknown,fields:Record<string,unknown>,today:string,s?:Workspace){
 if(collection==='tasks')return {date:today,type:'task',repeat:'none',section:'pessoal',priority:'normal'};
 if(collection==='transactions')return {date:today};
 if(collection==='trtDoses'){const protocols=s?.trtProtocols||[],active=protocols.filter(p=>p.status==='active');
  const p=fields.protocolId?protocols.find(x=>x.id===fields.protocolId):active.length===1?active[0]:undefined;
  if(!p)throw new Error('cadastre ou escolha o protocolo no menu Testosterona');
  const day=typeof fields.date==='string'?fields.date:today;
  if((s?.trtDoses||[]).some(d=>d.protocolId===p.id&&d.date===day))throw new Error('a aplicação desse dia já está registrada');
  return {date:today,title:'Aplicação: '+p.title,protocolId:p.id,...(p.dose?{dose:p.dose}:{})};}
 if(collection==='periods')return {date:today,title:'Menstruação'};
 if(collection==='intimacy'){const day=typeof fields.date==='string'?fields.date:today;if(day>today)throw new Error('a data não pode ser no futuro');if((s?.intimacy||[]).some(r=>r.date===day))throw new Error('o registro desse dia já existe');return {date:today,title:'Relação'};}
 if(collection==='contraceptiveDoses'){const methods=s?.contraceptives||[],active=methods.filter(m=>m.status==='active'&&m.method!=='iud');
  const m=fields.methodId?methods.find(x=>x.id===fields.methodId):active.length===1?active[0]:undefined;
  if(!m)throw new Error('cadastre ou escolha o método no menu Saúde feminina');
  const day=typeof fields.date==='string'?fields.date:today;
  if((s?.contraceptiveDoses||[]).some(d=>d.methodId===m.id&&d.date===day))throw new Error('o registro desse dia já existe');
  return {date:today,title:(m.method==='injection'?'Injeção: ':'Tomei: ')+m.title,methodId:m.id};}
 if(collection==='investmentEvents')return {date:today};
 return {};
}
export function checkProposals(raw:unknown,today:string,s?:Workspace){
 const valid:Proposal[]=[],errors:string[]=[];
 for(const entry of (Array.isArray(raw)?raw:[]).slice(0,15)){
  // O id é descartado: confirmPlan faz upsert, e um id vindo do modelo poderia sobrescrever um registro existente.
  const {collection,...fields}=(entry&&typeof entry==='object'?entry:{}) as Record<string,unknown>;delete fields.id;
  try{
   if(!(PROPOSABLE as readonly unknown[]).includes(collection))throw new Error('só é possível sugerir tarefas, lançamentos, notas, aplicações, início da menstruação, uso do método e relação');
   if(s){const hidden=hiddenSections(s.profile.gender);
    if(['periods','contraceptiveDoses','intimacy'].includes(collection as string)&&hidden.includes('saude-feminina'))throw new Error('esse registro fica no menu Saúde feminina, que não aparece no seu perfil');
    if(collection==='trtDoses'&&hidden.includes('testosterona'))throw new Error('esse registro fica no menu Testosterona, que não aparece no seu perfil');}
   const item=validateItem(collection as Collection,{...proposalDefaults(collection,fields,today,s),...fields});
   // Movimento de investimento: confere ativo, data e posição agora; o título diz o que é ("Compra · PETR4").
   if(collection==='investmentEvents'&&s){const asset=checkInvestmentEvent(s,item,today),a=asset||item.newAsset;item.title=moveLabel(item.move,a.kind)+' · '+(a.ticker||a.title);if(asset){item.assetId=asset.id;delete item.newAsset;}}
   valid.push({collection:collection as Collection,item});
  }catch(e){errors.push(String(fields.title||'Item').slice(0,80)+': '+(e instanceof Error?e.message:'inválido'));}
 }
 return {valid,errors};
}

export function assistantBrief(s:Workspace,today:string){
 const p=s.profile,weekday=new Date(today+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'long',timeZone:'UTC'});
 const counts=['tasks','objectives','transactions','notes','sleep','books'].map(c=>c+': '+(s[c as keyof Workspace] as Item[]).length).join(', ');
 return ['Usuário: '+p.name,genderBrief(p.gender),'Hoje:'+today+' ('+weekday+')','Fuso horário: '+p.timezone,'Ações por dia que cabem na rotina: '+p.dailyTarget,'Orçamento mensal: '+(p.budget?formatMoney(p.budget):'não definido'),'Meta de sono: '+p.sleepGoal/60+'h','Registros salvos: '+counts].join('\n');
}

export function describeProposal(p:Proposal){return [p.collection==='investmentEvents'?[typeof p.item.quantity==='number'?formatQty(p.item.quantity)+' un.':'',p.item.move==='valuation'&&typeof p.item.price==='number'?formatPrice(p.item.price):typeof p.item.amount==='number'?formatMoney(p.item.amount):''].filter(Boolean).join(' · '):p.collection==='intimacy'?'Relação'+(p.item.protection==='com'?' · com proteção':p.item.protection==='sem'?' · sem proteção':''):p.collection==='periods'?'Início da menstruação'+(p.item.flow?' · fluxo '+p.item.flow:''):p.collection==='contraceptiveDoses'?'Uso do método':p.collection==='trtDoses'?'Aplicação'+(p.item.dose?' · '+String(p.item.dose).replace('.',','):'')+(p.item.site?' · '+p.item.site:''):p.collection==='transactions'?formatMoney(p.item.amount||0)+(p.item.direction==='income'?' · Receita':' · Despesa'):p.collection==='notes'?'Nota'+(p.item.category?' · '+p.item.category:''):p.item.type==='habit'?'Hábito':p.item.type==='event'?'Compromisso':'Tarefa',p.item.date,p.item.time].filter(Boolean).join(' · ');}

export function proposalsText(items:unknown){
 const lines=(Array.isArray(items)?items:[]).slice(0,15).map(entry=>{const p=(entry||{}) as {collection?:string;item?:Record<string,unknown>},i=p.item||{};return '- ['+(LABELS[p.collection||'']||'Registro')+'] '+String(i.title||'').slice(0,200)+(typeof i.amount==='number'?' · '+formatMoney(i.amount)+(p.collection==='transactions'?(i.direction==='income'?' (receita)':' (despesa)'):''):'')+(i.date?' · '+String(i.date):'')+(i.time?' '+String(i.time):'');});
 return 'Sugestões mostradas, aguardando confirmação:\n'+lines.join('\n');
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

export function testosteroneReport(s:Workspace,today:string){
 return {
  protocolos:s.trtProtocols.map(p=>{const st=protocolStatus(p,s.trtDoses,today),score=punctuality(p,s.trtDoses,today);return {id:p.id,medicamento:p.title,dose:p.dose+' '+(p.unit||'mg'),intervaloDias:p.intervalDays,inicio:p.startDate,situacao:p.status==='paused'?'pausado':'ativo',proximaAplicacao:st.next,...(st.overdue?{diasDeAtraso:st.overdue}:{}),...(score!==null?{pontualidade90dias:score+'%'}:{})};}),
  aplicacoesRecentes:s.trtDoses.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(d=>({data:d.date,...(d.dose?{dose:d.dose}:{}),...(d.site?{local:d.site}:{}),...(d.notes?{observacoes:clip(d.notes,200)}:{})})),
  exames:examsReport(s),
 };
}
function examsReport(s:Workspace,gender?:Gender){return s.labExams.filter(e=>e.status==='reviewed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(e=>({data:e.date,...(e.lab?{laboratorio:e.lab}:{}),situacao:OVERALL_LABEL[finalOverall(e,s.labExams,gender)],marcadores:(e.markers as Marker[]).map(m=>({nome:m.label,valor:valueText(m),faixa:rangeText(m),classificacao:STATUS_LABEL[classifyMarker(m)]})),...(e.review?{parecer:e.review.summary}:{})}));}
function methodNow(m:Item,doses:Item[],today:string){
 if(m.method==='iud')return {troca:m.changeDate,diasParaTroca:iudStatus(m,today).daysLeft};
 if(m.method==='injection')return {proximaAplicacao:injectionNext(m,doses),...(m.remind?{lembrete:m.time}:{})};
 const st=dailyStatus(m,today);return {hoje:!st.active?(st.pauseUntil?'pausa até '+st.pauseUntil:'sem uso hoje'):doses.some(d=>d.methodId===m.id&&d.date===today)?'tomado':'pendente',...(st.active?{diaDaCartela:st.packDay}:{}),...(m.remind?{lembrete:m.time}:{})};
}
export function femaleHealthReport(s:Workspace,today:string){
 const c=cyclePrediction(s.periods,today),since=addDays(today,-6);
 return {
  ciclo:c?{ultimoInicio:c.lastStart,diaDoCiclo:c.cycleDay,proximaPrevista:c.next,...(c.late?{diasDeAtraso:c.late}:{}),janelaFertil:c.fertileStart+' a '+c.fertileEnd,ovulacaoEstimada:c.ovulation,duracaoMediaCiclo:c.cycleLength,duracaoMediaMenstruacao:c.periodLength,ciclosConsiderados:c.cycles}:'sem menstruação registrada',
  sintomasRecentes:s.symptoms.filter(x=>x.date>=since&&x.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>({data:x.date,sintomas:x.symptoms||[],...(x.mood?{humor:x.mood}:{}),...(x.notes?{observacoes:clip(x.notes,200)}:{})})),
  metodos:s.contraceptives.map(m=>({id:m.id,nome:m.title,tipo:METHOD_SHORT[m.method],situacao:m.status==='paused'?'pausado':'ativo',...methodNow(m,s.contraceptiveDoses,today)})),
  preventivos:s.preventives.map(p=>{const st=preventiveStatus(p,today);return {nome:p.title,situacao:PREVENTIVE_LABEL[st.state],...(p.lastDate?{ultimaVez:p.lastDate}:{}),...(st.next?{proxima:st.next}:{})};}),
  exames:examsReport(s,'female'),
 };
}
