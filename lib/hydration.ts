// Hidratação: meta do dia, ritmo, goles, leitura das mensagens ("bebi 500 ml"), lembretes e textos. Puro.
// Não importa o core: o core usa este arquivo para aplicar o comando 'water' e validar os goles do dia.
import type {Workspace,Item} from './types.ts';

export const GLASS=250,MUG=350,BOTTLE=500,LITER=1000,SIP_MIN=10,SIP_MAX=3000;
const SIPS_MAX=80,DAY_MAX=20000;
export const GOAL_DEFAULT=2000,GOAL_MIN=1500,GOAL_MAX=5000,MANUAL_MIN=1000,MANUAL_MAX=6000,PER_KG=35,TRAINING_BONUS=500,WATER_POINTS=15;
export const VIAS=['web','whatsapp','telegram','reminder'] as const;
export type WaterVia=typeof VIAS[number];
export type Sip={id:string;at:string;ml:number;via:WaterVia};
export type WaterCommand={type:'water';action:'add'|'remove'|'undo'|'reminded';date?:string;ml?:number;via?:WaterVia;sipId?:string};
type State=Pick<Workspace,'profile'|'measurements'|'sessions'|'water'>;

const isDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const shift=(date:string,days:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const round50=(n:number)=>Math.round(n/50)*50;
const toMin=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
export const clockOf=(min:number)=>String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
export function minutesInZone(zone:string,now=new Date()){const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number);return h*60+m;}

export const waterId=(date:string)=>'water-'+date;
export const waterDay=(s:Pick<Workspace,'water'>,date:string):Item|undefined=>s.water.find(x=>x.date===date);
export const sipsOf=(day?:Item):Sip[]=>Array.isArray(day?.sips)?day.sips:[];
export const totalOf=(s:Pick<Workspace,'water'>,date:string)=>waterDay(s,date)?.ml||0;

// Meta automática: 35 ml por kg do último peso até a data (Treino › Peso), entre 1,5 L e 5 L; sem peso, 2 L; +500 ml no dia com treino.
// A manual (1 a 6 L) vale todo dia, sem o acréscimo.
export type WaterGoal={ml:number;auto:boolean;weight?:number;base:number;training:boolean};
export function lastWeight(s:Pick<Workspace,'measurements'>,date:string){const m=s.measurements.filter(x=>typeof x.weight==='number'&&x.weight>0&&isDate(x.date)&&x.date<=date).sort((a,b)=>String(a.date).localeCompare(String(b.date))).pop();return m?.weight as number|undefined;}
export function waterGoal(s:Pick<Workspace,'profile'|'measurements'|'sessions'>,date:string):WaterGoal{
 const manual=s.profile.waterGoal;if(Number.isInteger(manual)&&manual>=MANUAL_MIN&&manual<=MANUAL_MAX)return {ml:manual,auto:false,base:manual,training:false};
 const weight=lastWeight(s,date),base=weight?Math.min(GOAL_MAX,Math.max(GOAL_MIN,round50(weight*PER_KG))):GOAL_DEFAULT,training=s.sessions.some(x=>x.date===date);
 return {ml:base+(training?TRAINING_BONUS:0),auto:true,weight,base,training};}
export function cleanWaterGoal(v:unknown){if(v===0)return 0;if(!Number.isInteger(v)||(v as number)<MANUAL_MIN||(v as number)>MANUAL_MAX)throw new Error('Meta de água inválida: use de 1 a 6 litros');return v as number;}

// Ritmo: a meta distribuída em linha reta entre acordar e dormir (dormir depois da meia-noite estende o dia).
export function awakeWindow(p:{waketime?:string;bedtime?:string}){const wake=toMin(p.waketime||'07:00');let bed=toMin(p.bedtime||'23:00');if(bed<=wake)bed+=1440;return {wake,bed};}
export function expectedBy(goal:number,p:{waketime?:string;bedtime?:string},minute:number){const {wake,bed}=awakeWindow(p);if(minute<=wake)return 0;if(minute>=bed)return goal;return Math.min(goal,round50(goal*(minute-wake)/(bed-wake)));}
export type Pace='done'|'ahead'|'on'|'behind';
// Atrás: 15% da meta (mínimo 300 ml) abaixo do ritmo; adiantado: 10% (mínimo 250 ml) acima.
export const behindGap=(goal:number)=>Math.max(300,Math.round(goal*.15));
export function paceOf(total:number,goal:number,expected:number):Pace{if(total>=goal)return 'done';if(expected-total>=behindGap(goal))return 'behind';if(total-expected>=Math.max(250,Math.round(goal*.1)))return 'ahead';return 'on';}

// Goles do dia gravados no registro: o total é sempre a soma, recalculada na validação.
export function cleanSips(v:unknown):Sip[]{
 if(!Array.isArray(v)||v.length>SIPS_MAX)throw new Error('Registro de água inválido');
 return v.map(x=>{if(!x||typeof x!=='object'||typeof x.id!=='string'||!/^[\w-]{1,40}$/.test(x.id)||typeof x.at!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.at)||!Number.isInteger(x.ml)||x.ml<1||x.ml>SIP_MAX||!VIAS.includes(x.via))throw new Error('Registro de água inválido');return {id:x.id,at:x.at,ml:x.ml,via:x.via};});}
export const sipsTotal=(sips:Sip[])=>sips.reduce((n,x)=>n+x.ml,0);

// Comando 'water': devolve o registro do dia (sem validar; o core valida) e a chave de pontos quando a meta é batida.
export function waterStep(s:State,c:WaterCommand,today:string,now:Date):{item:Item;reward?:string}{
 const date=c.date??today;if(!isDate(date))throw new Error('Data inválida');if(date>today)throw new Error('A data não pode ser futura');
 const day=waterDay(s,date),sips=sipsOf(day).slice(),minute=minutesInZone(s.profile.timezone,now),extra:Record<string,unknown>={};
 if(c.action==='add'){const ml=c.ml;if(!Number.isInteger(ml)||(ml as number)<SIP_MIN||(ml as number)>SIP_MAX)throw new Error('Informe entre 10 ml e 3 L');
  if(sips.length>=SIPS_MAX||sipsTotal(sips)+(ml as number)>DAY_MAX)throw new Error('Limite de registros de água do dia atingido');
  // O portal manda o id do gole para poder desfazer exatamente ele; id inválido ou repetido ganha um novo.
  const id=typeof c.sipId==='string'&&/^[\w-]{1,40}$/.test(c.sipId)&&!sips.some(x=>x.id===c.sipId)?c.sipId:crypto.randomUUID().slice(0,8);
  sips.push({id,at:date===today?clockOf(minute):'12:00',ml:ml as number,via:VIAS.includes(c.via as WaterVia)?c.via as WaterVia:'web'});}
 else if(c.action==='remove'){const i=sips.findIndex(x=>x.id===c.sipId);if(i<0)throw new Error('Registro de água não encontrado');sips.splice(i,1);}
 else if(c.action==='undo'){if(!sips.length)throw new Error('Nenhum registro de água neste dia');sips.pop();}
 else if(c.action==='reminded'){extra.reminded=(day?.reminded||0)+1;extra.remindedAt=clockOf(minute);}
 else throw new Error('Ação de água não reconhecida');
 // A meta do dia fica gravada: mudar a meta depois não reescreve se os dias passados foram batidos.
 const ml=sipsTotal(sips),goal=waterGoal(s,date).ml,item={...(day||{}),...extra,id:waterId(date),title:'Água',date,ml,goal,sips} as Item;
 return {item,reward:c.action==='add'&&ml>=goal?'water:'+date:undefined};}

// Mensagens do WhatsApp e do Telegram, sem IA: registra, consulta ou desfaz. Precisa de contexto de água
// ("água", "bebi", "tomei", "+") ou de uma mensagem só com a quantidade; outras bebidas e compras ficam com o assistente.
export type WaterIntent={kind:'add';ml:number}|{kind:'status'}|{kind:'undo'};
const WORDS:Record<string,number>={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,meio:.5,meia:.5};
const UNITS:Record<string,number>={copo:GLASS,caneca:MUG,garrafinha:BOTTLE,garrafa:BOTTLE};
const QTY='(\\d+(?:[.,]\\d+)?|um|uma|dois|duas|tres|quatro|cinco|meio|meia)';
const VOLUME=/(\d+(?:[.,]\d+)?)\s*(ml|l|lt|litros?)\b/,LITERS=/\b(um|uma|dois|duas|tres|quatro|cinco|meio|meia) litros?\b/,BOX=new RegExp('(?:\\b'+QTY+' )?(copo|caneca|garrafinha|garrafa)s?\\b');
const OTHER=/\b(cafes?|sucos?|cervejas?|chopps?|chopes?|refris?|refrigerantes?|vinhos?|leites?|chas?|energeticos?|whisky|vodka|cachaca|drinks?|isotonicos?|xaropes?|remedios?)\b|\b(comprei|comprar|compra|paguei|gastei|reais)\b|r\$/;
const num=(raw:string|undefined)=>raw===undefined?1:WORDS[raw]??Number(raw.replace(',','.'));
const norm=(t:string)=>t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,' ').replace(/[!?;:]+/g,' ').replace(/\.+(\s|$)/g,' ').replace(/\s+/g,' ').trim();
export function parseWater(text:string):WaterIntent|null{
 if(typeof text!=='string'||text.length>200)return null;const t=norm(text);
 if(/^(agua|agua hoje|minha agua|quanta agua( hoje)?|quanto de agua( hoje)?)$/.test(t))return {kind:'status'};
 if(/^(desfazer|apagar|cancelar|remover) (a )?(ultima )?agua$/.test(t))return {kind:'undo'};
 if(OTHER.test(t))return null;
 const plus=/^\+\s*(\d{2,4})$/.exec(t);if(plus){const ml=Number(plus[1]);return ml>=SIP_MIN&&ml<=SIP_MAX?{kind:'add',ml}:null;}
 const vol=VOLUME.exec(t),liters=LITERS.exec(t),box=BOX.exec(t);let ml:number;
 if(vol){ml=Number(vol[1].replace(',','.'))*(vol[2]==='ml'?1:LITER);if(box&&box.index<vol.index)ml*=num(box[1]);}
 else if(liters)ml=num(liters[1])*LITER;
 else if(box)ml=num(box[1])*UNITS[box[2]];
 else return null;
 if(/litros? e meio\b/.test(t))ml+=LITER/2;
 const bare=[vol,liters,box].reduce((rest,m)=>m?rest.replace(m[0],' '):rest,t).replace(/\b(de|d|da|do|agua|e meio)\b|\+/g,' ').trim()==='';
 if(!/\bagua\b/.test(t)&&!/\b(bebi|tomei)\b/.test(t)&&!t.startsWith('+')&&!bare)return null;
 ml=Math.round(ml);return ml>=SIP_MIN&&ml<=SIP_MAX?{kind:'add',ml}:null;}

// Textos: "0,9 de 2 L" no resumo; 50 ml, 1 L e 1,25 L nas quantidades soltas.
const liters=(ml:number)=>String(+(ml/LITER).toFixed(2)).replace('.',',');
export const fmtMl=(ml:number)=>ml>=LITER?liters(ml)+' L':ml+' ml';
function summaryText(total:number,goal:number){return total>=goal?'Meta do dia batida: '+liters(total)+' de '+liters(goal)+' L. 🎉':'Hoje: '+liters(total)+' de '+liters(goal)+' L ('+Math.round(total/goal*100)+'%). Faltam '+fmtMl(goal-total)+'.';}
export const waterSummary=(s:State,today:string)=>summaryText(totalOf(s,today),waterGoal(s,today).ml);
export const waterAddedText=(s:State,today:string,ml:number)=>'💧 +'+fmtMl(ml)+'. '+summaryText(totalOf(s,today)+ml,waterGoal(s,today).ml);

// Lembrete quando atrasado (WhatsApp e Telegram): ligado no perfil, de 1 h depois de acordar a 1 h antes de dormir,
// atrás do ritmo e no máximo 4 por dia. Na Hobby o cron roda em qualquer minuto da hora, então o intervalo pula uma rodada:
// o próximo lembrete sai a partir da segunda hora cheia depois do último.
export const REMIND_MAX=4,REMIND_GAP_HOURS=2;
// Atrás do ritmo dentro da janela (1 h depois de acordar até 1 h antes de dormir): base do lembrete e da notificação do navegador.
export function behindNow(s:State,today:string,minute:number){
 const {wake,bed}=awakeWindow(s.profile);if(minute<wake+60||minute>bed-60)return null;
 const goal=waterGoal(s,today).ml,total=totalOf(s,today),expected=expectedBy(goal,s.profile,minute);
 return paceOf(total,goal,expected)==='behind'?{goal,total,expected}:null;}
export function reminderDue(s:State,today:string,minute:number){
 if(s.profile.waterReminders!==true)return null;const due=behindNow(s,today,minute),day=waterDay(s,today);if(!due)return null;
 if((day?.reminded||0)>=REMIND_MAX||(typeof day?.remindedAt==='string'&&Math.floor(minute/60)-Math.floor(toMin(day.remindedAt)/60)<REMIND_GAP_HOURS))return null;
 return due;}
export const reminderText=(total:number,goal:number,expected:number)=>'💧 Pausa para a água: '+fmtMl(total)+' de '+fmtMl(goal)+'. '+(expected-total>=BOTTLE?'Uma garrafa':'Um copo')+' agora te coloca no ritmo.';
export const waterButtons={inline_keyboard:[[{text:'Bebi 250 ml',callback_data:'wt:250'},{text:'Bebi 500 ml',callback_data:'wt:500'}]]};
export function parseWaterCallback(data:string){const m=/^wt:(250|500)$/.exec(data);return m?{ml:Number(m[1])}:null;}

// Semana e sequência de dias na meta: dias passados usam a meta gravada no dia; hoje, a meta atual.
const goalOn=(s:State,date:string,today:string)=>{const g=waterDay(s,date)?.goal;return date<today&&Number.isInteger(g)&&g>0?g as number:waterGoal(s,date).ml;};
export function waterWeek(s:State,today:string){return Array.from({length:7},(_,i)=>{const date=shift(today,i-6),ml=totalOf(s,date),goal=goalOn(s,date,today);return {date,ml,goal,hit:ml>=goal};});}
export function waterStreak(s:State,today:string){const hit=(d:string)=>totalOf(s,d)>=goalOn(s,d,today);let cursor=hit(today)?today:shift(today,-1),n=0;while(n<366&&hit(cursor)){n++;cursor=shift(cursor,-1);}return n;}

export const TIPS=['Comece o dia com um copo de água antes do café.','Deixe uma garrafa à vista: o que está perto é lembrado.','Um copo antes de cada refeição já soma quase 1 litro.','Sede, cansaço e dor de cabeça podem ser sinais de pouca água.','Treinou? Reponha ao longo do dia, não tudo de uma vez.','Prefira goles frequentes a grandes quantidades de uma vez.','Água com rodelas de limão ou hortelã ajuda a variar o sabor.','Urina clara é um bom sinal de hidratação.','Em dias quentes, o corpo pede mais: adiante alguns goles.'];
export const tipOf=(date:string)=>TIPS[Math.round(new Date(date+'T12:00:00Z').getTime()/86400000)%TIPS.length];
