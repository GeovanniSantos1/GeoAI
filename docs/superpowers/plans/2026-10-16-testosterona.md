# Menu Testosterona — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o menu Testosterona (exames lidos pela IA com parecer, protocolo com aplicações e lembrete no Telegram, dicas) no GeoAI.

**Architecture:** Três coleções novas no workspace JSON de cada usuário (`labExams`, `trtProtocols`, `trtDoses`), validadas no `core`. Regras puras em `lib/testosterone.ts` (classificação, alertas, datas, lembrete). Casos de uso de exames em `lib/exam-service.ts` com dependências injetadas (banco, Vercel Blob privado, IA, cota), ligados pelas rotas `app/api/exams/**`. O lembrete diário é uma tarefa agendada da Vercel que chama `app/api/cron/trt-reminders`, e os botões voltam pelo webhook do Telegram que já existe.

**Tech Stack:** Next.js 16 (App Router), React 19, AI SDK 7 (`generateText` + `Output.object`) com `@ai-sdk/openai` (Responses API, `gpt-6-luna`), Drizzle + Neon Postgres, `@vercel/blob` 2.8.2 (store privado), Clerk, testes `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-10-16-testosterona-design.md`

## Global Constraints

- Textos de interface, mensagens de erro e documentação em português do Brasil.
- Arquivos em `lib/` importados pelos testes usam import relativo com extensão `.ts` e nenhuma sintaxe TypeScript que exija transformação (sem parameter properties, enums, namespaces, `satisfies`).
- A IA nunca sugere mudança de dose, nem começar, parar ou comprar hormônio ou outros medicamentos (inibidores de aromatase, hCG etc.); não diagnostica ("pode indicar", "vale conversar com seu médico").
- Aviso fixo na tela: "A IA ajuda a entender seus exames, mas não substitui seu médico."
- Arquivos: PDF, JPEG, PNG ou WEBP até 4 MB (`4*1024*1024` bytes), tipo conferido pelos primeiros bytes; caminho `exames/<userId>/<examId>-<aleatório>.<ext>`.
- Limites: 80 marcadores por exame; resumo do parecer até 1.500 caracteres; até 12 pontos e 8 dicas guardados (a IA é instruída a dar até 5 dicas).
- Cotas por usuário e dia (fuso do usuário): `exam_upload` 20, `exam_review` 40.
- Alertas fixos: hematócrito (`%`) ≥ 54; PSA acima da faixa; PSA em ng/mL com alta maior que 1,4 sobre o menor valor dos exames revisados nos 365 dias anteriores. O parecer final usa o maior entre código e IA (`ok` < `attention` < `doctor`).
- Lembrete: do dia previsto até 3 dias depois, uma vez por dia, respeitando "Adiar 1 dia"; cron `0 11 * * *`; texto "Lembrete do GeoAI: hoje é dia da sua aplicação."
- Segredos nunca entram em arquivos do repositório; `CRON_SECRET` só como variável sensível na Vercel.
- Deploy por `git push` (o usuário roda `! git push origin main`) ou `vercel redeploy`; nunca `vercel deploy` a partir da pasta de trabalho.
- Não versionar `.claude/` nem `skills-lock.json`. Ao encerrar processos locais, usar só os PIDs iniciados nesta sessão.
- Estilo do código: o do repositório (linhas densas, comentários curtos em português só onde o motivo não é óbvio).

## Review Focus

1. Espaço salvo antes do menu existir (sem `labExams`, `trtProtocols`, `trtDoses`) precisa abrir, gravar e restaurar backup sem erro. Teste na Task 1.
2. Valores digitados com vírgula decimal, ponto de milhar ou ponto decimal ("0,85", "1.234,5", "0.85") precisam virar o número certo. Teste na Task 2.
3. Tocar "Apliquei" duas vezes, ou registrar no app e no Telegram no mesmo dia, não pode duplicar a aplicação: os dois caminhos usam `doseId`. Testes nas Tasks 2 e 11.
4. Pedir o arquivo de um exame com id de outra conta, ou com caminho forjado no próprio workspace, precisa dar 404. Teste na Task 5.
5. O item "Aplicação: ..." na agenda não pode abrir o editor nem excluir o protocolo. Teste da parte pura na Task 3 e verificação manual na Task 12.

---

### Task 1: Coleções novas, validação, comando `patch` e espaços antigos

**Files:**
- Create: `lib/exam-schema.ts`
- Modify: `lib/types.ts` (linha 1, `COLLECTIONS`)
- Modify: `lib/core.ts` (conjuntos de chaves, `validateItem`, `validateWorkspace`, `applyCommand`, nova `upgradeWorkspace`)
- Modify: `lib/workspace-server.ts` (`loadWorkspace`)
- Modify: `components/norte/catalog.ts` (`FIELDS`, `COLLECTION_LABELS`)
- Test: `tests/testosterone.test.mjs` (novo) e `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `MARKER_KEYS`, `type MarkerKey`, `type Marker = {key; label; value; qualifier?: '<'|'>'; unit?; refMin?; refMax?}`, `OVERALLS = ['ok','attention','doctor']`, `type Overall`, `type ExamReview`, `FILE_TYPES`, `type FileType`, `type ExamFile`, `MAX_FILE_BYTES`, `cleanMarkers(raw): Marker[]`, `cleanReview(raw): ExamReview`, `cleanFile(raw): ExamFile` em `lib/exam-schema.ts`.
  - `upgradeWorkspace<T>(raw: T): T` em `lib/core.ts`.
  - Comando `{type:'patch', collection, id, item}`: mescla `item` no registro atual, valida e incrementa `_rev`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/testosterone.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, validateItem, validateWorkspace, applyCommand, upgradeWorkspace } from '../lib/core.ts';

const protocol={id:'p1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-09-01',status:'active',remind:true};

test('valida exames com marcadores, parecer e arquivo',()=>{const e=validateItem('labExams',{title:'Exame de 02/10/2026',date:'2026-10-02',markers:[{key:'testosterona_total',label:'Testosterona total',value:312,unit:'ng/dL',refMin:249,refMax:836},{key:'xyz',label:'Ferritina',value:80}],file:{path:'exames/user_1/e1-ab.pdf',name:'laudo.pdf',type:'application/pdf',size:1200},review:{overall:'ok',summary:'Tudo certo.',points:[],tips:['Durma bem.'],reviewedAt:'2026-10-02T10:00:00Z',model:'gpt-6-luna'}});assert.equal(e.status,'draft');assert.equal(e.markers[1].key,'outro');assert.equal(e.file.path,'exames/user_1/e1-ab.pdf');assert.equal(e.review.tips[0],'Durma bem.');});
test('recusa marcadores, arquivos e pareceres inválidos',()=>{
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',markers:[{key:'psa_total',label:'PSA',value:'alto'}]}),/Valor inválido/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',markers:[{key:'psa_total',label:'PSA',value:1,refMin:5,refMax:2}]}),/Faixa invertida/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',markers:Array.from({length:81},(_,i)=>({key:'outro',label:'M'+i,value:1}))}),/até 80/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',file:{path:'../outro/x.pdf',name:'x.pdf',type:'application/pdf',size:10}}),/Arquivo inválido/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',file:{path:'exames/u/x.exe',name:'x.exe',type:'application/x-msdownload',size:10}}),/Tipo de arquivo/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',review:{overall:'great',summary:'x',points:[],tips:[],reviewedAt:'2026-10-02T10:00:00Z',model:'m'}}),/Situação do parecer/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',status:'final'}),/Situação do exame/);
 assert.throws(()=>validateItem('labExams',{title:'E'}),/data/);});
test('valida protocolos e aplicações',()=>{const p=validateItem('trtProtocols',{...protocol,unit:undefined,status:undefined});assert.equal(p.unit,'mg');assert.equal(p.status,'active');assert.equal(p.remind,true);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,intervalDays:0}),/intervalo/);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,dose:0}),/dose/);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,remind:'sim'}),/inválido/);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,startDate:undefined}),/início/);
 assert.equal(validateItem('trtDoses',{title:'Aplicação',date:'2026-10-02',protocolId:'p1',dose:250,site:'Glúteo'}).site,'Glúteo');
 assert.throws(()=>validateItem('trtDoses',{title:'Aplicação',date:'2026-10-02'}),/protocolo/);});
test('patch altera só os campos enviados e incrementa a revisão',()=>{let s=emptyWorkspace('Geo');s=applyCommand(s,{type:'upsert',collection:'trtProtocols',item:protocol},'2026-10-16');s=applyCommand(s,{type:'patch',collection:'trtProtocols',id:'p1',item:{remindedOn:'2026-10-16'}},'2026-10-16');
 assert.equal(s.trtProtocols[0].remindedOn,'2026-10-16');assert.equal(s.trtProtocols[0].dose,250);assert.equal(s.trtProtocols[0]._rev,2);
 assert.throws(()=>applyCommand(s,{type:'patch',collection:'trtProtocols',id:'nao',item:{}},'2026-10-16'),/não encontrado/);
 assert.throws(()=>applyCommand(s,{type:'patch',collection:'trtProtocols',id:'p1',item:{intervalDays:500}},'2026-10-16'),/intervalo/);});
test('espaços antigos sem as coleções novas carregam e restauram',()=>{const old=emptyWorkspace('Geo');delete old.labExams;delete old.trtProtocols;delete old.trtDoses;
 const up=upgradeWorkspace(structuredClone(old));assert.deepEqual([up.labExams,up.trtProtocols,up.trtDoses],[[],[],[]]);
 assert.deepEqual(validateWorkspace(structuredClone(old)).trtDoses,[]);
 const broken=emptyWorkspace('Geo');delete broken.tasks;assert.throws(()=>validateWorkspace(broken),/Backup não reconhecido/);});
```

Em `package.json`, trocar o script `test` por:

```json
"test": "node --experimental-strip-types --test tests/domain.test.mjs tests/calendar.test.mjs tests/agent.test.mjs tests/telegram.test.mjs tests/testosterone.test.mjs",
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL em `tests/testosterone.test.mjs` (`upgradeWorkspace` não existe / `Registro inválido` para `labExams`).

- [ ] **Step 3: Criar `lib/exam-schema.ts`**

```ts
// Formato dos exames do menu Testosterona guardados no workspace. Sem dependências: usado pelo core e pelas regras do menu.
export const MARKER_KEYS=['testosterona_total','testosterona_livre','testosterona_biodisponivel','shbg','estradiol','lh','fsh','prolactina','hematocrito','hemoglobina','psa_total','psa_livre','vitamina_d','tsh','t4_livre','glicemia','hba1c','colesterol_total','hdl','ldl','triglicerides','tgo','tgp','creatinina','outro'] as const;
export type MarkerKey=typeof MARKER_KEYS[number];
export type Marker={key:MarkerKey;label:string;value:number;qualifier?:'<'|'>';unit?:string;refMin?:number;refMax?:number};
export const OVERALLS=['ok','attention','doctor'] as const;
export type Overall=typeof OVERALLS[number];
export type ExamReview={overall:Overall;summary:string;points:{marker:string;text:string}[];tips:string[];reviewedAt:string;model:string};
export const FILE_TYPES=['application/pdf','image/jpeg','image/png','image/webp'] as const;
export type FileType=typeof FILE_TYPES[number];
export type ExamFile={path:string;name:string;type:FileType;size:number};
export const MAX_FILE_BYTES=4*1024*1024;
const blank=(v:unknown)=>v===undefined||v===null||v==='';
const text=(v:unknown,max:number,field:string)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error('Campo inválido: '+field);return v.trim();};
const num=(v:unknown,field:string)=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e9)throw new Error('Valor inválido: '+field);return v;};
const record=(v:unknown,message:string)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(message);return v as Record<string,unknown>;};
export function cleanMarkers(raw:unknown):Marker[]{
 if(!Array.isArray(raw)||raw.length>80)throw new Error('Informe até 80 marcadores');
 return raw.map((entry,i)=>{const r=record(entry,'Marcador inválido');const label=text(r.label,80,'marcador '+(i+1));
  const m:Marker={key:(MARKER_KEYS as readonly unknown[]).includes(r.key)?r.key as MarkerKey:'outro',label,value:num(r.value,'valor de '+label)};
  if(r.qualifier==='<'||r.qualifier==='>')m.qualifier=r.qualifier;
  if(!blank(r.unit))m.unit=text(r.unit,30,'unidade de '+label);
  if(!blank(r.refMin))m.refMin=num(r.refMin,'faixa mínima de '+label);
  if(!blank(r.refMax))m.refMax=num(r.refMax,'faixa máxima de '+label);
  if(m.refMin!==undefined&&m.refMax!==undefined&&m.refMin>m.refMax)throw new Error('Faixa invertida em '+label);
  return m;});
}
export function cleanReview(raw:unknown):ExamReview{
 const r=record(raw,'Parecer inválido');
 if(!(OVERALLS as readonly unknown[]).includes(r.overall))throw new Error('Situação do parecer inválida');
 const points=Array.isArray(r.points)?r.points:[],tips=Array.isArray(r.tips)?r.tips:[];
 if(points.length>12||tips.length>8)throw new Error('Parecer muito longo');
 return {overall:r.overall as Overall,summary:text(r.summary,1500,'resumo do parecer'),points:points.map(p=>{const q=record(p,'Ponto do parecer inválido');return {marker:text(q.marker,80,'ponto do parecer'),text:text(q.text,600,'ponto do parecer')};}),tips:tips.map(t=>text(t,300,'dica')),reviewedAt:text(r.reviewedAt,40,'data do parecer'),model:text(r.model,80,'modelo')};
}
export function cleanFile(raw:unknown):ExamFile{
 const r=record(raw,'Arquivo inválido');const path=text(r.path,300,'arquivo');
 if(!/^exames\/[\w-]+\/[\w.-]+$/.test(path)||path.includes('..'))throw new Error('Arquivo inválido');
 if(!(FILE_TYPES as readonly unknown[]).includes(r.type))throw new Error('Tipo de arquivo não aceito');
 const size=num(r.size,'tamanho do arquivo');if(!Number.isInteger(size)||size<1||size>MAX_FILE_BYTES)throw new Error('Arquivo muito grande');
 return {path,name:text(r.name,200,'nome do arquivo'),type:r.type as FileType,size};
}
```

- [ ] **Step 4: Registrar as coleções e a validação**

`lib/types.ts` linha 1: acrescentar `'labExams','trtProtocols','trtDoses'` ao fim de `COLLECTIONS` (antes de `] as const`).

`lib/core.ts`:

1. Linha 2, acrescentar o import: `import { cleanMarkers, cleanReview, cleanFile } from './exam-schema.ts';`
2. Logo depois da linha `VALID_KEYS.add('appliedPages');NUMBERS.add('appliedPages');`, acrescentar:

```ts
for(const key of ['lab','markers','file','review','createdOn','dose','intervalDays','doctor','remind','remindedOn','snoozedUntil','protocolId','site'])VALID_KEYS.add(key);NUMBERS.add('dose');NUMBERS.add('intervalDays');for(const key of ['createdOn','remindedOn','snoozedUntil'])DATES.add(key);
// Coleções criadas depois do lançamento: espaços e backups antigos ganham a lista vazia.
const ADDED_COLLECTIONS=['labExams','trtProtocols','trtDoses'];
export function upgradeWorkspace<T>(raw:T):T{if(raw&&typeof raw==='object'){const s=raw as Record<string,unknown>;for(const key of ADDED_COLLECTIONS)if(s[key]===undefined)s[key]=[];}return raw;}
```

3. Em `validateItem`, trocar
`  else if(key==='checked'){if(typeof value!=='boolean')throw new Error('Campo de conclusão inválido');item[key]=value;}`
por

```ts
  else if(key==='checked'||key==='remind'){if(typeof value!=='boolean')throw new Error('Campo de conclusão inválido');item[key]=value;}
  else if(key==='markers')item[key]=cleanMarkers(value);
  else if(key==='review')item[key]=cleanReview(value);
  else if(key==='file')item[key]=cleanFile(value);
```

4. Na linha que exige data (`if(['tasks','transactions','journal',...].includes(collection)&&!item.date)`), acrescentar `'labExams','trtDoses'` à lista.
5. Antes de `if(item.repeatUntil&&item.date&&item.repeatUntil<item.date)`, acrescentar:

```ts
 if(collection==='labExams'){item.status??='draft';if(!['draft','reviewed'].includes(item.status))throw new Error('Situação do exame inválida');item.markers??=[];}
 if(collection==='trtProtocols'){if(!item.startDate)throw new Error('Informe o início do protocolo');if(!(item.dose>0))throw new Error('Informe a dose');if(!Number.isInteger(item.intervalDays)||item.intervalDays<1||item.intervalDays>90)throw new Error('Informe o intervalo entre 1 e 90 dias');item.unit??='mg';if(!['mg','mL','g'].includes(item.unit))throw new Error('Unidade inválida');item.status??='active';if(!['active','paused'].includes(item.status))throw new Error('Situação do protocolo inválida');}
 if(collection==='trtDoses'){if(typeof item.protocolId!=='string'||!/^[\w-]{1,100}$/.test(item.protocolId))throw new Error('Escolha o protocolo');if(item.dose!==undefined&&!(item.dose>0))throw new Error('Dose inválida');}
```

6. Primeira linha de `validateWorkspace`: antes do `if(!raw||...` acrescentar `raw=upgradeWorkspace(raw&&typeof raw==='object'?{...raw}:raw);`
7. Em `applyCommand`, logo antes de `}else if(command.type==='toggleTask'){`, acrescentar:

```ts
 }else if(command.type==='patch'){
  const col=command.collection as Collection;if(!(COLLECTIONS as readonly string[]).includes(col))throw new Error('Coleção inválida');const current=get(col,command.id);
  if(!command.item||typeof command.item!=='object')throw new Error('Alteração inválida');
  const item=validateItem(col,{...current,...command.item,id:current.id});item._rev=(current._rev||0)+1;s[col]=s[col].map(x=>x.id===current.id?item:x);
```

`lib/workspace-server.ts`: importar `upgradeWorkspace` de `./core` e, em `loadWorkspace`, trocar `state:JSON.parse(row.data) as Workspace` por `state:upgradeWorkspace(JSON.parse(row.data)) as Workspace`.

`components/norte/catalog.ts`, dentro de `FIELDS` (depois de `focusSessions:[...]`):

```ts
labExams:[],
trtProtocols:[{...title,label:'Medicamento',hint:'Ex.: Durateston, Deposteron, Nebido, testosterona gel'},{key:'dose',label:'Dose',type:'number',step:'0.1',min:0,required:true},{key:'unit',label:'Unidade',type:'select',options:[['mg','mg'],['mL','mL'],['g','g']],default:'mg'},{key:'intervalDays',label:'Intervalo entre aplicações (dias)',type:'number',min:1,max:90,required:true,default:14},{key:'startDate',label:'Início',type:'date',required:true},{key:'doctor',label:'Médico responsável'},{key:'status',label:'Situação',type:'select',options:[['active','Ativo'],['paused','Pausado']],default:'active'},{key:'remind',label:'Lembrar no Telegram',type:'checkbox',default:true},notes],
trtDoses:[{...title,label:'Registro'},date,{key:'protocolId',label:'Protocolo',type:'select',source:'trtProtocols',required:true},{key:'dose',label:'Dose',type:'number',step:'0.1',min:0},{key:'site',label:'Local',type:'select',options:[['','Não informado'],['Glúteo','Glúteo'],['Coxa','Coxa'],['Deltoide','Deltoide'],['Abdômen','Abdômen'],['Outro','Outro']]},{...notes,label:'Como você se sentiu?'}]
```

Em `COLLECTION_LABELS`, acrescentar `labExams:'Novo exame',trtProtocols:'Novo protocolo',trtDoses:'Registrar aplicação'`.

Observação: a especificação fala em "medicamento: Durateston, Deposteron, Nebido, gel ou outro". O campo fica como texto com esses exemplos na dica, para aceitar qualquer nome sem perder o "Outro".

- [ ] **Step 5: Rodar os testes e a checagem de tipos**

Run: `npm test && npm run typecheck`
Expected: todos os testes passam (os 45 antigos e os 5 novos); `tsc` sem erros.

- [ ] **Step 6: Commit**

```bash
git add lib/exam-schema.ts lib/types.ts lib/core.ts lib/workspace-server.ts components/norte/catalog.ts tests/testosterone.test.mjs package.json
git commit -m "Coleções de exames, protocolos e aplicações de testosterona"
```

---

### Task 2: Regras puras do menu (`lib/testosterone.ts`)

**Files:**
- Create: `lib/testosterone.ts`
- Modify: `lib/core.ts` (nova `nextApplicationDate`, antes de `scheduledItems`)
- Test: `tests/testosterone.test.mjs`

**Interfaces:**
- Consumes: `Marker`, `Overall`, `OVERALLS`, `FileType` (Task 1).
- Produces (em `lib/testosterone.ts`): `type MarkerStatus = 'low'|'normal'|'high'|'none'`; `STATUS_LABEL`, `OVERALL_LABEL`, `MARKER_LABEL`, `FILE_EXT`; `examPrefix(userId)`; `doseId(protocolId, date)` → `'dose-<protocolId>-<date>'`; `examTitle(date)`; `daysBetween(from, to)`; `classifyMarker(m)`; `rangeText(m)`; `valueText(m)`; `parseDecimal(raw)`; `criticalFlags(exam, history)`; `codeOverall(markers, flags)`; `mergeOverall(a, b)`; `examHistory(exam, all)`; `finalOverall(exam, all)`; `protocolStatus(protocol, doses, today)` → `{next, daysLeft, overdue}`; `punctuality(protocol, doses, today)` → `number|null`; `cycleDay(protocol, doses, date)` → `number|null`; `dueReminder(protocol, doses, today)`; `guardStateCommand(command, userId)`; `detectFileType(bytes)` → `FileType|null`; `reviewContext(exam, state)` → `{text, flags, codeOverall}`.
- Produces (em `lib/core.ts`): `nextApplicationDate(protocol, doses, before?)` → `string`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `tests/testosterone.test.mjs`:

```js
import { classifyMarker, criticalFlags, codeOverall, mergeOverall, finalOverall, parseDecimal, protocolStatus, punctuality, cycleDay, dueReminder, guardStateCommand, detectFileType, reviewContext, examTitle, doseId } from '../lib/testosterone.ts';
const m=(key,value,extra={})=>({key,label:key,value,...extra});

test('classifica pelo número e pela faixa do laudo',()=>{
 assert.equal(classifyMarker(m('testosterona_total',240,{refMin:249,refMax:836})),'low');
 assert.equal(classifyMarker(m('testosterona_total',900,{refMin:249,refMax:836})),'high');
 assert.equal(classifyMarker(m('testosterona_total',500,{refMin:249,refMax:836})),'normal');
 assert.equal(classifyMarker(m('outro',5)),'none');
 assert.equal(classifyMarker(m('psa_total',0.01,{qualifier:'<',refMax:4})),'normal');
 assert.equal(classifyMarker(m('vitamina_d',20,{qualifier:'<',refMin:20})),'low');
 assert.equal(classifyMarker(m('prolactina',30,{qualifier:'>',refMax:30})),'high');
 assert.equal(classifyMarker(m('vitamina_d',35,{refMin:30})),'normal');});
test('alertas críticos de hematócrito e PSA',()=>{
 assert.deepEqual(criticalFlags({date:'2026-10-02',markers:[m('hematocrito',53.9,{unit:'%'})]},[]),[]);
 assert.equal(criticalFlags({date:'2026-10-02',markers:[m('hematocrito',54,{unit:'%'})]},[]).length,1);
 assert.equal(criticalFlags({date:'2026-10-02',markers:[m('psa_total',4.5,{unit:'ng/mL',refMax:4})]},[]).length,1);
 const old=[{id:'a',title:'A',status:'reviewed',date:'2026-01-10',markers:[m('psa_total',0.8,{unit:'ng/mL'})]},{id:'b',title:'B',status:'reviewed',date:'2025-06-01',markers:[m('psa_total',0.1,{unit:'ng/mL'})]},{id:'c',title:'C',status:'draft',date:'2026-05-01',markers:[m('psa_total',0.2,{unit:'ng/mL'})]}];
 assert.match(criticalFlags({date:'2026-10-02',markers:[m('psa_total',2.3,{unit:'ng/mL',refMax:4})]},old)[0],/subiu 1,5/);
 assert.deepEqual(criticalFlags({date:'2026-10-02',markers:[m('psa_total',2.1,{unit:'ng/mL',refMax:4})]},old),[]);});
test('situação geral: o código define o piso e a IA não rebaixa',()=>{
 assert.equal(codeOverall([m('shbg',30,{refMin:10,refMax:57})],[]),'ok');
 assert.equal(codeOverall([m('estradiol',50,{refMin:11,refMax:44})],[]),'attention');
 assert.equal(codeOverall([],['x']),'doctor');
 assert.equal(mergeOverall('doctor','ok'),'doctor');assert.equal(mergeOverall('ok','attention'),'attention');
 const exam={id:'e',title:'E',date:'2026-10-02',status:'reviewed',markers:[m('hematocrito',55,{unit:'%',refMin:40,refMax:50})],review:{overall:'ok'}};
 assert.equal(finalOverall(exam,[exam]),'doctor');});
test('lê números no formato brasileiro e com ponto',()=>{assert.equal(parseDecimal('0,85'),0.85);assert.equal(parseDecimal('1.234,5'),1234.5);assert.equal(parseDecimal('0.85'),0.85);assert.equal(parseDecimal(' 312 '),312);assert.ok(Number.isNaN(parseDecimal('alto')));assert.ok(Number.isNaN(parseDecimal('')));});
test('próxima aplicação, atraso, pontualidade e dia do ciclo',()=>{
 const doses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-09-01'},{id:'d2',title:'A',protocolId:'p1',date:'2026-09-15'},{id:'d3',title:'A',protocolId:'p1',date:'2026-10-01'},{id:'x',title:'A',protocolId:'outro',date:'2026-10-10'}];
 assert.deepEqual(protocolStatus(protocol,[],'2026-08-25'),{next:'2026-09-01',daysLeft:7,overdue:0});
 assert.deepEqual(protocolStatus(protocol,doses,'2026-10-18'),{next:'2026-10-15',daysLeft:0,overdue:3});
 assert.equal(punctuality(protocol,doses,'2026-10-16'),50);
 assert.equal(punctuality(protocol,doses.slice(0,1),'2026-10-16'),null);
 assert.equal(cycleDay(protocol,doses,'2026-10-13'),12);assert.equal(cycleDay(protocol,[],'2026-10-13'),null);
 assert.equal(doseId('p1','2026-10-16'),'dose-p1-2026-10-16');});
test('lembrete: do dia previsto até 3 dias depois, uma vez por dia, com adiamento',()=>{
 const doses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-10-02'}];
 assert.equal(dueReminder(protocol,doses,'2026-10-15'),false);
 assert.equal(dueReminder(protocol,doses,'2026-10-16'),true);
 assert.equal(dueReminder(protocol,doses,'2026-10-19'),true);
 assert.equal(dueReminder(protocol,doses,'2026-10-20'),false);
 assert.equal(dueReminder({...protocol,remindedOn:'2026-10-16'},doses,'2026-10-16'),false);
 assert.equal(dueReminder({...protocol,snoozedUntil:'2026-10-17'},doses,'2026-10-16'),false);
 assert.equal(dueReminder({...protocol,snoozedUntil:'2026-10-17'},doses,'2026-10-17'),true);
 assert.equal(dueReminder({...protocol,status:'paused'},doses,'2026-10-16'),false);
 assert.equal(dueReminder({...protocol,remind:false},doses,'2026-10-16'),false);});
test('/api/state não altera exames e o backup perde arquivos de outra conta',()=>{
 assert.throws(()=>guardStateCommand({type:'upsert',collection:'labExams',item:{}},'user_1'),/menu Testosterona/);
 assert.throws(()=>guardStateCommand({type:'delete',collection:'labExams',id:'e'},'user_1'),/menu Testosterona/);
 assert.throws(()=>guardStateCommand({type:'patch',collection:'labExams',id:'e',item:{}},'user_1'),/menu Testosterona/);
 assert.throws(()=>guardStateCommand({type:'confirmPlan',items:[{collection:'labExams',item:{}}]},'user_1'),/menu Testosterona/);
 const cmd={type:'upsert',collection:'tasks',item:{title:'x'}};assert.equal(guardStateCommand(cmd,'user_1'),cmd);
 const state={labExams:[{id:'a',title:'A',file:{path:'exames/user_1/a.pdf'}},{id:'b',title:'B',file:{path:'exames/user_2/b.pdf'}},{id:'c',title:'C'}]};
 const out=guardStateCommand({type:'import',state},'user_1');assert.equal(out.state.labExams[0].file.path,'exames/user_1/a.pdf');assert.equal(out.state.labExams[1].file,undefined);assert.equal(out.state.labExams[2].id,'c');});
test('reconhece o tipo do arquivo pelo conteúdo',()=>{const b=s=>new Uint8Array([...s].map(c=>c.charCodeAt(0)));
 assert.equal(detectFileType(b('%PDF-1.4')),'application/pdf');assert.equal(detectFileType(new Uint8Array([0xff,0xd8,0xff,0xe0])),'image/jpeg');assert.equal(detectFileType(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d])),'image/png');assert.equal(detectFileType(b('RIFF0000WEBPVP8 ')),'image/webp');assert.equal(detectFileType(b('MZ\x90\x00')),null);});
test('contexto do parecer traz classificação, alertas, ciclo e histórico',()=>{
 const s={labExams:[{id:'old',title:'Antigo',date:'2026-04-01',status:'reviewed',markers:[m('testosterona_total',280,{unit:'ng/dL'})]}],trtProtocols:[protocol],trtDoses:[{id:'d',title:'A',protocolId:'p1',date:'2026-09-20'}]};
 const ctx=reviewContext({id:'new',date:'2026-10-02',markers:[m('testosterona_total',612,{unit:'ng/dL',refMin:249,refMax:836}),m('hematocrito',55,{unit:'%',refMin:40,refMax:50})]},s);
 assert.equal(ctx.codeOverall,'doctor');assert.match(ctx.text,/testosterona_total.*Normal/);assert.match(ctx.text,/12 dia\(s\) após a última aplicação/);assert.match(ctx.text,/Exame anterior \(2026-04-01\): testosterona_total 280 ng\/dL/);assert.match(ctx.text,/Hematócrito em 55%/);
 assert.equal(examTitle('2026-10-02'),'Exame de 02/10/2026');});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`Cannot find module '../lib/testosterone.ts'`).

- [ ] **Step 3: Implementar**

Em `lib/core.ts`, logo antes de `export function scheduledItems`:

```ts
// Próxima aplicação de um protocolo: última aplicação (antes de `before`, quando informado) + intervalo; sem aplicações, a data de início.
export function nextApplicationDate(protocol:Item,doses:Item[],before?:string):string{const last=doses.filter(d=>d.protocolId===protocol.id&&validDate(d.date)&&(!before||d.date<before)).map(d=>d.date as string).sort().pop();return last?addDays(last,protocol.intervalDays||0):protocol.startDate;}
```

Criar `lib/testosterone.ts`:

```ts
import {addDays,nextApplicationDate} from './core.ts';
import {OVERALLS,type FileType,type Marker,type Overall} from './exam-schema.ts';
import type {Item,Command,Workspace} from './types.ts';

// Regras do menu Testosterona. Quem classifica os valores é o código; a IA só lê o laudo e escreve o parecer.
export type MarkerStatus='low'|'normal'|'high'|'none';
type ExamLike={id:string;date:string;markers:Marker[]};
export const STATUS_LABEL:Record<MarkerStatus,string>={low:'Baixo',normal:'Normal',high:'Alto',none:'Sem referência'};
export const OVERALL_LABEL:Record<Overall,string>={ok:'Tudo dentro das faixas',attention:'Pontos de atenção',doctor:'Leve ao médico em breve'};
export const MARKER_LABEL:Record<string,string>={testosterona_total:'Testosterona total',testosterona_livre:'Testosterona livre',testosterona_biodisponivel:'Testosterona biodisponível',shbg:'SHBG',estradiol:'Estradiol',lh:'LH',fsh:'FSH',prolactina:'Prolactina',hematocrito:'Hematócrito',hemoglobina:'Hemoglobina',psa_total:'PSA total',psa_livre:'PSA livre',vitamina_d:'Vitamina D',tsh:'TSH',t4_livre:'T4 livre',glicemia:'Glicemia',hba1c:'Hemoglobina glicada',colesterol_total:'Colesterol total',hdl:'HDL',ldl:'LDL',triglicerides:'Triglicerídeos',tgo:'TGO',tgp:'TGP',creatinina:'Creatinina',outro:'Outro'};
export const FILE_EXT:Record<FileType,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export const examPrefix=(userId:string)=>'exames/'+userId+'/';
// Id fixo por protocolo e dia: tocar "Apliquei" de novo, ou marcar pelo app e pelo Telegram, não duplica a aplicação.
export const doseId=(protocolId:string,date:string)=>'dose-'+protocolId+'-'+date;
export const examTitle=(date:string)=>'Exame de '+date.split('-').reverse().join('/');
export const daysBetween=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
const fmt=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
const isNgMl=(unit?:string)=>(unit||'').replace(/\s/g,'').toLowerCase()==='ng/ml';
const find=(markers:Marker[]|undefined,key:string)=>(markers||[]).find(m=>m.key===key);

export function classifyMarker(m:Marker):MarkerStatus{
 if(m.refMin===undefined&&m.refMax===undefined)return 'none';
 if(m.refMin!==undefined&&(m.value<m.refMin||(m.qualifier==='<'&&m.value<=m.refMin)))return 'low';
 if(m.refMax!==undefined&&(m.value>m.refMax||(m.qualifier==='>'&&m.value>=m.refMax)))return 'high';
 return 'normal';
}
export const rangeText=(m:Marker)=>m.refMin!==undefined&&m.refMax!==undefined?fmt(m.refMin)+' a '+fmt(m.refMax):m.refMin!==undefined?'acima de '+fmt(m.refMin):m.refMax!==undefined?'até '+fmt(m.refMax):'sem faixa';
export const valueText=(m:Marker)=>(m.qualifier||'')+fmt(m.value)+(m.unit?' '+m.unit:'');
// Aceita o formato brasileiro (1.234,5) e o decimal com ponto (0.85).
export function parseDecimal(raw:string){const t=raw.trim().replace(/\s/g,'');if(!/^-?[\d.,]+$/.test(t))return NaN;return Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t);}

export function criticalFlags(exam:{date:string;markers:Marker[]},history:Item[]):string[]{
 const flags:string[]=[];
 const hct=find(exam.markers,'hematocrito');
 if(hct&&hct.unit?.trim()==='%'&&hct.value>=54)flags.push('Hematócrito em '+fmt(hct.value)+'%: a partir de 54% pede avaliação médica logo.');
 const psa=find(exam.markers,'psa_total');
 if(psa&&classifyMarker(psa)==='high')flags.push('PSA acima da faixa de referência do laudo.');
 else if(psa&&isNgMl(psa.unit)){const since=addDays(exam.date,-365);const previous=history.filter(h=>h.status==='reviewed'&&h.date>=since&&h.date<exam.date).map(h=>find(h.markers,'psa_total')).filter((x):x is Marker=>!!x&&isNgMl(x.unit));if(previous.length){const rise=psa.value-Math.min(...previous.map(x=>x.value));if(rise>1.4)flags.push('PSA subiu '+fmt(rise)+' ng/mL em menos de 12 meses.');}}
 return flags;
}
export const codeOverall=(markers:Marker[],flags:string[]):Overall=>flags.length?'doctor':markers.some(m=>['low','high'].includes(classifyMarker(m)))?'attention':'ok';
export const mergeOverall=(a:Overall,b:Overall):Overall=>OVERALLS[Math.max(OVERALLS.indexOf(a),OVERALLS.indexOf(b))];
export const examHistory=(exam:{id:string;date:string},all:Item[])=>all.filter(e=>e.id!==exam.id&&e.status==='reviewed'&&e.date<exam.date).sort((a,b)=>b.date.localeCompare(a.date));
export function finalOverall(exam:Item,all:Item[]):Overall{const e={id:exam.id,date:exam.date,markers:(exam.markers||[]) as Marker[]};const code=codeOverall(e.markers,criticalFlags(e,examHistory(e,all)));return exam.review?mergeOverall(code,exam.review.overall):code;}

export function protocolStatus(protocol:Item,doses:Item[],today:string){const next=nextApplicationDate(protocol,doses);const diff=daysBetween(today,next);return {next,daysLeft:Math.max(diff,0),overdue:Math.max(-diff,0)};}
export function punctuality(protocol:Item,doses:Item[],today:string):number|null{if(!protocol.intervalDays)return null;const since=addDays(today,-90);const dates=[...new Set(doses.filter(d=>d.protocolId===protocol.id&&d.date>=since&&d.date<=today).map(d=>d.date as string))].sort();if(dates.length<2)return null;let onTime=0;for(let i=1;i<dates.length;i++)if(Math.abs(daysBetween(dates[i-1],dates[i])-protocol.intervalDays)<=1)onTime++;return Math.round(onTime/(dates.length-1)*100);}
export function cycleDay(protocol:Item,doses:Item[],date:string):number|null{const last=doses.filter(d=>d.protocolId===protocol.id&&d.date<=date).map(d=>d.date as string).sort().pop();return last?daysBetween(last,date):null;}
// Lembra do dia previsto até 3 dias depois, uma vez por dia, respeitando o adiamento.
export function dueReminder(protocol:Item,doses:Item[],today:string){if(protocol.status!=='active'||!protocol.remind)return false;const next=nextApplicationDate(protocol,doses);if(!next||today<next||today>addDays(next,3)||protocol.remindedOn===today)return false;return !protocol.snoozedUntil||protocol.snoozedUntil<=today;}

// /api/state não altera exames: arquivo e parecer só mudam pelas rotas de exames, que cuidam do armazenamento.
export function guardStateCommand(command:Command,userId:string):Command{
 if(!command||typeof command!=='object')return command;
 const touchesExams=(['upsert','delete','patch'].includes(command.type)&&command.collection==='labExams')||(command.type==='confirmPlan'&&Array.isArray(command.items)&&command.items.some(p=>p?.collection==='labExams'));
 if(touchesExams)throw new Error('Use o menu Testosterona para alterar exames.');
 if(command.type==='import'&&command.state&&Array.isArray(command.state.labExams)){const prefix=examPrefix(userId);return {...command,state:{...command.state,labExams:command.state.labExams.map((e:Item)=>{if(!e?.file||(typeof e.file.path==='string'&&e.file.path.startsWith(prefix)))return e;const rest={...e};delete rest.file;return rest;})}};}
 return command;
}
export function detectFileType(bytes:Uint8Array):FileType|null{
 const ascii=(start:number,length:number)=>String.fromCharCode(...bytes.subarray(start,start+length));
 if(ascii(0,4)==='%PDF')return 'application/pdf';
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if(bytes[0]===0x89&&ascii(1,3)==='PNG')return 'image/png';
 if(ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP')return 'image/webp';
 return null;
}
export function reviewContext(exam:ExamLike,s:Pick<Workspace,'labExams'|'trtProtocols'|'trtDoses'>){
 const history=examHistory(exam,s.labExams),flags=criticalFlags(exam,history);
 const lines=['Exame colhido em '+exam.date+'.','Marcadores (valor | faixa do laudo | classificação do app):',...exam.markers.map(m=>'- '+m.label+' ['+m.key+']: '+valueText(m)+' | '+rangeText(m)+' | '+STATUS_LABEL[classifyMarker(m)])];
 lines.push(flags.length?'Alertas críticos (situação mínima: leve ao médico em breve):\n'+flags.map(f=>'- '+f).join('\n'):'Sem alertas críticos.');
 const active=s.trtProtocols.filter(p=>p.status==='active');
 if(!active.length)lines.push('Sem protocolo de reposição registrado.');
 for(const p of active){const day=cycleDay(p,s.trtDoses,exam.date);lines.push('Protocolo ativo: '+p.title+' '+p.dose+' '+(p.unit||'mg')+' a cada '+p.intervalDays+' dias, desde '+p.startDate+'.'+(day===null?'':' Exame colhido '+day+' dia(s) após a última aplicação.'));}
 const keys=new Set(exam.markers.map(m=>m.key).filter(k=>k!=='outro'));
 for(const h of history.slice(0,3)){const same=((h.markers||[]) as Marker[]).filter(x=>keys.has(x.key));if(same.length)lines.push('Exame anterior ('+h.date+'): '+same.map(x=>x.label+' '+valueText(x)).join('; '));}
 return {text:lines.join('\n'),flags,codeOverall:codeOverall(exam.markers,flags)};
}
```

- [ ] **Step 4: Rodar os testes e a checagem de tipos**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/testosterone.ts lib/core.ts tests/testosterone.test.mjs
git commit -m "Regras de classificação, alertas e datas do menu Testosterona"
```

---

### Task 3: Aplicações na agenda

**Files:**
- Modify: `lib/core.ts` (`scheduledItems`, `isComplete`)
- Modify: `components/norte/planning.tsx` (`TaskList`, `AgendaView`)
- Test: `tests/testosterone.test.mjs`

**Interfaces:**
- Consumes: `nextApplicationDate` (Task 2), `doseId` (Task 2).
- Produces: `scheduledItems` passa a incluir `{id: protocol.id, title: 'Aplicação: <medicamento>', type: 'event', section: 'testosterona', _collection: 'trtProtocols'}` no dia previsto; `isComplete` é verdadeiro quando há aplicação do protocolo naquele dia.

- [ ] **Step 1: Escrever o teste que falha**

No import de `../lib/core.ts` no topo de `tests/testosterone.test.mjs`, acrescentar `scheduledItems, isComplete`. Acrescentar ao fim:

```js
test('agenda mostra a aplicação prevista e marca como feita quando registrada',()=>{let s=emptyWorkspace('Geo');s.trtProtocols=[{...protocol}];
 assert.deepEqual(scheduledItems(s,'2026-09-01').map(x=>[x.title,x._collection,x.type]),[['Aplicação: Durateston','trtProtocols','event']]);
 assert.equal(scheduledItems(s,'2026-09-15').length,0);
 s.trtDoses=[{id:'d1',title:'Aplicação',protocolId:'p1',date:'2026-09-01'}];
 assert.equal(isComplete(s,scheduledItems(s,'2026-09-01')[0],'2026-09-01'),true);
 assert.equal(scheduledItems(s,'2026-09-15').length,1);assert.equal(isComplete(s,scheduledItems(s,'2026-09-15')[0],'2026-09-15'),false);
 s.trtProtocols[0].status='paused';assert.equal(scheduledItems(s,'2026-09-15').length,0);});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`scheduledItems` não traz a aplicação).

- [ ] **Step 3: Implementar no core**

Em `lib/core.ts`, substituir a função `scheduledItems` inteira por:

```ts
export function scheduledItems(s:Workspace,date:string):Item[]{
 // Aplicações de testosterona entram como compromissos calculados: não são salvas em tasks.
 const applications=s.trtProtocols.filter(p=>p.status==='active'&&nextApplicationDate(p,s.trtDoses,date)===date).map(p=>({id:p.id,title:'Aplicação: '+p.title,type:'event',section:'testosterona',_collection:'trtProtocols'}));
 return [...[...s.tasks.map(x=>({...x,_collection:'tasks'})),...s.chores.map(x=>({...x,_collection:'chores',type:'task',section:'casa'})),...s.activities.map(x=>({...x,_collection:'activities',type:'task',section:'estudos'}))].filter(x=>occursOn(x,date)),...applications];}
```

Em `isComplete`, antes do `;}` final, acrescentar `||(source==='trtProtocols'&&s.trtDoses.some(d=>d.protocolId===item.id&&d.date===date))`.

- [ ] **Step 4: Ajustar a lista da agenda**

Em `components/norte/planning.tsx`:

1. Na linha 3, trocar `import {useApp} from './context';` por `import {useApp,type AppContext} from './context';` e acrescentar ao fim da linha `import {doseId} from '@/lib/testosterone';`.
2. Logo depois da linha 4 (`const formatDate=...`), acrescentar:

```tsx
// Itens "Aplicação" da agenda vêm do protocolo: abrir leva ao menu Testosterona e marcar registra a aplicação do dia.
const openItem=(a:AppContext,t:Item)=>t._collection==='trtProtocols'?a.navigate('/testosterona'):a.edit(t._collection||'tasks',t);
function toggleItem(a:AppContext,t:Item,date:string,done:boolean){const source=t._collection||'tasks';
 if(source==='trtProtocols'){const p=a.state.trtProtocols.find(x=>x.id===t.id);const dose=a.state.trtDoses.find(d=>d.protocolId===t.id&&d.date===date);return done&&dose?a.mutate({type:'delete',collection:'trtDoses',id:dose.id}):a.mutate({type:'upsert',collection:'trtDoses',item:{id:doseId(t.id,date),title:'Aplicação: '+(p?.title||''),date,protocolId:t.id,...(p?.dose?{dose:p.dose}:{})}});}
 return a.mutate({type:source==='tasks'?'toggleTask':'toggleRecord',collection:source,id:t.id,date,done:!done});}
```

3. Substituir todas as ocorrências de `a.edit((t._collection||'tasks'),t)` por `openItem(a,t)` (três no arquivo: título da tarefa, `onEdit` e o chip da semana).
4. Substituir `onClick={()=>a.mutate({type:source==='tasks'?'toggleTask':'toggleRecord',collection:source,id:t.id,date,done:!done})}` por `onClick={()=>toggleItem(a,t,date,done)}`.
5. Substituir `<RecordActions item={t} onEdit={()=>openItem(a,t)} onDelete={()=>a.remove((t._collection||'tasks'),t)}/>` por `{source!=='trtProtocols'&&<RecordActions item={t} onEdit={()=>openItem(a,t)} onDelete={()=>a.remove((t._collection||'tasks'),t)}/>}`.

- [ ] **Step 5: Rodar testes, tipos e lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS, sem erros de lint.

- [ ] **Step 6: Commit**

```bash
git add lib/core.ts components/norte/planning.tsx tests/testosterone.test.mjs
git commit -m "Próxima aplicação de testosterona aparece na agenda"
```

---

### Task 4: Armazenamento de arquivos e cota diária

**Files:**
- Modify: `package.json`, `package-lock.json` (dependência `@vercel/blob`)
- Create: `lib/exam-files.ts`
- Modify: `db/schema.ts` (tabela `usage_counters`)
- Create: `drizzle/0001_*.sql` (gerado)
- Create: `lib/quota.ts`
- Test: `tests/exams.test.mjs` (novo) e `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `type StoredFile = {body: ReadableStream<Uint8Array>|Uint8Array; contentType: string}`
  - `type ExamFileStore = {save(path, data: Uint8Array, contentType): Promise<void>; read(path): Promise<StoredFile|null>; remove(paths: string[]): Promise<void>; removePrefix(prefix): Promise<void>}`
  - `memoryFileStore(): ExamFileStore`, `examFiles(): ExamFileStore|null` (`EXAM_FILES=memory` → memória; `BLOB_READ_WRITE_TOKEN` ou `BLOB_STORE_ID` → Blob; senão `null`).
  - `QUOTAS = {exam_upload: 20, exam_review: 40}`, `consumeQuota(userId, kind, day): Promise<boolean>`.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install @vercel/blob@2.8.2`
Expected: `package.json` com `"@vercel/blob": "^2.8.2"` em `dependencies`.

- [ ] **Step 2: Escrever o teste que falha**

Criar `tests/exams.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryFileStore } from '../lib/exam-files.ts';

test('armazenamento em memória guarda, lê e apaga por caminho e prefixo',async()=>{const f=memoryFileStore();const data=new Uint8Array([1,2,3]);
 await f.save('exames/u1/a.pdf',data,'application/pdf');await f.save('exames/u1/b.pdf',data,'application/pdf');await f.save('exames/u2/c.pdf',data,'application/pdf');
 assert.equal((await f.read('exames/u1/a.pdf')).contentType,'application/pdf');
 await f.remove(['exames/u1/a.pdf']);assert.equal(await f.read('exames/u1/a.pdf'),null);
 await f.removePrefix('exames/u1/');assert.equal(await f.read('exames/u1/b.pdf'),null);assert.ok(await f.read('exames/u2/c.pdf'));});
```

Acrescentar ` tests/exams.test.mjs` ao fim do script `test` em `package.json`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`Cannot find module '../lib/exam-files.ts'`).

- [ ] **Step 4: Implementar o armazenamento**

Criar `lib/exam-files.ts`:

```ts
import {put,get,del,list} from '@vercel/blob';
// Arquivos dos exames: Vercel Blob privado em produção; memória em testes e no desenvolvimento local (EXAM_FILES=memory).
export type StoredFile={body:ReadableStream<Uint8Array>|Uint8Array;contentType:string};
export type ExamFileStore={save(path:string,data:Uint8Array,contentType:string):Promise<void>;read(path:string):Promise<StoredFile|null>;remove(paths:string[]):Promise<void>;removePrefix(prefix:string):Promise<void>};
export function memoryFileStore():ExamFileStore{const files=new Map<string,StoredFile>();return {
 async save(path,data,contentType){files.set(path,{body:data,contentType});},
 async read(path){return files.get(path)||null;},
 async remove(paths){for(const p of paths)files.delete(p);},
 async removePrefix(prefix){for(const p of [...files.keys()])if(p.startsWith(prefix))files.delete(p);}};}
const blobStore:ExamFileStore={
 async save(path,data,contentType){await put(path,Buffer.from(data),{access:'private',contentType,addRandomSuffix:false});},
 async read(path){const r=await get(path,{access:'private'});return r&&r.statusCode===200?{body:r.stream,contentType:r.blob.contentType}:null;},
 async remove(paths){if(paths.length)await del(paths);},
 async removePrefix(prefix){let cursor:string|undefined;do{const page=await list({prefix,cursor,limit:1000});if(page.blobs.length)await del(page.blobs.map(b=>b.pathname));cursor=page.hasMore?page.cursor:undefined;}while(cursor);},
};
const cache=globalThis as unknown as {geoaiExamFiles?:ExamFileStore};
export function examFiles():ExamFileStore|null{if(process.env.EXAM_FILES==='memory')return cache.geoaiExamFiles??=memoryFileStore();return process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID?blobStore:null;}
```

- [ ] **Step 5: Tabela de cota e migração**

Em `db/schema.ts`, trocar o import por `import { pgTable, text, integer, bigint, primaryKey } from "drizzle-orm/pg-core";` e acrescentar ao fim:

```ts
// Usos por dia de recursos que custam IA (envio e parecer de exames). Excluir o exame não devolve a cota.
export const usageCounters=pgTable("usage_counters",{userId:text("user_id").notNull(),kind:text("kind").notNull(),day:text("day").notNull(),count:integer("count").notNull().default(0)},t=>[primaryKey({columns:[t.userId,t.kind,t.day]})]);
```

Run: `npm run db:generate`
Expected: novo arquivo `drizzle/0001_<nome>.sql` com `CREATE TABLE "usage_counters"` e `PRIMARY KEY("user_id","kind","day")`, além de `drizzle/meta/0001_snapshot.json` e `_journal.json` atualizado. Conferir o SQL com `cat drizzle/0001_*.sql`.

Criar `lib/quota.ts`:

```ts
import {sql} from 'drizzle-orm';import {getDb} from '@/db';import {usageCounters} from '@/db/schema';
export const QUOTAS={exam_upload:20,exam_review:40} as const;
// Conta um uso do dia e devolve false quando o limite já foi atingido; o incremento condicional evita corrida entre abas.
export async function consumeQuota(userId:string,kind:keyof typeof QUOTAS,day:string){const rows=await getDb().insert(usageCounters).values({userId,kind,day,count:1}).onConflictDoUpdate({target:[usageCounters.userId,usageCounters.kind,usageCounters.day],set:{count:sql`${usageCounters.count} + 1`},setWhere:sql`${usageCounters.count} < ${QUOTAS[kind]}`}).returning({count:usageCounters.count});return rows.length>0;}
```

- [ ] **Step 6: Rodar testes e tipos**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/exam-files.ts db/schema.ts drizzle lib/quota.ts tests/exams.test.mjs
git commit -m "Armazenamento privado dos exames e cota diária de uso da IA"
```

---

### Task 5: Casos de uso dos exames (`lib/exam-service.ts`)

**Files:**
- Create: `lib/exam-service.ts`
- Test: `tests/exams.test.mjs`

**Interfaces:**
- Consumes: `cleanMarkers`, `cleanReview`, `MAX_FILE_BYTES` (Task 1); `detectFileType`, `examPrefix`, `examTitle`, `FILE_EXT`, `mergeOverall`, `reviewContext` (Task 2); `ExamFileStore`, `StoredFile`, `memoryFileStore` (Task 4); `applyCommand`, `todayInZone`, `validDate` (core).
- Produces:
  - `type ExtractedExam = {date?: string|null; lab?: string|null; markers: unknown[]}`
  - `type ModelReview = {overall: Overall; summary: string; points: {marker: string; text: string}[]; tips: string[]; model: string}`
  - `type ExamDeps = {userId; load(): Promise<{state}>; mutate(command): Promise<{state; version}>; files: ExamFileStore|null; quota(kind: 'exam_upload'|'exam_review', day): Promise<boolean>; extract: ((file: {data; type; name}) => Promise<ExtractedExam>)|null; review: ((input: {text}) => Promise<ModelReview>)|null; now?: () => Date}`
  - `class ExamError extends Error {status: number}`, `UNREADABLE`, `REVIEW_UNAVAILABLE`
  - `createExamFromFile(d, {bytes, name})`, `createExamManual(d)`, `reviewExam(d, id, {date, lab, markers})` → `{state, version, exam, warning?}`; `deleteExam(d, id)` → `{state, version}`; `readExamFile(d, id)` → `StoredFile & {name}`.

Estes testes fazem o papel da "integração local" da especificação: o caminho inteiro (envio, leitura, conferência, parecer, arquivo de outra conta, exclusão) roda com workspace real (`applyCommand`) e armazenamento, IA e cota simulados em memória, sem depender de Clerk nem de Postgres. O SQL da cota e a chamada real ao modelo são verificados em produção na Task 12.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/exams.test.mjs`:

```js
import { emptyWorkspace, applyCommand } from '../lib/core.ts';
import { createExamFromFile, createExamManual, reviewExam, deleteExam, readExamFile, UNREADABLE, REVIEW_UNAVAILABLE } from '../lib/exam-service.ts';

const PDF=new TextEncoder().encode('%PDF-1.4 laudo');
function harness({userId='user_1',extract=async()=>({date:'2026-10-02',lab:'Lab Teste',markers:[{key:'testosterona_total',label:'Testosterona total',value:312,unit:'ng/dL',refMin:249,refMax:836},{key:'hematocrito',label:'Hematócrito',value:'x'}]}),review=async()=>({overall:'ok',summary:'Valores dentro das faixas.',points:[],tips:['Durma bem.'],model:'teste'}),quota=()=>true,files=memoryFileStore(),state=emptyWorkspace('Geo')}={}){
 const box={state,used:[]};
 const deps={userId,now:()=>new Date('2026-10-16T15:00:00Z'),files,extract,review,quota:async(kind,day)=>{box.used.push(kind+':'+day);return quota(kind);},load:async()=>({state:box.state}),mutate:async c=>{box.state=applyCommand(box.state,c,'2026-10-16');return {state:box.state,version:1};}};
 return {deps,box,files};}

test('envio guarda o arquivo, lê os valores e cria o rascunho',async()=>{const {deps,files,box}=harness();const r=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 assert.equal(r.exam.status,'draft');assert.equal(r.exam.date,'2026-10-02');assert.equal(r.exam.lab,'Lab Teste');assert.equal(r.exam.markers.length,1);assert.equal(r.warning,undefined);
 assert.match(r.exam.file.path,/^exames\/user_1\/[\w-]+\.pdf$/);assert.ok(await files.read(r.exam.file.path));assert.deepEqual(box.used,['exam_upload:2026-10-16']);});
test('laudo ilegível vira rascunho com arquivo e aviso',async()=>{const {deps}=harness({extract:async()=>{throw new Error('timeout');}});const r=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 assert.equal(r.warning,UNREADABLE);assert.deepEqual(r.exam.markers,[]);assert.equal(r.exam.date,'2026-10-16');assert.ok(r.exam.file);});
test('recusa tipo, tamanho, cota e armazenamento ausente',async()=>{
 await assert.rejects(createExamFromFile(harness().deps,{bytes:new TextEncoder().encode('MZ executável'),name:'x.pdf'}),{status:415});
 await assert.rejects(createExamFromFile(harness().deps,{bytes:new Uint8Array(4*1024*1024+1).fill(37),name:'x.pdf'}),{status:413});
 await assert.rejects(createExamFromFile(harness({quota:()=>false}).deps,{bytes:PDF,name:'x.pdf'}),{status:429});
 await assert.rejects(createExamFromFile(harness({files:null}).deps,{bytes:PDF,name:'x.pdf'}),{status:503});});
test('parecer usa os valores conferidos, nunca rebaixa a situação e respeita a cota',async()=>{const {deps,box}=harness();const {exam}=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 const r=await reviewExam(deps,exam.id,{date:'2026-10-02',lab:'',markers:[{key:'testosterona_total',label:'Testosterona total',value:312,unit:'ng/dL',refMin:249,refMax:836},{key:'hematocrito',label:'Hematócrito',value:55,unit:'%',refMin:40,refMax:50}]});
 assert.equal(r.exam.status,'reviewed');assert.equal(r.exam.review.overall,'doctor');assert.equal(r.exam.review.model,'teste');assert.equal(r.exam.lab,undefined);assert.equal(r.exam.markers[1].value,55);assert.ok(box.used.includes('exam_review:2026-10-16'));
 const limited=harness({quota:k=>k!=='exam_review',state:box.state});const again=await reviewExam(limited.deps,exam.id,{date:'2026-10-02',markers:[{key:'testosterona_total',label:'Testosterona total',value:300}]});
 assert.match(again.warning,/limite de pareceres/);assert.equal(again.exam.review,undefined);});
test('parecer indisponível salva a classificação e avisa; dados inválidos são recusados',async()=>{const {deps}=harness({review:async()=>{throw new Error('500');}});const {exam}=await createExamManual(deps);
 const r=await reviewExam(deps,exam.id,{date:'2026-10-01',markers:[{key:'shbg',label:'SHBG',value:30}]});assert.equal(r.warning,REVIEW_UNAVAILABLE);assert.equal(r.exam.status,'reviewed');
 await assert.rejects(reviewExam(deps,exam.id,{date:'2026-10-20',markers:[{key:'shbg',label:'SHBG',value:30}]}),/data da coleta/);
 await assert.rejects(reviewExam(deps,exam.id,{date:'2026-10-01',markers:[]}),/pelo menos um marcador/);
 await assert.rejects(reviewExam(deps,'nao-existe',{date:'2026-10-01',markers:[{key:'shbg',label:'SHBG',value:30}]}),{status:404});});
test('arquivo só abre para o dono e some ao excluir o exame',async()=>{const files=memoryFileStore();const {deps,box}=harness({files});const {exam}=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 const f=await readExamFile(deps,exam.id);assert.equal(f.contentType,'application/pdf');assert.equal(f.name,'laudo.pdf');
 await assert.rejects(readExamFile(harness({userId:'user_2',files}).deps,exam.id),{status:404});
 const forged=structuredClone(box.state);forged.labExams[0].file.path='exames/user_9/roubado.pdf';await files.save('exames/user_9/roubado.pdf',PDF,'application/pdf');
 await assert.rejects(readExamFile(harness({files,state:forged}).deps,exam.id),{status:404});
 await deleteExam(deps,exam.id);assert.equal(box.state.labExams.length,0);assert.equal(await files.read(exam.file.path),null);});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`Cannot find module '../lib/exam-service.ts'`).

- [ ] **Step 3: Implementar**

Criar `lib/exam-service.ts`:

```ts
import {todayInZone,validDate} from './core.ts';
import {cleanMarkers,cleanReview,MAX_FILE_BYTES,type Marker,type Overall} from './exam-schema.ts';
import {detectFileType,examPrefix,examTitle,FILE_EXT,mergeOverall,reviewContext} from './testosterone.ts';
import type {ExamFileStore,StoredFile} from './exam-files.ts';
import type {Command,Item,Workspace} from './types.ts';

// Casos de uso dos exames com dependências injetadas: as rotas ligam banco, Blob e IA; os testes usam versões em memória.
export type ExtractedExam={date?:string|null;lab?:string|null;markers:unknown[]};
export type ModelReview={overall:Overall;summary:string;points:{marker:string;text:string}[];tips:string[];model:string};
export type ExamDeps={userId:string;load:()=>Promise<{state:Workspace}>;mutate:(command:Command)=>Promise<{state:Workspace;version:number}>;files:ExamFileStore|null;quota:(kind:'exam_upload'|'exam_review',day:string)=>Promise<boolean>;extract:((file:{data:Uint8Array;type:string;name:string})=>Promise<ExtractedExam>)|null;review:((input:{text:string})=>Promise<ModelReview>)|null;now?:()=>Date};
export class ExamError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export const UNREADABLE='Não consegui ler este exame. Confira e digite os valores.';
export const REVIEW_UNAVAILABLE='O parecer da IA está indisponível agora. A classificação dos valores já está salva; tente Revisar de novo em instantes.';
const now=(d:ExamDeps)=>d.now?d.now():new Date();
const result=(r:{state:Workspace;version:number},id:string,warning?:string)=>({...r,exam:r.state.labExams.find(e=>e.id===id) as Item,...(warning?{warning}:{})});
const safeName=(name:string,ext:string)=>name.split('').filter(c=>c>=' '&&c!=='/'&&c!=='\\').join('').trim().slice(0,200)||'exame.'+ext;
function cleanExtracted(x:ExtractedExam,today:string){
 const markers=(Array.isArray(x?.markers)?x.markers:[]).flatMap(m=>{try{return cleanMarkers([m]);}catch{return [] as Marker[];}}).slice(0,80);
 const date=typeof x?.date==='string'&&validDate(x.date)&&x.date<=today?x.date:today;
 const lab=typeof x?.lab==='string'&&x.lab.trim()?x.lab.trim().slice(0,120):undefined;
 return {markers,date,lab};}
async function findExam(d:ExamDeps,id:string){const {state}=await d.load();const exam=state.labExams.find(e=>e.id===id);if(!exam)throw new ExamError('Exame não encontrado.',404);return {state,exam};}

export async function createExamFromFile(d:ExamDeps,input:{bytes:Uint8Array;name:string}){
 if(!d.files)throw new ExamError('Envio de arquivos indisponível no momento. Use Digitar exame.',503);
 if(!input.bytes.length||input.bytes.length>MAX_FILE_BYTES)throw new ExamError('Envie um arquivo de até 4 MB.',413);
 const type=detectFileType(input.bytes);if(!type)throw new ExamError('Envie um PDF ou uma foto (JPEG, PNG ou WEBP).',415);
 const {state}=await d.load();const today=todayInZone(state.profile.timezone,now(d));
 if(!await d.quota('exam_upload',today))throw new ExamError('Você atingiu o limite de envios de hoje. Tente amanhã.',429);
 const id=crypto.randomUUID(),path=examPrefix(d.userId)+id+'-'+crypto.randomUUID().slice(0,8)+'.'+FILE_EXT[type];
 await d.files.save(path,input.bytes,type);
 let read:{markers:Marker[];date:string;lab?:string}={markers:[],date:today};
 if(d.extract){try{read=cleanExtracted(await d.extract({data:input.bytes,type,name:input.name}),today);}catch(e){console.error('exam:extract',e instanceof Error?e.message:'erro');}}
 const exam={id,title:examTitle(read.date),date:read.date,status:'draft',createdOn:today,markers:read.markers,...(read.lab?{lab:read.lab}:{}),file:{path,name:safeName(input.name,FILE_EXT[type]),type,size:input.bytes.length}};
 try{return result(await d.mutate({type:'upsert',collection:'labExams',item:exam}),id,read.markers.length?undefined:UNREADABLE);}
 catch(e){await d.files.remove([path]).catch(()=>{});throw e;}
}
export async function createExamManual(d:ExamDeps){const {state}=await d.load();const today=todayInZone(state.profile.timezone,now(d));const id=crypto.randomUUID();
 return result(await d.mutate({type:'upsert',collection:'labExams',item:{id,title:examTitle(today),date:today,status:'draft',createdOn:today,markers:[]}}),id);}
export async function reviewExam(d:ExamDeps,id:string,input:{date?:unknown;lab?:unknown;markers?:unknown}){
 const {state,exam:current}=await findExam(d,id);const today=todayInZone(state.profile.timezone,now(d));
 if(typeof input.date!=='string'||!validDate(input.date)||input.date>today)throw new ExamError('Informe a data da coleta (hoje ou antes).');
 const markers=cleanMarkers(input.markers);if(!markers.length)throw new ExamError('Informe pelo menos um marcador.');
 const lab=typeof input.lab==='string'&&input.lab.trim()?input.lab.trim().slice(0,120):undefined;
 const exam:Item={...current,date:input.date,title:examTitle(input.date),markers,status:'reviewed'};delete exam.review;delete exam.lab;if(lab)exam.lab=lab;
 const ctx=reviewContext({id,date:input.date,markers},state);let warning:string|undefined;
 if(!d.review)warning=REVIEW_UNAVAILABLE;
 else if(!await d.quota('exam_review',today))warning='Você atingiu o limite de pareceres de hoje. A classificação dos valores já está salva.';
 else{try{const r=await d.review({text:ctx.text});exam.review=cleanReview({...r,overall:mergeOverall(ctx.codeOverall,r.overall),reviewedAt:now(d).toISOString()});}catch(e){console.error('exam:review',e instanceof Error?e.message:'erro');warning=REVIEW_UNAVAILABLE;}}
 return result(await d.mutate({type:'upsert',collection:'labExams',item:exam}),id,warning);
}
export async function deleteExam(d:ExamDeps,id:string){const {exam}=await findExam(d,id);
 if(exam.file){if(!d.files)throw new ExamError('Exclusão de arquivos indisponível no momento. Tente mais tarde.',503);await d.files.remove([exam.file.path]);}
 return await d.mutate({type:'delete',collection:'labExams',id});}
export async function readExamFile(d:ExamDeps,id:string):Promise<StoredFile&{name:string}>{const {exam}=await findExam(d,id);const file=exam.file;
 if(!file||!d.files||typeof file.path!=='string'||!file.path.startsWith(examPrefix(d.userId)))throw new ExamError('Arquivo não encontrado.',404);
 const stored=await d.files.read(file.path);if(!stored)throw new ExamError('Arquivo não encontrado.',404);return {...stored,name:file.name};}
```

- [ ] **Step 4: Rodar testes e tipos**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/exam-service.ts tests/exams.test.mjs
git commit -m "Envio, conferência, parecer e exclusão de exames com dependências injetadas"
```

---

### Task 6: Leitura do laudo e parecer pela IA (`lib/exam-ai.ts`)

**Files:**
- Create: `lib/exam-ai.ts`

**Interfaces:**
- Consumes: `agentModel`, `config` (`lib/agent-runtime.ts`); `MARKER_KEYS` (Task 1); `ExtractedExam`, `ModelReview` (Task 5).
- Produces: `extractExam(file: {data: Uint8Array; type: string; name: string}): Promise<ExtractedExam>`; `reviewWithAi(input: {text: string}): Promise<ModelReview>`.

Sem teste automático: as duas funções só chamam o modelo. A validação da saída já está coberta por `cleanMarkers`/`cleanReview` (Tasks 1 e 5), e a chamada real é verificada em produção na Task 12.

- [ ] **Step 1: Implementar**

Criar `lib/exam-ai.ts`:

```ts
import {generateText,Output} from 'ai';import {z} from 'zod';import {agentModel,config} from './agent-runtime';import {MARKER_KEYS} from './exam-schema';import type {ExtractedExam,ModelReview} from './exam-service';
// Chamadas à IA do menu Testosterona: ler o laudo (sem interpretar) e escrever o parecer a partir dos valores conferidos.
const EXTRACT=`Você lê laudos de exames laboratoriais brasileiros e devolve somente os dados, sem interpretar.
- collectedAt: data da coleta em AAAA-MM-DD, ou null.
- lab: nome do laboratório, ou null.
- markers: um item por resultado numérico. label: nome como está no laudo. key: o marcador padronizado correspondente, ou "outro". value: número com ponto decimal (no laudo, 0,85 vira 0.85). qualifier: "<" ou ">" quando o laudo mostra o valor assim, senão null. unit: unidade do laudo. refMin e refMax: faixa de referência impressa; quando houver faixas por sexo ou idade, use a de homem adulto; "até 4,0" vira refMin null e refMax 4.0; "superior a 30" vira refMin 30 e refMax null.
- Ignore nome do paciente, documentos, médico solicitante e resultados não numéricos.
- Se o arquivo não for um laudo de exame, devolva markers vazio.`;
const REVIEW=`Você é o GeoAI e ajuda homens a entender exames ligados à testosterona. Escreva em português do Brasil, em linguagem simples, sem markdown.
Você recebe os marcadores já conferidos pelo usuário e classificados pelo app com a faixa do próprio laudo. Não reclassifique valores: use a classificação recebida.
- overall: "doctor" quando houver alerta crítico ou algo que mereça consulta breve; "attention" quando houver valores fora da faixa; "ok" quando tudo estiver dentro. Nunca escolha uma situação mais leve que a indicada pelos alertas.
- summary: 2 a 4 frases com a visão geral, considerando o protocolo e o dia do ciclo quando houver (no fim do intervalo os níveis costumam estar mais baixos; logo após a aplicação, mais altos) e a evolução em relação aos exames anteriores.
- points: um item por marcador fora da faixa ou alerta, dizendo o que costuma significar e o que perguntar ao médico.
- tips: até 5 hábitos ligados aos resultados (alimentação, sol e vitamina D, sono, treino, álcool, peso, estresse).
Nunca sugira mudar dose, nem começar, parar ou comprar testosterona ou outros medicamentos (inibidores de aromatase, hCG etc.). Não dê diagnóstico: use "pode indicar" e "vale conversar com seu médico".`;
const extraction=z.object({collectedAt:z.string().nullable(),lab:z.string().nullable(),markers:z.array(z.object({key:z.enum(MARKER_KEYS),label:z.string(),value:z.number(),qualifier:z.enum(['<','>']).nullable(),unit:z.string().nullable(),refMin:z.number().nullable(),refMax:z.number().nullable()})).max(80)});
const review=z.object({overall:z.enum(['ok','attention','doctor']),summary:z.string(),points:z.array(z.object({marker:z.string(),text:z.string()})).max(12),tips:z.array(z.string()).max(5)});
function model(){const m=agentModel();if(!m)throw new Error('IA não configurada');return m;}
export async function extractExam(file:{data:Uint8Array;type:string;name:string}):Promise<ExtractedExam>{
 const {output}=await generateText({model:model(),instructions:EXTRACT,output:Output.object({schema:extraction}),messages:[{role:'user',content:[{type:'text',text:'Extraia os resultados deste laudo.'},{type:'file',mediaType:file.type,data:file.data,filename:file.name}]}],maxOutputTokens:8000,abortSignal:AbortSignal.timeout(45000)});
 return {date:output.collectedAt,lab:output.lab,markers:output.markers};}
export async function reviewWithAi(input:{text:string}):Promise<ModelReview>{
 const {output}=await generateText({model:model(),instructions:REVIEW,output:Output.object({schema:review}),prompt:input.text,maxOutputTokens:4000,abortSignal:AbortSignal.timeout(45000)});
 return {...output,model:config().AI_MODEL||'ia'};}
```

- [ ] **Step 2: Checar tipos**

Run: `npm run typecheck`
Expected: sem erros. Se o tipo de `content` reclamar de `filename`, conferir a parte `file` em `node_modules/ai/docs/02-foundations/03-prompts.mdx` ("File Parts") e ajustar só o nome do campo.

- [ ] **Step 3: Commit**

```bash
git add lib/exam-ai.ts
git commit -m "Leitura de laudos e parecer de exames pela IA"
```

---

### Task 7: Rotas de exames e proteção do `/api/state`

**Files:**
- Create: `lib/exam-deps.ts`
- Create: `app/api/exams/route.ts`, `app/api/exams/[id]/route.ts`, `app/api/exams/[id]/review/route.ts`, `app/api/exams/[id]/file/route.ts`
- Modify: `app/api/state/route.ts`

**Interfaces:**
- Consumes: casos de uso da Task 5, `extractExam`/`reviewWithAi` (Task 6), `examFiles` e `consumeQuota` (Task 4), `guardStateCommand` e `examPrefix` (Task 2).
- Produces: `examDeps(userId): ExamDeps`, `examResponse(body)`, `examError(error)`. Rotas:
  - `POST /api/exams` (multipart `file` ou JSON vazio) → `{state, version, exam, warning?}`
  - `POST /api/exams/[id]/review` com `{date, lab, markers}` → `{state, version, exam, warning?}`
  - `DELETE /api/exams/[id]` → `{state, version}`
  - `GET /api/exams/[id]/file` → o arquivo

- [ ] **Step 1: Ligações do servidor**

Criar `lib/exam-deps.ts`:

```ts
import {loadWorkspace,mutateWorkspace,jsonError} from './workspace-server';import {examFiles} from './exam-files';import {consumeQuota} from './quota';import {extractExam,reviewWithAi} from './exam-ai';import {agentModel} from './agent-runtime';import {ExamError,type ExamDeps} from './exam-service';
// Liga os casos de uso dos exames ao banco, ao Blob e à IA configurada.
export function examDeps(userId:string):ExamDeps{const ai=!!agentModel();return {userId,load:()=>loadWorkspace(userId,''),mutate:command=>mutateWorkspace(userId,'',command),files:examFiles(),quota:(kind,day)=>consumeQuota(userId,kind,day),extract:ai?extractExam:null,review:ai?reviewWithAi:null};}
export const examResponse=(body:unknown)=>Response.json(body,{headers:{'Cache-Control':'no-store'}});
export function examError(error:unknown){if(error instanceof ExamError)return jsonError(error.message,error.status);const message=error instanceof Error?error.message:'Não foi possível concluir agora.';if(/outra aba/.test(message))return jsonError(message,409);console.error('exams',message);return jsonError(message,400);}
```

- [ ] **Step 2: Rotas**

`app/api/exams/route.ts`:

```ts
import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {createExamFromFile,createExamManual} from '@/lib/exam-service';import {examDeps,examError,examResponse} from '@/lib/exam-deps';
export const dynamic='force-dynamic';export const maxDuration=60;
// Cria um exame: multipart com o arquivo do laudo, ou JSON vazio para digitar os valores.
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 try{const type=request.headers.get('content-type')||'';
  if(type.includes('application/json'))return examResponse(await createExamManual(examDeps(userId)));
  if(!type.includes('multipart/form-data'))return jsonError('Formato inválido',415);
  if(Number(request.headers.get('content-length')||0)>4.5*1024*1024)return jsonError('Envie um arquivo de até 4 MB.',413);
  const file=(await request.formData()).get('file');if(!(file instanceof File))return jsonError('Escolha um arquivo.',400);
  return examResponse(await createExamFromFile(examDeps(userId),{bytes:new Uint8Array(await file.arrayBuffer()),name:file.name}));}
 catch(error){return examError(error);}}
```

`app/api/exams/[id]/route.ts`:

```ts
import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {deleteExam} from '@/lib/exam-service';import {examDeps,examError,examResponse} from '@/lib/exam-deps';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 try{return examResponse(await deleteExam(examDeps(userId),(await params).id));}catch(error){return examError(error);}}
```

`app/api/exams/[id]/review/route.ts`:

```ts
import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {reviewExam} from '@/lib/exam-service';import {examDeps,examError,examResponse} from '@/lib/exam-deps';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);if(!request.headers.get('content-type')?.includes('application/json'))return jsonError('Formato inválido',415);
 try{const text=await request.text();if(text.length>100000)return jsonError('Exame muito grande',413);return examResponse(await reviewExam(examDeps(userId),(await params).id,JSON.parse(text)));}catch(error){return examError(error);}}
```

`app/api/exams/[id]/file/route.ts`:

```ts
import {getUserId} from '@/lib/auth';import {jsonError} from '@/lib/workspace-server';import {readExamFile} from '@/lib/exam-service';import {examDeps,examError} from '@/lib/exam-deps';
export const dynamic='force-dynamic';
// Só o dono abre o arquivo; o Blob é privado e nunca expõe link público.
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);
 try{const f=await readExamFile(examDeps(userId),(await params).id);return new Response(f.body as BodyInit,{headers:{'Content-Type':f.contentType,'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(f.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return examError(error);}}
```

- [ ] **Step 3: Proteger o `/api/state`**

Em `app/api/state/route.ts`:

1. Acrescentar ao fim da linha de imports: `import {guardStateCommand,examPrefix} from '@/lib/testosterone';import {examFiles} from '@/lib/exam-files';`
2. No `POST`, trocar `return Response.json(await mutateWorkspace(userId,'',JSON.parse(text)),{headers:{'Cache-Control':'no-store'}});` por:

```ts
const command=guardStateCommand(JSON.parse(text),userId);const result=await mutateWorkspace(userId,'',command);
 // "Apagar meus dados" também remove os arquivos dos exames; uma falha aqui não desfaz a limpeza dos registros.
 if(command.type==='reset')await examFiles()?.removePrefix(examPrefix(userId)).catch(e=>console.error('exam files:reset',e instanceof Error?e.message:'erro'));
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
```

- [ ] **Step 4: Tipos, lint, testes e build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo passa; o build lista as rotas `/api/exams`, `/api/exams/[id]`, `/api/exams/[id]/review` e `/api/exams/[id]/file`.

- [ ] **Step 5: Commit**

```bash
git add lib/exam-deps.ts app/api/exams app/api/state/route.ts
git commit -m "Rotas de exames e proteção dos exames no /api/state"
```

---

### Task 8: Tela de exames

**Files:**
- Modify: `components/norte/context.tsx` (`sync` no contexto)
- Modify: `components/norte/NorteApp.tsx` (implementar `sync`)
- Create: `components/norte/exams.tsx`
- Modify: `app/globals.css` (estilos do menu)

**Interfaces:**
- Consumes: rotas da Task 7; `classifyMarker`, `finalOverall`, `parseDecimal`, `rangeText`, `valueText`, `STATUS_LABEL`, `OVERALL_LABEL`, `MARKER_LABEL`, `type MarkerStatus` (Task 2); `MARKER_KEYS`, `MAX_FILE_BYTES`, `FILE_TYPES`, `type Marker`, `type Overall` (Task 1).
- Produces: `AppContext.sync(r: {state: Workspace; version: number}): void`; `ExamsPanel()` e `OVERALL_PILL: Record<Overall, string>` exportados de `components/norte/exams.tsx`.

- [ ] **Step 1: `sync` no contexto**

`components/norte/context.tsx`: no tipo `AppContext`, depois de `mutate:(c:Command)=>Promise<boolean>;`, acrescentar `sync:(r:{state:Workspace;version:number})=>void;`.

`components/norte/NorteApp.tsx`: em `const context={state,today,date:date||today,setDate,navigate,mutate,edit,`, acrescentar logo depois de `edit,`:
`sync:(r:{state:Workspace;version:number})=>setData(prev=>prev&&{...prev,state:r.state,version:r.version}),`

- [ ] **Step 2: Componente de exames**

Criar `components/norte/exams.tsx`:

```tsx
'use client';
import {useRef,useState} from 'react';import {Upload,Pencil,RefreshCw,Trash2,Plus,X,LoaderCircle,FileText,TriangleAlert} from 'lucide-react';
import {useApp} from './context';import {Modal,Empty} from './primitives';
import {MARKER_KEYS,MAX_FILE_BYTES,FILE_TYPES,type Marker,type Overall} from '@/lib/exam-schema';
import {classifyMarker,finalOverall,parseDecimal,rangeText,valueText,STATUS_LABEL,OVERALL_LABEL,MARKER_LABEL,type MarkerStatus} from '@/lib/testosterone';
import type {Item,Workspace} from '@/lib/types';

type Saved={state:Workspace;version:number;exam?:Item;warning?:string};
type Row={key:string;label:string;qualifier:string;value:string;unit:string;refMin:string;refMax:string};
const NOTICE_KEY='geoai-exam-notice';
export const STATUS_PILL:Record<MarkerStatus,string>={low:'pill warn',high:'pill warn',normal:'pill green',none:'pill'};
export const OVERALL_PILL:Record<Overall,string>={ok:'pill green',attention:'pill warn',doctor:'pill danger'};
const dayLabel=(d:string)=>d.split('-').reverse().join('/');
const decimal=(n?:number)=>n===undefined?'':String(n).replace('.',',');
const emptyRow=():Row=>({key:'outro',label:'',qualifier:'',value:'',unit:'',refMin:'',refMax:''});
const toRows=(markers:Marker[]):Row[]=>markers.map(m=>({key:m.key,label:m.label,qualifier:m.qualifier||'',value:decimal(m.value),unit:m.unit||'',refMin:decimal(m.refMin),refMax:decimal(m.refMax)}));
function toMarkers(rows:Row[]){return rows.filter(r=>r.label.trim()||r.value.trim()).map(r=>{const label=r.label.trim()||MARKER_LABEL[r.key]||'Marcador';
 const num=(v:string,what:string)=>{if(!v.trim())return undefined;const n=parseDecimal(v);if(!Number.isFinite(n))throw new Error('Confira '+what+' de '+label+'.');return n;};
 const value=num(r.value,'o valor');if(value===undefined)throw new Error('Informe o valor de '+label+'.');
 return {key:r.key,label,value,...(r.qualifier?{qualifier:r.qualifier}:{}),...(r.unit.trim()?{unit:r.unit.trim()}:{}),...(r.refMin.trim()?{refMin:num(r.refMin,'a faixa mínima')}:{}),...(r.refMax.trim()?{refMax:num(r.refMax,'a faixa máxima')}:{})};});}
// Reduz fotos no navegador para caber no limite de envio; PDFs seguem como estão.
async function prepareFile(file:File):Promise<Blob>{if(!file.type.startsWith('image/'))return file;const bitmap=await createImageBitmap(file);const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')?.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a foto.')),'image/jpeg',0.85));}
function useExamApi(){const a=useApp();return async function call(url:string,init:RequestInit):Promise<Saved>{const r=await fetch(url,init);const j=await r.json().catch(()=>({})) as Saved&{error?:string};if(!r.ok)throw new Error(j.error||'Não foi possível concluir agora.');a.sync(j);return j;};}

export function ExamsPanel(){const a=useApp(),call=useExamApi();const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(''),[notice,setNotice]=useState(false),[editing,setEditing]=useState<{id:string;warning?:string}|null>(null),[viewing,setViewing]=useState<string|null>(null);
 const exams=a.state.labExams.slice().sort((x,y)=>y.date.localeCompare(x.date));
 const fail=(e:unknown)=>a.toast(e instanceof Error?e.message:'Não foi possível concluir agora.',true);
 function choose(){let seen=false;try{seen=localStorage.getItem(NOTICE_KEY)==='1';}catch{}if(seen)input.current?.click();else setNotice(true);}
 async function upload(file:File){if(!(FILE_TYPES as readonly string[]).includes(file.type))return a.toast('Envie um PDF ou uma foto (JPEG, PNG ou WEBP).',true);setBusy('Lendo seu exame…');
  try{const body=await prepareFile(file);if(body.size>MAX_FILE_BYTES)throw new Error('Envie um arquivo de até 4 MB.');const form=new FormData();form.append('file',body,file.name);const j=await call('/api/exams',{method:'POST',body:form});if(j.exam)setEditing({id:j.exam.id,warning:j.warning});}
  catch(e){fail(e);}finally{setBusy('');if(input.current)input.current.value='';}}
 async function manual(){setBusy('Criando exame…');try{const j=await call('/api/exams',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(j.exam)setEditing({id:j.exam.id});}catch(e){fail(e);}finally{setBusy('');}}
 return <>
  <div className="section-action"><p>Envie o PDF ou a foto do laudo. A IA lê os valores e você confere antes do parecer.</p><div className="button-group"><button className="button outline" disabled={!!busy} onClick={manual}><Pencil size={16}/>Digitar exame</button><button className="button primary" disabled={!!busy} onClick={choose}>{busy?<LoaderCircle className="spin" size={16}/>:<Upload size={16}/>}{busy||'Enviar exame'}</button></div>
   <input ref={input} type="file" hidden accept={FILE_TYPES.join(',')} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);}}/></div>
  {exams.length?<div className="records-list">{exams.map(e=><ExamCard key={e.id} exam={e} all={a.state.labExams} onOpen={()=>e.status==='draft'?setEditing({id:e.id}):setViewing(e.id)}/>)}</div>
   :<section className="panel"><Empty title="Nenhum exame ainda" description="Envie seu último exame para acompanhar a evolução dos seus marcadores." action="Enviar exame" onAction={choose}/></section>}
  {notice&&<Modal title="Antes de enviar" subtitle="Seus exames, só seus." onClose={()=>setNotice(false)}><p className="modal-copy">Seus exames ficam guardados de forma privada. O arquivo é enviado à OpenAI apenas para leitura.</p><div className="modal-footer"><button className="button ghost" onClick={()=>setNotice(false)}>Cancelar</button><button className="button primary" onClick={()=>{try{localStorage.setItem(NOTICE_KEY,'1');}catch{}setNotice(false);input.current?.click();}}>Entendi, escolher arquivo</button></div></Modal>}
  {editing&&<ExamForm id={editing.id} warning={editing.warning} onClose={()=>setEditing(null)} onReviewed={id=>{setEditing(null);setViewing(id);}}/>}
  {viewing&&<ExamDetail id={viewing} onClose={()=>setViewing(null)} onEdit={id=>{setViewing(null);setEditing({id});}}/>}
 </>;}

function ExamCard({exam,all,onOpen}:{exam:Item;all:Item[];onOpen:()=>void}){const total=(exam.markers as Marker[]|undefined)?.find(m=>m.key==='testosterona_total');const overall=exam.status==='reviewed'?finalOverall(exam,all):null;
 return <article className="panel record-card"><div className="record-head"><span className={overall?OVERALL_PILL[overall]:'pill'}>{overall?OVERALL_LABEL[overall]:'Rascunho'}</span><time>{dayLabel(exam.date)}</time>{exam.file&&<FileText size={15} aria-label="Com arquivo"/>}</div>
  <button className="record-title" onClick={onOpen}>{exam.lab||exam.title}</button><p className="record-content">{total?'Testosterona total: '+valueText(total):exam.status==='draft'?'Confira os valores para gerar o parecer.':(exam.markers?.length||0)+' marcadores'}</p></article>;}

function ExamForm({id,warning,onClose,onReviewed}:{id:string;warning?:string;onClose:()=>void;onReviewed:(id:string)=>void}){const a=useApp(),call=useExamApi();const exam=a.state.labExams.find(e=>e.id===id);
 const [date,setDate]=useState(exam?.date||a.today),[lab,setLab]=useState(exam?.lab||''),[rows,setRows]=useState<Row[]>(()=>exam?.markers?.length?toRows(exam.markers):[{...emptyRow(),key:'testosterona_total',label:'Testosterona total',unit:'ng/dL'}]),[saving,setSaving]=useState(false),[error,setError]=useState('');
 if(!exam)return null;
 const set=(i:number,patch:Partial<Row>)=>setRows(rows.map((r,j)=>j===i?{...r,...patch}:r));
 async function submit(e:React.FormEvent){e.preventDefault();setError('');let markers;try{markers=toMarkers(rows);if(!markers.length)throw new Error('Informe pelo menos um marcador.');}catch(err){return setError(err instanceof Error?err.message:'Confira os valores.');}
  setSaving(true);try{const j=await call('/api/exams/'+id+'/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,lab,markers})});if(j.warning)a.toast(j.warning,true);onReviewed(id);}
  catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar.');}finally{setSaving(false);}}
 return <Modal wide title="Confira os valores" subtitle={exam.file?'Lidos do arquivo '+exam.file.name+'. Corrija o que precisar.':'Digite os valores do laudo.'} onClose={()=>!saving&&onClose()}><form onSubmit={submit}>
  {warning&&<p className="form-error" role="alert"><TriangleAlert size={15}/> {warning}</p>}
  <div className="form-grid"><label className="field"><span>Data da coleta<i> *</i></span><input type="date" required max={a.today} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field"><span>Laboratório</span><input value={lab} maxLength={120} onChange={e=>setLab(e.target.value)}/></label></div>
  <div className="marker-rows">{rows.map((r,i)=><div className="marker-row" key={i}>
   <label className="wide"><span>Marcador</span><select value={r.key} onChange={e=>set(i,{key:e.target.value,label:r.label||MARKER_LABEL[e.target.value]||''})}>{MARKER_KEYS.map(k=><option key={k} value={k}>{MARKER_LABEL[k]}</option>)}</select></label>
   <label className="wide"><span>Nome no laudo</span><input value={r.label} maxLength={80} onChange={e=>set(i,{label:e.target.value})}/></label>
   <label><span>Sinal</span><select value={r.qualifier} onChange={e=>set(i,{qualifier:e.target.value})}><option value="">=</option><option value="<">&lt;</option><option value=">">&gt;</option></select></label>
   <label><span>Valor</span><input inputMode="decimal" value={r.value} onChange={e=>set(i,{value:e.target.value})}/></label>
   <label><span>Unidade</span><input value={r.unit} maxLength={30} onChange={e=>set(i,{unit:e.target.value})}/></label>
   <label><span>Mínimo</span><input inputMode="decimal" value={r.refMin} onChange={e=>set(i,{refMin:e.target.value})}/></label>
   <label><span>Máximo</span><input inputMode="decimal" value={r.refMax} onChange={e=>set(i,{refMax:e.target.value})}/></label>
   <button type="button" className="icon-button danger" aria-label={'Remover '+(r.label||'marcador')} onClick={()=>setRows(rows.filter((_,j)=>j!==i))}><X size={16}/></button></div>)}</div>
  <button type="button" className="button outline small" disabled={rows.length>=80} onClick={()=>setRows([...rows,emptyRow()])}><Plus size={15}/>Adicionar marcador</button>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="modal-footer"><button type="button" className="button ghost" onClick={onClose} disabled={saving}>Fechar</button><button className="button primary" disabled={saving}>{saving?<><LoaderCircle className="spin" size={16}/>Gerando parecer…</>:'Salvar e revisar'}</button></div>
 </form></Modal>;}

function ExamDetail({id,onClose,onEdit}:{id:string;onClose:()=>void;onEdit:(id:string)=>void}){const a=useApp(),call=useExamApi();const [busy,setBusy]=useState(''),[confirm,setConfirm]=useState(false);const exam=a.state.labExams.find(e=>e.id===id);
 if(!exam)return null;
 const overall=finalOverall(exam,a.state.labExams),review=exam.review;
 async function again(){setBusy('review');try{const j=await call('/api/exams/'+id+'/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:exam!.date,lab:exam!.lab||'',markers:exam!.markers})});a.toast(j.warning||'Parecer atualizado.',!!j.warning);}catch(e){a.toast(e instanceof Error?e.message:'Não foi possível revisar.',true);}finally{setBusy('');}}
 async function remove(){setBusy('delete');try{await call('/api/exams/'+id,{method:'DELETE'});a.toast('Exame excluído.');onClose();}catch(e){a.toast(e instanceof Error?e.message:'Não foi possível excluir.',true);setBusy('');}}
 return <Modal wide title={exam.lab||exam.title} subtitle={'Coleta em '+dayLabel(exam.date)} onClose={()=>!busy&&onClose()}>
  <p><span className={OVERALL_PILL[overall]}>{OVERALL_LABEL[overall]}</span></p>
  <div className="exam-markers">{(exam.markers as Marker[]).map((m,i)=>{const st=classifyMarker(m);return <div className="exam-marker" key={i}><div><strong>{m.label}</strong><small>Faixa: {rangeText(m)}</small></div><span>{valueText(m)}</span><span className={STATUS_PILL[st]}>{STATUS_LABEL[st]}</span></div>;})}</div>
  {review?<section><h3>Parecer</h3><p>{review.summary}</p>{review.points.length>0&&<><h4>Pontos de atenção</h4><ul className="review-list">{review.points.map((p:{marker:string;text:string},i:number)=><li key={i}><b>{p.marker}:</b> {p.text}</li>)}</ul></>}</section>:<p className="quiet-copy">Ainda sem parecer da IA. Toque em Revisar de novo.</p>}
  <p className="quiet-copy">A IA ajuda a entender seus exames, mas não substitui seu médico.</p>
  {confirm?<div className="modal-footer"><span>Excluir este exame e o arquivo?</span><button className="button ghost" onClick={()=>setConfirm(false)} disabled={!!busy}>Cancelar</button><button className="button destructive" onClick={remove} disabled={!!busy}>{busy==='delete'?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>}Excluir</button></div>
  :<div className="modal-footer">{exam.file&&<a className="button outline" href={'/api/exams/'+id+'/file'} target="_blank" rel="noreferrer"><FileText size={16}/>Ver arquivo</a>}<button className="button outline" onClick={()=>onEdit(id)} disabled={!!busy}><Pencil size={16}/>Editar valores</button><button className="button outline" onClick={again} disabled={!!busy}>{busy==='review'?<LoaderCircle className="spin" size={16}/>:<RefreshCw size={16}/>}Revisar de novo</button><button className="icon-button danger" aria-label="Excluir exame" onClick={()=>setConfirm(true)}><Trash2 size={16}/></button></div>}
 </Modal>;}
```

- [ ] **Step 3: Estilos**

Acrescentar ao fim de `app/globals.css`:

```css
/* Menu Testosterona */
.pill.warn{background:color-mix(in srgb,var(--gold) 18%,transparent);color:var(--gold)}
.pill.danger{background:color-mix(in srgb,var(--danger) 16%,transparent);color:var(--danger)}
.health-disclaimer{display:flex;align-items:center;gap:8px;margin:0 0 16px;padding:10px 14px;border-radius:10px;background:var(--surface-2);color:var(--muted);font-size:13px}
.marker-rows{display:flex;flex-direction:column;gap:10px;margin:14px 0}
.marker-row{display:grid;grid-template-columns:minmax(150px,1.4fr) minmax(130px,1.2fr) 70px minmax(80px,.8fr) minmax(80px,.7fr) minmax(70px,.7fr) minmax(70px,.7fr) 40px;gap:8px;align-items:end;padding:10px;border-radius:10px;background:var(--surface-2)}
.marker-row label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)}
@media (max-width:760px){.marker-row{grid-template-columns:1fr 1fr}.marker-row .wide{grid-column:1/-1}}
.exam-markers{display:flex;flex-direction:column;margin:12px 0}
.exam-marker{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)}
.exam-marker small{display:block;color:var(--muted)}
.review-list,.tips-grid ul{margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
.tips-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:14px}
```

- [ ] **Step 4: Tipos e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros. A tela só aparece no menu depois da Task 9.

- [ ] **Step 5: Commit**

```bash
git add components/norte/context.tsx components/norte/NorteApp.tsx components/norte/exams.tsx app/globals.css
git commit -m "Tela de exames: envio, conferência dos valores e parecer"
```

---

### Task 9: Menu Testosterona (resumo, protocolo e dicas)

**Files:**
- Create: `components/norte/testosterone-tips.ts`
- Create: `components/norte/testosterone.tsx`
- Modify: `components/norte/catalog.ts` (`NAV` e import do ícone)
- Modify: `components/norte/NorteApp.tsx` (import, mapa `views`, barra inferior)

**Interfaces:**
- Consumes: `ExamsPanel`, `OVERALL_PILL` (Task 8); `finalOverall`, `protocolStatus`, `punctuality`, `valueText`, `rangeText`, `OVERALL_LABEL` (Task 2); `Records` (existente).
- Produces: `TestosteroneView()`; item de menu `{id:'testosterona', path:'/testosterona'}`.

- [ ] **Step 1: Conteúdo das dicas**

Criar `components/norte/testosterone-tips.ts`:

```ts
// Conteúdo fixo da aba Dicas: hábitos gerais, revisados. Não substitui orientação médica.
export const TIPS=[
 {title:'Alimentação',icon:'utensils',items:['Ovos inteiros e peixes gordurosos (sardinha, salmão) trazem gorduras boas e vitamina D.','Ostras, carnes vermelhas magras, feijões e sementes de abóbora são fontes de zinco.','Uma ou duas castanhas-do-pará por dia cobrem o selênio.','Azeite, abacate e oleaginosas no lugar de frituras.','Vegetais crucíferos (brócolis, couve-flor, repolho) com frequência.','Menos ultraprocessados, açúcar e álcool.']},
 {title:'Sol e vitamina D',icon:'sun',items:['15 a 30 minutos de sol com braços e pernas expostos, de preferência antes das 10h ou depois das 16h.','Pele mais escura precisa de mais tempo de sol para produzir a mesma vitamina D.','Peça a dosagem de vitamina D ao seu médico antes de pensar em suplemento.']},
 {title:'Sono',icon:'moon',items:['Durma de 7 a 9 horas: a testosterona sobe durante o sono.','Horários regulares para dormir e acordar, inclusive no fim de semana.','Quarto escuro e telas longe na última hora antes de deitar.']},
 {title:'Treino',icon:'dumbbell',items:['Musculação 3 a 4 vezes por semana, com exercícios compostos (agachamento, levantamento terra, supino, remada).','Descanso entre os treinos: excesso sem recuperação atrapalha os hormônios.','Caminhadas e atividade leve nos outros dias.']},
 {title:'Peso e estresse',icon:'heart',items:['Reduzir a gordura abdominal costuma melhorar os níveis de testosterona.','Estresse constante eleva o cortisol; reserve pausas no dia.','Evite cigarro e limite o álcool.']},
] as const;
```

- [ ] **Step 2: Tela do menu**

Criar `components/norte/testosterone.tsx`:

```tsx
'use client';
import {useState} from 'react';import {Plus,Syringe,FlaskConical,CalendarDays,ShieldCheck,Utensils,Sun,Moon,Dumbbell,Heart,Sparkles,Pencil,Trash2} from 'lucide-react';
import {useApp,type AppContext} from './context';import {PageHeading,Tabs,Stat,Empty,MiniChart} from './primitives';import {Records} from './records';import {ExamsPanel,OVERALL_PILL} from './exams';import {TIPS} from './testosterone-tips';
import {finalOverall,protocolStatus,punctuality,valueText,rangeText,OVERALL_LABEL} from '@/lib/testosterone';import type {Marker} from '@/lib/exam-schema';import type {Item} from '@/lib/types';
const ICONS={utensils:Utensils,sun:Sun,moon:Moon,dumbbell:Dumbbell,heart:Heart};
const dayLabel=(d:string)=>d.split('-').reverse().join('/');
const totalOf=(e:Item)=>(e.markers as Marker[]|undefined)?.find(m=>m.key==='testosterona_total');
const plural=(n:number)=>n+(n===1?' dia':' dias');
const newProtocol=(a:AppContext)=>a.edit('trtProtocols',undefined,{status:'active',remind:true,unit:'mg',intervalDays:14});
const registerDose=(a:AppContext,p:Item)=>a.edit('trtDoses',undefined,{title:'Aplicação: '+p.title,protocolId:p.id,dose:p.dose,date:a.today});

export function TestosteroneView(){const a=useApp();const [tab,setTab]=useState('resumo');
 return <><PageHeading eyebrow="SAÚDE HORMONAL" title="Testosterona" description="Exames, protocolo e hábitos em um só lugar."/>
  <p className="health-disclaimer"><ShieldCheck size={16}/>A IA ajuda a entender seus exames, mas não substitui seu médico.</p>
  <Tabs value={tab} onChange={setTab} items={[{id:'resumo',label:'Resumo'},{id:'exames',label:'Exames',count:a.state.labExams.length},{id:'protocolo',label:'Protocolo'},{id:'dicas',label:'Dicas'}]}/>
  {tab==='resumo'&&<Summary onTab={setTab}/>}{tab==='exames'&&<ExamsPanel/>}{tab==='protocolo'&&<ProtocolPanel/>}{tab==='dicas'&&<TipsPanel/>}</>;}

function Summary({onTab}:{onTab:(t:string)=>void}){const a=useApp();const reviewed=a.state.labExams.filter(e=>e.status==='reviewed').sort((x,y)=>x.date.localeCompare(y.date));const last=reviewed[reviewed.length-1];const overall=last?finalOverall(last,a.state.labExams):null;const total=last?totalOf(last):undefined;const active=a.state.trtProtocols.filter(p=>p.status==='active');const chart=reviewed.filter(e=>totalOf(e)).slice(-8);const points=(last?.review?.points||[]) as {marker:string;text:string}[];
 return <>
  <div className="stats-grid three">
   <Stat label="Último exame" icon={FlaskConical} value={last?dayLabel(last.date):'—'} foot={overall?OVERALL_LABEL[overall]:'Envie seu primeiro exame'}/>
   <Stat label="Testosterona total" value={total?valueText(total):'—'} foot={total?'Faixa: '+rangeText(total):'Sem resultado ainda'}/>
   {active.map(p=>{const st=protocolStatus(p,a.state.trtDoses,a.today);return <Stat key={p.id} accent={st.overdue>0} label={'Próxima aplicação · '+p.title} icon={Syringe} value={dayLabel(st.next)} foot={st.overdue?'Atrasada há '+plural(st.overdue):st.daysLeft===0?'É hoje':'Faltam '+plural(st.daysLeft)}/>;})}
  </div>
  <div className="button-group">{active.map(p=><button key={p.id} className="button primary" onClick={()=>registerDose(a,p)}><Syringe size={16}/>Registrar aplicação{active.length>1?' · '+p.title:''}</button>)}{!a.state.trtProtocols.length&&<button className="button outline" onClick={()=>onTab('protocolo')}><Plus size={16}/>Cadastrar protocolo</button>}<button className="button outline" onClick={()=>onTab('exames')}><FlaskConical size={16}/>Enviar exame</button></div>
  {overall&&points.length>0&&<section className="panel"><header className="section-heading"><h2>Pontos de atenção</h2><span className={OVERALL_PILL[overall]}>{OVERALL_LABEL[overall]}</span></header><ul className="review-list">{points.map((p,i)=><li key={i}><b>{p.marker}:</b> {p.text}</li>)}</ul></section>}
  {chart.length>1&&<section className="panel"><header className="section-heading"><h2>Testosterona total por exame</h2></header><MiniChart values={chart.map(e=>totalOf(e)?.value||0)} labels={chart.map(e=>dayLabel(e.date).slice(0,5))}/></section>}
 </>;}

function ProtocolPanel(){const a=useApp();const doses=a.state.trtDoses.slice().sort((x,y)=>x.date.localeCompare(y.date));
 return <>
  <div className="section-action"><p>Registre o protocolo prescrito pelo seu médico. O GeoAI acompanha as datas e lembra você.</p><button className="button primary" onClick={()=>newProtocol(a)}><Plus size={16}/>Novo protocolo</button></div>
  {a.state.trtProtocols.length?<div className="cards-grid">{a.state.trtProtocols.map(p=>{const st=protocolStatus(p,a.state.trtDoses,a.today),score=punctuality(p,a.state.trtDoses,a.today);return <article className="panel record-card" key={p.id}>
   <div className="record-head"><span className={p.status==='active'?'pill green':'pill'}>{p.status==='active'?'Ativo':'Pausado'}</span>{p.remind&&<span className="pill">Lembrete no Telegram</span>}<div className="record-actions"><button className="icon-button" aria-label={'Editar '+p.title} onClick={()=>a.edit('trtProtocols',p)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={'Excluir '+p.title} onClick={()=>a.remove('trtProtocols',p)}><Trash2 size={15}/></button></div></div>
   <button className="record-title" onClick={()=>a.edit('trtProtocols',p)}>{p.title} · {String(p.dose).replace('.',',')} {p.unit}</button>
   <p className="record-content">A cada {p.intervalDays} dias, desde {dayLabel(p.startDate)}{p.doctor?' · '+p.doctor:''}</p>
   {p.status==='active'&&<><p className="record-content"><CalendarDays size={13}/> Próxima: {dayLabel(st.next)}{st.overdue?' (atrasada há '+plural(st.overdue)+')':''}{score!==null?' · Pontualidade em 90 dias: '+score+'%':''}</p><button className="button outline small" onClick={()=>registerDose(a,p)}><Syringe size={15}/>Registrar aplicação</button></>}
  </article>;})}</div>
  :<section className="panel"><Empty icon={Syringe} title="Nenhum protocolo registrado" description="Cadastre o protocolo prescrito para acompanhar aplicações e receber lembretes." action="Novo protocolo" onAction={()=>newProtocol(a)}/></section>}
  <div className="section-action"><h2>Aplicações</h2></div>
  <Records collection="trtDoses" items={doses} compact emptyTitle="Nenhuma aplicação registrada" emptyText="Registre cada aplicação para acompanhar a pontualidade."/>
 </>;}

function TipsPanel(){const a=useApp();const last=a.state.labExams.filter(e=>e.status==='reviewed'&&e.review?.tips?.length).sort((x,y)=>y.date.localeCompare(x.date))[0];const onProtocol=a.state.trtProtocols.some(p=>p.status==='active');
 return <>
  {last&&<section className="panel"><header className="section-heading"><h2><Sparkles size={18}/> Para você</h2><span className="pill">Exame de {dayLabel(last.date)}</span></header><ul className="review-list">{(last.review.tips as string[]).map((t,i)=><li key={i}>{t}</li>)}</ul></section>}
  {onProtocol&&<p className="quiet-copy">Os hábitos complementam o tratamento, não o substituem.</p>}
  <div className="tips-grid">{TIPS.map(t=>{const Icon=ICONS[t.icon];return <section className="panel" key={t.title}><header className="section-heading"><h2><Icon size={18}/> {t.title}</h2></header><ul>{t.items.map(x=><li key={x}>{x}</li>)}</ul></section>;})}</div>
 </>;}
```

- [ ] **Step 3: Registrar no menu**

`components/norte/catalog.ts`:
1. Acrescentar `FlaskConical` à lista do import de `lucide-react` (linha 1).
2. Em `NAV`, logo depois da linha do `sono`, acrescentar:
`{id:'testosterona',path:'/testosterona',label:'Testosterona',icon:FlaskConical,group:'CUIDE DE VOCÊ'},`

`components/norte/NorteApp.tsx`:
1. Depois de `import {NAV} from './catalog';`, acrescentar `import {TestosteroneView} from './testosterone';`
2. No mapa `views`, trocar `sono:<SleepView/>,` por `sono:<SleepView/>,testosterona:<TestosteroneView/>,`
3. A barra inferior usa posições fixas de `NAV`, e o item novo desloca "Finanças". Trocar `{[NAV[0],NAV[1],NAV[2],NAV[11]].map(n=>` por `{['inicio','agenda','plano','financas'].map(id=>NAV.find(n=>n.id===id)!).map(n=>`

- [ ] **Step 4: Tipos, lint, testes e build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo passa.

- [ ] **Step 5: Commit**

```bash
git add components/norte/testosterone-tips.ts components/norte/testosterone.tsx components/norte/catalog.ts components/norte/NorteApp.tsx
git commit -m "Menu Testosterona com resumo, protocolo e dicas"
```

---

### Task 10: Assistente do app e do Telegram

**Files:**
- Modify: `lib/agent.ts` (`PROPOSABLE`, `LABELS`, `FIELDS`, `checkProposals`, `describeProposal`, nova `testosteroneReport`)
- Modify: `lib/agent-runtime.ts` (schema de sugestão, ferramenta `testosterona`, instruções, `buscar`)
- Test: `tests/agent.test.mjs`

**Interfaces:**
- Consumes: `protocolStatus`, `punctuality`, `finalOverall`, `examHistory`, `classifyMarker`, `rangeText`, `valueText`, `STATUS_LABEL`, `OVERALL_LABEL` (Task 2).
- Produces: `checkProposals(raw, today, s?: Workspace)`; `testosteroneReport(s, today)` → `{protocolos, aplicacoesRecentes, exames}`; `PROPOSABLE` inclui `'trtDoses'`.

- [ ] **Step 1: Escrever os testes que falham**

No topo de `tests/agent.test.mjs`, trocar o import de `../lib/agent.ts` para incluir `describeProposal, testosteroneReport`. Acrescentar ao fim:

```js
const trt={id:'p1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-09-01',status:'active',remind:true};
test('sugere aplicação com o protocolo ativo e recusa sem protocolo',()=>{const s=emptyWorkspace('Geo');s.trtProtocols=[trt];
 const {valid}=checkProposals([{collection:'trtDoses',title:'Apliquei hoje',site:'Glúteo'}],'2026-10-16',s);
 assert.equal(valid[0].item.protocolId,'p1');assert.equal(valid[0].item.dose,250);assert.equal(valid[0].item.date,'2026-10-16');assert.match(describeProposal(valid[0]),/Aplicação · 250 · Glúteo/);
 const none=checkProposals([{collection:'trtDoses',title:'Apliquei'}],'2026-10-16',emptyWorkspace('Geo'));assert.equal(none.valid.length,0);assert.match(none.errors[0],/protocolo/);
 const wrong=checkProposals([{collection:'trtDoses',title:'Apliquei',protocolId:'nao'}],'2026-10-16',s);assert.match(wrong.errors[0],/protocolo/);});
test('relatório de testosterona traz protocolo, aplicações e exames revisados',()=>{const s=emptyWorkspace('Geo');s.trtProtocols=[trt];s.trtDoses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-10-02',dose:250,site:'Glúteo'}];
 s.labExams=[{id:'e1',title:'E',date:'2026-10-01',status:'reviewed',markers:[{key:'estradiol',label:'Estradiol',value:50,unit:'pg/mL',refMin:11,refMax:44}],review:{overall:'attention',summary:'Estradiol um pouco alto.',points:[],tips:[],reviewedAt:'2026-10-01T10:00:00Z',model:'m'}},{id:'e2',title:'R',date:'2026-10-05',status:'draft',markers:[]}];
 const r=testosteroneReport(s,'2026-10-16');assert.equal(r.protocolos[0].id,'p1');assert.equal(r.protocolos[0].proximaAplicacao,'2026-10-16');assert.equal(r.aplicacoesRecentes[0].data,'2026-10-02');
 assert.equal(r.exames.length,1);assert.equal(r.exames[0].situacao,'Pontos de atenção');assert.equal(r.exames[0].marcadores[0].classificacao,'Alto');assert.equal(r.exames[0].parecer,'Estradiol um pouco alto.');});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`testosteroneReport` não existe; `trtDoses` não sugerível).

- [ ] **Step 3: Implementar em `lib/agent.ts`**

1. Acrescentar o import: `import { protocolStatus, punctuality, finalOverall, classifyMarker, rangeText, valueText, STATUS_LABEL, OVERALL_LABEL } from './testosterone.ts';` e `import type { Marker } from './exam-schema.ts';`
2. `export const PROPOSABLE = ['tasks','transactions','notes','trtDoses'] as const;`
3. `LABELS`: acrescentar `trtDoses:'Aplicação'`.
4. `FIELDS` (da busca): acrescentar `'dose','intervalDays','site','lab'`.
5. Substituir `checkProposals` por:

```ts
function proposalDefaults(collection:unknown,fields:Record<string,unknown>,today:string,s?:Workspace){
 if(collection==='tasks')return {date:today,type:'task',repeat:'none',section:'pessoal',priority:'normal'};
 if(collection==='transactions')return {date:today};
 if(collection==='trtDoses'){const protocols=s?.trtProtocols||[],active=protocols.filter(p=>p.status==='active');
  const p=fields.protocolId?protocols.find(x=>x.id===fields.protocolId):active.length===1?active[0]:undefined;
  if(!p)throw new Error('cadastre ou escolha o protocolo no menu Testosterona');
  return {date:today,title:'Aplicação: '+p.title,protocolId:p.id,...(p.dose?{dose:p.dose}:{})};}
 return {};
}
export function checkProposals(raw:unknown,today:string,s?:Workspace){
 const valid:Proposal[]=[],errors:string[]=[];
 for(const entry of (Array.isArray(raw)?raw:[]).slice(0,15)){
  // O id é descartado: confirmPlan faz upsert, e um id vindo do modelo poderia sobrescrever um registro existente.
  const {collection,...fields}=(entry&&typeof entry==='object'?entry:{}) as Record<string,unknown>;delete fields.id;
  try{
   if(!(PROPOSABLE as readonly unknown[]).includes(collection))throw new Error('só é possível sugerir tarefas, lançamentos, notas e aplicações');
   valid.push({collection:collection as Collection,item:validateItem(collection as Collection,{...proposalDefaults(collection,fields,today,s),...fields})});
  }catch(e){errors.push(String(fields.title||'Item').slice(0,80)+': '+(e instanceof Error?e.message:'inválido'));}
 }
 return {valid,errors};
}
```

6. Em `describeProposal`, trocar o início `return [p.collection==='transactions'?` por `return [p.collection==='trtDoses'?'Aplicação'+(p.item.dose?' · '+String(p.item.dose).replace('.',','):'')+(p.item.site?' · '+p.item.site:''):p.collection==='transactions'?`.
7. Acrescentar ao fim do arquivo:

```ts
export function testosteroneReport(s:Workspace,today:string){
 const exams=s.labExams.filter(e=>e.status==='reviewed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
 return {
  protocolos:s.trtProtocols.map(p=>{const st=protocolStatus(p,s.trtDoses,today),score=punctuality(p,s.trtDoses,today);return {id:p.id,medicamento:p.title,dose:p.dose+' '+(p.unit||'mg'),intervaloDias:p.intervalDays,inicio:p.startDate,situacao:p.status==='paused'?'pausado':'ativo',proximaAplicacao:st.next,...(st.overdue?{diasDeAtraso:st.overdue}:{}),...(score!==null?{pontualidade90dias:score+'%'}:{})};}),
  aplicacoesRecentes:s.trtDoses.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(d=>({data:d.date,...(d.dose?{dose:d.dose}:{}),...(d.site?{local:d.site}:{}),...(d.notes?{observacoes:clip(d.notes,200)}:{})})),
  exames:exams.map(e=>({data:e.date,...(e.lab?{laboratorio:e.lab}:{}),situacao:OVERALL_LABEL[finalOverall(e,s.labExams)],marcadores:(e.markers as Marker[]).map(m=>({nome:m.label,valor:valueText(m),faixa:rangeText(m),classificacao:STATUS_LABEL[classifyMarker(m)]})),...(e.review?{parecer:e.review.summary}:{})})),
 };
}
```

- [ ] **Step 4: Implementar em `lib/agent-runtime.ts`**

1. No import de `./agent`, acrescentar `testosteroneReport`.
2. No schema `proposal`: trocar a descrição de `collection` por `'tasks: tarefa, hábito ou compromisso; transactions: receita ou despesa; notes: anotação ou ideia; trtDoses: aplicação de testosterona que o usuário disse ter feito'` e acrescentar os campos `dose:z.number().positive().optional().describe('Dose da aplicação, na unidade do protocolo')`, `site:z.enum(['Glúteo','Coxa','Deltoide','Abdômen','Outro']).optional()`, `protocolId:z.string().optional().describe('id do protocolo (ferramenta testosterona); só quando houver mais de um protocolo ativo')`.
3. Em `agentInstructions`, logo depois da linha `Pedido de tarefa ambíguo: ...`, acrescentar:

```
Testosterona: consulte a ferramenta testosterona antes de falar de exames, protocolo ou aplicações. Explique os resultados em linguagem simples usando a classificação do app e recomende levar ao médico os pontos de atenção. Nunca sugira mudar dose, nem começar, parar ou comprar testosterona ou outros medicamentos; nesses casos, oriente conversar com o médico e ofereça ajuda para preparar as perguntas da consulta. Quando o usuário contar que fez uma aplicação, sugira registrá-la com propor_acoes (trtDoses).
```

4. Em `agentTools`, acrescentar a ferramenta (antes de `propor_acoes`):

```ts
 testosterona:tool({description:'Protocolo de testosterona do usuário, próximas aplicações, aplicações recentes e os últimos exames revisados com classificação e parecer.',inputSchema:z.object({}),execute:async()=>safe(()=>testosteroneReport(state,today))}),
```

5. Em `buscar`, acrescentar à descrição `, labExams (exames de testosterona), trtProtocols (protocolos de reposição), trtDoses (aplicações)` antes de `.'`.
6. Em `propor_acoes`, trocar `checkProposals(itens,today)` por `checkProposals(itens,today,state)` e a descrição por `'Mostra ao usuário sugestões de tarefas, lançamentos, notas ou aplicações de testosterona para ele revisar e confirmar. Não salva nada.'`.

- [ ] **Step 5: Rodar testes, tipos e lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/agent.ts lib/agent-runtime.ts tests/agent.test.mjs
git commit -m "Assistente consulta testosterona e sugere registrar aplicações"
```

---

### Task 11: Lembrete no Telegram

**Files:**
- Create: `lib/trt-reminders.ts`
- Create: `app/api/cron/trt-reminders/route.ts`
- Modify: `lib/telegram-store.ts` (nova `listLinks`)
- Modify: `app/api/telegram/route.ts` (`onCallback`)
- Modify: `vercel.json` (cron)
- Test: `tests/trt-reminders.test.mjs` (novo) e `package.json` (script `test`)

**Interfaces:**
- Consumes: `dueReminder`, `protocolStatus`, `doseId` (Task 2); comando `patch` (Task 1).
- Produces: `REMINDER_TEXT`; `reminderButtons(protocolId)`; `parseTrtCallback(data)` → `{action: 'done'|'snooze'; protocolId}|null`; `type ReminderDeps`; `sendDueReminders(d)` → `{checked, sent, failed}`; `trtCallbackAction(s, today, cb)` → `{command?: Command; reply: string}`; `listLinks()` → `{chatId, userId}[]`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/trt-reminders.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, applyCommand } from '../lib/core.ts';
import { sendDueReminders, parseTrtCallback, trtCallbackAction, REMINDER_TEXT } from '../lib/trt-reminders.ts';

const protocol={id:'p1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-09-01',status:'active',remind:true};
function space(extra={}){const s=emptyWorkspace('Geo');s.trtProtocols=[{...protocol,...extra}];s.trtDoses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-10-02'}];return s;}

test('envia um lembrete por protocolo devido, marca o dia e não para por erro de um usuário',async()=>{const states={u1:space(),u2:space({remind:false}),u3:space()};const sent=[];
 const r=await sendDueReminders({now:new Date('2026-10-16T11:00:00Z'),links:async()=>[{chatId:'c1',userId:'u1'},{chatId:'c2',userId:'u2'},{chatId:'c3',userId:'quebrado'},{chatId:'c4',userId:'u3'}],load:async u=>{if(u==='quebrado')throw new Error('falhou');return {state:states[u]};},mutate:async(u,c)=>{states[u]=applyCommand(states[u],c,'2026-10-16');},send:async(chatId,text,markup)=>{sent.push([chatId,text,markup.inline_keyboard[0].map(b=>b.callback_data)]);}});
 assert.deepEqual(r,{checked:4,sent:2,failed:1});assert.deepEqual(sent[0],['c1',REMINDER_TEXT,['trt:d:p1','trt:s:p1']]);assert.equal(sent[1][0],'c4');assert.equal(states.u1.trtProtocols[0].remindedOn,'2026-10-16');
 const again=await sendDueReminders({now:new Date('2026-10-16T11:30:00Z'),links:async()=>[{chatId:'c1',userId:'u1'}],load:async u=>({state:states[u]}),mutate:async()=>{},send:async()=>{sent.push('dup');}});assert.equal(again.sent,0);});
test('usa o fuso do usuário para decidir o dia',async()=>{let count=0;await sendDueReminders({now:new Date('2026-10-16T02:00:00Z'),links:async()=>[{chatId:'c',userId:'u'}],load:async()=>({state:space()}),mutate:async()=>{},send:async()=>{count++;}});assert.equal(count,0);});
test('lê os botões do lembrete',()=>{assert.deepEqual(parseTrtCallback('trt:d:p1'),{action:'done',protocolId:'p1'});assert.deepEqual(parseTrtCallback('trt:s:p1'),{action:'snooze',protocolId:'p1'});assert.equal(parseTrtCallback('add:abc'),null);assert.equal(parseTrtCallback('trt:x:p1'),null);});
test('Apliquei registra uma vez por dia e informa a próxima data',()=>{let s=space();const first=trtCallbackAction(s,'2026-10-16',{action:'done',protocolId:'p1'});assert.equal(first.reply,'Aplicação registrada. Próxima: 30/10/2026.');
 s=applyCommand(s,first.command,'2026-10-16');s=applyCommand(s,trtCallbackAction(s,'2026-10-16',{action:'done',protocolId:'p1'}).command,'2026-10-16');
 assert.equal(s.trtDoses.filter(d=>d.date==='2026-10-16').length,1);assert.equal(s.trtDoses.find(d=>d.date==='2026-10-16').dose,250);});
test('Adiar 1 dia grava o adiamento; protocolo removido avisa',()=>{let s=space();const r=trtCallbackAction(s,'2026-10-16',{action:'snooze',protocolId:'p1'});s=applyCommand(s,r.command,'2026-10-16');
 assert.equal(s.trtProtocols[0].snoozedUntil,'2026-10-17');assert.equal(r.reply,'Combinado, lembro amanhã.');
 const gone=trtCallbackAction(s,'2026-10-16',{action:'done',protocolId:'nao'});assert.equal(gone.command,undefined);assert.match(gone.reply,/não existe/);});
```

Acrescentar ` tests/trt-reminders.test.mjs` ao fim do script `test` em `package.json`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`Cannot find module '../lib/trt-reminders.ts'`).

- [ ] **Step 3: Implementar a lógica**

Criar `lib/trt-reminders.ts`:

```ts
import {todayInZone,addDays} from './core.ts';import {dueReminder,protocolStatus,doseId} from './testosterone.ts';import type {Workspace,Command} from './types.ts';
// Lembrete diário das aplicações pelo Telegram. Texto discreto: a notificação aparece na tela de bloqueio.
export const REMINDER_TEXT='Lembrete do GeoAI: hoje é dia da sua aplicação.';
export const reminderButtons=(protocolId:string)=>({inline_keyboard:[[{text:'✅ Apliquei',callback_data:'trt:d:'+protocolId},{text:'Adiar 1 dia',callback_data:'trt:s:'+protocolId}]]});
export function parseTrtCallback(data:string){const m=/^trt:([ds]):([\w-]{1,56})$/.exec(data);return m?{action:m[1]==='d'?'done' as const:'snooze' as const,protocolId:m[2]}:null;}
export type ReminderDeps={links:()=>Promise<{chatId:string;userId:string}[]>;load:(userId:string)=>Promise<{state:Workspace}>;mutate:(userId:string,command:Command)=>Promise<unknown>;send:(chatId:string,text:string,markup:ReturnType<typeof reminderButtons>)=>Promise<unknown>;now?:Date};
export async function sendDueReminders(d:ReminderDeps){let checked=0,sent=0,failed=0;
 for(const link of await d.links()){checked++;
  try{const {state}=await d.load(link.userId);const today=todayInZone(state.profile.timezone,d.now);
   for(const p of state.trtProtocols.filter(x=>dueReminder(x,state.trtDoses,today))){await d.send(link.chatId,REMINDER_TEXT,reminderButtons(p.id));sent++;await d.mutate(link.userId,{type:'patch',collection:'trtProtocols',id:p.id,item:{remindedOn:today}});}}
  catch(e){failed++;console.error('trt reminder',e instanceof Error?e.message:'erro');}}
 return {checked,sent,failed};}
export function trtCallbackAction(s:Workspace,today:string,cb:{action:'done'|'snooze';protocolId:string}):{command?:Command;reply:string}{
 const p=s.trtProtocols.find(x=>x.id===cb.protocolId);if(!p)return {reply:'Este protocolo não existe mais no seu GeoAI.'};
 if(cb.action==='snooze')return {command:{type:'patch',collection:'trtProtocols',id:p.id,item:{snoozedUntil:addDays(today,1)}},reply:'Combinado, lembro amanhã.'};
 const id=doseId(p.id,today),dose={id,title:'Aplicação: '+p.title,date:today,protocolId:p.id,...(p.dose?{dose:p.dose}:{})};
 const next=protocolStatus(p,[...s.trtDoses.filter(x=>x.id!==id),dose],today).next;
 return {command:{type:'upsert',collection:'trtDoses',item:dose},reply:'Aplicação registrada. Próxima: '+next.split('-').reverse().join('/')+'.'};
}
```

Em `lib/telegram-store.ts`, acrescentar ao fim:

```ts
export async function listLinks(){return await getDb().select({chatId:telegramLinks.chatId,userId:telegramLinks.userId}).from(telegramLinks);}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Rota do cron, botões no webhook e agenda da Vercel**

Criar `app/api/cron/trt-reminders/route.ts`:

```ts
import {sendDueReminders} from '@/lib/trt-reminders';import {listLinks} from '@/lib/telegram-store';import {loadWorkspace,mutateWorkspace} from '@/lib/workspace-server';import {telegramApi} from '@/lib/telegram';
export const dynamic='force-dynamic';export const maxDuration=60;
// Chamada pela tarefa agendada da Vercel, que envia Authorization: Bearer <CRON_SECRET>.
export async function GET(request:Request){const secret=process.env.CRON_SECRET,token=process.env.TELEGRAM_BOT_TOKEN;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 if(!token)return Response.json({checked:0,sent:0,failed:0});
 const api=telegramApi(token,process.env.TELEGRAM_API_BASE||undefined);
 return Response.json(await sendDueReminders({links:listLinks,load:userId=>loadWorkspace(userId,''),mutate:(userId,command)=>mutateWorkspace(userId,'',command),send:(chatId,text,markup)=>api('sendMessage',{chat_id:chatId,text,reply_markup:markup})}));}
```

Em `app/api/telegram/route.ts`:
1. Acrescentar ao fim da linha de imports: `import {parseTrtCallback,trtCallbackAction} from '@/lib/trt-reminders';`
2. Em `onCallback`, mover a linha `const clearButtons=...` para logo depois de `if(!await claimUpdate(e.chatId,e.updateId))return answer('');` e, em seguida, acrescentar:

```ts
 const trt=parseTrtCallback(e.data);
 if(trt){const {state}=await loadWorkspace(link.userId,'');const r=trtCallbackAction(state,todayInZone(state.profile.timezone),trt);
  if(r.command){try{await mutateWorkspace(link.userId,'',r.command);}catch(err){console.error('telegram trt',err);return answer('Não foi possível salvar agora. Tente de novo.');}}
  await clearButtons();await answer(trt.action==='done'?'Registrado!':'Adiado.');return sendText(api,e.chatId,r.reply);}
```

O restante de `onCallback` (`const [action,id]=e.data.split(':')...`) fica como está.

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run db:migrate && npm run build",
  "crons": [{ "path": "/api/cron/trt-reminders", "schedule": "0 11 * * *" }]
}
```

- [ ] **Step 6: Tipos, lint, testes e build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo passa; o build lista `/api/cron/trt-reminders`.

- [ ] **Step 7: Commit**

```bash
git add lib/trt-reminders.ts lib/telegram-store.ts app/api/cron app/api/telegram/route.ts vercel.json tests/trt-reminders.test.mjs package.json
git commit -m "Lembrete diário das aplicações pelo Telegram com botões Apliquei e Adiar"
```

---

### Task 12: Documentação, infraestrutura, deploy e verificação em produção

**Files:**
- Modify: `README.md`, `.env.example`

**Interfaces:**
- Consumes: tudo das Tasks 1 a 11.

- [ ] **Step 1: Documentação**

Em `.env.example`, acrescentar:

```
# Menu Testosterona
# Arquivos dos exames: conecte um Vercel Blob privado ao projeto (cria BLOB_STORE_ID/BLOB_READ_WRITE_TOKEN).
# Localmente, EXAM_FILES=memory guarda os arquivos na memória do servidor de desenvolvimento.
EXAM_FILES=
# Protege a rota do lembrete diário (/api/cron/trt-reminders). A Vercel envia este valor no cabeçalho Authorization.
CRON_SECRET=
```

No `README.md`, acrescentar uma seção "Menu Testosterona" com: o que o menu faz (exames lidos pela IA e conferidos pelo usuário, classificação pela faixa do laudo feita pelo código, parecer da IA sem orientação de dose, protocolo com aplicações e lembrete no Telegram, dicas); onde ficam os arquivos (Blob privado, prefixo `exames/<userId>/`, apagados com o exame e com "Apagar meus dados"); as cotas (20 envios e 40 pareceres por dia); o cron (`0 11 * * *`, `CRON_SECRET`); e a variável `EXAM_FILES=memory` para desenvolvimento local.

- [ ] **Step 2: Verificação final local**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo passa. Registrar a contagem de testes.

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "Documenta o menu Testosterona"
```

- [ ] **Step 4: Criar o Blob privado e o `CRON_SECRET`**

Run: `npx --yes vercel@64.5.0 blob create-store geoai-exames --access private --region iad1 --environment production --environment preview --yes`
Expected: store criado e conectado ao projeto `geo-ai`. Conferir com `npx --yes vercel@64.5.0 env ls production` que apareceu `BLOB_STORE_ID` ou `BLOB_READ_WRITE_TOKEN`.

Gerar o segredo no scratchpad (fora do repositório) e cadastrar como sensível:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > "<scratchpad>/cron-secret.txt"
npx --yes vercel@64.5.0 env add CRON_SECRET production --sensitive < "<scratchpad>/cron-secret.txt"
```

Expected: `Added Environment Variable CRON_SECRET`.

- [ ] **Step 5: Publicar**

Pedir ao usuário para rodar `! git push origin main`. Acompanhar o deploy com `npx --yes vercel@64.5.0 ls geo-ai --prod` até `● Ready`. Se falhar, ler `npx --yes vercel@64.5.0 inspect <url> --logs`. A migração `usage_counters` roda no build (`npm run db:migrate`).

- [ ] **Step 6: Verificar em produção**

1. **Cron:** `curl -s -H "Authorization: Bearer $(cat <scratchpad>/cron-secret.txt)" https://geo-ai-mocha.vercel.app/api/cron/trt-reminders` → JSON `{"checked":N,"sent":...,"failed":0}`. Sem o cabeçalho → `401`. Apagar `cron-secret.txt` depois.
2. **Rotas sem login:** `POST /api/exams` e `GET /api/exams/x/file` sem sessão → `401`.
3. **Fluxo com usuário de teste do Clerk:** precisa da chave secreta do Clerk. Se o uso dela for bloqueado pelas permissões, pular para o roteiro manual (item 4). Com a chave:
   - criar dois usuários de teste;
   - com o primeiro, abrir `/testosterona` (Playwright), enviar um PDF de exemplo gerado no scratchpad com testosterona total, estradiol alto e hematócrito 55%, e confirmar que a conferência abre com os valores lidos (isso confirma que o `gpt-6-luna` lê PDF);
   - salvar e revisar, e confirmar o selo "Leve ao médico em breve";
   - abrir "Ver arquivo";
   - com o segundo usuário, pedir `/api/exams/<id>/file` → `404`;
   - cadastrar um protocolo com início hoje e conferir o item "Aplicação: ..." na Agenda: abrir leva ao menu, sem botões de editar e excluir, e marcar registra a aplicação;
   - excluir o exame;
   - apagar os dois usuários e as linhas deles em `workspaces`.
4. **Roteiro manual para o usuário** (se o item 3 não puder rodar), a ser entregue no relatório final:
   - abrir Testosterona → Exames → Enviar exame com um laudo real, conferir e salvar;
   - cadastrar o protocolo com "Lembrar no Telegram" ligado;
   - conferir a Agenda;
   - no dia previsto, tocar "Apliquei" no Telegram.

- [ ] **Step 7: Atualizar a memória do projeto**

Atualizar `geoai-telegram-pending.md` na memória com: Blob `geoai-exames` conectado, `CRON_SECRET` cadastrado e o cron diário ativo.
