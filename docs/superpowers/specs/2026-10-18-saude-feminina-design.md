# Menu Saúde feminina

Data: 2026-10-18. Parte 2 da versão feminina; a Parte 1 está em `2026-10-18-versao-feminina-design.md`. As duas partes vão para produção juntas, no mesmo PR (branch `feat/versao-feminina`).

## Objetivo

Para quem escolheu ser tratada no feminino, o menu Saúde feminina ocupa o lugar do menu Testosterona. Ele reúne ciclo menstrual, anticoncepcional e hormônios com lembrete no Telegram, exames lidos pela IA, preventivos e dicas. Como no Testosterona, quem calcula datas e classifica valores é o código; a IA só lê laudos, escreve pareceres e conversa.

## Decisões tomadas com o usuário

- O menu tem as quatro áreas propostas: ciclo, anticoncepcional e hormônios, exames lidos pela IA, e preventivos com dicas.
- O lembrete do anticoncepcional chega na hora escolhida. Na Vercel Hobby, cada cron roda uma vez por dia com até 59 min de atraso, mas o projeto pode ter até 100 crons. Por isso usamos 24 crons diários, um por hora, todos no mesmo caminho (a Vercel aceita e envia o cabeçalho `x-vercel-cron-schedule`).
- Os métodos cobertos são: uso diário (pílula, comprimido ou gel), injeção mensal ou trimestral, e DIU/implante.
- Abordagem: reaproveitar a base do Testosterona (coleção `labExams`, rotas e telas de exame, padrão de lembrete e de botões do Telegram) em vez de duplicar.

## Visibilidade

- Item de menu `saude-feminina`, caminho `/saude-feminina`, rótulo "Saúde feminina", grupo "CUIDE DE VOCÊ", na posição do Testosterona.
- `hiddenSections`:
  - `female` esconde `testosterona`.
  - `male` e `''` escondem `saude-feminina`.
- Itens calculados na Agenda (aplicações, uso diário, previsões, preventivos) seguem a mesma regra.
- Os lembretes do Telegram de uma seção oculta não são enviados.
- Nada é apagado ao trocar de gênero.

## Abas

Resumo · Ciclo · Anticoncepcional · Exames · Preventivos · Dicas. Abaixo do título fica o aviso fixo: "As previsões são estimativas e não substituem seu médico nem servem como método contraceptivo."

### Resumo

- Dia do ciclo e próxima menstruação prevista ("em N dias", "é hoje" ou "atrasada há N dias"). Sem registro, um convite para registrar a última menstruação.
- Janela fértil estimada, com datas.
- Cuidado de hoje, para cada método ativo:
  - uso diário: botão **Tomei** ou "Pausa até dd/mm";
  - injeção: próxima data e botão **Registrar aplicação**;
  - DIU/implante: data de troca, com destaque nos 30 dias antes.
- Próximo preventivo e a situação dele.
- Último exame revisado, com a situação geral e os pontos de atenção do parecer.

### Ciclo

- Botões **Menstruação começou** (abre o formulário com a data de hoje) e **Registrar sintomas**.
- Estatísticas: duração média do ciclo, duração média da menstruação, ciclos considerados.
- Calendário simples dos próximos 35 dias, marcando menstruação prevista, janela fértil e ovulação.
- Históricos de menstruações e de sintomas, com edição e exclusão (componente `Records`).

### Anticoncepcional

- Cartões dos métodos (ativo ou pausado, lembrete no Telegram, próxima data), com editar e excluir.
- Botão **Novo método**.
- Histórico dos registros "Tomei" e das aplicações.

### Exames

- O mesmo `ExamsPanel` do Testosterona, sobre a mesma coleção `labExams`. Mudanças para mulheres:
  - o cartão mostra o número de marcadores, e não "Testosterona total";
  - o exame digitado começa com a linha "Estradiol".

### Preventivos

- Lista com situação: "em dia", "vence em N dias" (até 30 dias), "atrasado" ou "sem registro".
- Botões **Fiz hoje** (registra a data de hoje) e editar.
- Sugestões de um toque, que só aparecem se ainda não existirem: Ginecologista (12 meses), Papanicolau (12), Mamografia (12), Ultrassom transvaginal (12), Densitometria óssea (24).

### Dicas

- Para você: as dicas do parecer do último exame revisado.
- Seções fixas e revisadas: Alimentação e ferro, Cólica e desconforto, Sono, Exercício ao longo do ciclo, Saúde íntima, Quando procurar o médico.

## Dados (workspace)

Coleções novas, com espaços antigos ganhando a lista vazia via `ADDED_COLLECTIONS`:

| Coleção | Campos | Regras |
|---|---|---|
| `periods` | `title`, `date` (início), `endDate`, `flow` (`leve`/`moderado`/`intenso`), `notes` | `date` obrigatória; `endDate` não pode ser anterior a `date` nem ficar a mais de 15 dias dela; uma por data de início. |
| `symptoms` | `title`, `date`, `symptoms` (lista), `mood` (1 a 5), `notes` | `date` obrigatória; um registro por data; cada sintoma vem da lista fixa. |
| `contraceptives` | `title`, `method` (`daily`/`injection`/`iud`), `startDate`, `activeDays`, `pauseDays`, `intervalDays`, `changeDate`, `time` (HH:mm), `remind`, `status` (`active`/`paused`), `doctor`, `notes`, `remindedOn`, `snoozedUntil`, `snoozeHour` | Veja abaixo. |
| `contraceptiveDoses` | `title`, `date`, `methodId`, `notes` | `date` e `methodId` obrigatórios; um registro por método por dia; id fixo `take-<methodId>-<data>`. |
| `preventives` | `title`, `intervalMonths` (1 a 120), `lastDate`, `doctor`, `notes` | `lastDate` é opcional. |

Lista fixa de sintomas: Cólica, Dor de cabeça, Inchaço, Seios sensíveis, Acne, Cansaço, Alteração de humor, Ansiedade, Insônia, Desejo por doce, Náusea, Sangramento fora do período.

Regras de `contraceptives` por método:

- `daily`: `startDate` é o primeiro dia da cartela atual. `activeDays` vai de 1 a 90 (padrão 21) e `pauseDays` de 0 a 30 (padrão 7). `time` é obrigatório quando `remind` está ligado.
- `injection`: `intervalDays` vai de 1 a 120 (30 para mensal, 90 para trimestral). `startDate` é a data da última aplicação antes do cadastro. `time` é obrigatório quando `remind` está ligado.
- `iud`: `startDate` é a colocação e `changeDate` é obrigatória e posterior a ela. Não tem lembrete diário.

`validateItem` passa a aceitar as chaves novas: `endDate`, `changeDate` e `lastDate` como datas; `activeDays`, `pauseDays`, `intervalMonths` e `snoozeHour` como números; `symptoms` como lista de textos.

## Regras puras (`lib/female-health.ts`)

Sem dependências de interface, todas com testes.

**Ciclo**
- `cycleStats(periods)`:
  - inícios ordenados;
  - intervalos entre inícios consecutivos, ignorando os menores que 15 ou maiores que 60 dias;
  - média dos últimos 6 intervalos válidos, arredondada; sem intervalo válido, 28;
  - duração média da menstruação, pelos registros com `endDate`; sem eles, 5.
- `cyclePrediction(periods, today)`:
  - devolve último início, dia do ciclo (`hoje − último início + 1`), próxima menstruação (`último início + média`), atraso em dias (`hoje − próxima`, quando positivo), ovulação (`próxima − 14`) e janela fértil (`ovulação − 5` até `ovulação + 1`);
  - sem registros, devolve `null`;
  - com atraso, a próxima continua sendo a data já vencida e não pula de ciclo.
- `cyclePhase(periods, date)` devolve `menstrual`, `folicular`, `ovulatória`, `lútea` ou `null`:
  - menstrual: dia 1 até a duração média;
  - ovulatória: ovulação − 1 até ovulação + 1;
  - folicular: entre as duas anteriores;
  - lútea: depois da ovulatória.
- `forecastDays(periods, from, days)`: lista de datas com marcação (menstruação prevista, fértil, ovulação), usada pelo calendário.

**Métodos**
- `dailyStatus(method, date)`: `{active:boolean, packDay, pauseUntil?, nextPackStart}`. O dia na cartela é `(date − startDate) mod (activeDays + pauseDays)`, e o método está ativo se esse valor for menor que `activeDays`. Antes de `startDate`, ou com o método pausado, fica inativo.
- `injectionNext(method, doses)`: última aplicação registrada mais `intervalDays`; sem registro, `startDate` mais `intervalDays`.
- `iudStatus(method, today)`: dias até `changeDate`, e se está dentro dos 30 dias anteriores.
- `methodDueOn(method, doses, date)`: o método pede ação naquele dia (uso diário ativo, ou injeção cuja próxima data é aquele dia).
- `reminderHour(time)`: hora cheia, arredondando para cima quando há minutos (21:30 vira 22), com teto em 23.

**Preventivos**
- `preventiveStatus(p, today)`: próxima data = `lastDate` mais `intervalMonths` meses, ajustando o fim do mês. Situação: `none` (sem `lastDate`), `late`, `soon` (até 30 dias) ou `ok`.

**Lembretes**
- `femaleReminderDue(method, doses, today, hour)` só envia quando:
  - o método está ativo e com `remind`;
  - o método é `daily` ou `injection`;
  - para `daily`: hoje é dia ativo e não há registro de hoje;
  - para `injection`: hoje está entre a próxima data e 3 dias depois, e não há aplicação registrada desde a próxima data;
  - `hour` é maior ou igual a `reminderHour(time)`;
  - `remindedOn` é diferente de hoje;
  - não há adiamento valendo. Adiado para hoje (`snoozedUntil == hoje` e `snoozeHour` definido) só volta quando `hour ≥ snoozeHour`. Adiado para outro dia (`snoozedUntil > hoje`) não envia.

## Agenda

`scheduledItems` ganha itens calculados, só quando `saude-feminina` não está oculta:

- **Uso diário ativo naquele dia**: `{id: method.id, title: 'Uso diário: '+title, type:'habit', section:'saude', _collection:'contraceptives'}`. Concluído quando existe `contraceptiveDoses` do método naquela data. Marcar cria o registro com o id fixo, e desmarcar o apaga, como já acontece com `trtDoses`.
- **Injeção prevista naquele dia**: `title: 'Injeção: '+title`, `type:'event'`, mesma conclusão.
- **Menstruação prevista** (só na data prevista): `{id:'period-forecast', title:'Menstruação prevista', type:'event', _collection:'forecast', readonly:true}`.
- **Preventivo vencendo naquele dia**: `{id: p.id, title: 'Preventivo: '+title, type:'event', _collection:'preventives', readonly:true}`.

Itens `readonly` aparecem sem caixa de marcar e sem editar/excluir; o clique leva a `/saude-feminina`. As aplicações de testosterona saem da Agenda quando `testosterona` está oculta.

## Lembretes no Telegram

- Módulo `lib/female-reminders.ts`, no mesmo padrão de `trt-reminders.ts`, com dependências injetadas.
- **Envio** (`sendFemaleReminders(deps)`): para cada chat ligado, carrega o espaço; pula se `saude-feminina` estiver oculta. Calcula a data e a hora local no fuso do perfil. Para cada método com `femaleReminderDue`, envia a mensagem com os botões e registra `remindedOn: hoje` (com `snoozedUntil` e `snoozeHour` vazios).
- **Texto** discreto, porque aparece na tela de bloqueio: "Lembrete do GeoAI: hora do seu cuidado." Botões:
  - uso diário: `✅ Tomei` (`fh:d:<id>`) e `Lembrar em 1h` (`fh:h:<id>`);
  - injeção: `✅ Tomei` (`fh:d:<id>`) e `Adiar 1 dia` (`fh:s:<id>`).
- **Callback** (`femaleCallbackAction(state, today, hour, cb)`):
  - Tomei: cria o registro do dia com o id fixo; se já existir, apenas avisa. A resposta informa o próximo cuidado ("Registrado. Próxima pílula amanhã." / "Pausa até dd/mm." / "Próxima injeção: dd/mm.").
  - Lembrar em 1h: limpa `remindedOn` e grava `snoozedUntil: hoje` e `snoozeHour: hora + 1`. Às 23h, adia para amanhã, com `snoozedUntil` de amanhã e sem `snoozeHour`.
  - Adiar 1 dia: `snoozedUntil` de amanhã.
  - Método inexistente: "Este cuidado não existe mais no seu GeoAI."
- **Rota** `/api/cron/female-reminders`: mesma autenticação `CRON_SECRET` do cron de testosterona. Em `vercel.json`, 24 entradas `{"path":"/api/cron/female-reminders","schedule":"0 H * * *"}`, para H de 0 a 23 (UTC; a rota converte para o fuso de cada pessoa).
- **Webhook do Telegram**: trata o prefixo `fh:` antes das propostas, como já faz com `trt:`.
- O cron de testosterona deixa de enviar para quem tem `testosterona` oculta.

## Exames

- **Marcadores novos**, inseridos antes de `outro` em `MARKER_KEYS` e em `MARKER_LABEL`: `progesterona`, `ferritina`, `ferro`, `amh`, `beta_hcg`, `vitamina_b12`, `insulina`.
- **Leitura**: `extract(file, context)` recebe `{gender, phase}`. A fase é a do dia do envio, calculada pelos registros de menstruação, ou `folicular` quando não há registro. No feminino, a instrução de faixa troca "use a de homem adulto" por: "use a de mulher adulta; quando houver faixas por fase do ciclo, use a da fase <fase>; quando houver faixa para quem está grávida e para quem não está, use a de quem não está grávida". A conferência e a correção continuam com a pessoa, antes de salvar.
- **Parecer**: `review({text, gender})`. No feminino, o texto passa a ser "Você é o GeoAI e ajuda mulheres a entender exames hormonais e de rotina." O resumo considera a fase do ciclo na coleta e o método anticoncepcional ativo. Nunca sugere começar, parar ou trocar anticoncepcional, hormônios ou outros medicamentos, nem indica suplementos ou doses. Sem diagnóstico. As dicas citam hábitos (alimentação e ferro, sono, exercício, estresse). O texto masculino não muda.
- **`reviewContext`** no feminino troca as linhas de protocolo de testosterona por: fase do ciclo e dia do ciclo na data da coleta (quando houver registros) e métodos ativos ("Método ativo: <title> (uso diário/injeção/DIU)").
- **Alertas críticos femininos** (`femaleCriticalFlags`), que no feminino substituem os masculinos:
  - hemoglobina abaixo de 8 g/dL;
  - TSH abaixo de 0,1 ou acima de 10 (mUI/L ou µUI/mL);
  - beta-hCG acima de 5 mUI/mL: "Beta-hCG positivo: confirme com seu médico."
- **`guardStateCommand`**: a mensagem passa a ser "Use a aba Exames para alterar exames."

## Assistente (app e Telegram)

- **Ferramenta `saude_feminina`**, presente só quando a seção está visível. Devolve `femaleHealthReport(s, today)`:
  - ciclo: último início, dia do ciclo, próxima prevista, atraso, janela fértil, médias;
  - sintomas dos últimos 7 dias;
  - métodos: situação de hoje, próxima ação e troca do DIU;
  - preventivos com situação;
  - os 3 últimos exames revisados, como no relatório de testosterona.
- A ferramenta `testosterona` só fica presente quando `testosterona` está visível.
- **Propostas** aceitam `periods` (padrão `title:'Menstruação'`, `date: hoje`) e `contraceptiveDoses`:
  - o método é o informado em `methodId`, ou o único método ativo de uso diário ou injeção; sem método, erro "cadastre o método no menu Saúde feminina";
  - o registro duplicado no dia vira erro.
- **Regras do prompt no feminino**: consulte a ferramenta antes de falar de ciclo, métodos ou exames; as previsões são estimativas; não diagnostique; não sugira começar, parar ou trocar método ou hormônio; em suspeita de gravidez, oriente fazer um teste e falar com o médico; quando ela contar que a menstruação começou ou que tomou, sugira registrar.

## Interface e formulários

- `components/norte/female-health.tsx` (`FemaleHealthView` e os painéis) e `components/norte/female-health-tips.ts`.
- **`Field.showIf?: (values) => boolean`**: o `Editor` só mostra, e só envia, os campos visíveis. Usado no formulário de método:
  - uso diário: início da cartela, dias de uso, dias de pausa, horário e lembrete;
  - injeção: intervalo (mensal ou trimestral), data da última, horário e lembrete;
  - DIU/implante: colocação e troca.
- O formulário de sintomas usa caixas de marcar para a lista fixa, com um tipo de campo novo, `multi`.
- Rótulos novos em `COLLECTION_LABELS`, e as coleções novas entram na descrição da ferramenta `buscar`.

## Testes

- `tests/female-health.test.mjs`: médias e limites do ciclo, previsão e atraso, fases, calendário, uso diário com pausa e contínuo, injeção, DIU, preventivos (incluindo fim de mês), hora do lembrete, `femaleReminderDue` (fuso, hora, adiamentos e registro do dia).
- `tests/female-reminders.test.mjs`: envio com dependências em memória, seção oculta, callbacks Tomei, Lembrar em 1h (incluindo às 23h), Adiar e método inexistente, além da leitura do `callback_data`.
- Testes do núcleo: validação das coleções novas, unicidade, upgrade de espaços antigos, Agenda (itens calculados, `readonly`, ocultos por gênero).
- Testes de exames: alertas femininos, contexto do parecer no feminino, marcadores novos.
- Testes do assistente: relatório, propostas e ferramentas por gênero.
- Interface: conferida no harness local, com o app real e `/api/state` simulado, no desktop e em 390 px.

## Fora do escopo

Adesivo e anel vaginal, modo gestação, menopausa como modo próprio, notificações push no navegador e sincronização com apps de ciclo.
