// Finanças: categorias, formas de pagamento e as contas do mês (painel, orçamento, relatórios, CSV e avisos de teto).
// Puro e sem o core: o core usa este arquivo para validar e reexporta o formatMoney.
import type {Item} from './types.ts';
export function formatMoney(cents:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);}
export type CategoryKind='expense'|'income';
export type Category={name:string;kind:CategoryKind;icon:string;color:string};
export const CATEGORIES:Category[]=[
 {name:'Moradia',kind:'expense',icon:'home',color:'#315e4d'},{name:'Alimentação',kind:'expense',icon:'utensils',color:'#d5aa72'},{name:'Mercado',kind:'expense',icon:'cart',color:'#a77b61'},
 {name:'Transporte',kind:'expense',icon:'car',color:'#647982'},{name:'Saúde',kind:'expense',icon:'heart',color:'#b5655b'},{name:'Educação',kind:'expense',icon:'graduation',color:'#6f8fa6'},
 {name:'Lazer',kind:'expense',icon:'clapperboard',color:'#8d7aa3'},{name:'Contas',kind:'expense',icon:'zap',color:'#c49a3c'},{name:'Compras',kind:'expense',icon:'bag',color:'#85a18a'},
 {name:'Assinaturas',kind:'expense',icon:'repeat',color:'#5f8a8b'},{name:'Outros',kind:'expense',icon:'ellipsis',color:'#9aa39b'},
 {name:'Salário',kind:'income',icon:'banknote',color:'#285442'},{name:'Renda extra',kind:'income',icon:'briefcase',color:'#7a9671'},{name:'Outras receitas',kind:'income',icon:'piggy',color:'#a7b38f'}];
export const EXPENSE_CATEGORIES=CATEGORIES.filter(c=>c.kind==='expense').map(c=>c.name);
export const INCOME_CATEGORIES=CATEGORIES.filter(c=>c.kind==='income').map(c=>c.name);
export const PAYMENTS=[['pix','PIX'],['debit','Débito'],['credit','Crédito'],['cash','Dinheiro'],['transfer','Transferência']] as const;
export const PAYMENT_LABEL:Record<string,string>=Object.fromEntries(PAYMENTS);
const OTHER=CATEGORIES.find(c=>c.name==='Outros') as Category;
// Categoria fora da lista (texto livre antigo) mantém o nome, com o ícone e a cor de Outros; vazia vira Outros.
export function categoryInfo(name?:string):Category&{known:boolean}{const n=typeof name==='string'&&name.trim()?name.trim():'Outros',c=CATEGORIES.find(x=>x.name===n);return c?{...c,known:true}:{name:n,kind:'expense',icon:OTHER.icon,color:OTHER.color,known:false};}
export type CapState='none'|'ok'|'near'|'over';
export const capState=(spent:number,cap:number):CapState=>!cap?'none':spent>cap?'over':spent>=cap*0.85?'near':'ok';
export const capPct=(spent:number,cap:number)=>cap?Math.round(spent/cap*100):0;
export function shiftYm(month:string,n:number){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1,12)).toISOString().slice(0,7);}
export type FinData={transactions:Item[];cards?:Item[];profile:{budget?:number;categoryBudgets?:Record<string,number>}};
export type CategoryRow={name:string;total:number;count:number;share:number;cap?:number;capPct?:number;state:CapState};
export type BudgetLine={name:string;spent:number;cap:number;pct:number;state:CapState};
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const inMonth=(x:Item,month:string)=>typeof x.date==='string'&&x.date.startsWith(month)&&Number.isFinite(x.amount);
const sumOf=(s:FinData,month:string,direction:'income'|'expense')=>s.transactions.filter(x=>x.direction===direction&&inMonth(x,month)).reduce((a,x)=>a+x.amount,0);
const daysIn=(month:string)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate();};
export function expenseByCategory(s:FinData,month:string):CategoryRow[]{const rows=s.transactions.filter(x=>x.direction==='expense'&&inMonth(x,month)),total=rows.reduce((a,x)=>a+x.amount,0),caps=s.profile.categoryBudgets||{},groups=new Map<string,{total:number;count:number}>();
 for(const x of rows){const n=categoryInfo(x.category).name,g=groups.get(n)||{total:0,count:0};g.total+=x.amount;g.count++;groups.set(n,g);}
 return [...groups].map(([name,g])=>{const cap=Object.hasOwn(caps,name)?caps[name]:0;return {name,total:g.total,count:g.count,share:total?g.total/total:0,...(cap?{cap,capPct:capPct(g.total,cap)}:{}),state:capState(g.total,cap)};}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));}
export function budgetView(s:FinData,month:string){const spentBy=new Map(expenseByCategory(s,month).map(c=>[c.name,c.total])),spent=sumOf(s,month,'expense'),cap=s.profile.budget||0,caps=s.profile.categoryBudgets||{};
 const categories:BudgetLine[]=EXPENSE_CATEGORIES.map(name=>{const g=spentBy.get(name)||0,c=Object.hasOwn(caps,name)?caps[name]:0;return {name,spent:g,cap:c,pct:capPct(g,c),state:capState(g,c)};});
 const capsSum=EXPENSE_CATEGORIES.reduce((a,n)=>a+(Object.hasOwn(caps,n)?caps[n]:0),0);
 return {month:{cap,spent,pct:capPct(spent,cap),state:capState(spent,cap)},categories,capsSum,capsOverMonth:cap>0&&capsSum>cap?capsSum-cap:0};}
export function trend(s:FinData,month:string,n=6){return Array.from({length:n},(_,i)=>{const m=shiftYm(month,i-n+1);return {month:m,income:sumOf(s,m,'income'),expense:sumOf(s,m,'expense')};});}
export type VsPrev={kind:'new'|'stable';prev:number}|{kind:'delta';pct:number;prev:number};
// Média diária: no mês corrente, até hoje; num mês passado, o mês inteiro; num mês futuro, não existe.
export function reportCards(s:FinData,month:string,today:string){const expense=sumOf(s,month,'expense'),prev=sumOf(s,shiftYm(month,-1),'expense'),cur=today.slice(0,7);
 const days=month===cur?Number(today.slice(8,10)):month<cur?daysIn(month):0,pct=prev?Math.round((expense-prev)/prev*100):0;
 const vsPrev:VsPrev=!prev?{kind:expense>0?'new':'stable',prev}:pct===0?{kind:'stable',prev}:{kind:'delta',pct,prev};
 const top=expenseByCategory(s,month)[0];
 return {expense,dailyAvg:days?Math.round(expense/days):null,vsPrev,top:top?{name:top.name,total:top.total}:null};}
export function insights(s:FinData,month:string,today:string){const out:string[]=[],future=month>today.slice(0,7),c=reportCards(s,month,today),prevMonth=shiftYm(month,-1),prevName=MONTHS[Number(prevMonth.slice(5))-1];
 if(!future&&c.vsPrev.kind==='delta'&&c.vsPrev.pct>=8)out.push('Suas saídas subiram '+c.vsPrev.pct+'% em relação a '+prevName+'.');
 if(!future&&c.vsPrev.kind==='delta'&&c.vsPrev.pct<=-8)out.push('Suas saídas caíram '+(-c.vsPrev.pct)+'% em relação a '+prevName+'.');
 const b=budgetView(s,month);
 if(b.month.state==='over')out.push('Você passou do teto do mês em '+formatMoney(b.month.spent-b.month.cap)+'.');else if(b.month.state==='near')out.push('Você já usou '+b.month.pct+'% do teto do mês.');
 for(const x of b.categories.filter(x=>x.state==='over').sort((x,y)=>(y.spent-y.cap)-(x.spent-x.cap)).slice(0,3))out.push(x.name+' passou do teto em '+formatMoney(x.spent-x.cap)+'.');
 const before=new Map(expenseByCategory(s,prevMonth).map(x=>[x.name,x.total]));
 const grew=expenseByCategory(s,month).slice(0,4).find(x=>{const p=before.get(x.name)||0;return p>0&&(x.total-p)/p>0.2;});
 if(grew){const p=before.get(grew.name) as number;out.push(grew.name+' cresceu '+Math.round((grew.total-p)/p*100)+'% em relação ao mês anterior.');}
 return out;}
export function topExpenses(s:FinData,month:string,n=5){return s.transactions.filter(x=>x.direction==='expense'&&inMonth(x,month)).sort((a,b)=>b.amount-a.amount||b.date.localeCompare(a.date)).slice(0,n);}
export type TxFilter={type?:'all'|'expense'|'income';category?:string;payment?:string;text?:string};
const fold=(t:string)=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// Pagamento: 'card' são os lançamentos de cartão; 'none' são os sem forma e sem cartão.
export function filterTransactions(list:Item[],f:TxFilter){const q=fold((f.text||'').trim());
 return list.filter(x=>(!f.type||f.type==='all'||x.direction===f.type)&&(!f.category||categoryInfo(x.category).name===f.category)
  &&(!f.payment||(f.payment==='card'?!!x.cardId:f.payment==='none'?!x.cardId&&!x.payment:(x.cardId?'credit':x.payment)===f.payment))
  &&(!q||fold([x.title,x.notes,x.category].filter(v=>typeof v==='string').join(' ')).includes(q))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));}
const csvCell=(v:string)=>/[;"\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
const plainMoney=(cents:number)=>(cents<0?'-':'')+(Math.abs(cents)/100).toFixed(2).replace('.',',');
export function transactionsCsv(s:FinData){const cards=new Map((s.cards||[]).map(c=>[c.id,c.title]));
 const rows=s.transactions.filter(x=>typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{const card=x.cardId?cards.get(x.cardId):undefined,pay=x.cardId?'Crédito'+(card?' ('+card+')':''):PAYMENT_LABEL[x.payment]||'';
  return [x.date.slice(8,10)+'/'+x.date.slice(5,7)+'/'+x.date.slice(0,4),x.direction==='income'?'Receita':'Despesa',categoryInfo(x.category).name,String(x.title||''),plainMoney(x.direction==='income'?x.amount:-x.amount),pay,String(x.notes||'')].map(csvCell).join(';');});
 return '\ufeff'+['Data;Tipo;Categoria;Descrição;Valor;Pagamento;Notas',...rows].join('\r\n');}
// Aviso ao confirmar sugestões: compara a situação dos tetos antes e depois das despesas novas; só avisa o que mudou.
export function budgetAlerts(s:FinData,items:{collection:string;item:Partial<Item>}[]){try{const added=items.filter(p=>p.collection==='transactions'&&p.item.direction==='expense'&&typeof p.item.amount==='number'&&p.item.amount>0&&typeof p.item.date==='string').map(p=>p.item as Item);
 const out:string[]=[];
 for(const m of [...new Set(added.map(x=>x.date.slice(0,7)))].sort()){const before=budgetView(s,m),after=budgetView({...s,transactions:[...s.transactions,...added.filter(x=>x.date.startsWith(m))]},m);
  const a=after.month;if(a.state!==before.month.state&&(a.state==='over'||a.state==='near'))out.push(a.state==='over'?'⚠️ Teto do mês: '+formatMoney(a.spent)+' de '+formatMoney(a.cap)+', passou do teto.':'⚠️ Você já usou '+a.pct+'% do teto do mês.');
  after.categories.forEach((c,i)=>{if(c.state!==before.categories[i].state&&(c.state==='over'||c.state==='near'))out.push(c.state==='over'?'⚠️ '+c.name+': '+formatMoney(c.spent)+' de '+formatMoney(c.cap)+', passou do teto.':'⚠️ '+c.name+' já usou '+c.pct+'% do teto.');});}
 return out.slice(0,3);}catch{return [];}}
