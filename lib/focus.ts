import type {FocusTimer,FocusKind,FocusSettings,Item,Command} from './types.ts';
// Pomodoro no servidor: guarda início e fim previsto; a tela só calcula quanto falta. Puro: o core aplica o efeito.
export const FOCUS_DEFAULTS:FocusSettings={focusMinutes:25,shortBreakMinutes:5,longBreakMinutes:15,focusMode:true};
export const FOCUS_BUSY='Já há um pomodoro em andamento.';
export const KIND_LABEL:Record<FocusKind,string>={focus:'Foco',short:'Pausa curta',long:'Pausa longa'};
const RANGES:['focusMinutes'|'shortBreakMinutes'|'longBreakMinutes',number,number][]=[['focusMinutes',1,90],['shortBreakMinutes',1,30],['longBreakMinutes',1,60]];
const KIND_MINUTES:Record<FocusKind,'focusMinutes'|'shortBreakMinutes'|'longBreakMinutes'>={focus:'focusMinutes',short:'shortBreakMinutes',long:'longBreakMinutes'};
export type FocusCommand=Command&{type:'focus';action:'start'|'pause'|'resume'|'stop'|'complete'};
export type FocusEffect={timer:FocusTimer|null;sessions:Item[];rewards:string[]};
export function cleanFocusSettings(input:unknown,previous:FocusSettings):FocusSettings{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuração inválida');const raw=input as Record<string,unknown>,next={...previous};
 for(const [key,min,max] of RANGES)if(raw[key]!==undefined){const v=raw[key];if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw new Error('Configuração inválida');next[key]=v;}
 if(raw.focusMode!==undefined){if(typeof raw.focusMode!=='boolean')throw new Error('Configuração inválida');next.focusMode=raw.focusMode;}return next;}
// Perfis antigos ou com valores fora da faixa: aproveita o que for válido e completa com o padrão.
export function upgradeFocusSettings(raw:unknown):FocusSettings{let next={...FOCUS_DEFAULTS};const src=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};for(const key of Object.keys(FOCUS_DEFAULTS))try{next=cleanFocusSettings({[key]:src[key]},next);}catch{}return next;}
export function remaining(t:FocusTimer|null|undefined,now:Date){if(!t)return 0;if(t.pausedLeft!==undefined)return t.pausedLeft;return Math.max(0,Math.ceil((Date.parse(t.endsAt)-now.getTime())/1000));}
// Um segundo de tolerância: o tique da tela pode chegar um pouco antes do fim exato.
export function isExpired(t:FocusTimer|null|undefined,now:Date){return !!t&&t.pausedLeft===undefined&&now.getTime()>=Date.parse(t.endsAt)-1000;}
const isFocus=(x:Item)=>(x.kind??'focus')==='focus',isDone=(x:Item)=>(x.status??'completed')==='completed';
export function nextBreak(sessions:Item[],today:string):'short'|'long'{const n=sessions.filter(x=>x.date===today&&isFocus(x)&&isDone(x)).length;return n>0&&n%4===0?'long':'short';}
// Iniciar com card só pela rota do card, que lê o título e move o card.
export function guardFocusCommand(command:Command){if(command?.type==='focus'&&(command.boardCardId!==undefined||command.code!==undefined))throw new Error('Inicie pelo card.');return command;}
function session(t:FocusTimer,status:'completed'|'interrupted',extra:Record<string,unknown>):Item{return {id:t.id,title:t.title,kind:'focus',status,startedAt:t.startedAt,...(t.boardCardId?{boardCardId:t.boardCardId}:{}),...extra} as Item;}
const none=():FocusEffect=>({timer:null,sessions:[],rewards:[]});
function finish(t:FocusTimer,dayOf:(d:Date)=>string):FocusEffect{return t.kind==='focus'?{timer:null,sessions:[session(t,'completed',{date:dayOf(new Date(t.endsAt)),duration:t.minutes,endedAt:t.endsAt})],rewards:['focus:'+t.id]}:none();}
function interrupt(t:FocusTimer,now:Date,dayOf:(d:Date)=>string,reason?:string):FocusEffect{const minutes=Math.floor((t.minutes*60-remaining(t,now))/60);if(t.kind!=='focus'||minutes<1)return none();
 return {timer:null,sessions:[session(t,'interrupted',{date:dayOf(now),duration:minutes,endedAt:now.toISOString(),...(reason?{reason}:{})})],rewards:[]};}
export function focusStep(timer:FocusTimer|null,settings:FocusSettings,command:FocusCommand,now:Date,dayOf:(d:Date)=>string):FocusEffect{
 const t=timer,keep:FocusEffect={timer:t,sessions:[],rewards:[]};
 if(command.action==='complete')return t&&isExpired(t,now)?finish(t,dayOf):keep;
 if(command.action==='start'){
  const kind=(command.kind??'focus') as FocusKind;if(!Object.hasOwn(KIND_LABEL,kind))throw new Error('Tipo de pomodoro inválido');
  const minutes=command.minutes===undefined?settings[KIND_MINUTES[kind]]:command.minutes;if(!Number.isInteger(minutes)||minutes<1||minutes>90)throw new Error('A duração deve ficar entre 1 e 90 minutos');
  let before=none();if(t){if(isExpired(t,now))before=finish(t,dayOf);else if(command.replace)before=interrupt(t,now,dayOf,'Substituído por um novo pomodoro');else throw new Error(FOCUS_BUSY);}
  const label=typeof command.title==='string'?command.title.trim().replace(/\s+/g,' ').slice(0,120):'';
  const title=command.boardCardId?label||'Card':kind==='focus'?label||'Foco livre':KIND_LABEL[kind];
  const next:FocusTimer={id:crypto.randomUUID(),kind,...(command.boardCardId?{boardCardId:String(command.boardCardId),...(command.code?{code:String(command.code)}:{})}:{}),title,minutes,startedAt:now.toISOString(),endsAt:new Date(now.getTime()+minutes*60000).toISOString()};
  return {timer:next,sessions:before.sessions,rewards:before.rewards};}
 if(!t)throw new Error('Nenhum pomodoro em andamento.');
 if(command.action==='pause'){if(t.pausedLeft!==undefined)throw new Error('Nenhum pomodoro rodando.');return isExpired(t,now)?finish(t,dayOf):{...keep,timer:{...t,pausedLeft:Math.max(1,remaining(t,now))}};}
 if(command.action==='resume'){if(t.pausedLeft===undefined)throw new Error('Nenhum pomodoro pausado.');const {pausedLeft,...rest}=t;return {...keep,timer:{...rest,endsAt:new Date(now.getTime()+pausedLeft*1000).toISOString()}};}
 if(command.action==='stop'){const reason=typeof command.reason==='string'?command.reason.trim().slice(0,200):'';return isExpired(t,now)?finish(t,dayOf):interrupt(t,now,dayOf,reason||undefined);}
 throw new Error('Ação não reconhecida');}
