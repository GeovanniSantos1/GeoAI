'use client';
import {Home,UtensilsCrossed,ShoppingCart,Car,HeartPulse,GraduationCap,Clapperboard,Zap,ShoppingBag,Repeat,Ellipsis,Banknote,Briefcase,PiggyBank,type LucideIcon} from 'lucide-react';
import {useApp} from './context';import {RecordActions} from './primitives';
import {categoryInfo,PAYMENT_LABEL,type CategoryRow} from '@/lib/finance';import type {Item} from '@/lib/types';
// Peças comuns das abas de Finanças: ícone da categoria, barras por categoria, gráfico de barras em CSS e a lista de lançamentos.
const ICONS:Record<string,LucideIcon>={home:Home,utensils:UtensilsCrossed,cart:ShoppingCart,car:Car,heart:HeartPulse,graduation:GraduationCap,clapperboard:Clapperboard,zap:Zap,bag:ShoppingBag,repeat:Repeat,ellipsis:Ellipsis,banknote:Banknote,briefcase:Briefcase,piggy:PiggyBank};
export type Money=(cents:number)=>string;
export const shortMonth=(m:string)=>new Date(m+'-15T12:00:00Z').toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'}).replace('.','');
export function CategoryIcon({name,size=16}:{name?:string;size?:number}){const c=categoryInfo(name),Icon=ICONS[c.icon]||Ellipsis;return <span className="fin-cat-icon" style={{color:c.color,background:c.color+'1f'}} aria-hidden="true"><Icon size={size}/></span>;}
export function CategoryBars({rows,money}:{rows:CategoryRow[];money:Money}){return <ul className="fin-bars">{rows.map(r=>{const c=categoryInfo(r.name),share=Math.round(r.share*100);return <li key={r.name}><CategoryIcon name={r.name}/><div>
 <p><span>{r.name}</span><b>{money(r.total)}</b></p><span className="fin-bar"><i className={r.state==='over'?undefined:'cat'} style={{width:Math.max(2,share)+'%',background:r.state==='over'?'var(--danger)':c.color}}/></span>
 <small>{share}% das saídas{r.cap?' · '+r.capPct+'% do teto ('+money(r.cap)+')':''}</small></div></li>;})}</ul>;}
// Barras proporcionais ao maior valor do gráfico; o valor exato fica no title de cada barra.
export function BarChart({groups,money,legend}:{groups:{label:string;values:{name:string;value:number;color:string}[]}[];money:Money;legend?:{name:string;color:string}[]}){const max=Math.max(1,...groups.flatMap(g=>g.values.map(v=>v.value)));
 return <div className="fin-chart">{legend&&<ul className="fin-legend">{legend.map(l=><li key={l.name}><i style={{background:l.color}}/>{l.name}</li>)}</ul>}<div className="fin-chart-bars">{groups.map(g=><div className="fin-chart-group" key={g.label}><div className="fin-chart-cols">
  {g.values.map(v=><span key={v.name} className="fin-chart-col" title={v.name+' · '+g.label+': '+money(v.value)} style={{height:Math.round(v.value/max*100)+'%',background:v.color}}/>)}</div><small>{g.label}</small></div>)}</div></div>;}
export function TxList({rows,money}:{rows:Item[];money:Money}){const a=useApp();const cards=new Map(a.state.cards.map(c=>[c.id,c.title]));
 return <div className="ledger"><div className="ledger-header"><span>Lançamento</span><span>Categoria</span><span>Data</span><span>Valor</span><span/></div>{rows.map(x=>{const meta=x.cardId?cards.get(x.cardId)||'Cartão':PAYMENT_LABEL[x.payment]||'Conta pessoal';
  return <div className="ledger-row" key={x.id}><span className="ledger-title"><CategoryIcon name={x.category} size={17}/><button onClick={()=>a.edit('transactions',x)}>{x.title}<small>{meta}</small></button></span><span className="pill">{categoryInfo(x.category).name}</span>
   <time>{String(x.date||'').slice(8)}/{String(x.date||'').slice(5,7)}</time><strong className={x.direction==='income'?'positive':''}>{x.direction==='income'?'+':'−'} {money(x.amount)}</strong><RecordActions item={x} onEdit={()=>a.edit('transactions',x)} onDelete={()=>a.remove('transactions',x)}/></div>;})}</div>;}
