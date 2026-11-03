'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {applyProfile,type GymProfile,type ProfileCommand,type Routine} from '@/lib/gym';
import {applyActive,type ActiveCommand,type ActiveWorkout,type Workout} from '@/lib/gym-active';
import {isCatalogId,EXERCISES,fromCustom,type Exercise} from '@/lib/gym-catalog';
import {starterPlan,buildActive} from '@/lib/gym-plan';
import {recordsIn} from '@/lib/gym-stats';
import type {GymView,ActiveResult} from '@/lib/gym-service';
import type {BillingView} from '@/lib/billing';
import {useApp} from './context';
// Estado do Gym no aparelho. Cada comando é aplicado na hora com o mesmo redutor do servidor e vai para uma fila,
// em ordem; quando a fila esvazia, a resposta do servidor vira a verdade. Sem rede, a fila espera e tenta de novo.
type Fail={error?:string;status:number;billing?:BillingView};
type Result<T>={ok:boolean;body:T&Fail};
async function call<T>(url:string,method:string,body?:unknown):Promise<Result<T>>{const r=await fetch(url,{method,cache:'no-store',...(body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});let j:unknown={};try{j=await r.json();}catch{}return {ok:r.ok,body:{...(j&&typeof j==='object'?j:{}),status:r.status} as T&Fail};}
const uid=()=>crypto.randomUUID();
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export type GymApi={view:GymView|null;error:string;offline:boolean;today:string;exercises:Exercise[];known:(id:string)=>boolean;
 reload:()=>Promise<void>;profile:(c:ProfileCommand)=>Promise<boolean>;act:(c:ActiveCommand)=>void;
 start:(routine:Routine|null,opts?:{replace?:boolean;name?:string;from?:Workout})=>Promise<boolean>;finish:()=>Promise<Workout|null>;discard:()=>Promise<boolean>;
 saveWorkout:(w:Workout,isNew:boolean)=>Promise<Workout|null>;removeWorkout:(id:string)=>Promise<boolean>;loadAll:()=>Promise<void>;full:boolean;
 open:boolean;setOpen:(v:boolean)=>void;summary:Workout|null;setSummary:(w:Workout|null)=>void};
const Ctx=createContext<GymApi|null>(null);
export const useGym=()=>{const c=useContext(Ctx);if(!c)throw new Error('useGym fora do GymProvider');return c;};

export function GymProvider({children}:{children:React.ReactNode}){
 const app=useApp(),today=app.today,{toast}=app;
 const [view,setView]=useState<GymView|null>(null),[error,setError]=useState(''),[offline,setOffline]=useState(false),[open,setOpen]=useState(false),[summary,setSummary]=useState<Workout|null>(null),[full,setFull]=useState(false);
 const viewRef=useRef<GymView|null>(null);useEffect(()=>{viewRef.current=view;},[view]);
 const queue=useRef(Promise.resolve()),pending=useRef(0);
 const reload=useCallback(async()=>{setError('');try{const r=await call<GymView>('/api/gym','GET');if(!r.ok)throw new Error(r.body.error||'Não foi possível abrir o Gym.');pending.current=0;setView(r.body);setFull(!r.body.next);}catch(e){setError(e instanceof Error?e.message:'Falha de conexão');}},[]);
 useEffect(()=>{const t=setTimeout(reload,0);return()=>clearTimeout(t);},[reload]);
 // Ao voltar para a aba, confere se outro aparelho mexeu no treino (só quando não há nada na fila).
 useEffect(()=>{const v=()=>{if(document.visibilityState==='visible'&&pending.current===0)reload();};document.addEventListener('visibilitychange',v);return()=>document.removeEventListener('visibilitychange',v);},[reload]);
 const custom=view?.profile.custom;
 const exercises=useMemo(()=>[...EXERCISES,...(custom||[]).map(fromCustom)],[custom]);
 const known=useCallback((id:string)=>isCatalogId(id)||!!viewRef.current?.profile.custom.some(c=>c.id===id),[]);
 // 402 (assinatura) mostra a tela de planos; 409 recarrega; o resto vira aviso.
 const failed=useCallback((body:Fail)=>{if(body.status===402&&body.billing)app.setBilling(body.billing);toast(body.error||'Não foi possível salvar.',true);if(body.status===409||body.status===404)reload();},[app,toast,reload]);
 const send=useCallback(async<T,>(url:string,body:unknown):Promise<Result<T>>=>{for(let i=0;;i++){try{const r=await call<T>(url,'POST',body);setOffline(false);return r;}catch{setOffline(true);if(i>=40)return {ok:false,body:{error:'Sem conexão. Tente de novo quando a internet voltar.',status:0} as T&Fail};await wait(Math.min(15000,1500*(i+1)));}}},[]);

 const profile=useCallback(async(command:ProfileCommand)=>{const cur=viewRef.current;if(!cur)return false;
  let next:GymProfile;try{next=applyProfile(cur.profile,command,{known,today,starter:starterPlan});}catch(e){toast(e instanceof Error?e.message:'Não foi possível salvar.',true);return false;}
  setView(v=>v&&{...v,profile:next});const r=await send<{profile:GymProfile;rev:number}>('/api/gym',{command,today});
  if(!r.ok){failed(r.body);setView(v=>v&&{...v,profile:cur.profile});return false;}setView(v=>v&&{...v,profile:r.body.profile,rev:r.body.rev});return true;},[known,today,toast,send,failed]);

 const act=useCallback((command:ActiveCommand)=>{const cur=viewRef.current;if(!cur?.active)return;const at=new Date();
  let next:ActiveWorkout;try{next=applyActive(cur.active,command,at,known);}catch(e){toast(e instanceof Error?e.message:'Não foi possível salvar.',true);return;}
  viewRef.current={...cur,active:next};setView(viewRef.current);pending.current++;
  queue.current=queue.current.then(async()=>{const r=await send<ActiveResult>('/api/gym/active',{command,at:at.toISOString()});pending.current=Math.max(0,pending.current-1);
   if(!r.ok){pending.current=0;failed(r.body);return;}if(pending.current===0)setView(v=>v&&{...v,active:r.body.active,activeRev:r.body.activeRev});});},[known,toast,send,failed]);

 const start=useCallback(async(routine:Routine|null,o:{replace?:boolean;name?:string;from?:Workout}={})=>{const cur=viewRef.current;if(!cur)return false;
  const built=buildActive(cur.profile,cur.workouts,routine,{id:uid(),date:today,at:new Date(),newId:uid,name:o.name});
  // "Repetir hoje": as mesmas séries de um treino passado, com as cargas dele.
  if(o.from)built.exercises=o.from.exercises.map(e=>({id:uid(),exerciseId:e.exerciseId,restSec:cur.profile.settings.restSec,superset:false,notes:'',target:null,sets:e.sets.filter(s=>s.kind!=='warmup').map(s=>({...s,id:uid(),done:false,doneAt:null,effort:null}))}));
  await queue.current;const r=await send<ActiveResult>('/api/gym/active',{command:{type:'start',workout:built,replace:o.replace===true},at:new Date().toISOString()});
  if(!r.ok){failed(r.body);return false;}if(r.body.existing)toast('Você já tinha um treino em andamento. Ele foi reaberto.');
  setView(v=>v&&{...v,active:r.body.active,activeRev:r.body.activeRev});setOpen(true);return true;},[today,send,failed,toast]);

 const finish=useCallback(async()=>{await queue.current;const cur=viewRef.current;if(!cur?.active)return null;
  const done={...cur.active,exercises:cur.active.exercises.map(e=>({...e,sets:e.sets.filter(s=>s.done)}))};const prs=recordsIn(done,cur.workouts).length;
  const r=await send<ActiveResult>('/api/gym/active',{command:{type:'finish',id:cur.active.id,prs},at:new Date().toISOString()});if(!r.ok){failed(r.body);return null;}
  const w=r.body.workout;if(!w)return null;setView(v=>v&&{...v,active:null,activeRev:0,workouts:[w,...v.workouts.filter(x=>x.id!==w.id)]});setOpen(false);setSummary(w);return w;},[send,failed]);
 const discard=useCallback(async()=>{await queue.current;const r=await send<ActiveResult>('/api/gym/active',{command:{type:'discard'},at:new Date().toISOString()});if(!r.ok){failed(r.body);return false;}setView(v=>v&&{...v,active:null,activeRev:0});setOpen(false);return true;},[send,failed]);

 const saveWorkout=useCallback(async(w:Workout,isNew:boolean)=>{type Saved={workout:Workout};const r=isNew?await send<Saved>('/api/gym/workouts',{workout:w}):await call<Saved>('/api/gym/workouts/'+encodeURIComponent(w.id),'PATCH',{workout:w}).catch(():Result<Saved>=>({ok:false,body:{error:'Sem conexão.',status:0} as Saved&Fail}));
  if(!r.ok){failed(r.body);return null;}const saved=r.body.workout;setView(v=>v&&{...v,workouts:[saved,...v.workouts.filter(x=>x.id!==saved.id)].sort((a,b)=>b.date.localeCompare(a.date)||b.startedAt.localeCompare(a.startedAt))});return saved;},[send,failed]);
 const removeWorkout=useCallback(async(id:string)=>{const r=await call<{ok:boolean}>('/api/gym/workouts/'+encodeURIComponent(id),'DELETE').catch(():Result<{ok:boolean}>=>({ok:false,body:{ok:false,error:'Sem conexão.',status:0}}));if(!r.ok){failed(r.body);return false;}setView(v=>v&&{...v,workouts:v.workouts.filter(x=>x.id!==id)});return true;},[failed]);
 // Estatísticas pedem o histórico inteiro: busca as páginas que faltam.
 const loadAll=useCallback(async()=>{let next=viewRef.current?.next;while(next){const r=await call<{workouts:Workout[];next:string|null}>('/api/gym/workouts?before='+encodeURIComponent(next),'GET').catch(()=>null);if(!r?.ok)break;const page=r.body;setView(v=>v&&{...v,workouts:[...v.workouts,...page.workouts.filter((w:Workout)=>!v.workouts.some(x=>x.id===w.id))],next:page.next});next=page.next;}setFull(true);},[]);
 const api:GymApi={view,error,offline,today,exercises,known,reload,profile,act,start,finish,discard,saveWorkout,removeWorkout,loadAll,full,open,setOpen,summary,setSummary};
 return <Ctx.Provider value={api}>{children}</Ctx.Provider>;}
