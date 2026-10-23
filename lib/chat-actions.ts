import {todayInZone} from './core.ts';import {parseTrtCallback,trtCallbackAction} from './trt-reminders.ts';import {parseFemaleCallback,femaleCallbackAction,hourInZone} from './female-reminders.ts';import {budgetAlerts} from './finance.ts';import {parseWaterCallback,waterAddedText} from './hydration.ts';import type {Pending} from './telegram.ts';import type {Workspace,Command} from './types.ts';
// Uma escolha (botão do Telegram ou resposta "1/2" do WhatsApp) resolvida sem efeitos: quem chama grava o comando e envia a resposta.
export type ChoiceResult={command?:Command;reply:string;ack:string;pending?:Pending;expired?:true};
const EXPIRED='Essas sugestões não estão mais disponíveis.';
export function resolveChoice(data:string,state:Workspace,pending:Pending,now?:Date):ChoiceResult{
 const zone=state.profile.timezone,today=todayInZone(zone,now);
 const trt=parseTrtCallback(data);if(trt){const r=trtCallbackAction(state,today,trt);return {...r,ack:r.command?(trt.action==='done'?'Registrado!':'Adiado.'):'Ok'};}
 const fh=parseFemaleCallback(data);if(fh){const r=femaleCallbackAction(state,today,hourInZone(zone,now),fh);return {...r,ack:r.command?(fh.action==='done'?'Registrado!':'Adiado.'):'Ok'};}
 // Lembrete de água: "Bebi 250 ml" ou "Bebi 500 ml" registra o gole na hora.
 const wt=parseWaterCallback(data);if(wt)return {command:{type:'water',action:'add',ml:wt.ml,via:'reminder'},reply:waterAddedText(state,today,wt.ml),ack:'Registrado!'};
 const [action,id]=data.split(':'),group=id&&Object.hasOwn(pending,id)?pending[id]:undefined;
 if(!group||(action!=='add'&&action!=='drop'))return {reply:EXPIRED,ack:EXPIRED,expired:true};
 const rest={...pending};delete rest[id];const n=group.items.length;
 if(action==='drop')return {reply:'Sugestões descartadas.',ack:'Descartado.',pending:rest};
 return {command:{type:'confirmPlan',items:group.items},reply:['✅ '+(n===1?'1 item adicionado':n+' itens adicionados')+' ao seu GeoAI.',...budgetAlerts(state,group.items)].join('\n'),ack:'Adicionado!',pending:rest};}
