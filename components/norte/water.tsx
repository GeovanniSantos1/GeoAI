'use client';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {GlassWater,Milk,Droplet,Droplets,Plus,Minus,Undo2,Settings2,X,Monitor,MessageCircle,Send,BellRing,Lightbulb,Flame,Trophy,TrendingUp} from 'lucide-react';
import {useApp} from './context';import {Modal} from './primitives';
import {todayInZone} from '@/lib/core';
import {waterGoal,waterDay,sipsOf,expectedBy,paceOf,behindNow,reminderText,minutesInZone,awakeWindow,clockOf,fmtMl,waterWeek,waterStreak,tipOf,GLASS,BOTTLE,LITER,SIP_MIN,SIP_MAX,MANUAL_MIN,MANUAL_MAX,PER_KG,TRAINING_BONUS,type Pace,type WaterGoal} from '@/lib/hydration';
const PACE:Record<Pace,string>={done:'Meta batida',ahead:'Adiantado',on:'No ritmo',behind:'Um pouco atrás'};
const VIA={web:[Monitor,'Portal'],whatsapp:[MessageCircle,'WhatsApp'],telegram:[Send,'Telegram'],reminder:[BellRing,'Lembrete']} as const;
const CUSTOM_KEY='geoai-water-custom',NOTIFY_KEY='geoai-water-notify',NOTIFIED_KEY='geoai-water-notified';export const ROUTINE_TAB_KEY='norte-routine-tab';
const store={get:(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{}}};
const parts=(ml:number)=>{const t=fmtMl(ml),i=t.lastIndexOf(' ');return [t.slice(0,i),t.slice(i+1)];};
const weekday=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'}).replace('.','');
const kg=(n:number)=>String(+n.toFixed(1)).replace('.',',');
// A notificação e o lembrete levam para a aba Hidratação, mesmo com a Alimentação já aberta.
export function openHydration(navigate:(p:string)=>void){try{sessionStorage.setItem(ROUTINE_TAB_KEY,'Hidratação');}catch{}window.dispatchEvent(new CustomEvent('geoai:routine-tab',{detail:'Hidratação'}));navigate('/alimentacao');}
// O minuto no fuso do perfil, renovado a cada minuto: é o que move a linha do ritmo.
function useMinute(zone:string){const [m,setM]=useState(()=>minutesInZone(zone));useEffect(()=>{const t=setInterval(()=>setM(minutesInZone(zone)),60000);return()=>clearInterval(t);},[zone]);return m;}
function goalText(g:WaterGoal){if(!g.auto)return 'Meta manual';return (g.weight?'Meta automática: '+PER_KG+' ml × '+kg(g.weight)+' kg':'Meta automática: 2 L (registre seu peso em Treino para personalizar)')+(g.training?' + '+TRAINING_BONUS+' ml do treino de hoje':'');}
function hintOf(pace:Pace,total:number,goal:number,expected:number,minute:number,p:{waketime:string;bedtime:string}){
 if(pace==='done')return 'Meta batida! Cada gole a mais é bônus.';
 if(pace==='behind')return 'Você está '+fmtMl(expected-total)+' atrás do ritmo. Um copo agora já ajuda.';
 if(pace==='ahead')return 'Você está à frente do ritmo. Continue assim!';
 if(!total&&!expected)return 'Comece o dia com um copo de água.';
 const next=Math.min(1439,(Math.floor(minute/60)+1)*60),need=expectedBy(goal,p,next)-total;
 return need>0?'Beba mais '+fmtMl(need)+' até as '+clockOf(next).slice(0,2)+'h para seguir no ritmo.':'Você está no ritmo. Siga com goles ao longo do dia.';}

// Garrafa em SVG: a água sobe até o percentual do dia, com ondas e bolhas; a linha tracejada é onde você deveria estar agora.
const BODY='M64 28H96V44C96 56 136 62 136 92V228Q136 250 114 250H46Q24 250 24 228V92C24 62 64 56 64 44Z';
const WAVE='M-160 0Q-140 -7 -120 0T-80 0T-40 0T0 0T40 0T80 0T120 0T160 0T200 0T240 0T280 0T320 0V230H-160Z';
const EMPTY=250,FULL=70,levelY=(p:number)=>EMPTY-Math.max(0,Math.min(1,p))*(EMPTY-FULL);
function Bottle({pct,mark,done,splash}:{pct:number;mark:number;done:boolean;splash:number}){
 const id=useId().replace(/[^\w-]/g,''),y=levelY(pct);
 return <div className={'water-bottle'+(done?' done':'')}>
  <svg viewBox="0 0 160 260" role="img" aria-label={'Garrafa com '+Math.round(pct*100)+'% da meta de hoje'}>
   <defs><clipPath id={id+'c'}><path d={BODY}/></clipPath><linearGradient id={id+'g'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--water-light)"/><stop offset="1" stopColor="var(--water-deep)"/></linearGradient></defs>
   <rect className="water-cap" x="60" y="5" width="40" height="21" rx="6"/>
   <path className="water-glass" d={BODY}/>
   <g clipPath={'url(#'+id+'c)'}>
    <g className="water-level" style={{transform:'translateY('+y+'px)'}}>
     <path className="water-wave back" d={WAVE}/><path className="water-wave front" d={WAVE} fill={'url(#'+id+'g)'}/>
     {pct>.06&&[38,64,98,116].map((x,i)=><circle key={x} className="water-bubble" cx={x} cy={EMPTY-y-6} r={i%2?2:2.8} style={{animationDelay:i*.8+'s','--rise':-(EMPTY-y-14)+'px'} as CSSProperties}/>)}
    </g>
    <rect className="water-shine" x="35" y="98" width="8" height="118" rx="4"/>
   </g>
   {[.25,.5,.75].map(p=><line key={p} className="water-tick" x1="118" x2="128" y1={levelY(p)} y2={levelY(p)}/>)}
   {mark>0&&mark<1&&<g className="water-mark" style={{transform:'translateY('+levelY(mark)+'px)'}}><line x1="27" x2="133" y1="0" y2="0"/><circle cx="133" cy="0" r="3.5"/></g>}
   <path className="water-outline" d={BODY}/>
  </svg>
  {splash>0&&<span key={splash} className="water-drop" aria-hidden><Droplet size={22} fill="currentColor"/></span>}
 </div>;}

export function WaterPanel(){
 const a=useApp(),s=a.state,today=a.today,minute=useMinute(s.profile.timezone);
 const [pending,setPending]=useState(0),[splash,setSplash]=useState(0),[burst,setBurst]=useState(0),[undo,setUndo]=useState<{id:string;ml:number}|null>(null),[picker,setPicker]=useState(false),[last,setLast]=useState(()=>{const n=Number(store.get(CUSTOM_KEY));return Number.isInteger(n)&&n>=SIP_MIN&&n<=SIP_MAX?n:0;}),[value,setValue]=useState(()=>last||300),[settings,setSettings]=useState(false);
 const queue=useRef<Promise<unknown>>(Promise.resolve());
 const goal=waterGoal(s,today),sips=sipsOf(waterDay(s,today)),saved=sips.reduce((n,x)=>n+x.ml,0),total=saved+pending,expected=expectedBy(goal.ml,s.profile,minute),pace=paceOf(total,goal.ml,expected);
 const week=waterWeek(s,today),top=Math.max(...week.map(d=>Math.max(d.ml,d.goal)),1)*1.12,streak=waterStreak(s,today),avg=Math.round(week.reduce((n,d)=>n+d.ml,0)/7/50)*50,best=week.reduce((m,d)=>d.ml>m.ml?d:m,week[0]);
 const [amount,unit]=parts(total);
 useEffect(()=>{if(!undo)return;const t=setTimeout(()=>setUndo(null),6000);return()=>clearTimeout(t);},[undo]);
 // Os toques entram em fila (um gole por vez no servidor); a garrafa sobe na hora, antes da resposta.
 function add(ml:number){const id='web-'+crypto.randomUUID().slice(0,8),before=total;setPending(p=>p+ml);setSplash(k=>k+1);if(before<goal.ml&&before+ml>=goal.ml)setBurst(k=>k+1);
  queue.current=queue.current.then(async()=>{const ok=await a.mutate({type:'water',action:'add',ml,via:'web',sipId:id});setPending(p=>p-ml);if(ok){setUndo({id,ml});if(before<goal.ml&&before+ml>=goal.ml)a.toast('Meta de água batida! +15 pontos na sua jornada.');}});}
 function remove(id:string){queue.current=queue.current.then(async()=>{if(await a.mutate({type:'water',action:'remove',sipId:id}))setUndo(u=>u?.id===id?null:u);});}
 function addCustom(){const ml=Math.round(value/10)*10;if(ml<SIP_MIN||ml>SIP_MAX)return;if(![GLASS,BOTTLE,LITER].includes(ml)){store.set(CUSTOM_KEY,String(ml));setLast(ml);}setPicker(false);add(ml);}
 const presets:[number,string,typeof GlassWater][]=[[GLASS,'Copo',GlassWater],[BOTTLE,'Garrafa',Milk],[LITER,'Garrafa grande',Droplets],...(last&&![GLASS,BOTTLE,LITER].includes(last)?[[last,'Seu copo',GlassWater] as [number,string,typeof GlassWater]]:[])];
 return <section className={'panel water water-'+pace}>
  <div className="water-hero">
   <div className="water-visual">
    <Bottle pct={total/goal.ml} mark={expected/goal.ml} done={pace==='done'} splash={splash}/>
    {burst>0&&<div key={burst} className="water-burst" aria-hidden>{Array.from({length:12},(_,i)=><i key={i} style={{'--a':i*30+'deg','--d':(i%3)*.06+'s'} as CSSProperties}/>)}</div>}
    {expected>0&&expected<goal.ml&&<p className="water-legend"><i/>onde você deveria estar agora</p>}
   </div>
   <div className="water-info">
    <div className="water-top"><p className="eyebrow">HIDRATAÇÃO DE HOJE</p><button className="icon-button water-gear" aria-label="Ajustar meta e lembretes de água" onClick={()=>setSettings(true)}><Settings2 size={18}/></button></div>
    <h2 className="water-amount" aria-live="polite"><b>{amount}</b><span>{unit}</span><small>de {fmtMl(goal.ml)}</small></h2>
    <div className="water-meta"><span className={'water-pace '+pace}>{PACE[pace]}</span><span className="water-pct">{Math.round(total/goal.ml*100)}%</span><span className="water-goal-note">{goalText(goal)}</span></div>
    <p className="water-hint">{hintOf(pace,total,goal.ml,expected,minute,s.profile)}</p>
    <div className="water-quick">{presets.map(([ml,label,Icon])=><button key={label} className="water-add" onClick={()=>add(ml)} aria-label={'Registrar '+fmtMl(ml)}><Icon size={22} strokeWidth={1.6}/><b>{fmtMl(ml)}</b><small>{label}</small></button>)}
     <button className={'water-add other'+(picker?' open':'')} onClick={()=>{setValue(last||300);setPicker(p=>!p);}} aria-expanded={picker}><Plus size={22} strokeWidth={1.6}/><b>Outro</b><small>valor</small></button></div>
    {picker&&<div className="water-picker"><button className="icon-button" aria-label="Menos 50 ml" onClick={()=>setValue(v=>Math.max(50,v-50))}><Minus size={16}/></button>
     <label><span className="sr-only">Quantidade em ml</span><input type="range" min={50} max={1500} step={50} value={Math.min(1500,value)} onChange={e=>setValue(Number(e.target.value))}/></label>
     <output>{fmtMl(value)}</output><button className="icon-button" aria-label="Mais 50 ml" onClick={()=>setValue(v=>Math.min(SIP_MAX,v+50))}><Plus size={16}/></button>
     <button className="button primary small" onClick={addCustom}>Registrar</button></div>}
    {undo&&<div className="water-undo" role="status"><Droplet size={15} fill="currentColor"/>+{fmtMl(undo.ml)} registrados<button className="text-button" onClick={()=>{remove(undo.id);setUndo(null);}}><Undo2 size={14}/>Desfazer</button></div>}
   </div>
  </div>
  <div className="water-bottom">
   <div className="water-log"><header><h3>Hoje</h3><span>{sips.length} {sips.length===1?'registro':'registros'}</span></header>
    {sips.length?<ul>{sips.slice().reverse().map(x=>{const [Icon,label]=VIA[x.via]||VIA.web;return <li key={x.id}><span className="water-via" title={label}><Icon size={13}/></span><b>{fmtMl(x.ml)}</b><time>{x.at}</time><button aria-label={'Remover '+fmtMl(x.ml)+' das '+x.at} onClick={()=>remove(x.id)}><X size={13}/></button></li>;})}</ul>
    :<p className="water-empty">Seu primeiro copo do dia aparece aqui. Também dá para mandar “bebi 500 ml” no WhatsApp ou no Telegram.</p>}</div>
   <div className="water-week"><header><h3>Sua semana</h3></header>
    <div className="water-bars">{week.map(d=><div key={d.date} className={'water-bar'+(d.hit?' hit':'')+(d.date===today?' today':'')} title={weekday(d.date)+': '+fmtMl(d.ml)+' de '+fmtMl(d.goal)}><div className="water-bar-track"><span style={{height:Math.min(100,(d.date===today?total:d.ml)/top*100)+'%'}}/><i style={{bottom:d.goal/top*100+'%'}}/></div><small>{d.date===today?'hoje':weekday(d.date)}</small></div>)}</div>
    <div className="water-stats"><span><Flame size={15}/><b>{streak}</b> {streak===1?'dia':'dias'} na meta</span><span><TrendingUp size={15}/>Média <b>{fmtMl(avg)}</b></span><span><Trophy size={15}/>Melhor <b>{fmtMl(best.ml)}</b></span></div></div>
  </div>
  <p className="water-tip"><Lightbulb size={15}/>{tipOf(today)}</p>
  {settings&&<WaterSettings onClose={()=>setSettings(false)}/>}
 </section>;}

function WaterSettings({onClose}:{onClose:()=>void}){
 const a=useApp(),p=a.state.profile,g=waterGoal({...a.state,profile:{...p,waterGoal:0}},a.today),{wake,bed}=awakeWindow(p);
 const [mode,setMode]=useState(p.waterGoal?'manual':'auto'),[liters,setLiters]=useState(String((p.waterGoal||g.ml)/LITER).replace('.',',')),[remind,setRemind]=useState(p.waterReminders===true),[notify,setNotify]=useState(()=>store.get(NOTIFY_KEY)==='yes'&&typeof Notification!=='undefined'&&Notification.permission==='granted'),[note,setNote]=useState('');
 async function toggleNotify(){if(notify){store.set(NOTIFY_KEY,'no');setNotify(false);return;}if(typeof Notification==='undefined'){setNote('Este navegador não mostra notificações.');return;}
  if(await Notification.requestPermission()==='granted'){store.set(NOTIFY_KEY,'yes');setNotify(true);setNote('');}else setNote('O navegador bloqueou as notificações do GeoAI. Libere nas configurações do site.');}
 async function save(){const ml=mode==='manual'?Math.round(Number(liters.replace(',','.'))*LITER/50)*50:0;if(mode==='manual'&&!(ml>=MANUAL_MIN&&ml<=MANUAL_MAX)){setNote('Escolha uma meta entre 1 e 6 litros.');return;}
  if(await a.mutate({type:'profile',profile:{waterGoal:ml,waterReminders:remind}})){a.toast('Hidratação atualizada.');onClose();}}
 return <Modal title="Hidratação" eyebrow="SUA META E SEUS LEMBRETES" subtitle="Ajuste a meta do dia e como o GeoAI te lembra de beber água." onClose={onClose}>
  <div className="water-settings">
   <fieldset><legend>Meta diária</legend>
    <label className="water-choice"><input type="radio" name="water-goal" checked={mode==='auto'} onChange={()=>setMode('auto')}/><span><b>Automática · {fmtMl(g.ml)} hoje</b><small>{goalText(g)}. Nos dias com treino registrado, soma {TRAINING_BONUS} ml.</small></span></label>
    <label className="water-choice"><input type="radio" name="water-goal" checked={mode==='manual'} onChange={()=>setMode('manual')}/><span><b>Manual</b><small>O mesmo valor todos os dias.</small></span></label>
    {mode==='manual'&&<label className="water-liters"><input inputMode="decimal" value={liters} onChange={e=>setLiters(e.target.value)} aria-label="Meta em litros"/><span>litros por dia</span></label>}
   </fieldset>
   <fieldset><legend>Lembretes quando estiver atrás do ritmo</legend>
    <label className="water-switch"><input type="checkbox" role="switch" checked={remind} onChange={e=>setRemind(e.target.checked)}/><span><b>WhatsApp e Telegram</b><small>Entre {clockOf((wake+60)%1440)} e {clockOf((bed-60)%1440)}, no máximo 4 por dia. Responda 1 ou 2 para registrar na hora.</small></span></label>
    <label className="water-switch"><input type="checkbox" role="switch" checked={notify} onChange={toggleNotify}/><span><b>Notificação neste navegador</b><small>Com o GeoAI aberto, no máximo a cada 2 horas. Vale só para este aparelho.</small></span></label>
   </fieldset>
   <p className="quiet-copy">O ritmo segue o seu dia, de {p.waketime} a {p.bedtime}. Ajuste os horários em Sono.</p>
   {note&&<p className="water-note" role="alert">{note}</p>}
  </div>
  <div className="modal-footer"><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={a.busy} onClick={save}>Salvar</button></div>
 </Modal>;}

// Notificação do navegador com o GeoAI aberto: mesma regra do lembrete (atrás do ritmo, dentro da janela), no máximo a cada 2 h neste aparelho.
export function WaterNudge(){
 const a=useApp(),ref=useRef(a);useEffect(()=>{ref.current=a;});
 useEffect(()=>{const tick=()=>{const {state,navigate}=ref.current;if(store.get(NOTIFY_KEY)!=='yes'||typeof Notification==='undefined'||Notification.permission!=='granted')return;
   if(Date.now()-(Number(store.get(NOTIFIED_KEY))||0)<2*3600000)return;const zone=state.profile.timezone,due=behindNow(state,todayInZone(zone),minutesInZone(zone));if(!due)return;
   store.set(NOTIFIED_KEY,String(Date.now()));const n=new Notification('GeoAI · Hora da água',{body:reminderText(due.total,due.goal,due.expected).replace(/^💧 /,''),icon:'/icon.svg',tag:'geoai-water'});
   n.onclick=()=>{window.focus();openHydration(navigate);n.close();};};
  const first=setTimeout(tick,60000),t=setInterval(tick,5*60000);return()=>{clearTimeout(first);clearInterval(t);};},[]);
 return null;}
