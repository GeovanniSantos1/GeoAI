'use client';
import {useState} from 'react';import {ChevronLeft,ChevronRight} from 'lucide-react';
import {useApp} from './context';import {PageHeading,Tabs} from './primitives';import {formatMoney,shiftYm} from '@/lib/finance';
import {FinanceOverview} from './finance-overview';import {FinanceTransactions} from './finance-transactions';import {FinanceBudget} from './finance-budget';import {FinanceReports} from './finance-reports';import {FinanceBills,FinanceCards} from './finance-accounts';
// Moldura de Finanças: título, seletor de mês e abas; cada aba mora no próprio arquivo.
export type FinanceTab='overview'|'transactions'|'budget'|'reports'|'bills'|'cards';
export type FinanceProps={month:string;money:(cents:number)=>string;hidden:boolean;setHidden:(v:boolean)=>void;goTo:(t:FinanceTab)=>void};
const TABS:{id:FinanceTab;label:string}[]=[{id:'overview',label:'Visão geral'},{id:'transactions',label:'Lançamentos'},{id:'budget',label:'Orçamento'},{id:'reports',label:'Relatórios'},{id:'bills',label:'Contas fixas'},{id:'cards',label:'Cartões & parcelas'}];
export function FinanceView(){const a=useApp();const [tab,setTab]=useState<FinanceTab>('overview'),[month,setMonth]=useState(a.today.slice(0,7)),[hidden,setHidden]=useState(false);
 const p:FinanceProps={month,money:v=>hidden?'•••••':formatMoney(v),hidden,setHidden,goTo:setTab};
 return <><PageHeading eyebrow="CLAREZA PARA ESCOLHER MELHOR" title="Seu dinheiro, com direção" description="Organize o presente. Abra espaço para os seus planos." action="Novo lançamento" onAction={()=>a.edit('transactions')}/>
  <div className="toolbar"><Tabs value={tab} onChange={t=>setTab(t as FinanceTab)} items={TABS}/><div className="month-switch"><button className="icon-button" aria-label="Mês anterior" onClick={()=>setMonth(shiftYm(month,-1))}><ChevronLeft size={17}/></button><b>{new Date(month+'-15T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})}</b><button className="icon-button" aria-label="Próximo mês" onClick={()=>setMonth(shiftYm(month,1))}><ChevronRight size={17}/></button></div></div>
  {tab==='overview'&&<FinanceOverview {...p}/>}{tab==='transactions'&&<FinanceTransactions {...p}/>}{tab==='budget'&&<FinanceBudget {...p}/>}{tab==='reports'&&<FinanceReports {...p}/>}{tab==='bills'&&<FinanceBills {...p}/>}{tab==='cards'&&<FinanceCards {...p}/>}</>;}
