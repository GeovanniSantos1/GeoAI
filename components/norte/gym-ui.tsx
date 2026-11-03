'use client';
import {useMemo,useState} from 'react';
import {Minus,Plus,Search,Star,Check,Dumbbell,ArrowUp,ArrowDown,Footprints,HeartPulse,PersonStanding,Flame,Activity,StretchHorizontal,type LucideIcon} from 'lucide-react';
import {toUnit,fromUnit,type Unit,type RoutineIcon} from '@/lib/gym';
import {searchExercises,BODY_PARTS,EQUIPMENT,MUSCLES,type Exercise} from '@/lib/gym-catalog';
import {REST_PRESETS} from '@/lib/gym-active';
import {Modal} from './primitives';
import {useGym} from './gym-context';
export const ROUTINE_ICONS:Record<RoutineIcon,LucideIcon>={dumbbell:Dumbbell,push:ArrowUp,pull:ArrowDown,legs:Footprints,core:Flame,cardio:HeartPulse,full:PersonStanding,stretch:StretchHorizontal};
export const ICON_LABEL:Record<RoutineIcon,string>={dumbbell:'Halter',push:'Empurrar',pull:'Puxar',legs:'Pernas',core:'Abdômen',cardio:'Cardio',full:'Corpo inteiro',stretch:'Alongamento'};
export const fmtDate=(d:string,opts:Intl.DateTimeFormatOptions={weekday:'short',day:'numeric',month:'short'})=>new Date(d+'T12:00:00Z').toLocaleDateString('pt-BR',{...opts,timeZone:'UTC'});
export const fmtMinutes=(m:number)=>m>=60?Math.floor(m/60)+'h'+(m%60?String(m%60).padStart(2,'0'):''):m+' min';
export const fmtClock=(sec:number)=>Math.floor(sec/60)+':'+String(Math.max(0,sec%60)).padStart(2,'0');
export const fmtVolume=(kg:number,unit:Unit)=>Math.round(toUnit(kg,unit)).toLocaleString('pt-BR')+' '+unit;
export const fmtSecs=(s:number)=>s>=60?fmtClock(s)+' min':s+' s';
export const plural=(n:number,one:string,many:string)=>n+' '+(n===1?one:many);

// Campo numérico com − e +: o passo é o incremento do exercício (na unidade da tela). Vazio vale null.
export function Stepper({value,onChange,step,min=0,max=9999,label,unit,decimals=2,compact=false}:{value:number|null;onChange:(v:number|null)=>void;step:number;min?:number;max?:number;label:string;unit?:Unit;decimals?:number;compact?:boolean}){
 const shown=value===null?'':unit?toUnit(value,unit):value;const [draft,setDraft]=useState<string|null>(null);
 const commit=(v:number|null)=>{if(v===null){onChange(null);return;}const c=Math.min(max,Math.max(min,Math.round(v*10**decimals)/10**decimals));onChange(unit?fromUnit(c,unit):c);};
 const bump=(d:number)=>{const base=value===null?0:unit?toUnit(value,unit):value;commit(base+d*step);};
 return <div className={'gy-stepper'+(compact?' compact':'')}><button type="button" aria-label={'Diminuir '+label} onClick={()=>bump(-1)}><Minus size={15}/></button>
  <input inputMode="decimal" aria-label={label} value={draft??String(shown).replace('.',',')} onFocus={e=>{setDraft(String(shown).replace('.',','));e.currentTarget.select();}} onChange={e=>setDraft(e.target.value)}
   onBlur={()=>{if(draft!==null){const t=draft.replace(',','.').trim();commit(t===''?null:Number.isFinite(Number(t))?Number(t):null);}setDraft(null);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
  <button type="button" aria-label={'Aumentar '+label} onClick={()=>bump(1)}><Plus size={15}/></button></div>;}
// Descanso entre séries em minutos, como se fala na academia: 1, 1,5, 2, 2,5 e 3 min.
export const restLabel=(s:number)=>(s/60).toLocaleString('pt-BR',{maximumFractionDigits:2})+' min';
export function RestChips({value,onPick,label}:{value:number|null;onPick:(sec:number)=>void;label:string}){return <div className="gy-rest-pick" role="radiogroup" aria-label={label}>{REST_PRESETS.map(s=><button key={s} type="button" role="radio" aria-checked={value===s} className={value===s?'active':''} onClick={()=>onPick(s)}>{restLabel(s)}</button>)}</div>;}
export function Switch({checked,onChange,label,hint}:{checked:boolean;onChange:(v:boolean)=>void;label:string;hint?:string}){return <label className="gy-switch"><span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span><input type="checkbox" role="switch" checked={checked} onChange={e=>onChange(e.target.checked)}/><i aria-hidden/></label>;}
export function Segmented<T extends string>({value,options,onChange,label}:{value:T;options:[T,string][];onChange:(v:T)=>void;label:string}){return <div className="gy-segmented" role="radiogroup" aria-label={label}>{options.map(([v,l])=><button key={v} type="button" role="radio" aria-checked={value===v} className={value===v?'active':''} onClick={()=>onChange(v)}>{l}</button>)}</div>;}
export function MuscleChips({exercise,limit=4}:{exercise?:Exercise;limit?:number}){if(!exercise)return null;const list=[...exercise.primary.map(m=>[m,true] as const),...exercise.secondary.map(m=>[m,false] as const)].slice(0,limit);
 return <span className="gy-chips">{list.map(([m,main])=><span key={m} className={'gy-chip'+(main?' main':'')}>{MUSCLES[m]||m}</span>)}{exercise.equipment!=='none'&&<span className="gy-chip ghost">{EQUIPMENT[exercise.equipment]||exercise.equipment}</span>}</span>;}
// Músculos que uma lista de exercícios trabalha, do mais frequente ao menos (os principais pesam o dobro).
export function musclesWorked(list:(Exercise|undefined)[]){const score=new Map<string,number>();for(const e of list){if(!e)continue;for(const m of e.primary)score.set(m,(score.get(m)||0)+2);for(const m of e.secondary)score.set(m,(score.get(m)||0)+1);}
 return [...score.entries()].sort((a,b)=>b[1]-a[1]).map(([m])=>MUSCLES[m]||m);}

// Escolher exercícios: busca, partes do corpo, equipamento e favoritos. Com multiple, cada toque adiciona na hora.
export function ExercisePicker({title='Escolher exercício',onPick,onClose,multiple=false,subtitle}:{title?:string;subtitle?:string;onPick:(e:Exercise)=>void;onClose:()=>void;multiple?:boolean}){
 const g=useGym();const [query,setQuery]=useState(''),[part,setPart]=useState(''),[equipment,setEquipment]=useState(''),[fav,setFav]=useState(false),[added,setAdded]=useState<string[]>([]),[limit,setLimit]=useState(60);
 const favorites=g.view?.profile.favorites;
 const list=useMemo(()=>searchExercises(g.exercises,{query,part,equipment,favorites,onlyFavorites:fav}),[g.exercises,query,part,equipment,favorites,fav]);
 return <Modal title={title} subtitle={subtitle||(multiple?'Toque para adicionar. Pode escolher vários.':undefined)} eyebrow="EXERCÍCIOS" onClose={onClose} wide className="gy-picker">
  <label className="search-field gy-search"><Search size={18}/><input autoFocus value={query} onChange={e=>{setQuery(e.target.value);setLimit(60);}} placeholder="Supino, agachamento, polia…" aria-label="Buscar exercício"/></label>
  <div className="gy-filter-row"><button type="button" className={'gy-filter'+(fav?' active':'')} aria-pressed={fav} onClick={()=>setFav(v=>!v)}><Star size={13}/>Favoritos</button>{BODY_PARTS.map(p=><button type="button" key={p.id} className={'gy-filter'+(part===p.id?' active':'')} aria-pressed={part===p.id} onClick={()=>setPart(x=>x===p.id?'':p.id)}>{p.label}</button>)}</div>
  <label className="field gy-inline-field"><span>Equipamento</span><select value={equipment} onChange={e=>setEquipment(e.target.value)}><option value="">Todos</option>{Object.entries(EQUIPMENT).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <p className="gy-count" role="status">{list.length?plural(list.length,'exercício','exercícios'):'Nada encontrado. Tente outra palavra ou tire um filtro.'}</p>
  <ul className="gy-pick-list">{list.slice(0,limit).map(e=>{const done=added.includes(e.id);return <li key={e.id}><button type="button" onClick={()=>{onPick(e);if(multiple)setAdded(a=>[...a,e.id]);}}><span><strong>{e.name}</strong><MuscleChips exercise={e} limit={3}/></span>{multiple?(done?<Check size={17} className="gy-ok"/>:<Plus size={17}/>):null}</button></li>;})}</ul>
  {list.length>limit&&<button type="button" className="button outline full-width" onClick={()=>setLimit(l=>l+60)}>Mostrar mais</button>}
  {multiple&&<div className="modal-footer"><span className="gy-count">{added.length?plural(added.length,'adicionado','adicionados'):''}</span><button type="button" className="button primary" onClick={onClose}>Pronto</button></div>}
 </Modal>;}
export function Icon({name,size=18}:{name:RoutineIcon;size?:number}){const I=ROUTINE_ICONS[name]||Activity;return <I size={size} strokeWidth={1.8}/>;}
