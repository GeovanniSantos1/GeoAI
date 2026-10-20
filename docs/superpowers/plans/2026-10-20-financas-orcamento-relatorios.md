# Finanças: gastos, orçamento e relatórios — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer para o menu Finanças do GeoAI o controle de gastos, o orçamento (teto do mês e tetos por categoria) e os relatórios do GGFinance, com forma de pagamento, CSV e avisos de teto no assistente.

**Architecture:**
- **Regras:** todas puras, num módulo novo, `lib/finance.ts` (categorias, contas do mês, tetos, tendência, relatórios, alertas, filtro, CSV e avisos), testadas com `node:test`.
- **Core:** `lib/core.ts` passa a validar `payment` e `profile.categoryBudgets`, e a atualização do workspace troca "Casa" por "Moradia".
- **Tela:** a tela de Finanças vira uma moldura (`finance.tsx`), com um arquivo por aba e as peças comuns em `finance-ui.tsx`.
- **Assistente:** recebe os tetos e avisa quando uma confirmação estoura um teto.

**Tech Stack:** Next.js 16, React 19, TypeScript, lucide-react, CSS em `app/globals.css`, testes com `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-financas-orcamento-relatorios-design.md`

**Worktree e branch:** `.claude/worktrees/financas`, branch `feat/financas`. Todo comando roda dali, e git só em comandos simples (sem `cd &&` nem subshells). Nunca troque de branch na checkout principal.

## Global Constraints

- **Textos:** todos em pt-BR, exatamente como na spec.
- **Valores:** sempre em centavos inteiros. Datas em `AAAA-MM-DD`. Um lançamento é do mês quando `date.startsWith('AAAA-MM')`.
- **Estilo:**
  - o do repositório, com linhas compactas e poucos comentários (pt-BR, explicando o porquê);
  - sem dependências novas e sem `recharts`.
- **`lib/finance.ts`:**
  - é importado pelos testes, então não pode importar `@/…`;
  - não importa o `lib/core.ts`, porque o core importa este arquivo;
  - os testes importam os `.ts` por caminho relativo com extensão.
- **Categorias (nesta ordem):**
  - Despesas: Moradia, Alimentação, Mercado, Transporte, Saúde, Educação, Lazer, Contas, Compras, Assinaturas, Outros;
  - Receitas: Salário, Renda extra, Outras receitas.
  - O lançamento guarda o **nome** da categoria.
- **Formas de pagamento:** `pix` (PIX), `debit` (Débito), `credit` (Crédito), `cash` (Dinheiro), `transfer` (Transferência). Com cartão, o valor é `credit`.
- **Situação de um teto:**
  - `t = 0`: `none`;
  - `g > t`: `over`;
  - `g ≥ 0,85t`: `near`;
  - senão: `ok`.
  - Percentual: `round(g/t*100)`.
- **Tela:** celular de 375 px sem rolagem horizontal; tema escuro legível. O modo "ocultar valores" mascara todos os valores das abas (função `money` recebida pela aba).
- **Commits:** em pt-BR, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Mês sem nenhum lançamento:** todas as contas dão zero ou vazio, sem divisão por zero, e as abas mostram os estados vazios. Teste "mês vazio" na Tarefa 2.
2. **Workspace antigo sem `categoryBudgets`, ou lançamento sem data:** as contas e o CSV não quebram. Testes na Tarefa 1 (atualização) e na Tarefa 2 (dados antigos).
3. **Sugestão do assistente com categoria fora da lista ou sem forma de pagamento:** salva normalmente. Uma forma inválida volta como erro na sugestão. Teste na Tarefa 3.
4. **Campo de teto com texto inválido ou apagado:** inválido mostra erro e volta ao valor salvo; vazio vira "sem teto". Comportamento na Tarefa 5, conferido na Tarefa 6.
5. **Modo "ocultar valores":** nenhum valor das abas novas aparece. Conferido na Tarefa 6.

---

### Task 1: Base de finanças — categorias, pagamento e tetos no perfil

**Files:**
- Create: `lib/finance.ts`
- Modify:
  - `lib/core.ts`: chaves válidas perto da linha 28, `upgradeWorkspace` (33-34), `emptyWorkspace` (36), `formatMoney` (43), validação de `transactions` em `validateItem`, `cleanProfile` (107);
  - `lib/types.ts` (`Profile`);
  - `package.json` (script `test`).
- Test: `tests/finance.test.mjs` (novo)

**Interfaces:**
- Produces, de `lib/finance.ts`:
  - `formatMoney(cents:number):string`;
  - `type CategoryKind='expense'|'income'`;
  - `type Category={name:string;kind:CategoryKind;icon:string;color:string}`;
  - `CATEGORIES:Category[]`, `EXPENSE_CATEGORIES:string[]`, `INCOME_CATEGORIES:string[]`;
  - `PAYMENTS` (`readonly [id,label][]`) e `PAYMENT_LABEL:Record<string,string>`;
  - `categoryInfo(name?:string):Category&{known:boolean}`;
  - `type CapState='none'|'ok'|'near'|'over'`, `capState(spent:number,cap:number):CapState`, `capPct(spent:number,cap:number):number`;
  - `shiftYm(month:string,n:number):string`.
- Produces, de `lib/core.ts`:
  - `export {formatMoney}` (reexportado);
  - `Profile.categoryBudgets:Record<string,number>`;
  - o comando `profile` aceita `categoryBudgets`.

- [ ] **Step 1: Write the failing tests.** Crie `tests/finance.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,applyCommand,validateItem,upgradeWorkspace,validateWorkspace,formatMoney as coreMoney} from '../lib/core.ts';
import {formatMoney,categoryInfo,EXPENSE_CATEGORIES,INCOME_CATEGORIES,capState,capPct,shiftYm} from '../lib/finance.ts';
const T='2026-10-18';
const up=(s,collection,item)=>applyCommand(s,{type:'upsert',collection,item},T);

test('categorias: lista, antigas e vazias',()=>{
 assert.deepEqual(EXPENSE_CATEGORIES,['Moradia','Alimentação','Mercado','Transporte','Saúde','Educação','Lazer','Contas','Compras','Assinaturas','Outros']);
 assert.deepEqual(INCOME_CATEGORIES,['Salário','Renda extra','Outras receitas']);
 assert.deepEqual(categoryInfo('Mercado'),{name:'Mercado',kind:'expense',icon:'cart',color:'#a77b61',known:true});
 assert.deepEqual(categoryInfo('Viagem'),{name:'Viagem',kind:'expense',icon:'ellipsis',color:'#9aa39b',known:false});
 assert.deepEqual([categoryInfo('').name,categoryInfo('').known,categoryInfo(undefined).name,categoryInfo('  ').name],['Outros',true,'Outros','Outros']);
 assert.equal(categoryInfo('Salário').kind,'income');});
test('formatMoney mudou de arquivo e o core continua exportando',()=>{assert.equal(formatMoney(3590),'R$ 35,90');assert.equal(coreMoney(3590),'R$ 35,90');});
test('situação e percentual do teto',()=>{
 assert.deepEqual([capState(100,0),capState(84,100),capState(85,100),capState(100,100),capState(101,100)],['none','ok','near','near','over']);
 assert.deepEqual([capPct(50,0),capPct(1075,1000),capPct(1,3)],[0,108,33]);});
test('meses atravessam o ano',()=>{assert.deepEqual([shiftYm('2026-12',1),shiftYm('2027-01',-1),shiftYm('2026-10',-12)],['2027-01','2026-12','2025-10']);});
test('forma de pagamento: valores válidos e cartão vira crédito',()=>{const base={title:'Almoço',amount:3590,direction:'expense',date:T};
 assert.equal(validateItem('transactions',{...base,payment:'pix'}).payment,'pix');
 assert.throws(()=>validateItem('transactions',{...base,payment:'boleto'}),/Forma de pagamento inválida/);
 assert.equal(validateItem('transactions',{...base,payment:'pix',cardId:'c1'}).payment,'credit');
 assert.equal(validateItem('transactions',{...base,cardId:'c1'}).payment,'credit');
 assert.equal(validateItem('transactions',base).payment,undefined);
 assert.equal(up(emptyWorkspace('Geo'),'transactions',{...base,id:'t1',payment:'cash'}).transactions[0].payment,'cash');});
test('tetos por categoria: mescla, zero remove e valores inválidos',()=>{let s=emptyWorkspace('Geo');assert.deepEqual(s.profile.categoryBudgets,{});
 s=applyCommand(s,{type:'profile',profile:{categoryBudgets:{Moradia:150000,Lazer:30000}}},T);
 s=applyCommand(s,{type:'profile',profile:{categoryBudgets:{Lazer:0,Mercado:80000}}},T);
 assert.deepEqual(s.profile.categoryBudgets,{Moradia:150000,Mercado:80000});
 s=applyCommand(s,{type:'profile',profile:{budget:300000}},T);assert.deepEqual(s.profile.categoryBudgets,{Moradia:150000,Mercado:80000});
 for(const bad of [{Salário:1000},{Lazer:10.5},{Lazer:-1},[1],null,'x'])assert.throws(()=>applyCommand(s,{type:'profile',profile:{categoryBudgets:bad}},T),/Configuração inválida/);});
test('espaço antigo: Casa vira Moradia e ganha tetos vazios',()=>{const old=emptyWorkspace('Geo');delete old.profile.categoryBudgets;
 old.transactions=[{id:'t1',title:'Aluguel',amount:150000,direction:'expense',date:T,category:'Casa'},{id:'t2',title:'Feira',amount:5000,direction:'expense',date:T,category:'Mercado'}];
 old.bills=[{id:'b1',title:'Condomínio',amount:60000,day:10,category:'Casa'}];
 const u=upgradeWorkspace(structuredClone(old));assert.deepEqual(u.transactions.map(x=>x.category),['Moradia','Mercado']);assert.equal(u.bills[0].category,'Moradia');assert.deepEqual(u.profile.categoryBudgets,{});
 assert.deepEqual(upgradeWorkspace(structuredClone(u)).transactions.map(x=>x.category),['Moradia','Mercado']);
 assert.equal(old.transactions[0].category,'Casa');
 assert.doesNotThrow(()=>validateWorkspace(structuredClone(old)));});
```

Acrescente `tests/finance.test.mjs` ao fim da lista do script `test` no `package.json`.

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `node --experimental-strip-types --test tests/finance.test.mjs`
Expected: falha ao importar `../lib/finance.ts` (módulo inexistente).

- [ ] **Step 3: Implement.**

Crie `lib/finance.ts`:

```ts
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
```

(O `import type {Item}` fica para as funções da Tarefa 2. Se o lint reclamar de import sem uso nesta tarefa, deixe-o para a Tarefa 2.)

Em `lib/core.ts`:
- **`formatMoney`:** troque `export function formatMoney(cents:number){…}` por um import no topo, `import {formatMoney,PAYMENTS,EXPENSE_CATEGORIES} from './finance.ts';`, e acrescente uma linha `export {formatMoney};`. Os usos internos de `formatMoney` no core continuam funcionando.
- **Chaves válidas:** logo depois da linha do comentário `// Menu Saúde feminina.`, acrescente:

```ts
// Finanças: forma de pagamento do lançamento.
VALID_KEYS.add('payment');
```

- **`validateItem`:** depois da linha `if(collection==='transactions'&&!['income','expense'].includes(item.direction))throw …`, acrescente:

```ts
 if(collection==='transactions'){if(item.cardId)item.payment='credit';else if(item.payment!==undefined&&!PAYMENTS.some(([id])=>id===item.payment))throw new Error('Forma de pagamento inválida');}
```

- **`emptyWorkspace`:** no objeto `profile`, acrescente `categoryBudgets:{}` depois de `openingBalance:0`.
- **`upgradeWorkspace`:** dentro de `if(raw&&typeof raw==='object'){…}`, logo depois do `for(const key of ADDED_COLLECTIONS)…`, acrescente:

```ts
 for(const key of ['transactions','bills'])if(Array.isArray(s[key]))s[key]=s[key].map((x:any)=>x&&x.category==='Casa'?{...x,category:'Moradia'}:x);
```

  No bloco do perfil (`const p={...s.profile};…`), antes de `s.profile=p;`, acrescente:

```ts
if(!p.categoryBudgets||typeof p.categoryBudgets!=='object'||Array.isArray(p.categoryBudgets))p.categoryBudgets={};
```

- **`cleanProfile`:** antes do `return p;`, acrescente:

```ts
 // Tetos por categoria: mescla com os atuais; 0 remove a categoria; só categorias de despesa da lista.
 if(raw.categoryBudgets!==undefined){const c=raw.categoryBudgets;if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('Configuração inválida');const next:Record<string,number>={...(p.categoryBudgets||{})};
  for(const [k,v] of Object.entries(c)){if(!EXPENSE_CATEGORIES.includes(k)||!Number.isSafeInteger(v)||(v as number)<0||(v as number)>1e12)throw new Error('Configuração inválida');if(v===0)delete next[k];else next[k]=v as number;}p.categoryBudgets=next;}
```

Em `lib/types.ts`, no tipo `Profile`, acrescente `categoryBudgets:Record<string,number>;` depois de `openingBalance:number;`.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `node --experimental-strip-types --test tests/finance.test.mjs` → PASS.
Run: `npm test` → tudo verde. Se algum teste antigo comparar o perfil inteiro com `deepEqual`, inclua `categoryBudgets:{}` na expectativa e cite isso no relatório.
Run: `npm run typecheck` → sem erros. Se o TypeScript exigir `categoryBudgets` em algum perfil montado à mão, inclua `{}`.

- [ ] **Step 5: Commit.**

```bash
git add lib/finance.ts lib/core.ts lib/types.ts package.json tests/finance.test.mjs
git commit -m "Finanças: categorias, forma de pagamento e tetos por categoria no perfil" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras do mês — categorias, tetos, tendência, relatórios, filtro, CSV e avisos

**Files:**
- Modify: `lib/finance.ts` (acrescenta as funções)
- Test: `tests/finance.test.mjs` (acrescenta os testes)

**Interfaces:**
- Consumes (Tarefa 1): `formatMoney`, `categoryInfo`, `EXPENSE_CATEGORIES`, `PAYMENT_LABEL`, `capState`, `capPct`, `shiftYm` e `type CapState`.
- Produces (todos em `lib/finance.ts`):
  - `type FinData={transactions:Item[];cards?:Item[];profile:{budget?:number;categoryBudgets?:Record<string,number>}}` (o `Workspace` satisfaz);
  - `type CategoryRow={name:string;total:number;count:number;share:number;cap?:number;capPct?:number;state:CapState}`;
  - `expenseByCategory(s:FinData,month:string):CategoryRow[]`;
  - `type BudgetLine={name:string;spent:number;cap:number;pct:number;state:CapState}`;
  - `budgetView(s,month):{month:{cap,spent,pct,state};categories:BudgetLine[];capsSum:number;capsOverMonth:number}`;
  - `trend(s,month,n=6):{month:string;income:number;expense:number}[]`;
  - `type VsPrev={kind:'new'|'stable';prev:number}|{kind:'delta';pct:number;prev:number}`;
  - `reportCards(s,month,today):{expense:number;dailyAvg:number|null;vsPrev:VsPrev;top:{name:string;total:number}|null}`;
  - `insights(s,month,today):string[]`;
  - `topExpenses(s,month,n=5):Item[]`;
  - `type TxFilter={type?:'all'|'expense'|'income';category?:string;payment?:string;text?:string}`;
  - `filterTransactions(list:Item[],f:TxFilter):Item[]`;
  - `transactionsCsv(s:FinData):string`;
  - `budgetAlerts(s:FinData,items:{collection:string;item:Partial<Item>}[]):string[]`.

- [ ] **Step 1: Write the failing tests.** Acrescente ao fim de `tests/finance.test.mjs`, e o import no topo:

```js
import {expenseByCategory,budgetView,trend,reportCards,insights,topExpenses,filterTransactions,transactionsCsv,budgetAlerts} from '../lib/finance.ts';
const tx=(id,date,amount,category,extra={})=>({id,title:id,amount,direction:'expense',date,category,...extra});
const inc=(id,date,amount,extra={})=>({id,title:id,amount,direction:'income',date,category:'Salário',...extra});
const fin=(transactions,profile={},cards=[])=>({transactions,cards,profile:{budget:0,categoryBudgets:{},...profile}});
const OCT=[tx('aluguel','2026-10-05',150000,'Moradia'),tx('feira','2026-10-02',30000,'Alimentação'),tx('jantar','2026-10-10',20000,'Alimentação'),tx('passagem','2026-10-03',10000,'Viagem'),tx('avulso','2026-10-04',5000,''),inc('salario','2026-10-01',500000)];
const SEP=[tx('aluguel9','2026-09-05',80000,'Moradia'),tx('feira9','2026-09-02',20000,'Alimentação')];

test('saídas por categoria com teto, antigas e sem categoria',()=>{const rows=expenseByCategory(fin([...OCT,...SEP],{categoryBudgets:{Alimentação:40000}}),'2026-10');
 assert.deepEqual(rows.map(r=>[r.name,r.total,r.count,Math.round(r.share*1000),r.cap??null,r.capPct??null,r.state]),[['Moradia',150000,1,698,null,null,'none'],['Alimentação',50000,2,233,40000,125,'over'],['Viagem',10000,1,47,null,null,'none'],['Outros',5000,1,23,null,null,'none']]);
 assert.deepEqual(expenseByCategory(fin(OCT),'2026-11'),[]);});
test('orçamento: teto do mês, linhas por categoria e soma passando do teto',()=>{const b=budgetView(fin([...OCT,...SEP],{budget:200000,categoryBudgets:{Moradia:150000,Alimentação:40000,Lazer:50000}}),'2026-10');
 assert.deepEqual(b.month,{cap:200000,spent:215000,pct:108,state:'over'});
 assert.deepEqual(b.categories.map(c=>c.name),['Moradia','Alimentação','Mercado','Transporte','Saúde','Educação','Lazer','Contas','Compras','Assinaturas','Outros']);
 const by=n=>b.categories.find(c=>c.name===n);
 assert.deepEqual([by('Moradia'),by('Alimentação'),by('Lazer'),by('Mercado'),by('Outros')],[{name:'Moradia',spent:150000,cap:150000,pct:100,state:'near'},{name:'Alimentação',spent:50000,cap:40000,pct:125,state:'over'},{name:'Lazer',spent:0,cap:50000,pct:0,state:'ok'},{name:'Mercado',spent:0,cap:0,pct:0,state:'none'},{name:'Outros',spent:5000,cap:0,pct:0,state:'none'}]);
 assert.deepEqual([b.capsSum,b.capsOverMonth],[240000,40000]);
 const noMonth=budgetView(fin(OCT,{categoryBudgets:{Moradia:300000}}),'2026-10');assert.deepEqual([noMonth.month.state,noMonth.capsOverMonth],['none',0]);});
test('tendência dos últimos meses atravessa o ano',()=>{const s=fin([tx('n','2026-11-10',1000,'Lazer'),tx('d','2026-12-10',2000,'Lazer'),inc('di','2026-12-01',5000),tx('j','2027-01-10',3000,'Lazer')]);
 assert.deepEqual(trend(s,'2027-01',3),[{month:'2026-11',income:0,expense:1000},{month:'2026-12',income:5000,expense:2000},{month:'2027-01',income:0,expense:3000}]);
 assert.deepEqual(trend(s,'2027-01').map(m=>m.month),['2026-08','2026-09','2026-10','2026-11','2026-12','2027-01']);});
test('cartões do relatório: média diária, mês anterior e maior categoria',()=>{const s=fin([...OCT,...SEP]);
 assert.deepEqual(reportCards(s,'2026-10','2026-10-18'),{expense:215000,dailyAvg:11944,vsPrev:{kind:'delta',pct:115,prev:100000},top:{name:'Moradia',total:150000}});
 const past=reportCards(s,'2026-09','2026-10-18');assert.deepEqual([past.dailyAvg,past.vsPrev],[3333,{kind:'new',prev:0}]);
 const future=reportCards(s,'2026-11','2026-10-18');assert.deepEqual([future.dailyAvg,future.vsPrev,future.top],[null,{kind:'delta',pct:-100,prev:215000},null]);
 assert.deepEqual(reportCards(s,'2026-07','2026-10-18').vsPrev,{kind:'stable',prev:0});
 assert.deepEqual(reportCards(fin([tx('a','2026-09-01',100000,'Lazer'),tx('b','2026-10-01',100400,'Lazer')]),'2026-10','2026-10-18').vsPrev,{kind:'stable',prev:100000});});
test('alertas na ordem: mês anterior, teto do mês, categorias e crescimento',()=>{
 assert.deepEqual(insights(fin([...OCT,...SEP],{budget:200000,categoryBudgets:{Moradia:150000,Alimentação:40000}}),'2026-10','2026-10-18'),['Suas saídas subiram 115% em relação a setembro.','Você passou do teto do mês em R$ 150,00.','Alimentação passou do teto em R$ 100,00.','Moradia cresceu 88% em relação ao mês anterior.']);
 assert.deepEqual(insights(fin([...OCT,...SEP],{budget:230000}),'2026-10','2026-10-18'),['Suas saídas subiram 115% em relação a setembro.','Você já usou 93% do teto do mês.','Moradia cresceu 88% em relação ao mês anterior.']);
 assert.deepEqual(insights(fin([tx('a','2026-09-01',100000,'Lazer'),tx('b','2026-10-01',90000,'Lazer')]),'2026-10','2026-10-18'),['Suas saídas caíram 10% em relação a setembro.']);
 const many=fin([tx('m','2026-10-01',1000,'Moradia'),tx('a','2026-10-01',5000,'Alimentação'),tx('t','2026-10-01',3000,'Transporte'),tx('l','2026-10-01',2000,'Lazer')],{categoryBudgets:{Moradia:500,Alimentação:1000,Transporte:1000,Lazer:1000}});
 assert.deepEqual(insights(many,'2026-10','2026-10-18'),['Alimentação passou do teto em R$ 40,00.','Transporte passou do teto em R$ 20,00.','Lazer passou do teto em R$ 10,00.']);});
test('maiores saídas: valor e, no empate, a mais recente',()=>{const s=fin([tx('a','2026-10-01',5000,'Lazer'),tx('b','2026-10-09',5000,'Lazer'),tx('c','2026-10-05',9000,'Lazer'),inc('i','2026-10-02',99999),tx('d','2026-09-01',99999,'Lazer'),tx('e','2026-10-03',100,'Lazer'),tx('f','2026-10-04',200,'Lazer'),tx('g','2026-10-06',300,'Lazer')]);
 assert.deepEqual(topExpenses(s,'2026-10').map(x=>x.id),['c','b','a','g','f']);});
test('filtro de lançamentos: tipo, categoria, pagamento e texto sem acento',()=>{const L=[tx('acai','2026-10-03',1500,'Alimentação',{title:'Açaí',payment:'pix'}),tx('uber','2026-10-05',2500,'Transporte',{title:'Uber',cardId:'c1',payment:'credit'}),tx('avulso','2026-10-04',800,'',{title:'Avulso',notes:'Presente da Ana'}),inc('sal','2026-10-01',500000,{title:'Salário'})];
 const ids=f=>filterTransactions(L,f).map(x=>x.id);
 assert.deepEqual(ids({}),['uber','avulso','acai','sal']);assert.deepEqual(ids({type:'income'}),['sal']);assert.deepEqual(ids({category:'Outros'}),['avulso']);
 assert.deepEqual(ids({payment:'card'}),['uber']);assert.deepEqual(ids({payment:'pix'}),['acai']);assert.deepEqual(ids({payment:'none'}),['avulso','sal']);
 assert.deepEqual(ids({text:'ACAI'}),['acai']);assert.deepEqual(ids({text:'ana'}),['avulso']);assert.deepEqual(ids({text:'alimentacao',type:'expense'}),['acai']);});
test('CSV: BOM, ordem por data, sinal, cartão e escape',()=>{const csv=transactionsCsv(fin([tx('almoco','2026-10-03',3590,'Alimentação',{title:'Almoço, "executivo"',notes:'linha 1\nlinha 2',payment:'pix'}),tx('uber','2026-10-05',2500,'Transporte',{title:'Uber',cardId:'c1',payment:'credit'}),inc('sal','2026-10-01',500000,{title:'Salário',payment:'transfer'}),tx('x','2026-09-30',1000,'Viagem',{title:'Hotel'})],{},[{id:'c1',title:'Nubank'}]));
 assert.equal(csv,'﻿Data,Tipo,Categoria,Descrição,Valor,Pagamento,Notas\r\n30/09/2026,Despesa,Viagem,Hotel,"-10,00",,\r\n01/10/2026,Receita,Salário,Salário,"5000,00",Transferência,\r\n03/10/2026,Despesa,Alimentação,"Almoço, ""executivo""","-35,90",PIX,"linha 1\nlinha 2"\r\n05/10/2026,Despesa,Transporte,Uber,"-25,00",Crédito (Nubank),');});
test('aviso de teto ao confirmar: só quando a situação muda',()=>{const base=fin([tx('feira','2026-10-02',30000,'Alimentação')],{budget:50000,categoryBudgets:{Alimentação:40000}});
 const item=(amount,date='2026-10-18',category='Alimentação')=>({collection:'transactions',item:{title:'Mercado',amount,direction:'expense',date,category}});
 assert.deepEqual(budgetAlerts(base,[item(15000)]),['⚠️ Alimentação: R$ 450,00 de R$ 400,00, passou do teto.','⚠️ Você já usou 90% do teto do mês.']);
 assert.deepEqual(budgetAlerts(base,[item(5000)]),['⚠️ Alimentação já usou 88% do teto.']);
 assert.deepEqual(budgetAlerts(fin([tx('feira','2026-10-02',45000,'Alimentação')],{categoryBudgets:{Alimentação:40000}}),[item(1000)]),[]);
 assert.deepEqual(budgetAlerts(base,[item(15000,'2026-11-02')]),[]);
 assert.deepEqual(budgetAlerts(base,[{collection:'transactions',item:{title:'Salário',amount:999999,direction:'income',date:'2026-10-18',category:'Salário'}},{collection:'tasks',item:{title:'x',date:'2026-10-18'}}]),[]);
 const four=budgetAlerts(fin([],{categoryBudgets:{Moradia:100,Mercado:100,Lazer:100,Contas:100}}),['Moradia','Mercado','Lazer','Contas'].map(c=>item(200,'2026-10-18',c)));
 assert.equal(four.length,3);assert.ok(four[0].startsWith('⚠️ Moradia:'));});
test('mês vazio e dados antigos não quebram as contas',()=>{const empty=fin([]);
 assert.deepEqual(expenseByCategory(empty,'2026-10'),[]);const b=budgetView(empty,'2026-10');assert.deepEqual([b.month,b.capsSum,b.capsOverMonth],[{cap:0,spent:0,pct:0,state:'none'},0,0]);
 assert.deepEqual(reportCards(empty,'2026-10','2026-10-18'),{expense:0,dailyAvg:0,vsPrev:{kind:'stable',prev:0},top:null});
 assert.deepEqual(insights(empty,'2026-10','2026-10-18'),[]);assert.deepEqual(topExpenses(empty,'2026-10'),[]);
 assert.equal(transactionsCsv(empty),'﻿Data,Tipo,Categoria,Descrição,Valor,Pagamento,Notas');
 const legacy={transactions:[{id:'x',title:'Sem data',amount:100,direction:'expense'},tx('ok','2026-10-02',500,'Lazer')],profile:{budget:0}};
 assert.deepEqual(expenseByCategory(legacy,'2026-10').map(r=>r.name),['Lazer']);assert.equal(budgetView(legacy,'2026-10').categories.find(c=>c.name==='Lazer').cap,0);
 assert.equal(transactionsCsv(legacy).split('\r\n').length,2);assert.deepEqual(filterTransactions(legacy.transactions,{}).map(x=>x.id),['ok','x']);});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `node --experimental-strip-types --test tests/finance.test.mjs`
Expected: falha de import (`does not provide an export named 'expenseByCategory'`).

- [ ] **Step 3: Implement.** Acrescente ao fim de `lib/finance.ts`:

```ts
export type FinData={transactions:Item[];cards?:Item[];profile:{budget?:number;categoryBudgets?:Record<string,number>}};
export type CategoryRow={name:string;total:number;count:number;share:number;cap?:number;capPct?:number;state:CapState};
export type BudgetLine={name:string;spent:number;cap:number;pct:number;state:CapState};
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const inMonth=(x:Item,month:string)=>typeof x.date==='string'&&x.date.startsWith(month)&&Number.isFinite(x.amount);
const sumOf=(s:FinData,month:string,direction:'income'|'expense')=>s.transactions.filter(x=>x.direction===direction&&inMonth(x,month)).reduce((a,x)=>a+x.amount,0);
const daysIn=(month:string)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate();};
export function expenseByCategory(s:FinData,month:string):CategoryRow[]{const rows=s.transactions.filter(x=>x.direction==='expense'&&inMonth(x,month)),total=rows.reduce((a,x)=>a+x.amount,0),caps=s.profile.categoryBudgets||{},groups=new Map<string,{total:number;count:number}>();
 for(const x of rows){const n=categoryInfo(x.category).name,g=groups.get(n)||{total:0,count:0};g.total+=x.amount;g.count++;groups.set(n,g);}
 return [...groups].map(([name,g])=>{const cap=caps[name]||0;return {name,total:g.total,count:g.count,share:total?g.total/total:0,...(cap?{cap,capPct:capPct(g.total,cap)}:{}),state:capState(g.total,cap)};}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));}
export function budgetView(s:FinData,month:string){const spentBy=new Map(expenseByCategory(s,month).map(c=>[c.name,c.total])),spent=sumOf(s,month,'expense'),cap=s.profile.budget||0,caps=s.profile.categoryBudgets||{};
 const categories:BudgetLine[]=EXPENSE_CATEGORIES.map(name=>{const g=spentBy.get(name)||0,c=caps[name]||0;return {name,spent:g,cap:c,pct:capPct(g,c),state:capState(g,c)};});
 const capsSum=EXPENSE_CATEGORIES.reduce((a,n)=>a+(caps[n]||0),0);
 return {month:{cap,spent,pct:capPct(spent,cap),state:capState(spent,cap)},categories,capsSum,capsOverMonth:cap>0&&capsSum>cap?capsSum-cap:0};}
export function trend(s:FinData,month:string,n=6){return Array.from({length:n},(_,i)=>{const m=shiftYm(month,i-n+1);return {month:m,income:sumOf(s,m,'income'),expense:sumOf(s,m,'expense')};});}
export type VsPrev={kind:'new'|'stable';prev:number}|{kind:'delta';pct:number;prev:number};
// Média diária: no mês corrente, até hoje; num mês passado, o mês inteiro; num mês futuro, não existe.
export function reportCards(s:FinData,month:string,today:string){const expense=sumOf(s,month,'expense'),prev=sumOf(s,shiftYm(month,-1),'expense'),cur=today.slice(0,7);
 const days=month===cur?Number(today.slice(8,10)):month<cur?daysIn(month):0,pct=prev?Math.round((expense-prev)/prev*100):0;
 const vsPrev:VsPrev=!prev?{kind:expense>0?'new':'stable',prev}:pct===0?{kind:'stable',prev}:{kind:'delta',pct,prev};
 const top=expenseByCategory(s,month)[0];
 return {expense,dailyAvg:days?Math.round(expense/days):null,vsPrev,top:top?{name:top.name,total:top.total}:null};}
export function insights(s:FinData,month:string,today:string){const out:string[]=[],c=reportCards(s,month,today),prevMonth=shiftYm(month,-1),prevName=MONTHS[Number(prevMonth.slice(5))-1];
 if(c.vsPrev.kind==='delta'&&c.vsPrev.pct>=8)out.push('Suas saídas subiram '+c.vsPrev.pct+'% em relação a '+prevName+'.');
 if(c.vsPrev.kind==='delta'&&c.vsPrev.pct<=-8)out.push('Suas saídas caíram '+(-c.vsPrev.pct)+'% em relação a '+prevName+'.');
 const b=budgetView(s,month);
 if(b.month.state==='over')out.push('Você passou do teto do mês em '+formatMoney(b.month.spent-b.month.cap)+'.');else if(b.month.state==='near')out.push('Você já usou '+b.month.pct+'% do teto do mês.');
 for(const x of b.categories.filter(x=>x.state==='over').sort((x,y)=>(y.spent-y.cap)-(x.spent-x.cap)).slice(0,3))out.push(x.name+' passou do teto em '+formatMoney(x.spent-x.cap)+'.');
 const before=new Map(expenseByCategory(s,prevMonth).map(x=>[x.name,x.total]));
 const grew=expenseByCategory(s,month).slice(0,4).find(x=>{const p=before.get(x.name)||0;return p>0&&(x.total-p)/p>0.2;});
 if(grew){const p=before.get(grew.name) as number;out.push(grew.name+' cresceu '+Math.round((grew.total-p)/p*100)+'% em relação ao mês anterior.');}
 return out;}
export function topExpenses(s:FinData,month:string,n=5){return s.transactions.filter(x=>x.direction==='expense'&&inMonth(x,month)).sort((a,b)=>b.amount-a.amount||b.date.localeCompare(a.date)).slice(0,n);}
export type TxFilter={type?:'all'|'expense'|'income';category?:string;payment?:string;text?:string};
const fold=(t:string)=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
// Pagamento: 'card' são os lançamentos de cartão; 'none' são os sem forma e sem cartão.
export function filterTransactions(list:Item[],f:TxFilter){const q=fold((f.text||'').trim());
 return list.filter(x=>(!f.type||f.type==='all'||x.direction===f.type)&&(!f.category||categoryInfo(x.category).name===f.category)
  &&(!f.payment||(f.payment==='card'?!!x.cardId:f.payment==='none'?!x.cardId&&!x.payment:x.payment===f.payment))
  &&(!q||fold([x.title,x.notes,x.category].filter(v=>typeof v==='string').join(' ')).includes(q))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));}
const csvCell=(v:string)=>/[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
const plainMoney=(cents:number)=>(cents<0?'-':'')+(Math.abs(cents)/100).toFixed(2).replace('.',',');
export function transactionsCsv(s:FinData){const cards=new Map((s.cards||[]).map(c=>[c.id,c.title]));
 const rows=s.transactions.filter(x=>typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{const card=x.cardId?cards.get(x.cardId):undefined,pay=x.cardId?'Crédito'+(card?' ('+card+')':''):PAYMENT_LABEL[x.payment]||'';
  return [x.date.slice(8,10)+'/'+x.date.slice(5,7)+'/'+x.date.slice(0,4),x.direction==='income'?'Receita':'Despesa',categoryInfo(x.category).name,String(x.title||''),plainMoney(x.direction==='income'?x.amount:-x.amount),pay,String(x.notes||'')].map(csvCell).join(',');});
 return '﻿'+['Data,Tipo,Categoria,Descrição,Valor,Pagamento,Notas',...rows].join('\r\n');}
// Aviso ao confirmar sugestões: compara a situação dos tetos antes e depois das despesas novas; só avisa o que mudou.
export function budgetAlerts(s:FinData,items:{collection:string;item:Partial<Item>}[]){const added=items.filter(p=>p.collection==='transactions'&&p.item.direction==='expense'&&typeof p.item.amount==='number'&&p.item.amount>0&&typeof p.item.date==='string').map(p=>p.item as Item);
 const out:string[]=[];
 for(const m of [...new Set(added.map(x=>x.date.slice(0,7)))].sort()){const before=budgetView(s,m),after=budgetView({...s,transactions:[...s.transactions,...added.filter(x=>x.date.startsWith(m))]},m);
  after.categories.forEach((c,i)=>{if(c.state!==before.categories[i].state&&(c.state==='over'||c.state==='near'))out.push(c.state==='over'?'⚠️ '+c.name+': '+formatMoney(c.spent)+' de '+formatMoney(c.cap)+', passou do teto.':'⚠️ '+c.name+' já usou '+c.pct+'% do teto.');});
  const a=after.month;if(a.state!==before.month.state&&(a.state==='over'||a.state==='near'))out.push(a.state==='over'?'⚠️ Teto do mês: '+formatMoney(a.spent)+' de '+formatMoney(a.cap)+', passou do teto.':'⚠️ Você já usou '+a.pct+'% do teto do mês.');}
 return out.slice(0,3);}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `node --experimental-strip-types --test tests/finance.test.mjs` → PASS.
Run: `npm test` e `npm run typecheck` → verde.

- [ ] **Step 5: Commit.**

```bash
git add lib/finance.ts tests/finance.test.mjs
git commit -m "Finanças: contas do mês, tetos, tendência, relatórios, filtro, CSV e avisos de teto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Assistente com orçamento e aviso de teto ao confirmar

**Files:**
- Modify:
  - `lib/agent.ts` (`financeReport`, linhas 31-36);
  - `lib/agent-runtime.ts` (esquema `proposal`, ferramenta `financas`, instruções);
  - `lib/chat-actions.ts` (`resolveChoice`);
  - `components/norte/NorteApp.tsx` (`Proposals`, por volta da linha 69).
- Test: `tests/agent.test.mjs`, `tests/chat-actions.test.mjs`

**Interfaces:**
- Consumes (Tarefas 1-2): `budgetView`, `budgetAlerts`, `EXPENSE_CATEGORIES`, `INCOME_CATEGORIES`, `PAYMENTS` e `formatMoney`, todos de `lib/finance.ts`.
- Produces:
  - `financeReport` ganha `tetoDoMes:{teto,gasto,situacao}` e `tetosPorCategoria:{categoria,teto,gasto,restante,situacao}[]`;
  - `resolveChoice('add:…')` acrescenta à `reply` as linhas de `budgetAlerts` separadas por `\n`.

- [ ] **Step 1: Write the failing tests.**

Em `tests/agent.test.mjs`, acrescente ao fim. `workspace()`, `formatMoney`, `financeReport`, `checkProposals` e `emptyWorkspace` já estão disponíveis no arquivo:

```js
test('relatório financeiro traz o teto do mês e os tetos por categoria',()=>{const s=workspace();s.profile.categoryBudgets={Alimentação:10000};const r=financeReport(s,'2026-10');
 assert.deepEqual(r.tetoDoMes,{teto:formatMoney(200000),gasto:formatMoney(15640),situacao:'dentro'});
 assert.deepEqual(r.tetosPorCategoria,[{categoria:'Alimentação',teto:formatMoney(10000),gasto:formatMoney(15640),restante:formatMoney(-5640),situacao:'estourado'}]);
 const none=emptyWorkspace('Geo');const r2=financeReport(none,'2026-10');assert.deepEqual([r2.tetoDoMes,r2.tetosPorCategoria],[{teto:'não definido',gasto:formatMoney(0),situacao:'sem teto'},[]]);});
test('sugestão de lançamento: categoria fora da lista salva, forma de pagamento opcional e validada',()=>{const s=emptyWorkspace('Geo');
 const a=checkProposals([{collection:'transactions',title:'Presente',amount:5000,direction:'expense',category:'Viagem'}],'2026-10-18',s);assert.deepEqual([a.errors,a.valid[0].item.category,a.valid[0].item.payment],[[],'Viagem',undefined]);
 const b=checkProposals([{collection:'transactions',title:'Uber',amount:2500,direction:'expense',category:'Transporte',payment:'pix'}],'2026-10-18',s);assert.equal(b.valid[0].item.payment,'pix');
 const c=checkProposals([{collection:'transactions',title:'Uber',amount:2500,direction:'expense',payment:'boleto'}],'2026-10-18',s);assert.equal(c.valid.length,0);assert.match(c.errors[0],/Forma de pagamento inválida/);});
```

(Confirme que o `workspace()` do arquivo tem `profile.budget = 200000`; o teste antigo espera `orcamentoRestante = formatMoney(184360)` com despesas de 15640. Se não tiver, ajuste o literal do teto e explique no relatório.)

Em `tests/chat-actions.test.mjs`, acrescente ao fim:

```js
test('confirmar uma despesa avisa quando passa do teto',()=>{const s=space();s.profile.categoryBudgets={Alimentação:10000};s.transactions=[{id:'t1',title:'Feira',amount:8000,direction:'expense',date:'2026-10-10',category:'Alimentação'}];
 const p={g:{items:[{collection:'transactions',item:{title:'Almoço',amount:3000,direction:'expense',date:'2026-10-16',category:'Alimentação'}}],createdAt:'2026-10-16T12:00:00Z'}};
 assert.equal(resolveChoice('add:g',s,p,NOON).reply,'✅ 1 item adicionado ao seu GeoAI.\n⚠️ Alimentação: R$ 110,00 de R$ 100,00, passou do teto.');
 assert.equal(resolveChoice('add:g1',space(),pending,NOON).reply,'✅ 2 itens adicionados ao seu GeoAI.');});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `node --experimental-strip-types --test tests/agent.test.mjs tests/chat-actions.test.mjs`
Expected: falham `tetoDoMes` indefinido e a `reply` sem o aviso. O teste de sugestão já pode passar, porque a validação de `payment` veio na Tarefa 1; isso é esperado e serve de guarda.

- [ ] **Step 3: Implement.**

`lib/agent.ts`:
- Acrescente `import { budgetView } from './finance.ts';` junto dos imports.
- Acima de `export function financeReport`, acrescente:

```ts
const SITUACAO:Record<string,string>={none:'sem teto',ok:'dentro',near:'perto',over:'estourado'};
```

- No `return` de `financeReport`, depois de `despesasPorCategoria:…`, acrescente estas chaves (calculando `const b=budgetView(s,month);` antes do `return`):

```ts
,tetoDoMes:{teto:b.month.cap?formatMoney(b.month.cap):'não definido',gasto:formatMoney(b.month.spent),situacao:SITUACAO[b.month.state]},tetosPorCategoria:b.categories.filter(c=>c.cap).map(c=>({categoria:c.name,teto:formatMoney(c.cap),gasto:formatMoney(c.spent),restante:formatMoney(c.cap-c.spent),situacao:SITUACAO[c.state]}))
```

`lib/agent-runtime.ts`:
- Acrescente `import {EXPENSE_CATEGORIES,INCOME_CATEGORIES,PAYMENTS} from './finance';` junto dos imports.
- No `proposal`, troque `category:z.string().optional(),` por:

```ts
category:z.string().optional().describe('Despesas: '+EXPENSE_CATEGORIES.join(', ')+'; receitas: '+INCOME_CATEGORIES.join(', ')),payment:z.enum(PAYMENTS.map(([id])=>id) as [string,...string[]]).optional().describe('Forma de pagamento do lançamento, só quando a pessoa disser'),
```

- Na descrição da ferramenta `financas`, troque `'Resumo financeiro de um mês: receitas, despesas, saldo, orçamento e despesas por categoria.'` por `'Resumo financeiro de um mês: receitas, despesas, saldo, teto do mês, tetos por categoria e despesas por categoria.'`.
- Nas instruções, troque `Para criar algo, chame propor_acoes.` por `Para criar algo, chame propor_acoes. Para lançamentos, use uma categoria da lista e, se a pessoa disser, a forma de pagamento.`.

`lib/chat-actions.ts`:
- Acrescente `import {budgetAlerts} from './finance.ts';`.
- Troque a última linha de `resolveChoice` (o `return {command:{type:'confirmPlan',…}`) por:

```ts
 return {command:{type:'confirmPlan',items:group.items},reply:['✅ '+(n===1?'1 item adicionado':n+' itens adicionados')+' ao seu GeoAI.',...budgetAlerts(state,group.items)].join('\n'),ack:'Adicionado!',pending:rest};}
```

`components/norte/NorteApp.tsx`, em `Proposals`:
- Use `const a=useApp();`. O componente é renderizado dentro do `Context.Provider` (linha 47); importe `useApp` de `./context` se ainda não estiver importado.
- Importe `budgetAlerts` de `@/lib/finance`.
- Em `add()`, calcule `const alerts=budgetAlerts(a.state,selected);` antes do `onSave`, e troque o `toast(...)` de sucesso por:

```ts
toast([selected.length+(selected.length===1?' item adicionado':' itens adicionados')+' ao seu espaço.',...alerts].join(' '))
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `node --experimental-strip-types --test tests/agent.test.mjs tests/chat-actions.test.mjs` → PASS.
Run: `npm test` e `npm run typecheck` → verde.

- [ ] **Step 5: Commit.**

```bash
git add lib/agent.ts lib/agent-runtime.ts lib/chat-actions.ts components/norte/NorteApp.tsx tests/agent.test.mjs tests/chat-actions.test.mjs
git commit -m "Assistente vê os tetos e avisa quando uma confirmação estoura o teto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tela — moldura, peças comuns, Visão geral, Lançamentos e formulários

**Files:**
- Modify: `components/norte/finance.tsx` (reescrito como moldura)
- Create:
  - `components/norte/finance-ui.tsx`;
  - `components/norte/finance-overview.tsx`;
  - `components/norte/finance-transactions.tsx`;
  - `components/norte/finance-accounts.tsx`;
  - `components/norte/finance-budget.tsx` e `components/norte/finance-reports.tsx`, só como esqueletos que a Tarefa 5 completa (ver Step 5).
- Modify:
  - `components/norte/catalog.ts` (`FIELDS.transactions` e `FIELDS.bills`, linhas 40-41);
  - `app/globals.css` (classes `fin-*` no fim e remoção do CSS da rosquinha).

**Interfaces:**
- Consumes:
  - de `lib/finance.ts`: `formatMoney`, `categoryInfo`, `PAYMENT_LABEL`, `PAYMENTS`, `EXPENSE_CATEGORIES`, `INCOME_CATEGORIES`, `shiftYm`, `budgetView`, `expenseByCategory`, `trend`, `filterTransactions` e `type CategoryRow`;
  - de `lib/core.ts`: `financeSummary` e `moneyToCents`.
- Produces:
  - em `finance.tsx`: `export type FinanceTab`, `export type FinanceProps={month:string;money:(c:number)=>string;hidden:boolean;setHidden:(v:boolean)=>void;goTo:(t:FinanceTab)=>void}` e `export function FinanceView()`;
  - em `finance-ui.tsx`: `CategoryIcon`, `CategoryBars`, `BarChart`, `TxList`, `shortMonth` e `type Money`.

- [ ] **Step 1: Shared pieces.** Crie `components/norte/finance-ui.tsx`:

```tsx
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
 <p><span>{r.name}</span><b>{money(r.total)}</b></p><span className="fin-bar"><i style={{width:Math.max(2,share)+'%',background:r.state==='over'?'var(--danger)':c.color}}/></span>
 <small>{share}% das saídas{r.cap?' · '+r.capPct+'% do teto ('+money(r.cap)+')':''}</small></div></li>;})}</ul>;}
// Barras proporcionais ao maior valor do gráfico; o valor exato fica no title de cada barra.
export function BarChart({groups,money,legend}:{groups:{label:string;values:{name:string;value:number;color:string}[]}[];money:Money;legend?:{name:string;color:string}[]}){const max=Math.max(1,...groups.flatMap(g=>g.values.map(v=>v.value)));
 return <div className="fin-chart">{legend&&<ul className="fin-legend">{legend.map(l=><li key={l.name}><i style={{background:l.color}}/>{l.name}</li>)}</ul>}<div className="fin-chart-bars">{groups.map(g=><div className="fin-chart-group" key={g.label}><div className="fin-chart-cols">
  {g.values.map(v=><span key={v.name} className="fin-chart-col" title={v.name+' · '+g.label+': '+money(v.value)} style={{height:Math.round(v.value/max*100)+'%',background:v.color}}/>)}</div><small>{g.label}</small></div>)}</div></div>;}
export function TxList({rows,money}:{rows:Item[];money:Money}){const a=useApp();const cards=new Map(a.state.cards.map(c=>[c.id,c.title]));
 return <div className="ledger"><div className="ledger-header"><span>Lançamento</span><span>Categoria</span><span>Data</span><span>Valor</span><span/></div>{rows.map(x=>{const meta=x.cardId?cards.get(x.cardId)||'Cartão':PAYMENT_LABEL[x.payment]||'Conta pessoal';
  return <div className="ledger-row" key={x.id}><span className="ledger-title"><CategoryIcon name={x.category} size={17}/><button onClick={()=>a.edit('transactions',x)}>{x.title}<small>{meta}</small></button></span><span className="pill">{categoryInfo(x.category).name}</span>
   <time>{String(x.date||'').slice(8)}/{String(x.date||'').slice(5,7)}</time><strong className={x.direction==='income'?'positive':''}>{x.direction==='income'?'+':'−'} {money(x.amount)}</strong><RecordActions item={x} onEdit={()=>a.edit('transactions',x)} onDelete={()=>a.remove('transactions',x)}/></div>;})}</div>;}
```

- [ ] **Step 2: Overview.** Crie `components/norte/finance-overview.tsx`:

```tsx
'use client';
import {useState} from 'react';import {Plus,Wallet,TrendingUp,TrendingDown,Eye,EyeOff,Settings,ArrowUpRight} from 'lucide-react';
import {useApp} from './context';import {Stat,Modal,Empty} from './primitives';import {CategoryBars,BarChart,TxList,shortMonth} from './finance-ui';import type {FinanceProps} from './finance';
import {financeSummary,moneyToCents} from '@/lib/core';import {budgetView,expenseByCategory,trend,filterTransactions} from '@/lib/finance';
// Visão geral: saldo, entradas e saídas, uso do teto do mês, para onde vai o dinheiro, tendência e últimos movimentos.
export function FinanceOverview({month,money,hidden,setHidden,goTo}:FinanceProps){const a=useApp();const [modal,setModal]=useState(false),[balance,setBalance]=useState('');
 const sum=financeSummary(a.state,month),b=budgetView(a.state,month).month,cats=expenseByCategory(a.state,month),tr=trend(a.state,month),recent=filterTransactions(a.state.transactions.filter(x=>x.date?.startsWith(month)),{}).slice(0,6);
 const open=()=>{setBalance((a.state.profile.openingBalance/100).toFixed(2).replace('.',','));setModal(true);};
 async function save(e:React.FormEvent){e.preventDefault();let cents:number;try{cents=moneyToCents(balance||'0');}catch{a.toast('Informe um valor válido.',true);return;}if(await a.mutate({type:'profile',profile:{openingBalance:cents}}))setModal(false);}
 return <><section className="finance-summary"><div className="balance-card"><div className="balance-head"><span>SALDO NO PERÍODO</span><button aria-label={hidden?'Mostrar valores':'Ocultar valores'} onClick={()=>setHidden(!hidden)}>{hidden?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><strong>{money(sum.balance)}</strong><p>Seu ponto de partida para fazer planos.</p><button onClick={open}>Ajustar saldo inicial<Settings size={14}/></button><Wallet className="balance-watermark" size={130}/></div>
  <div className="finance-side-stats"><Stat label="Entradas do mês" value={money(sum.income)} foot="Dinheiro que chegou" icon={TrendingUp}/><Stat label="Saídas do mês" value={money(sum.expense)} foot="Escolhas que já aconteceram" icon={TrendingDown}/></div></section>
  <div className="finance-grid"><section className="panel budget-card"><header className="section-heading"><h2>Orçamento do mês</h2><button className="text-button subtle" onClick={()=>goTo('budget')}>Ajustar tetos<ArrowUpRight size={15}/></button></header>
   {b.cap?<><strong>{money(b.spent)} <small>de {money(b.cap)}</small></strong><span className="fin-bar"><i style={{width:Math.min(100,b.pct)+'%',background:b.state==='over'?'var(--danger)':'var(--green)'}}/></span><p>{b.state==='over'?'Acima do teto em '+money(b.spent-b.cap)+'.':b.pct+'% do teto usado.'}</p></>
    :<><strong>{money(b.spent)}</strong><p>Defina um teto na aba Orçamento.</p></>}
   <div className="finance-quick"><button onClick={()=>a.edit('transactions',undefined,{direction:'expense'})}><Plus size={16}/>Despesa</button><button onClick={()=>a.edit('transactions',undefined,{direction:'income'})}><Plus size={16}/>Receita</button></div></section>
  <section className="panel category-card"><header className="section-heading"><h2>Para onde está indo</h2><span className="tiny-label">DESPESAS</span></header>{cats.length?<CategoryBars rows={cats} money={money}/>:<p className="quiet-copy">O retrato dos seus gastos aparece com os primeiros lançamentos.</p>}</section></div>
  <section className="panel"><header className="section-heading"><h2>Tendência de saídas</h2><span className="tiny-label">6 MESES</span></header><BarChart groups={tr.map(m=>({label:shortMonth(m.month),values:[{name:'Saídas',value:m.expense,color:'#b5655b'}]}))} money={money}/></section>
  <section className="panel"><header className="section-heading"><h2>Últimos movimentos</h2><button className="text-button subtle" onClick={()=>goTo('transactions')}>Ver todos<ArrowUpRight size={15}/></button></header>
   {recent.length?<TxList rows={recent} money={money}/>:<Empty title="O mês ainda está em branco" description="Registre uma entrada ou despesa para entender seu dinheiro." action="Adicionar lançamento" onAction={()=>a.edit('transactions')}/>}</section>
  {modal&&<Modal title="Seu ponto de partida" subtitle="O saldo com que você começou a acompanhar suas finanças." onClose={()=>setModal(false)}><form onSubmit={save}><div className="form-grid"><label className="field"><span>Saldo inicial (R$)</span><input value={balance} onChange={e=>setBalance(e.target.value)} inputMode="decimal" required/></label></div>
   <footer className="modal-footer"><button type="button" className="button ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="button primary" disabled={a.busy}>Salvar</button></footer></form></Modal>}</>;}
```

- [ ] **Step 3: Lançamentos.** Crie `components/norte/finance-transactions.tsx`:

```tsx
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
```

- [ ] **Step 4: Contas fixas e Cartões.** Crie `components/norte/finance-accounts.tsx`, levando o JSX das abas `bills` e `cards` do `finance.tsx` de hoje **sem mudar o comportamento**. A única diferença é que `rows` (os lançamentos do mês) passa a ser calculado dentro do componente:

```tsx
'use client';
import {Plus,Check,CreditCard} from 'lucide-react';
import {useApp} from './context';import {Empty,RecordActions} from './primitives';import {Records} from './records';import type {FinanceProps} from './finance';
// Contas fixas e cartões, como antes; só mudaram de arquivo.
export function FinanceBills({month}:FinanceProps){const a=useApp();
 return <><div className="section-action"><p>As contas de todos os meses, sem perder de vista.</p><button className="button primary" onClick={()=>a.edit('bills')}><Plus size={16}/>Nova conta fixa</button></div><Records collection="bills" renderExtra={bill=><div className="bill-footer"><span>Vence dia {bill.day||10}</span><button className="button outline small" disabled={a.busy||bill.paidMonths?.includes(month)} onClick={async()=>{if(await a.mutate({type:'payBill',id:bill.id,month}))a.toast('Conta marcada como paga e despesa registrada.');}}><Check size={14}/>{bill.paidMonths?.includes(month)?'Paga neste mês':'Marcar como paga'}</button></div>}/></>;}
export function FinanceCards({month,money}:FinanceProps){const a=useApp();const rows=a.state.transactions.filter(x=>x.date?.startsWith(month)).sort((x,y)=>y.date.localeCompare(x.date));
 return <><div className="section-action"><p>Cartões organizados. Parcelas que cabem no plano.</p><div className="button-group"><button className="button outline" onClick={()=>a.edit('cards')}><Plus size={16}/>Cartão</button><button className="button primary" onClick={()=>a.edit('transactions',undefined,{},true)}><Plus size={16}/>Compra parcelada</button></div></div>
  <div className="cards-grid">{a.state.cards.map((c,i)=>{const total=rows.filter(x=>x.cardId===c.id&&x.direction==='expense').reduce((s,x)=>s+x.amount,0);return <article className={'bank-card bank-'+i%3} key={c.id}><div><CreditCard size={25}/><RecordActions item={c} onEdit={()=>a.edit('cards',c)} onDelete={()=>a.remove('cards',c)}/></div><p>{c.title}</p><strong>{money(total)}</strong><small>Lançamentos em {month}</small><div className="card-dates"><span>Fecha dia {c.closingDay||25}</span><span>Vence dia {c.dueDay||5}</span></div>{c.target>0&&<small>Limite {money(c.target)}</small>}</article>;})}</div>
  {!a.state.cards.length&&<section className="panel"><Empty title="Seus cartões, em um só lugar" description="Cadastre o nome, fechamento e vencimento para acompanhar seus lançamentos." action="Adicionar cartão" onAction={()=>a.edit('cards')} icon={CreditCard}/></section>}
  <section className="panel"><header className="section-heading"><h2>Parcelas deste mês</h2></header>{rows.some(x=>x.installmentGroup)?<Records collection="transactions" compact items={rows.filter(x=>x.installmentGroup)}/>:<p className="quiet-copy padded">Nenhuma parcela neste mês. As compras parceladas aparecerão aqui.</p>}</section></>;}
```

- [ ] **Step 5: Moldura.** Reescreva `components/norte/finance.tsx` inteiro:

```tsx
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
```

Para o build passar antes da Tarefa 5, crie `components/norte/finance-budget.tsx` e `components/norte/finance-reports.tsx` como esqueletos:

```tsx
'use client';import type {FinanceProps} from './finance';
export function FinanceBudget(_:FinanceProps){return null;}
```

```tsx
'use client';import type {FinanceProps} from './finance';
export function FinanceReports(_:FinanceProps){return null;}
```

Se o lint reclamar de `_` sem uso, use `{}:FinanceProps`. A Tarefa 5 substitui os dois.

- [ ] **Step 6: Formulários.** Em `components/norte/catalog.ts`:
- importe `EXPENSE_CATEGORIES`, `INCOME_CATEGORIES` e `PAYMENTS` de `@/lib/finance`;
- troque as linhas `transactions:[…]` e `bills:[…]` por:

```ts
transactions:[title,amount,{key:'direction',label:'Tipo',type:'select',options:[['expense','Despesa'],['income','Receita']],default:'expense'},date,{...cat(EXPENSE_CATEGORIES),showIf:v=>v.direction!=='income'},{...cat(INCOME_CATEGORIES),showIf:v=>v.direction==='income'},{key:'payment',label:'Forma de pagamento',type:'select',options:[['','Não informada'],...PAYMENTS.map(([v,l])=>[v,l])]},{key:'cardId',label:'Cartão',type:'select',source:'cards'},notes],
bills:[title,amount,{key:'day',label:'Dia de vencimento',type:'number',min:1,max:31,default:10},cat(EXPENSE_CATEGORIES),notes],
```

O `Editor` (primitives) já mostra só o campo cujo `showIf` é verdadeiro e guarda um único `category`. Confira que `Field` aceita `showIf` (os campos de `contraceptives` já usam). Se o TypeScript reclamar do tipo das `options` montadas a partir de `PAYMENTS`, use `[v,l] as [string,string]`.

- [ ] **Step 7: CSS.** Em `app/globals.css`:
- apague as regras cujos seletores começam por `.donut` e `.category-legend`, depois de confirmar com o Grep que nenhum `.tsx` ainda usa essas classes;
- acrescente no fim do arquivo:

```css
.fin-cat-icon{display:inline-grid;place-items:center;flex:none;width:34px;height:34px;border-radius:10px}
.fin-bars{list-style:none;margin:0;padding:6px 24px 20px;display:grid;gap:14px}.fin-bars li{display:flex;gap:12px;align-items:flex-start}.fin-bars li>div{flex:1;min-width:0}.fin-bars p{display:flex;justify-content:space-between;gap:10px;margin:0 0 6px;font-size:13px}.fin-bars small{display:block;margin-top:5px;color:var(--subtle);font-size:11px}
.fin-bar{display:block;height:7px;border-radius:99px;background:var(--surface-2);overflow:hidden}.fin-bar>i{display:block;height:100%;border-radius:inherit}
.budget-card .fin-bar{margin:12px 0 10px}
.fin-chart{padding:8px 24px 22px}.fin-legend{list-style:none;display:flex;gap:14px;margin:0 0 10px;padding:0;font-size:11px;color:var(--muted)}.fin-legend li{display:flex;align-items:center;gap:6px}.fin-legend i{width:10px;height:10px;border-radius:3px}
.fin-chart-bars{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:10px;align-items:end;height:150px}.fin-chart-group{display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;min-width:0}.fin-chart-cols{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:3px}.fin-chart-col{display:block;width:min(22px,45%);min-height:2px;border-radius:5px 5px 2px 2px}.fin-chart-group small{font-size:10px;color:var(--subtle);text-transform:capitalize}
.fin-filters{display:flex;flex-wrap:wrap;gap:8px;padding:0 24px 16px}.fin-filters select,.fin-filters input{min-height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);padding:0 10px;font:inherit;font-size:12px}.fin-filters input{flex:1;min-width:160px}
.fin-segment{display:inline-flex;padding:3px;border-radius:10px;background:var(--surface-2)}.fin-segment button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:12px;padding:6px 12px;border-radius:8px;cursor:pointer}.fin-segment button.active{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
@media(max-width:580px){.fin-bars,.fin-chart,.fin-filters{padding-left:18px;padding-right:18px}.fin-chart-bars{height:120px;gap:6px}.fin-filters input{min-width:100%}}
```

- [ ] **Step 8: Verify.**

Run: `npm run typecheck` → sem erros.
Run: `npx eslint components/norte/finance.tsx components/norte/finance-ui.tsx components/norte/finance-overview.tsx components/norte/finance-transactions.tsx components/norte/finance-accounts.tsx components/norte/finance-budget.tsx components/norte/finance-reports.tsx components/norte/catalog.ts` → sem erros nem avisos novos.
Run: `npm test` → verde.
Run: `npm run build` → conclui.
Confira também `tests/e2e.mjs`. Se ele procurar o texto antigo "Ajustar saldo inicial e orçamento" ou a rosquinha, atualize-o para "Ajustar saldo inicial" e cite no relatório. O e2e não roda localmente (exige login).

- [ ] **Step 9: Commit.**

```bash
git add components/norte/finance.tsx components/norte/finance-ui.tsx components/norte/finance-overview.tsx components/norte/finance-transactions.tsx components/norte/finance-accounts.tsx components/norte/finance-budget.tsx components/norte/finance-reports.tsx components/norte/catalog.ts app/globals.css
git commit -m "Finanças em abas: visão geral com tetos e tendência, lançamentos com filtros e forma de pagamento" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Telas de Orçamento e Relatórios (com CSV)

**Files:**
- Modify (substituir os esqueletos): `components/norte/finance-budget.tsx`, `components/norte/finance-reports.tsx`
- Modify: `app/globals.css` (classes `fin-*` dessas abas, no fim)

**Interfaces:**
- Consumes:
  - de `lib/finance.ts`: `budgetView`, `reportCards`, `insights`, `trend`, `expenseByCategory`, `topExpenses`, `transactionsCsv`, `categoryInfo` e `type CapState`;
  - de `lib/core.ts`: `moneyToCents`;
  - de `./finance-ui`: `CategoryIcon`, `CategoryBars`, `BarChart` e `shortMonth`;
  - de `./finance`: `type FinanceProps`.
- Produces: `FinanceBudget(p:FinanceProps)` e `FinanceReports(p:FinanceProps)`.

- [ ] **Step 1: Orçamento.** Substitua `components/norte/finance-budget.tsx`:

```tsx
'use client';
import {useApp} from './context';import {CategoryIcon} from './finance-ui';import type {FinanceProps} from './finance';
import {moneyToCents} from '@/lib/core';import {budgetView,categoryInfo,type CapState} from '@/lib/finance';
// Orçamento: teto do mês e tetos por categoria, salvos ao sair do campo; os tetos valem para todos os meses.
const MONTH_LABEL:Record<CapState,string>={none:'Sem teto',ok:'Dentro do teto',near:'Perto do teto',over:'Acima do teto'};
const PILL:Record<CapState,string>={none:'pill',ok:'pill green',near:'pill warn',over:'pill danger'};
function CapBar({pct,over,color}:{pct:number;over:boolean;color:string}){return <span className="fin-bar"><i style={{width:Math.min(100,pct)+'%',background:over?'var(--danger)':color}}/></span>;}
// Campo de teto: vazio ou zero vira "sem teto"; texto inválido avisa e volta ao valor salvo.
function CapInput({label,cents,onSave}:{label:string;cents:number;onSave:(c:number)=>Promise<boolean>}){const a=useApp();const shown=cents?(cents/100).toFixed(2).replace('.',','):'';
 return <label className="fin-money"><span>Teto</span><input key={cents} aria-label={label} defaultValue={shown} inputMode="decimal" placeholder="Sem teto" onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}
  onBlur={async e=>{const input=e.currentTarget,raw=input.value.trim();let next:number;try{next=raw?moneyToCents(raw):0;}catch{a.toast('Informe um valor válido.',true);input.value=shown;return;}if(next===cents)return;if(!await onSave(next))input.value=shown;}}/></label>;}
export function FinanceBudget({month,money}:FinanceProps){const a=useApp();const b=budgetView(a.state,month),m=b.month;
 const save=(profile:Record<string,unknown>)=>a.mutate({type:'profile',profile});
 return <><section className="panel"><header className="section-heading"><h2>Teto do mês</h2><span className={PILL[m.state]}>{MONTH_LABEL[m.state]}</span></header>
  <div className="fin-budget-body"><CapInput label="Teto do mês" cents={m.cap} onSave={c=>save({budget:c})}/><p>Gasto até agora: <b>{money(m.spent)}</b>{m.cap?' · '+m.pct+'% do teto':''}</p><CapBar pct={m.pct} over={m.state==='over'} color="var(--green)"/></div></section>
  <section className="panel"><header className="section-heading"><h2>Categorias</h2><span className="fin-sum">Soma {money(b.capsSum)}</span></header>
   {b.capsOverMonth>0&&<p className="fin-warning">A soma dos tetos por categoria passa do teto do mês em {money(b.capsOverMonth)}.</p>}
   <ul className="fin-budget-list">{b.categories.map(c=><li key={c.name}><CategoryIcon name={c.name}/><div><p><b>{c.name}</b>{c.state==='over'&&<span className="pill danger">Estouro</span>}{c.state==='near'&&<span className="pill warn">Perto</span>}</p>
    <small>{money(c.spent)}{c.cap?' de '+money(c.cap):' · sem teto'}</small><CapBar pct={c.pct} over={c.state==='over'} color={categoryInfo(c.name).color}/></div>
    <CapInput label={'Teto de '+c.name} cents={c.cap} onSave={v=>save({categoryBudgets:{[c.name]:v}})}/></li>)}</ul></section></>;}
```

- [ ] **Step 2: Relatórios.** Substitua `components/norte/finance-reports.tsx`:

```tsx
'use client';
import {Download} from 'lucide-react';
import {useApp} from './context';import {Stat} from './primitives';import {CategoryIcon,CategoryBars,BarChart,shortMonth} from './finance-ui';import type {FinanceProps} from './finance';
import {reportCards,insights,trend,expenseByCategory,topExpenses,transactionsCsv,categoryInfo} from '@/lib/finance';
// Relatórios do mês: cartões, alertas, entradas e saídas em 6 meses, composição, maiores saídas e exportação CSV.
export function FinanceReports({month,money}:FinanceProps){const a=useApp();const c=reportCards(a.state,month,a.today),alerts=insights(a.state,month,a.today),tr=trend(a.state,month),cats=expenseByCategory(a.state,month),top=topExpenses(a.state,month);
 const vs=c.vsPrev.kind==='new'?'Novo':c.vsPrev.kind==='stable'?'Estável':(c.vsPrev.pct>0?'+':'−')+Math.abs(c.vsPrev.pct)+'%';
 function exportCsv(){const url=URL.createObjectURL(new Blob([transactionsCsv(a.state)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='geoai-lancamentos.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);}
 return <><div className="stats-grid three"><Stat label="Média diária" value={c.dailyAvg===null?'—':money(c.dailyAvg)} foot="Saídas por dia corrido"/><Stat label="vs mês anterior" value={vs} foot={money(c.vsPrev.prev)+' no mês anterior'}/><Stat label="Maior categoria" value={c.top?c.top.name:'—'} foot={c.top?money(c.top.total):'Sem saídas no mês'}/></div>
  <section className="panel"><header className="section-heading"><h2>Alertas</h2></header>{alerts.length?<ul className="fin-alerts">{alerts.map(t=><li key={t}>{t}</li>)}</ul>:<p className="quiet-copy padded">Nenhum alerta neste mês.</p>}</section>
  <section className="panel"><header className="section-heading"><h2>Entradas e saídas</h2><span className="tiny-label">6 MESES</span></header><BarChart groups={tr.map(m=>({label:shortMonth(m.month),values:[{name:'Entradas',value:m.income,color:'var(--green)'},{name:'Saídas',value:m.expense,color:'#b5655b'}]}))} money={money} legend={[{name:'Entradas',color:'var(--green)'},{name:'Saídas',color:'#b5655b'}]}/></section>
  <div className="finance-grid"><section className="panel"><header className="section-heading"><h2>Composição do mês</h2></header>{cats.length?<CategoryBars rows={cats} money={money}/>:<p className="quiet-copy padded">Sem saídas neste mês.</p>}</section>
   <section className="panel"><header className="section-heading"><h2>Maiores saídas</h2></header>{top.length?<ol className="fin-top">{top.map(x=><li key={x.id}><CategoryIcon name={x.category}/><span><b>{x.title}</b><small>{categoryInfo(x.category).name} · {x.date.slice(8)}/{x.date.slice(5,7)}</small></span><strong>{money(x.amount)}</strong></li>)}</ol>:<p className="quiet-copy padded">Sem saídas neste mês.</p>}</section></div>
  <div className="section-action"><p>Leve seus lançamentos para uma planilha.</p><button className="button outline" disabled={!a.state.transactions.length} onClick={exportCsv}><Download size={16}/>Exportar CSV</button></div></>;}
```

- [ ] **Step 3: CSS.** Acrescente no fim de `app/globals.css`:

```css
.fin-budget-body{padding:0 24px 22px;display:grid;gap:12px}.fin-budget-body p{margin:0;font-size:13px;color:var(--muted)}.fin-budget-body b{color:var(--text)}.fin-sum{font-size:12px;color:var(--muted)}
.fin-money{display:grid;gap:5px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--subtle)}.fin-money input{width:150px;min-height:38px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--text);padding:0 10px;font:inherit;font-size:13px;letter-spacing:0;text-transform:none}
.fin-budget-list{list-style:none;margin:0;padding:0}.fin-budget-list li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:16px 24px;border-top:1px solid var(--border)}.fin-budget-list p{display:flex;align-items:center;gap:8px;margin:0 0 3px;font-size:14px}.fin-budget-list small{display:block;margin-bottom:7px;color:var(--muted);font-size:12px}
.fin-warning{margin:0 24px 14px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--gold) 14%,transparent);color:var(--text);font-size:12px}
.fin-alerts{margin:0;padding:4px 24px 20px 42px;display:grid;gap:8px;font-size:13px}
.fin-top{list-style:none;margin:0;padding:0 24px 18px;display:grid;gap:12px}.fin-top li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center}.fin-top b{display:block;font-size:13px}.fin-top small{color:var(--subtle);font-size:11px}.fin-top strong{font-size:13px}
@media(max-width:580px){.fin-budget-body,.fin-top{padding-left:18px;padding-right:18px}.fin-budget-list li{grid-template-columns:auto minmax(0,1fr);padding:14px 18px}.fin-budget-list .fin-money{grid-column:1/-1}.fin-money input{width:100%}.fin-alerts{padding-left:34px;padding-right:18px}.fin-warning{margin-left:18px;margin-right:18px}}
```

- [ ] **Step 4: Verify.**

Run: `npm run typecheck` → sem erros.
Run: `npx eslint components/norte/finance-budget.tsx components/norte/finance-reports.tsx` → sem erros nem avisos.
Run: `npm test` → verde.
Run: `npm run build` → conclui.

- [ ] **Step 5: Commit.**

```bash
git add components/norte/finance-budget.tsx components/norte/finance-reports.tsx app/globals.css
git commit -m "Abas Orçamento (tetos por categoria) e Relatórios (alertas, gráficos e CSV)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Conferência visual (feita pelo controlador, sem commit de código)

O app exige login do Clerk e o `.env.local` local não tem as chaves. Por isso, a conferência usa a página isolada da memória do projeto (`tooling-quirks`):
- empacota a `FinanceView` com o esbuild do projeto (`alias {'@':root}`, `nodePaths`), dentro de um `Context.Provider` falso;
- compila o `globals.css` com `@tailwindcss/postcss`;
- dirige a página com o `playwright-core` e o Chrome instalado.

O roteiro e a página ficam no scratchpad, nunca no repositório.

- [ ] **Step 1: Montar.** O `Context` falso tem `state` com:
  - 2 cartões, 3 contas fixas;
  - lançamentos em 6 meses: várias categorias, uma antiga ("Viagem"), PIX, cartão e sem forma;
  - `budget` e alguns `categoryBudgets`: um estourado, um perto, um dentro.

  O `mutate` aplica o comando com `applyCommand` de `@/lib/core` e atualiza o estado em memória, para os tetos salvos aparecerem. O `edit` e o `toast` registram as chamadas em `window`.
- [ ] **Step 2: Conferir em 375×812 e 1440×1000, nos temas claro e escuro** (esperar 400 ms depois de trocar `data-theme`), cada uma das 6 abas:
  - sem rolagem horizontal;
  - os filtros de Lançamentos (tipo, categoria, forma, busca com acento) mudam a contagem;
  - em Orçamento:
    - um teto digitado e o blur salvam e atualizam o selo;
    - um valor apagado volta para "sem teto";
    - "abc" chama o `toast` de erro e o campo volta ao valor;
  - o modo "ocultar valores" (o olho na Visão geral) não deixa nenhum "R$" visível nas abas;
  - "Exportar CSV" baixa um arquivo que começa com o BOM e o cabeçalho;
  - o mês anterior e o seguinte atualizam as abas.
- [ ] **Step 3: Revisar as capturas** (Read nas imagens). Problemas viram correção, despachada a um implementador com nova revisão.
- [ ] **Step 4: Limpar.** Nada da conferência fica no worktree (`git status` limpo).
