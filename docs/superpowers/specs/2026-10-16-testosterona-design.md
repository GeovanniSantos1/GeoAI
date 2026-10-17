# Menu Testosterona — especificação

Data: 16/10/2026. Aprovado em conversa com o proprietário, em três partes (telas, IA, dados e testes).

## Objetivo

Um menu para quem acompanha a testosterona, com ou sem tratamento. A pessoa:

1. envia os resultados dos exames (PDF ou foto) e recebe uma leitura clara de cada marcador e um parecer;
2. registra o protocolo de reposição (ex.: Durateston 250 mg a cada 14 dias) e as aplicações, e recebe lembretes no Telegram;
3. encontra dicas de hábitos que favorecem a testosterona (alimentação, sol, sono, treino) e dicas ligadas aos próprios exames.

Sucesso: enviar um exame e, em poucos segundos, ver os marcadores com status e um parecer; registrar um protocolo e ver a próxima aplicação, o histórico e a pontualidade; receber o lembrete no dia e registrar a aplicação pelo botão.

## Limites da IA (valem para o menu, o chat e o Telegram)

A "IA" é o mesmo modelo do assistente (`AI_MODEL`, hoje `gpt-6-luna`) com instruções específicas. Não é um modelo treinado pelo GeoAI.

- Compara valores com a faixa de referência do próprio laudo, explica em linguagem simples e diz o que perguntar ao médico.
- Nunca sugere mudança de dose, nem começar, parar ou comprar hormônio ou outros medicamentos (inibidores de aromatase, hCG etc.).
- Não diagnostica: usa "pode indicar" e "vale conversar com seu médico".
- Pedidos de dose ou de medicamento recebem a orientação de tratar com o médico, com ajuda para preparar as perguntas da consulta.
- A tela mostra sempre: "A IA ajuda a entender seus exames, mas não substitui seu médico."

## Telas

Item de menu **Testosterona** no grupo "CUIDE DE VOCÊ", rota `/testosterona`, ícone `FlaskConical`. Quatro abas:

**Resumo** — último exame (data, situação geral, testosterona total com a faixa), próxima aplicação (data, "faltam X dias" ou "atrasada há X dias", botão Registrar aplicação), pontos de atenção do último parecer, gráfico da testosterona total por exame (usa `MiniChart`), aviso fixo.

**Exames** — botão "Enviar exame" (PDF, JPEG, PNG ou WEBP até 4 MB) e "Digitar exame" (sem arquivo).
- No primeiro envio, aviso: "Seus exames ficam guardados de forma privada. O arquivo é enviado à OpenAI apenas para leitura." A pessoa confirma uma vez; a confirmação fica no aparelho.
- Fotos são reduzidas no navegador (lado maior até 2000 px, JPEG 0,85) antes do envio. PDFs vão como estão.
- Depois da leitura, abre a conferência: data da coleta, laboratório e tabela editável (marcador, valor, unidade, faixa mínima, faixa máxima), com linhas adicionáveis e removíveis. Botão "Salvar e revisar".
- Detalhe do exame: marcadores com selo baixo / normal / alto / sem referência, situação geral, parecer, pontos de atenção, "Ver arquivo", "Revisar de novo", "Editar valores" e excluir.
- Situação geral, em texto: `ok` → "Tudo dentro das faixas"; `attention` → "Pontos de atenção"; `doctor` → "Leve ao médico em breve".

**Protocolo** — cadastro (medicamento: Durateston, Deposteron, Nebido, Testosterona gel, Outro; dose; unidade mg/mL/g; intervalo em dias de 1 a 90; início; médico responsável opcional; situação ativo/pausado; "Lembrar no Telegram"; observações). Cartão com próxima aplicação e pontualidade dos últimos 90 dias. Histórico de aplicações (data, dose, local glúteo/coxa/deltoide/abdômen/outro, como se sentiu).

**Dicas** — conteúdo fixo em código, revisado: alimentação (ovos, peixes gordurosos, ostras e carnes vermelhas magras pelo zinco, castanha-do-pará pelo selênio, azeite e abacate, vegetais crucíferos; menos ultraprocessados e álcool), sol e vitamina D (15 a 30 minutos com braços e pernas expostos, fora do pico; pedir dosagem ao médico), sono de 7 a 9 horas, musculação com exercícios compostos, peso e estresse. Bloco "Para você" com as dicas do último parecer. Para quem tem protocolo ativo: "Os hábitos complementam o tratamento, não o substituem."

**Agenda** — a próxima aplicação de cada protocolo ativo aparece como compromisso calculado (não é salvo em `tasks`), com o título "Aplicação: <medicamento>".

## Dados

Três coleções novas no workspace (`lib/types.ts` → `COLLECTIONS`), validadas em `validateItem`:

`labExams`
- `title` ("Exame de 02/10/2026"), `date` (coleta), `lab?`, `status`: `draft` | `reviewed`, `createdOn` (data do envio).
- `markers`: até 80 itens `{key, label, value, qualifier?, unit?, refMin?, refMax?}`. `key` pertence a `MARKER_KEYS`; `qualifier` é `<` ou `>`; números finitos; textos até 80 caracteres.
- `file?`: `{path, name, type, size}`. `path` sempre começa com `exames/<userId>/`.
- `review?`: `{overall, summary, points: [{marker, text}], tips: string[], reviewedAt, model}`. `summary` até 1.500 caracteres, até 12 pontos e 8 dicas.

`trtProtocols`
- `title` (medicamento), `dose`, `unit`, `intervalDays`, `startDate`, `doctor?`, `status` (`active` | `paused`), `remind` (boolean), `notes?`, `remindedOn?`, `snoozedUntil?`.

`trtDoses`
- `title`, `date`, `protocolId`, `dose`, `site?`, `notes?`.

`MARKER_KEYS`: `testosterona_total`, `testosterona_livre`, `testosterona_biodisponivel`, `shbg`, `estradiol`, `lh`, `fsh`, `prolactina`, `hematocrito`, `hemoglobina`, `psa_total`, `psa_livre`, `vitamina_d`, `tsh`, `t4_livre`, `glicemia`, `hba1c`, `colesterol_total`, `hdl`, `ldl`, `triglicerides`, `tgo`, `tgp`, `creatinina`, `outro`.

Regras de acesso:
- `labExams` só muda pelas rotas de exames. `/api/state` recusa `upsert` e `delete` de `labExams`.
- `trtProtocols` e `trtDoses` usam o CRUD comum (`/api/state`).
- Restaurar backup mantém os exames, mas remove `file` cujo `path` não começa com `exames/<userId>/`.
- "Apagar meus dados" apaga também todos os arquivos com o prefixo `exames/<userId>/`.

Tamanho: um exame típico ocupa cerca de 5 KB; o limite atual de 1 MB por workspace comporta cerca de 200 exames.

Contadores de uso numa tabela nova `usage_counters` (`user_id`, `kind`, `day`, `count`; chave primária nos três primeiros): `exam_upload` até 20 por dia e `exam_review` até 40 por dia, no fuso do usuário. Excluir exames não devolve cota.

## Lógica pura (`lib/testosterone.ts`, testada)

- `classifyMarker(m)`: abaixo de `refMin` → baixo, acima de `refMax` → alto, senão normal; sem nenhuma faixa → sem referência. Com `qualifier` `<`, valor igual a `refMin` conta como baixo; com `>`, valor igual a `refMax` conta como alto (ex.: PSA "< 0,01" com faixa "até 4,0" é normal). Faixa só com máximo (ex.: PSA "até 4,0") ou só com mínimo é aceita.
- `criticalFlags(exam, history)`: `hematocrito` com unidade `%` e valor ≥ 54; `psa_total` acima de `refMax`; `psa_total` em ng/mL com alta maior que 1,4 em relação ao menor valor dos exames revisados nos 365 dias anteriores.
- `codeOverall`: `doctor` se houver alerta crítico; `attention` se algum marcador estiver baixo ou alto; senão `ok`. O parecer final usa o maior entre o do código e o da IA (`ok` < `attention` < `doctor`); a IA nunca rebaixa.
- `nextApplication(protocol, doses)`: data da última aplicação do protocolo + `intervalDays`; sem aplicações, `startDate`. Também devolve dias de atraso.
- `punctuality(protocol, doses, today)`: entre aplicações consecutivas dos últimos 90 dias, fração dos intervalos com diferença de até 1 dia do previsto. Sem intervalos, não mostra.
- `cycleDay(protocol, doses, date)`: dias desde a última aplicação antes da data da coleta.
- `dueReminder(protocol, doses, today)`: verdadeiro quando o protocolo está ativo, `remind` ligado, hoje está entre a próxima aplicação e 3 dias depois, `remindedOn` ≠ hoje e `snoozedUntil` vazio ou ≤ hoje.

## IA (`lib/exam-ai.ts`)

Ambas as chamadas usam `generateText` com saída estruturada (`Output.object` + zod), `agentModel()` e tempo máximo de 45 s.

**Leitura** — entrada: o arquivo como parte `file` (PDF) ou `image`. Instrução: extrair dados sem interpretar; data da coleta; laboratório; marcadores com nome do laudo, `key` padronizada, valor, qualificador, unidade e faixa impressa; para faixas por sexo ou idade, usar a de homem adulto; ignorar dados pessoais (nome, documento, médico). Saída validada pelas mesmas regras de `markers`.

**Parecer** — entrada: marcadores conferidos com a classificação do código, alertas críticos, protocolo ativo e dia do ciclo na coleta, até 3 exames anteriores com os mesmos marcadores. Saída: `overall`, `summary` (2 a 4 frases), `points` (um por marcador fora da faixa ou alerta: o que costuma significar e o que perguntar ao médico), `tips` (hábitos, até 5). Instruções com os limites da seção "Limites da IA".

## Chat do app e Telegram

- Nova ferramenta `testosterona` em `agentTools`: protocolos com próxima aplicação e atraso, últimas 10 aplicações, últimos 3 exames com marcadores, classificação e resumo do parecer.
- `PROPOSABLE` ganha `trtDoses`. Sugestão de aplicação: data padrão hoje; `protocolId` e dose padrão do único protocolo ativo; sem protocolo ativo, a sugestão é recusada com erro explicativo.
- A ferramenta `buscar` passa a aceitar as três coleções novas.
- `agentInstructions` ganha os limites da IA para testosterona.
- O bot continua só com texto; envio de exame é só pelo app.

## Lembrete no Telegram

- `vercel.json` ganha `crons: [{path: "/api/cron/trt-reminders", schedule: "0 11 * * *"}]` (8h de Brasília; no plano gratuito, chega entre 8h e 9h).
- A rota exige `Authorization: Bearer <CRON_SECRET>`. Percorre `telegram_links`, carrega o workspace de cada usuário e, para cada protocolo com `dueReminder`, envia "Lembrete do GeoAI: hoje é dia da sua aplicação." com os botões **Apliquei** (`trt:d:<protocolId>`) e **Adiar 1 dia** (`trt:s:<protocolId>`). Grava `remindedOn` = hoje. Falha em um usuário não interrompe os demais. Responde só com contagens.
- **Apliquei**: confere que o chat pertence ao dono do protocolo, registra a aplicação de hoje com a dose do protocolo e responde "Aplicação registrada. Próxima: <data>." Toques repetidos no mesmo dia não duplicam.
- **Adiar 1 dia**: grava `snoozedUntil` = amanhã e responde "Combinado, lembro amanhã."

## Arquivos

- Vercel Blob privado `geoai-exames`, conectado ao projeto `geo-ai`. Acesso por `lib/exam-files.ts` (`saveExamFile`, `readExamFile`, `deleteExamFile`, `deleteUserFiles`), com implementação em memória para testes.
- Caminho: `exames/<userId>/<examId>-<aleatório>.<ext>`.
- Tipo conferido pelos primeiros bytes (`%PDF`, JPEG `FFD8`, PNG `89504E47`, `RIFF....WEBP`), não só pela extensão.

## Rotas

| Rota | Faz |
|---|---|
| `POST /api/exams` | multipart com `file`; confere login, origem, tipo, tamanho e cota; guarda o arquivo; cria o rascunho; pede a leitura; devolve o exame. Se a leitura falhar, devolve o rascunho sem marcadores e um aviso. Também aceita criação sem arquivo (JSON) para "Digitar exame". |
| `POST /api/exams/[id]/review` | recebe data, laboratório e marcadores conferidos; valida; classifica; consome cota; pede o parecer; salva `status: reviewed`. Se o parecer falhar, salva a classificação e devolve um aviso. |
| `GET /api/exams/[id]/file` | confere que o exame é do usuário e que o `path` tem o prefixo dele; devolve o arquivo com `Content-Disposition: inline` e `Cache-Control: private, no-store`. |
| `DELETE /api/exams/[id]` | apaga o arquivo e o registro. |
| `GET /api/cron/trt-reminders` | lembrete diário (acima). |

Todas com `maxDuration = 60`, exceto o arquivo.

## Erros

- Arquivo acima de 4 MB ou tipo não aceito: aviso no navegador antes de enviar e recusa no servidor.
- IA indisponível ou laudo ilegível: rascunho com arquivo e mensagem "Não consegui ler este exame. Confira e digite os valores."
- Parecer indisponível: classificação do código visível e botão "Revisar de novo".
- Blob não configurado: "Envio de arquivos indisponível no momento"; "Digitar exame" continua funcionando.
- Cota diária: "Você atingiu o limite de envios de hoje. Tente amanhã."

## Testes

- Unitários (`tests/testosterone.test.mjs`): classificação com e sem qualificador e faixas parciais; alertas de hematócrito e PSA (inclusive a alta em 12 meses); parecer final nunca rebaixado; próxima aplicação, atraso, pontualidade e dia do ciclo; `dueReminder` com fuso, adiamento, limite de 3 dias, pausado e lembrete desligado; validação das coleções novas; recusa de `labExams` em `/api/state`; dados de callback do Telegram; sugestões de `trtDoses`.
- Integração local: PGlite + OpenAI simulada + armazenamento em memória, cobrindo envio, conferência, parecer, arquivo de outro usuário bloqueado, exclusão, "Apagar meus dados" e lembrete com Telegram simulado.
- Produção, após o deploy: usuário de teste do Clerk envia um PDF de exemplo pelo app (confirma que o `gpt-6-luna` lê PDF), revisa, abre o arquivo; outro usuário de teste recebe 404 no mesmo arquivo; disparo manual do lembrete com `CRON_SECRET`; exclusão. Os usuários de teste e seus dados são apagados no fim.

## Infraestrutura

- Criar o Blob privado `geoai-exames` e conectá-lo ao projeto.
- Criar `CRON_SECRET` (sensível) em produção.
- Adicionar `@vercel/blob`.
- Migração Drizzle para `usage_counters`.
- Atualizar README e `.env.example`.

## Fora do escopo

Envio de exames pelo Telegram, notificações push, compartilhamento com médico, outros idiomas.
