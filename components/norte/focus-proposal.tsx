'use client';
import {useMemo,useState} from 'react';import {Check,X,Sparkles,LoaderCircle} from 'lucide-react';
import {wordDiff,listDiff,type DiffPart} from '@/lib/text-diff';import {TEST_KIND_LABEL,type Card} from '@/lib/board';
// Revisão das propostas da IA: diff por palavra na descrição e por item nas listas; nada muda sem Aceitar.
function Words({parts}:{parts:DiffPart[]}){return <>{parts.map((p,i)=>p.op==='same'?<span key={i}>{p.text}</span>:p.op==='add'?<ins key={i}>{p.text}</ins>:<del key={i}>{p.text}</del>)}</>;}
function Items({parts}:{parts:DiffPart[]}){return parts.length?<ul className="fo-diff-list">{parts.map((p,i)=><li key={i} className={p.op}>{p.op==='add'?<ins>{p.text}</ins>:p.op==='del'?<del>{p.text}</del>:p.text}</li>)}</ul>:<p className="quiet-copy">Sem itens.</p>;}
function Decide({busy,disabled=false,onAccept,onReject}:{busy:boolean;disabled?:boolean;onAccept:()=>void;onReject:()=>void}){return <div className="fo-row-end"><button className="button ghost small" disabled={busy} onClick={onReject}><X size={15}/>Rejeitar</button><button className="button primary small" disabled={busy||disabled} onClick={onAccept}>{busy?<LoaderCircle size={15} className="spin"/>:<Check size={15}/>}Aceitar</button></div>;}
const Head=({text,instruction}:{text:string;instruction:string})=><p className="fo-proposal-head"><Sparkles size={15}/>{text}{instruction&&<small> · “{instruction}”</small>}</p>;
export function RefineReview({card,onDecide}:{card:Card;onDecide:(d:'accept'|'reject')=>Promise<void>}){const p=card.proposals.refine!;const [busy,setBusy]=useState(false);
 const words=useMemo(()=>wordDiff(card.description,p.description||card.description),[card.description,p.description]);const run=async(d:'accept'|'reject')=>{setBusy(true);await onDecide(d);setBusy(false);};
 return <div className="fo-proposal"><Head text="Proposta da IA" instruction={p.instruction}/><p className="quiet-copy">Revise as mudanças. Aceitar grava no card; rejeitar mantém o que está.</p>
  <div className="fo-diff"><Words parts={words}/></div><h4>Critérios de aceite</h4><Items parts={listDiff(card.acceptance,p.acceptance)}/><h4>Subtarefas</h4><Items parts={listDiff(card.subtasks.map(s=>s.title),p.subtasks)}/>
  <Decide busy={busy} onAccept={()=>run('accept')} onReject={()=>run('reject')}/></div>;}
export function TestsReview({card,onDecide}:{card:Card;onDecide:(d:'accept'|'reject',selected?:number[])=>Promise<void>}){const p=card.proposals.tests!;const [chosen,setChosen]=useState(()=>new Set(p.cases.map((_,i)=>i))),[busy,setBusy]=useState(false);
 const run=async(d:'accept'|'reject')=>{setBusy(true);await onDecide(d,d==='accept'?[...chosen].sort((x,y)=>x-y):undefined);setBusy(false);};
 return <div className="fo-proposal"><Head text={'Proposta da IA · '+p.cases.length+' casos'} instruction={p.instruction}/><p className="quiet-copy">Marque os casos que quer adicionar.</p>
  <ul className="fo-proposal-cases">{p.cases.map((c,i)=><li key={i}><label><input type="checkbox" checked={chosen.has(i)} onChange={()=>setChosen(s=>{const n=new Set(s);if(n.has(i))n.delete(i);else n.add(i);return n;})}/><span><b>{c.title}</b> <span className={'fo-kind '+c.kind}>{TEST_KIND_LABEL[c.kind]}</span><small>{c.steps.length} {c.steps.length===1?'passo':'passos'} · esperado: {c.expected}</small></span></label></li>)}</ul>
  <Decide busy={busy} disabled={!chosen.size} onAccept={()=>run('accept')} onReject={()=>run('reject')}/></div>;}
