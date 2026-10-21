'use client';
import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react';import {ArrowUp,ArrowDown,X,Play,Wand2,LoaderCircle,Check} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {Progress,Empty} from './primitives';import {foco} from './focus-api';import {ddmm} from './focus-ui';
import {buildDayPlan,planProgress,type DayPlan} from '@/lib/day-plan';import {codeOf} from '@/lib/board';
// Plano do dia: montado pela regra (sem IA), editado à mão e gravado a cada mudança, em fila.
export function FocusToday(){const a=useApp(),f=useFoco();const {toast}=a;const [plan,setPlan]=useState<DayPlan|null>(null),[date,setDate]=useState(a.today),[available,setAvailable]=useState(8);const queue=useRef<Promise<unknown>>(Promise.resolve());const pending=useRef(0);
 const show=useCallback((r:{date:string;plan:DayPlan})=>{setPlan(r.plan);setDate(r.date);setAvailable(r.plan.available);},[]);
 const fail=useCallback((e:unknown)=>toast(e instanceof Error?e.message:'Não foi possível abrir o plano.',true),[toast]);
 useEffect(()=>{const load=()=>{foco.plan().then(r=>{if(!pending.current)show(r);}).catch(fail);};load();window.addEventListener('geoai:foco-refresh',load);return()=>window.removeEventListener('geoai:foco-refresh',load);},[show,fail,a.today]);
 if(!plan)return <p className="quiet-copy"><LoaderCircle size={15} className="spin"/> Carregando o plano…</p>;
 // Com gravações na fila, a leitura do servidor é ignorada; se uma falhar, o plano é relido quando a fila esvazia.
 const save=(next:DayPlan)=>{setPlan(next);pending.current++;const run=queue.current.then(()=>foco.putPlan(date,next));queue.current=run.catch(()=>{});run.then(()=>{pending.current--;},e=>{pending.current--;toast(e instanceof Error?e.message:'Não foi possível salvar o plano.',true);if(!pending.current)foco.plan().then(r=>{if(!pending.current)show(r);}).catch(fail);});};
 const byId=new Map(f.cards.map(c=>[c.id,c])),progress=planProgress(plan,a.state.focusSessions,a.today),planned=plan.items.reduce((s,i)=>s+i.pomodoros,0);
 const build=()=>save(buildDayPlan(f.cards,a.state.focusSessions,plan,available,a.today));
 const move=(i:number,d:number)=>{const items=[...plan.items],j=i+d;if(j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];save({...plan,items});};
 const remove=(id:string)=>save({...plan,items:plan.items.filter(x=>x.cardId!==id),removed:[...new Set([...plan.removed,id])]});
 const setPomos=(id:string,n:number)=>save({...plan,items:plan.items.map(x=>x.cardId===id?{...x,pomodoros:Math.min(4,Math.max(1,Math.round(n)||1))}:x)});
 const first=plan.items.find(x=>{const c=byId.get(x.cardId);return c&&c.status!=='done';});
 return <section className="panel fo-today"><header className="section-heading"><h2>{planned} de {plan.available} pomodoros · {ddmm(date)}</h2>
   <div className="fo-row-end"><label className="fo-inline"><span>Disponíveis</span><input type="number" min={1} max={16} value={available} onChange={e=>setAvailable(Math.min(16,Math.max(1,Number(e.target.value)||1)))} onBlur={()=>{if(available!==plan.available)save({...plan,available});}}/></label>
    <button className="button outline small" onClick={build}><Wand2 size={15}/>Montar meu dia</button><button className="button primary small" disabled={!first} onClick={()=>first&&f.start(first.cardId)}><Play size={15} fill="currentColor"/>Começar o dia</button></div></header>
  <div className="fo-pad"><Progress value={plan.available?planned/plan.available*100:0} label="Plano do dia"/></div>
  {plan.items.length?<ol className="fo-plan">{plan.items.map((it,i)=>{const c=byId.get(it.cardId),done=progress[it.cardId]||0;return <li key={it.cardId} className={!c?'gone missing':c.status==='done'?'gone done':it===first?'next':''} style={{'--i':Math.min(i,8)} as CSSProperties}><span className="fo-plan-n">{i+1}{c?.status==='done'&&<Check size={9} strokeWidth={3.5} className="fo-plan-check"/>}</span>
    <div className="fo-plan-main"><button className="text-button" disabled={!c} onClick={()=>c&&f.open(c.id)}>{c?<><b>{codeOf(c)}</b> {c.title}</>:'Card arquivado ou excluído'}</button><small>{it.reason}</small></div>
    <span className="fo-plan-progress">{done}/{it.pomodoros} 🍅<i className={'fo-plan-meter'+(done>=it.pomodoros?' full':'')} aria-hidden><i style={{width:Math.min(100,done/it.pomodoros*100)+'%'}}/></i></span><input type="number" min={1} max={4} aria-label={'Pomodoros do item '+(i+1)} value={it.pomodoros} onChange={e=>{const n=Number(e.target.value);if(e.target.value!==''&&Number.isInteger(n)&&n>=1&&n<=4)setPomos(it.cardId,n);}}/>
    <span className="fo-plan-tools"><button className="icon-button" aria-label="Subir" disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={15}/></button><button className="icon-button" aria-label="Descer" disabled={i===plan.items.length-1} onClick={()=>move(i,1)}><ArrowDown size={15}/></button><button className="icon-button" aria-label="Remover do plano" onClick={()=>remove(it.cardId)}><X size={15}/></button></span></li>;})}</ol>
  :<Empty title="Plano vazio" description="O plano de hoje está vazio. Monte seu dia com os pomodoros que você tem." action="Montar meu dia" onAction={build}/>}
  {plan.removed.length>0&&<p className="quiet-copy fo-pad">Removidos por você (não voltam hoje): {plan.removed.map(id=>{const c=byId.get(id);return c?codeOf(c):'card';}).join(', ')}</p>}</section>;}
