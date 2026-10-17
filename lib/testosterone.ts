import {addDays,nextApplicationDate} from './core.ts';
import {OVERALLS,type FileType,type Marker,type Overall} from './exam-schema.ts';
import type {Item,Command,Workspace} from './types.ts';

// Regras do menu Testosterona. Quem classifica os valores é o código; a IA só lê o laudo e escreve o parecer.
export type MarkerStatus='low'|'normal'|'high'|'none';
type ExamLike={id:string;date:string;markers:Marker[]};
export const STATUS_LABEL:Record<MarkerStatus,string>={low:'Baixo',normal:'Normal',high:'Alto',none:'Sem referência'};
export const OVERALL_LABEL:Record<Overall,string>={ok:'Tudo dentro das faixas',attention:'Pontos de atenção',doctor:'Leve ao médico em breve'};
export const MARKER_LABEL:Record<string,string>={testosterona_total:'Testosterona total',testosterona_livre:'Testosterona livre',testosterona_biodisponivel:'Testosterona biodisponível',shbg:'SHBG',estradiol:'Estradiol',lh:'LH',fsh:'FSH',prolactina:'Prolactina',hematocrito:'Hematócrito',hemoglobina:'Hemoglobina',psa_total:'PSA total',psa_livre:'PSA livre',vitamina_d:'Vitamina D',tsh:'TSH',t4_livre:'T4 livre',glicemia:'Glicemia',hba1c:'Hemoglobina glicada',colesterol_total:'Colesterol total',hdl:'HDL',ldl:'LDL',triglicerides:'Triglicerídeos',tgo:'TGO',tgp:'TGP',creatinina:'Creatinina',outro:'Outro'};
export const FILE_EXT:Record<FileType,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export const examPrefix=(userId:string)=>'exames/'+userId+'/';
// Id fixo por protocolo e dia: tocar "Apliquei" de novo, ou marcar pelo app e pelo Telegram, não duplica a aplicação.
export const doseId=(protocolId:string,date:string)=>'dose-'+protocolId+'-'+date;
export const examTitle=(date:string)=>'Exame de '+date.split('-').reverse().join('/');
export const daysBetween=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
const fmt=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
const isNgMl=(unit?:string)=>(unit||'').replace(/\s/g,'').toLowerCase()==='ng/ml';
const find=(markers:Marker[]|undefined,key:string)=>(markers||[]).find(m=>m.key===key);

export function classifyMarker(m:Marker):MarkerStatus{
 if(m.refMin===undefined&&m.refMax===undefined)return 'none';
 if(m.refMin!==undefined&&(m.value<m.refMin||(m.qualifier==='<'&&m.value<=m.refMin)))return 'low';
 if(m.refMax!==undefined&&(m.value>m.refMax||(m.qualifier==='>'&&m.value>=m.refMax)))return 'high';
 return 'normal';
}
export const rangeText=(m:Marker)=>m.refMin!==undefined&&m.refMax!==undefined?fmt(m.refMin)+' a '+fmt(m.refMax):m.refMin!==undefined?'acima de '+fmt(m.refMin):m.refMax!==undefined?'até '+fmt(m.refMax):'sem faixa';
export const valueText=(m:Marker)=>(m.qualifier||'')+fmt(m.value)+(m.unit?' '+m.unit:'');
// Aceita o formato brasileiro (1.234,5) e o decimal com ponto (0.85).
export function parseDecimal(raw:string){const t=raw.trim().replace(/\s/g,'');if(!/^-?[\d.,]+$/.test(t))return NaN;return Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t);}

export function criticalFlags(exam:{date:string;markers:Marker[]},history:Item[]):string[]{
 const flags:string[]=[];
 const hct=find(exam.markers,'hematocrito');
 if(hct&&hct.unit?.trim()==='%'&&hct.value>=54)flags.push('Hematócrito em '+fmt(hct.value)+'%: a partir de 54% pede avaliação médica logo.');
 const psa=find(exam.markers,'psa_total');
 if(psa&&classifyMarker(psa)==='high')flags.push('PSA acima da faixa de referência do laudo.');
 else if(psa&&isNgMl(psa.unit)){const since=addDays(exam.date,-365);const previous=history.filter(h=>h.status==='reviewed'&&h.date>=since&&h.date<exam.date).map(h=>find(h.markers,'psa_total')).filter((x):x is Marker=>!!x&&isNgMl(x.unit));if(previous.length){const rise=psa.value-Math.min(...previous.map(x=>x.value));if(rise>1.4)flags.push('PSA subiu '+fmt(rise)+' ng/mL em menos de 12 meses.');}}
 return flags;
}
export const codeOverall=(markers:Marker[],flags:string[]):Overall=>flags.length?'doctor':markers.some(m=>['low','high'].includes(classifyMarker(m)))?'attention':'ok';
export const mergeOverall=(a:Overall,b:Overall):Overall=>OVERALLS[Math.max(OVERALLS.indexOf(a),OVERALLS.indexOf(b))];
export const examHistory=(exam:{id:string;date:string},all:Item[])=>all.filter(e=>e.id!==exam.id&&e.status==='reviewed'&&e.date<exam.date).sort((a,b)=>b.date.localeCompare(a.date));
export function finalOverall(exam:Item,all:Item[]):Overall{const e={id:exam.id,date:exam.date,markers:(exam.markers||[]) as Marker[]};const code=codeOverall(e.markers,criticalFlags(e,examHistory(e,all)));return exam.review?mergeOverall(code,exam.review.overall):code;}

export function protocolStatus(protocol:Item,doses:Item[],today:string){const next=nextApplicationDate(protocol,doses);const diff=daysBetween(today,next);return {next,daysLeft:Math.max(diff,0),overdue:Math.max(-diff,0)};}
export function punctuality(protocol:Item,doses:Item[],today:string):number|null{if(!protocol.intervalDays)return null;const since=addDays(today,-90);const dates=[...new Set(doses.filter(d=>d.protocolId===protocol.id&&d.date>=since&&d.date<=today).map(d=>d.date as string))].sort();if(dates.length<2)return null;let onTime=0;for(let i=1;i<dates.length;i++)if(Math.abs(daysBetween(dates[i-1],dates[i])-protocol.intervalDays)<=1)onTime++;return Math.round(onTime/(dates.length-1)*100);}
export function cycleDay(protocol:Item,doses:Item[],date:string):number|null{const last=doses.filter(d=>d.protocolId===protocol.id&&d.date<=date).map(d=>d.date as string).sort().pop();return last?daysBetween(last,date):null;}
// Lembra do dia previsto até 3 dias depois, uma vez por dia, respeitando o adiamento.
export function dueReminder(protocol:Item,doses:Item[],today:string){if(protocol.status!=='active'||!protocol.remind)return false;const next=nextApplicationDate(protocol,doses);if(!next||today<next||today>addDays(next,3)||protocol.remindedOn===today)return false;return !protocol.snoozedUntil||protocol.snoozedUntil<=today;}

// /api/state não altera exames: arquivo e parecer só mudam pelas rotas de exames, que cuidam do armazenamento.
export function guardStateCommand(command:Command,userId:string):Command{
 if(!command||typeof command!=='object')return command;
 const touchesExams=(['upsert','delete','patch'].includes(command.type)&&command.collection==='labExams')||(command.type==='confirmPlan'&&Array.isArray(command.items)&&command.items.some(p=>p?.collection==='labExams'));
 if(touchesExams)throw new Error('Use o menu Testosterona para alterar exames.');
 if(command.type==='import'&&command.state&&Array.isArray(command.state.labExams)){const prefix=examPrefix(userId);return {...command,state:{...command.state,labExams:command.state.labExams.map((e:Item)=>{if(!e?.file||(typeof e.file.path==='string'&&e.file.path.startsWith(prefix)))return e;const rest={...e};delete rest.file;return rest;})}};}
 return command;
}
export function detectFileType(bytes:Uint8Array):FileType|null{
 const ascii=(start:number,length:number)=>String.fromCharCode(...bytes.subarray(start,start+length));
 if(ascii(0,4)==='%PDF')return 'application/pdf';
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if(bytes[0]===0x89&&ascii(1,3)==='PNG')return 'image/png';
 if(ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP')return 'image/webp';
 return null;
}
export function reviewContext(exam:ExamLike,s:Pick<Workspace,'labExams'|'trtProtocols'|'trtDoses'>){
 const history=examHistory(exam,s.labExams),flags=criticalFlags(exam,history);
 const lines=['Exame colhido em '+exam.date+'.','Marcadores (valor | faixa do laudo | classificação do app):',...exam.markers.map(m=>'- '+m.label+' ['+m.key+']: '+valueText(m)+' | '+rangeText(m)+' | '+STATUS_LABEL[classifyMarker(m)])];
 lines.push(flags.length?'Alertas críticos (situação mínima: leve ao médico em breve):\n'+flags.map(f=>'- '+f).join('\n'):'Sem alertas críticos.');
 const active=s.trtProtocols.filter(p=>p.status==='active');
 if(!active.length)lines.push('Sem protocolo de reposição registrado.');
 for(const p of active){const day=cycleDay(p,s.trtDoses,exam.date);lines.push('Protocolo ativo: '+p.title+' '+p.dose+' '+(p.unit||'mg')+' a cada '+p.intervalDays+' dias, desde '+p.startDate+'.'+(day===null?'':' Exame colhido '+day+' dia(s) após a última aplicação.'));}
 const keys=new Set(exam.markers.filter(m=>m.key!=='outro').map(m=>m.key));
 for(const h of history.slice(0,3)){const same=((h.markers||[]) as Marker[]).filter(x=>keys.has(x.key));if(same.length)lines.push('Exame anterior ('+h.date+'): '+same.map(x=>x.label+' '+valueText(x)).join('; '));}
 return {text:lines.join('\n'),flags,codeOverall:codeOverall(exam.markers,flags)};
}
