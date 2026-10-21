'use client';
import {useId,type ReactNode} from 'react';import {PRIORITY_LABEL,AREA_LABEL,type Priority,type Area,type Change} from '@/lib/board';
// Peças comuns do Foco: selos, anel do timer, tabela de mudanças e formatos de data e tempo.
export const ddmm=(d:string|null|undefined)=>d?d.slice(8,10)+'/'+d.slice(5,7):'';
export const ddmmyyyy=(d:string|null|undefined)=>d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'—';
export const clock=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',','');
export const mmss=(s:number)=>String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')+':'+String(Math.max(0,s)%60).padStart(2,'0');
export function PriorityBadge({p}:{p:Priority}){return <span className={'fo-prio '+p}>{PRIORITY_LABEL[p]}</span>;}
export function AreaChip({a}:{a:Area}){return <span className="fo-area">{AREA_LABEL[a]}</span>;}
export function Ring({fraction,size=280,stroke=5,tone='var(--fo-tomato)',children}:{fraction:number;size?:number;stroke?:number;tone?:string;children?:ReactNode}){const r=size/2-stroke-2,c=2*Math.PI*r,f=Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0)),mid=size/2,big=size>=120;
 // Ids próprios por anel: o mini da barra e o grande do Timer aparecem juntos.
 const id=useId().replace(/[^\w-]/g,''),tick=(i:number)=>{const a=i*Math.PI/30,o=r-stroke/2-6,n=o-(i%5?3:7),x=Math.sin(a),y=Math.cos(a);return 'M'+(mid+o*x).toFixed(1)+' '+(mid-o*y).toFixed(1)+'L'+(mid+n*x).toFixed(1)+' '+(mid-n*y).toFixed(1);};
 const ticks=(major:boolean)=>Array.from({length:60},(_,i)=>i).filter(i=>(i%5===0)===major).map(tick).join('');
 return <div className={'fo-ring'+(big?' fo-ring-lg':'')} style={{width:size,height:size}}><svg viewBox={'0 0 '+size+' '+size} aria-hidden="true">
  <defs><linearGradient id={id+'g'} x1="1" y1=".5" x2="0" y2=".5"><stop offset="0" style={{stopColor:tone}}/><stop offset="1" style={{stopColor:'color-mix(in srgb,'+tone+' 50%,var(--gold))'}}/></linearGradient>
   {big&&<filter id={id+'f'} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity=".4" style={{floodColor:tone}}/></filter>}</defs>
  <circle className="fo-ring-track" cx={mid} cy={mid} r={r} fill="none" strokeWidth={Math.max(2,stroke-2)} style={{stroke:'color-mix(in srgb,'+tone+' 14%,var(--border))'}}/>
  {big&&<g className="fo-ring-ticks"><path d={ticks(false)}/><path className="major" d={ticks(true)}/></g>}
  <circle className="fo-ring-arc" cx={mid} cy={mid} r={r} fill="none" stroke={'url(#'+id+'g)'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} transform={'rotate(-90 '+mid+' '+mid+')'} filter={big?'url(#'+id+'f)':undefined} style={{strokeDashoffset:(1-f)*c,opacity:f>0?1:0}}/>
  {big&&f>0&&<g className="fo-ring-head" style={{transform:'rotate('+f*360+'deg)'}}><circle cx={mid} cy={mid-r} r={stroke*.28} fill="var(--surface)"/></g>}</svg>{children&&<div className="fo-ring-label">{children}</div>}</div>;}
const cut=(v:string)=>!v?'—':v.length>120?v.slice(0,120)+'…':v;
export function ChangesTable({changes,onOpen}:{changes:Change[];onOpen?:(cardId:string)=>void}){return <div className="fo-changes-wrap"><table className="fo-changes"><tbody>{changes.map((c,i)=><tr key={i}><th scope="row">{onOpen&&c.cardId?<button className="text-button" onClick={()=>onOpen(c.cardId!)}>{c.code}</button>:c.code}</th><td>{c.field}</td><td><s>{cut(c.before)}</s> → <b>{cut(c.after)}</b></td></tr>)}</tbody></table></div>;}
