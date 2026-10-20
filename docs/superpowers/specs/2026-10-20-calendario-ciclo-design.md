# Calendário do ciclo (Saúde feminina) — especificação

Data: 20/10/2026. Aprovado em conversa com o proprietário, em três partes (o que ela vê; dados e regras; código e testes), a partir de uma captura de tela de um app de ciclo que a usuária já usa. O proprietário pediu para seguir direto para a implementação, com revisão por tarefa e revisão final.

## Objetivo

Trocar a faixa "Próximos 35 dias" da aba **Ciclo** por um calendário mensal navegável, no estilo dos apps de ciclo. Ele mostra, dia a dia:
- a menstruação registrada e a prevista;
- a janela fértil e a ovulação estimadas;
- o dia do ciclo;
- humor, sintomas, uso do anticoncepcional e relação sexual.

Tocar num dia abre um painel com o resumo dele e atalhos para registrar. Há também a visão do ano.

Sucesso:
- ela abre a aba Ciclo e vê o mês com as menstruações que registrou e as previstas;
- toca num dia e vê o dia do ciclo, a fase, o humor, os sintomas, o método e a relação;
- registra ou edita a menstruação, as anotações e a relação daquele dia pelo painel;
- alterna para o ano e vê o padrão dos 12 meses.

## Decisões tomadas com o proprietário

- **Escopo:** o básico (menstruação registrada e prevista, janela fértil, ovulação e dia do ciclo), mais humor e sintomas, anticoncepcional, relação sexual (registro novo) e visão do ano.
- **Relação sexual** é um registro como os outros: o assistente (app, Telegram e WhatsApp) pode consultá-lo e sugerir registrá-lo, com confirmação.
- **Lugar:** dentro da aba Ciclo, no lugar da faixa de 35 dias. As abas continuam as mesmas.
- **Sem "probabilidade de engravidar".** O painel mostra a fase e "janela fértil estimada", e o aviso fixo do menu continua: as previsões não servem como método contraceptivo.
- **Construído com as peças do app**, sem o `react-day-picker`. A grade é de segunda a domingo, como a Agenda e a imagem de referência.

## O que ela vê

### Aba Ciclo, de cima para baixo

1. Botões **Menstruação começou** e **Registrar sintomas** (já existem).
2. Médias do ciclo (já existem, só com menstruação registrada).
3. **Calendário**, sempre visível. Sem menstruação registrada, mostra humor, métodos e relações, e uma linha: "Registre o início da última menstruação para ver as previsões."
4. **Painel do dia** selecionado. Ao abrir, o dia selecionado é hoje.
5. Listas de menstruações e de sintomas (já existem).

### Calendário: visão Mês

- **Topo:**
  - `‹` e `›` (rótulos "Mês anterior" e "Próximo mês") e o título "Outubro de 2026";
  - o alternador **Mês | Ano**;
  - o botão **Hoje**, que só aparece quando a visão não é o mês, o mês mostrado não é o atual ou o dia selecionado não é hoje (também aparece na visão do ano);
  - o botão **?**, que mostra e esconde a legenda.
- **Grade:** começa na segunda-feira, com cabeçalho S T Q Q S S D. Os dias de fora do mês ficam como espaços vazios.
- **Cada dia é um botão** com:
  - o número do dia;
  - no canto superior direito, o **dia do ciclo** em letra pequena, quando existir;
  - uma fileira de até 3 marcas:
    - a carinha de humor (cores e ícones de humor do Diário) ou, sem humor, um ponto de sintomas;
    - 💊 (ícone `Pill`) quando houve uso registrado da pílula ou injeção aplicada;
    - ♥ (ícone `Heart`) quando há relação registrada.
- **Fundo do dia:**
  - **menstruação registrada:** rosa cheio (as cores rosa que o menu já usa, com variante escura);
  - **menstruação prevista:** contorno rosa tracejado, sem fundo cheio;
  - **janela fértil estimada:** verde claro (`--green-soft`, borda `--green`);
  - **ovulação estimada:** verde forte (`--green`);
  - **hoje:** contorno dourado (`--gold`);
  - **dia selecionado:** anel interno escuro (`--text`) por cima da cor do próprio dia, que se mantém;
- **Legenda** (com o **?**): menstruação, menstruação prevista, janela fértil, ovulação, humor ou sintomas, anticoncepcional e relação.
- **Acessibilidade:** cada dia tem `aria-label` com a data por extenso e o que há nele (ex.: "19 de outubro, dia do ciclo 24, menstruação registrada, humor Bem, relação"). O selecionado tem `aria-pressed`.

### Calendário: visão Ano

- Topo com `‹ 2026 ›` (rótulos "Ano anterior" e "Próximo ano") e o alternador Mês | Ano.
- Doze mini-meses, em 2 colunas no celular e 4 no computador. Cada um tem o nome do mês e uma grade de segunda a domingo com as mesmas cores (menstruação, prevista, fértil e ovulação) e o contorno de hoje, sem números do ciclo nem marcas.
- Tocar num mini-mês abre a visão Mês daquele mês.

### Painel do dia

- **Cabeçalho:** "Domingo, 19 de outubro", com as pílulas "Dia do ciclo 24" e a fase ("Fase lútea"), quando houver.
- **Linhas**, cada uma só quando houver o que mostrar:
  - **Menstruação:** "Menstruação · 2º dia · fluxo moderado" (registrada), "Menstruação prevista · 2º dia" ou, em hoje, "Menstruação atrasada há 3 dias".
  - **Fertilidade:** "Ovulação estimada" ou "Janela fértil estimada".
  - **Humor:** o rótulo do humor (Muito bem, Bem, Na média, Um pouco difícil, Dia difícil).
  - **Sintomas:** a lista separada por vírgulas, e as anotações do registro de sintomas.
  - **Métodos ativos**, um por linha, com o nome do método:
    - pílula: "tomada", "não registrada" (até hoje, em dia de uso sem registro), "dia N da cartela" (dia futuro de uso) ou "pausa até 25/10";
    - injeção: "aplicada" ou "prevista";
    - DIU ou implante: "troca em 4 anos" (ou "troca prevista para hoje", "troca atrasada"), e no dia da troca "troca prevista".
  - **Relação:** "Relação com proteção", "Relação sem proteção" ou "Relação", e as anotações.
- **Botões**, só para hoje e dias passados:
  - **Editar menstruação:** abre a menstruação que contém o dia. Se o dia não está numa menstruação registrada, o botão vira **Menstruação começou** e abre o formulário com a data do dia, título "Menstruação" e fluxo moderado.
  - **Anotações:** abre o registro de sintomas do dia, ou cria um com a data do dia e o título "Sintomas do dia".
  - **Relação:** abre o registro de relação do dia, ou cria um com a data do dia e o título "Relação".
- Nos dias futuros não há botões. As linhas mostram só previsões e métodos.

## Dados

### Coleção nova `intimacy` (Relação)

| Campo | Regra |
|---|---|
| `title` | padrão "Relação" |
| `date` | obrigatória; um registro por data ("Já existe um registro para esta data. Edite o registro existente.") |
| `protection` | opcional: `com` ou `sem`; vazio é "Não informar". Outro valor: "Proteção inválida". |
| `notes` | opcional |

- **Formulário:** campos Registro, Data, Proteção (Não informar / Com proteção / Sem proteção) e Notas. Rótulo da coleção: "Registrar relação".
- **Workspaces e backups antigos** ganham `intimacy: []` (mesma atualização das coleções da Saúde feminina). Não há migração de banco: o workspace é JSON.
- **Assistente:**
  - a ferramenta `buscar` aceita a coleção `intimacy` ("relações sexuais");
  - `propor_acoes` aceita `intimacy`, com o campo `protection` (`com` ou `sem`), data padrão hoje e título "Relação". Recusa um segundo registro na mesma data, como faz com o uso do método;
  - a descrição da proposta é "Relação", "Relação · com proteção" ou "Relação · sem proteção";
  - nas regras femininas do prompt entra: "Quando ela contar que teve relação sexual, sugira registrar com propor_acoes (intimacy), com a proteção se ela disser."

## Regras puras (`lib/female-health.ts`)

### `cycleCalendar(dados, from, to, today)`

`dados` tem `periods`, `symptoms`, `journal`, `contraceptives`, `contraceptiveDoses` e `intimacy`. A função devolve um objeto para cada data de `from` a `to`, inclusive:

```ts
type CalendarDay = {
  date: string;
  cycleDay: number|null;
  period: 'logged'|'predicted'|null;
  periodDay?: number;            // 1º, 2º… dia da menstruação (registrada ou prevista)
  flow?: string;                 // só na registrada
  fertile: boolean;              // janela fértil, sem contar o dia da ovulação
  ovulation: boolean;
  phase: Phase|null;
  late?: number;                 // só em `today`, quando a menstruação está atrasada
  mood?: number;                 // 1 a 5
  symptoms: string[];
  notes?: string;                // anotações do registro de sintomas
  methods: CalendarMethod[];
  intimacy?: {protection?: 'com'|'sem'; notes?: string};
};
type CalendarMethod =
  | {id; title; method: 'daily'; taken: boolean; active: boolean; packDay?: number; pauseUntil?: string}
  | {id; title; method: 'injection'; taken: boolean; due: boolean}
  | {id; title; method: 'iud'; daysLeft: number; change: boolean};
```

As médias vêm de `cycleStats(menstruações com início ≤ today)`: `cycleLength` e `periodLength`.

1. **Inícios registrados:** as datas de início ≤ `today`. Registros com início depois de hoje não contam, como já acontece na previsão.
2. **Inícios projetados:** `P1 = último início + cycleLength`, `P2 = P1 + cycleLength`, e assim por diante, até passar de `to`.
3. **Menstruação registrada:**
   - cada registro com início ≤ `today` pinta do início até `endDate`; sem fim, pinta `periodLength` dias;
   - o trecho é cortado na véspera do início registrado seguinte;
   - dias depois de `today` nunca são `logged`;
   - em cada dia, `periodDay` é a posição do dia na menstruação e `flow` é o fluxo do registro.
4. **Continuação prevista:** se os dias do último registro passam de hoje, os dias depois de hoje são `predicted`, continuando o `periodDay`. Os dias vão até o fim registrado ou, sem fim, completam a duração média.
5. **Menstruação prevista:**
   - cada início projetado `Pk` em `today` ou depois pinta `periodLength` dias como `predicted`, com `periodDay`. Prevista para hoje, ela pinta a partir de hoje;
   - um início projetado antes de `today` (atraso) não pinta nada, nem no passado nem no futuro, e o ciclo seguinte continua a partir dele;
   - em `today`, `late = today − P1` quando `P1 < today`. É o mesmo atraso da `cyclePrediction`;
   - **atraso de um ciclo inteiro ou mais** (`late ≥ cycleLength`): o calendário para de projetar. Não há menstruação prevista, ovulação nem janela fértil do último início registrado em diante, e a continuação prevista do último registro (regra 4) também não é pintada. Resta só o aviso de atraso. Nessa altura a previsão deixa de ser significativa, e é quando a gravidez é a pergunta. Abaixo de um ciclo de atraso, nada muda. O `cycleDay` continua contando do último início registrado.
6. **Dia do ciclo:**
   - antes de `today`, conta a partir do início registrado mais recente ≤ a data (`data − início + 1`);
   - de `today` em diante, conta a partir do mais recente ≤ a data entre os inícios registrados e os projetados em `today` ou depois. Prevista para hoje, hoje é o dia 1;
   - antes do primeiro início registrado é `null`.
7. **Ovulação e janela fértil:**
   - a sequência de ciclos é a dos inícios registrados seguida de todos os projetados, incluindo os que ficaram no passado por atraso;
   - para cada início `S` com um início seguinte `N` nessa sequência, a ovulação é `N − 14` e a janela fértil vai de `N − 19` a `N − 13` (`fertile` não inclui o dia da ovulação);
   - nos ciclos passados, `N` é o início registrado de fato;
   - pares de inícios a menos de 15 dias um do outro (registro duplicado ou sangramento fora do período, o mesmo limite de `cycleStats`) não marcam ovulação nem janela fértil;
   - não há marcação antes do primeiro início registrado.
8. **Fase**, só quando `cycleDay` não é `null`:
   - `menstrual` quando `period` não é nulo;
   - senão, `ovulatória` a até 1 dia de uma ovulação marcada pela regra 7;
   - senão, `null` quando o ciclo do dia não tem início seguinte (caso do atraso de um ciclo inteiro, regra 5);
   - senão, `folicular` antes da ovulação e `lútea` depois.
9. **Humor:** o `mood` do registro de sintomas da data; sem ele, o do Diário (`journal`) da mesma data. `symptoms` e `notes` vêm do registro de sintomas.
10. **Métodos** (só os ativos):
    - **pílula:** `dailyStatus(m, data)` dá `active`, `packDay` e `pauseUntil`; `taken` diz se há registro de uso no dia; antes de `startDate` aparece só quando há uso registrado, para que trocar de cartela não apague o histórico;
    - **injeção:** `taken` diz se há aplicação no dia; `due` diz se a data é `injectionNext(m, doses, data)` e não houve aplicação; antes de `startDate` aparece só quando há aplicação registrada;
    - **DIU:** aparece só a partir da data de colocação; `daysLeft = changeDate − data` e `change = data === changeDate`.
11. **Relação:** o registro de `intimacy` da data.

### `durationLabel(days)`

Prazo em texto para o DIU:

| Dias | Texto |
|---|---|
| ≥ 365 | "N ano(s)" (dias ÷ 365, para baixo) |
| ≥ 60 | "N meses" (dias ÷ 30, para baixo) |
| 2 a 59 | "N dias" |
| 1 | "1 dia" |
| 0 | "hoje" |

O painel trata o atraso (dias negativos) como "troca atrasada".

### `forecastDays`

Sai, junto com a faixa de 35 dias e os testes dela. Nenhum outro lugar usa.

## Código

- `lib/female-health.ts`: `cycleCalendar`, `durationLabel` e os tipos `CalendarDay` e `CalendarMethod`; remove `forecastDays`. Também entram `calendarMonth(mês)` (espaços antes do dia 1 numa grade que começa na segunda-feira, e as datas do mês) e `shiftMonth(mês, n)`, para a navegação, testados na virada do ano e em fevereiro bissexto. A `cycleCalendar` aceita workspace sem as listas opcionais.
- `lib/types.ts`: `intimacy` em `COLLECTIONS`.
- `lib/core.ts`:
  - `intimacy` nas coleções adicionadas na atualização;
  - `protection` nas chaves válidas;
  - data obrigatória, um registro por data e valores de proteção válidos.
- `components/norte/catalog.ts`: campos e rótulo da coleção nova. Também qualquer outro `Record<Collection,…>` que o TypeScript exigir.
- `lib/agent.ts` e `lib/agent-runtime.ts`: proposta, descrição, busca e regra feminina.
- `components/norte/cycle-calendar.tsx` (novo): `CycleCalendar`, com as visões Mês e Ano, o painel do dia e a legenda. Usa `useApp()` (`a.state`, `a.today`, `a.edit`) e os ícones de humor do Diário. Se esses ícones são locais em `health.tsx`, eles passam a ser exportados.
- `components/norte/female-health.tsx`: o `CyclePanel` troca a faixa por `<CycleCalendar/>`.
- `app/globals.css`: classes do calendário, do painel e da visão do ano, com tema escuro. Saem as classes `.cycle-calendar` e `.cycle-day`, que ficam sem uso. Precisa caber num celular de 375 px sem rolagem horizontal.

## Testes

- `tests/female-health.test.mjs`, para `cycleCalendar`:
  - menstruação registrada com fim, sem fim (média) e cortada pelo início seguinte;
  - dias futuros nunca registrados, e a continuação prevista da menstruação em andamento;
  - previsão só depois de hoje;
  - atraso: o ciclo atrasado não pinta, o seguinte sim, e o `late` aparece em hoje;
  - ovulação e janela fértil no ciclo passado, calculadas pelo início real seguinte, e no atual pela previsão;
  - dia do ciclo recomeçando no início previsto;
  - nada antes do primeiro registro;
  - fases;
  - humor vindo do Diário quando falta no registro de sintomas;
  - pílula tomada, não tomada e em pausa;
  - injeção aplicada e prevista;
  - DIU antes da colocação, `daysLeft` e dia da troca;
  - relação com proteção;
  - `durationLabel` em cada faixa.
- **Validação** (`tests/female-health.test.mjs` ou `tests/domain.test.mjs`):
  - `intimacy` com proteção inválida, sem data e duplicada na mesma data;
  - workspace antigo ganhando `intimacy: []`.
- **Assistente:** proposta de `intimacy` aceita com proteção, recusada na mesma data, e a descrição.
- Typecheck, lint dos arquivos alterados, build e `npm test`.
- **Conferência visual no navegador**, com dados de exemplo:
  - celular de 375 px e computador, nos temas claro e escuro;
  - Mês, Ano e o painel do dia;
  - tocar em dias passados, de hoje e futuros.

## Fora do escopo

- Probabilidade de engravidar.
- Mais de um registro de relação por dia.
- Marcar preventivos e exames no calendário.
- Exportar o calendário.
