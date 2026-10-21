'use client';
import type {ReactNode} from 'react';import {PRIORITY_LABEL,AREA_LABEL,type Priority,type Area,type Change} from '@/lib/board';
// Peças comuns do Foco: selos, anel do timer, tabela de mudanças e formatos de data e tempo.
export const ddmm=(d:string|null|undefined)=>d?d.slice(8,10)+'/'+d.slice(5,7):'';
export const ddmmyyyy=(d:string|null|undefined)=>d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'—';
export const clock=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',','');
export const mmss=(s:number)=>String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')+':'+String(Math.max(0,s)%60).padStart(2,'0');
export function PriorityBadge({p}:{p:Priority}){return <span className={'fo-prio '+p}>{PRIORITY_LABEL[p]}</span>;}
export function AreaChip({a}:{a:Area}){return <span className="fo-area">{AREA_LABEL[a]}</span>;}
export function Ring({fraction,size=280,stroke=5,tone='var(--fo-tomato)',children}:{fraction:number;size?:number;stroke?:number;tone?:string;children?:ReactNode}){const r=size/2-stroke-2,c=2*Math.PI*r,f=Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0)),mid=size/2;
 return <div className="fo-ring" style={{width:size,height:size}}><svg viewBox={'0 0 '+size+' '+size} aria-hidden="true"><circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--border)" strokeWidth={Math.max(2,stroke-2)}/><circle cx={mid} cy={mid} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={f*c+' '+c} transform={'rotate(-90 '+mid+' '+mid+')'}/></svg>{children&&<div className="fo-ring-label">{children}</div>}</div>;}
const cut=(v:string)=>!v?'—':v.length>120?v.slice(0,120)+'…':v;
export function ChangesTable({changes,onOpen}:{changes:Change[];onOpen?:(cardId:string)=>void}){return <div className="fo-changes-wrap"><table className="fo-changes"><tbody>{changes.map((c,i)=><tr key={i}><th scope="row">{onOpen&&c.cardId?<button className="text-button" onClick={()=>onOpen(c.cardId!)}>{c.code}</button>:c.code}</th><td>{c.field}</td><td><s>{cut(c.before)}</s> → <b>{cut(c.after)}</b></td></tr>)}</tbody></table></div>;}
