'use client';
import {useRef} from 'react';import {useApp} from './context';import {CategoryIcon} from './finance-ui';import type {FinanceProps} from './finance';
import {moneyToCents} from '@/lib/core';import {budgetView,categoryInfo,type CapState} from '@/lib/finance';
// Orçamento: teto do mês e tetos por categoria, salvos ao sair do campo; os tetos valem para todos os meses.
const MONTH_LABEL:Record<CapState,string>={none:'Sem teto',ok:'Dentro do teto',near:'Perto do teto',over:'Acima do teto'};
const PILL:Record<CapState,string>={none:'pill',ok:'pill green',near:'pill warn',over:'pill danger'};
function CapBar({pct,over,color,cat}:{pct:number;over:boolean;color:string;cat?:boolean}){return <span className="fin-bar"><i className={cat&&!over?'cat':undefined} style={{width:Math.min(100,pct)+'%',background:over?'var(--danger)':color}}/></span>;}
// Campo de teto: vazio ou zero vira "sem teto"; texto inválido avisa e volta ao valor salvo.
function CapInput({label,cents,hidden,onSave}:{label:string;cents:number;hidden:boolean;onSave:(c:number)=>Promise<boolean>}){const a=useApp();const shown=cents?(cents/100).toFixed(2).replace('.',','):'';
 if(hidden)return <label className="fin-money"><span>Teto</span><input aria-label={label} value="•••••" readOnly/></label>;
 return <label className="fin-money"><span>Teto</span><input key={cents} aria-label={label} defaultValue={shown} inputMode="decimal" placeholder="Sem teto" onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}
  onBlur={async e=>{const input=e.currentTarget,raw=input.value.trim();let next:number;try{next=raw?moneyToCents(raw):0;}catch{a.toast('Informe um valor válido.',true);input.value=shown;return;}if(next===cents)return;if(!await onSave(next))input.value=shown;}}/></label>;}
export function FinanceBudget({month,money,hidden}:FinanceProps){const a=useApp();const b=budgetView(a.state,month),m=b.month;
 // Fila: cada salvamento espera o anterior, para a resposta do servidor mais antiga não sobrescrever a mais nova.
 const queue=useRef<Promise<unknown>>(Promise.resolve());
 const save=(profile:Record<string,unknown>)=>{const run=queue.current.then(()=>a.mutate({type:'profile',profile}));queue.current=run.catch(()=>{});return run;};
 return <><section className="panel"><header className="section-heading"><h2>Teto do mês</h2><span className={PILL[m.state]}>{MONTH_LABEL[m.state]}</span></header>
  <div className="fin-budget-body"><CapInput label="Teto do mês" hidden={hidden} cents={m.cap} onSave={c=>save({budget:c})}/><p>Gasto até agora: <b>{money(m.spent)}</b>{m.cap?' · '+m.pct+'% do teto':''}</p><CapBar pct={m.pct} over={m.state==='over'} color="var(--green)"/></div></section>
  <section className="panel"><header className="section-heading"><h2>Categorias</h2><span className="fin-sum">Soma {money(b.capsSum)}</span></header>
   {b.capsOverMonth>0&&<p className="fin-warning">A soma dos tetos por categoria passa do teto do mês em {money(b.capsOverMonth)}.</p>}
   <ul className="fin-budget-list">{b.categories.map(c=><li key={c.name}><CategoryIcon name={c.name}/><div><p><b>{c.name}</b>{c.state==='over'&&<span className="pill danger">Estouro</span>}{c.state==='near'&&<span className="pill warn">Perto</span>}</p>
    <small>{money(c.spent)}{c.cap?' de '+money(c.cap):' · sem teto'}</small><CapBar cat pct={c.pct} over={c.state==='over'} color={categoryInfo(c.name).color}/></div>
    <CapInput label={'Teto de '+c.name} hidden={hidden} cents={c.cap} onSave={v=>save({categoryBudgets:{[c.name]:v}})}/></li>)}</ul></section></>;}
