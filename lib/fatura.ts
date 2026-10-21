// Fatura de cartão: o texto (lido do PDF no aparelho, ou devolvido pela IA) vira linhas de lançamento
// com categoria, parcela, estorno e o aviso de já lançado. Puro: não lê o PDF nem grava nada.
import type {Item} from './types.ts';
import {EXPENSE_CATEGORIES} from './finance.ts';
export type FaturaLine={date:string;description:string;amount:number};
export type FaturaMeta={issuer:string;closingDate:string|null;dueDate:string|null;total:number|null};
export type FaturaRow={key:string;date:string;title:string;amount:number;direction:'expense'|'income';category:string;notes:string;installment:string|null;refund:boolean;duplicate:boolean;reason:string|null;selected:boolean};
export type FaturaResult=FaturaMeta&{rows:FaturaRow[];sum:number;mismatch:boolean;truncated:boolean};
export type FaturaCtx={transactions:Item[];today:string};
const MAX_ROWS=250;
const fold=(t:string)=>t.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const iso=(d:number,m:number,y:number)=>{const v=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'),t=new Date(v+'T12:00:00Z');return Number.isFinite(t.getTime())&&t.toISOString().slice(0,10)===v?v:null;};
const isIso=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&iso(Number(v.slice(8)),Number(v.slice(5,7)),Number(v.slice(0,4)))===v;
const MONTHS:Record<string,number>={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
const AMOUNT='(-\\s?)?(?:R\\$\\s?)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2})(\\s?-)?';
const SLASH=new RegExp('^(\\d{2})/(\\d{2})(?:/(\\d{4}|\\d{2}))?\\s+(.+?)\\s+'+AMOUNT+'$');
const NAMED=new RegExp('^(\\d{2})\\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\\.?\\s+(.+?)\\s+'+AMOUNT+'$','i');
const cents=(digits:string,negative:boolean)=>(negative?-1:1)*Number(digits.replace(/\./g,'').replace(',',''));
// Emissor: o que aparece primeiro no texto (o cabeçalho vem antes das compras, que podem citar outros bancos).
const ISSUERS:[RegExp,string][]=[[/picpay/i,'PicPay'],[/nubank|nu pagamentos/i,'Nubank'],[/banco inter\b/i,'Inter'],[/c6\s*bank/i,'C6 Bank'],[/ita[uú]/i,'Itaú'],[/bradesco/i,'Bradesco'],[/santander/i,'Santander'],[/caixa econ[oô]mica|cart[aã]o caixa/i,'Caixa'],[/banco do brasil|ourocard/i,'Banco do Brasil'],[/mercado pago/i,'Mercado Pago'],[/\bxp (?:investimentos|visa|card)/i,'XP']];
function issuerOf(text:string){let best='Cartão',at=Infinity;for(const [re,name] of ISSUERS){const m=re.exec(text);if(m&&m.index<at){at=m.index;best=name;}}return best;}
function labeledDate(text:string,label:string){const m=text.match(new RegExp(label+'[^\\d\\n]{0,40}?(\\d{2})[/.-](\\d{2})[/.-](\\d{4})','i'));return m?iso(Number(m[1]),Number(m[2]),Number(m[3])):null;}
const TOTALS=['total\\s+da\\s+fatura','total\\s+geral\\s+dos\\s+lan[cç]amentos','valor\\s+total','total\\s+a\\s+pagar','despesas\\s+do\\s+m[eê]s'];
function totalOf(text:string){for(const label of TOTALS){const m=text.match(new RegExp(label+'[^\\d\\n-]{0,30}?(-\\s?)?(?:R\\$\\s?)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2})','i'));if(m)return cents(m[2],!!m[1]);}return null;}
export function readFatura(text:string,today:string):{meta:FaturaMeta;lines:FaturaLine[]}{
 const pipe=text.match(/(\d{2})-(\d{2})-(\d{4})\s*\|\s*(\d{2})-(\d{2})-(\d{4})/);
 let dueDate=labeledDate(text,'vencimento'),closingDate=labeledDate(text,'fechamento');
 if(pipe){dueDate??=iso(Number(pipe[1]),Number(pipe[2]),Number(pipe[3]));closingDate??=iso(Number(pipe[4]),Number(pipe[5]),Number(pipe[6]));}
 const meta:FaturaMeta={issuer:issuerOf(text),closingDate,dueDate,total:totalOf(text)};
 // Sem ano na linha: meses depois do fechamento (ou do vencimento, ou de hoje) são do ano anterior.
 const ref=closingDate||dueDate||today,refY=Number(ref.slice(0,4)),refM=Number(ref.slice(5,7)),lines:FaturaLine[]=[];
 for(const raw of text.split(/\r?\n/)){const line=raw.replace(/\s+/g,' ').trim(),a=line.match(SLASH),b=a?null:line.match(NAMED);
  let d:number,m:number,y:number|undefined,desc:string,neg:boolean,digits:string;
  if(a){d=Number(a[1]);m=Number(a[2]);y=a[3]?(a[3].length===2?2000+Number(a[3]):Number(a[3])):undefined;desc=a[4];neg=!!a[5]||!!a[7];digits=a[6];}
  else if(b){d=Number(b[1]);m=MONTHS[b[2].toLowerCase()];y=undefined;desc=b[3];neg=!!b[4]||!!b[6];digits=b[5];}
  else continue;
  const date=iso(d,m,y??(m>refM?refY-1:refY));if(date)lines.push({date,description:desc.trim(),amount:cents(digits,neg)});}
 return {meta,lines};}
const SKIP=/pagamento (de|da) fatura|pagamento recebido|pagamento efetuado|fatura anterior|saldo anterior|subtotal|total (geral|da fatura|dos lancamentos|a pagar)|creditos e estornos|limite disponivel/;
const CHARGE=/\b(encargos?|iof|juros|multa|anuidade)\b/;
// Lojas conhecidas: a primeira que aparecer no título, sempre como palavra inteira (aceita plural), define categoria e nome.
const STORES:[string,string,string?][]=[
 ['amazon prime','Assinaturas','Amazon Prime'],['prime video','Assinaturas','Prime Video'],['99food','Alimentação','99Food'],['mercado livre','Compras','Mercado Livre'],['mercadolivre','Compras','Mercado Livre'],['mercado pago','Outros'],['mercadopago','Outros'],
 ['uber','Transporte','Uber'],['99','Transporte','99'],['cabify','Transporte','Cabify'],['posto','Transporte'],['shell','Transporte','Shell'],['ipiranga','Transporte','Ipiranga'],['petrobras','Transporte','Petrobras'],['br mania','Transporte','BR Mania'],['estacionamento','Transporte'],['sem parar','Transporte','Sem Parar'],['conectcar','Transporte','ConectCar'],['veloe','Transporte','Veloe'],['bhbus','Transporte','BHBus'],['transfacil','Transporte','Transfácil'],['metro','Transporte'],
 ['ifood','Alimentação','iFood'],['rappi','Alimentação','Rappi'],['restaurante','Alimentação'],['lanchonete','Alimentação'],['padaria','Alimentação'],['pizzaria','Alimentação'],['hamburgueria','Alimentação'],['acai','Alimentação'],['cafe','Alimentação'],['starbucks','Alimentação','Starbucks'],['mcdonalds','Alimentação',"McDonald's"],['burger king','Alimentação','Burger King'],['kfc','Alimentação','KFC'],['subway','Alimentação','Subway'],['outback','Alimentação','Outback'],
 ['supermercado','Mercado'],['mercado','Mercado'],['atacadao','Mercado','Atacadão'],['assai','Mercado','Assaí'],['carrefour','Mercado','Carrefour'],['pao de acucar','Mercado','Pão de Açúcar'],['extra','Mercado'],['super nosso','Mercado','Super Nosso'],['hortifruti','Mercado','Hortifruti'],['sacolao','Mercado'],['verdemar','Mercado','Verdemar'],
 ['farmacia','Saúde'],['drogaria','Saúde'],['droga raia','Saúde','Droga Raia'],['drogasil','Saúde','Drogasil'],['pague menos','Saúde','Pague Menos'],['araujo','Saúde','Drogaria Araujo'],['panvel','Saúde','Panvel'],['laboratorio','Saúde'],['clinica','Saúde'],['hospital','Saúde'],['odonto','Saúde'],
 ['amazon','Compras','Amazon'],['shopee','Compras','Shopee'],['shein','Compras','Shein'],['aliexpress','Compras','AliExpress'],['magalu','Compras','Magalu'],['magazine luiza','Compras','Magazine Luiza'],['americanas','Compras','Americanas'],['casas bahia','Compras','Casas Bahia'],['centauro','Compras','Centauro'],['renner','Compras','Renner'],['riachuelo','Compras','Riachuelo'],['c&a','Compras','C&A'],['zara','Compras','Zara'],['tiktok','Compras','TikTok Shop'],
 ['netflix','Assinaturas','Netflix'],['spotify','Assinaturas','Spotify'],['disney','Assinaturas','Disney+'],['hbo','Assinaturas','HBO Max'],['max','Assinaturas','Max'],['youtube','Assinaturas','YouTube'],['google one','Assinaturas','Google One'],['icloud','Assinaturas','iCloud'],['apple.com','Assinaturas','Apple'],['deezer','Assinaturas','Deezer'],['globoplay','Assinaturas','Globoplay'],['paramount','Assinaturas','Paramount+'],['chatgpt','Assinaturas','ChatGPT'],['openai','Assinaturas','OpenAI'],
 ['claro','Contas','Claro'],['vivo','Contas','Vivo'],['tim','Contas','TIM'],['oi','Contas','Oi'],['cemig','Contas','Cemig'],['enel','Contas','Enel'],['copel','Contas','Copel'],['sabesp','Contas','Sabesp'],['copasa','Contas','Copasa'],['light','Contas','Light'],['energia','Contas'],['internet','Contas'],['net virtua','Contas','NET'],
 ['cinema','Lazer'],['ingresso','Lazer'],['sympla','Lazer','Sympla'],['eventim','Lazer','Eventim'],['steam','Lazer','Steam'],['playstation','Lazer','PlayStation'],['xbox','Lazer','Xbox'],['nintendo','Lazer','Nintendo'],['bar','Lazer'],['festa','Lazer'],
 ['udemy','Educação','Udemy'],['alura','Educação','Alura'],['coursera','Educação','Coursera'],['escola','Educação'],['faculdade','Educação'],['curso','Educação'],['livraria','Educação']];
function storeOf(t:string){for(const [term,category,name] of STORES)if(new RegExp('(^|[^a-z0-9])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'s?($|[^a-z0-9])').test(t))return {category,name};return null;}
// Primeira palavra sempre com maiúscula; depois, só os conectivos ficam minúsculos ("Bar do Ze", "Estorno X").
const CONNECTORS=new Set(['a','e','o','as','os','da','de','do','das','dos','em','na','no','nas','nos','com']);
const titleCase=(s:string)=>s.toLowerCase().split(' ').filter(Boolean).map((w,i)=>i>0&&CONNECTORS.has(w)?w:w[0].toUpperCase()+w.slice(1)).join(' ');
const cleanName=(desc:string)=>titleCase(desc.replace(/\*/g,' ').replace(/\s+/g,' ').trim().replace(/^(dl|ebn|mp|pag|pg|ec)\s+/i,'')).slice(0,120);
// Parcela: "PARC 3/10" ou "PARCELA 3/10" em qualquer ponto, ou "3/10" no fim; o trecho sai do título.
function splitInstallment(desc:string){const m=desc.match(/\bparc(?:ela)?\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/i)||desc.match(/\s(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
 if(m){const k=Number(m[1]),n=Number(m[2]),at=m.index||0;if(k>=1&&k<=n&&n<=48)return {k,n,rest:(desc.slice(0,at)+' '+desc.slice(at+m[0].length)).trim()};}return {k:0,n:0,rest:desc};}
export function faturaFromLines(lines:FaturaLine[],meta:FaturaMeta,ctx:FaturaCtx):FaturaResult{
 // Já lançado conta por ocorrência: duas linhas iguais contra um lançamento salvo marcam só uma.
 const fp=(date:string,amount:number,direction:string,title:string)=>date+'|'+amount+'|'+direction+'|'+fold(title).slice(0,48);
 const left=new Map<string,number>(),usedParts=new Set<string>(),history=new Map<string,{date:string;category:string}>();
 for(const x of ctx.transactions){if(typeof x.title!=='string'||typeof x.date!=='string')continue;const k=fp(x.date,x.amount,x.direction,x.title);left.set(k,(left.get(k)||0)+1);
  if(x.direction==='expense'&&EXPENSE_CATEGORIES.includes(x.category)){const h=history.get(fold(x.title));if(!h||x.date>h.date)history.set(fold(x.title),{date:x.date,category:x.category});}}
 const valid=lines.filter(l=>isIso(l.date)&&Number.isSafeInteger(l.amount)&&l.amount!==0&&typeof l.description==='string'&&!SKIP.test(fold(l.description)));
 const rows=valid.slice(0,MAX_ROWS).map((l,i):FaturaRow=>{
  const parc=splitInstallment(l.description),base=cleanName(parc.rest),store=CHARGE.test(fold(base))?{category:'Outros',name:undefined}:storeOf(fold(base));
  const refund=l.amount<0,amount=Math.abs(l.amount),title=(refund?(/^estorno\b/i.test(base)?base:'Estorno · '+base):store?.name||base).slice(0,120);
  // Parcela a partir da segunda: entra no mês desta fatura, com a data da compra na nota.
  const late=parc.k>=2,date=late?(meta.closingDate||meta.dueDate||l.date):l.date,installment=parc.k?parc.k+'/'+parc.n:null;
  const category=refund?'Outras receitas':history.get(fold(title))?.category||store?.category||'Outros';
  const notes=[meta.issuer!=='Cartão'?meta.issuer:'',installment?'Parcela '+installment+(late?' · compra em '+l.date.slice(8)+'/'+l.date.slice(5,7):''):''].filter(Boolean).join(' · ').slice(0,240);
  const direction=refund?'income':'expense',k=fp(date,amount,direction,title),n=left.get(k)||0;let reason:string|null=null;
  if(n>0){left.set(k,n-1);reason='Já está nos lançamentos';}
  else if(parc.k&&!refund){const part=ctx.transactions.find(x=>x.installmentGroup&&!usedParts.has(x.id)&&x.installmentIndex===parc.k&&x.installmentCount===parc.n&&Math.abs(x.amount-amount)<=parc.n);if(part){usedParts.add(part.id);reason='Já está nas compras parceladas';}}
  const duplicate=!!reason;if(!reason&&refund)reason='Estorno: marque para lançar como receita';
  return {key:'r'+i,date,title,amount,direction,category,notes,installment,refund,duplicate,reason,selected:!duplicate&&!refund};});
 const sum=rows.reduce((s,r)=>s+(r.refund?-r.amount:r.amount),0);
 return {...meta,rows,sum,mismatch:meta.total!==null&&Math.abs(sum-meta.total)>Math.max(Math.round(Math.abs(meta.total)*0.01),100),truncated:valid.length>MAX_ROWS};}
export function parseFaturaText(text:string,ctx:FaturaCtx):FaturaResult{const {meta,lines}=readFatura(text,ctx.today);return faturaFromLines(lines,meta,ctx);}
// Resposta da IA conferida antes de usar: datas e valores inválidos saem; no máximo 250 linhas.
export function normalizeAiFatura(raw:unknown):{meta:FaturaMeta;lines:FaturaLine[]}{const r=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>,issuer=r.issuer,total=r.total;
 const meta:FaturaMeta={issuer:typeof issuer==='string'&&issuer.trim()?issuer.trim().slice(0,40):'Cartão',closingDate:isIso(r.closingDate)?r.closingDate:null,dueDate:isIso(r.dueDate)?r.dueDate:null,total:typeof total==='number'&&Number.isSafeInteger(total)&&total>=0?total:null};
 const lines:FaturaLine[]=[];for(const l of Array.isArray(r.lines)?r.lines:[]){if(lines.length>=MAX_ROWS)break;const x=(l&&typeof l==='object'?l:{}) as Record<string,unknown>;if(isIso(x.date)&&typeof x.description==='string'&&x.description.trim()&&typeof x.amount==='number'&&Number.isSafeInteger(x.amount)&&x.amount!==0)lines.push({date:x.date,description:x.description.trim().slice(0,200),amount:x.amount});}
 return {meta,lines};}
// Linhas marcadas viram itens do comando importTransactions; com cartão, o core grava como crédito.
export function faturaItems(rows:FaturaRow[],cardId?:string){return rows.filter(r=>r.selected).map(r=>({title:r.title,amount:r.amount,direction:r.direction,category:r.category,date:r.date,...(r.notes?{notes:r.notes}:{}),...(cardId?{cardId}:{payment:'credit'})}));}
