// Regras do menu Saúde feminina. Datas, previsões e alertas são calculados aqui; a IA só lê laudos e escreve pareceres.
// Não importa o core: o core usa este arquivo para validar registros e montar a agenda.
import type { Item } from './types.ts';
import type { Marker } from './exam-schema.ts';
export const SYMPTOMS=['Cólica','Dor de cabeça','Inchaço','Seios sensíveis','Acne','Cansaço','Alteração de humor','Ansiedade','Insônia','Desejo por doce','Náusea','Sangramento fora do período'] as const;
export const FLOWS=[['leve','Leve'],['moderado','Moderado'],['intenso','Intenso']] as const;
export const METHODS=[['daily','Uso diário (pílula, comprimido ou gel)'],['injection','Injeção'],['iud','DIU ou implante']] as const;
export const METHOD_SHORT:Record<string,string>={daily:'uso diário',injection:'injeção',iud:'DIU ou implante'};
export const FLOW_LABEL:Record<string,string>=Object.fromEntries(FLOWS);
const valid=(v:unknown):v is string=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const t=new Date(v+'T12:00:00Z');return Number.isFinite(t.getTime())&&t.toISOString().slice(0,10)===v;};
export const shiftDate=(d:string,n:number)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
export const dayDiff=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
const average=(xs:number[],fallback:number)=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):fallback;
const until=(periods:Item[],date:string)=>periods.filter(p=>typeof p.date==='string'&&p.date<=date);
export type Phase='menstrual'|'folicular'|'ovulatória'|'lútea';

// Média dos últimos 6 ciclos; intervalos fora de 15 a 60 dias (registro esquecido ou duplicado) não entram.
export function cycleStats(periods:Item[]){
 const dated=periods.filter(p=>valid(p.date)).sort((a,b)=>a.date.localeCompare(b.date));const starts=[...new Set(dated.map(p=>p.date as string))];
 const gaps=starts.slice(1).map((d,i)=>dayDiff(starts[i],d)).filter(n=>n>=15&&n<=60).slice(-6);
 const lengths=dated.filter(p=>valid(p.endDate)&&p.endDate>=p.date).map(p=>dayDiff(p.date,p.endDate)+1).slice(-6);
 return {starts,cycleLength:average(gaps,28),periodLength:average(lengths,5),cycles:gaps.length};
}
export function cycleDayOn(periods:Item[],date:string){const starts=cycleStats(until(periods,date)).starts;const last=starts[starts.length-1];return last?dayDiff(last,date)+1:null;}
// Inícios depois de `today` (digitados por engano) não mudam a previsão.
export function cyclePrediction(periods:Item[],today:string){
 const st=cycleStats(until(periods,today)),last=st.starts[st.starts.length-1];if(!last)return null;
 const next=shiftDate(last,st.cycleLength),ovulation=shiftDate(next,-14);
 return {lastStart:last,cycleDay:dayDiff(last,today)+1,next,daysToNext:Math.max(dayDiff(today,next),0),late:Math.max(dayDiff(next,today),0),ovulation,fertileStart:shiftDate(ovulation,-5),fertileEnd:shiftDate(ovulation,1),cycleLength:st.cycleLength,periodLength:st.periodLength,cycles:st.cycles};
}
export function cyclePhase(periods:Item[],date:string):Phase|null{
 const st=cycleStats(until(periods,date)),last=st.starts[st.starts.length-1];if(!last)return null;
 const day=dayDiff(last,date)+1,ovulationDay=st.cycleLength-13;
 if(day<=st.periodLength)return 'menstrual';if(Math.abs(day-ovulationDay)<=1)return 'ovulatória';return day<ovulationDay?'folicular':'lútea';
}
// Calendário do ciclo: para cada data, menstruação registrada ou prevista, janela fértil, ovulação, dia do ciclo, fase e os registros do dia.
export type CalendarMethod=
 |{id:string;title:string;method:'daily';taken:boolean;active:boolean;packDay?:number;pauseUntil?:string}
 |{id:string;title:string;method:'injection';taken:boolean;due:boolean}
 |{id:string;title:string;method:'iud';daysLeft:number;change:boolean};
export type CalendarDay={date:string;cycleDay:number|null;period:'logged'|'predicted'|null;periodDay?:number;flow?:string;fertile:boolean;ovulation:boolean;phase:Phase|null;late?:number;mood?:number;symptoms:string[];notes?:string;methods:CalendarMethod[];intimacy?:{protection?:'com'|'sem';notes?:string}};
export type CalendarData={periods:Item[];symptoms?:Item[];journal?:Item[];contraceptives?:Item[];contraceptiveDoses?:Item[];intimacy?:Item[]};
const byDate=(list:Item[]|undefined)=>new Map((list||[]).filter(x=>valid(x.date)).map(x=>[x.date as string,x]));
const latest=(list:string[],date:string)=>{let found:string|undefined;for(const x of list)if(x<=date)found=x;return found;};
export function cycleCalendar(s:CalendarData,from:string,to:string,today:string):CalendarDay[]{
 const logged=until(s.periods,today).filter(p=>valid(p.date)).sort((a,b)=>a.date.localeCompare(b.date)),st=cycleStats(logged),starts=st.starts,last=starts[starts.length-1];
 const period=new Map<string,{period:'logged'|'predicted';periodDay:number;flow?:string}>(),projected:string[]=[];
 if(last){
  // Registrada até o fim informado (ou a duração média), parando na véspera do início seguinte; o que passa de hoje no último registro é previsão.
  for(const p of logged){const next=starts.find(x=>x>p.date),len=valid(p.endDate)&&p.endDate>=p.date?dayDiff(p.date,p.endDate)+1:st.periodLength;
   for(let i=0;i<len;i++){const date=shiftDate(p.date,i);if(next&&date>=next)break;
    if(date<=today)period.set(date,{period:'logged',periodDay:i+1,...(p.flow?{flow:p.flow}:{})});else if(p.date===last)period.set(date,{period:'predicted',periodDay:i+1});}}
  // Inícios projetados até 60 dias depois do fim: a ovulação dos últimos dias visíveis depende do início seguinte.
  for(let start=shiftDate(last,st.cycleLength),end=shiftDate(to,60);start<=end;start=shiftDate(start,st.cycleLength))projected.push(start);
  // Início projetado antes de hoje é atraso: não pinta, mas o ciclo seguinte continua a partir dele.
  for(const start of projected){if(start<today)continue;for(let i=0;i<st.periodLength;i++){const date=shiftDate(start,i);if(!period.has(date))period.set(date,{period:'predicted',periodDay:i+1});}}}
 // Ovulação 14 dias antes do início seguinte; janela fértil de 5 dias antes a 1 depois. Os ciclos atrasados entram na sequência.
 const seq=[...starts,...projected],ahead=[...starts,...projected.filter(x=>x>=today)],ovulations=new Set<string>(),fertile=new Set<string>();
 for(let i=1;i<seq.length;i++){const ov=shiftDate(seq[i],-14);ovulations.add(ov);for(const k of [-5,-4,-3,-2,-1,1])fertile.add(shiftDate(ov,k));}
 const late=projected[0]&&projected[0]<today?dayDiff(projected[0],today):0;
 const sym=byDate(s.symptoms),journal=byDate(s.journal),rel=byDate(s.intimacy),doses=s.contraceptiveDoses||[],methods=(s.contraceptives||[]).filter(m=>m.status==='active'&&valid(m.startDate));
 const out:CalendarDay[]=[];
 for(let date=from;date<=to;date=shiftDate(date,1)){
  // Antes de hoje, o ciclo é o dos inícios registrados; de hoje em diante, entram os inícios previstos.
  const start=latest(date<today?starts:ahead,date),next=start?seq.find(x=>x>start):undefined,ov=next?shiftDate(next,-14):undefined,p=period.get(date),marked=!!last&&date>=starts[0];
  const phase:Phase|null=!start?null:p?'menstrual':ov&&Math.abs(dayDiff(ov,date))<=1?'ovulatória':ov&&date<ov?'folicular':'lútea';
  const sr=sym.get(date),jr=journal.get(date),r=rel.get(date),mood=typeof sr?.mood==='number'?sr.mood:typeof jr?.mood==='number'?jr.mood:undefined,ms:CalendarMethod[]=[];
  for(const m of methods){if(date<m.startDate)continue;const taken=doses.some(d=>d.methodId===m.id&&d.date===date);
   if(m.method==='daily'){const ds=dailyStatus(m,date);ms.push({id:m.id,title:m.title,method:'daily',taken,active:ds.active,...(ds.active?{packDay:ds.packDay}:{}),...(ds.pauseUntil?{pauseUntil:ds.pauseUntil}:{})});}
   else if(m.method==='injection'){const due=!taken&&injectionNext(m,doses,date)===date;if(taken||due)ms.push({id:m.id,title:m.title,method:'injection',taken,due});}
   else if(m.method==='iud'&&valid(m.changeDate))ms.push({id:m.id,title:m.title,method:'iud',daysLeft:dayDiff(date,m.changeDate),change:date===m.changeDate});}
  out.push({date,cycleDay:start?dayDiff(start,date)+1:null,period:p?.period||null,...(p?{periodDay:p.periodDay}:{}),...(p?.flow?{flow:p.flow}:{}),
   fertile:marked&&fertile.has(date)&&!ovulations.has(date),ovulation:marked&&ovulations.has(date),phase,...(date===today&&late>0?{late}:{}),...(mood!==undefined?{mood}:{}),
   symptoms:Array.isArray(sr?.symptoms)?sr.symptoms:[],...(sr?.notes?{notes:sr.notes}:{}),methods:ms,
   ...(r?{intimacy:{...(r.protection==='com'||r.protection==='sem'?{protection:r.protection}:{}),...(r.notes?{notes:r.notes}:{})}}:{})});}
 return out;}
// Prazo do DIU no painel do dia: anos, depois meses, depois dias.
export function durationLabel(days:number){if(days>=365){const n=Math.floor(days/365);return n+(n===1?' ano':' anos');}if(days>=60)return Math.floor(days/30)+' meses';return days===0?'hoje':days===1?'1 dia':days+' dias';}
// Mês do calendário (AAAA-MM): espaços antes do dia 1 numa grade que começa na segunda-feira e as datas do mês.
export function calendarMonth(month:string){const first=month+'-01',lead=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7,days:string[]=[];for(let d=first;d.startsWith(month);d=shiftDate(d,1))days.push(d);return {lead,days};}
export const shiftMonth=(month:string,n:number)=>addMonths(month+'-01',n).slice(0,7);
export function nextPeriodStart(periods:Item[]){const st=cycleStats(periods),last=st.starts[st.starts.length-1];return last?shiftDate(last,st.cycleLength):null;}
export const takeId=(methodId:string,date:string)=>'take-'+methodId+'-'+date;
export const PREVENTIVE_SUGGESTIONS=[['Ginecologista',12],['Papanicolau',12],['Mamografia',12],['Ultrassom transvaginal',12],['Densitometria óssea',24]] as const;
export type PreventiveState='none'|'late'|'soon'|'ok';
export const PREVENTIVE_LABEL:Record<PreventiveState,string>={none:'Sem registro',late:'Atrasado',soon:'Vence em breve',ok:'Em dia'};
const taken=(m:Item,doses:Item[],date:string)=>doses.some(d=>d.methodId===m.id&&d.date===date);
// Cartela: `startDate` é o primeiro dia da cartela atual; uso + pausa se repetem a partir dele.
export function dailyStatus(m:Item,date:string):{active:boolean;packDay:number;pauseUntil?:string;nextPackStart?:string}{
 if(m.status==='paused'||!valid(m.startDate))return {active:false,packDay:0};
 if(date<m.startDate)return {active:false,packDay:0,nextPackStart:m.startDate};
 const use=m.activeDays||21,len=use+(m.pauseDays??7),pos=dayDiff(m.startDate,date)%len;
 return pos<use?{active:true,packDay:pos+1,nextPackStart:shiftDate(date,len-pos)}:{active:false,packDay:pos+1,pauseUntil:shiftDate(date,len-pos-1),nextPackStart:shiftDate(date,len-pos)};
}
// Próxima injeção: a mais recente entre o cadastro e as aplicações (antes de `before`, quando informado) + intervalo.
export function injectionNext(m:Item,doses:Item[],before?:string){const base=[m.startDate,...doses.filter(d=>d.methodId===m.id&&(!before||d.date<before)).map(d=>d.date)].filter(valid).sort().pop();return base?shiftDate(base,m.intervalDays||30):'';}
export function iudStatus(m:Item,today:string){const daysLeft=dayDiff(today,m.changeDate);return {daysLeft,soon:daysLeft<=30};}
// Hora cheia do lembrete; com minutos, a hora seguinte (o cron pode rodar no começo da hora). Máximo 23h.
export function reminderHour(time:string){const [h,min]=time.split(':').map(Number);return Math.min(h+(min>0?1:0),23);}
export function femaleReminderDue(m:Item,doses:Item[],today:string,hour:number){
 if(m.status!=='active'||!m.remind||typeof m.time!=='string'||!['daily','injection'].includes(m.method))return false;
 if(m.method==='daily'&&(!dailyStatus(m,today).active||taken(m,doses,today)))return false;
 if(m.method==='injection'){const next=injectionNext(m,doses,today);if(!next||today<next||today>shiftDate(next,3)||doses.some(d=>d.methodId===m.id&&d.date>=next&&d.date<=today))return false;}
 if(hour<reminderHour(m.time)||m.remindedOn===today)return false;
 if(m.snoozedUntil&&m.snoozedUntil>today)return false;
 return !(m.snoozedUntil===today&&typeof m.snoozeHour==='number'&&hour<m.snoozeHour);
}
export function addMonths(date:string,months:number){const [y,m,d]=date.split('-').map(Number);const t=new Date(Date.UTC(y,m-1+months,1,12));const last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();return t.toISOString().slice(0,8)+String(Math.min(d,last)).padStart(2,'0');}
export const preventiveNext=(p:Item)=>valid(p.lastDate)?addMonths(p.lastDate,p.intervalMonths||12):null;
export function preventiveStatus(p:Item,today:string):{state:PreventiveState;next?:string;days?:number}{const next=preventiveNext(p);if(!next)return {state:'none'};const days=dayDiff(today,next);return {state:days<0?'late':days<=30?'soon':'ok',next,days};}
// Itens calculados da agenda (não são salvos em tasks). Os `readonly` só informam: sem marcar, editar ou excluir.
export function femaleAgenda(s:{periods:Item[];contraceptives:Item[];contraceptiveDoses:Item[];preventives:Item[]},date:string):Item[]{
 const out:Item[]=[];
 for(const m of s.contraceptives){if(m.status!=='active')continue;const time=m.time?{time:m.time}:{};
  if(m.method==='daily'&&dailyStatus(m,date).active)out.push({id:m.id,title:'Uso diário: '+m.title,type:'habit',section:'saude',_collection:'contraceptives',...time});
  if(m.method==='injection'&&injectionNext(m,s.contraceptiveDoses,date)===date)out.push({id:m.id,title:'Injeção: '+m.title,type:'event',section:'saude',_collection:'contraceptives',...time});
  if(m.method==='iud'&&m.changeDate===date)out.push({id:m.id,title:'Troca: '+m.title,type:'event',section:'saude',_collection:'contraceptives',readonly:true});}
 if(nextPeriodStart(s.periods)===date)out.push({id:'period-forecast',title:'Menstruação prevista',type:'event',section:'saude',_collection:'forecast',readonly:true});
 for(const p of s.preventives)if(preventiveNext(p)===date)out.push({id:p.id,title:'Preventivo: '+p.title,type:'event',section:'saude',_collection:'preventives',readonly:true});
 return out;
}
const unitIs=(m:Marker,units:string[])=>units.includes((m.unit||'').replace(/\s/g,'').toLowerCase());
const fmtNum=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
// Alertas que pedem médico logo, no feminino. Substituem os do menu Testosterona (hematócrito e PSA).
export function femaleCriticalFlags(exam:{markers:Marker[]}):string[]{const flags:string[]=[],get=(k:string)=>exam.markers.find(m=>m.key===k);
 const hb=get('hemoglobina');if(hb&&unitIs(hb,['g/dl'])&&hb.value<8)flags.push('Hemoglobina em '+fmtNum(hb.value)+' g/dL: abaixo de 8 pede avaliação médica logo.');
 const tsh=get('tsh');if(tsh&&unitIs(tsh,['mui/l','miu/l','µui/ml','μui/ml','uui/ml','uiu/ml'])&&(tsh.value<0.1||tsh.value>10))flags.push('TSH em '+fmtNum(tsh.value)+': fora de 0,1 a 10 pede avaliação médica logo.');
 const hcg=get('beta_hcg');if(hcg&&unitIs(hcg,['mui/ml','miu/ml','ui/l','iu/l'])&&hcg.value>5)flags.push('Beta-hCG positivo: confirme com seu médico.');
 return flags;}
const PREVENTIVE_ORDER:Record<PreventiveState,number>={late:0,soon:1,ok:2,none:3};
// Ordem de atenção: atrasados, vencendo, em dia e, por último, os ainda sem data; dentro de cada grupo, a próxima data primeiro.
export function sortPreventives(list:Item[],today:string){return list.map(p=>({p,st:preventiveStatus(p,today)})).sort((x,y)=>PREVENTIVE_ORDER[x.st.state]-PREVENTIVE_ORDER[y.st.state]||(x.st.next||'').localeCompare(y.st.next||''));}
