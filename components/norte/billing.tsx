'use client';
import {useState,useEffect,useRef,useCallback} from 'react';
import {ArrowUpRight,LoaderCircle,Download,Trash2,LogOut,CreditCard} from 'lucide-react';
import {SignOutButton} from '@clerk/nextjs';
import Link from 'next/link';
import {Modal} from './primitives';
import {useApp} from './context';
import {downloadBackup} from './backup';
import {PublicShell} from '@/components/legal';
import {formatMoney} from '@/lib/finance';
import {annualSaving,PLAN_NAMES,type BillingView,type PlanOffer,type Plan} from '@/lib/billing';
import type {Workspace} from '@/lib/types';
import {LEGAL} from '@/lib/legal';

type Toast=(text:string,error?:boolean)=>void;
// Fim do teste com hora (30/10, 14:05); datas da assinatura com o ano, porque o plano anual vai longe (27/10/2027).
const when=(iso:string|null,zone:string,time=false)=>iso?new Intl.DateTimeFormat('pt-BR',{timeZone:zone,day:'2-digit',month:'2-digit',...(time?{hour:'2-digit',minute:'2-digit'}:{year:'numeric'})}).format(new Date(iso)):'';

// Os dois planos com os preços da AbacatePay; "Assinar" leva ao checkout hospedado (só cartão).
export function PlansPicker(){
 const [offers,setOffers]=useState<PlanOffer[]|null>(null),[error,setError]=useState(''),[going,setGoing]=useState<Plan|null>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;fetch('/api/billing/plans',{cache:'no-store'}).then(async r=>{const j=await r.json().catch(()=>({}));if(!live)return;if(r.ok&&Array.isArray(j.plans))setOffers(j.plans);else setError(j.error||'Não foi possível carregar os planos. Tente de novo.');}).catch(()=>{if(live)setError('Não foi possível carregar os planos. Tente de novo.');});return()=>{live=false;};},[attempt]);
 async function subscribe(plan:Plan){setGoing(plan);setError('');try{const r=await fetch('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.url)throw new Error(j.error||'Não foi possível abrir o pagamento. Tente de novo.');window.location.assign(j.url);}catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir o pagamento. Tente de novo.');setGoing(null);}}
 const price=(plan:Plan)=>offers?.find(o=>o.plan===plan)?.price??0,saving=annualSaving(price('monthly'),price('annual'));
 return <div className="billing-picker">
  {!offers&&!error&&<p className="billing-loading"><LoaderCircle className="spin" size={16}/>Carregando os planos…</p>}
  {offers&&<div className="billing-plans">{offers.map(o=><article key={o.plan} className={'plan-card'+(o.plan==='annual'?' featured':'')}>
   <header><h3>{o.name}</h3>{o.plan==='annual'&&saving>0&&<span className="pill green">Economize {saving}%</span>}</header>
   <p className="plan-price"><strong>{formatMoney(o.price)}</strong><span>{o.plan==='annual'?'por ano':'por mês'}</span></p>
   <small>{o.plan==='annual'?'Equivale a '+formatMoney(Math.round(o.price/12))+' por mês':'Renova todo mês'}</small>
   <button className={'button full-width '+(o.plan==='annual'?'primary':'outline')} disabled={!!going} onClick={()=>subscribe(o.plan)}>{going===o.plan?<LoaderCircle className="spin" size={16}/>:<CreditCard size={16}/>}Assinar o {o.name}</button>
  </article>)}</div>}
  {error&&<p className="form-error" role="alert">{error}{!offers&&<> <button className="text-button" onClick={()=>{setError('');setAttempt(x=>x+1);}}>Tentar de novo</button></>}</p>}
  <p className="billing-note">Cobrança automática no cartão. Cancele quando quiser em Configurações; o acesso continua até o fim do período pago. Você tem 7 dias para desistir com reembolso integral. <Link href="/termos">Termos de uso</Link> · <Link href="/privacidade">Privacidade</Link></p>
 </div>;}

export function TrialBar({billing,zone,onPlans}:{billing:BillingView;zone:string;onPlans:()=>void}){if(billing.status!=='trial')return null;
 return <div className="trial-bar" role="status"><span>Teste grátis até <strong>{when(billing.until,zone,true)}</strong></span><button className="text-button" onClick={onPlans}>Assinar<ArrowUpRight size={14}/></button></div>;}

// Volta do checkout (/?assinatura=ok): o webhook pode levar alguns segundos, então o app consulta de novo até o acesso aparecer.
export function CheckoutReturn({billing,reload,toast}:{billing:BillingView;reload:()=>unknown;toast:Toast}){
 const [active]=useState(()=>new URLSearchParams(window.location.search).get('assinatura')==='ok'),[done,setDone]=useState(false),handled=useRef(false);
// Quem assina de novo com dias pagos sobrando já está 'active', mas cancelado: só conta como pago quando a assinatura nova chega.
 const paid=billing.status==='free'||billing.status==='off'||(billing.status==='active'&&!billing.cancelled);
 useEffect(()=>{if(!active||handled.current)return;
  const clear=()=>{const u=new URL(window.location.href);u.searchParams.delete('assinatura');window.history.replaceState(window.history.state,'',u.pathname+u.search+u.hash);};
  if(paid){handled.current=true;clear();toast('Assinatura ativa. Obrigado!');return;}
  const started=Date.now(),t=setInterval(()=>{if(Date.now()-started<60000){reload();return;}clearInterval(t);handled.current=true;clear();setDone(true);toast('O pagamento ainda não foi confirmado. Se você já pagou, não pague de novo: aguarde alguns minutos e recarregue a página.',true);},3000);
  return()=>clearInterval(t);},[active,paid,reload,toast]);
 if(!active||done||paid)return null;
 return <p className="billing-confirm" role="status"><LoaderCircle className="spin" size={16}/>Confirmando pagamento…</p>;}

// Configurações → Assinatura: situação, data e cancelamento da renovação (o acesso segue até a data paga).
export function BillingCard(){const a=useApp(),b=a.billing,zone=a.state.profile.timezone;const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
 if(b.status==='off')return null;
 const plan=b.plan?PLAN_NAMES[b.plan]:'';
 const text=b.status==='free'?'Acesso liberado, sem cobrança.':b.status==='trial'?'Teste grátis até '+when(b.until,zone,true)+'.':b.cancelled?'Plano '+plan+' cancelado · acesso até '+when(b.until,zone)+'.':b.late?'Plano '+plan+' · aguardando a renovação.':'Plano '+plan+' · renova em '+when(b.until,zone)+'.';
 async function cancel(){setBusy(true);try{const r=await fetch('/api/billing/cancel',{method:'POST'});const j=await r.json().catch(()=>({}));if(!r.ok||!j.billing)throw new Error(j.error||'Não foi possível cancelar agora.');a.setBilling(j.billing);setConfirm(false);a.toast('Renovação cancelada. Seu acesso continua até '+when(j.billing.until,zone)+'.');}catch(e){a.toast(e instanceof Error?e.message:'Não foi possível cancelar agora.',true);}finally{setBusy(false);}}
 return <section className="panel integration-card billing-card"><span className="icon-tile"><CreditCard size={22}/></span><h2>Assinatura</h2><span className={'pill'+(b.status==='trial'||b.cancelled?'':' green')}>{b.status==='free'?'Grátis':b.status==='trial'?'Teste grátis':b.cancelled?'Cancelada':'Ativa'}</span><p>{text}</p>
  {b.canSubscribe&&<button className="button primary full-width" onClick={a.openPlans}>Ver planos</button>}
  {b.canCancel&&<button className="text-button danger" onClick={()=>setConfirm(true)}>Cancelar renovação</button>}
  {confirm&&<Modal title="Cancelar a renovação?" subtitle={'Nenhuma nova cobrança será feita. Você continua com acesso até '+when(b.until,zone)+'.'} onClose={()=>setConfirm(false)}><div className="modal-footer"><button className="button ghost" onClick={()=>setConfirm(false)}>Manter assinatura</button><button className="button destructive" disabled={busy} onClick={cancel}>Cancelar renovação</button></div></Modal>}
 </section>;}

// Teste ou assinatura vencidos: só os planos, o backup, apagar os dados e sair. Fica fora do app, então tem os próprios avisos.
export function Paywall({billing,state,today,reload,onReset}:{billing:BillingView;state:Workspace;today:string;reload:()=>unknown;onReset:()=>Promise<boolean>}){
 const [msg,setMsg]=useState<{text:string;error?:boolean}|null>(null),[reset,setReset]=useState(false),[resetText,setResetText]=useState(''),[busy,setBusy]=useState(false);
 const toast=useCallback<Toast>((text,error)=>setMsg({text,error}),[]);
 async function backup(){try{await downloadBackup(state,today);}catch(e){toast(e instanceof Error?e.message:'Não foi possível baixar o backup.',true);}}
 async function wipe(){setBusy(true);const ok=await onReset();setBusy(false);if(ok){setReset(false);setResetText('');toast('Seus registros foram apagados.');}else toast('Não foi possível apagar agora. Tente de novo.',true);}
 return <PublicShell><main className="paywall"><div className="login-brand">G<span>↗</span></div><p className="eyebrow">GEOAI · ASSINATURA</p>
  <h1>{billing.paidBefore?'Sua assinatura venceu':'Seu teste grátis acabou'}</h1><p className="paywall-lead">{billing.canSubscribe?'Escolha um plano para continuar organizando seu dia. ':''}Seus dados continuam guardados.</p>
  <CheckoutReturn billing={billing} reload={reload} toast={toast}/>
  {msg&&<p className={msg.error?'form-error':'billing-confirm'} role={msg.error?'alert':'status'}>{msg.text}</p>}
  {/* Assinatura viva sem o último pagamento confirmado: assinar de novo cobraria em dobro. */}
  {billing.canSubscribe?<PlansPicker/>:<p className="paywall-pending">Sua assinatura continua ativa na AbacatePay, mas o último pagamento ainda não foi confirmado. Se você já pagou, aguarde alguns minutos; se continuar assim, fale com a gente pelo <a href={'mailto:'+LEGAL.email}>e-mail</a> ou pelo <a href={LEGAL.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>.</p>}
  <div className="paywall-actions"><button className="button outline" onClick={backup}><Download size={16}/>Baixar backup</button><SignOutButton redirectUrl="/"><button className="button outline"><LogOut size={16}/>Sair</button></SignOutButton><button className="text-button danger" onClick={()=>setReset(true)}>Apagar meus dados<Trash2 size={15}/></button></div>
  {reset&&<Modal title="Apagar todos os meus registros" subtitle="Esta ação não pode ser desfeita sem um backup." onClose={()=>setReset(false)}><label className="field"><span>Digite APAGAR para confirmar</span><input value={resetText} onChange={e=>setResetText(e.target.value)}/></label><div className="modal-footer"><button className="button ghost" onClick={()=>setReset(false)}>Cancelar</button><button className="button destructive" disabled={resetText!=='APAGAR'||busy} onClick={wipe}>Apagar meus dados</button></div></Modal>}
 </main></PublicShell>;}
