# Calendário do ciclo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a faixa "Próximos 35 dias" da aba Ciclo (Saúde feminina) por um calendário mensal e anual, com menstruação registrada e prevista, janela fértil, ovulação, dia do ciclo, humor, sintomas, anticoncepcional e um registro novo de relação sexual.

**Architecture:**
- **Dados e regras:** uma coleção nova `intimacy` no workspace (JSON, sem migração) e uma função pura `cycleCalendar` em `lib/female-health.ts`, que calcula tudo o que cada dia mostra. A função é testada com `node:test`.
- **Tela:** um componente novo, `components/norte/cycle-calendar.tsx`, desenha o mês, o ano e o painel do dia, usando `useApp()`. O `CyclePanel` passa a usá-lo.

**Tech Stack:** Next.js 16, React 19, TypeScript, lucide-react, CSS em `app/globals.css`, testes com `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-calendario-ciclo-design.md`

**Worktree e branch:** `.claude/worktrees/calendario-ciclo`, branch `feat/calendario-ciclo`. Todo comando roda dali. Nunca troque de branch na checkout principal.

## Global Constraints

- **Textos:** todos em pt-BR, exatamente como na spec. Datas internas no formato `AAAA-MM-DD`, com a aritmética via `shiftDate` e `dayDiff` (UTC, `T12:00:00Z`).
- **Estilo:** o do repositório, com linhas compactas, poucos comentários (em pt-BR, explicando o porquê) e sem dependências novas.
- **Testes:** importam os `.ts` por caminho relativo com extensão (`../lib/female-health.ts`). Arquivos importados pelos testes não podem importar `@/...`.
- **Grade:** começa na segunda-feira, com o cabeçalho `S T Q Q S S D`.
- **Cores:**
  - menstruação: `#f3d9d6` com borda `#e0a9a3` (no escuro, `#4a2a28` e `#7a4540`);
  - fértil: `--green-soft` com borda `--green`;
  - ovulação: `--green`;
  - hoje: contorno `--gold`;
  - selecionado: fundo `--text` e texto `--surface`.
- **Celular de 375 px:** sem rolagem horizontal.
- **Aviso fixo do menu:** continua. Nada de "probabilidade de engravidar".
- **Commits:** em pt-BR, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Navegação entre meses na virada do ano e em fevereiro bissexto.** Dezembro → janeiro mostra "Janeiro de 2027", e fevereiro de 2028 tem 29 dias. Testado na Tarefa 2 com `calendarMonth` e `shiftMonth`.
2. **Workspace antigo sem `intimacy`, `journal` ou métodos.** O calendário não pode quebrar. Testado na Tarefa 2, porque `cycleCalendar` aceita listas ausentes, e na Tarefa 1, porque a atualização cria `intimacy: []`.
3. **Menstruação digitada com início no futuro.** Não pinta, não muda a previsão nem o dia do ciclo. Testado na Tarefa 2.
4. **Dia selecionado ao navegar.** Trocar de mês mantém o dia selecionado no painel, e "Hoje" volta ao mês e ao dia atuais. Conferido na Tarefa 4.
5. **Celular de 375 px e tema escuro.** Sete colunas legíveis, sem rolagem horizontal, e selecionado e menstruação legíveis no escuro. Conferido na Tarefa 4.

---

### Task 1: Registro "Relação" (coleção `intimacy`)

**Files:**
- Modify: `lib/types.ts:1` (`COLLECTIONS`)
- Modify: `lib/core.ts:28-30` (chaves e coleções adicionadas), `lib/core.ts:67` (data obrigatória), `lib/core.ts:82` (validação), `lib/core.ts:125` (um por dia)
- Modify: `components/norte/catalog.ts` (`FIELDS` e `COLLECTION_LABELS`)
- Modify: `lib/agent.ts:13-14,57,72,85` (proposta, rótulo, padrão, mensagem e descrição)
- Modify: `lib/agent-runtime.ts` (esquema da proposta, regra feminina e descrição da busca)
- Test: `tests/female-health.test.mjs`

**Interfaces:**
- Produces:
  - `Workspace.intimacy: Item[]`, com itens `{id,title:'Relação',date,protection?:'com'|'sem',notes?}`;
  - `PROPOSABLE` inclui `'intimacy'`;
  - `describeProposal` dá `'Relação · com proteção · <data>'`;
  - campos `FIELDS.intimacy` e o rótulo `COLLECTION_LABELS.intimacy = 'Registrar relação'`.

- [ ] **Step 1: Write the failing tests.** Acrescente ao fim de `tests/female-health.test.mjs`. `T`, `up`, `emptyWorkspace`, `validateItem`, `upgradeWorkspace`, `validateWorkspace`, `checkProposals` e `describeProposal` já estão importados ou definidos no topo.

```js
test('relação: proteção válida, data obrigatória e um registro por dia',()=>{
 assert.equal(validateItem('intimacy',{title:'Relação',date:T,protection:'sem',notes:'Viagem'}).protection,'sem');
 assert.equal(validateItem('intimacy',{title:'Relação',date:T,protection:''}).protection,undefined);
 assert.throws(()=>validateItem('intimacy',{title:'Relação',date:T,protection:'talvez'}),/Proteção inválida/);
 assert.throws(()=>validateItem('intimacy',{title:'Relação'}),/data do registro/);
 const s=up(emptyWorkspace('Ana'),'intimacy',{id:'r1',title:'Relação',date:T});assert.equal(s.intimacy.length,1);
 assert.throws(()=>up(s,'intimacy',{id:'r2',title:'Relação',date:T}),/Já existe um registro para esta data/);
 const old=emptyWorkspace('Ana');delete old.intimacy;assert.deepEqual(upgradeWorkspace({...old}).intimacy,[]);assert.doesNotThrow(()=>validateWorkspace(old));});
test('assistente sugere registrar relação, com proteção, uma vez por dia',()=>{
 const {valid,errors}=checkProposals([{collection:'intimacy',protection:'com'}],T,emptyWorkspace('Ana'));assert.deepEqual(errors,[]);
 assert.deepEqual([valid[0].collection,valid[0].item.title,valid[0].item.date,valid[0].item.protection],['intimacy','Relação',T,'com']);
 assert.equal(describeProposal(valid[0]),'Relação · com proteção · '+T);
 assert.equal(describeProposal({collection:'intimacy',item:{title:'Relação',date:T}}),'Relação · '+T);
 const s=up(emptyWorkspace('Ana'),'intimacy',{id:'r1',title:'Relação',date:T});const again=checkProposals([{collection:'intimacy'}],T,s);
 assert.equal(again.valid.length,0);assert.match(again.errors[0],/registro desse dia já existe/);});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs`
Expected: os dois testes novos falham (`Registro inválido`, porque a coleção não existe). Os demais passam.

- [ ] **Step 3: Implement.**

`lib/types.ts`: acrescente `'intimacy'` ao fim de `COLLECTIONS`, depois de `'preventives'`.

`lib/core.ts`:
- Na linha do comentário `// Menu Saúde feminina.`, acrescente `'protection'` à lista de chaves válidas: `for(const key of ['endDate','flow','symptoms','method','activeDays','pauseDays','changeDate','methodId','intervalMonths','lastDate','snoozeHour','protection'])VALID_KEYS.add(key);…` (o resto da linha não muda).
- `ADDED_COLLECTIONS`: acrescente `'intimacy'` ao fim.
- Na lista de coleções que exigem data (`if(['tasks','transactions','journal',…,'contraceptiveDoses'].includes(collection)&&!item.date)`), acrescente `'intimacy'`.
- Depois da linha `if(collection==='symptoms'){…}`, acrescente:

```ts
 if(collection==='intimacy'&&item.protection!==undefined&&!['com','sem'].includes(item.protection))throw new Error('Proteção inválida');
```

- Em `applyCommand`, troque `if(['journal','sleep','symptoms'].includes(col)&&…` por `if(['journal','sleep','symptoms','intimacy'].includes(col)&&…`. O resto da linha não muda.

`components/norte/catalog.ts`:
- Em `FIELDS`, depois de `preventives:[…]`, acrescente uma vírgula e:

```ts
intimacy:[{...title,label:'Registro',default:'Relação'},date,{key:'protection',label:'Proteção',type:'select',options:[['','Não informar'],['com','Com proteção'],['sem','Sem proteção']]},notes]
```

- Em `COLLECTION_LABELS`, acrescente `,intimacy:'Registrar relação'` antes do `}` final.
- Rode `npm run typecheck`: qualquer outro `Record<Collection,…>` que reclamar recebe a chave `intimacy`.

`lib/agent.ts`:
- `PROPOSABLE = ['tasks','transactions','notes','trtDoses','periods','contraceptiveDoses','intimacy'] as const;`
- `LABELS`: acrescente `intimacy:'Relação'`.
- Em `proposalDefaults`, logo depois de `if(collection==='periods')return {date:today,title:'Menstruação'};`, acrescente:

```ts
 if(collection==='intimacy'){const day=typeof fields.date==='string'?fields.date:today;if((s?.intimacy||[]).some(r=>r.date===day))throw new Error('o registro desse dia já existe');return {date:today,title:'Relação'};}
```

- Mensagem de coleção não permitida: `'só é possível sugerir tarefas, lançamentos, notas, aplicações, início da menstruação, uso do método e relação'`.
- Em `describeProposal`, o primeiro elemento do array começa por `p.collection==='periods'?…`. Coloque antes dele:

```ts
p.collection==='intimacy'?'Relação'+(p.item.protection==='com'?' · com proteção':p.item.protection==='sem'?' · sem proteção':''):
```

`lib/agent-runtime.ts`:
- No `proposal` (`z.object`), o `.describe` de `collection` termina em `contraceptiveDoses: pílula ou injeção que a usuária disse ter tomado`. Acrescente `; intimacy: relação sexual que a usuária contou ter tido` antes da aspa de fechamento.
- No mesmo `z.object`, depois de `protocolId:…`, acrescente:

```ts
protection:z.enum(['com','sem']).optional().describe('intimacy: com ou sem proteção, só quando ela disser')
```

- `FEMALE_RULES`: antes da aspa final, acrescente ` Quando ela contar que teve relação sexual, sugira registrar com propor_acoes (intimacy), com a proteção se ela disser.`
- Na descrição da ferramenta `buscar`, troque `preventives (consultas e exames preventivos).` por `preventives (consultas e exames preventivos), intimacy (relações sexuais).`

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test`
Expected: tudo passa. Se `tests/agent.test.mjs` conferir o texto antigo de "só é possível sugerir", atualize o teste para o texto novo.

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit.**

```bash
git add lib/types.ts lib/core.ts components/norte/catalog.ts lib/agent.ts lib/agent-runtime.ts tests/female-health.test.mjs
git commit -m "Registro de relação na Saúde feminina, com sugestão pelo assistente" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras do calendário (`cycleCalendar`)

**Files:**
- Modify: `lib/female-health.ts:37-43` (troca `forecastDays` pelas funções novas)
- Test: `tests/female-health.test.mjs` (remove o teste de `forecastDays` e acrescenta os novos)

**Interfaces:**
- Consumes: funções do próprio arquivo (`cycleStats`, `dailyStatus`, `injectionNext`, `addMonths`, `shiftDate`, `dayDiff`, `valid`, `until`) e o tipo `Phase`.
- Produces (exportados de `lib/female-health.ts`):
  - `type CalendarMethod`, a união dos três formatos abaixo;
  - `type CalendarDay`;
  - `type CalendarData = {periods:Item[];symptoms?:Item[];journal?:Item[];contraceptives?:Item[];contraceptiveDoses?:Item[];intimacy?:Item[]}`;
  - `cycleCalendar(s:CalendarData, from:string, to:string, today:string): CalendarDay[]`;
  - `durationLabel(days:number): string`;
  - `calendarMonth(month:'AAAA-MM'): {lead:number; days:string[]}`;
  - `shiftMonth(month:string, n:number): string`.

- [ ] **Step 1: Write the failing tests.** Em `tests/female-health.test.mjs`:
  1. Na linha 4, troque `forecastDays` por `cycleCalendar, durationLabel, calendarMonth, shiftMonth` no import de `../lib/female-health.ts`.
  2. Apague o teste `'calendário marca menstruação, janela fértil e ovulação'` inteiro (são 4 linhas e terminam em `forecastDays([],'2026-10-18',3)…`).
  3. Acrescente ao fim do arquivo. `pill` e `inj` já existem no topo; `per(date,endDate)` também.

```js
const cal=(s,from,to,today=T)=>cycleCalendar({periods:[],symptoms:[],journal:[],contraceptives:[],contraceptiveDoses:[],intimacy:[],...s},from,to,today);
const at=(days,date)=>days.find(d=>d.date===date);
const cycle3=[per('2026-08-20','2026-08-24'),{...per('2026-09-17','2026-09-21'),flow:'intenso'},per('2026-10-15')];
test('calendário: menstruação registrada, em andamento e prevista só depois de hoje',()=>{const days=cal({periods:cycle3},'2026-08-01','2026-12-31');
 assert.deepEqual(['2026-09-17','2026-09-21','2026-09-22','2026-10-18','2026-10-19','2026-10-20','2026-11-11','2026-11-12','2026-11-16','2026-11-17','2026-12-10'].map(d=>[at(days,d).period,at(days,d).periodDay??null]),
  [['logged',1],['logged',5],[null,null],['logged',4],['predicted',5],[null,null],[null,null],['predicted',1],['predicted',5],[null,null],['predicted',1]]);
 assert.equal(at(days,'2026-09-18').flow,'intenso');assert.equal(at(days,'2026-10-18').flow,undefined);});
test('calendário: menstruação sem fim usa a duração média e para na véspera do início seguinte',()=>{const days=cal({periods:[per('2026-09-01','2026-09-12'),per('2026-09-10')]},'2026-09-08','2026-09-11');
 assert.deepEqual(days.map(d=>[d.period,d.periodDay]),[['logged',8],['logged',9],['logged',1],['logged',2]]);});
test('calendário: dia do ciclo recomeça no início previsto e a ovulação usa o início seguinte',()=>{const days=cal({periods:cycle3},'2026-08-01','2026-12-31');
 assert.deepEqual(['2026-10-14','2026-10-18','2026-11-11','2026-11-12','2026-11-13'].map(d=>at(days,d).cycleDay),[28,4,28,1,2]);
 const mark=d=>at(days,d).ovulation?'ovulação':at(days,d).fertile?'fértil':null;
 assert.deepEqual(['2026-08-28','2026-08-29','2026-09-02','2026-09-03','2026-09-04','2026-09-05','2026-10-01','2026-10-24','2026-10-29','2026-10-30','2026-10-31','2026-11-26'].map(mark),[null,'fértil','fértil','ovulação','fértil',null,'ovulação','fértil','ovulação','fértil',null,'ovulação']);
 assert.deepEqual(['2026-10-18','2026-10-22','2026-10-28','2026-10-29','2026-10-31','2026-10-14','2026-11-12'].map(d=>at(days,d).phase),['menstrual','folicular','ovulatória','ovulatória','lútea','lútea','menstrual']);});
test('calendário: antes da primeira menstruação não há ciclo nem previsão; início futuro digitado não conta',()=>{const days=cal({periods:[...cycle3,per('2026-11-01')]},'2026-08-15','2026-11-01');
 assert.deepEqual(at(days,'2026-08-19'),{date:'2026-08-19',cycleDay:null,period:null,fertile:false,ovulation:false,phase:null,symptoms:[],methods:[]});
 assert.equal(at(days,'2026-11-01').period,null);assert.equal(at(days,'2026-11-01').cycleDay,18);
 assert.equal(cal({},'2026-10-18','2026-10-18')[0].cycleDay,null);});
test('calendário: atraso não pinta o ciclo atrasado, aparece em hoje e o ciclo seguinte continua',()=>{const days=cal({periods:[per('2026-08-20','2026-08-24'),per('2026-09-17','2026-09-21')]},'2026-10-10','2026-11-20');
 assert.equal(at(days,'2026-10-18').late,3);assert.equal(at(days,'2026-10-17').late,undefined);
 assert.deepEqual(['2026-10-15','2026-10-18','2026-10-19','2026-11-12'].map(d=>at(days,d).period),[null,null,null,'predicted']);
 assert.deepEqual(['2026-10-18','2026-10-19','2026-11-12'].map(d=>at(days,d).cycleDay),[32,33,1]);
 assert.equal(at(days,'2026-10-18').phase,'lútea');assert.equal(at(days,'2026-10-29').ovulation,true);});
test('calendário: menstruação prevista para hoje pinta a partir de hoje e hoje é o dia 1',()=>{const days=cal({periods:[per('2026-09-20','2026-09-24')]},'2026-10-17','2026-10-23');
 assert.deepEqual(days.map(d=>d.period),[null,'predicted','predicted','predicted','predicted','predicted',null]);
 assert.equal(at(days,'2026-10-18').cycleDay,1);assert.equal(at(days,'2026-10-17').cycleDay,28);assert.equal(at(days,'2026-10-18').late,undefined);});
test('calendário: humor dos sintomas ou do Diário, sintomas, anotações e relação',()=>{const days=cal({symptoms:[{id:'s1',title:'S',date:'2026-10-18',mood:2,symptoms:['Cólica'],notes:'Dia pesado'}],journal:[{id:'j1',title:'D',date:'2026-10-18',mood:5},{id:'j2',title:'D',date:'2026-10-17',mood:4}],intimacy:[{id:'r1',title:'Relação',date:'2026-10-12',protection:'com'},{id:'r2',title:'Relação',date:'2026-10-09',notes:'Viagem'}]},'2026-10-09','2026-10-18');
 assert.deepEqual([at(days,'2026-10-18').mood,at(days,'2026-10-18').symptoms,at(days,'2026-10-18').notes],[2,['Cólica'],'Dia pesado']);
 assert.deepEqual([at(days,'2026-10-17').mood,at(days,'2026-10-17').symptoms],[4,[]]);assert.equal(at(days,'2026-10-16').mood,undefined);
 assert.deepEqual(at(days,'2026-10-12').intimacy,{protection:'com'});assert.deepEqual(at(days,'2026-10-09').intimacy,{notes:'Viagem'});assert.equal(at(days,'2026-10-10').intimacy,undefined);});
test('calendário: pílula, injeção e DIU ativos',()=>{const iud={id:'d1',title:'Mirena',method:'iud',startDate:'2025-01-10',changeDate:'2030-01-10',status:'active'},off={...pill,id:'m2',status:'paused'};
 const s={contraceptives:[pill,inj,iud,off],contraceptiveDoses:[{id:'x1',title:'Tomei',date:'2026-10-18',methodId:'m1'},{id:'x2',title:'Injeção',date:'2026-10-31',methodId:'i1'}]};
 const m=(date,id)=>cal(s,date,date)[0].methods.find(x=>x.id===id);
 assert.deepEqual(m('2026-10-18','m1'),{id:'m1',title:'Yasmin',method:'daily',taken:true,active:true,packDay:18});
 assert.deepEqual(m('2026-10-17','m1'),{id:'m1',title:'Yasmin',method:'daily',taken:false,active:true,packDay:17});
 assert.deepEqual(m('2026-10-23','m1'),{id:'m1',title:'Yasmin',method:'daily',taken:false,active:false,pauseUntil:'2026-10-28'});
 assert.equal(m('2026-09-30','m1'),undefined);assert.equal(m('2026-10-18','m2'),undefined);
 assert.deepEqual(m('2026-10-30','i1'),{id:'i1',title:'Depo',method:'injection',taken:false,due:true});
 assert.deepEqual(m('2026-10-31','i1'),{id:'i1',title:'Depo',method:'injection',taken:true,due:false});assert.equal(m('2026-10-29','i1'),undefined);
 assert.deepEqual(m('2030-01-05','d1'),{id:'d1',title:'Mirena',method:'iud',daysLeft:5,change:false});assert.deepEqual(m('2030-01-10','d1'),{id:'d1',title:'Mirena',method:'iud',daysLeft:0,change:true});assert.equal(m('2025-01-09','d1'),undefined);});
test('calendário aceita espaço antigo sem relações, Diário ou métodos',()=>{assert.equal(cycleCalendar({periods:cycle3},'2026-10-01','2026-10-31',T).length,31);});
test('prazo do DIU em anos, meses ou dias',()=>{assert.deepEqual([730,365,364,60,59,2,1,0].map(durationLabel),['2 anos','1 ano','12 meses','2 meses','59 dias','2 dias','1 dia','hoje']);});
test('mês do calendário começa na segunda-feira e atravessa anos',()=>{const oct=calendarMonth('2026-10');assert.deepEqual([oct.lead,oct.days.length,oct.days[0],oct.days[30]],[3,31,'2026-10-01','2026-10-31']);
 assert.deepEqual([calendarMonth('2026-02').lead,calendarMonth('2026-02').days.length,calendarMonth('2028-02').days.length],[6,28,29]);
 assert.deepEqual([shiftMonth('2026-12',1),shiftMonth('2027-01',-1),shiftMonth('2026-10',-12)],['2027-01','2026-12','2025-10']);});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs`
Expected: falha na importação (`does not provide an export named 'cycleCalendar'`).

- [ ] **Step 3: Implement.** Em `lib/female-health.ts`, troque o bloco do comentário `// Calendário: menstruação (em curso e previstas)…` e de `export function forecastDays(…){…}` (linhas 37 a 43) por:

```ts
// Calendário do ciclo: para cada data, menstruação registrada ou prevista, janela fértil, ovulação, dia do ciclo, fase e os registros do dia.
export type CalendarMethod=
 |{id:string;title:string;method:'daily';taken:boolean;active:boolean;packDay?:number;pauseUntil?:string}
 |{id:string;title:string;method:'injection';taken:boolean;due:boolean}
 |{id:string;title:string;method:'iud';daysLeft:number;change:boolean};
export type CalendarDay={date:string;cycleDay:number|null;period:'logged'|'predicted'|null;periodDay?:number;flow?:string;fertile:boolean;ovulation:boolean;phase:Phase|null;late?:number;mood?:number;symptoms:string[];notes?:string;methods:CalendarMethod[];intimacy?:{protection?:'com'|'sem';notes?:string}};
export type CalendarData={periods:Item[];symptoms?:Item[];journal?:Item[];contraceptives?:Item[];contraceptiveDoses?:Item[];intimacy?:Item[]};
const byDate=(list:Item[]|undefined)=>new Map((list||[]).filter(x=>valid(x.date)).map(x=>[x.date as string,x]));
const latest=(list:string[],date:string)=>{let found:string|undefined;for(const x of list)if(x<=date)found=x;return found;};
export function cycleCalendar(s:CalendarData,from:string,to:string,today:string):CalendarDay[]{
 const logged=until(s.periods,today).filter(p=>valid(p.date)).sort((a,b)=>a.date.localeCompare(b.date)),st=cycleStats(logged),starts=st.starts,last=starts[starts.length-1];
 const period=new Map<string,{period:'logged'|'predicted';periodDay:number;flow?:string}>(),projected:string[]=[];
 if(last){
  // Registrada até o fim informado (ou a duração média), parando na véspera do início seguinte; o que passa de hoje no último registro é previsão.
  for(const p of logged){const next=starts.find(x=>x>p.date),len=valid(p.endDate)&&p.endDate>=p.date?dayDiff(p.date,p.endDate)+1:st.periodLength;
   for(let i=0;i<len;i++){const date=shiftDate(p.date,i);if(next&&date>=next)break;
    if(date<=today)period.set(date,{period:'logged',periodDay:i+1,...(p.flow?{flow:p.flow}:{})});else if(p.date===last)period.set(date,{period:'predicted',periodDay:i+1});}}
  // Inícios projetados até 60 dias depois do fim: a ovulação dos últimos dias visíveis depende do início seguinte.
  for(let start=shiftDate(last,st.cycleLength),end=shiftDate(to,60);start<=end;start=shiftDate(start,st.cycleLength))projected.push(start);
  // Início projetado antes de hoje é atraso: não pinta, mas o ciclo seguinte continua a partir dele.
  for(const start of projected){if(start<today)continue;for(let i=0;i<st.periodLength;i++){const date=shiftDate(start,i);if(!period.has(date))period.set(date,{period:'predicted',periodDay:i+1});}}}
 // Ovulação 14 dias antes do início seguinte; janela fértil de 5 dias antes a 1 depois. Os ciclos atrasados entram na sequência.
 const seq=[...starts,...projected],ahead=[...starts,...projected.filter(x=>x>=today)],ovulations=new Set<string>(),fertile=new Set<string>();
 for(let i=1;i<seq.length;i++){const ov=shiftDate(seq[i],-14);ovulations.add(ov);for(const k of [-5,-4,-3,-2,-1,1])fertile.add(shiftDate(ov,k));}
 const late=projected[0]&&projected[0]<today?dayDiff(projected[0],today):0;
 const sym=byDate(s.symptoms),journal=byDate(s.journal),rel=byDate(s.intimacy),doses=s.contraceptiveDoses||[],methods=(s.contraceptives||[]).filter(m=>m.status==='active'&&valid(m.startDate));
 const out:CalendarDay[]=[];
 for(let date=from;date<=to;date=shiftDate(date,1)){
  // Antes de hoje, o ciclo é o dos inícios registrados; de hoje em diante, entram os inícios previstos.
  const start=latest(date<today?starts:ahead,date),next=start?seq.find(x=>x>start):undefined,ov=next?shiftDate(next,-14):undefined,p=period.get(date),marked=!!last&&date>=starts[0];
  const phase:Phase|null=!start?null:p?'menstrual':ov&&Math.abs(dayDiff(ov,date))<=1?'ovulatória':ov&&date<ov?'folicular':'lútea';
  const sr=sym.get(date),jr=journal.get(date),r=rel.get(date),mood=typeof sr?.mood==='number'?sr.mood:typeof jr?.mood==='number'?jr.mood:undefined,ms:CalendarMethod[]=[];
  for(const m of methods){if(date<m.startDate)continue;const taken=doses.some(d=>d.methodId===m.id&&d.date===date);
   if(m.method==='daily'){const ds=dailyStatus(m,date);ms.push({id:m.id,title:m.title,method:'daily',taken,active:ds.active,...(ds.active?{packDay:ds.packDay}:{}),...(ds.pauseUntil?{pauseUntil:ds.pauseUntil}:{})});}
   else if(m.method==='injection'){const due=!taken&&injectionNext(m,doses,date)===date;if(taken||due)ms.push({id:m.id,title:m.title,method:'injection',taken,due});}
   else if(m.method==='iud'&&valid(m.changeDate))ms.push({id:m.id,title:m.title,method:'iud',daysLeft:dayDiff(date,m.changeDate),change:date===m.changeDate});}
  out.push({date,cycleDay:start?dayDiff(start,date)+1:null,period:p?.period||null,...(p?{periodDay:p.periodDay}:{}),...(p?.flow?{flow:p.flow}:{}),
   fertile:marked&&fertile.has(date)&&!ovulations.has(date),ovulation:marked&&ovulations.has(date),phase,...(date===today&&late>0?{late}:{}),...(mood!==undefined?{mood}:{}),
   symptoms:Array.isArray(sr?.symptoms)?sr.symptoms:[],...(sr?.notes?{notes:sr.notes}:{}),methods:ms,
   ...(r?{intimacy:{...(r.protection==='com'||r.protection==='sem'?{protection:r.protection}:{}),...(r.notes?{notes:r.notes}:{})}}:{})});}
 return out;}
// Prazo do DIU no painel do dia: anos, depois meses, depois dias.
export function durationLabel(days:number){if(days>=365){const n=Math.floor(days/365);return n+(n===1?' ano':' anos');}if(days>=60)return Math.floor(days/30)+' meses';return days===0?'hoje':days===1?'1 dia':days+' dias';}
// Mês do calendário (AAAA-MM): espaços antes do dia 1 numa grade que começa na segunda-feira e as datas do mês.
export function calendarMonth(month:string){const first=month+'-01',lead=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7,days:string[]=[];for(let d=first;d.startsWith(month);d=shiftDate(d,1))days.push(d);return {lead,days};}
export const shiftMonth=(month:string,n:number)=>addMonths(month+'-01',n).slice(0,7);
```

`ForecastKind` fica sem uso: apague `export type ForecastKind=…` (linha 16), depois de confirmar com o Grep que ninguém mais o usa. `dailyStatus`, `injectionNext` e `addMonths` são `function` declaradas mais abaixo no arquivo, e o hoisting resolve isso.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `node --experimental-strip-types --test tests/female-health.test.mjs`
Expected: PASS, todos.

Run: `npm test` e `npm run typecheck`
Expected: verde.

O typecheck vai acusar `forecastDays` em `components/norte/female-health.tsx`. Nesta tarefa, para manter o build verde até a Tarefa 3:
- tire `forecastDays` do import;
- troque a linha `const days=forecastDays(a.state.periods,a.today,35);` por `const days:{date:string;kind:string|null}[]=[];`.

A Tarefa 3 apaga essa faixa inteira.

- [ ] **Step 5: Commit.**

```bash
git add lib/female-health.ts tests/female-health.test.mjs components/norte/female-health.tsx
git commit -m "Regras do calendário do ciclo: dia a dia, mês e prazo do DIU" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tela do calendário (mês, ano e painel do dia)

**Files:**
- Create: `components/norte/cycle-calendar.tsx`
- Modify: `components/norte/female-health.tsx` (`CyclePanel` e imports)
- Modify: `components/norte/health.tsx:5` (exporta `MOODS`)
- Modify: `app/globals.css` (remove as classes antigas da faixa e acrescenta as novas no fim)

**Interfaces:**
- Consumes:
  - da Tarefa 2: `cycleCalendar`, `calendarMonth`, `shiftMonth`, `durationLabel`, `FLOW_LABEL`, `type CalendarDay` e `type CalendarMethod`, de `@/lib/female-health`;
  - da Tarefa 1: `a.state.intimacy` e `a.edit('intimacy',…)`;
  - `useApp()`, de `./context`, com `state`, `today`, `edit` e `busy`;
  - `MOODS` (`{value,label,icon,color}[]`), de `./health`.
- Produces: `export function CycleCalendar()`, sem props.

- [ ] **Step 1: Export `MOODS`.** Em `components/norte/health.tsx`, troque `const MOODS=[` por `export const MOODS=[`.

- [ ] **Step 2: Create `components/norte/cycle-calendar.tsx`:**

```tsx
'use client';
import {useState} from 'react';import {ChevronLeft,ChevronRight,CircleHelp,Droplet,NotebookPen,Heart,Pill} from 'lucide-react';
import {useApp} from './context';import {MOODS} from './health';
import {cycleCalendar,calendarMonth,shiftMonth,durationLabel,FLOW_LABEL,type CalendarDay,type CalendarMethod} from '@/lib/female-health';
// Calendário da aba Ciclo: mês com o painel do dia e ano com 12 mini-meses. O que cada dia mostra vem de cycleCalendar.
const WEEK=['S','T','Q','Q','S','S','D'];
const fmt=(d:string,o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('pt-BR',{...o,timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const cap=(t:string)=>t.charAt(0).toUpperCase()+t.slice(1);
const monthTitle=(m:string)=>cap(fmt(m+'-01',{month:'long',year:'numeric'}));
const shortDate=(d:string)=>d.slice(8)+'/'+d.slice(5,7);
const plural=(n:number)=>n+(n===1?' dia':' dias');
const PHASE:Record<string,string>={menstrual:'Fase menstrual',folicular:'Fase folicular','ovulatória':'Fase ovulatória','lútea':'Fase lútea'};
// A menstruação vence na cor quando cai na janela fértil.
const tone=(d:CalendarDay)=>d.period==='logged'?'period':d.period==='predicted'?'predicted':d.ovulation?'ovulation':d.fertile?'fertile':'';
const usedMethod=(d:CalendarDay)=>d.methods.some(m=>m.method!=='iud'&&m.taken);
function methodText(m:CalendarMethod,date:string,today:string){
 if(m.method==='daily')return m.taken?'tomada':m.active?(date<=today?'não registrada':'dia '+m.packDay+' da cartela'):m.pauseUntil?'pausa até '+shortDate(m.pauseUntil):'';
 if(m.method==='injection')return m.taken?'aplicada':'prevista';
 return m.change?'troca prevista':m.daysLeft<0?'troca atrasada':'troca em '+durationLabel(m.daysLeft);}
function dayAria(d:CalendarDay){const mood=MOODS.find(x=>x.value===d.mood);
 return [fmt(d.date,{day:'numeric',month:'long'}),d.cycleDay!==null?'dia do ciclo '+d.cycleDay:'',d.period==='logged'?'menstruação registrada':d.period==='predicted'?'menstruação prevista':'',d.ovulation?'ovulação estimada':d.fertile?'janela fértil estimada':'',mood?'humor '+mood.label:'',d.symptoms.length?'sintomas':'',usedMethod(d)?'anticoncepcional':'',d.intimacy?'relação':''].filter(Boolean).join(', ');}

export function CycleCalendar(){const a=useApp();const [view,setView]=useState('mes'),[month,setMonth]=useState(a.today.slice(0,7)),[selected,setSelected]=useState(a.today),[legend,setLegend]=useState(false);
 const year=month.slice(0,4),{lead,days:dates}=calendarMonth(month);
 const days=view==='ano'?cycleCalendar(a.state,year+'-01-01',year+'-12-31',a.today):cycleCalendar(a.state,dates[0],dates[dates.length-1],a.today);
 const day=cycleCalendar(a.state,selected,selected,a.today)[0],away=view!=='mes'||month!==a.today.slice(0,7)||selected!==a.today;
 const step=(n:number)=>setMonth(shiftMonth(month,view==='ano'?12*n:n));
 return <section className="panel cycle-cal">
  <header className="cc-head">
   <div className="cc-nav"><button className="icon-button" aria-label={view==='ano'?'Ano anterior':'Mês anterior'} onClick={()=>step(-1)}><ChevronLeft size={18}/></button><h2>{view==='ano'?year:monthTitle(month)}</h2><button className="icon-button" aria-label={view==='ano'?'Próximo ano':'Próximo mês'} onClick={()=>step(1)}><ChevronRight size={18}/></button></div>
   <div className="cc-tools">{away&&<button className="button outline small" onClick={()=>{setView('mes');setMonth(a.today.slice(0,7));setSelected(a.today);}}>Hoje</button>}
    <div className="cc-switch" role="group" aria-label="Visão do calendário">{[['mes','Mês'],['ano','Ano']].map(([id,label])=><button key={id} className={view===id?'active':''} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</div>
    <button className="icon-button" aria-label="Legenda" aria-expanded={legend} onClick={()=>setLegend(!legend)}><CircleHelp size={18}/></button></div>
  </header>
  {legend&&<Legend/>}
  {!a.state.periods.some(p=>p.date<=a.today)&&<p className="cc-hint">Registre o início da última menstruação para ver as previsões.</p>}
  {view==='mes'?<><div className="cc-week" aria-hidden="true">{WEEK.map((w,i)=><span key={i}>{w}</span>)}</div>
   <div className="cc-grid">{Array.from({length:lead},(_,i)=><span key={'b'+i} className="cc-blank"/>)}{days.map(d=><DayCell key={d.date} d={d} today={a.today} selected={d.date===selected} onPick={setSelected}/>)}</div>
   {day&&<DayPanel d={day}/>}</>
  :<YearView year={year} days={days} today={a.today} onMonth={m=>{setMonth(m);setView('mes');}}/>}
 </section>;}

function DayCell({d,today,selected,onPick}:{d:CalendarDay;today:string;selected:boolean;onPick:(date:string)=>void}){const mood=MOODS.find(x=>x.value===d.mood),Mood=mood?.icon;
 return <button className={['cc-day',tone(d),d.date===today?'today':'',selected?'selected':''].filter(Boolean).join(' ')} aria-pressed={selected} aria-label={dayAria(d)} onClick={()=>onPick(d.date)}>
  <strong>{Number(d.date.slice(8))}</strong>{d.cycleDay!==null&&<small>{d.cycleDay}</small>}
  <span className="cc-marks">{Mood?<Mood size={11} color={mood?.color}/>:d.symptoms.length?<i className="cc-dot"/>:null}{usedMethod(d)&&<Pill size={11}/>}{d.intimacy&&<Heart size={11}/>}</span></button>;}

function DayPanel({d}:{d:CalendarDay}){const a=useApp();const mood=MOODS.find(x=>x.value===d.mood);
 const lines=[d.period==='logged'?'Menstruação · '+d.periodDay+'º dia'+(d.flow?' · fluxo '+(FLOW_LABEL[d.flow]||d.flow).toLowerCase():''):d.period==='predicted'?'Menstruação prevista · '+d.periodDay+'º dia':d.late?'Menstruação atrasada há '+plural(d.late):'',
  d.ovulation?'Ovulação estimada':d.fertile?'Janela fértil estimada':'',mood?'Humor: '+mood.label:'',d.symptoms.length?'Sintomas: '+d.symptoms.join(', '):'',d.notes||'',
  ...d.methods.map(m=>{const t=methodText(m,d.date,a.today);return t?m.title+': '+t:'';}),
  d.intimacy?(d.intimacy.protection==='com'?'Relação com proteção':d.intimacy.protection==='sem'?'Relação sem proteção':'Relação')+(d.intimacy.notes?' · '+d.intimacy.notes:''):''].filter(Boolean);
 // Botões só até hoje: não se registra menstruação, anotação ou relação no futuro.
 const past=d.date<=a.today,current=d.period==='logged'?a.state.periods.filter(p=>p.date<=d.date).sort((x,y)=>y.date.localeCompare(x.date))[0]:undefined;
 const sym=a.state.symptoms.find(x=>x.date===d.date),rel=a.state.intimacy.find(x=>x.date===d.date);
 return <div className="cc-panel"><header><h3>{cap(fmt(d.date,{weekday:'long',day:'numeric',month:'long'}))}</h3><div className="cc-pills">{d.cycleDay!==null&&<span className="pill">Dia do ciclo {d.cycleDay}</span>}{d.phase&&<span className="pill">{PHASE[d.phase]}</span>}</div></header>
  {lines.length?<ul>{lines.map((l,i)=><li key={i}>{l}</li>)}</ul>:<p className="cc-empty">Nada registrado neste dia.</p>}
  {past&&<div className="button-group">
   <button className="button outline small" disabled={a.busy} onClick={()=>current?a.edit('periods',current):a.edit('periods',undefined,{date:d.date,title:'Menstruação',flow:'moderado'})}><Droplet size={15}/>{current?'Editar menstruação':'Menstruação começou'}</button>
   <button className="button outline small" disabled={a.busy} onClick={()=>sym?a.edit('symptoms',sym):a.edit('symptoms',undefined,{date:d.date,title:'Sintomas do dia',symptoms:[]})}><NotebookPen size={15}/>Anotações</button>
   <button className="button outline small" disabled={a.busy} onClick={()=>rel?a.edit('intimacy',rel):a.edit('intimacy',undefined,{date:d.date,title:'Relação'})}><Heart size={15}/>Relação</button></div>}
 </div>;}

function Legend(){return <ul className="cc-legend">{[['period','Menstruação'],['predicted','Menstruação prevista'],['fertile','Janela fértil estimada'],['ovulation','Ovulação estimada']].map(([c,l])=><li key={c}><i className={'cc-swatch '+c}/>{l}</li>)}
 <li><i className="cc-dot"/>Humor ou sintomas</li><li><Pill size={12}/>Anticoncepcional</li><li><Heart size={12}/>Relação</li></ul>;}

function YearView({year,days,today,onMonth}:{year:string;days:CalendarDay[];today:string;onMonth:(m:string)=>void}){const map=new Map(days.map(d=>[d.date,d]));
 return <div className="cc-year">{Array.from({length:12},(_,i)=>{const m=year+'-'+String(i+1).padStart(2,'0'),{lead,days:dates}=calendarMonth(m);
  return <button key={m} className="cc-mini" aria-label={'Abrir '+monthTitle(m)} onClick={()=>onMonth(m)}><h3>{cap(fmt(m+'-01',{month:'long'}))}</h3>
   <div className="cc-mini-grid">{Array.from({length:lead},(_,k)=><i key={'b'+k} className="blank"/>)}{dates.map(date=>{const d=map.get(date);return <i key={date} className={[d?tone(d):'',date===today?'today':''].filter(Boolean).join(' ')}/>;})}</div></button>;})}</div>;}
```

- [ ] **Step 3: Use it in `CyclePanel`.** Em `components/norte/female-health.tsx`:
  - acrescente `import {CycleCalendar} from './cycle-calendar';` na linha 3, junto dos outros imports locais;
  - tire do import de `@/lib/female-health` qualquer resto de `forecastDays`;
  - apague a constante `weekday` (linha 10), que fica sem uso;
  - substitua o `CyclePanel` inteiro por:

```tsx
function CyclePanel(){const a=useApp();const c=cyclePrediction(a.state.periods,a.today);const periods=a.state.periods.slice().sort((x,y)=>x.date.localeCompare(y.date));const symptoms=a.state.symptoms.slice().sort((x,y)=>x.date.localeCompare(y.date));
 return <>
  <div className="button-group spaced"><button className="button primary" onClick={()=>newPeriod(a)}><Droplet size={16}/>Menstruação começou</button><button className="button outline" onClick={()=>newSymptoms(a)}><HeartPulse size={16}/>Registrar sintomas</button></div>
  {c&&<div className="stats-grid three female-stats"><Stat label="Duração média do ciclo" value={c.cycleLength+' dias'} foot={c.cycles?'Com base em '+c.cycles+(c.cycles===1?' ciclo':' ciclos'):'Padrão de 28 dias até registrar mais ciclos'}/><Stat label="Duração média da menstruação" value={c.periodLength+' dias'} foot="Registre o fim para melhorar a média"/><Stat label="Próxima menstruação" value={dayLabel(c.next)} foot={c.late?'Atrasada há '+plural(c.late):'Em '+plural(c.daysToNext)} accent={c.late>0}/></div>}
  <CycleCalendar/>
  <div className="section-action"><h2>Menstruações</h2></div>
  <Records collection="periods" items={periods} compact renderExtra={p=><p className="record-content">{[p.endDate?'Até '+dayLabel(p.endDate):'Sem data de fim',FLOW_LABEL[p.flow]||''].filter(Boolean).join(' · ')}</p>} emptyTitle="Nenhuma menstruação registrada" emptyText="Cada registro melhora a previsão do ciclo."/>
  <div className="section-action"><h2>Sintomas</h2></div>
  <Records collection="symptoms" items={symptoms} compact renderExtra={s=>s.symptoms?.length?<p className="record-content">{s.symptoms.join(', ')}</p>:null} emptyTitle="Nenhum sintoma registrado" emptyText="Anote como você se sente para perceber padrões ao longo do ciclo."/>
 </>;}
```

  (O `Empty` continua importado, porque `MethodsPanel` e `PreventivesPanel` o usam.)

- [ ] **Step 4: CSS.** Em `app/globals.css`:
  - apague as linhas cujas regras começam por `.cycle-legend`, `.cycle-calendar`, `.cycle-day` e `:root[data-theme=dark] .cycle-day.period` (hoje, as linhas 67 a 75; confira com o Grep que essas classes não aparecem em mais nenhum `.tsx`);
  - acrescente no fim do arquivo:

```css
.cc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px}.cc-nav{display:flex;align-items:center;gap:4px}.cc-nav h2{margin:0;font-size:17px;min-width:150px;text-align:center}.cc-tools{display:flex;align-items:center;gap:6px}
.cc-switch{display:inline-flex;padding:3px;border-radius:999px;background:var(--surface-2)}.cc-switch button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;padding:5px 12px;border-radius:999px;cursor:pointer}.cc-switch button.active{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.cc-hint{margin:0 0 10px;font-size:13px;color:var(--muted)}
.cc-week,.cc-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.cc-week span{font-size:11px;font-weight:600;color:var(--muted);text-align:center;padding-bottom:4px}.cc-blank{min-height:48px}
.cc-day{position:relative;min-width:0;min-height:48px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit;padding:6px 2px 4px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:2px;cursor:pointer}
.cc-day strong{font-size:15px;line-height:1}.cc-day small{position:absolute;top:3px;right:4px;font-size:9px;line-height:1;color:var(--muted)}.cc-marks{display:flex;align-items:center;justify-content:center;gap:2px;min-height:11px}.cc-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--muted)}
.cc-day.period{background:#f3d9d6;border-color:#e0a9a3}.cc-day.predicted{border:2px dashed #e0a9a3}.cc-day.fertile{background:var(--green-soft);border-color:var(--green)}.cc-day.ovulation{background:var(--green);border-color:var(--green);color:var(--surface)}.cc-day.ovulation small{color:var(--surface)}
.cc-day.today{outline:2px solid var(--gold);outline-offset:1px}.cc-day.selected{background:var(--text);border-color:var(--text);color:var(--surface)}.cc-day.selected small{color:var(--surface)}
:root[data-theme=dark] .cc-day.period{background:#4a2a28;border-color:#7a4540}:root[data-theme=dark] .cc-day.predicted{border-color:#7a4540}
.cc-legend{list-style:none;display:flex;flex-wrap:wrap;gap:8px 14px;margin:0 0 12px;padding:0;font-size:12px;color:var(--muted)}.cc-legend li{display:flex;align-items:center;gap:6px}.cc-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--border)}.cc-swatch.period{background:#f3d9d6;border-color:#e0a9a3}.cc-swatch.predicted{border:2px dashed #e0a9a3}.cc-swatch.fertile{background:var(--green-soft);border-color:var(--green)}.cc-swatch.ovulation{background:var(--green);border-color:var(--green)}
.cc-panel{margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}.cc-panel header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}.cc-panel h3{margin:0;font-size:16px}.cc-pills{display:flex;gap:6px;flex-wrap:wrap}.cc-panel ul{margin:0 0 12px;padding-left:18px;display:grid;gap:4px;font-size:14px}.cc-empty{margin:0 0 12px;color:var(--muted);font-size:14px}
.cc-year{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cc-mini{min-width:0;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font:inherit;text-align:left;padding:10px;cursor:pointer}.cc-mini h3{margin:0 0 6px;font-size:13px}
.cc-mini-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}.cc-mini-grid i{aspect-ratio:1;border-radius:3px;background:var(--surface-2)}.cc-mini-grid i.blank{visibility:hidden}.cc-mini-grid i.period{background:#e0a9a3}.cc-mini-grid i.predicted{background:transparent;box-shadow:inset 0 0 0 1px #e0a9a3}.cc-mini-grid i.fertile{background:var(--green-soft)}.cc-mini-grid i.ovulation{background:var(--green)}.cc-mini-grid i.today{outline:1.5px solid var(--gold)}
@media(min-width:900px){.cc-year{grid-template-columns:repeat(4,minmax(0,1fr))}.cc-day{min-height:62px}.cc-blank{min-height:62px}.cc-day strong{font-size:17px}}
```

- [ ] **Step 5: Verify.**

Run: `npm run typecheck`
Expected: sem erros.

Run: `npx eslint components/norte/cycle-calendar.tsx components/norte/female-health.tsx components/norte/health.tsx lib/female-health.ts`
Expected: sem erros nem avisos nesses arquivos.

Run: `npm test`
Expected: tudo verde.

Run: `npm run build`
Expected: build conclui.

- [ ] **Step 6: Commit.**

```bash
git add components/norte/cycle-calendar.tsx components/norte/female-health.tsx components/norte/health.tsx app/globals.css
git commit -m "Calendário do ciclo na aba Ciclo: mês, ano e painel do dia" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Conferência visual (feita pelo controlador, sem commit de código)

O app exige login do Clerk. Por isso, a conferência usa uma página temporária que monta o `CycleCalendar` com um contexto falso e dados de exemplo. A página é apagada no fim e nunca vai para commit.

- [ ] **Step 1: Preparar o ambiente.**
  - Copie `.env.local` da checkout principal para o worktree. Ele é ignorado pelo git; confira com `git check-ignore`.
  - Crie `app/dev-calendario/page.tsx`. É uma página `'use client'` que renderiza `<Context.Provider value={fake}><main className="content"><CycleCalendar/></main></Context.Provider>`. O `fake` é um `AppContext` com:
    - `state`: `emptyWorkspace('Ana')` com 3 menstruações (uma em andamento), sintomas com humor em alguns dias, um Diário, uma pílula ativa com usos, um DIU e duas relações;
    - `today`: `todayInZone()`;
    - `edit`: registra a chamada num `window.__edits`;
    - os demais campos com funções vazias.
  - Suba `npx next dev -p 5180` em segundo plano.

- [ ] **Step 2: Capturas com Playwright.** O script fica no scratchpad, importa o `playwright-core` do worktree e usa o Chrome em `C:/Program Files/Google/Chrome/Application/chrome.exe`. Ele:
  - abre `/dev-calendario` em 375×812 e em 1440×1000, nos temas claro e escuro (`document.documentElement.dataset.theme='dark'`);
  - tira capturas do mês, do painel com um dia passado selecionado, de um dia futuro (sem botões) e da visão Ano;
  - confere que `document.documentElement.scrollWidth <= innerWidth` no celular;
  - navega para o próximo mês, confere que o painel continua com o dia selecionado e que "Hoje" volta ao dia atual;
  - confere que tocar em "Relação" num dia passado chama `edit('intimacy', …)`.

- [ ] **Step 3: Revisar as capturas** (com o Read nas imagens) e corrigir o CSS ou o componente se algo estiver ilegível, cortado ou fora do lugar. Correções viram commit próprio.

- [ ] **Step 4: Limpar.** Pare o servidor, apague `app/dev-calendario/` e o `.env.local` copiado, e confira com `git status` que nada disso ficou no worktree.
