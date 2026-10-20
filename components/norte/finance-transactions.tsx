'use client';
import {useState} from 'react';import {Plus,CreditCard} from 'lucide-react';
import {useApp} from './context';import {Empty} from './primitives';import {TxList} from './finance-ui';import type {FinanceProps} from './finance';
import {CATEGORIES,PAYMENTS,categoryInfo,filterTransactions,type TxFilter} from '@/lib/finance';
// Lançamentos do mês com filtros de tipo, categoria, forma de pagamento e busca.
const TYPES=[['all','Todos'],['expense','Despesas'],['income','Receitas']] as const;
export function FinanceTransactions({month,money}:FinanceProps){const a=useApp();const [type,setType]=useState<NonNullable<TxFilter['type']>>('all'),[category,setCategory]=useState(''),[payment,setPayment]=useState(''),[text,setText]=useState('');
 const monthRows=a.state.transactions.filter(x=>x.date?.startsWith(month)),rows=filterTransactions(monthRows,{type,category,payment,text}),out=rows.filter(x=>x.direction==='expense').reduce((s,x)=>s+x.amount,0);
 const legacy=[...new Set(monthRows.map(x=>categoryInfo(x.category)).filter(c=>!c.known).map(c=>c.name))];
 return <section className="panel"><header className="section-heading"><h2>{rows.length} no filtro · saídas {money(out)}</h2><div className="button-group"><button className="button primary small" onClick={()=>a.edit('transactions')}><Plus size={16}/>Novo lançamento</button><button className="button outline small" onClick={()=>a.edit('transactions',undefined,{date:month+'-01'},true)}><CreditCard size={16}/>Compra parcelada</button></div></header>
  <div className="fin-filters"><div className="fin-segment" role="group" aria-label="Tipo">{TYPES.map(([id,label])=><button key={id} className={type===id?'active':''} aria-pressed={type===id} onClick={()=>setType(id)}>{label}</button>)}</div>
   <select aria-label="Categoria" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas as categorias</option>{CATEGORIES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}{legacy.map(n=><option key={n} value={n}>{n}</option>)}</select>
   <select aria-label="Forma de pagamento" value={payment} onChange={e=>setPayment(e.target.value)}><option value="">Todas as formas</option>{PAYMENTS.map(([id,label])=><option key={id} value={id}>{label}</option>)}<option value="card">Cartão de crédito</option><option value="none">Não informada</option></select>
   <input type="search" aria-label="Buscar lançamentos" placeholder="Buscar" value={text} onChange={e=>setText(e.target.value)}/></div>
  {rows.length?<TxList rows={rows} money={money}/>:monthRows.length?<p className="quiet-copy padded">Nenhum lançamento com esses filtros.</p>:<Empty title="O mês ainda está em branco" description="Registre uma entrada ou despesa para entender seu dinheiro." action="Adicionar lançamento" onAction={()=>a.edit('transactions')}/>}</section>;}
