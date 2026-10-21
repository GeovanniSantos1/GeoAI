# Finanças: importar fatura em PDF e Investimentos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trazer do GGFinance para o menu Finanças do GeoAI duas coisas: a importação de fatura de cartão em PDF (leitura no aparelho, com "Ler com a IA" quando preciso) e a aba Investimentos (carteira calculada pelos movimentos). O assistente passa a ver e registrar a carteira.

**Architecture:**
- Tudo fica no workspace JSON do GeoAI, com duas coleções novas: `investments` e `investmentEvents`.
- As regras puras e testáveis ficam em `lib/invest.ts` e `lib/fatura.ts`. O `lib/core.ts` valida e grava.
- O PDF é lido no navegador com o `unpdf`, carregado sob demanda.
- Há uma rota nova, `/api/finance/fatura`, só para a leitura com a IA.
- Cada tela é um arquivo em `components/norte/`.

**Tech Stack:** Next.js 16, React 19, AI SDK 7 (`generateText` + `Output.object`), Zod, `unpdf` 1.8.1. Testes com `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-financas-fatura-investimentos-design.md`

## Global Constraints

**Código**
- Siga o estilo do repositório: TS/TSX compacto, em uma linha por instrução, com poucos comentários em pt-BR que explicam o porquê. Textos da interface em pt-BR, exatamente como no plano.
- Valores em centavos inteiros (`amount`). A cotação (`price`) é em centavos e pode ter fração, com até 4 casas.
- `lib/invest.ts` e `lib/fatura.ts` são puros. Importam só arquivos relativos com extensão `.ts` (`./types.ts`, `./finance.ts`) e nunca o core nem `@/…`.
- Não escreva escapes `\u…` em código novo:
  - para o espaço não separável use `String.fromCharCode(160)`;
  - para remover acentos use `.normalize('NFD').replace(/\p{M}/gu,'')`.

**Testes**
- Comando: `node --experimental-strip-types --test <arquivo>`, importando `.ts` pelo caminho relativo com extensão.
- `formatMoney` e `formatPrice` põem um espaço não separável (código 160) depois de "R$". Nos testes, use `const NB=String.fromCharCode(160)` e monte `'R$'+NB+'38,50'`.

**Dependências**
- A única dependência nova é `unpdf`, fixada em `1.8.1`.

**Git**
- Commits em pt-BR, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Use só comandos git simples e separados, um por chamada (`git add …`, `git commit …`). Nada de `cd … &&`, subshell ou script.

**Verificação de cada tarefa**
- o teste da tarefa;
- `npm test`;
- `npm run typecheck`;
- `npx eslint <arquivos alterados>`, sem problemas novos;
- `npm run build` nas tarefas com tela ou rota.

## Review Focus

1. **Fatura em layout que as regras não reconhecem** (colunas juntas, outro banco): `parseFaturaText` devolve zero linhas sem lançar erro, e a tela oferece "Ler com a IA". Teste na Tarefa 3.
2. **Importar a mesma fatura duas vezes:** na segunda vez, todas as linhas vêm "Já lançado" e desmarcadas, então nada duplica. Teste na Tarefa 3.
3. **Formatos de valor e data:** "R$ 1.234,56", menos no fim ("10,00-") e ano com 2 dígitos. Teste na Tarefa 3.
4. **Dados antigos com venda maior que a posição:** a posição nunca fica negativa e não há erro. Teste na Tarefa 1.
5. **Confirmar a mesma sugestão do assistente duas vezes:** só um ativo e um movimento. Teste na Tarefa 5.

---

### Task 1: Regras de investimentos (`lib/invest.ts`)

**Files:**
- Create: `lib/invest.ts`
- Create: `tests/invest.test.mjs`
- Modify: `package.json` (script `test`: acrescentar `tests/invest.test.mjs` no fim)

**Interfaces:**
- Consumes: `Item` de `lib/types.ts`.
- Produces (usado pelas Tarefas 2, 5 e 6):
  - **Constantes:**
    - `INVEST_KINDS: InvestKind[]`, em que `InvestKind = {id,label,group,mode:'value'|'quantity',color}`;
    - `FIXED_INCOME: string[]`;
    - `INDEXERS`, uma lista de `[id,label]`;
    - `MOVES`, uma tupla readonly com `buy|sell|dividend|yield|interest|valuation`;
    - `INCOME_MOVES: string[]`;
    - `MOVE_TITLE: Record<string,string>`;
    - `MOVE_OPTIONS: string[][]`.
  - **Tipo e modo:** `kindInfo(kind?)`, `modeOf(kind?)`, `moveLabel(move,kind?)` e `moveProblem(e,kind?): string|null`.
  - **Datas:** `monthEnd(ym)`.
  - **Posição e carteira:**
    - `type Position = {asset,mode,quantity,avgPrice,invested,value,lastPrice,priceDate,unrealized,realized,income,pnl,pct,closed}`;
    - `position(asset,events,until?)` e `positions(assets,events,until?)`;
    - `portfolio(list)`, que devolve `{invested,value,unrealized,realized,income,pnl,pct,count,allocation:[{kind,label,color,value,share}]}`;
    - `incomeInYear(events,year,until?)`.
  - **Formatação:** `formatRate(asset)`, `formatQty(n)`, `formatPrice(cents)` e `priceToCents(text)`.

- [ ] **Step 1: Write the failing test** — crie `tests/invest.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INVEST_KINDS,kindInfo,modeOf,moveLabel,moveProblem,monthEnd,position,positions,portfolio,incomeInYear,formatRate,formatQty,formatPrice,priceToCents} from '../lib/invest.ts';
const NB=String.fromCharCode(160);
const ev=(id,assetId,move,date,f={})=>({id,title:move,assetId,move,date,...f});
const PETR={id:'p',title:'Petrobras',kind:'acao',ticker:'PETR4'},CDB={id:'c',title:'CDB Banco X',kind:'cdb',indexer:'cdi',rate:110};
const EVENTS=[ev('e1','p','buy','2026-01-10',{quantity:10,amount:30000}),ev('e2','p','buy','2026-02-10',{quantity:10,amount:40000}),ev('e3','p','sell','2026-03-10',{quantity:5,amount:25000}),ev('e4','p','valuation','2026-04-01',{price:4500}),ev('e5','p','dividend','2026-04-15',{amount:1200}),
 ev('c1','c','buy','2026-01-05',{amount:100000}),ev('c2','c','buy','2026-02-05',{amount:50000}),ev('c3','c','valuation','2026-03-01',{amount:160000}),ev('c4','c','sell','2026-03-10',{amount:80000}),ev('c5','c','interest','2026-03-20',{amount:500})];

test('tipos, modos e rótulos dos movimentos',()=>{
 assert.deepEqual(INVEST_KINDS.map(k=>k.id),['cdb','tesouro','lci_lca','acao','fii','etf','cripto','fundo','outro']);
 assert.deepEqual(INVEST_KINDS.filter(k=>k.mode==='quantity').map(k=>k.id),['acao','fii','etf','cripto']);
 assert.equal(kindInfo('xyz').id,'outro');assert.equal(modeOf('fundo'),'value');
 assert.deepEqual([moveLabel('buy','cdb'),moveLabel('buy','acao'),moveLabel('sell','cdb'),moveLabel('sell','fii'),moveLabel('valuation','cdb'),moveLabel('valuation','cripto'),moveLabel('dividend','fii'),moveLabel('interest','cdb')],['Aplicação','Compra','Resgate','Venda','Valor atual','Cotação','Dividendo','Juros']);});
test('exigências de cada movimento pelo modo do ativo',()=>{
 assert.equal(moveProblem({move:'buy',amount:100},'acao'),'Informe a quantidade');
 assert.equal(moveProblem({move:'buy',quantity:1},'acao'),'Informe o valor');
 assert.equal(moveProblem({move:'buy',amount:100},'cdb'),null);
 assert.equal(moveProblem({move:'valuation',amount:100},'acao'),'Informe a cotação');
 assert.equal(moveProblem({move:'valuation',price:100},'cdb'),'Informe o valor atual');
 assert.equal(moveProblem({move:'dividend'},'fii'),'Informe o valor do provento');
 assert.equal(moveProblem({move:'sell',quantity:2,amount:10},'acao'),null);});
test('modo quantidade: compras, venda com preço médio, cotação e proventos',()=>{const p=position(PETR,EVENTS);
 assert.deepEqual({q:p.quantity,inv:p.invested,avg:p.avgPrice,val:p.value,un:p.unrealized,re:p.realized,inc:p.income,pnl:p.pnl,pct:p.pct,price:p.lastPrice,date:p.priceDate,closed:p.closed},{q:15,inv:52500,avg:3500,val:67500,un:15000,re:7500,inc:1200,pnl:23700,pct:28.6,price:4500,date:'2026-04-01',closed:false});});
test('posição no fim de um mês passado',()=>{const p=position(PETR,EVENTS,'2026-02-28');
 assert.deepEqual({q:p.quantity,inv:p.invested,val:p.value,pct:p.pct,date:p.priceDate},{q:20,inv:70000,val:80000,pct:14.3,date:'2026-02-10'});
 assert.equal(position(PETR,EVENTS,'2025-12-31').value,0);});
test('modo valor: aplicações, valor atual e resgate parcial com custo proporcional',()=>{const c=position(CDB,EVENTS);
 assert.deepEqual({inv:c.invested,val:c.value,un:c.unrealized,re:c.realized,inc:c.income,pct:c.pct,date:c.priceDate},{inv:75000,val:80000,un:5000,re:5000,inc:500,pct:6.7,date:'2026-03-01'});});
test('no mesmo dia vale a ordem em que os movimentos foram salvos',()=>{const a={id:'x',title:'X',kind:'acao'};
 const p=position(a,[ev('1','x','buy','2026-05-01',{quantity:2,amount:2000}),ev('2','x','sell','2026-05-01',{quantity:2,amount:2400})]);
 assert.deepEqual({q:p.quantity,re:p.realized,closed:p.closed},{q:0,re:400,closed:true});});
test('venda maior que a posição em dados antigos não deixa nada negativo',()=>{const a={id:'x',title:'X',kind:'acao'};
 const p=position(a,[ev('1','x','buy','2026-05-01',{quantity:5,amount:5000}),ev('2','x','sell','2026-05-02',{quantity:8,amount:9600})]);
 assert.deepEqual({q:p.quantity,inv:p.invested,val:p.value,re:p.realized},{q:0,inv:0,val:0,re:4600});});
test('carteira: totais, alocação na ordem dos tipos e encerradas no fim',()=>{const closed={id:'z',title:'Antiga',kind:'fii'};
 const list=positions([PETR,CDB,closed],[...EVENTS,ev('z1','z','buy','2026-01-02',{quantity:1,amount:1000}),ev('z2','z','sell','2026-01-03',{quantity:1,amount:1100})]);
 assert.deepEqual(list.map(p=>p.asset.id),['c','p','z']);
 const t=portfolio(list);
 assert.deepEqual({inv:t.invested,val:t.value,un:t.unrealized,re:t.realized,inc:t.income,pct:t.pct,count:t.count},{inv:127500,val:147500,un:20000,re:12600,inc:1700,pct:15.7,count:2});
 assert.deepEqual(t.allocation.map(x=>[x.kind,x.value]),[['cdb',80000],['acao',67500]]);
 assert.equal(Math.round(t.allocation[0].share*1000),542);});
test('proventos no ano até a data',()=>{assert.equal(incomeInYear(EVENTS,'2026'),1700);assert.equal(incomeInYear(EVENTS,'2026','2026-04-10'),500);assert.equal(incomeInYear(EVENTS,'2025'),0);});
test('último dia do mês',()=>{assert.deepEqual([monthEnd('2026-02'),monthEnd('2028-02'),monthEnd('2026-12')],['2026-02-28','2028-02-29','2026-12-31']);});
test('taxa, quantidade e cotação formatadas',()=>{
 assert.deepEqual([formatRate({indexer:'cdi',rate:110}),formatRate({indexer:'selic',rate:100}),formatRate({indexer:'ipca',rate:6.5}),formatRate({indexer:'pre',rate:12.5}),formatRate({indexer:'none',rate:5}),formatRate({})],['110% do CDI','100% da Selic','IPCA + 6,5%','12,5% a.a.','','']);
 assert.deepEqual([formatQty(10),formatQty(0.5),formatQty(1234.5),formatQty(0.00012345)],['10','0,5','1.234,5','0,00012345']);
 assert.deepEqual([formatPrice(3850),formatPrice(35000000),formatPrice(0.0123)],['R$'+NB+'38,50','R$'+NB+'350.000,00','R$'+NB+'0,000123']);});
test('cotação digitada vira centavos, com fração para cripto',()=>{
 assert.deepEqual([priceToCents('38,50'),priceToCents('0,000123'),priceToCents('1.234,5'),priceToCents('350.000'),priceToCents('38.5'),priceToCents('R$ 10')],[3850,0.0123,123450,35000000,3850,1000]);
 for(const bad of ['','abc','0','-5'])assert.throws(()=>priceToCents(bad),/Informe uma cotação válida/);});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/invest.test.mjs`
Expected: FAIL, porque `lib/invest.ts` não existe (ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: Write the implementation** — crie `lib/invest.ts`:

```ts
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
 const mode=modeOf(asset.kind);let qty=0,cost=0,held=0,realized=0,income=0,price=0,priceDate:string|null=null,moved=false;
 for(const e of movesOf(asset.id,events,until)){moved=true;const amount=Number(e.amount)||0,q=Number(e.quantity)||0,p=Number(e.price)||0;
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
 return {asset,mode,quantity:qty,avgPrice:qty>0?cost/qty:0,invested,value,lastPrice:price,priceDate,unrealized,realized:r,income:inc,pnl:unrealized+r+inc,pct:pctOf(unrealized,invested),closed:moved&&value===0&&invested===0};}
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test tests/invest.test.mjs`
Expected: PASS, com todos os testes.

- [ ] **Step 5: Add the test file to `npm test`**

Em `package.json`, no script `test`, acrescente ` tests/invest.test.mjs` depois de `tests/finance.test.mjs`. Depois rode `npm test` (tudo verde), `npm run typecheck` e `npx eslint lib/invest.ts`.

- [ ] **Step 6: Commit**

```
git add lib/invest.ts tests/invest.test.mjs package.json
git commit -m "Investimentos: tipos, movimentos e carteira calculada pelo histórico" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Core — coleções de investimentos, ativo novo junto do movimento e limites

**Files:**
- Modify: `lib/types.ts:1` (`COLLECTIONS`)
- Modify: `lib/core.ts`:
  - imports;
  - chaves (perto de `VALID_KEYS.add('payment')`);
  - `ADDED_COLLECTIONS`;
  - `validateItem`;
  - `validateWorkspace`;
  - `applyCommand` (upsert, delete e installments);
  - função nova `checkInvestmentEvent`.
- Modify: `app/api/state/route.ts` (limite do corpo)
- Modify: `components/norte/catalog.ts` (`FIELDS` e `COLLECTION_LABELS` ganham as coleções novas, com os formulários ainda vazios)
- Test: `tests/invest.test.mjs` (casos do core) e `tests/finance.test.mjs` (limites)

**Interfaces:**
- Consumes (da Tarefa 1): `INVEST_KINDS`, `FIXED_INCOME`, `INDEXERS`, `MOVES`, `MOVE_TITLE`, `moveProblem`, `modeOf`, `position` e `formatQty`, de `./invest.ts`.
- Produces:
  - coleções `investments` e `investmentEvents`;
  - `export function checkInvestmentEvent(s:Workspace,e:Item,today:string):Item|null`, que valida e devolve o ativo existente, ou `null` quando o ativo é novo. Usado pela Tarefa 5.
  - **Comportamento do upsert de `investmentEvents` com `newAsset`:** cria ou reaproveita o ativo, preenche `assetId` e remove `newAsset`.
  - **Exclusão:** apagar um ativo apaga os movimentos dele.
  - **Limites:** 5.000 em `transactions`, 2.000 nas outras coleções, e 2.500.000 caracteres de JSON no workspace. Ficam em `limitOf(c)` e `MAX_STATE`, internos.

- [ ] **Step 1: Write the failing tests** — acrescente ao fim de `tests/invest.test.mjs`:

```js
import {emptyWorkspace,applyCommand,validateItem,upgradeWorkspace,checkInvestmentEvent} from '../lib/core.ts';
const T='2026-10-18';
const up=(s,collection,item)=>applyCommand(s,{type:'upsert',collection,item},T);
function wallet(){let s=emptyWorkspace('Geo');s=up(s,'investments',{id:'p',title:'Petrobras',kind:'acao',ticker:'PETR4'});s=up(s,'investments',{id:'c',title:'CDB Banco X',kind:'cdb',indexer:'cdi',rate:110});
 s=up(s,'investmentEvents',{id:'e1',assetId:'p',move:'buy',date:'2026-10-01',quantity:10,amount:30000});s=up(s,'investmentEvents',{id:'c1',assetId:'c',move:'buy',date:'2026-10-01',amount:100000});return s;}
test('ativo: tipo, código e campos de renda fixa só na renda fixa',()=>{
 const a=validateItem('investments',{title:'Petrobras',kind:'acao',ticker:' petr 4 ',indexer:'cdi',rate:10,dueDate:'2030-01-01'});
 assert.deepEqual([a.ticker,a.indexer,a.rate,a.dueDate],['PETR4',undefined,undefined,undefined]);
 const c=validateItem('investments',{title:'CDB',kind:'cdb',indexer:'cdi',rate:110,dueDate:'2028-05-01'});
 assert.deepEqual([c.indexer,c.rate,c.dueDate],['cdi',110,'2028-05-01']);
 assert.throws(()=>validateItem('investments',{title:'X',kind:'imovel'}),/Tipo de investimento inválido/);
 assert.throws(()=>validateItem('investments',{title:'X',kind:'cdb',indexer:'poupanca'}),/Indexador inválido/);
 assert.throws(()=>validateItem('investments',{title:'X',kind:'acao',ticker:'A'.repeat(17)}),/até 16/);});
test('movimento: título padrão, tipo e ativo obrigatórios',()=>{
 assert.equal(validateItem('investmentEvents',{assetId:'p',move:'dividend',date:T,amount:100}).title,'Dividendo');
 assert.throws(()=>validateItem('investmentEvents',{assetId:'p',move:'gift',date:T}),/Movimento inválido/);
 assert.throws(()=>validateItem('investmentEvents',{move:'buy',date:T,amount:1}),/Selecione um ativo da carteira/);
 assert.throws(()=>validateItem('investmentEvents',{assetId:'p',move:'buy',amount:1}),/Informe a data/);});
test('movimento salvo: ativo existente, data e exigências pelo modo do ativo',()=>{const s=wallet();
 assert.throws(()=>up(s,'investmentEvents',{assetId:'zz',move:'buy',date:T,quantity:1,amount:100}),/Selecione um ativo da carteira/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'buy',date:'2026-10-19',quantity:1,amount:100}),/A data não pode ser futura/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'buy',date:T,amount:100}),/Informe a quantidade/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'valuation',date:T,amount:100}),/Informe a cotação/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'c',move:'valuation',date:T,price:100}),/Informe o valor atual/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'dividend',date:T}),/Informe o valor do provento/);
 assert.equal(up(s,'investmentEvents',{assetId:'p',move:'valuation',date:T,price:3850.5}).investmentEvents.length,3);});
test('venda maior que a posição na data',()=>{const s=wallet();
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'sell',date:T,quantity:11,amount:100}),{message:'Você tem só 10 nessa data.'});
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'sell',date:'2026-09-30',quantity:1,amount:100}),{message:'Você tem só 0 nessa data.'});
 assert.throws(()=>up(s,'investmentEvents',{assetId:'c',move:'sell',date:T,amount:150000}),{message:'O resgate passa do valor da posição (R$'+String.fromCharCode(160)+'1.000,00).'});
 const sold=up(s,'investmentEvents',{id:'e2',assetId:'p',move:'sell',date:T,quantity:10,amount:35000});
 assert.equal(up(sold,'investmentEvents',{id:'e2',assetId:'p',move:'sell',date:T,quantity:10,amount:36000,_rev:1}).investmentEvents.find(x=>x.id==='e2').amount,36000);});
test('ativo novo junto do movimento: cria uma vez e reaproveita por código ou nome',()=>{let s=emptyWorkspace('Geo');
 const cmd={id:'e1',move:'buy',date:T,quantity:10,amount:38000,newAsset:{title:'Petrobras',kind:'acao',ticker:'petr4'}};
 s=up(s,'investmentEvents',cmd);
 assert.deepEqual(s.investments.map(a=>[a.id,a.title,a.ticker]),[['e1-a','Petrobras','PETR4']]);
 assert.equal(s.investmentEvents[0].assetId,'e1-a');assert.equal(s.investmentEvents[0].newAsset,undefined);
 s=up(s,'investmentEvents',{...cmd,_rev:1});assert.deepEqual([s.investments.length,s.investmentEvents.length],[1,1]);
 s=up(s,'investmentEvents',{id:'e2',move:'buy',date:T,quantity:1,amount:3900,newAsset:{title:'Petro',kind:'acao',ticker:'PETR4'}});
 s=up(s,'investmentEvents',{id:'e3',move:'buy',date:T,quantity:1,amount:3900,newAsset:{title:'petrobrás',kind:'acao'}});
 assert.equal(s.investments.length,1);assert.deepEqual(s.investmentEvents.map(x=>x.assetId),['e1-a','e1-a','e1-a']);
 s=up(s,'investmentEvents',{id:'f1',move:'buy',date:T,amount:50000,newAsset:{id:'cdb1',title:'CDB Novo',kind:'cdb',indexer:'cdi',rate:105}});
 assert.deepEqual([s.investments.find(a=>a.id==='cdb1').rate,s.investmentEvents.find(x=>x.id==='f1').assetId],[105,'cdb1']);
 assert.throws(()=>up(s,'investmentEvents',{id:'g1',move:'buy',date:T,amount:1,newAsset:{title:'Casa',kind:'imovel'}}),/Tipo de investimento inválido/);
 assert.throws(()=>up(s,'investmentEvents',{id:'g2',move:'sell',date:T,quantity:1,amount:1,newAsset:{title:'Vale',kind:'acao'}}),{message:'Você tem só 0 nessa data.'});});
test('excluir o ativo exclui os movimentos dele',()=>{const s=applyCommand(wallet(),{type:'delete',collection:'investments',id:'p'},T);
 assert.deepEqual([s.investments.map(a=>a.id),s.investmentEvents.map(e=>e.id)],[['c'],['c1']]);});
test('espaço antigo ganha as coleções de investimentos',()=>{const old=emptyWorkspace('Geo');delete old.investments;delete old.investmentEvents;
 const s=upgradeWorkspace(old);assert.deepEqual([s.investments,s.investmentEvents],[[],[]]);assert.deepEqual(emptyWorkspace().investmentEvents,[]);});
test('checkInvestmentEvent devolve o ativo encontrado ou null para o ativo novo',()=>{const s=wallet();
 assert.equal(checkInvestmentEvent(s,validateItem('investmentEvents',{assetId:'p',move:'dividend',date:T,amount:10}),T).id,'p');
 assert.equal(checkInvestmentEvent(s,validateItem('investmentEvents',{move:'buy',date:T,quantity:1,amount:10,newAsset:{title:'Vale',kind:'acao'}}),T),null);});
```

Acrescente também ao fim de `tests/finance.test.mjs`. O arquivo já importa `emptyWorkspace`, `applyCommand` e `validateWorkspace` e define `T` e `up`.

```js
test('limites: 5.000 lançamentos, 2.000 nas outras coleções e espaço de 2,5 MB',()=>{
 const many=(n,f)=>Array.from({length:n},(_,i)=>f(i)),tx=i=>({id:'t'+i,title:'x',amount:100,direction:'expense',date:T});
 let s=emptyWorkspace('Geo');s.transactions=many(2000,tx);
 assert.equal(up(s,'transactions',{title:'nova',amount:100,direction:'expense',date:T}).transactions.length,2001);
 s.transactions=many(5000,tx);
 assert.throws(()=>up(s,'transactions',{title:'nova',amount:100,direction:'expense',date:T}),/Limite da coleção atingido/);
 s=emptyWorkspace('Geo');s.notes=many(2000,i=>({id:'n'+i,title:'x',content:'y'}));
 assert.throws(()=>up(s,'notes',{title:'nova',content:'z'}),/Limite da coleção atingido/);
 const backup=emptyWorkspace('Geo');backup.transactions=many(2001,tx);
 assert.equal(validateWorkspace(backup).transactions.length,2001);
 const notes=emptyWorkspace('Geo');notes.notes=many(2001,i=>({id:'n'+i,title:'x',content:'y'}));
 assert.throws(()=>validateWorkspace(notes),/Limite de registros excedido/);
 const big=emptyWorkspace('Geo');big.notes=many(170,i=>({id:'n'+i,title:'x',content:'a'.repeat(9000)}));
 assert.equal(validateWorkspace(big).notes.length,170);
 big.notes=many(290,i=>({id:'n'+i,title:'x',content:'a'.repeat(9000)}));
 assert.throws(()=>validateWorkspace(big),/Backup muito grande/);});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test tests/invest.test.mjs tests/finance.test.mjs`
Expected: os testes novos falham:
- "Registro inválido", porque a coleção `investments` ainda não existe;
- `checkInvestmentEvent` não é exportada;
- o limite antigo de 2.000 e 1 MB faz o teste de limites falhar.

- [ ] **Step 3: Implement**

Antes de editar, rode `npx eslint lib/core.ts lib/types.ts components/norte/catalog.ts app/api/state/route.ts` e anote a contagem de problemas. No Step 4, o resultado tem de ter a mesma contagem.

`lib/types.ts`, linha 1: acrescente `'investments','investmentEvents'` no fim do array `COLLECTIONS`, depois de `'intimacy'`.

`lib/core.ts`:

1. Depois da linha `import { formatMoney, PAYMENTS, EXPENSE_CATEGORIES, CATEGORIES } from './finance.ts';`:
```ts
import { INVEST_KINDS, FIXED_INCOME, INDEXERS, MOVES, MOVE_TITLE, moveProblem, modeOf, position, formatQty } from './invest.ts';
```
2. Logo depois de `VALID_KEYS.add('payment');`:
```ts
// Investimentos: ativo (tipo, código, corretora, indexador e taxa) e movimento (ativo, tipo de movimento, cotação e o ativo novo que pode vir junto).
for(const key of ['kind','ticker','broker','indexer','rate','assetId','move','price','newAsset'])VALID_KEYS.add(key);for(const key of ['rate','price'])NUMBERS.add(key);
// Limites por coleção (lançamentos têm mais espaço por causa da importação de faturas) e do espaço inteiro, em caracteres de JSON.
const LIMITS:Record<string,number>={transactions:5000};const limitOf=(c:string)=>LIMITS[c]||2000;const MAX_STATE=2500000;
```
3. `ADDED_COLLECTIONS`: acrescente `'investments','investmentEvents'` no fim.
4. Em `validateItem`, logo depois da primeira linha (a que lança `'Registro inválido'`):
```ts
 // Movimento sem título recebe o nome do movimento: o formulário e o assistente não pedem título.
 if(collection==='investmentEvents'&&(typeof raw.title!=='string'||!raw.title.trim()))raw={...raw,title:MOVE_TITLE[raw.move]||'Movimento'};
```
5. No laço de chaves de `validateItem`, antes do ramo `else if(typeof value==='string')`:
```ts
  else if(key==='newAsset')item[key]=cleanNewAsset(collection,value);
```
   e, logo depois do fim da função `validateItem`:
```ts
// Ativo novo que vem junto do movimento: validado como ativo; o id só fica quando veio (formulário de ativo novo).
function cleanNewAsset(collection:string,value:any){if(collection!=='investmentEvents'||!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ativo inválido');const given=typeof value.id==='string';const {id,...asset}=validateItem('investments',{...value,id:given?value.id:'novo'});return given?{...asset,id}:asset;}
```
6. Na lista de coleções que exigem data (a linha que lança `'Informe a data do registro'`), acrescente `'investmentEvents'`.
7. Antes de `if(item.repeatUntil&&item.date&&item.repeatUntil<item.date)`, no fim de `validateItem`:
```ts
 if(collection==='investments'){if(!INVEST_KINDS.some(k=>k.id===item.kind))throw new Error('Tipo de investimento inválido');
  if(item.ticker!==undefined){item.ticker=item.ticker.toUpperCase().replace(/\s+/g,'');if(item.ticker.length>16)throw new Error('Use um código de até 16 caracteres');if(!item.ticker)delete item.ticker;}
  if(item.broker!==undefined&&item.broker.length>40)throw new Error('Use um nome de corretora de até 40 caracteres');
  if(FIXED_INCOME.includes(item.kind)){if(item.indexer!==undefined&&!INDEXERS.some(([id])=>id===item.indexer))throw new Error('Indexador inválido');if(item.rate!==undefined&&item.rate>1000)throw new Error('Taxa inválida');}
  else{delete item.indexer;delete item.rate;delete item.dueDate;}}
 if(collection==='investmentEvents'){if(!(MOVES as readonly string[]).includes(item.move))throw new Error('Movimento inválido');if(!item.newAsset&&(typeof item.assetId!=='string'||!/^[\w-]{1,100}$/.test(item.assetId)))throw new Error('Selecione um ativo da carteira');}
```
8. Logo antes de `export function validateWorkspace`:
```ts
const foldName=(t:string)=>String(t).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
// Movimento de investimento: ativo existente (pelo id, ou o mesmo código ou nome do ativo novo), exigências do movimento, data e o que existe para vender.
export function checkInvestmentEvent(s:Workspace,e:Item,today:string){
 const n=e.newAsset,asset=s.investments.find(a=>a.id===e.assetId)||(n?s.investments.find(a=>(n.id&&a.id===n.id)||(n.ticker&&a.ticker===n.ticker)||foldName(a.title)===foldName(n.title)):undefined)||null;
 if(!asset&&!n)throw new Error('Selecione um ativo da carteira');
 const kind=(asset||n).kind;if(e.date>today)throw new Error('A data não pode ser futura');
 const problem=moveProblem(e,kind);if(problem)throw new Error(problem);
 if(e.move==='sell'){const p=position(asset||{id:'',title:'',kind},s.investmentEvents.filter(x=>x.id!==e.id),e.date);
  if(modeOf(kind)==='quantity'&&e.quantity>p.quantity+1e-9)throw new Error('Você tem só '+formatQty(p.quantity)+' nessa data.');
  if(modeOf(kind)==='value'&&e.amount>p.value)throw new Error('O resgate passa do valor da posição ('+formatMoney(p.value)+').');}
 return asset;}
```
9. Em `validateWorkspace`:
   - troque `if(raw[key].length>2000)` por `if(raw[key].length>limitOf(key))`;
   - troque `if(JSON.stringify(s).length>1000000)throw new Error('Backup muito grande')` por `if(JSON.stringify(s).length>MAX_STATE)throw new Error('Backup muito grande')`.
10. Em `applyCommand`, no ramo `upsert`, logo depois da linha `if(col==='intimacy'&&item.date>today)…`:
```ts
  if(col==='investmentEvents'){const asset=checkInvestmentEvent(s,item,today);if(item.newAsset){const {id:assetId,...fields}=item.newAsset;if(asset)item.assetId=asset.id;else{if(s.investments.length>=limitOf('investments'))throw new Error('Limite da coleção atingido');const created=validateItem('investments',{...fields,id:assetId||item.id+'-a'});created._rev=1;s.investments.push(created);item.assetId=created.id;}delete item.newAsset;}}
```
11. Ainda no `upsert`, troque `if(index<0&&s[col].length>=2000)` por `if(index<0&&s[col].length>=limitOf(col))`.
12. No ramo `delete`, logo depois de `s[col]=s[col].filter(x=>x.id!==command.id);`:
```ts
  if(col==='investments')s.investmentEvents=s.investmentEvents.filter(x=>x.assetId!==command.id);
```
13. No ramo `installments`, troque `s.transactions.length+rows.length>2000` por `s.transactions.length+rows.length>limitOf('transactions')`.
14. No fim de `applyCommand`, troque `if(JSON.stringify(s).length>1000000)` por `if(JSON.stringify(s).length>MAX_STATE)`.

`app/api/state/route.ts`: troque `if(text.length>1100000)` por `if(text.length>2600000)`, porque o backup agora pode ter até 2,5 MB.

`components/norte/catalog.ts`, para o typecheck passar (os formulários vêm na Tarefa 6):
- em `FIELDS`, depois de `intimacy:[…]`: `investments:[],investmentEvents:[]`;
- em `COLLECTION_LABELS`, no fim: `investments:'Novo ativo',investmentEvents:'Registrar movimento'`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --experimental-strip-types --test tests/invest.test.mjs tests/finance.test.mjs`
Expected: PASS.

Depois rode:
- `npm test`: tudo verde;
- `npm run typecheck`;
- `npx eslint lib/core.ts lib/types.ts components/norte/catalog.ts app/api/state/route.ts`: a mesma contagem anotada antes de editar, sem nenhum problema novo. Não use `git stash`.

- [ ] **Step 5: Commit**

```
git add lib/types.ts lib/core.ts app/api/state/route.ts components/norte/catalog.ts tests/invest.test.mjs tests/finance.test.mjs
git commit -m "Investimentos no core: ativos, movimentos com ativo novo junto, exclusão em cascata e limites maiores" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Regras da fatura (`lib/fatura.ts`)

**Files:**
- Create: `lib/fatura.ts`
- Create: `tests/fatura.test.mjs`
- Modify: `package.json` (script `test`: acrescentar `tests/fatura.test.mjs` no fim)

**Interfaces:**
- Consumes: `EXPENSE_CATEGORIES` de `./finance.ts` e `Item` de `./types.ts`.
- Produces (usado pelas Tarefas 4 e 7):
  - **Tipos:**
    - `FaturaLine = {date:string;description:string;amount:number}`, com `amount` em centavos e negativo no crédito;
    - `FaturaMeta = {issuer:string;closingDate:string|null;dueDate:string|null;total:number|null}`;
    - `FaturaRow = {key,date,title,amount,direction:'expense'|'income',category,notes,installment:string|null,refund:boolean,duplicate:boolean,reason:string|null,selected:boolean}`;
    - `FaturaResult = FaturaMeta & {rows,sum,mismatch,truncated}`;
    - `FaturaCtx = {transactions:Item[];today:string}`.
  - **Funções:**
    - `readFatura(text,today)`, que devolve `{meta,lines}`;
    - `faturaFromLines(lines,meta,ctx)`, que devolve `FaturaResult`;
    - `parseFaturaText(text,ctx)`, que devolve `FaturaResult`;
    - `normalizeAiFatura(raw)`, que devolve `{meta,lines}`;
    - `faturaItems(rows,cardId?)`, que devolve itens prontos para `importTransactions`.

- [ ] **Step 1: Write the failing test** — crie `tests/fatura.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFatura,parseFaturaText,faturaFromLines,normalizeAiFatura,faturaItems} from '../lib/fatura.ts';
const TODAY='2026-10-18',ctx=(transactions=[])=>({transactions,today:TODAY});
const TEXT=['Nubank','Fatura de outubro','Data de fechamento: 03/10/2026','Data de vencimento: 10/10/2026','Total da fatura R$ 1.234,56',
 '05/09 UBER *TRIP 23,90','12/09 IFOOD *RESTAURANTE 45,00','15/09 SUPERMERCADO BOM PRECO 210,35','20/09 MERCADOLIVRE*LOJA 150,00','22/09 AMAZON PRIME 14,90',
 '25/09 LOJA ABC PARC 03/10 100,00','28/09 POSTO SHELL 1.000,00','01/10 ESTORNO LOJA XYZ -50,00','02/10 IOF COMPRA INTERNACIONAL 3,50','02/10 PAGAMENTO DE FATURA -900,00',
 '30/12 COMPRA ANTIGA 10,00','31/02 DATA RUIM 10,00','03 OUT BAR DO ZE 80,00'].join('\n');

test('dados da fatura: emissor, fechamento, vencimento e total',()=>{const {meta}=readFatura(TEXT,TODAY);
 assert.deepEqual(meta,{issuer:'Nubank',closingDate:'2026-10-03',dueDate:'2026-10-10',total:123456});
 assert.deepEqual(readFatura('linha solta',TODAY).meta,{issuer:'Cartão',closingDate:null,dueDate:null,total:null});});
test('linhas reconhecidas: título, categoria, data, valor e seleção',()=>{const r=parseFaturaText(TEXT,ctx());
 assert.deepEqual(r.rows.map(x=>x.title),['Uber','iFood','Supermercado Bom Preco','Mercado Livre','Amazon Prime','Loja Abc','Posto Shell','Estorno Loja Xyz','Iof Compra Internacional','Compra Antiga','Bar do Ze']);
 assert.deepEqual(r.rows.map(x=>x.category),['Transporte','Alimentação','Mercado','Compras','Assinaturas','Outros','Transporte','Outras receitas','Outros','Outros','Lazer']);
 assert.deepEqual(r.rows.map(x=>x.date),['2026-09-05','2026-09-12','2026-09-15','2026-09-20','2026-09-22','2026-10-03','2026-09-28','2026-10-01','2026-10-02','2025-12-30','2026-10-03']);
 assert.deepEqual(r.rows.map(x=>x.amount),[2390,4500,21035,15000,1490,10000,100000,5000,350,1000,8000]);
 assert.deepEqual(r.rows.map(x=>x.selected),[true,true,true,true,true,true,true,false,true,true,true]);
 assert.deepEqual([r.sum,r.mismatch,r.truncated],[158765,true,false]);});
test('parcela, estorno e notas',()=>{const r=parseFaturaText(TEXT,ctx());const parc=r.rows[5],ref=r.rows[7];
 assert.deepEqual([parc.installment,parc.notes,parc.direction],['3/10','Nubank · Parcela 3/10 · compra em 25/09','expense']);
 assert.deepEqual([ref.direction,ref.refund,ref.duplicate,ref.reason],['income',true,false,'Estorno: marque para lançar como receita']);
 assert.equal(r.rows[0].notes,'Nubank');
 const t=parseFaturaText(['Fechamento: 03/10/2026','10/09 TV NOVA PARC 01/12 250,00','11/09 CURSO XYZ 02/06 99,90','12/09 COMPRA PARCELA 4/3 10,00'].join('\n'),ctx());
 assert.deepEqual(t.rows.map(x=>[x.title,x.date,x.installment,x.notes,x.category]),[['Tv Nova','2026-09-10','1/12','Parcela 1/12','Outros'],['Curso Xyz','2026-10-03','2/6','Parcela 2/6 · compra em 11/09','Educação'],['Compra Parcela 4/3','2026-09-12',null,'','Outros']]);});
test('formatos de data e valor: ano explícito, ano de 2 dígitos, R$, menos no fim e virada pelo dia de hoje',()=>{
 const r=parseFaturaText(['05/09/2025 HOTEL CENTRAL 300,00','06/09/25 LIVRARIA CULTURA 59,90','07/01 LOJA R$ 1.234,56','08/01 CREDITO LOJA 10,00-','20/12 NATAL 10,00'].join('\n'),{transactions:[],today:'2026-01-15'});
 assert.deepEqual(r.rows.map(x=>[x.date,x.title,x.amount,x.direction]),[['2025-09-05','Hotel Central',30000,'expense'],['2025-09-06','Livraria Cultura',5990,'expense'],['2026-01-07','Loja',123456,'expense'],['2026-01-08','Estorno · Credito Loja',1000,'income'],['2025-12-20','Natal',1000,'expense']]);
 assert.equal(r.rows[1].category,'Educação');assert.equal(r.mismatch,false);});
test('lojas: palavras curtas só inteiras e exceções do mercado',()=>{
 const r=parseFaturaText(['Fechamento: 03/10/2026','13/09 99 TECNOLOGIA 12,00','14/09 CAFETERIA LEGAL 9,00','16/09 TIM CELULAR 49,99','17/09 MAXXI ATACADO 80,00','18/09 MERCADO PAGO*LOJINHA 30,00','19/09 NETFLIX.COM 39,90'].join('\n'),ctx());
 assert.deepEqual(r.rows.map(x=>[x.title,x.category]),[['99','Transporte'],['Cafeteria Legal','Outros'],['TIM','Contas'],['Maxxi Atacado','Outros'],['Mercado Pago Lojinha','Outros'],['Netflix','Assinaturas']]);});
test('categoria pelo histórico vence as regras; categoria fora da lista é ignorada',()=>{
 const r=parseFaturaText(TEXT,ctx([{id:'h1',title:'Loja Abc',amount:5000,direction:'expense',date:'2026-08-01',category:'Compras'},{id:'h0',title:'Loja ABC',amount:5000,direction:'expense',date:'2026-07-01',category:'Lazer'},{id:'h2',title:'Bar do Ze',amount:100,direction:'expense',date:'2026-08-01',category:'Viagem'},{id:'h3',title:'Uber',amount:100,direction:'expense',date:'2026-08-02',category:'Saúde'}]));
 assert.deepEqual([r.rows[5].category,r.rows[10].category,r.rows[0].category],['Compras','Lazer','Saúde']);});
test('já lançado: por ocorrência e contra compras parceladas',()=>{
 const one=parseFaturaText(['Fechamento: 03/10/2026','05/09 UBER *TRIP 23,90','05/09 UBER *TRIP 23,90'].join('\n'),ctx([{id:'d1',title:'Uber',amount:2390,direction:'expense',date:'2026-09-05'}]));
 assert.deepEqual(one.rows.map(x=>[x.duplicate,x.selected,x.reason]),[[true,false,'Já está nos lançamentos'],[false,true,null]]);
 const parc=parseFaturaText(TEXT,ctx([{id:'g-part-3',title:'Loja Abc (3/10)',amount:10001,direction:'expense',date:'2026-12-25',installmentGroup:'g',installmentIndex:3,installmentCount:10}]));
 assert.deepEqual([parc.rows[5].duplicate,parc.rows[5].selected,parc.rows[5].reason],[true,false,'Já está nas compras parceladas']);});
test('importar a mesma fatura de novo marca tudo como já lançado',()=>{const first=parseFaturaText(TEXT,ctx());
 const saved=faturaItems(first.rows.map(r=>({...r,selected:true})),'c1').map((x,i)=>({id:'i'+i,...x}));
 const again=parseFaturaText(TEXT,ctx(saved));
 assert.ok(again.rows.every(r=>r.duplicate&&!r.selected));});
test('texto sem linhas reconhecíveis devolve zero linhas sem erro',()=>{const r=parseFaturaText('Extrato\nNome  Valor  Data\nqualquer coisa',ctx());
 assert.deepEqual([r.rows.length,r.sum,r.mismatch],[0,0,false]);});
test('total: tolerância de 1% ou R$ 1,00',()=>{const base=['05/09 UBER 23,90','06/09 LOJA 10,00'];
 assert.deepEqual(['33,90','34,00','40,00'].map(t=>parseFaturaText(['Total da fatura '+t,...base].join('\n'),ctx()).mismatch),[false,false,true]);});
test('no máximo 250 linhas',()=>{const r=parseFaturaText(Array.from({length:260},(_,i)=>'05/09 LOJA '+i+' 1,00').join('\n'),ctx());
 assert.deepEqual([r.rows.length,r.truncated],[250,true]);});
test('linhas da IA passam pelo mesmo tratamento',()=>{
 const r=faturaFromLines([{date:'2026-09-05',description:'UBER *TRIP',amount:2390},{date:'2026-09-25',description:'LOJA ABC PARC 03/10',amount:10000},{date:'2026-10-01',description:'ESTORNO X',amount:-500},{date:'2026-10-02',description:'PAGAMENTO DE FATURA',amount:-90000}],{issuer:'Itaú',closingDate:'2026-10-03',dueDate:null,total:null},ctx());
 assert.deepEqual(r.rows.map(x=>[x.title,x.date,x.category,x.notes]),[['Uber','2026-09-05','Transporte','Itaú'],['Loja Abc','2026-10-03','Outros','Itaú · Parcela 3/10 · compra em 25/09'],['Estorno X','2026-10-01','Outras receitas','Itaú']]);
 assert.equal(r.mismatch,false);});
test('resposta da IA conferida',()=>{
 const n=normalizeAiFatura({issuer:' Nubank ',closingDate:'2026-10-03',dueDate:'2026-02-30',total:12345,lines:[{date:'2026-09-05',description:' Uber ',amount:2390},{date:'2026-13-01',description:'x',amount:100},{date:'2026-09-06',description:'y',amount:10.5},{date:'2026-09-07',description:'',amount:100},{date:'2026-09-08',description:'z',amount:0}]});
 assert.deepEqual(n,{meta:{issuer:'Nubank',closingDate:'2026-10-03',dueDate:null,total:12345},lines:[{date:'2026-09-05',description:'Uber',amount:2390}]});
 assert.deepEqual(normalizeAiFatura('lixo'),{meta:{issuer:'Cartão',closingDate:null,dueDate:null,total:null},lines:[]});
 assert.equal(normalizeAiFatura({lines:Array.from({length:300},()=>({date:'2026-09-05',description:'a',amount:1}))}).lines.length,250);});
test('linhas marcadas viram itens para importar, com cartão ou como crédito',()=>{const r=parseFaturaText(TEXT,ctx());
 const withCard=faturaItems(r.rows,'c1'),noCard=faturaItems(r.rows);
 assert.equal(withCard.length,10);
 assert.deepEqual(withCard[0],{title:'Uber',amount:2390,direction:'expense',category:'Transporte',date:'2026-09-05',notes:'Nubank',cardId:'c1'});
 assert.deepEqual([noCard[0].payment,noCard[0].cardId],['credit',undefined]);});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/fatura.test.mjs`
Expected: FAIL, porque `lib/fatura.ts` não existe.

- [ ] **Step 3: Write the implementation** — crie `lib/fatura.ts`:

```ts
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
// Lojas conhecidas: a primeira que aparecer no título define categoria e nome. As palavras curtas só valem inteiras.
const WORD=new Set(['99','max','tim','oi','bar','extra','metro','cafe','light']);
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
function storeOf(t:string){for(const [term,category,name] of STORES){const hit=WORD.has(term)?new RegExp('(^|[^a-z0-9])'+term+'($|[^a-z0-9])').test(t):t.includes(term);if(hit)return {category,name};}return null;}
// Primeira palavra sempre com maiúscula; depois, palavras de até 2 letras ficam minúsculas ("Bar do Ze").
const titleCase=(s:string)=>s.toLowerCase().split(' ').filter(Boolean).map((w,i)=>i>0&&w.length<=2?w:w[0].toUpperCase()+w.slice(1)).join(' ');
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
export function normalizeAiFatura(raw:unknown):{meta:FaturaMeta;lines:FaturaLine[]}{const r=(raw&&typeof raw==='object'?raw:{}) as Record<string,any>;
 const meta:FaturaMeta={issuer:typeof r.issuer==='string'&&r.issuer.trim()?r.issuer.trim().slice(0,40):'Cartão',closingDate:isIso(r.closingDate)?r.closingDate:null,dueDate:isIso(r.dueDate)?r.dueDate:null,total:Number.isSafeInteger(r.total)&&r.total>=0?r.total:null};
 const lines=(Array.isArray(r.lines)?r.lines:[]).filter((l:any)=>l&&isIso(l.date)&&typeof l.description==='string'&&l.description.trim()&&Number.isSafeInteger(l.amount)&&l.amount!==0).slice(0,MAX_ROWS).map((l:any)=>({date:l.date,description:l.description.trim().slice(0,200),amount:l.amount}));
 return {meta,lines};}
// Linhas marcadas viram itens do comando importTransactions; com cartão, o core grava como crédito.
export function faturaItems(rows:FaturaRow[],cardId?:string){return rows.filter(r=>r.selected).map(r=>({title:r.title,amount:r.amount,direction:r.direction,category:r.category,date:r.date,...(r.notes?{notes:r.notes}:{}),...(cardId?{cardId}:{payment:'credit'})}));}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test tests/fatura.test.mjs`
Expected: PASS.

Se algum título ou categoria divergir, confira a ordem de `STORES` contra o teste. O teste é a especificação. Não mude o teste para acomodar o código, a não ser que o próprio teste contradiga a especificação. Nesse caso, explique no relatório.

- [ ] **Step 5: Add the test file to `npm test`**

Acrescente ` tests/fatura.test.mjs` no fim do script `test`. Depois rode `npm test`, `npm run typecheck` e `npx eslint lib/fatura.ts`.

- [ ] **Step 6: Commit**

```
git add lib/fatura.ts tests/fatura.test.mjs package.json
git commit -m "Fatura em PDF: linhas reconhecidas com categoria, parcela, estorno e já lançado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Importação no core e leitura com a IA

**Files:**
- Modify: `lib/core.ts` (comando `importTransactions` em `applyCommand`)
- Create: `lib/fatura-ai.ts`
- Create: `app/api/finance/fatura/route.ts`
- Test: `tests/finance.test.mjs`

**Interfaces:**
- Consumes:
  - `normalizeAiFatura` de `./fatura` (Tarefa 3);
  - `agentModel` de `./agent-runtime`;
  - `limitOf` (interno do core, Tarefa 2);
  - `getUserId` de `@/lib/auth`;
  - `jsonError` e `sameOrigin` de `@/lib/workspace-server`.
- Produces:
  - **Comando** `{type:'importTransactions',items:object[]}`, tudo ou nada, com até 250 itens.
  - **Função** `readFaturaWithAi(text)`, que devolve `{meta,lines}`.
  - **Rota** `POST /api/finance/fatura`, que recebe `{text}` e devolve `{meta,lines}`.
    - Respostas de erro: `{error}` com 400, 401, 403, 413, 415, 502 ou 503.

- [ ] **Step 1: Write the failing test** — acrescente ao fim de `tests/finance.test.mjs`:

```js
test('importar fatura: tudo ou nada, até 250 por vez e dentro do limite',()=>{const s=emptyWorkspace('Geo');s.cards=[{id:'c1',title:'Nubank'}];
 const items=[{id:'fixo',title:'Uber',amount:2390,direction:'expense',category:'Transporte',date:'2026-09-05',cardId:'c1'},{title:'Estorno X',amount:500,direction:'income',category:'Outras receitas',date:'2026-10-01',payment:'credit'}];
 const r=applyCommand(s,{type:'importTransactions',items},T);
 assert.equal(r.transactions.length,2);assert.deepEqual(r.transactions.map(x=>x.payment),['credit','credit']);
 assert.ok(r.transactions.every(x=>x._rev===1&&x.id!=='fixo'));assert.equal(new Set(r.transactions.map(x=>x.id)).size,2);
 assert.throws(()=>applyCommand(s,{type:'importTransactions',items:[...items,{title:'ruim',amount:0,direction:'expense',date:T}]},T),/Informe um valor maior que zero/);
 assert.equal(s.transactions.length,0);
 for(const bad of [[],Array.from({length:251},()=>items[1]),'x',[null]])assert.throws(()=>applyCommand(s,{type:'importTransactions',items:bad},T),/Importação inválida/);
 const full=emptyWorkspace('Geo');full.transactions=Array.from({length:4999},(_,i)=>({id:'t'+i,title:'x',amount:100,direction:'expense',date:T}));
 assert.equal(applyCommand(full,{type:'importTransactions',items:[items[1]]},T).transactions.length,5000);
 assert.throws(()=>applyCommand(full,{type:'importTransactions',items},T),/Limite de registros excedido/);});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/finance.test.mjs`
Expected: FAIL com "Ação não reconhecida".

- [ ] **Step 3: Implement**

Em `lib/core.ts`, em `applyCommand`, logo antes do ramo `}else if(command.type==='confirmPlan'){`:

```ts
 }else if(command.type==='importTransactions'){
  // Fatura importada: cada linha ganha um id novo e tudo é validado antes de gravar (tudo ou nada).
  if(!Array.isArray(command.items)||!command.items.length||command.items.length>250)throw new Error('Importação inválida');
  const rows=command.items.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Importação inválida');const item=validateItem('transactions',{...raw,id:crypto.randomUUID()});item._rev=1;return item;});
  if(s.transactions.length+rows.length>limitOf('transactions'))throw new Error('Limite de registros excedido');s.transactions.push(...rows);
```

Crie `lib/fatura-ai.ts`:

```ts
import {generateText,Output} from 'ai';import {z} from 'zod';import {agentModel} from './agent-runtime';import {normalizeAiFatura} from './fatura';
// Leitura da fatura com a IA: recebe só o texto (o PDF fica no aparelho) e devolve as linhas no formato de lib/fatura.
const INSTRUCTIONS=`Você lê o texto de faturas de cartão de crédito brasileiras e devolve só os dados, sem comentar.
- issuer: banco ou cartão emissor, ou null.
- closingDate e dueDate: data de fechamento e de vencimento em AAAA-MM-DD, ou null.
- total: total da fatura em centavos inteiros (R$ 1.234,56 = 123456), ou null.
- lines: uma linha por compra, saque, tarifa, IOF, juros ou estorno. date: data da compra em AAAA-MM-DD, com o ano deduzido pelo fechamento (compras de meses depois do mês do fechamento são do ano anterior). description: o texto da compra como está, mantendo "PARC 03/10" quando houver. amount: valor em centavos inteiros; estornos e créditos são negativos.
- Ignore pagamentos da fatura, saldo anterior, subtotais, totais e limites.`;
const schema=z.object({issuer:z.string().nullable(),closingDate:z.string().nullable(),dueDate:z.string().nullable(),total:z.number().int().nullable(),lines:z.array(z.object({date:z.string(),description:z.string(),amount:z.number().int()})).max(250)});
export async function readFaturaWithAi(text:string){const model=agentModel();if(!model)throw new Error('IA não configurada');
 const {output}=await generateText({model,instructions:INSTRUCTIONS,output:Output.object({schema}),prompt:text,maxOutputTokens:16000,providerOptions:{openai:{store:false}},abortSignal:AbortSignal.timeout(55000)});
 return normalizeAiFatura(output);}
```

Crie `app/api/finance/fatura/route.ts`:

```ts
import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {readFaturaWithAi} from '@/lib/fatura-ai';
export const dynamic='force-dynamic';export const maxDuration=60;
// "Ler com a IA" da importação de fatura: só o texto chega aqui (o PDF fica no aparelho) e nada é guardado.
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 let body:any;try{body=await request.json();}catch{return jsonError('Formato inválido',415);}
 const text=typeof body?.text==='string'?body.text:'';if(!text.trim())return jsonError('Envie o texto da fatura.',400);if(text.length>120000)return jsonError('Texto da fatura grande demais.',413);
 try{return Response.json(await readFaturaWithAi(text),{headers:{'Cache-Control':'no-store'}});}
 catch(e){const message=e instanceof Error?e.message:'';if(message==='IA não configurada')return jsonError('A leitura com IA não está configurada.',503);console.error('fatura:ai',message);return jsonError('Não consegui ler a fatura com a IA. Tente de novo.',502);}}
```

- [ ] **Step 4: Run the tests and checks**

- `node --experimental-strip-types --test tests/finance.test.mjs`: PASS;
- `npm test`: tudo verde;
- `npm run typecheck`;
- `npx eslint lib/fatura-ai.ts app/api/finance/fatura/route.ts`: sem problemas;
- `npx eslint lib/core.ts`: sem problemas novos;
- `npm run build`: a rota `/api/finance/fatura` aparece na lista de rotas.

- [ ] **Step 5: Commit**

```
git add lib/core.ts lib/fatura-ai.ts app/api/finance/fatura/route.ts tests/finance.test.mjs
git commit -m "Importação de fatura no core (tudo ou nada) e leitura com a IA só do texto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Assistente com a carteira

**Files:**
- Modify: `lib/agent.ts`:
  - imports, `PROPOSABLE`, `LABELS`, `FIELDS` e `searchRecords`;
  - `financeReport`, `proposalDefaults`, `checkProposals`, `describeProposal` e `proposalsText`.
- Modify: `lib/agent-runtime.ts` (esquema da proposta, descrições das ferramentas e regra de investimentos)
- Test: `tests/agent.test.mjs`

**Interfaces:**
- Consumes:
  - da Tarefa 1: `positions`, `portfolio`, `incomeInYear`, `kindInfo`, `moveLabel`, `monthEnd`, `formatQty`, `formatPrice`, `MOVES` e `INVEST_KINDS`;
  - da Tarefa 2: `checkInvestmentEvent`.
- Produces:
  - `financeReport(...).investimentos`, presente quando há ativos;
  - `PROPOSABLE` inclui `investmentEvents`;
  - título canônico da sugestão: `"<movimento> · <código ou nome>"`.

- [ ] **Step 1: Write the failing tests**

Em `tests/agent.test.mjs`, troque a linha 3 por:
```js
import { emptyWorkspace, formatMoney, applyCommand } from '../lib/core.ts';
```

e acrescente ao fim:

```js
const NB=String.fromCharCode(160);
test('relatório de finanças traz a carteira no fim do mês',()=>{const s=emptyWorkspace('Geo');s.investments=[{id:'p',title:'Petrobras',kind:'acao',ticker:'PETR4'},{id:'c',title:'CDB X',kind:'cdb'}];
 s.investmentEvents=[{id:'1',title:'Compra',assetId:'p',move:'buy',date:'2026-09-10',quantity:10,amount:30000},{id:'2',title:'Cotação',assetId:'p',move:'valuation',date:'2026-10-05',price:3500},{id:'3',title:'Compra',assetId:'c',move:'buy',date:'2026-09-01',amount:100000},{id:'4',title:'Dividendo',assetId:'p',move:'dividend',date:'2026-10-06',amount:250}];
 assert.deepEqual(financeReport(s,'2026-10').investimentos,{patrimonio:formatMoney(135000),investido:formatMoney(130000),resultado:formatMoney(5000),resultadoPct:'+3,8%',proventosNoAno:formatMoney(250),ativos:[{id:'c',nome:'CDB X',tipo:'CDB',valorAtual:formatMoney(100000),resultado:formatMoney(0)},{id:'p',nome:'Petrobras',codigo:'PETR4',tipo:'Ações',quantidade:'10',valorAtual:formatMoney(35000),resultado:formatMoney(5000),cotacaoEm:'2026-10-05'}]});
 assert.equal(financeReport(s,'2026-09').investimentos.patrimonio,formatMoney(130000));
 assert.equal(financeReport(emptyWorkspace('Geo'),'2026-10').investimentos,undefined);});
test('sugestão de movimento de investimento: ativo existente, ativo novo e erros',()=>{const s=emptyWorkspace('Geo');s.investments=[{id:'p',title:'Petrobras',kind:'acao',ticker:'PETR4'}];s.investmentEvents=[{id:'1',title:'Compra',assetId:'p',move:'buy',date:'2026-09-10',quantity:10,amount:30000}];
 const today='2026-10-18';
 const {valid,errors}=checkProposals([{collection:'investmentEvents',title:'x',assetId:'p',move:'buy',quantity:10,amount:38000},{collection:'investmentEvents',title:'x',move:'dividend',amount:1240,newAsset:{title:'Maxi Renda',kind:'fii',ticker:'MXRF11'}},{collection:'investmentEvents',title:'x',assetId:'p',move:'sell',quantity:20,amount:1000},{collection:'investmentEvents',title:'x',assetId:'zz',move:'buy',quantity:1,amount:100}],today,s);
 assert.deepEqual(valid.map(p=>[p.item.title,p.item.date,p.item.assetId??null,describeProposal(p)]),[['Compra · PETR4','2026-10-18','p','10 un. · R$'+NB+'380,00 · 2026-10-18'],['Dividendo · MXRF11','2026-10-18',null,'R$'+NB+'12,40 · 2026-10-18']]);
 assert.deepEqual(errors,['x: Você tem só 10 nessa data.','x: Selecione um ativo da carteira']);
 const cot=checkProposals([{collection:'investmentEvents',title:'x',assetId:'p',move:'valuation',price:3500}],today,s).valid[0];
 assert.equal(cot.item.title+' — '+describeProposal(cot),'Cotação · PETR4 — R$'+NB+'35,00 · 2026-10-18');});
test('confirmar duas vezes a sugestão com ativo novo cria um ativo só',()=>{const s=emptyWorkspace('Geo'),today='2026-10-18';
 const {valid}=checkProposals([{collection:'investmentEvents',title:'x',move:'buy',quantity:2,amount:70000000,newAsset:{title:'Bitcoin',kind:'cripto',ticker:'btc'}}],today,s);
 let r=applyCommand(s,{type:'confirmPlan',items:valid},today);r=applyCommand(r,{type:'confirmPlan',items:valid},today);
 assert.deepEqual([r.investments.length,r.investments[0].ticker,r.investmentEvents.length],[1,'BTC',1]);});
test('histórico das sugestões não chama movimento de investimento de despesa',()=>{
 const text=proposalsText([{collection:'investmentEvents',item:{title:'Compra · PETR4',amount:38000,date:'2026-10-18'}}]);
 assert.ok(text.endsWith('- [Investimento] Compra · PETR4 · R$'+NB+'380,00 · 2026-10-18'));});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test tests/agent.test.mjs`
Expected: FAIL:
- `investimentos` é undefined;
- "só é possível sugerir…";
- "(despesa)" no texto.

- [ ] **Step 3: Implement**

`lib/agent.ts`:
1. Troque `import { validDate, addDays, isComplete, financeSummary, formatMoney, validateItem } from './core.ts';` por:
```ts
import { validDate, addDays, isComplete, financeSummary, formatMoney, validateItem, checkInvestmentEvent } from './core.ts';
import { positions, portfolio, incomeInYear, kindInfo, moveLabel, monthEnd, formatQty, formatPrice } from './invest.ts';
```
2. `PROPOSABLE`: acrescente `'investmentEvents'` no fim. Em `LABELS`, acrescente `investmentEvents:'Investimento'`.
3. Em `FIELDS`, a lista de campos da busca, acrescente `'kind','ticker','broker','assetId','move','quantity','price','rate','indexer'`.
4. Em `searchRecords`, no `.map` final, troque o corpo do laço por um que formata a cotação e inclui o id dos ativos:
```ts
  .map(({collection,item})=>{const out:Record<string,unknown>={collection};if(collection==='investments')out.id=item.id;for(const key of FIELDS){const v=item[key];if(v===undefined||v===null||v==='')continue;out[key]=['amount','costPerDay'].includes(key)&&typeof v==='number'?formatMoney(v):key==='price'&&typeof v==='number'?formatPrice(v):typeof v==='string'?clip(v):v;}return out;});
```
5. Em `financeReport`, logo antes da linha `return {mes:month,…};`, acrescente:
```ts
 // Carteira no fim do mês pedido (movimentos nunca têm data futura, então no mês atual é a posição de hoje).
 const until=monthEnd(month),pos=positions(s.investments,s.investmentEvents,until).filter(p=>!p.closed),t=portfolio(pos);
 const investimentos=s.investments.length?{investimentos:{patrimonio:formatMoney(t.value),investido:formatMoney(t.invested),resultado:formatMoney(t.unrealized),resultadoPct:(t.pct>0?'+':'')+String(t.pct).replace('.',',')+'%',proventosNoAno:formatMoney(incomeInYear(s.investmentEvents,month.slice(0,4),until)),ativos:pos.slice(0,30).map(p=>({id:p.asset.id,nome:p.asset.title,...(p.asset.ticker?{codigo:p.asset.ticker}:{}),tipo:kindInfo(p.asset.kind).label,...(p.mode==='quantity'?{quantidade:formatQty(p.quantity)}:{}),valorAtual:formatMoney(p.value),resultado:formatMoney(p.unrealized),...(p.priceDate?{cotacaoEm:p.priceDate}:{})}))}}:{};
```
   Na própria linha `return {mes:month,…};`, não mude nenhum campo. Só acrescente `,...investimentos` logo antes do `}` que fecha o objeto. Ela termina em `…situacao:SITUACAO[c.state]}))};`, e passa a terminar em `…situacao:SITUACAO[c.state]})),...investimentos};`.
6. Em `proposalDefaults`, antes de `return {};`:
```ts
 if(collection==='investmentEvents')return {date:today};
```
7. Em `checkProposals`, troque `valid.push({collection:collection as Collection,item:validateItem(collection as Collection,{...proposalDefaults(collection,fields,today,s),...fields})});` por:
```ts
   const item=validateItem(collection as Collection,{...proposalDefaults(collection,fields,today,s),...fields});
   // Movimento de investimento: confere ativo, data e posição agora; o título diz o que é ("Compra · PETR4").
   if(collection==='investmentEvents'&&s){const asset=checkInvestmentEvent(s,item,today),a=asset||item.newAsset;item.title=moveLabel(item.move,a.kind)+' · '+(a.ticker||a.title);if(asset){item.assetId=asset.id;delete item.newAsset;}}
   valid.push({collection:collection as Collection,item});
```
8. `describeProposal`: no começo da cadeia de ternários, antes de `p.collection==='intimacy'?…`, acrescente:
```ts
p.collection==='investmentEvents'?[typeof p.item.quantity==='number'?formatQty(p.item.quantity)+' un.':'',p.item.move==='valuation'&&typeof p.item.price==='number'?formatPrice(p.item.price):typeof p.item.amount==='number'?formatMoney(p.item.amount):''].filter(Boolean).join(' · '):
```
9. Em `proposalsText`, troque `(typeof i.amount==='number'?' · '+formatMoney(i.amount)+(i.direction==='income'?' (receita)':' (despesa)'):'')` por:
```ts
(typeof i.amount==='number'?' · '+formatMoney(i.amount)+(p.collection==='transactions'?(i.direction==='income'?' (receita)':' (despesa)'):''):'')
```

`lib/agent-runtime.ts`:
1. Acrescente o import `import {MOVES,INVEST_KINDS} from './invest';`.
2. **Esquema `proposal`:**
   - no `.describe` de `collection`, acrescente `; investmentEvents: compra, venda, provento ou cotação de investimento que a pessoa contou`;
   - no fim do `z.object({...})`, acrescente:
```ts
assetId:z.string().optional().describe('investmentEvents: id do ativo (ferramenta financas)'),move:z.enum(MOVES).optional().describe('investmentEvents: buy compra ou aplicação, sell venda ou resgate, dividend, yield rendimento, interest juros, valuation cotação ou valor atual'),quantity:z.number().positive().optional().describe('investmentEvents: quantidade de ações, cotas ou moedas'),price:z.number().positive().optional().describe('investmentEvents valuation de ações, FIIs, ETFs ou cripto: cotação por unidade em centavos (R$ 38,50 = 3850)'),newAsset:z.object({title:z.string(),kind:z.enum(INVEST_KINDS.map(k=>k.id) as [string,...string[]]),ticker:z.string().optional(),broker:z.string().optional()}).optional().describe('investmentEvents: ativo que ainda não está na carteira')
```
3. **Regra** (perto de `FEMALE_RULES`):
```ts
// Regras de investimentos: valem para todos os perfis.
const INVEST_RULES="Investimentos: consulte financas antes de falar da carteira. Explique os números, mas nunca recomende comprar, vender ou escolher ativos; as cotações são as informadas pela pessoa. Para registrar um movimento, use propor_acoes com investmentEvents e o assetId; para um ativo novo, envie newAsset.";
```
   Em `agentInstructions`, logo antes de `${hiddenSections(state.profile.gender).includes('testosterona')?…`, acrescente `${INVEST_RULES}\n`.
4. **Descrições das ferramentas:**
   - **financas:** `'Resumo financeiro de um mês: receitas, despesas, saldo, teto do mês, tetos por categoria, despesas por categoria e a carteira de investimentos (patrimônio, resultado, proventos e ativos com id).'`;
   - **buscar:** acrescente no fim da lista de coleções `, investments (ativos de investimento), investmentEvents (movimentos de investimento)` (antes do ponto final);
   - **propor_acoes:** `'Mostra ao usuário sugestões de tarefas, lançamentos, notas, aplicações de testosterona, registros da Saúde feminina (menstruação, uso do método, relação) ou movimentos de investimento para revisar e confirmar. Não salva nada.'`.

- [ ] **Step 4: Run the tests and checks**

- `node --experimental-strip-types --test tests/agent.test.mjs`: PASS;
- `npm test`: tudo verde, incluindo `chat-actions` e `telegram`;
- `npm run typecheck`;
- `npx eslint lib/agent.ts lib/agent-runtime.ts`: sem problemas novos;
- `npm run build`.

- [ ] **Step 5: Commit**

```
git add lib/agent.ts lib/agent-runtime.ts tests/agent.test.mjs
git commit -m "Assistente vê a carteira e sugere compras, vendas, proventos e cotações" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Aba Investimentos e formulários

**Files:**
- Create: `components/norte/finance-invest.tsx`
- Modify: `components/norte/finance.tsx` (aba nova)
- Modify: `components/norte/catalog.ts`:
  - `Field.showIf` recebe o estado;
  - formulários de `investments` e `investmentEvents`;
  - `SAVE_COMMAND`.
- Modify: `components/norte/primitives.tsx` (Editor: `showIf(values,state)`, tipo `price`, número com vírgula, conversão de dinheiro sem repetir e `SAVE_COMMAND`)
- Modify: `components/norte/NorteApp.tsx` (texto de confirmação ao excluir um ativo)
- Modify: `app/globals.css` (classes `fin-invest-*`)

**Interfaces:**
- Consumes:
  - da Tarefa 1: `positions`, `portfolio`, `incomeInYear`, `kindInfo`, `moveLabel`, `formatRate`, `formatPrice`, `formatQty`, `monthEnd`, `INCOME_MOVES`, `Position`, `INVEST_KINDS`, `INDEXERS`, `FIXED_INCOME`, `MOVE_OPTIONS`, `modeOf` e `priceToCents`;
  - da Tarefa 2: os comandos do core.
- Produces:
  - `FinanceTab` inclui `'invest'`;
  - `SAVE_COMMAND`, exportado de `catalog.ts`;
  - `Field.showIf?:(values:any,state:Workspace)=>boolean`.

Antes de editar, rode `npx eslint components/norte/catalog.ts components/norte/primitives.tsx components/norte/NorteApp.tsx` e anote a contagem de problemas.

- [ ] **Step 1: Catalog** — em `components/norte/catalog.ts`:
  - troque `import type {Collection,Workspace} from '@/lib/types';` por `import type {Collection,Workspace,Command} from '@/lib/types';`;
  - acrescente `import {INVEST_KINDS,INDEXERS,FIXED_INCOME,MOVE_OPTIONS,modeOf} from '@/lib/invest';`;
  - no tipo `Field`, troque `showIf?:(values:any)=>boolean` por `showIf?:(values:any,state:Workspace)=>boolean`;
  - logo depois de `const cat=…`, acrescente:
```ts
const qtyMode=(v:any,s:Workspace)=>modeOf(s.investments.find(x=>x.id===v.assetId)?.kind)==='quantity';
```
  - troque `investments:[],investmentEvents:[]` (da Tarefa 2) por:
```ts
investments:[{...title,label:'Nome',hint:'Ex.: Tesouro Selic 2029, Petrobras, Bitcoin'},{key:'kind',label:'Tipo',type:'select',options:INVEST_KINDS.map(k=>[k.id,k.label]),default:'cdb'},{key:'ticker',label:'Código',hint:'Ex.: PETR4, MXRF11, BTC'},{key:'broker',label:'Corretora ou banco'},
 {key:'indexer',label:'Indexador',type:'select',options:INDEXERS.map(([v,l])=>[v,l]),default:'cdi',showIf:v=>FIXED_INCOME.includes(v.kind)},{key:'rate',label:'Taxa (%)',type:'number',step:'any',showIf:v=>FIXED_INCOME.includes(v.kind)&&v.indexer!=='none'},{key:'dueDate',label:'Vencimento',type:'date',showIf:v=>FIXED_INCOME.includes(v.kind)},
 {key:'date',label:'Data da primeira aplicação',type:'date',required:true,showIf:v=>!v.id},{key:'quantity',label:'Quantidade',type:'number',step:'any',required:true,showIf:v=>!v.id&&modeOf(v.kind)==='quantity'},{key:'amount',label:'Valor aplicado (R$)',type:'money',required:true,showIf:v=>!v.id},notes],
investmentEvents:[{key:'assetId',label:'Ativo',type:'select',source:'investments',required:true},{key:'move',label:'Movimento',type:'select',options:MOVE_OPTIONS,default:'buy'},date,
 {key:'quantity',label:'Quantidade',type:'number',step:'any',required:true,showIf:(v,s)=>(v.move==='buy'||v.move==='sell')&&qtyMode(v,s)},
 {key:'price',label:'Cotação (R$)',type:'price',required:true,showIf:(v,s)=>v.move==='valuation'&&qtyMode(v,s)},
 {key:'amount',label:'Valor total (R$)',type:'money',required:true,showIf:v=>v.move==='buy'||v.move==='sell'},
 {key:'amount',label:'Valor (R$)',type:'money',required:true,showIf:v=>['dividend','yield','interest'].includes(v.move)},
 {key:'amount',label:'Valor atual (R$)',type:'money',required:true,showIf:(v,s)=>v.move==='valuation'&&!qtyMode(v,s)},notes],
```
  - no fim do arquivo:
```ts
// Ativo novo é salvo com a primeira aplicação, num só movimento de compra que traz o ativo (o core cria os dois).
export const SAVE_COMMAND:Partial<Record<Collection,(item:any,isNew:boolean)=>Command>>={investments:(item,isNew)=>{if(!isNew)return {type:'upsert',collection:'investments',item};const {date,quantity,amount,...asset}=item;return {type:'upsert',collection:'investmentEvents',item:{id:item.id+'-1',move:'buy',date,quantity,amount,newAsset:asset}};}};
```

- [ ] **Step 2: Editor** — em `components/norte/primitives.tsx`:
  1. **Imports:**
     - troque `import {FIELDS,COLLECTION_LABELS,relationOptions} from './catalog';` por `import {FIELDS,COLLECTION_LABELS,relationOptions,SAVE_COMMAND} from './catalog';`;
     - acrescente `import {priceToCents} from '@/lib/invest';`.
  2. **Valores iniciais:** troque `for(const field of fields)if(field.type==='money'&&initial[field.key]!==undefined)initial[field.key]=(initial[field.key]/100).toFixed(2).replace('.',',');` pelo código abaixo. Um campo pode aparecer mais de uma vez com `showIf` diferente, e a conversão não pode acontecer duas vezes.
```ts
 for(const key of new Set(fields.filter(x=>x.type==='money').map(x=>x.key)))if(typeof initial[key]==='number')initial[key]=(initial[key]/100).toFixed(2).replace('.',',');
 for(const key of new Set(fields.filter(x=>x.type==='price').map(x=>x.key)))if(typeof initial[key]==='number')initial[key]=String(initial[key]/100).replace('.',',');
```
  3. **Campos visíveis:** troque `fields.filter(f=>!f.showIf||f.showIf(values))` por `fields.filter(f=>!f.showIf||f.showIf(values,state))`.
  4. **Envio (`submit`):** troque o laço de conversão e o `onSave` por:
```ts
for(const f of shown){if(f.type==='money'&&record[f.key]!==undefined&&record[f.key]!=='')record[f.key]=moneyToCents(record[f.key]);else if(f.type==='price'&&record[f.key]!==undefined&&record[f.key]!=='')record[f.key]=priceToCents(record[f.key]);else if(f.type==='number'||['mood','quality'].includes(f.key))if(record[f.key]!==''&&record[f.key]!==undefined)record[f.key]=Number(String(record[f.key]).replace(',','.'));}setSaving(true);const save=installments?undefined:SAVE_COMMAND[collection];const ok=await onSave(save?save(record,!item):{type:installments?'installments':'upsert',collection,item:record});
```
  5. **`<input>` genérico:**
     - troque `type={f.type==='money'?'text':f.type||'text'}` por `type={f.type==='money'||f.type==='price'?'text':f.type||'text'}`;
     - troque `inputMode={f.type==='money'?'decimal':undefined}` por `inputMode={f.type==='money'||f.type==='price'?'decimal':undefined}`.

- [ ] **Step 3: Aba** — crie `components/norte/finance-invest.tsx`:

```tsx
'use client';
import {useState} from 'react';import {Plus,TrendingUp,ArrowDownToLine,ArrowUpFromLine,Coins,RefreshCw} from 'lucide-react';
import {useApp} from './context';import {Empty,Stat,RecordActions} from './primitives';import type {FinanceProps} from './finance';
import {positions,portfolio,incomeInYear,kindInfo,moveLabel,formatRate,formatPrice,formatQty,monthEnd,INCOME_MOVES,type Position} from '@/lib/invest';
// Carteira na posição do fim do mês escolhido (no mês atual e nos futuros, a de hoje); fica fora do saldo, dos gastos e do CSV.
const ddmm=(d:string)=>d.slice(8,10)+'/'+d.slice(5,7);
export function FinanceInvest({month,money,hidden}:FinanceProps){const a=useApp();const [filter,setFilter]=useState('');
 const until=month>=a.today.slice(0,7)?a.today:monthEnd(month),year=until.slice(0,4);
 const list=positions(a.state.investments,a.state.investmentEvents,until),t=portfolio(list),income=incomeInYear(a.state.investmentEvents,year,until);
 const shown=filter?list.filter(p=>kindInfo(p.asset.kind).id===filter):list;
 const recent=a.state.investmentEvents.map((e,i)=>({e,i})).filter(({e})=>typeof e.date==='string'&&e.date<=until).sort((x,y)=>y.e.date.localeCompare(x.e.date)||y.i-x.i).slice(0,8).map(({e})=>e);
 const price=(c:number)=>hidden?'•••••':formatPrice(c),pct=(n:number)=>hidden?'•••••':(n>0?'+':'')+String(n).replace('.',',')+'%',signed=(c:number)=>(c>0?'+':'')+money(c);
 const move=(p:Position,m:string)=>a.edit('investmentEvents',undefined,{assetId:p.asset.id,move:m});
 if(!a.state.investments.length)return <section className="panel"><Empty title="Nenhum ativo ainda" description="Cadastre CDB, Tesouro, ações, FIIs, ETFs e o restante da carteira." action="Começar carteira" onAction={()=>a.edit('investments')} icon={TrendingUp}/></section>;
 return <><div className="stats-grid fin-invest-stats"><Stat label="Patrimônio" value={money(t.value)} foot={t.count?t.count+(t.count===1?' ativo':' ativos'):'Carteira vazia'} accent/><Stat label="Investido" value={money(t.invested)} foot="Custo da posição atual"/>
   <Stat label="Resultado" value={<span className={t.unrealized<0?'fin-invest-neg':'positive'}>{signed(t.unrealized)}</span>} foot={t.invested?pct(t.pct)+' não realizado':'Atualize as cotações para ver o resultado'}/><Stat label="Proventos no ano" value={money(income)} foot={'Dividendos, rendimentos e juros em '+year}/></div>
  <section className="panel"><header className="section-heading"><h2>Alocação</h2>{filter&&<button className="button ghost small" onClick={()=>setFilter('')}>Ver tudo</button>}</header>
   {t.allocation.length?<ul className="fin-bars">{t.allocation.map(r=>{const share=Math.round(r.share*100);return <li key={r.kind}><span className="fin-invest-dot" style={{background:r.color}}/><div><p><button className={'fin-invest-kind'+(filter===r.kind?' active':'')} aria-pressed={filter===r.kind} onClick={()=>setFilter(filter===r.kind?'':r.kind)}>{r.label}</button><b>{money(r.value)} · {share}%</b></p><span className="fin-bar"><i className="cat" style={{width:Math.max(2,share)+'%',background:r.color}}/></span></div></li>;})}</ul>:<p className="quiet-copy padded">Nenhum ativo com valor nesta data.</p>}</section>
  <section className="panel"><header className="section-heading"><h2>Ativos{filter?' · '+kindInfo(filter).label:''}</h2><button className="button primary small" onClick={()=>a.edit('investments')}><Plus size={16}/>Novo ativo</button></header>
   <ul className="fin-invest-list">{shown.map(p=>{const k=kindInfo(p.asset.kind),v=p.mode==='value',extra=[k.label,p.asset.ticker&&p.asset.title!==p.asset.ticker?p.asset.title:'',p.asset.broker,formatRate(p.asset),p.asset.dueDate?'vence '+ddmm(p.asset.dueDate)+'/'+p.asset.dueDate.slice(0,4):''].filter(Boolean).join(' · ');
    return <li key={p.asset.id}><span className="fin-invest-badge" style={{background:k.color}} aria-hidden="true">{(p.asset.ticker||k.label).slice(0,4)}</span><div className="fin-invest-main">
     <p><b>{p.asset.ticker||p.asset.title}</b><strong>{money(p.value)}</strong></p><small>{extra}</small>
     <p className="fin-invest-nums"><span>custo {money(p.invested)}</span><span className={'pill '+(p.unrealized<0?'danger':'green')}>{signed(p.unrealized)}{p.invested?' · '+pct(p.pct):''}</span></p>
     {p.closed?<small>Posição encerrada</small>:!v&&p.quantity>0?<small>{formatQty(p.quantity)} un. · médio {price(p.avgPrice)}{p.lastPrice?' · cotação '+price(p.lastPrice)+(p.priceDate?' em '+ddmm(p.priceDate):''):''}</small>:v&&p.priceDate?<small>Atualizado em {ddmm(p.priceDate)}</small>:null}
     <div className="fin-invest-actions"><button className="button outline small" onClick={()=>move(p,'valuation')}><RefreshCw size={14}/>{v?'Atualizar valor':'Atualizar cotação'}</button><button className="button outline small" onClick={()=>move(p,'buy')}><ArrowDownToLine size={14}/>{v?'Aplicar':'Comprar'}</button><button className="button outline small" onClick={()=>move(p,'sell')}><ArrowUpFromLine size={14}/>{v?'Resgatar':'Vender'}</button><button className="button outline small" onClick={()=>move(p,'dividend')}><Coins size={14}/>Provento</button><RecordActions item={p.asset} onEdit={()=>a.edit('investments',p.asset)} onDelete={()=>a.remove('investments',p.asset)}/></div></div></li>;})}</ul></section>
  <section className="panel"><header className="section-heading"><h2>Movimentos recentes</h2><button className="button outline small" onClick={()=>a.edit('investmentEvents')}><Plus size={16}/>Movimento</button></header>
   {recent.length?<ul className="fin-top fin-invest-moves">{recent.map(e=>{const asset=a.state.investments.find(x=>x.id===e.assetId),k=kindInfo(asset?.kind),inc=INCOME_MOVES.includes(e.move);
    return <li key={e.id}><span className="fin-invest-badge small" style={{background:k.color}} aria-hidden="true">{(asset?.ticker||k.label).slice(0,4)}</span><span><b>{asset?.ticker||asset?.title||'Ativo'}</b><small>{moveLabel(e.move,asset?.kind)} · {ddmm(e.date)}</small></span><strong className={inc?'positive':''}>{inc?'+ ':e.move==='sell'?'− ':''}{e.move==='valuation'&&e.price?price(e.price):money(e.amount||0)}</strong><RecordActions item={e} onEdit={()=>a.edit('investmentEvents',e)} onDelete={()=>a.remove('investmentEvents',e)}/></li>;})}</ul>:<p className="quiet-copy padded">Compras, resgates e proventos aparecem aqui.</p>}</section>
  <p className="quiet-copy fin-invest-foot">As cotações são as que você informa.</p></>;}
```

- [ ] **Step 4: Moldura, confirmação e CSS**

`components/norte/finance.tsx`:
- **Import:** acrescente `import {FinanceInvest} from './finance-invest';`.
- **Tipo:** `export type FinanceTab='overview'|'transactions'|'budget'|'reports'|'invest'|'bills'|'cards';`.
- **`TABS`:** depois de `{id:'reports',label:'Relatórios'}`, acrescente `{id:'invest',label:'Investimentos'}`.
- **Renderização:** depois de `{tab==='reports'&&<FinanceReports {...p}/>}`, acrescente `{tab==='invest'&&<FinanceInvest {...p}/>}`.

`components/norte/NorteApp.tsx`, no modal `confirm`: troque o texto fixo `Essa ação remove o registro do seu espaço. Os pontos que você já conquistou permanecem na sua jornada.` por `{confirm.collection==='investments'?'Essa ação remove o ativo e todos os movimentos dele.':'Essa ação remove o registro do seu espaço. Os pontos que você já conquistou permanecem na sua jornada.'}`.

`app/globals.css`: acrescente depois da linha do `.fin-top` (a regra `.fin-top{list-style:none;…}`):
```css
.fin-invest-stats{grid-template-columns:repeat(4,minmax(0,1fr))}.fin-invest-neg{color:var(--danger)}
.fin-invest-dot{width:12px;height:12px;border-radius:4px;margin-top:4px;flex:none}
.fin-invest-kind{border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;text-align:left}.fin-invest-kind.active{color:var(--green);font-weight:700}
.fin-invest-list{list-style:none;margin:0;padding:0}.fin-invest-list>li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;padding:16px 24px;border-top:1px solid var(--border)}
.fin-invest-badge{display:inline-grid;place-items:center;flex:none;width:42px;height:42px;border-radius:12px;color:#fff;font-size:10px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;overflow:hidden}.fin-invest-badge.small{width:34px;height:34px;border-radius:10px;font-size:9px}
.fin-invest-main{min-width:0;display:grid;gap:5px}.fin-invest-main>p{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0;font-size:14px}.fin-invest-main small{color:var(--muted);font-size:12px;overflow-wrap:anywhere}
.fin-invest-main>p.fin-invest-nums{font-size:12px;color:var(--muted)}
.fin-invest-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}
.fin-invest-moves li{grid-template-columns:auto minmax(0,1fr) auto auto}
.fin-invest-foot{margin:4px 2px 0;font-size:12px}
:root[data-theme=dark] .fin-invest-dot{filter:brightness(1.6) saturate(.9)}
@media(max-width:900px){.fin-invest-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:580px){.fin-invest-list>li{padding:14px 18px;gap:12px}.fin-invest-moves li{grid-template-columns:auto minmax(0,1fr) auto}.fin-invest-moves .record-actions{grid-column:2/-1;justify-self:end}}
```

- [ ] **Step 5: Run the checks**

- `npm test`;
- `npm run typecheck`;
- `npx eslint components/norte/finance-invest.tsx components/norte/finance.tsx`: sem problemas;
- `npx eslint components/norte/catalog.ts components/norte/primitives.tsx components/norte/NorteApp.tsx`: sem problemas novos (compare com a contagem de antes);
- `npm run build`.

- [ ] **Step 6: Commit**

```
git add components/norte/finance-invest.tsx components/norte/finance.tsx components/norte/catalog.ts components/norte/primitives.tsx components/norte/NorteApp.tsx app/globals.css
git commit -m "Aba Investimentos: carteira, alocação, ativos com ações rápidas e movimentos recentes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tela de importar fatura

**Files:**
- Modify: `package.json`, `package-lock.json` (`unpdf` 1.8.1, versão exata)
- Create: `components/norte/fatura-pdf.ts`
- Create: `components/norte/finance-fatura.tsx`
- Modify: `components/norte/finance-transactions.tsx` (botão Importar fatura)
- Modify: `components/norte/finance-accounts.tsx` (botão em cada cartão)
- Modify: `app/globals.css` (classes `fin-fatura-*`)

**Interfaces:**
- Consumes:
  - da Tarefa 3: `parseFaturaText`, `faturaFromLines`, `faturaItems`, `FaturaResult` e `FaturaRow`;
  - `budgetAlerts`, `EXPENSE_CATEGORIES` e `INCOME_CATEGORIES` de `@/lib/finance`;
  - da Tarefa 4: o comando `importTransactions` e a rota `/api/finance/fatura`.
- Produces:
  - `pdfText(file,password?)`, que devolve `Promise<string>`;
  - o componente `FaturaImport({cardId?,money,onClose})`.

- [ ] **Step 1: Instale a dependência**

Run: `npm install unpdf@1.8.1 --save-exact`
Expected: `package.json` com `"unpdf": "1.8.1"` em `dependencies`, e o `package-lock.json` atualizado.

- [ ] **Step 2: Leitura do PDF** — crie `components/norte/fatura-pdf.ts`:

```ts
// Lê no aparelho o texto de um PDF de fatura; o unpdf só é baixado quando a pessoa importa uma fatura.
export async function pdfText(file:File,password?:string):Promise<string>{
 if(file.size>10*1024*1024||!(file.type==='application/pdf'||/\.pdf$/i.test(file.name)))throw new Error('Escolha um PDF de até 10 MB.');
 const {getDocumentProxy,extractText}=await import('unpdf');
 try{const pdf=await getDocumentProxy(new Uint8Array(await file.arrayBuffer()),password?{password}:undefined);const {text}=await extractText(pdf,{mergePages:false});return (Array.isArray(text)?text:[text]).join('\n');}
 catch(e){const err=e as {name?:string;code?:number};
  // PasswordException do pdf.js: código 1 pede senha, código 2 é senha errada.
  if(err?.name==='PasswordException')throw new Error(err.code===2||password?'Senha do PDF incorreta.':'Esta fatura está protegida. Informe a senha do PDF.');
  throw new Error('Não consegui ler este PDF. Tente exportar de novo pelo app do banco.');}}
```

- [ ] **Step 3: Janela de importação** — crie `components/norte/finance-fatura.tsx`:

```tsx
'use client';
import {useRef,useState} from 'react';import {FileUp,LoaderCircle,Sparkles,Check} from 'lucide-react';
import {useApp} from './context';import {Modal} from './primitives';import {pdfText} from './fatura-pdf';
import {parseFaturaText,faturaFromLines,faturaItems,type FaturaResult,type FaturaRow} from '@/lib/fatura';import {EXPENSE_CATEGORIES,INCOME_CATEGORIES,budgetAlerts} from '@/lib/finance';
// Importar fatura: o PDF é lido no aparelho; "Ler com a IA" manda só o texto quando as regras não dão conta.
const ddmm=(d:string)=>d.slice(8,10)+'/'+d.slice(5,7);
export function FaturaImport({cardId='',money,onClose}:{cardId?:string;money:(cents:number)=>string;onClose:()=>void}){const a=useApp();
 const [card,setCard]=useState(cardId),[file,setFile]=useState<File|null>(null),[password,setPassword]=useState(''),[busy,setBusy]=useState<''|'reading'|'ai'|'saving'>(''),[error,setError]=useState(''),[result,setResult]=useState<FaturaResult|null>(null),[rows,setRows]=useState<FaturaRow[]>([]),text=useRef('');
 const ctx={transactions:a.state.transactions,today:a.today};
 const show=(r:FaturaResult)=>{setResult(r);setRows(r.rows);};
 async function read(e:React.FormEvent){e.preventDefault();if(!file)return;setError('');setBusy('reading');try{text.current=await pdfText(file,password.trim()||undefined);show(parseFaturaText(text.current,ctx));}catch(err){setError(err instanceof Error?err.message:'Não consegui ler este PDF.');}finally{setBusy('');}}
 async function withAi(){setError('');setBusy('ai');try{const r=await fetch('/api/finance/fatura',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.current})});const j:any=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(j.lines))throw new Error(j.error||'Não consegui ler a fatura com a IA. Tente de novo.');show(faturaFromLines(j.lines,j.meta,ctx));}catch(err){setError(err instanceof Error?err.message:'Não consegui ler a fatura com a IA. Tente de novo.');}finally{setBusy('');}}
 const chosen=rows.filter(r=>r.selected),total=chosen.reduce((s,r)=>s+(r.direction==='income'?-r.amount:r.amount),0);
 const patch=(key:string,p:Partial<FaturaRow>)=>setRows(list=>list.map(r=>r.key===key?{...r,...p}:r));
 async function save(){const items=faturaItems(rows,card||undefined);if(!items.length)return;const alerts=budgetAlerts(a.state,items.map(item=>({collection:'transactions',item})));setBusy('saving');
  const ok=await a.mutate({type:'importTransactions',items});setBusy('');if(ok){a.toast([items.length+(items.length===1?' lançamento importado.':' lançamentos importados.'),...alerts].join(' '));onClose();}}
 const aiButton=<button type="button" className="button outline small" disabled={!!busy} onClick={withAi}>{busy==='ai'?<LoaderCircle className="spin" size={15}/>:<Sparkles size={15}/>}Ler com a IA</button>;
 return <Modal wide title="Importar fatura" subtitle="O PDF é lido no seu aparelho." onClose={()=>!busy&&onClose()}>
  {!result?<form onSubmit={read}><div className="form-grid">
   <label className="field full"><span>Cartão</span><select aria-label="Cartão" value={card} onChange={e=>setCard(e.target.value)}><option value="">Sem cartão</option>{a.state.cards.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
   <label className="field full"><span>Arquivo PDF</span><input aria-label="Arquivo PDF" type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <label className="field full"><span>Senha do PDF (se tiver)</span><input aria-label="Senha do PDF" type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label></div>
   {error&&<p role="alert" className="form-error">{error}</p>}
   <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose} disabled={!!busy}>Cancelar</button><button className="button primary" disabled={!file||!!busy}>{busy==='reading'?<LoaderCircle className="spin" size={17}/>:<FileUp size={17}/>}{busy==='reading'?'Lendo…':'Ler fatura'}</button></footer></form>
  :<div className="fin-fatura">
   <p className="fin-fatura-meta">{result.issuer}{result.dueDate?' · vence '+ddmm(result.dueDate):''} · {rows.length} lidos · {chosen.length} selecionados · {money(total)}</p>
   {!rows.length&&<div className="fin-warning">Não achei lançamentos neste PDF. {aiButton}</div>}
   {rows.length>0&&result.mismatch&&result.total!==null&&<div className="fin-warning">A soma lida ({money(result.sum)}) não bate com o total da fatura ({money(result.total)}). Pode faltar alguma linha. {aiButton}</div>}
   {(!rows.length||result.mismatch)&&<p className="fin-fatura-note">Só o texto da fatura vai para a OpenAI para ser lido. Nada fica guardado.</p>}
   {result.truncated&&<p className="fin-fatura-note">Mostrando as 250 primeiras linhas.</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   {rows.length>0&&<><div className="fin-fatura-tools"><button type="button" className="button ghost small" onClick={()=>setRows(l=>l.map(r=>({...r,selected:true})))}>Marcar todos</button><button type="button" className="button ghost small" onClick={()=>setRows(l=>l.map(r=>({...r,selected:false})))}>Desmarcar todos</button></div>
    <ul className="fin-fatura-list">{rows.map(r=><li key={r.key} className={r.selected?'':'off'}><input type="checkbox" aria-label={'Lançar '+r.title} checked={r.selected} onChange={e=>patch(r.key,{selected:e.target.checked})}/><div>
     <p><span>{r.title}</span><b>{r.direction==='income'?'+ ':''}{money(r.amount)}</b></p>
     <div className="fin-fatura-tags"><time>{ddmm(r.date)}</time><select aria-label={'Categoria de '+r.title} value={r.category} onChange={e=>patch(r.key,{category:e.target.value})}>{(r.direction==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES).map(c=><option key={c} value={c}>{c}</option>)}</select>{r.installment&&<span className="pill">Parcela {r.installment}</span>}{r.duplicate&&<span className="pill warn">Já lançado</span>}{r.refund&&<span className="pill">Estorno</span>}</div>
     {r.reason&&<small>{r.reason}</small>}</div></li>)}</ul></>}
   <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose} disabled={!!busy}>Cancelar</button><button type="button" className="button primary" disabled={!chosen.length||!!busy} onClick={save}>{busy==='saving'?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>}Lançar {chosen.length}</button></footer></div>}
 </Modal>;}
```

- [ ] **Step 4: Botões de entrada**

`components/norte/finance-transactions.tsx`:
- **Imports:** acrescente `FileUp` ao import de `lucide-react` e acrescente `import {FaturaImport} from './finance-fatura';`.
- **Estado:** no começo do componente, `const [importing,setImporting]=useState(false);`.
- **Botão:** no grupo de botões do cabeçalho, depois do botão "Compra parcelada":
```tsx
<button className="button outline small" onClick={()=>setImporting(true)}><FileUp size={16}/>Importar fatura</button>
```
- **Janela:** logo antes de `</section>` final:
```tsx
{importing&&<FaturaImport money={money} onClose={()=>setImporting(false)}/>}
```

`components/norte/finance-accounts.tsx`:
- **Imports:** troque `import {Plus,Check,CreditCard} from 'lucide-react';` por `import {useState} from 'react';import {Plus,Check,CreditCard,FileUp} from 'lucide-react';` e acrescente `import {FaturaImport} from './finance-fatura';`.
- **Estado:** em `FinanceCards`, logo depois de `const a=useApp();`, `const [importing,setImporting]=useState<string|null>(null);`.
- **Botão no cartão:** em cada `bank-card`, depois do `<div className="card-dates">…</div>`:
```tsx
<button className="fin-fatura-open" onClick={()=>setImporting(c.id)}><FileUp size={14}/>Importar fatura</button>
```
- **Janela:** no fim do fragmento, depois da seção "Parcelas deste mês":
```tsx
{importing!==null&&<FaturaImport cardId={importing} money={money} onClose={()=>setImporting(null)}/>}
```

`app/globals.css`, depois das regras `fin-invest-*` da Tarefa 6:
```css
.fin-fatura-meta{margin:0 0 12px;font-size:13px;color:var(--muted)}
.fin-fatura .fin-warning{margin:0 0 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fin-fatura-note{margin:0 0 10px;font-size:11px;color:var(--subtle)}
.fin-fatura-tools{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.fin-fatura-list{list-style:none;margin:0 0 6px;padding:0;max-height:min(52vh,520px);overflow:auto;border:1px solid var(--border);border-radius:12px}
.fin-fatura-list li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;padding:10px 12px;border-top:1px solid var(--border)}.fin-fatura-list li:first-child{border-top:0}.fin-fatura-list li.off{opacity:.55}
.fin-fatura-list input[type=checkbox]{margin-top:3px}
.fin-fatura-list p{display:flex;justify-content:space-between;gap:10px;margin:0 0 5px;font-size:13px}.fin-fatura-list p span{min-width:0;overflow-wrap:anywhere}.fin-fatura-list p b{white-space:nowrap}
.fin-fatura-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:11px;color:var(--muted)}.fin-fatura-tags select{min-height:28px;max-width:100%;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:11px;padding:0 6px}
.fin-fatura-list small{display:block;margin-top:4px;color:var(--subtle);font-size:11px}
.bank-card .fin-fatura-open{display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:6px 10px;border:1px solid color-mix(in srgb,currentColor 40%,transparent);border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}
```

- [ ] **Step 5: Run the checks**

- `npm test`;
- `npm run typecheck`;
- `npx eslint components/norte/fatura-pdf.ts components/norte/finance-fatura.tsx components/norte/finance-transactions.tsx components/norte/finance-accounts.tsx`: sem problemas;
- `npm run build`.

Se o build falhar ao empacotar o `unpdf`, pare e reporte BLOCKED com a mensagem completa. Não troque de biblioteca.

- [ ] **Step 6: Commit**

```
git add package.json package-lock.json components/norte/fatura-pdf.ts components/norte/finance-fatura.tsx components/norte/finance-transactions.tsx components/norte/finance-accounts.tsx app/globals.css
git commit -m "Importar fatura em PDF: leitura no aparelho, prévia com categorias e Ler com a IA" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Conferência visual (controlador)

Feita pelo controlador na página isolada, sem Clerk: esbuild com um `Context.Provider` falso cujo `mutate` roda o `applyCommand` de verdade, `@tailwindcss/postcss` e playwright-core com o Chrome local.

- [ ] **Step 1: Montagem e dados de exemplo**
  - **Dados:** `entry.tsx` ganha investimentos de exemplo:
    - CDB por valor, com atualização;
    - PETR4 com compra, venda e cotação;
    - MXRF11 com dividendo;
    - BTC com cotação abaixo de R$ 1 por unidade fracionada;
    - um FII encerrado.
  - **Montagem:** rebuild do site.
- [ ] **Step 2: PDF de exemplo** — gerado pelo Chrome (`page.pdf`) a partir de um HTML com as linhas do `TEXT` da Tarefa 3, mais uma versão do mesmo PDF protegida por senha, se a ferramenta permitir. Senão, só a versão aberta.
- [ ] **Step 3: Aba Investimentos**
  - sem rolagem horizontal em 375 px e 1440 px;
  - capturas nos temas claro e escuro;
  - tocar numa barra de alocação filtra a lista, e "Ver tudo" limpa o filtro;
  - os botões abrem o editor com `assetId` e `move` certos (registrados em `__edits`);
  - com os valores ocultos, nenhum "R$" aparece.
- [ ] **Step 4: Importar fatura (Lançamentos)**
  1. Escolher o arquivo e tocar em "Ler fatura": 11 linhas lidas e 10 selecionadas.
  2. A soma não bate, então aparecem o aviso e "Ler com a IA". Sem servidor, tocar no botão mostra o erro, sem quebrar a tela.
  3. "Lançar 10" grava pelo `importTransactions` (registrado em `__mutations`) e mostra o aviso.
  4. Reimportar: 0 selecionadas, e "Lançar 0" fica desabilitado.
  5. Em Cartões & parcelas, o botão do cartão abre a janela com o cartão escolhido.
  6. Telefone (375 px): sem rolagem horizontal, com a lista rolando dentro da janela.
- [ ] **Step 5: Registro** — os resultados no ledger e as capturas conferidas a olho, principalmente o tema escuro.
