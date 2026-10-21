// Investimentos: tipos, movimentos e a carteira calculada pelo histórico (regras do GGFinance, com valores em centavos).
// Puro e sem o core: o core usa este arquivo para validar.
import type {Item} from './types.ts';
export type InvestMode='value'|'quantity';
export type InvestKind={id:string;label:string;group:string;mode:InvestMode;color:string};
export const INVEST_KINDS:InvestKind[]=[
 {id:'cdb',label:'CDB',group:'Renda fixa',mode:'value',color:'#315e4d'},{id:'tesouro',label:'Tesouro Direto',group:'Renda fixa',mode:'value',color:'#4f7a65'},{id:'lci_lca',label:'LCI / LCA',group:'Renda fixa',mode:'value',color:'#7a9671'},
 {id:'acao',label:'Ações',group:'Renda variável',mode:'quantity',color:'#6f8fa6'},{id:'fii',label:'FIIs',group:'Renda variável',mode:'quantity',color:'#c49a3c'},{id:'etf',label:'ETFs',group:'Renda variável',mode:'quantity',color:'#8d7aa3'},
 {id:'cripto',label:'Cripto',group:'Renda variável',mode:'quantity',color:'#b5655b'},{id:'fundo',label:'Fundos',group:'Outros',mode:'value',color:'#a77b61'},{id:'outro',label:'Outros',group:'Outros',mode:'value',color:'#9aa39b'}];
export const FIXED_INCOME=['cdb','tesouro','lci_lca'];
export const INDEXERS=[['none','Sem indexador'],['cdi','% do CDI'],['selic','% da Selic'],['ipca','IPCA +'],['pre','Prefixado % a.a.']] as const;
export const MOVES=['buy','sell','dividend','yield','interest','valuation'] as const;
export const INCOME_MOVES=['dividend','yield','interest'];
// Título salvo quando o movimento não tem um, e as opções do formulário (que serve aos dois modos).
export const MOVE_TITLE:Record<string,string>={buy:'Compra',sell:'Venda',dividend:'Dividendo',yield:'Rendimento',interest:'Juros',valuation:'Cotação'};
export const MOVE_OPTIONS:string[][]=[['buy','Compra / aplicação'],['sell','Venda / resgate'],['dividend','Dividendo'],['yield','Rendimento'],['interest','Juros'],['valuation','Cotação / valor atual']];
export const kindInfo=(kind?:string)=>INVEST_KINDS.find(k=>k.id===kind)||INVEST_KINDS[INVEST_KINDS.length-1];
export const modeOf=(kind?:string)=>kindInfo(kind).mode;
// No modo valor, compra é aplicação, venda é resgate e a cotação é o valor atual.
export function moveLabel(move:string,kind?:string){const v=modeOf(kind)==='value';return move==='buy'?(v?'Aplicação':'Compra'):move==='sell'?(v?'Resgate':'Venda'):move==='valuation'?(v?'Valor atual':'Cotação'):MOVE_TITLE[move]||'Movimento';}
export function moveProblem(e:{move?:string;quantity?:number;price?:number;amount?:number},kind?:string):string|null{const q=modeOf(kind)==='quantity';
 if(e.move==='buy'||e.move==='sell')return q&&!(Number(e.quantity)>0)?'Informe a quantidade':!(Number(e.amount)>0)?'Informe o valor':null;
 if(e.move==='valuation')return q?(Number(e.price)>0?null:'Informe a cotação'):(Number(e.amount)>0?null:'Informe o valor atual');
 return Number(e.amount)>0?null:'Informe o valor do provento';}
export const monthEnd=(m:string)=>m+'-'+String(new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).getUTCDate()).padStart(2,'0');
export type Position={asset:Item;mode:InvestMode;quantity:number;avgPrice:number;invested:number;value:number;lastPrice:number;priceDate:string|null;unrealized:number;realized:number;income:number;pnl:number;pct:number;closed:boolean};
const pctOf=(part:number,base:number)=>base>0?Math.round(part/base*1000)/10:0;
// Movimentos do ativo até a data: por data e, no mesmo dia, na ordem em que foram salvos.
function movesOf(assetId:string,events:Item[],until?:string){return events.map((e,i)=>({e,i})).filter(({e})=>e.assetId===assetId&&typeof e.date==='string'&&(!until||e.date<=until)).sort((a,b)=>a.e.date.localeCompare(b.e.date)||a.i-b.i).map(({e})=>e);}
export function position(asset:Item,events:Item[],until?:string):Position{
 const mode=modeOf(asset.kind);let qty=0,cost=0,held=0,realized=0,income=0,price=0,priceDate:string|null=null,bought=false;
 // Encerrado: já teve compra e zerou. Ativo só com proventos ou cotação não é encerrado.
 for(const e of movesOf(asset.id,events,until)){if(e.move==='buy')bought=true;const amount=Number(e.amount)||0,q=Number(e.quantity)||0,p=Number(e.price)||0;
  if(INCOME_MOVES.includes(e.move)){income+=amount;continue;}
  if(mode==='quantity'){
   if(e.move==='buy'&&q>0){qty+=q;cost+=amount;price=p||amount/q;priceDate=e.date;}
   // Venda maior que a posição só leva o que existe: o core impede ao salvar, e aqui é defesa para dados antigos.
   else if(e.move==='sell'&&q>0){const take=Math.min(q,qty),sold=qty>0?cost/qty*take:0;cost=Math.max(0,cost-sold);qty=Math.max(0,qty-take);realized+=amount-sold;price=p||amount/q;priceDate=e.date;}
   else if(e.move==='valuation'&&p>0){price=p;priceDate=e.date;}
  }else{
   if(e.move==='buy'){cost+=amount;held+=amount;}
   // Resgate parcial: o custo cai na mesma proporção do valor resgatado.
   else if(e.move==='sell'){const share=held>0?Math.min(1,amount/held):1,sold=cost*share;realized+=amount-sold;cost-=sold;held=Math.max(0,held-amount);}
   else if(e.move==='valuation'&&amount>0){held=amount;priceDate=e.date;}
  }}
 qty=Math.round(qty*1e8)/1e8;const invested=Math.round(cost),value=mode==='quantity'?(qty>0?Math.round(qty*price):0):Math.round(held),unrealized=value-invested,r=Math.round(realized),inc=Math.round(income);
 return {asset,mode,quantity:qty,avgPrice:qty>0?cost/qty:0,invested,value,lastPrice:price,priceDate,unrealized,realized:r,income:inc,pnl:unrealized+r+inc,pct:pctOf(unrealized,invested),closed:bought&&value===0&&invested===0};}
export function positions(assets:Item[],events:Item[],until?:string){return assets.map(a=>position(a,events,until)).sort((x,y)=>Number(x.closed)-Number(y.closed)||y.value-x.value||String(x.asset.title).localeCompare(String(y.asset.title)));}
export function portfolio(list:Position[]){const sum=(k:'invested'|'value'|'realized'|'income')=>list.reduce((s,p)=>s+p[k],0),invested=sum('invested'),value=sum('value'),realized=sum('realized'),income=sum('income'),unrealized=value-invested;
 const allocation=INVEST_KINDS.map(k=>({kind:k.id,label:k.label,color:k.color,value:list.filter(p=>kindInfo(p.asset.kind).id===k.id).reduce((s,p)=>s+p.value,0)})).filter(x=>x.value>0).map(x=>({...x,share:x.value/value}));
 return {invested,value,unrealized,realized,income,pnl:unrealized+realized+income,pct:pctOf(unrealized,invested),count:list.filter(p=>!p.closed).length,allocation};}
export function incomeInYear(events:Item[],year:string,until?:string){return events.filter(e=>INCOME_MOVES.includes(e.move)&&typeof e.date==='string'&&e.date.startsWith(year)&&(!until||e.date<=until)).reduce((s,e)=>s+(Number(e.amount)||0),0);}
const br=(n:number,digits=2)=>n.toLocaleString('pt-BR',{maximumFractionDigits:digits});
export function formatRate(a:{indexer?:string;rate?:number}){const n=Number(a.rate)||0;if(!a.indexer||a.indexer==='none'||n<=0)return '';return a.indexer==='cdi'?br(n)+'% do CDI':a.indexer==='selic'?br(n)+'% da Selic':a.indexer==='ipca'?'IPCA + '+br(n)+'%':br(n)+'% a.a.';}
export const formatQty=(n:number)=>br(n,8);
// Cotação abaixo de R$ 1 (cripto) mostra até 6 casas; as outras, 2.
export function formatPrice(cents:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:cents<100?6:2}).format(cents/100);}
export function priceToCents(input:string|number){const raw=String(input).trim().replace(/R\$\s*/g,'');const value=raw.includes(',')?Number(raw.replace(/\./g,'').replace(',','.')):/^[1-9]\d{0,2}(\.\d{3})+$/.test(raw)?Number(raw.replace(/\./g,'')):Number(raw);if(!raw||!Number.isFinite(value)||value<=0||value>1e9)throw new Error('Informe uma cotação válida');return Math.round(value*1e6)/1e4;}
