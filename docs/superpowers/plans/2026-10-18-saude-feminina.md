# Menu Saúde feminina — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o menu Saúde feminina (ciclo, anticoncepcional com lembrete no Telegram, exames lidos pela IA, preventivos e dicas), visível só para quem escolheu ser tratada no feminino.

**Architecture:** As regras puras ficam em `lib/female-health.ts`, que não depende do `core.ts` (o `core.ts` importa esse arquivo para validar registros e montar a Agenda). O lembrete segue o padrão de `lib/trt-reminders.ts`, com dependências injetadas, e é chamado de hora em hora por 24 crons diários da Vercel. Os exames reaproveitam a coleção `labExams`, as rotas e o `ExamsPanel`, com prompts e alertas escolhidos pelo gênero do perfil.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, testes com `node --experimental-strip-types --test`, AI SDK 7 (OpenAI Responses), Telegram Bot API, Vercel Cron (Hobby).

**Spec:** `docs/superpowers/specs/2026-10-18-saude-feminina-design.md`

## Global Constraints

- Trabalhe só no worktree `C:\Users\Geovanni\Documents\GeoIA\norte\.claude\worktrees\versao-feminina`, branch `feat/versao-feminina`. Nunca troque a branch da pasta principal: outra sessão trabalha lá.
- Os arquivos de `lib/` importados pelos testes usam extensão explícita (`'./core.ts'`); componentes usam `@/lib/...` sem extensão.
- `lib/female-health.ts` não pode importar `lib/core.ts`, para evitar import circular.
- Texto do lembrete, exato: `Lembrete do GeoAI: hora do seu cuidado.`
- Vercel Hobby: só cron diário. São 24 entradas `0 H * * *` no mesmo caminho `/api/cron/female-reminders`, mais o cron existente da testosterona, num total de 25 (limite: 100).
- Sem dependências novas. Interface e textos em português do Brasil.
- Estilo do repositório: código denso, em poucas linhas, e comentários curtos em português só onde explicam o porquê.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verificação de cada tarefa: `npm test` e `npm run typecheck` sem erros novos. O lint do repositório já tem 87 problemas antigos; não crie novos nos arquivos tocados.

## Review Focus

1. Fuso horário: às 00:30 UTC já é 21:30 em São Paulo do dia anterior, e o lembrete marcado para 21:00 deve sair com a data local (teste na Tarefa 5).
2. Menstruação digitada com data futura não pode mudar a previsão atual (teste na Tarefa 2).
3. Trocar de gênero com dados do outro menu: os itens somem da Agenda e dos lembretes, e os dados ficam (testes nas Tarefas 4 e 5).
4. "Tomei" tocado duas vezes, ou pelo app e pelo Telegram no mesmo dia, não duplica o registro (testes nas Tarefas 1 e 5).
5. Preventivo cuja última data é dia 31 cai no último dia do mês seguinte, e não vira o mês (teste na Tarefa 3).

---

### Tarefa 1: Coleções novas, validação e formulários

**Files:**
- Create: `lib/female-health.ts`
- Modify: `lib/types.ts`, `lib/core.ts`, `components/norte/catalog.ts`, `package.json`
- Test: `tests/female-health.test.mjs`

**Interfaces:**
- Produces: as coleções `periods`, `symptoms`, `contraceptives`, `contraceptiveDoses` e `preventives` em `COLLECTIONS`; as constantes `SYMPTOMS`, `FLOWS`, `METHODS`, `METHOD_SHORT` e `FLOW_LABEL` em `lib/female-health.ts`; e `Field.showIf?:(values:any)=>boolean` em `catalog.ts`.

- [ ] **Step 1: Escrever o teste que falha** — criar `tests/female-health.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, applyCommand, validateItem, upgradeWorkspace, validateWorkspace } from '../lib/core.ts';

const T='2026-10-18';
const up=(s,collection,item)=>applyCommand(s,{type:'upsert',collection,item},T);

test('coleções novas existem e espaços antigos ganham listas vazias',()=>{const s=emptyWorkspace('Ana');for(const k of ['periods','symptoms','contraceptives','contraceptiveDoses','preventives'])assert.deepEqual(s[k],[]);
 const old=emptyWorkspace('Ana');delete old.periods;delete old.preventives;const u=upgradeWorkspace({...old});assert.deepEqual([u.periods,u.preventives],[[],[]]);assert.doesNotThrow(()=>validateWorkspace(old));});
test('menstruação valida fluxo e fim e não repete o início',()=>{let s=emptyWorkspace('Ana');s=up(s,'periods',{id:'p1',title:'Menstruação',date:'2026-10-01',endDate:'2026-10-05',flow:'moderado'});assert.equal(s.periods.length,1);
 assert.throws(()=>up(s,'periods',{title:'M',date:'2026-10-01'}),/Já existe uma menstruação/);
 assert.throws(()=>validateItem('periods',{title:'M',date:'2026-10-10',endDate:'2026-10-09'}),/até 15 dias/);
 assert.throws(()=>validateItem('periods',{title:'M',date:'2026-10-10',endDate:'2026-10-26'}),/até 15 dias/);
 assert.throws(()=>validateItem('periods',{title:'M',date:'2026-10-10',flow:'muito'}),/Fluxo inválido/);
 assert.throws(()=>validateItem('periods',{title:'M'}),/data do registro/);});
test('sintomas aceitam só a lista fixa, um registro por dia',()=>{let s=emptyWorkspace('Ana');s=up(s,'symptoms',{id:'s1',title:'Sintomas do dia',date:T,symptoms:['Cólica','Acne'],mood:3});assert.deepEqual(s.symptoms[0].symptoms,['Cólica','Acne']);
 assert.throws(()=>up(s,'symptoms',{title:'Outro',date:T}),/Já existe um registro para esta data/);
 assert.throws(()=>validateItem('symptoms',{title:'S',date:T,symptoms:['Febre alta']}),/Sintoma inválido/);
 assert.throws(()=>validateItem('symptoms',{title:'S',date:T,mood:9}),/Humor inválido/);});
test('método valida campos por tipo',()=>{const pill=validateItem('contraceptives',{title:'Yasmin',method:'daily',startDate:'2026-10-01',remind:true,time:'21:00'});assert.deepEqual([pill.activeDays,pill.pauseDays,pill.status],[21,7,'active']);
 assert.throws(()=>validateItem('contraceptives',{title:'Yasmin',method:'daily',startDate:'2026-10-01',remind:true}),/horário do lembrete/);
 assert.throws(()=>validateItem('contraceptives',{title:'X',method:'daily',startDate:'2026-10-01',activeDays:0}),/dias de uso/);
 assert.equal(validateItem('contraceptives',{title:'Depo',method:'injection',startDate:'2026-10-01',intervalDays:90}).intervalDays,90);
 assert.throws(()=>validateItem('contraceptives',{title:'Depo',method:'injection',startDate:'2026-10-01'}),/intervalo entre 1 e 120 dias/);
 assert.throws(()=>validateItem('contraceptives',{title:'Mirena',method:'iud',startDate:'2026-10-01',changeDate:'2026-09-01'}),/data de troca/);
 assert.equal(validateItem('contraceptives',{title:'Mirena',method:'iud',startDate:'2024-01-10',changeDate:'2029-01-10'}).method,'iud');
 assert.throws(()=>validateItem('contraceptives',{title:'X',method:'adesivo',startDate:'2026-10-01'}),/Método inválido/);
 assert.throws(()=>validateItem('contraceptives',{title:'X',method:'daily'}),/data de início/);});
test('registro de uso exige método e é único por método e dia',()=>{let s=emptyWorkspace('Ana');s=up(s,'contraceptiveDoses',{id:'take-m1-'+T,title:'Tomei: Yasmin',date:T,methodId:'m1'});
 assert.throws(()=>up(s,'contraceptiveDoses',{title:'Tomei',date:T,methodId:'m1'}),/Já existe um registro deste método/);
 assert.doesNotThrow(()=>up(s,'contraceptiveDoses',{title:'Tomei',date:T,methodId:'m2'}));
 assert.throws(()=>validateItem('contraceptiveDoses',{title:'Tomei',date:T}),/Escolha o método/);});
test('preventivo exige intervalo em meses',()=>{assert.equal(validateItem('preventives',{title:'Papanicolau',intervalMonths:12,lastDate:'2025-10-01'}).intervalMonths,12);
 assert.throws(()=>validateItem('preventives',{title:'Papanicolau'}),/intervalo entre 1 e 120 meses/);assert.throws(()=>validateItem('preventives',{title:'P',intervalMonths:200}),/intervalo entre 1 e 120 meses/);});
```

Em `package.json`, no script `test`, acrescente ` tests/female-health.test.mjs` depois de `tests/gender.test.mjs`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs`
Expected: FAIL (`s[k]` é `undefined` e `Registro inválido` nas coleções novas).

- [ ] **Step 3: Implementar**

`lib/types.ts`: no fim do array `COLLECTIONS`, troque `'labExams','trtProtocols','trtDoses'] as const;` por:

```ts
'labExams','trtProtocols','trtDoses','periods','symptoms','contraceptives','contraceptiveDoses','preventives'] as const;
```

Criar `lib/female-health.ts`:

```ts
// Regras do menu Saúde feminina. Datas, previsões e alertas são calculados aqui; a IA só lê laudos e escreve pareceres.
// Não importa o core: o core usa este arquivo para validar registros e montar a agenda.
export const SYMPTOMS=['Cólica','Dor de cabeça','Inchaço','Seios sensíveis','Acne','Cansaço','Alteração de humor','Ansiedade','Insônia','Desejo por doce','Náusea','Sangramento fora do período'] as const;
export const FLOWS=[['leve','Leve'],['moderado','Moderado'],['intenso','Intenso']] as const;
export const METHODS=[['daily','Uso diário (pílula, comprimido ou gel)'],['injection','Injeção'],['iud','DIU ou implante']] as const;
export const METHOD_SHORT:Record<string,string>={daily:'uso diário',injection:'injeção',iud:'DIU ou implante'};
export const FLOW_LABEL:Record<string,string>=Object.fromEntries(FLOWS);
```

`lib/core.ts`:

1. Depois de `import { HAIR_STYLES } from './gender.ts';`, acrescente:
```ts
import { SYMPTOMS, FLOWS, METHODS } from './female-health.ts';
```
2. Antes da linha `// Coleções criadas depois do lançamento: espaços e backups antigos ganham a lista vazia.`, acrescente:
```ts
// Menu Saúde feminina.
for(const key of ['endDate','flow','symptoms','method','activeDays','pauseDays','changeDate','methodId','intervalMonths','lastDate','snoozeHour'])VALID_KEYS.add(key);for(const key of ['activeDays','pauseDays','intervalMonths','snoozeHour'])NUMBERS.add(key);for(const key of ['endDate','changeDate','lastDate'])DATES.add(key);
```
3. Troque `const ADDED_COLLECTIONS=['labExams','trtProtocols','trtDoses'];` por:
```ts
const ADDED_COLLECTIONS=['labExams','trtProtocols','trtDoses','periods','symptoms','contraceptives','contraceptiveDoses','preventives'];
```
4. Em `validateItem`, troque `['weekdays','paidMonths','tags'].includes(key)` por `['weekdays','paidMonths','tags','symptoms'].includes(key)`.
5. Na lista de coleções que exigem data, troque `'focusSessions','chores','labExams','trtDoses'].includes(collection)&&!item.date)` por `'focusSessions','chores','labExams','trtDoses','periods','symptoms','contraceptiveDoses'].includes(collection)&&!item.date)`.
6. Logo depois da linha que começa com `if(collection==='trtDoses'){if(typeof item.protocolId!=='string'`, acrescente:
```ts
 if(collection==='periods'){if(item.flow&&!FLOWS.some(([id])=>id===item.flow))throw new Error('Fluxo inválido');if(item.endDate&&(item.endDate<item.date||(Date.parse(item.endDate+'T12:00:00Z')-Date.parse(item.date+'T12:00:00Z'))/86400000>15))throw new Error('O fim deve ficar entre o início e até 15 dias depois');}
 if(collection==='symptoms'){if(item.mood!==undefined&&(!Number.isInteger(item.mood)||item.mood<1||item.mood>5))throw new Error('Humor inválido');if((item.symptoms||[]).some((x:string)=>!(SYMPTOMS as readonly string[]).includes(x)))throw new Error('Sintoma inválido');}
 if(collection==='contraceptives'){item.method??='daily';if(!METHODS.some(([id])=>id===item.method))throw new Error('Método inválido');if(!item.startDate)throw new Error('Informe a data de início');item.status??='active';if(!['active','paused'].includes(item.status))throw new Error('Situação inválida');
  if(item.method==='daily'){item.activeDays??=21;item.pauseDays??=7;if(!Number.isInteger(item.activeDays)||item.activeDays<1||item.activeDays>90||!Number.isInteger(item.pauseDays)||item.pauseDays>30)throw new Error('Informe dias de uso (1 a 90) e de pausa (0 a 30)');}
  if(item.method==='injection'&&(!Number.isInteger(item.intervalDays)||item.intervalDays<1||item.intervalDays>120))throw new Error('Informe o intervalo entre 1 e 120 dias');
  if(item.method==='iud'&&(!item.changeDate||item.changeDate<=item.startDate))throw new Error('Informe a data de troca, depois da colocação');
  if(item.method!=='iud'&&item.remind&&!item.time)throw new Error('Informe o horário do lembrete');}
 if(collection==='contraceptiveDoses'&&(typeof item.methodId!=='string'||!/^[\w-]{1,100}$/.test(item.methodId)))throw new Error('Escolha o método');
 if(collection==='preventives'&&(!Number.isInteger(item.intervalMonths)||item.intervalMonths<1||item.intervalMonths>120))throw new Error('Informe o intervalo entre 1 e 120 meses');
```
7. Em `applyCommand` (upsert), troque `if(['journal','sleep'].includes(col)&&` por `if(['journal','sleep','symptoms'].includes(col)&&`, e logo depois da linha `if(col==='trtDoses'&&s.trtDoses.some(` acrescente:
```ts
  if(col==='periods'&&s.periods.some(x=>x.date===item.date&&x.id!==item.id))throw new Error('Já existe uma menstruação com este início. Edite o registro existente.');
  if(col==='contraceptiveDoses'&&s.contraceptiveDoses.some(x=>x.methodId===item.methodId&&x.date===item.date&&x.id!==item.id))throw new Error('Já existe um registro deste método nesta data. Edite o registro existente.');
```

`components/norte/catalog.ts`:

1. Depois de `import {categoryOptions} from '@/lib/gender';`, acrescente:
```ts
import {SYMPTOMS,FLOWS,METHODS} from '@/lib/female-health';
```
2. No tipo `Field`, troque `default?:any};` por `default?:any;showIf?:(values:any)=>boolean};`.
3. Troque `,{...notes,label:'Como você se sentiu?'}]\n};` (fim do `trtDoses` e fecho de `FIELDS`) por:
```ts
,{...notes,label:'Como você se sentiu?'}],
periods:[{...title,label:'Registro',default:'Menstruação'},{...date,label:'Início'},{key:'endDate',label:'Fim',type:'date',hint:'Deixe em branco se ainda não terminou.'},{key:'flow',label:'Fluxo',type:'select',options:FLOWS.map(([v,l])=>[v,l]),default:'moderado'},notes],
symptoms:[{...title,label:'Registro',default:'Sintomas do dia'},date,{key:'symptoms',label:'O que você sentiu?',type:'multi',options:SYMPTOMS.map(x=>[x,x])},{key:'mood',label:'Como você está?',type:'select',options:[['5','Muito bem'],['4','Bem'],['3','Na média'],['2','Um pouco difícil'],['1','Dia difícil']]},notes],
contraceptives:[{...title,label:'Nome',hint:'Ex.: Yasmin, Depo-Provera, Mirena, gel de estradiol'},{key:'method',label:'Tipo',type:'select',options:METHODS.map(([v,l])=>[v,l]),default:'daily',required:true},
 {key:'startDate',label:'Primeiro dia da cartela atual',type:'date',required:true,showIf:v=>v.method==='daily'},{key:'startDate',label:'Data da última aplicação',type:'date',required:true,showIf:v=>v.method==='injection'},{key:'startDate',label:'Data da colocação',type:'date',required:true,showIf:v=>v.method==='iud'},
 {key:'activeDays',label:'Dias de uso',type:'number',min:1,max:90,default:21,hint:'Ex.: 21 e 7 de pausa; 24 e 4; contínua: 28 e 0.',showIf:v=>v.method==='daily'},{key:'pauseDays',label:'Dias de pausa',type:'number',min:0,max:30,default:7,showIf:v=>v.method==='daily'},
 {key:'intervalDays',label:'Intervalo entre aplicações (dias)',type:'number',min:1,max:120,default:30,hint:'30 para mensal, 90 para trimestral.',showIf:v=>v.method==='injection'},
 {key:'changeDate',label:'Data prevista de troca',type:'date',required:true,showIf:v=>v.method==='iud'},
 {key:'time',label:'Horário do lembrete',type:'time',default:'21:00',hint:'Chega na hora cheia, com até 1 hora de atraso.',showIf:v=>v.method!=='iud'},{key:'remind',label:'Lembrar no Telegram',type:'checkbox',default:true,showIf:v=>v.method!=='iud'},
 {key:'status',label:'Situação',type:'select',options:[['active','Ativo'],['paused','Pausado']],default:'active'},{key:'doctor',label:'Médico responsável'},notes],
contraceptiveDoses:[{...title,label:'Registro'},date,{key:'methodId',label:'Método',type:'select',source:'contraceptives',required:true},notes],
preventives:[{...title,label:'Consulta ou exame',hint:'Ex.: Papanicolau, mamografia, ginecologista'},{key:'intervalMonths',label:'Repetir a cada (meses)',type:'number',min:1,max:120,default:12,required:true},{key:'lastDate',label:'Última vez',type:'date'},{key:'doctor',label:'Médico ou clínica'},notes]
};
```
4. Em `COLLECTION_LABELS`, troque `trtDoses:'Registrar aplicação'};` por:
```ts
trtDoses:'Registrar aplicação',periods:'Registrar menstruação',symptoms:'Registrar sintomas',contraceptives:'Novo método',contraceptiveDoses:'Registrar uso',preventives:'Novo preventivo'};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs` e depois `npm test` e `npm run typecheck`
Expected: PASS em todos, sem erro de tipo.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/core.ts lib/female-health.ts components/norte/catalog.ts package.json tests/female-health.test.mjs
git commit -m "Saúde feminina: coleções, validação e formulários

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Regras do ciclo

**Files:**
- Modify: `lib/female-health.ts`
- Test: `tests/female-health.test.mjs`

**Interfaces:**
- Consumes: `FLOWS` e as demais constantes da Tarefa 1.
- Produces: `shiftDate(d:string,n:number):string`, `dayDiff(from:string,to:string):number`, `type Phase='menstrual'|'folicular'|'ovulatória'|'lútea'`, `type ForecastKind='period'|'fertile'|'ovulation'`, `cycleStats(periods:Item[]):{starts:string[];cycleLength:number;periodLength:number;cycles:number}`, `cycleDayOn(periods:Item[],date:string):number|null`, `cyclePrediction(periods:Item[],today:string):{lastStart,cycleDay,next,daysToNext,late,ovulation,fertileStart,fertileEnd,cycleLength,periodLength,cycles}|null`, `cyclePhase(periods:Item[],date:string):Phase|null`, `forecastDays(periods:Item[],from:string,days:number):{date:string;kind:ForecastKind|null}[]`, `nextPeriodStart(periods:Item[]):string|null`.

- [ ] **Step 1: Escrever o teste que falha** — acrescente no topo de `tests/female-health.test.mjs`, junto dos imports:

```js
import { cycleStats, cyclePrediction, cyclePhase, cycleDayOn, forecastDays, nextPeriodStart } from '../lib/female-health.ts';
const add=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
const per=(date,endDate)=>({id:'p-'+date,title:'Menstruação',date,...(endDate?{endDate}:{})});
```

e no fim do arquivo:

```js
test('média do ciclo usa os últimos 6 intervalos válidos e ignora os absurdos',()=>{assert.deepEqual(cycleStats([]),{starts:[],cycleLength:28,periodLength:5,cycles:0});
 const st=cycleStats([per('2026-07-01','2026-07-05'),per('2026-07-31','2026-08-02'),per('2026-08-30'),per('2026-09-05'),per('2026-10-01')]);
 assert.deepEqual([st.cycleLength,st.periodLength,st.cycles],[29,4,3]);
 let d='2025-06-01';const list=[per(d)];for(const g of [40,40,40,28,28,28,28,28,28]){d=add(d,g);list.push(per(d));}assert.equal(cycleStats(list).cycleLength,28);});
test('previsão: próxima, janela fértil, atraso e inícios futuros ignorados',()=>{const list=[per('2026-08-20'),per('2026-09-17'),per('2026-10-15')];
 const c=cyclePrediction(list,'2026-10-18');
 assert.deepEqual({day:c.cycleDay,next:c.next,ov:c.ovulation,fs:c.fertileStart,fe:c.fertileEnd,late:c.late,to:c.daysToNext},{day:4,next:'2026-11-12',ov:'2026-10-29',fs:'2026-10-24',fe:'2026-10-30',late:0,to:25});
 const late=cyclePrediction(list,'2026-11-15');assert.deepEqual([late.next,late.late,late.daysToNext],['2026-11-12',3,0]);
 assert.equal(cyclePrediction([...list,per('2026-12-01')],'2026-10-18').next,'2026-11-12');
 assert.equal(cyclePrediction([],'2026-10-18'),null);assert.equal(nextPeriodStart(list),'2026-11-12');assert.equal(nextPeriodStart([]),null);});
test('fase do ciclo pelo dia',()=>{const list=[per('2026-09-17','2026-09-21'),per('2026-10-15','2026-10-19')];
 assert.equal(cyclePhase(list,'2026-10-16'),'menstrual');assert.equal(cyclePhase(list,'2026-10-22'),'folicular');assert.equal(cyclePhase(list,'2026-10-29'),'ovulatória');assert.equal(cyclePhase(list,'2026-11-03'),'lútea');assert.equal(cyclePhase(list,'2026-09-01'),null);
 assert.equal(cycleDayOn(list,'2026-10-29'),15);assert.equal(cycleDayOn(list,'2026-09-01'),null);});
test('calendário marca menstruação, janela fértil e ovulação',()=>{const list=[per('2026-09-17','2026-09-21'),per('2026-10-15','2026-10-19')];const days=forecastDays(list,'2026-10-18',35);
 assert.equal(days.length,35);assert.equal(days[0].date,'2026-10-18');const kind=d=>days.find(x=>x.date===d)?.kind;
 assert.deepEqual(['2026-10-18','2026-10-20','2026-10-24','2026-10-29','2026-10-30','2026-10-31','2026-11-12','2026-11-16','2026-11-17'].map(kind),['period',null,'fertile','ovulation','fertile',null,'period','period',null]);
 assert.deepEqual(forecastDays([],'2026-10-18',3).map(d=>d.kind),[null,null,null]);});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs`
Expected: FAIL (`cycleStats` não é exportado).

- [ ] **Step 3: Implementar** — acrescente no início de `lib/female-health.ts`, depois dos comentários:

```ts
import type { Item } from './types.ts';
```

e no fim do arquivo:

```ts
const valid=(v:unknown):v is string=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const t=new Date(v+'T12:00:00Z');return Number.isFinite(t.getTime())&&t.toISOString().slice(0,10)===v;};
export const shiftDate=(d:string,n:number)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
export const dayDiff=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
const average=(xs:number[],fallback:number)=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):fallback;
const until=(periods:Item[],date:string)=>periods.filter(p=>typeof p.date==='string'&&p.date<=date);
export type Phase='menstrual'|'folicular'|'ovulatória'|'lútea';
export type ForecastKind='period'|'fertile'|'ovulation';

// Média dos últimos 6 ciclos; intervalos fora de 15 a 60 dias (registro esquecido ou duplicado) não entram.
export function cycleStats(periods:Item[]){
 const dated=periods.filter(p=>valid(p.date)).sort((a,b)=>a.date.localeCompare(b.date));const starts=[...new Set(dated.map(p=>p.date as string))];
 const gaps=starts.slice(1).map((d,i)=>dayDiff(starts[i],d)).filter(n=>n>=15&&n<=60).slice(-6);
 const lengths=dated.filter(p=>valid(p.endDate)&&p.endDate>=p.date).map(p=>dayDiff(p.date,p.endDate)+1).slice(-6);
 return {starts,cycleLength:average(gaps,28),periodLength:average(lengths,5),cycles:gaps.length};
}
export function cycleDayOn(periods:Item[],date:string){const starts=cycleStats(until(periods,date)).starts;const last=starts[starts.length-1];return last?dayDiff(last,date)+1:null;}
// Inícios depois de `today` (digitados por engano) não mudam a previsão.
export function cyclePrediction(periods:Item[],today:string){
 const st=cycleStats(until(periods,today)),last=st.starts[st.starts.length-1];if(!last)return null;
 const next=shiftDate(last,st.cycleLength),ovulation=shiftDate(next,-14);
 return {lastStart:last,cycleDay:dayDiff(last,today)+1,next,daysToNext:Math.max(dayDiff(today,next),0),late:Math.max(dayDiff(next,today),0),ovulation,fertileStart:shiftDate(ovulation,-5),fertileEnd:shiftDate(ovulation,1),cycleLength:st.cycleLength,periodLength:st.periodLength,cycles:st.cycles};
}
export function cyclePhase(periods:Item[],date:string):Phase|null{
 const st=cycleStats(until(periods,date)),last=st.starts[st.starts.length-1];if(!last)return null;
 const day=dayDiff(last,date)+1,ovulationDay=st.cycleLength-13;
 if(day<=st.periodLength)return 'menstrual';if(Math.abs(day-ovulationDay)<=1)return 'ovulatória';return day<ovulationDay?'folicular':'lútea';
}
// Calendário: menstruação (em curso e previstas), janela fértil e ovulação de cada ciclo dentro do período.
export function forecastDays(periods:Item[],from:string,days:number){
 const st=cycleStats(until(periods,from)),last=st.starts[st.starts.length-1],marks=new Map<string,ForecastKind>();
 if(last){const end=shiftDate(from,days-1);for(let start=last;start<=end;start=shiftDate(start,st.cycleLength)){const ov=shiftDate(start,st.cycleLength-14);
  for(let i=-5;i<=1;i++)marks.set(shiftDate(ov,i),'fertile');marks.set(ov,'ovulation');for(let i=0;i<st.periodLength;i++)marks.set(shiftDate(start,i),'period');}}
 return Array.from({length:days},(_,i)=>{const date=shiftDate(from,i);return {date,kind:marks.get(date)||null};});
}
export function nextPeriodStart(periods:Item[]){const st=cycleStats(periods),last=st.starts[st.starts.length-1];return last?shiftDate(last,st.cycleLength):null;}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs` e `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/female-health.ts tests/female-health.test.mjs
git commit -m "Saúde feminina: médias, previsão, fases e calendário do ciclo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Regras dos métodos, lembrete e preventivos

**Files:**
- Modify: `lib/female-health.ts`
- Test: `tests/female-health.test.mjs`

**Interfaces:**
- Consumes: `valid`, `shiftDate` e `dayDiff` da Tarefa 2.
- Produces: `takeId(methodId,date)`, `dailyStatus(m,date):{active:boolean;packDay:number;pauseUntil?:string;nextPackStart?:string}`, `injectionNext(m,doses,before?):string`, `iudStatus(m,today):{daysLeft:number;soon:boolean}`, `reminderHour(time):number`, `femaleReminderDue(m,doses,today,hour):boolean`, `addMonths(date,months):string`, `preventiveNext(p):string|null`, `type PreventiveState`, `preventiveStatus(p,today):{state:PreventiveState;next?:string;days?:number}`, `PREVENTIVE_LABEL` e `PREVENTIVE_SUGGESTIONS`.

- [ ] **Step 1: Escrever o teste que falha** — acrescente no topo, junto dos imports e fixtures:

```js
import { dailyStatus, injectionNext, iudStatus, reminderHour, femaleReminderDue, addMonths, preventiveStatus, takeId } from '../lib/female-health.ts';
const pill={id:'m1',title:'Yasmin',method:'daily',startDate:'2026-10-01',activeDays:21,pauseDays:7,status:'active',remind:true,time:'21:00'};
const inj={id:'i1',title:'Depo',method:'injection',startDate:'2026-08-01',intervalDays:90,status:'active',remind:true,time:'09:00'};
```

e no fim:

```js
test('cartela com pausa e contínua',()=>{assert.deepEqual(dailyStatus(pill,'2026-10-01'),{active:true,packDay:1,nextPackStart:'2026-10-29'});assert.equal(dailyStatus(pill,'2026-10-21').active,true);
 assert.deepEqual(dailyStatus(pill,'2026-10-22'),{active:false,packDay:22,pauseUntil:'2026-10-28',nextPackStart:'2026-10-29'});assert.equal(dailyStatus(pill,'2026-10-29').packDay,1);
 assert.deepEqual(dailyStatus(pill,'2026-09-30'),{active:false,packDay:0,nextPackStart:'2026-10-01'});assert.equal(dailyStatus({...pill,status:'paused'},'2026-10-05').active,false);
 const cont={...pill,activeDays:28,pauseDays:0};assert.ok(['2026-10-28','2026-10-29','2026-11-30'].every(d=>dailyStatus(cont,d).active));});
test('injeção: próxima pela última aplicação ou pelo cadastro',()=>{assert.equal(injectionNext(inj,[]),'2026-10-30');const doses=[{id:'d',title:'Injeção',methodId:'i1',date:'2026-10-28'}];
 assert.equal(injectionNext(inj,doses),'2027-01-26');assert.equal(injectionNext(inj,doses,'2026-10-28'),'2026-10-30');assert.equal(injectionNext(inj,[{id:'x',title:'velha',methodId:'i1',date:'2026-05-01'}]),'2026-10-30');});
test('DIU avisa nos 30 dias antes da troca',()=>{const iud={id:'u',title:'Mirena',method:'iud',startDate:'2021-11-01',changeDate:'2026-11-10'};assert.deepEqual(iudStatus(iud,'2026-10-18'),{daysLeft:23,soon:true});assert.equal(iudStatus(iud,'2026-09-01').soon,false);});
test('hora do lembrete arredonda para a hora cheia seguinte',()=>{assert.deepEqual(['21:00','21:30','23:45','00:00'].map(reminderHour),[21,22,23,0]);});
test('lembrete do uso diário respeita hora, registro, pausa e adiamentos',()=>{const T='2026-10-10';
 assert.deepEqual([20,21,23].map(h=>femaleReminderDue(pill,[],T,h)),[false,true,true]);
 assert.equal(femaleReminderDue(pill,[{id:takeId('m1',T),title:'Tomei',methodId:'m1',date:T}],T,22),false);assert.equal(femaleReminderDue({...pill,remindedOn:T},[],T,22),false);
 assert.equal(femaleReminderDue({...pill,snoozedUntil:T,snoozeHour:23},[],T,22),false);assert.equal(femaleReminderDue({...pill,snoozedUntil:T,snoozeHour:23},[],T,23),true);
 assert.equal(femaleReminderDue({...pill,snoozedUntil:'2026-10-11'},[],T,22),false);assert.equal(femaleReminderDue(pill,[],'2026-10-24',22),false);
 assert.equal(femaleReminderDue({...pill,remind:false},[],T,22),false);assert.equal(femaleReminderDue({...pill,status:'paused'},[],T,22),false);});
test('lembrete da injeção vai do dia previsto até 3 dias depois',()=>{assert.deepEqual(['2026-10-29','2026-10-30','2026-11-02','2026-11-03'].map(d=>femaleReminderDue(inj,[],d,10)),[false,true,true,false]);
 assert.equal(femaleReminderDue(inj,[{id:'d',title:'Injeção',methodId:'i1',date:'2026-10-31'}],'2026-11-01',10),false);
 assert.equal(femaleReminderDue({...inj,snoozedUntil:'2026-10-31'},[],'2026-10-30',10),false);assert.equal(femaleReminderDue({...inj,snoozedUntil:'2026-10-31'},[],'2026-10-31',10),true);
 assert.equal(femaleReminderDue({...pill,method:'iud',changeDate:'2030-01-01'},[],'2026-10-10',22),false);});
test('preventivos: próxima data com fim de mês e situação',()=>{assert.equal(addMonths('2026-01-31',1),'2026-02-28');assert.equal(addMonths('2024-01-31',1),'2024-02-29');assert.equal(addMonths('2025-11-15',12),'2026-11-15');
 const p={id:'p',title:'Papanicolau',intervalMonths:12};assert.deepEqual(preventiveStatus(p,'2026-10-18'),{state:'none'});
 assert.deepEqual(preventiveStatus({...p,lastDate:'2025-10-01'},'2026-10-18'),{state:'late',next:'2026-10-01',days:-17});
 assert.equal(preventiveStatus({...p,lastDate:'2025-11-10'},'2026-10-18').state,'soon');assert.equal(preventiveStatus({...p,lastDate:'2026-03-01'},'2026-10-18').state,'ok');});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs`
Expected: FAIL (`dailyStatus` não é exportado).

- [ ] **Step 3: Implementar** — acrescente no fim de `lib/female-health.ts`:

```ts
export const takeId=(methodId:string,date:string)=>'take-'+methodId+'-'+date;
export const PREVENTIVE_SUGGESTIONS=[['Ginecologista',12],['Papanicolau',12],['Mamografia',12],['Ultrassom transvaginal',12],['Densitometria óssea',24]] as const;
export type PreventiveState='none'|'late'|'soon'|'ok';
export const PREVENTIVE_LABEL:Record<PreventiveState,string>={none:'Sem registro',late:'Atrasado',soon:'Vence em breve',ok:'Em dia'};
const taken=(m:Item,doses:Item[],date:string)=>doses.some(d=>d.methodId===m.id&&d.date===date);
// Cartela: `startDate` é o primeiro dia da cartela atual; uso + pausa se repetem a partir dele.
export function dailyStatus(m:Item,date:string):{active:boolean;packDay:number;pauseUntil?:string;nextPackStart?:string}{
 if(m.status==='paused'||!valid(m.startDate))return {active:false,packDay:0};
 if(date<m.startDate)return {active:false,packDay:0,nextPackStart:m.startDate};
 const use=m.activeDays||21,len=use+(m.pauseDays??7),pos=dayDiff(m.startDate,date)%len;
 return pos<use?{active:true,packDay:pos+1,nextPackStart:shiftDate(date,len-pos)}:{active:false,packDay:pos+1,pauseUntil:shiftDate(date,len-pos-1),nextPackStart:shiftDate(date,len-pos)};
}
// Próxima injeção: a mais recente entre o cadastro e as aplicações (antes de `before`, quando informado) + intervalo.
export function injectionNext(m:Item,doses:Item[],before?:string){const base=[m.startDate,...doses.filter(d=>d.methodId===m.id&&(!before||d.date<before)).map(d=>d.date)].filter(valid).sort().pop();return base?shiftDate(base,m.intervalDays||30):'';}
export function iudStatus(m:Item,today:string){const daysLeft=dayDiff(today,m.changeDate);return {daysLeft,soon:daysLeft<=30};}
// Hora cheia do lembrete; com minutos, a hora seguinte (o cron pode rodar no começo da hora). Máximo 23h.
export function reminderHour(time:string){const [h,min]=time.split(':').map(Number);return Math.min(h+(min>0?1:0),23);}
export function femaleReminderDue(m:Item,doses:Item[],today:string,hour:number){
 if(m.status!=='active'||!m.remind||typeof m.time!=='string'||!['daily','injection'].includes(m.method))return false;
 if(m.method==='daily'&&(!dailyStatus(m,today).active||taken(m,doses,today)))return false;
 if(m.method==='injection'){const next=injectionNext(m,doses,today);if(!next||today<next||today>shiftDate(next,3)||doses.some(d=>d.methodId===m.id&&d.date>=next&&d.date<=today))return false;}
 if(hour<reminderHour(m.time)||m.remindedOn===today)return false;
 if(m.snoozedUntil&&m.snoozedUntil>today)return false;
 return !(m.snoozedUntil===today&&typeof m.snoozeHour==='number'&&hour<m.snoozeHour);
}
export function addMonths(date:string,months:number){const [y,m,d]=date.split('-').map(Number);const t=new Date(Date.UTC(y,m-1+months,1,12));const last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();return t.toISOString().slice(0,8)+String(Math.min(d,last)).padStart(2,'0');}
export const preventiveNext=(p:Item)=>valid(p.lastDate)?addMonths(p.lastDate,p.intervalMonths||12):null;
export function preventiveStatus(p:Item,today:string):{state:PreventiveState;next?:string;days?:number}{const next=preventiveNext(p);if(!next)return {state:'none'};const days=dayDiff(today,next);return {state:days<0?'late':days<=30?'soon':'ok',next,days};}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs` e `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/female-health.ts tests/female-health.test.mjs
git commit -m "Saúde feminina: cartela, injeção, DIU, lembrete por hora e preventivos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Visibilidade por gênero e Agenda

**Files:**
- Modify: `lib/gender.ts`, `lib/female-health.ts`, `lib/core.ts`, `components/norte/planning.tsx`
- Test: `tests/female-health.test.mjs`, `tests/gender.test.mjs`

**Interfaces:**
- Consumes: `dailyStatus`, `injectionNext`, `nextPeriodStart`, `preventiveNext` e `takeId`.
- Produces: `hiddenSections(gender)`, que devolve `['testosterona']` para `female` e `['saude-feminina']` nos outros casos; `femaleAgenda(s,date):Item[]`, com itens de `_collection` em `'contraceptives'|'forecast'|'preventives'` e `readonly:true` nos informativos.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/gender.test.mjs`, troque `assert.deepEqual(hiddenSections('male'),[]);assert.deepEqual(hiddenSections(''),[]);` por:
```js
assert.deepEqual(hiddenSections('male'),['saude-feminina']);assert.deepEqual(hiddenSections(''),['saude-feminina']);
```

Em `tests/female-health.test.mjs`, troque o import do core por `import { emptyWorkspace, applyCommand, validateItem, upgradeWorkspace, validateWorkspace, scheduledItems, isComplete } from '../lib/core.ts';` e acrescente no fim:

```js
test('agenda mostra os cuidados só para quem vê o menu',()=>{let s=emptyWorkspace('Ana');s.profile.gender='female';
 s.contraceptives=[{...pill},{...inj},{id:'u',title:'Mirena',method:'iud',startDate:'2021-11-01',changeDate:'2026-10-30',status:'active'}];s.periods=[{id:'p1',title:'Menstruação',date:'2026-10-02'}];s.preventives=[{id:'pv',title:'Papanicolau',intervalMonths:12,lastDate:'2025-10-30'}];
 const titles=d=>scheduledItems(s,d).map(x=>x.title).sort();
 assert.deepEqual(titles('2026-10-10'),['Uso diário: Yasmin']);
 assert.deepEqual(titles('2026-10-30'),['Injeção: Depo','Menstruação prevista','Preventivo: Papanicolau','Troca: Mirena','Uso diário: Yasmin']);
 assert.deepEqual(titles('2026-10-24'),[]);
 const item=scheduledItems(s,'2026-10-10')[0];assert.equal(isComplete(s,item,'2026-10-10'),false);
 s=applyCommand(s,{type:'upsert',collection:'contraceptiveDoses',item:{id:takeId('m1','2026-10-10'),title:'Tomei: Yasmin',date:'2026-10-10',methodId:'m1'}},'2026-10-10');assert.equal(isComplete(s,item,'2026-10-10'),true);
 assert.ok(scheduledItems(s,'2026-10-30').filter(x=>!['Uso diário: Yasmin','Injeção: Depo'].includes(x.title)).every(x=>x.readonly));
 s.profile.gender='male';assert.deepEqual(titles('2026-10-30'),[]);});
test('aplicações de testosterona saem da agenda no feminino, sem apagar o protocolo',()=>{const s=emptyWorkspace('Ana');s.trtProtocols=[{id:'t1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-10-10',status:'active'}];
 s.profile.gender='male';assert.equal(scheduledItems(s,'2026-10-10').length,1);s.profile.gender='female';assert.equal(scheduledItems(s,'2026-10-10').length,0);assert.equal(s.trtProtocols.length,1);});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL em `gender.test.mjs` (hiddenSections) e em `female-health.test.mjs` (agenda vazia).

- [ ] **Step 3: Implementar**

`lib/gender.ts`: troque `export const hiddenSections=(gender:Gender)=>gender==='female'?['testosterona']:[];` por:
```ts
export const hiddenSections=(gender:Gender)=>gender==='female'?['testosterona']:['saude-feminina'];
```

`lib/female-health.ts`, no fim:
```ts
// Itens calculados da agenda (não são salvos em tasks). Os `readonly` só informam: sem marcar, editar ou excluir.
export function femaleAgenda(s:{periods:Item[];contraceptives:Item[];contraceptiveDoses:Item[];preventives:Item[]},date:string):Item[]{
 const out:Item[]=[];
 for(const m of s.contraceptives){if(m.status!=='active')continue;const time=m.time?{time:m.time}:{};
  if(m.method==='daily'&&dailyStatus(m,date).active)out.push({id:m.id,title:'Uso diário: '+m.title,type:'habit',section:'saude',_collection:'contraceptives',...time});
  if(m.method==='injection'&&injectionNext(m,s.contraceptiveDoses,date)===date)out.push({id:m.id,title:'Injeção: '+m.title,type:'event',section:'saude',_collection:'contraceptives',...time});
  if(m.method==='iud'&&m.changeDate===date)out.push({id:m.id,title:'Troca: '+m.title,type:'event',section:'saude',_collection:'contraceptives',readonly:true});}
 if(nextPeriodStart(s.periods)===date)out.push({id:'period-forecast',title:'Menstruação prevista',type:'event',section:'saude',_collection:'forecast',readonly:true});
 for(const p of s.preventives)if(preventiveNext(p)===date)out.push({id:p.id,title:'Preventivo: '+p.title,type:'event',section:'saude',_collection:'preventives',readonly:true});
 return out;
}
```

`lib/core.ts`:
1. Troque `import { HAIR_STYLES } from './gender.ts';` por `import { HAIR_STYLES, hiddenSections } from './gender.ts';` e `import { SYMPTOMS, FLOWS, METHODS } from './female-health.ts';` por `import { SYMPTOMS, FLOWS, METHODS, femaleAgenda } from './female-health.ts';`.
2. Troque
```ts
 // Aplicações de testosterona entram como compromissos calculados: não são salvas em tasks.
 const applications=s.trtProtocols.filter(
```
por
```ts
 // Aplicações de testosterona e cuidados do menu Saúde feminina entram como itens calculados: não são salvos em tasks.
 // Menu oculto pelo gênero também some da agenda (os registros continuam salvos).
 const hidden=hiddenSections(s.profile.gender);
 const applications=hidden.includes('testosterona')?[]:s.trtProtocols.filter(
```
3. Troque `.filter(x=>occursOn(x,date)),...applications];}` por `.filter(x=>occursOn(x,date)),...applications,...(hidden.includes('saude-feminina')?[]:femaleAgenda(s,date))];}`.
4. Em `isComplete`, troque `||(source==='trtProtocols'&&s.trtDoses.some(d=>d.protocolId===item.id&&d.date===date));}` por:
```ts
||(source==='trtProtocols'&&s.trtDoses.some(d=>d.protocolId===item.id&&d.date===date))||(source==='contraceptives'&&s.contraceptiveDoses.some(d=>d.methodId===item.id&&d.date===date));}
```

`components/norte/planning.tsx`:
1. Depois de `import {doseId} from '@/lib/testosterone';`, acrescente `import {takeId} from '@/lib/female-health';`.
2. Troque o comentário e a linha de `openItem` por:
```ts
// Itens calculados da agenda: "Aplicação" leva ao menu Testosterona e os cuidados ao menu Saúde feminina; marcar registra o dia.
const FEMALE_SOURCES=['contraceptives','forecast','preventives'];
const openItem=(a:AppContext,t:Item)=>t._collection==='trtProtocols'?a.navigate('/testosterona'):FEMALE_SOURCES.includes(t._collection)?a.navigate('/saude-feminina'):a.edit(t._collection||'tasks',t);
```
3. Em `toggleItem`, antes de `return a.mutate({type:source==='tasks'?'toggleTask'`, acrescente:
```ts
 if(source==='contraceptives'){const m=a.state.contraceptives.find(x=>x.id===t.id);const dose=a.state.contraceptiveDoses.find(d=>d.methodId===t.id&&d.date===date);return done&&dose?a.mutate({type:'delete',collection:'contraceptiveDoses',id:dose.id}):a.mutate({type:'upsert',collection:'contraceptiveDoses',item:{id:takeId(t.id,date),title:(m?.method==='injection'?'Injeção: ':'Tomei: ')+(m?.title||''),date,methodId:t.id}});}
```
4. Em `TaskList`, troque `<button className="task-check" aria-label={(done?'Desmarcar ':'Concluir ')+t.title} aria-pressed={done} disabled={a.busy||date>a.today} onClick={()=>toggleItem(a,t,date,done)}>{done&&<Check size={14}/>}</button>` por:
```tsx
{t.readonly?<span className="task-check readonly" aria-hidden="true"/>:<button className="task-check" aria-label={(done?'Desmarcar ':'Concluir ')+t.title} aria-pressed={done} disabled={a.busy||date>a.today} onClick={()=>toggleItem(a,t,date,done)}>{done&&<Check size={14}/>}</button>}
```
   e troque `{source!=='trtProtocols'&&<RecordActions` por `{source!=='trtProtocols'&&!FEMALE_SOURCES.includes(source)&&<RecordActions`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` e `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gender.ts lib/female-health.ts lib/core.ts components/norte/planning.tsx tests/female-health.test.mjs tests/gender.test.mjs
git commit -m "Saúde feminina na Agenda e menus por gênero

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Lembrete no Telegram

**Files:**
- Create: `lib/female-reminders.ts`, `app/api/cron/female-reminders/route.ts`
- Modify: `lib/trt-reminders.ts`, `app/api/telegram/route.ts`, `vercel.json`, `package.json`
- Test: `tests/female-reminders.test.mjs`

**Interfaces:**
- Consumes: `femaleReminderDue`, `dailyStatus`, `injectionNext`, `takeId` e `hiddenSections`.
- Produces: `FEMALE_REMINDER_TEXT`, `femaleButtons(m)`, `parseFemaleCallback(data):{action:'done'|'hour'|'snooze';methodId:string}|null`, `hourInZone(zone,now?)`, `sendFemaleReminders(deps)` e `femaleCallbackAction(s,today,hour,cb):{command?:Command;reply:string}`.

- [ ] **Step 1: Escrever o teste que falha** — criar `tests/female-reminders.test.mjs` e acrescentar ` tests/female-reminders.test.mjs` ao script `test` do `package.json`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, applyCommand } from '../lib/core.ts';
import { femaleReminderDue } from '../lib/female-health.ts';
import { sendFemaleReminders, femaleCallbackAction, parseFemaleCallback, femaleButtons, hourInZone, FEMALE_REMINDER_TEXT } from '../lib/female-reminders.ts';
import { sendDueReminders } from '../lib/trt-reminders.ts';

const pill={id:'m1',title:'Yasmin',method:'daily',startDate:'2026-10-01',activeDays:21,pauseDays:7,status:'active',remind:true,time:'21:00'};
const NIGHT=new Date('2026-10-11T00:30:00Z'); // 21h30 de 10/10 em São Paulo
function space(extra={}){const s=emptyWorkspace('Ana');s.profile.gender='female';s.contraceptives=[{...pill,...extra}];return s;}
function harness(state){const sent=[];let s=state;return {sent,get state(){return s;},deps:{links:async()=>[{chatId:'c1',userId:'u1'}],load:async()=>({state:s}),mutate:async(_u,c)=>{s=applyCommand(s,c,'2026-10-10');},send:async(chatId,text,markup)=>{sent.push({chatId,text,markup});}}};}

test('hora local pelo fuso do perfil',()=>{assert.equal(hourInZone('America/Sao_Paulo',NIGHT),21);assert.equal(hourInZone('UTC',NIGHT),0);});
test('envia na hora local, uma vez, com os botões do uso diário',async()=>{const h=harness(space());
 assert.deepEqual(await sendFemaleReminders({...h.deps,now:NIGHT}),{checked:1,sent:1,failed:0});
 assert.equal(h.sent[0].text,FEMALE_REMINDER_TEXT);assert.deepEqual(h.sent[0].markup,femaleButtons(pill));assert.equal(h.state.contraceptives[0].remindedOn,'2026-10-10');
 assert.equal((await sendFemaleReminders({...h.deps,now:NIGHT})).sent,0);
 const early=harness(space());assert.equal((await sendFemaleReminders({...early.deps,now:new Date('2026-10-10T23:30:00Z')})).sent,0);});
test('não envia para quem não vê o menu e falha de um chat não para os outros',async()=>{const male=space();male.profile.gender='male';const h=harness(male);assert.equal((await sendFemaleReminders({...h.deps,now:NIGHT})).sent,0);
 const broken=harness(space());broken.deps.load=async()=>{throw new Error('db');};assert.deepEqual(await sendFemaleReminders({...broken.deps,now:NIGHT}),{checked:1,sent:0,failed:1});});
test('testosterona não lembra quem tem o menu oculto',async()=>{const s=emptyWorkspace('Ana');s.trtProtocols=[{id:'t1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-10-10',status:'active',remind:true}];
 const run=()=>sendDueReminders({links:async()=>[{chatId:'c',userId:'u'}],load:async()=>({state:s}),mutate:async()=>{},send:async()=>{},now:new Date('2026-10-10T15:00:00Z')});
 s.profile.gender='female';assert.equal((await run()).sent,0);s.profile.gender='male';assert.equal((await run()).sent,1);});
test('Tomei registra uma vez e informa a próxima',()=>{let s=space();const r=femaleCallbackAction(s,'2026-10-10',21,{action:'done',methodId:'m1'});assert.equal(r.command.item.id,'take-m1-2026-10-10');assert.equal(r.reply,'Registrado. Próxima: amanhã.');
 s=applyCommand(s,r.command,'2026-10-10');const again=femaleCallbackAction(s,'2026-10-10',21,{action:'done',methodId:'m1'});assert.equal(again.command,undefined);assert.match(again.reply,/já estava feito/);
 assert.equal(femaleCallbackAction(space(),'2026-10-21',21,{action:'done',methodId:'m1'}).reply,'Registrado. Pausa até 28/10.');
 assert.equal(femaleCallbackAction(space(),'2026-10-10',21,{action:'done',methodId:'x'}).reply,'Este cuidado não existe mais no seu GeoAI.');});
test('Lembrar em 1h volta na hora seguinte; às 23h fica para amanhã; Adiar 1 dia',()=>{let s=space({remindedOn:'2026-10-10'});
 const r=femaleCallbackAction(s,'2026-10-10',21,{action:'hour',methodId:'m1'});assert.deepEqual(r.command.item,{remindedOn:'',snoozedUntil:'2026-10-10',snoozeHour:22});
 s=applyCommand(s,r.command,'2026-10-10');const m=s.contraceptives[0];assert.equal(m.remindedOn,undefined);assert.deepEqual([21,22].map(h=>femaleReminderDue(m,[],'2026-10-10',h)),[false,true]);
 assert.deepEqual(femaleCallbackAction(space(),'2026-10-10',23,{action:'hour',methodId:'m1'}).command.item,{remindedOn:'',snoozedUntil:'2026-10-11',snoozeHour:''});
 const shot=space({method:'injection',intervalDays:90,startDate:'2026-07-12'});const a=femaleCallbackAction(shot,'2026-10-10',9,{action:'snooze',methodId:'m1'});
 assert.deepEqual(a.command.item,{snoozedUntil:'2026-10-11',snoozeHour:''});assert.equal(a.reply,'Combinado, lembro amanhã.');
 assert.match(femaleCallbackAction(shot,'2026-10-10',9,{action:'done',methodId:'m1'}).reply,/Próxima injeção: 08\/01\/2027/);});
test('callback_data do Telegram',()=>{assert.deepEqual(['fh:d:m1','fh:h:m1','fh:s:m1'].map(parseFemaleCallback).map(x=>x.action),['done','hour','snooze']);assert.equal(parseFemaleCallback('trt:d:m1'),null);assert.equal(parseFemaleCallback('fh:x:m1'),null);
 assert.deepEqual(femaleButtons({id:'i',method:'injection'}).inline_keyboard[0].map(b=>b.callback_data),['fh:d:i','fh:s:i']);
 assert.ok(femaleButtons({id:crypto.randomUUID(),method:'daily'}).inline_keyboard[0].every(b=>Buffer.byteLength(b.callback_data)<=64));});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --experimental-strip-types --test tests/female-reminders.test.mjs`
Expected: FAIL (módulo `female-reminders.ts` não existe).

- [ ] **Step 3: Implementar**

Criar `lib/female-reminders.ts`:
```ts
import {todayInZone,addDays} from './core.ts';import {femaleReminderDue,dailyStatus,injectionNext,takeId} from './female-health.ts';import {hiddenSections} from './gender.ts';import type {Workspace,Command,Item} from './types.ts';
// Lembrete do anticoncepcional pelo Telegram, na hora escolhida. A Vercel chama a rota de hora em hora (24 crons diários);
// cada pessoa recebe no próprio fuso. Texto discreto: a notificação aparece na tela de bloqueio.
export const FEMALE_REMINDER_TEXT='Lembrete do GeoAI: hora do seu cuidado.';
export const femaleButtons=(m:{id:string;method:string})=>({inline_keyboard:[[{text:'✅ Tomei',callback_data:'fh:d:'+m.id},m.method==='daily'?{text:'Lembrar em 1h',callback_data:'fh:h:'+m.id}:{text:'Adiar 1 dia',callback_data:'fh:s:'+m.id}]]});
const ACTIONS={d:'done',h:'hour',s:'snooze'} as const;
export function parseFemaleCallback(data:string){const m=/^fh:([dhs]):([\w-]{1,56})$/.exec(data);return m?{action:ACTIONS[m[1] as keyof typeof ACTIONS],methodId:m[2]}:null;}
export function hourInZone(zone:string,now=new Date()){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(now));}
export type FemaleReminderDeps={links:()=>Promise<{chatId:string;userId:string}[]>;load:(userId:string)=>Promise<{state:Workspace}>;mutate:(userId:string,command:Command)=>Promise<unknown>;send:(chatId:string,text:string,markup:ReturnType<typeof femaleButtons>)=>Promise<unknown>;now?:Date};
export async function sendFemaleReminders(d:FemaleReminderDeps){let checked=0,sent=0,failed=0;
 for(const link of await d.links()){checked++;
  try{const {state}=await d.load(link.userId);if(hiddenSections(state.profile.gender).includes('saude-feminina'))continue;
   const zone=state.profile.timezone,today=todayInZone(zone,d.now),hour=hourInZone(zone,d.now);
   for(const m of state.contraceptives.filter(x=>femaleReminderDue(x,state.contraceptiveDoses,today,hour))){await d.send(link.chatId,FEMALE_REMINDER_TEXT,femaleButtons(m));sent++;await d.mutate(link.userId,{type:'patch',collection:'contraceptives',id:m.id,item:{remindedOn:today}});}}
  catch(e){failed++;console.error('female reminder',e instanceof Error?e.message:'erro');}}
 return {checked,sent,failed};}
const fmtDate=(d:string)=>d.split('-').reverse().join('/');
function nextText(m:Item,doses:Item[],today:string){if(m.method==='injection')return 'Próxima injeção: '+fmtDate(injectionNext(m,doses))+'.';const tomorrow=dailyStatus(m,addDays(today,1));return tomorrow.active?'Próxima: amanhã.':tomorrow.pauseUntil?'Pausa até '+fmtDate(tomorrow.pauseUntil).slice(0,5)+'.':'';}
// Campos vazios no patch são removidos pela validação: é assim que o adiamento e o "já lembrado" são limpos.
export function femaleCallbackAction(s:Workspace,today:string,hour:number,cb:{action:'done'|'hour'|'snooze';methodId:string}):{command?:Command;reply:string}{
 const m=s.contraceptives.find(x=>x.id===cb.methodId);if(!m)return {reply:'Este cuidado não existe mais no seu GeoAI.'};
 const patch=(item:Record<string,unknown>):Command=>({type:'patch',collection:'contraceptives',id:m.id,item});
 if(cb.action==='hour')return hour>=23?{command:patch({remindedOn:'',snoozedUntil:addDays(today,1),snoozeHour:''}),reply:'Combinado, lembro amanhã.'}:{command:patch({remindedOn:'',snoozedUntil:today,snoozeHour:hour+1}),reply:'Combinado, lembro daqui a 1 hora.'};
 if(cb.action==='snooze')return {command:patch({snoozedUntil:addDays(today,1),snoozeHour:''}),reply:'Combinado, lembro amanhã.'};
 if(s.contraceptiveDoses.some(x=>x.methodId===m.id&&x.date===today))return {reply:'O registro de hoje já estava feito. '+nextText(m,s.contraceptiveDoses,today)};
 const dose={id:takeId(m.id,today),title:(m.method==='injection'?'Injeção: ':'Tomei: ')+m.title,date:today,methodId:m.id};
 return {command:{type:'upsert',collection:'contraceptiveDoses',item:dose},reply:'Registrado. '+nextText(m,[...s.contraceptiveDoses,dose],today)};
}
```

Criar `app/api/cron/female-reminders/route.ts`:
```ts
import {sendFemaleReminders} from '@/lib/female-reminders';import {listLinks} from '@/lib/telegram-store';import {loadWorkspace,mutateWorkspace} from '@/lib/workspace-server';import {telegramApi} from '@/lib/telegram';
export const dynamic='force-dynamic';export const maxDuration=60;
// Chamada de hora em hora por 24 tarefas agendadas diárias da Vercel (a Hobby só permite cron diário), com Authorization: Bearer <CRON_SECRET>.
export async function GET(request:Request){const secret=process.env.CRON_SECRET,token=process.env.TELEGRAM_BOT_TOKEN;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 if(!token)return Response.json({checked:0,sent:0,failed:0});
 const api=telegramApi(token,process.env.TELEGRAM_API_BASE||undefined);
 return Response.json(await sendFemaleReminders({links:listLinks,load:userId=>loadWorkspace(userId,''),mutate:(userId,command)=>mutateWorkspace(userId,'',command),send:(chatId,text,markup)=>api('sendMessage',{chat_id:chatId,text,reply_markup:markup})}));}
```

Substituir `vercel.json` por:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run db:migrate && npm run build",
  "crons": [
    { "path": "/api/cron/trt-reminders", "schedule": "0 11 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 0 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 1 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 2 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 3 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 4 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 5 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 6 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 7 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 8 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 9 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 10 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 11 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 12 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 13 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 14 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 15 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 16 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 17 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 18 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 19 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 20 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 21 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 22 * * *" },
    { "path": "/api/cron/female-reminders", "schedule": "0 23 * * *" }
  ]
}
```

`lib/trt-reminders.ts`:
1. Troque `import type {Workspace,Command} from './types.ts';` por `import {hiddenSections} from './gender.ts';import type {Workspace,Command} from './types.ts';`.
2. Troque `try{const {state}=await d.load(link.userId);const today=` por `try{const {state}=await d.load(link.userId);if(hiddenSections(state.profile.gender).includes('testosterona'))continue;const today=`.

`app/api/telegram/route.ts`:
1. Depois de `import {parseTrtCallback,trtCallbackAction} from '@/lib/trt-reminders';`, acrescente `import {parseFemaleCallback,femaleCallbackAction,hourInZone} from '@/lib/female-reminders';`.
2. Antes de ` const [action,id]=e.data.split(':'),group=id?link.pending[id]:undefined;`, acrescente:
```ts
 const fh=parseFemaleCallback(e.data);
 if(fh){const {state}=await loadWorkspace(link.userId,'');const zone=state.profile.timezone;const r=femaleCallbackAction(state,todayInZone(zone),hourInZone(zone),fh);
  if(r.command){try{await mutateWorkspace(link.userId,'',r.command);}catch(err){console.error('telegram female',err);return answer('Não foi possível salvar agora. Tente de novo.');}}
  await clearButtons();await answer(r.command?(fh.action==='done'?'Registrado!':'Adiado.'):'Ok');return sendText(api,e.chatId,r.reply);}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` e `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/female-reminders.ts app/api/cron/female-reminders/route.ts lib/trt-reminders.ts app/api/telegram/route.ts vercel.json package.json tests/female-reminders.test.mjs
git commit -m "Lembrete do anticoncepcional no Telegram na hora escolhida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 6: Exames no feminino

**Files:**
- Modify: `lib/exam-schema.ts`, `lib/female-health.ts`, `lib/testosterone.ts`, `lib/exam-ai.ts`, `lib/exam-service.ts`, `components/norte/exams.tsx`
- Test: `tests/female-health.test.mjs`, `tests/testosterone.test.mjs`

**Interfaces:**
- Consumes: `cyclePhase`, `cycleDayOn` e `METHOD_SHORT`.
- Produces: `femaleCriticalFlags(exam:{markers:Marker[]}):string[]`; `examFlags(exam,history,gender?)`; `finalOverall(exam,all,gender?)`; o tipo `ExamContext={gender:Gender;phase:Phase|null}` em `exam-service.ts`; `ExamDeps.extract(file,context)` e `ExamDeps.review({text,gender})`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/testosterone.test.mjs`, troque as três ocorrências de `/menu Testosterona/` por `/aba Exames/`.

Em `tests/female-health.test.mjs`, acrescente no topo:
```js
import { femaleCriticalFlags } from '../lib/female-health.ts';
import { reviewContext, finalOverall } from '../lib/testosterone.ts';
import { MARKER_KEYS } from '../lib/exam-schema.ts';
import { createExamFromFile, reviewExam } from '../lib/exam-service.ts';
const mk=(key,value,extra={})=>({key,label:key,value,...extra});
```
e no fim:
```js
test('alertas críticos femininos',()=>{assert.equal(femaleCriticalFlags({markers:[mk('hemoglobina',7.9,{unit:'g/dL'})]}).length,1);assert.deepEqual(femaleCriticalFlags({markers:[mk('hemoglobina',8,{unit:'g/dL'})]}),[]);
 assert.equal(femaleCriticalFlags({markers:[mk('tsh',0.05,{unit:'µUI/mL'})]}).length,1);assert.equal(femaleCriticalFlags({markers:[mk('tsh',10.5,{unit:'mUI/L'})]}).length,1);assert.deepEqual(femaleCriticalFlags({markers:[mk('tsh',2.1,{unit:'mUI/L'})]}),[]);
 assert.match(femaleCriticalFlags({markers:[mk('beta_hcg',120,{unit:'mUI/mL'})]})[0],/Beta-hCG positivo/);assert.deepEqual(femaleCriticalFlags({markers:[mk('beta_hcg',2,{unit:'mUI/mL',qualifier:'<'})]}),[]);
 assert.ok(['progesterona','ferritina','ferro','amh','beta_hcg','vitamina_b12','insulina'].every(k=>MARKER_KEYS.includes(k)));assert.equal(MARKER_KEYS[MARKER_KEYS.length-1],'outro');});
test('situação do exame usa os alertas do gênero',()=>{const exam={id:'e',title:'Exame',date:'2026-10-02',status:'reviewed',markers:[mk('hematocrito',55,{unit:'%'}),mk('hemoglobina',7.5,{unit:'g/dL'})]};
 assert.equal(finalOverall(exam,[exam]),'doctor');assert.equal(finalOverall({...exam,markers:[mk('hematocrito',55,{unit:'%'})]},[],'female'),'ok');assert.equal(finalOverall(exam,[exam],'female'),'doctor');});
test('contexto do parecer no feminino traz fase do ciclo e método',()=>{const s=emptyWorkspace('Ana');s.profile.gender='female';s.periods=[per('2026-09-17','2026-09-21'),per('2026-10-15','2026-10-19')];s.contraceptives=[{...pill}];
 const ctx=reviewContext({id:'n',date:'2026-10-29',markers:[mk('estradiol',180,{unit:'pg/mL',refMin:30,refMax:400})]},s);
 assert.match(ctx.text,/fase ovulatória do ciclo \(dia 15\)/);assert.match(ctx.text,/Método ativo: Yasmin \(uso diário\)/);assert.doesNotMatch(ctx.text,/reposição/);
 s.periods=[];s.contraceptives=[];const none=reviewContext({id:'n',date:'2026-10-29',markers:[mk('hemoglobina',7,{unit:'g/dL'})]},s);assert.match(none.text,/Sem registro do ciclo/);assert.match(none.text,/Sem método/);assert.equal(none.codeOverall,'doctor');});
test('leitura e parecer recebem o gênero e a fase do ciclo',async()=>{let s=emptyWorkspace('Ana');s.profile.gender='female';s.profile.timezone='UTC';s.periods=[per('2026-10-15','2026-10-19')];const seen={};
 const deps={userId:'u1',load:async()=>({state:s}),mutate:async c=>{s=applyCommand(s,c,'2026-10-18');return {state:s,version:1};},files:{save:async()=>{},remove:async()=>{},read:async()=>null},quota:async()=>true,
  extract:async(_f,ctx)=>{seen.extract=ctx;return {date:'2026-10-18',markers:[{key:'estradiol',label:'Estradiol',value:120,unit:'pg/mL',refMin:30,refMax:400}]};},
  review:async input=>{seen.review=input.gender;return {overall:'ok',summary:'Tudo dentro das faixas.',points:[],tips:[],model:'teste'};},now:()=>new Date('2026-10-18T12:00:00Z')};
 const r=await createExamFromFile(deps,{bytes:new TextEncoder().encode('%PDF-1.4 teste'),name:'laudo.pdf'});assert.deepEqual(seen.extract,{gender:'female',phase:'menstrual'});
 await reviewExam(deps,r.exam.id,{date:'2026-10-18',markers:r.exam.markers});assert.equal(seen.review,'female');});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`femaleCriticalFlags` não existe, a mensagem do guard ainda fala em menu Testosterona e o `extract` recebe `undefined` como contexto).

- [ ] **Step 3: Implementar**

`lib/exam-schema.ts`: troque `'creatinina','outro'] as const;` por `'creatinina','progesterona','ferritina','ferro','amh','beta_hcg','vitamina_b12','insulina','outro'] as const;`.

`lib/female-health.ts`: troque `import type { Item } from './types.ts';` por
```ts
import type { Item } from './types.ts';
import type { Marker } from './exam-schema.ts';
```
e acrescente no fim:
```ts
const unitIs=(m:Marker,units:string[])=>units.includes((m.unit||'').replace(/\s/g,'').toLowerCase());
const fmtNum=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
// Alertas que pedem médico logo, no feminino. Substituem os do menu Testosterona (hematócrito e PSA).
export function femaleCriticalFlags(exam:{markers:Marker[]}):string[]{const flags:string[]=[],get=(k:string)=>exam.markers.find(m=>m.key===k);
 const hb=get('hemoglobina');if(hb&&unitIs(hb,['g/dl'])&&hb.value<8)flags.push('Hemoglobina em '+fmtNum(hb.value)+' g/dL: abaixo de 8 pede avaliação médica logo.');
 const tsh=get('tsh');if(tsh&&unitIs(tsh,['mui/l','miu/l','µui/ml','μui/ml','uui/ml','uiu/ml'])&&(tsh.value<0.1||tsh.value>10))flags.push('TSH em '+fmtNum(tsh.value)+': fora de 0,1 a 10 pede avaliação médica logo.');
 const hcg=get('beta_hcg');if(hcg&&unitIs(hcg,['mui/ml','miu/ml','ui/l','iu/l'])&&hcg.value>5)flags.push('Beta-hCG positivo: confirme com seu médico.');
 return flags;}
```

`lib/testosterone.ts`:
1. Troque `import type {Item,Command,Workspace} from './types.ts';` por:
```ts
import type {Item,Command,Workspace,Gender} from './types.ts';
import {femaleCriticalFlags,cyclePhase,cycleDayOn,METHOD_SHORT} from './female-health.ts';
```
2. Em `MARKER_LABEL`, troque `creatinina:'Creatinina',outro:'Outro'}` por `creatinina:'Creatinina',progesterona:'Progesterona',ferritina:'Ferritina',ferro:'Ferro sérico',amh:'Hormônio antimülleriano (AMH)',beta_hcg:'Beta-hCG',vitamina_b12:'Vitamina B12',insulina:'Insulina',outro:'Outro'}`.
3. Logo antes de `export const codeOverall=`, acrescente:
```ts
export const examFlags=(exam:{date:string;markers:Marker[]},history:Item[],gender?:Gender)=>gender==='female'?femaleCriticalFlags(exam):criticalFlags(exam,history);
```
4. Troque `export function finalOverall(exam:Item,all:Item[]):Overall{` por `export function finalOverall(exam:Item,all:Item[],gender?:Gender):Overall{`, e na mesma linha troque `criticalFlags(e,examHistory(e,all))` por `examFlags(e,examHistory(e,all),gender)`.
5. Troque as linhas
```ts
export function reviewContext(exam:ExamLike,s:Pick<Workspace,'labExams'|'trtProtocols'|'trtDoses'>){
 const history=examHistory(exam,s.labExams),flags=criticalFlags(exam,history);
```
por
```ts
export function reviewContext(exam:ExamLike,s:Pick<Workspace,'labExams'|'trtProtocols'|'trtDoses'>&Partial<Pick<Workspace,'profile'|'periods'|'contraceptives'>>){
 const female=s.profile?.gender==='female',history=examHistory(exam,s.labExams),flags=examFlags(exam,history,s.profile?.gender);
```
   e troque
```ts
 const active=s.trtProtocols.filter(p=>p.status==='active');
 if(!active.length)lines.push('Sem protocolo de reposição registrado.');
 for(const p of active){
```
por
```ts
 if(female){const phase=cyclePhase(s.periods||[],exam.date);lines.push(phase?'Coleta na fase '+phase+' do ciclo (dia '+cycleDayOn(s.periods||[],exam.date)+').':'Sem registro do ciclo menstrual na data da coleta.');
  const methods=(s.contraceptives||[]).filter(m=>m.status==='active');lines.push(methods.length?methods.map(m=>'Método ativo: '+m.title+' ('+METHOD_SHORT[m.method]+').').join('\n'):'Sem método anticoncepcional ou hormonal registrado.');}
 const active=female?[]:s.trtProtocols.filter(p=>p.status==='active');
 if(!female&&!active.length)lines.push('Sem protocolo de reposição registrado.');
 for(const p of active){
```
6. Em `guardStateCommand`, troque `'Use o menu Testosterona para alterar exames.'` por `'Use a aba Exames para alterar exames.'`.

`lib/exam-service.ts`:
1. Troque `import type {Command,Item,Workspace} from './types.ts';` por:
```ts
import type {Command,Item,Workspace,Gender} from './types.ts';
import {cyclePhase,type Phase} from './female-health.ts';
```
2. Depois de `export type ModelReview=...;`, acrescente:
```ts
// Contexto da leitura do laudo: no feminino, a faixa de hormônios depende da fase do ciclo no dia do envio.
export type ExamContext={gender:Gender;phase:Phase|null};
```
3. Em `ExamDeps`, troque `extract:((file:{data:Uint8Array;type:string;name:string})=>Promise<ExtractedExam>)|null;review:((input:{text:string})=>Promise<ModelReview>)|null;` por `extract:((file:{data:Uint8Array;type:string;name:string},context:ExamContext)=>Promise<ExtractedExam>)|null;review:((input:{text:string;gender?:Gender})=>Promise<ModelReview>)|null;`.
4. Em `createExamFromFile`, troque `await d.extract({data:input.bytes,type,name:input.name})` por `await d.extract({data:input.bytes,type,name:input.name},{gender:state.profile.gender,phase:cyclePhase(state.periods||[],today)})`.
5. Em `reviewExam`, troque `await d.review({text:ctx.text})` por `await d.review({text:ctx.text,gender:state.profile.gender})`.

`lib/exam-ai.ts`:
1. No import de `./exam-service`, troque `import type {ExtractedExam,ModelReview} from './exam-service';` por `import type {ExtractedExam,ModelReview,ExamContext} from './exam-service';import type {Gender} from './types';`.
2. Depois da constante `REVIEW`, acrescente:
```ts
const REVIEW_FEMALE=`Você é o GeoAI e ajuda mulheres a entender exames hormonais e de rotina. Escreva em português do Brasil, em linguagem simples, sem markdown.
Você recebe os marcadores já conferidos pela usuária e classificados pelo app com a faixa do próprio laudo. Não reclassifique valores: use a classificação recebida.
- overall: "doctor" quando houver alerta crítico ou algo que mereça consulta breve; "attention" quando houver valores fora da faixa; "ok" quando tudo estiver dentro. Nunca escolha uma situação mais leve que a indicada pelos alertas.
- summary: 2 a 4 frases com a visão geral, considerando a fase do ciclo na coleta e o método anticoncepcional ou hormonal quando houver (estradiol, progesterona, LH e FSH variam ao longo do ciclo, e métodos hormonais alteram esses valores) e a evolução em relação aos exames anteriores.
- points: um item por marcador fora da faixa ou alerta, dizendo o que costuma significar e o que perguntar ao médico.
- tips: até 5 hábitos ligados aos resultados (alimentação e ferro, sono, exercício, estresse, sol e vitamina D).
Nunca sugira começar, parar ou trocar anticoncepcional, hormônios ou outros medicamentos. Também não indique suplementos nem doses de suplementos; nesses casos, oriente conversar com o médico. Não dê diagnóstico: use "pode indicar" e "vale conversar com seu médico". Com beta-hCG positivo, oriente confirmar com o médico, sem tirar conclusões.`;
const RANGE_MALE='quando houver faixas por sexo ou idade, use a de homem adulto';
// No feminino, estradiol, progesterona, LH e FSH têm faixa por fase do ciclo: o app informa a fase do dia do envio.
const rangeFemale=(phase:ExamContext['phase'])=>'quando houver faixas por sexo ou idade, use a de mulher adulta; quando houver faixas por fase do ciclo menstrual, use a da fase '+(!phase||phase==='menstrual'?'folicular':phase)+'; quando houver faixas para gestantes e não gestantes, use a de não gestantes';
const extractInstructions=(c?:ExamContext)=>c?.gender==='female'?EXTRACT.replace(RANGE_MALE,rangeFemale(c.phase)):EXTRACT;
```
3. Troque `export async function extractExam(file:{data:Uint8Array;type:string;name:string}):Promise<ExtractedExam>{` por `export async function extractExam(file:{data:Uint8Array;type:string;name:string},context?:ExamContext):Promise<ExtractedExam>{`, e na mesma função troque `instructions:EXTRACT` por `instructions:extractInstructions(context)`.
4. Troque `export async function reviewWithAi(input:{text:string}):Promise<ModelReview>{` por `export async function reviewWithAi(input:{text:string;gender?:Gender}):Promise<ModelReview>{`, e na mesma função troque `instructions:REVIEW` por `instructions:input.gender==='female'?REVIEW_FEMALE:REVIEW`.

`components/norte/exams.tsx`:
1. Troque `function ExamCard({exam,all,onOpen}:{exam:Item;all:Item[];onOpen:()=>void}){const total=(exam.markers as Marker[]|undefined)?.find(m=>m.key==='testosterona_total');const overall=exam.status==='reviewed'?finalOverall(exam,all):null;` por:
```tsx
function ExamCard({exam,all,onOpen}:{exam:Item;all:Item[];onOpen:()=>void}){const gender=useApp().state.profile.gender;const total=gender==='female'?undefined:(exam.markers as Marker[]|undefined)?.find(m=>m.key==='testosterona_total');const overall=exam.status==='reviewed'?finalOverall(exam,all,gender):null;
```
2. Troque `[{...emptyRow(),key:'testosterona_total',label:'Testosterona total',unit:'ng/dL'}]` por `[a.state.profile.gender==='female'?{...emptyRow(),key:'estradiol',label:'Estradiol',unit:'pg/mL'}:{...emptyRow(),key:'testosterona_total',label:'Testosterona total',unit:'ng/dL'}]`.
3. Troque `const overall=finalOverall(exam,a.state.labExams),review=exam.review;` por `const overall=finalOverall(exam,a.state.labExams,a.state.profile.gender),review=exam.review;`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` e `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/exam-schema.ts lib/female-health.ts lib/testosterone.ts lib/exam-ai.ts lib/exam-service.ts components/norte/exams.tsx tests/female-health.test.mjs tests/testosterone.test.mjs
git commit -m "Exames no feminino: marcadores, alertas, fase do ciclo e parecer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 7: Assistente

**Files:**
- Modify: `lib/agent.ts`, `lib/agent-runtime.ts`
- Test: `tests/female-health.test.mjs`

**Interfaces:**
- Consumes: `cyclePrediction`, `dailyStatus`, `injectionNext`, `iudStatus`, `preventiveStatus`, `METHOD_SHORT`, `PREVENTIVE_LABEL`, `finalOverall(…,gender)` e `hiddenSections`.
- Produces: `femaleHealthReport(s,today)`; `PROPOSABLE` com `periods` e `contraceptiveDoses`; a ferramenta `saude_feminina`.

- [ ] **Step 1: Escrever o teste que falha** — acrescente no topo:
```js
import { femaleHealthReport, checkProposals, describeProposal } from '../lib/agent.ts';
```
e no fim:
```js
test('relatório da saúde feminina para o assistente',()=>{const s=emptyWorkspace('Ana');s.profile.gender='female';s.periods=[per('2026-09-17'),per('2026-10-15')];
 s.symptoms=[{id:'s',title:'S',date:'2026-10-16',symptoms:['Cólica']},{id:'old',title:'S',date:'2026-09-01',symptoms:['Acne']}];s.contraceptives=[{...pill}];s.contraceptiveDoses=[{id:'take-m1-2026-10-18',title:'Tomei',methodId:'m1',date:'2026-10-18'}];s.preventives=[{id:'pv',title:'Papanicolau',intervalMonths:12,lastDate:'2025-10-01'}];
 const r=femaleHealthReport(s,'2026-10-18');
 assert.deepEqual([r.ciclo.proximaPrevista,r.ciclo.diaDoCiclo],['2026-11-12',4]);assert.deepEqual(r.sintomasRecentes.map(x=>x.data),['2026-10-16']);
 assert.deepEqual([r.metodos[0].hoje,r.metodos[0].diaDaCartela],['tomado',18]);assert.equal(r.preventivos[0].situacao,'Atrasado');
 assert.equal(femaleHealthReport(emptyWorkspace('Ana'),'2026-10-18').ciclo,'sem menstruação registrada');});
test('assistente propõe menstruação e uso do método',()=>{const s=emptyWorkspace('Ana');s.profile.gender='female';
 const p=checkProposals([{collection:'periods',flow:'intenso'}],'2026-10-18',s);assert.deepEqual([p.valid[0].item.title,p.valid[0].item.date],['Menstruação','2026-10-18']);assert.match(describeProposal(p.valid[0]),/Início da menstruação/);
 assert.match(checkProposals([{collection:'contraceptiveDoses',title:'Tomei'}],'2026-10-18',s).errors[0],/menu Saúde feminina/);
 s.contraceptives=[{...pill}];assert.equal(checkProposals([{collection:'contraceptiveDoses',title:'Tomei'}],'2026-10-18',s).valid[0].item.methodId,'m1');
 s.contraceptiveDoses=[{id:'take-m1-2026-10-18',title:'Tomei',methodId:'m1',date:'2026-10-18'}];assert.match(checkProposals([{collection:'contraceptiveDoses',title:'Tomei'}],'2026-10-18',s).errors[0],/já existe/);});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs`
Expected: FAIL (`femaleHealthReport` não existe).

- [ ] **Step 3: Implementar**

`lib/agent.ts`:
1. Depois de `import { genderBrief } from './gender.ts';`, acrescente:
```ts
import { cyclePrediction, dailyStatus, injectionNext, iudStatus, preventiveStatus, METHOD_SHORT, PREVENTIVE_LABEL } from './female-health.ts';
```
   e troque `import type { Workspace, Item, Proposal, Collection } from './types.ts';` por `import type { Workspace, Item, Proposal, Collection, Gender } from './types.ts';`.
2. Troque `export const PROPOSABLE = ['tasks','transactions','notes','trtDoses'] as const;` por `export const PROPOSABLE = ['tasks','transactions','notes','trtDoses','periods','contraceptiveDoses'] as const;` e `trtDoses:'Aplicação'};` (fim de `LABELS`) por `trtDoses:'Aplicação',periods:'Menstruação',contraceptiveDoses:'Uso do método'};`.
3. Em `proposalDefaults`, antes do `return {};` final, acrescente:
```ts
 if(collection==='periods')return {date:today,title:'Menstruação'};
 if(collection==='contraceptiveDoses'){const methods=s?.contraceptives||[],active=methods.filter(m=>m.status==='active'&&m.method!=='iud');
  const m=fields.methodId?methods.find(x=>x.id===fields.methodId):active.length===1?active[0]:undefined;
  if(!m)throw new Error('cadastre ou escolha o método no menu Saúde feminina');
  const day=typeof fields.date==='string'?fields.date:today;
  if((s?.contraceptiveDoses||[]).some(d=>d.methodId===m.id&&d.date===day))throw new Error('o registro desse dia já existe');
  return {date:today,title:(m.method==='injection'?'Injeção: ':'Tomei: ')+m.title,methodId:m.id};}
```
4. Em `checkProposals`, troque `'só é possível sugerir tarefas, lançamentos, notas e aplicações'` por `'só é possível sugerir tarefas, lançamentos, notas, aplicações, início da menstruação e uso do método'`.
5. Em `describeProposal`, troque `export function describeProposal(p:Proposal){return [p.collection==='trtDoses'?` por `export function describeProposal(p:Proposal){return [p.collection==='periods'?'Início da menstruação'+(p.item.flow?' · fluxo '+p.item.flow:''):p.collection==='contraceptiveDoses'?'Uso do método':p.collection==='trtDoses'?`.
6. Na `testosteroneReport`, apague a linha ` const exams=s.labExams.filter(e=>e.status==='reviewed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);` e troque a linha que começa com `  exames:exams.map(e=>({data:e.date,` (até o fim dela) por `  exames:examsReport(s),`. Depois do fim da função `testosteroneReport`, acrescente:
```ts
function examsReport(s:Workspace,gender?:Gender){return s.labExams.filter(e=>e.status==='reviewed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(e=>({data:e.date,...(e.lab?{laboratorio:e.lab}:{}),situacao:OVERALL_LABEL[finalOverall(e,s.labExams,gender)],marcadores:(e.markers as Marker[]).map(m=>({nome:m.label,valor:valueText(m),faixa:rangeText(m),classificacao:STATUS_LABEL[classifyMarker(m)]})),...(e.review?{parecer:e.review.summary}:{})}));}
function methodNow(m:Item,doses:Item[],today:string){
 if(m.method==='iud')return {troca:m.changeDate,diasParaTroca:iudStatus(m,today).daysLeft};
 if(m.method==='injection')return {proximaAplicacao:injectionNext(m,doses),...(m.remind?{lembrete:m.time}:{})};
 const st=dailyStatus(m,today);return {hoje:!st.active?(st.pauseUntil?'pausa até '+st.pauseUntil:'sem uso hoje'):doses.some(d=>d.methodId===m.id&&d.date===today)?'tomado':'pendente',...(st.active?{diaDaCartela:st.packDay}:{}),...(m.remind?{lembrete:m.time}:{})};
}
export function femaleHealthReport(s:Workspace,today:string){
 const c=cyclePrediction(s.periods,today),since=addDays(today,-6);
 return {
  ciclo:c?{ultimoInicio:c.lastStart,diaDoCiclo:c.cycleDay,proximaPrevista:c.next,...(c.late?{diasDeAtraso:c.late}:{}),janelaFertil:c.fertileStart+' a '+c.fertileEnd,ovulacaoEstimada:c.ovulation,duracaoMediaCiclo:c.cycleLength,duracaoMediaMenstruacao:c.periodLength,ciclosConsiderados:c.cycles}:'sem menstruação registrada',
  sintomasRecentes:s.symptoms.filter(x=>x.date>=since&&x.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>({data:x.date,sintomas:x.symptoms||[],...(x.mood?{humor:x.mood}:{}),...(x.notes?{observacoes:clip(x.notes,200)}:{})})),
  metodos:s.contraceptives.map(m=>({id:m.id,nome:m.title,tipo:METHOD_SHORT[m.method],situacao:m.status==='paused'?'pausado':'ativo',...methodNow(m,s.contraceptiveDoses,today)})),
  preventivos:s.preventives.map(p=>{const st=preventiveStatus(p,today);return {nome:p.title,situacao:PREVENTIVE_LABEL[st.state],...(p.lastDate?{ultimaVez:p.lastDate}:{}),...(st.next?{proxima:st.next}:{})};}),
  exames:examsReport(s,'female'),
 };
}
```

`lib/agent-runtime.ts`:
1. Troque `assistantBrief,PROPOSABLE,testosteroneReport} from './agent';` por `assistantBrief,PROPOSABLE,testosteroneReport,femaleHealthReport} from './agent';`.
2. No schema `proposal`, troque `trtDoses: aplicação de testosterona que o usuário disse ter feito'),` por `trtDoses: aplicação de testosterona que o usuário disse ter feito; periods: início da menstruação que a usuária contou; contraceptiveDoses: pílula ou injeção que a usuária disse ter tomado'),` e troque `protocolId:z.string().optional()` por `methodId:z.string().optional().describe('id do método (ferramenta saude_feminina); só quando houver mais de um método ativo'),flow:z.enum(['leve','moderado','intenso']).optional(),protocolId:z.string().optional()`.
3. Depois de `const TRT_RULES=...;`, acrescente:
```ts
// Regras do menu Saúde feminina; ficam de fora para quem não vê o menu.
const FEMALE_RULES="Saúde feminina: consulte a ferramenta saude_feminina antes de falar de ciclo, menstruação, métodos ou exames. As previsões do ciclo são estimativas e não servem como método contraceptivo. Não dê diagnóstico. Nunca sugira começar, parar ou trocar anticoncepcional ou hormônio, nem indique suplementos; nesses casos, oriente conversar com o médico. Em suspeita de gravidez, oriente fazer um teste e falar com o médico. Quando ela contar que a menstruação começou, sugira registrar com propor_acoes (periods); quando contar que tomou a pílula ou a injeção, sugira registrar (contraceptiveDoses).";
```
4. Troque `${hiddenSections(state.profile.gender).includes('testosterona')?'':TRT_RULES+'\n'}` por `${hiddenSections(state.profile.gender).includes('testosterona')?'':TRT_RULES+'\n'}${hiddenSections(state.profile.gender).includes('saude-feminina')?'':FEMALE_RULES+'\n'}`.
5. Em `agentTools`, troque `export function agentTools(state:Workspace,today:string,onProposals:(items:Proposal[])=>void){return {` por `export function agentTools(state:Workspace,today:string,onProposals:(items:Proposal[])=>void){const hidden=hiddenSections(state.profile.gender);return {`; troque o início da linha ` testosterona:tool({` por ` ...(hidden.includes('testosterona')?{}:{testosterona:tool({`, e no fim dessa mesma linha troque `execute:async()=>safe(()=>testosteroneReport(state,today))}),` por:
```ts
execute:async()=>safe(()=>testosteroneReport(state,today))})}),
 ...(hidden.includes('saude-feminina')?{}:{saude_feminina:tool({description:'Ciclo menstrual (última menstruação, dia do ciclo, próxima prevista, janela fértil), sintomas dos últimos 7 dias, métodos anticoncepcionais ou hormonais com a situação de hoje, preventivos e os últimos exames revisados.',inputSchema:z.object({}),execute:async()=>safe(()=>femaleHealthReport(state,today))})}),
```
6. Na descrição da ferramenta `buscar`, troque `labExams (exames de testosterona), trtProtocols (protocolos de reposição), trtDoses (aplicações).'` por `labExams (exames de laboratório), trtProtocols (protocolos de reposição), trtDoses (aplicações), periods (menstruações), symptoms (sintomas), contraceptives (métodos anticoncepcionais ou hormonais), contraceptiveDoses (registros de uso), preventives (consultas e exames preventivos).'`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` e `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent.ts lib/agent-runtime.ts tests/female-health.test.mjs
git commit -m "Assistente conhece ciclo, método, preventivos e exames no feminino

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 8: Tela Saúde feminina

**Files:**
- Create: `components/norte/female-health.tsx`, `components/norte/female-health-tips.ts`
- Modify: `components/norte/primitives.tsx` (`Editor`), `components/norte/catalog.ts` (`NAV`), `components/norte/NorteApp.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: tudo de `lib/female-health.ts`, `ExamsPanel` e `OVERALL_PILL` de `./exams`, e `finalOverall(…,'female')`.
- Produces: `FemaleHealthView`; o item de menu `saude-feminina` (`/saude-feminina`); suporte a `showIf` e ao tipo `multi` no `Editor`.

- [ ] **Step 1: Editor com campos condicionais e caixas múltiplas** — em `components/norte/primitives.tsx`, dentro de `Editor`:
1. Depois de `const [values,setValues]=useState<any>(initial);const [saving,setSaving]=useState(false);const [error,setError]=useState('');`, acrescente `const shown=fields.filter(f=>!f.showIf||f.showIf(values));`.
2. Em `submit`, troque `const record:any={...values,id:recordId};for(const f of fields){` por `const record:any={...values,id:recordId};const visible=new Set(shown.map(f=>f.key));for(const f of fields)if(!visible.has(f.key))delete record[f.key];for(const f of shown){`.
3. Troque `{fields.map(f=><label key={f.key} className={'field '+(f.type==='textarea'||f.key==='title'?'full':'')}>` por `{shown.map(f=>{const Wrap=f.type==='multi'?'div':'label';return <Wrap key={f.key} className={'field '+(f.type==='textarea'||f.type==='multi'||f.key==='title'?'full':'')}>`.
4. Troque `:f.type==='checkbox'?<input aria-label={f.label} type="checkbox"` por:
```tsx
:f.type==='multi'?<div className="multi-options">{(f.options||[]).map(([v,l])=><label key={v} className="check-chip"><input type="checkbox" checked={(values[f.key]||[]).includes(v)} onChange={e=>setValues({...values,[f.key]:e.target.checked?[...(values[f.key]||[]),v]:(values[f.key]||[]).filter((x:string)=>x!==v)})}/>{l}</label>)}</div>:f.type==='checkbox'?<input aria-label={f.label} type="checkbox"
```
5. Troque `{f.hint&&<small>{f.hint}</small>}</label>)}</div>` por `{f.hint&&<small>{f.hint}</small>}</Wrap>;})}</div>`.

- [ ] **Step 2: Menu** — em `components/norte/catalog.ts`, acrescente `Flower2` ao import do `lucide-react` e, depois da linha `{id:'testosterona',path:'/testosterona',label:'Testosterona',icon:FlaskConical,group:'CUIDE DE VOCÊ'},`, acrescente:
```ts
{id:'saude-feminina',path:'/saude-feminina',label:'Saúde feminina',icon:Flower2,group:'CUIDE DE VOCÊ'},
```

- [ ] **Step 3: Dicas** — criar `components/norte/female-health-tips.ts`:
```ts
// Conteúdo fixo da aba Dicas do menu Saúde feminina: hábitos gerais, revisados. Não substitui orientação médica.
export const FEMALE_TIPS=[
 {title:'Alimentação e ferro',icon:'utensils',items:['Feijão, lentilha, grão-de-bico, carnes e folhas verde-escuras são fontes de ferro.','Uma fruta cítrica (laranja, acerola, kiwi) na refeição ajuda a absorver o ferro dos vegetais.','Café e chá logo depois das refeições atrapalham a absorção do ferro; prefira outro horário.','Beber água ao longo do dia ajuda com o inchaço.']},
 {title:'Cólica e desconforto',icon:'heart',items:['Calor local (bolsa de água morna) e alongamentos leves aliviam a cólica.','Caminhar e se movimentar costuma reduzir o desconforto.','Anote os sintomas: o padrão ajuda o médico a avaliar.','Dor forte que atrapalha a rotina não é normal; converse com seu médico.']},
 {title:'Sono',icon:'moon',items:['Durma de 7 a 9 horas, com horários regulares.','Na semana antes da menstruação o sono pode piorar: quarto escuro e telas longe na última hora ajudam.']},
 {title:'Exercício ao longo do ciclo',icon:'dumbbell',items:['Mantenha a atividade física durante todo o ciclo, ajustando a intensidade a como você se sente.','Musculação 2 a 3 vezes por semana fortalece ossos e músculos.','Nos dias de menos energia, caminhada, ioga e alongamento contam.']},
 {title:'Saúde íntima',icon:'droplet',items:['Prefira roupas íntimas de algodão e troque o absorvente a cada 4 a 6 horas.','Evite duchas vaginais: elas alteram a proteção natural.','Use preservativo para se proteger de infecções sexualmente transmissíveis, mesmo usando outro método.']},
 {title:'Quando procurar o médico',icon:'stethoscope',items:['Sangramento muito intenso (trocar o absorvente a cada hora) ou que dura mais de 7 dias.','Menstruação atrasada com teste de gravidez positivo, ou atraso sem explicação.','Dor forte na pelve, febre ou corrimento com cheiro forte.','Sangramento fora do período ou depois da relação.','Esqueceu a pílula: siga a bula e converse com seu médico sobre a proteção.']},
] as const;
```

- [ ] **Step 4: Tela** — criar `components/norte/female-health.tsx`:
```tsx
'use client';
import {useState} from 'react';import {Plus,Droplet,CalendarDays,ShieldCheck,Pill,Syringe,FlaskConical,Stethoscope,Pencil,Trash2,Check,Sparkles,Utensils,Moon,Dumbbell,Heart,HeartPulse,Leaf} from 'lucide-react';
import {useApp,type AppContext} from './context';import {PageHeading,Tabs,Stat,Empty} from './primitives';import {Records} from './records';import {ExamsPanel,OVERALL_PILL} from './exams';import {FEMALE_TIPS} from './female-health-tips';
import {cyclePrediction,forecastDays,dailyStatus,injectionNext,iudStatus,preventiveStatus,takeId,dayDiff,FLOW_LABEL,METHOD_SHORT,PREVENTIVE_LABEL,PREVENTIVE_SUGGESTIONS,type PreventiveState} from '@/lib/female-health';import {finalOverall,OVERALL_LABEL} from '@/lib/testosterone';import type {Item} from '@/lib/types';
const ICONS={utensils:Utensils,heart:Heart,moon:Moon,dumbbell:Dumbbell,droplet:Droplet,stethoscope:Stethoscope};
const PREVENTIVE_PILL:Record<PreventiveState,string>={none:'pill',late:'pill danger',soon:'pill warn',ok:'pill green'};
const dayLabel=(d:string)=>d?d.split('-').reverse().join('/'):'';
const shortDay=(d:string)=>dayLabel(d).slice(0,5);
const plural=(n:number)=>n+(n===1?' dia':' dias');
const weekday=(d:string)=>new Intl.DateTimeFormat('pt-BR',{weekday:'narrow',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const takenToday=(a:AppContext,m:Item)=>a.state.contraceptiveDoses.some(d=>d.methodId===m.id&&d.date===a.today);
const newPeriod=(a:AppContext)=>a.edit('periods',undefined,{date:a.today,title:'Menstruação',flow:'moderado'});
// Um registro de sintomas por dia: se o de hoje existe, abre para editar.
const newSymptoms=(a:AppContext)=>{const today=a.state.symptoms.find(x=>x.date===a.today);if(today)a.edit('symptoms',today);else a.edit('symptoms',undefined,{date:a.today,title:'Sintomas do dia',symptoms:[]});};
const newMethod=(a:AppContext)=>a.edit('contraceptives',undefined,{method:'daily',status:'active',remind:true,activeDays:21,pauseDays:7,intervalDays:30,time:'21:00'});
// Id fixo por método e dia: tocar de novo, ou registrar pelo app e pelo Telegram, não duplica.
const take=(a:AppContext,m:Item)=>a.mutate({type:'upsert',collection:'contraceptiveDoses',item:{id:takeId(m.id,a.today),title:(m.method==='injection'?'Injeção: ':'Tomei: ')+m.title,date:a.today,methodId:m.id}});

export function FemaleHealthView(){const a=useApp();const [tab,setTab]=useState('resumo');
 return <><PageHeading eyebrow="CUIDAR DE SI" title="Saúde feminina" description="Ciclo, anticoncepcional, exames e preventivos em um só lugar."/>
  <p className="health-disclaimer"><ShieldCheck size={16}/>As previsões são estimativas e não substituem seu médico nem servem como método contraceptivo.</p>
  <Tabs value={tab} onChange={setTab} items={[{id:'resumo',label:'Resumo'},{id:'ciclo',label:'Ciclo'},{id:'metodo',label:'Anticoncepcional'},{id:'exames',label:'Exames',count:a.state.labExams.length},{id:'preventivos',label:'Preventivos'},{id:'dicas',label:'Dicas'}]}/>
  {tab==='resumo'&&<Summary onTab={setTab}/>}{tab==='ciclo'&&<CyclePanel/>}{tab==='metodo'&&<MethodsPanel/>}{tab==='exames'&&<ExamsPanel/>}{tab==='preventivos'&&<PreventivesPanel/>}{tab==='dicas'&&<TipsPanel/>}</>;}

function MethodToday({m}:{m:Item}){const a=useApp();
 if(m.method==='daily'){const st=dailyStatus(m,a.today),done=takenToday(a,m);return <Stat label={'Hoje · '+m.title} icon={Pill} value={!st.active?'Pausa':done?'Tomado':'Pendente'} foot={!st.active?(st.pauseUntil?'Pausa até '+dayLabel(st.pauseUntil):'Começa em '+dayLabel(m.startDate)):'Dia '+st.packDay+' da cartela'} accent={st.active&&!done}/>;}
 if(m.method==='injection'){const next=injectionNext(m,a.state.contraceptiveDoses),days=dayDiff(a.today,next);return <Stat label={'Próxima injeção · '+m.title} icon={Syringe} value={dayLabel(next)} foot={days<0?'Atrasada há '+plural(-days):days===0?'É hoje':'Faltam '+plural(days)} accent={days<=0}/>;}
 const st=iudStatus(m,a.today);return <Stat label={'Troca · '+m.title} icon={CalendarDays} value={dayLabel(m.changeDate)} foot={st.daysLeft<0?'Troca atrasada':st.soon?'Faltam '+plural(st.daysLeft):'Em dia'} accent={st.soon}/>;}

function Summary({onTab}:{onTab:(t:string)=>void}){const a=useApp();const c=cyclePrediction(a.state.periods,a.today);const active=a.state.contraceptives.filter(m=>m.status==='active');
 const next=a.state.preventives.map(p=>({p,st:preventiveStatus(p,a.today)})).sort((x,y)=>(x.st.next||'').localeCompare(y.st.next||''))[0];
 const reviewed=a.state.labExams.filter(e=>e.status==='reviewed').sort((x,y)=>x.date.localeCompare(y.date));const last=reviewed[reviewed.length-1];const overall=last?finalOverall(last,a.state.labExams,'female'):null;const points=(last?.review?.points||[]) as {marker:string;text:string}[];
 const pending=active.filter(m=>m.method!=='iud'&&!takenToday(a,m)&&(m.method==='injection'?dayDiff(a.today,injectionNext(m,a.state.contraceptiveDoses))<=3:dailyStatus(m,a.today).active));
 return <>
  <div className="stats-grid three">
   <Stat label="Ciclo" icon={Droplet} value={c?'Dia '+c.cycleDay:'—'} foot={c?(c.late?'Menstruação atrasada há '+plural(c.late):c.daysToNext===0?'Menstruação prevista para hoje':'Próxima em '+plural(c.daysToNext)+' · '+dayLabel(c.next)):'Registre sua última menstruação'} accent={!!c?.late}/>
   <Stat label="Janela fértil estimada" icon={Leaf} value={c?shortDay(c.fertileStart)+' a '+shortDay(c.fertileEnd):'—'} foot={c?'Ovulação por volta de '+dayLabel(c.ovulation):'Aparece depois do primeiro registro'}/>
   {active.map(m=><MethodToday key={m.id} m={m}/>)}
   {next&&<Stat label={'Preventivo · '+next.p.title} icon={Stethoscope} value={next.st.next?dayLabel(next.st.next):'Sem registro'} foot={PREVENTIVE_LABEL[next.st.state]} accent={next.st.state==='late'}/>}
   <Stat label="Último exame" icon={FlaskConical} value={last?dayLabel(last.date):'—'} foot={overall?OVERALL_LABEL[overall]:'Envie seu primeiro exame'}/>
  </div>
  <div className="button-group"><button className="button primary" onClick={()=>newPeriod(a)}><Droplet size={16}/>Menstruação começou</button>{pending.map(m=><button key={m.id} className="button outline" disabled={a.busy} onClick={()=>take(a,m)}>{m.method==='injection'?<Syringe size={16}/>:<Check size={16}/>}{m.method==='injection'?'Registrar injeção':'Tomei'}{pending.length>1?' · '+m.title:''}</button>)}<button className="button outline" onClick={()=>newSymptoms(a)}><HeartPulse size={16}/>Registrar sintomas</button>{!a.state.contraceptives.length&&<button className="button outline" onClick={()=>onTab('metodo')}><Plus size={16}/>Cadastrar método</button>}</div>
  {overall&&points.length>0&&<section className="panel"><header className="section-heading"><h2>Pontos de atenção do último exame</h2><span className={OVERALL_PILL[overall]}>{OVERALL_LABEL[overall]}</span></header><ul className="review-list">{points.map((p,i)=><li key={i}><b>{p.marker}:</b> {p.text}</li>)}</ul></section>}
 </>;}

function CyclePanel(){const a=useApp();const c=cyclePrediction(a.state.periods,a.today);const days=forecastDays(a.state.periods,a.today,35);const periods=a.state.periods.slice().sort((x,y)=>y.date.localeCompare(x.date));const symptoms=a.state.symptoms.slice().sort((x,y)=>y.date.localeCompare(x.date));
 return <>
  <div className="button-group"><button className="button primary" onClick={()=>newPeriod(a)}><Droplet size={16}/>Menstruação começou</button><button className="button outline" onClick={()=>newSymptoms(a)}><HeartPulse size={16}/>Registrar sintomas</button></div>
  {c?<><div className="stats-grid three"><Stat label="Duração média do ciclo" value={c.cycleLength+' dias'} foot={c.cycles?'Com base em '+c.cycles+(c.cycles===1?' ciclo':' ciclos'):'Padrão de 28 dias até registrar mais ciclos'}/><Stat label="Duração média da menstruação" value={c.periodLength+' dias'} foot="Registre o fim para melhorar a média"/><Stat label="Próxima menstruação" value={dayLabel(c.next)} foot={c.late?'Atrasada há '+plural(c.late):'Em '+plural(c.daysToNext)} accent={c.late>0}/></div>
   <section className="panel"><header className="section-heading"><h2>Próximos 35 dias</h2><div className="cycle-legend"><span className="period">Menstruação</span><span className="fertile">Janela fértil</span><span className="ovulation">Ovulação</span></div></header><div className="cycle-calendar">{days.map(d=><div key={d.date} className={'cycle-day '+(d.kind||'')+(d.date===a.today?' today':'')} title={dayLabel(d.date)}><small>{weekday(d.date)}</small><strong>{Number(d.date.slice(8))}</strong></div>)}</div></section></>
  :<section className="panel"><Empty icon={Droplet} title="Nenhuma menstruação registrada" description="Registre o início da última menstruação para ver a previsão do próximo ciclo." action="Registrar menstruação" onAction={()=>newPeriod(a)}/></section>}
  <div className="section-action"><h2>Menstruações</h2></div>
  <Records collection="periods" items={periods} compact renderExtra={p=><p className="record-content">{[p.endDate?'Até '+dayLabel(p.endDate):'Sem data de fim',FLOW_LABEL[p.flow]||''].filter(Boolean).join(' · ')}</p>} emptyTitle="Nenhuma menstruação registrada" emptyText="Cada registro melhora a previsão do ciclo."/>
  <div className="section-action"><h2>Sintomas</h2></div>
  <Records collection="symptoms" items={symptoms} compact renderExtra={s=>s.symptoms?.length?<p className="record-content">{s.symptoms.join(', ')}</p>:null} emptyTitle="Nenhum sintoma registrado" emptyText="Anote como você se sente para perceber padrões ao longo do ciclo."/>
 </>;}

function methodLine(m:Item,doses:Item[],today:string){
 if(m.status==='paused')return METHOD_SHORT[m.method]+' · pausado';
 if(m.method==='daily'){const st=dailyStatus(m,today);return METHOD_SHORT.daily+' · '+m.activeDays+' dias de uso'+(m.pauseDays?' e '+m.pauseDays+' de pausa':', contínuo')+' · '+(st.active?'dia '+st.packDay+' da cartela':st.pauseUntil?'pausa até '+dayLabel(st.pauseUntil):'começa em '+dayLabel(m.startDate));}
 if(m.method==='injection')return METHOD_SHORT.injection+' a cada '+m.intervalDays+' dias · próxima: '+dayLabel(injectionNext(m,doses));
 return METHOD_SHORT.iud+' · colocado em '+dayLabel(m.startDate)+' · troca em '+dayLabel(m.changeDate)+(iudStatus(m,today).daysLeft<0?' (atrasada)':'');}

function MethodsPanel(){const a=useApp();const doses=a.state.contraceptiveDoses.slice().sort((x,y)=>y.date.localeCompare(x.date));
 return <>
  <div className="section-action"><p>Registre o método indicado pelo seu médico. O GeoAI acompanha as datas e lembra você no Telegram.</p><button className="button primary" onClick={()=>newMethod(a)}><Plus size={16}/>Novo método</button></div>
  {a.state.contraceptives.length?<div className="cards-grid">{a.state.contraceptives.map(m=><article className="panel record-card" key={m.id}>
   <div className="record-head"><span className={m.status==='active'?'pill green':'pill'}>{m.status==='active'?'Ativo':'Pausado'}</span>{m.remind&&m.method!=='iud'&&<span className="pill">Lembrete às {m.time}</span>}<div className="record-actions"><button className="icon-button" aria-label={'Editar '+m.title} onClick={()=>a.edit('contraceptives',m)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={'Excluir '+m.title} onClick={()=>a.remove('contraceptives',m)}><Trash2 size={15}/></button></div></div>
   <button className="record-title" onClick={()=>a.edit('contraceptives',m)}>{m.title}</button>
   <p className="record-content">{methodLine(m,a.state.contraceptiveDoses,a.today)}</p>
   {m.status==='active'&&m.method!=='iud'&&!takenToday(a,m)&&(m.method==='injection'||dailyStatus(m,a.today).active)&&<button className="button outline small" disabled={a.busy} onClick={()=>take(a,m)}><Check size={15}/>{m.method==='injection'?'Registrar injeção hoje':'Tomei hoje'}</button>}
  </article>)}</div>
  :<section className="panel"><Empty icon={Pill} title="Nenhum método registrado" description="Cadastre pílula, injeção ou DIU para acompanhar as datas e receber lembretes." action="Novo método" onAction={()=>newMethod(a)}/></section>}
  <div className="section-action"><h2>Registros</h2></div>
  <Records collection="contraceptiveDoses" items={doses} compact emptyTitle="Nenhum registro ainda" emptyText="Toque em Tomei ou responda o lembrete do Telegram."/>
 </>;}

function PreventivesPanel(){const a=useApp();const list=a.state.preventives.map(p=>({p,st:preventiveStatus(p,a.today)})).sort((x,y)=>(x.st.next||'').localeCompare(y.st.next||''));
 const missing=PREVENTIVE_SUGGESTIONS.filter(([t])=>!a.state.preventives.some(p=>p.title.toLocaleLowerCase('pt-BR')===t.toLocaleLowerCase('pt-BR')));const add=()=>a.edit('preventives',undefined,{intervalMonths:12});
 return <>
  <div className="section-action"><p>Consultas e exames de rotina. O GeoAI calcula a próxima data a partir da última vez.</p><button className="button primary" onClick={add}><Plus size={16}/>Novo preventivo</button></div>
  {missing.length>0&&<div className="suggestion-chips">{missing.map(([title,months])=><button key={title} className="button outline small" disabled={a.busy} onClick={()=>a.mutate({type:'upsert',collection:'preventives',item:{title,intervalMonths:months}})}><Plus size={14}/>{title}</button>)}</div>}
  {list.length?<div className="cards-grid">{list.map(({p,st})=><article className="panel record-card" key={p.id}>
   <div className="record-head"><span className={PREVENTIVE_PILL[st.state]}>{PREVENTIVE_LABEL[st.state]}</span><div className="record-actions"><button className="icon-button" aria-label={'Editar '+p.title} onClick={()=>a.edit('preventives',p)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={'Excluir '+p.title} onClick={()=>a.remove('preventives',p)}><Trash2 size={15}/></button></div></div>
   <button className="record-title" onClick={()=>a.edit('preventives',p)}>{p.title}</button>
   <p className="record-content">A cada {p.intervalMonths} {p.intervalMonths===1?'mês':'meses'}{p.lastDate?' · última: '+dayLabel(p.lastDate):''}{st.next?' · próxima: '+dayLabel(st.next):''}</p>
   <button className="button outline small" disabled={a.busy||p.lastDate===a.today} onClick={()=>a.mutate({type:'upsert',collection:'preventives',item:{...p,lastDate:a.today}})}><Check size={15}/>Fiz hoje</button>
  </article>)}</div>
  :<section className="panel"><Empty icon={Stethoscope} title="Nenhum preventivo ainda" description="Use as sugestões acima ou cadastre suas consultas de rotina." action="Novo preventivo" onAction={add}/></section>}
 </>;}

function TipsPanel(){const a=useApp();const last=a.state.labExams.filter(e=>e.status==='reviewed'&&e.review?.tips?.length).sort((x,y)=>y.date.localeCompare(x.date))[0];
 return <>
  {last&&<section className="panel"><header className="section-heading"><h2><Sparkles size={18}/> Para você</h2><span className="pill">Exame de {dayLabel(last.date)}</span></header><ul className="review-list">{(last.review.tips as string[]).map((t,i)=><li key={i}>{t}</li>)}</ul></section>}
  <div className="tips-grid">{FEMALE_TIPS.map(t=>{const Icon=ICONS[t.icon];return <section className="panel" key={t.title}><header className="section-heading"><h2><Icon size={18}/> {t.title}</h2></header><ul>{t.items.map(x=><li key={x}>{x}</li>)}</ul></section>;})}</div>
 </>;}
```

- [ ] **Step 5: Ligar no app** — em `components/norte/NorteApp.tsx`:
1. Depois de `import {TestosteroneView} from './testosterone';`, acrescente `import {FemaleHealthView} from './female-health';`.
2. Troque `testosterona:<TestosteroneView/>,` por `testosterona:<TestosteroneView/>,'saude-feminina':<FemaleHealthView/>,`.
3. Troque `if(collection==='labExams')navigate('/testosterona');` por `if(collection==='labExams')navigate(hiddenSections(state.profile.gender).includes('testosterona')?'/saude-feminina':'/testosterona');`.
4. Em `TOOL_STATUS`, troque `'tool-propor_acoes':'Preparando sugestões…'};` por `'tool-propor_acoes':'Preparando sugestões…','tool-saude_feminina':'Olhando sua saúde…'};`.

Em `app/globals.css`, acrescente no fim:
```css
.task-check.readonly{border-style:dashed;opacity:.45}
.multi-options{display:flex;flex-wrap:wrap;gap:8px}
.check-chip{display:flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:20px;padding:5px 11px;font-size:12px;cursor:pointer}
.check-chip input{accent-color:var(--green)}
.suggestion-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.cycle-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:var(--muted)}
.cycle-legend span::before{content:'';display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.cycle-legend .period::before{background:#e0a9a3}.cycle-legend .fertile::before{background:var(--green-soft);border:1px solid var(--green)}.cycle-legend .ovulation::before{background:var(--green)}
.cycle-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.cycle-day{border:1px solid var(--border);border-radius:10px;padding:6px 4px;text-align:center;display:grid;gap:2px}
.cycle-day small{font-size:9px;color:var(--muted);text-transform:uppercase}.cycle-day strong{font-size:13px}
.cycle-day.period{background:#f3d9d6;border-color:#e0a9a3}.cycle-day.fertile{background:var(--green-soft);border-color:var(--green)}.cycle-day.ovulation{background:var(--green);border-color:var(--green);color:var(--surface)}.cycle-day.ovulation small{color:var(--surface)}
.cycle-day.today{outline:2px solid var(--gold);outline-offset:1px}
:root[data-theme=dark] .cycle-day.period{background:#4a2a28;border-color:#7a4540}
```

- [ ] **Step 6: Verificar tipos e testes**

Run: `npm run typecheck` e `npm test`
Expected: PASS.

- [ ] **Step 7: Conferir no harness local** — reconstruir e servir o app com `/api/state` simulado (harness da sessão):

Run: `node "C:/Users/Geovanni/AppData/Local/Temp/claude/c--Users-Geovanni-Documents-GeoIA-norte/f9295150-4712-44e1-8a9d-d1767fc89af1/scratchpad/harness/build.mjs" "$(pwd)"` (o servidor da porta 4599 já serve a pasta `out`).
Abrir `http://127.0.0.1:4599/?mode=female&page=/saude-feminina` (e com `&dark=1`), nas larguras 1440 e 390. Conferir:
- o menu mostra Saúde feminina e não Testosterona;
- registrar uma menstruação faz a previsão e o calendário aparecerem;
- o formulário de método mostra só os campos do tipo escolhido e salva;
- Tomei some depois do registro, e o item de uso diário aparece em Meu dia;
- os preventivos sugeridos entram com um toque;
- o formulário de sintomas marca e desmarca as caixas;
- não há rolagem horizontal em 390 px;
- `?mode=old` não mostra o menu.
Expected: tudo funcionando e sem erros no console (fora o `favicon.ico` do harness).

- [ ] **Step 8: Commit**

```bash
git add components/norte/female-health.tsx components/norte/female-health-tips.ts components/norte/primitives.tsx components/norte/catalog.ts components/norte/NorteApp.tsx app/globals.css
git commit -m "Tela do menu Saúde feminina

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 9: Documentação e verificação final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README** — logo depois da seção `## Versão feminina`, acrescente:
```markdown
## Menu Saúde feminina

- Aparece para quem escolheu ser tratada no feminino, no lugar do menu Testosterona. Abas: Resumo, Ciclo, Anticoncepcional, Exames, Preventivos e Dicas.
- Ciclo: a previsão usa a média dos últimos 6 ciclos (ou 28 dias, sem histórico); ovulação 14 dias antes da próxima menstruação e janela fértil de 5 dias antes a 1 dia depois. São estimativas, não método contraceptivo.
- Anticoncepcional: uso diário (com ou sem pausa), injeção mensal ou trimestral e DIU/implante. Lembrete no Telegram na hora escolhida, com os botões Tomei e Lembrar em 1h ou Adiar 1 dia.
- Lembrete: na Vercel Hobby cada cron roda uma vez por dia, então o `vercel.json` tem 24 entradas diárias (`0 H * * *`) para `/api/cron/female-reminders`; a rota calcula a hora local de cada pessoa. Usa o mesmo `CRON_SECRET` do lembrete de testosterona.
- Exames: mesma leitura e parecer da IA, com faixas femininas, fase do ciclo na coleta e alertas para hemoglobina abaixo de 8 g/dL, TSH fora de 0,1 a 10 e beta-hCG positivo.
```

- [ ] **Step 2: Verificação completa**

Run: `npm test`, `npm run typecheck`, `npm run build` e `npx eslint lib/female-health.ts lib/female-reminders.ts components/norte/female-health.tsx components/norte/female-health-tips.ts app/api/cron/female-reminders/route.ts`
Expected: todos os testes passam, sem erro de tipo, build ok e nenhum problema de lint nos arquivos novos.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Documenta o menu Saúde feminina

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
