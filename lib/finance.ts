// Finanças: categorias, formas de pagamento e as contas do mês (painel, orçamento, relatórios, CSV e avisos de teto).
// Puro e sem o core: o core usa este arquivo para validar e reexporta o formatMoney.
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
