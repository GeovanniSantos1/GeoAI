// Regras do menu Saúde feminina. Datas, previsões e alertas são calculados aqui; a IA só lê laudos e escreve pareceres.
// Não importa o core: o core usa este arquivo para validar registros e montar a agenda.
import type { Item } from './types.ts';
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
export type ForecastKind='period'|'fertile'|'ovulation';

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
// Calendário: menstruação (em curso e previstas), janela fértil e ovulação de cada ciclo dentro do período.
export function forecastDays(periods:Item[],from:string,days:number){
 const st=cycleStats(until(periods,from)),last=st.starts[st.starts.length-1],marks=new Map<string,ForecastKind>();
 if(last){const end=shiftDate(from,days-1);for(let start=last;start<=end;start=shiftDate(start,st.cycleLength)){const ov=shiftDate(start,st.cycleLength-14);
  for(let i=-5;i<=1;i++)marks.set(shiftDate(ov,i),'fertile');marks.set(ov,'ovulation');for(let i=0;i<st.periodLength;i++)marks.set(shiftDate(start,i),'period');}}
 return Array.from({length:days},(_,i)=>{const date=shiftDate(from,i);return {date,kind:marks.get(date)||null};});
}
export function nextPeriodStart(periods:Item[]){const st=cycleStats(periods),last=st.starts[st.starts.length-1];return last?shiftDate(last,st.cycleLength):null;}
