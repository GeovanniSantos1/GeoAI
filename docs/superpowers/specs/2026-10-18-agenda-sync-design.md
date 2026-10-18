# Agenda sincronizada com Outlook/Teams e Google — especificação

Data: 18/10/2026. Aprovado em conversa com o proprietário, em três partes (o que o usuário vê; dados e sincronização; erros, configuração e testes).

## Objetivo

Na Agenda (`/agenda-v2`), mostrar sozinhos os compromissos que o usuário tem no Outlook (incluindo as reuniões do Teams) e no Google Agenda. A pessoa conecta cada conta uma vez, em Configurações, e não precisa fazer mais nada.

Sucesso: conectar o Outlook ou o Google e, em poucos segundos, ver os compromissos da semana na agenda do GeoAI, com o link da reunião; um evento criado, alterado ou cancelado na origem aparece corrigido na próxima abertura do app (ou em até um dia, sem abrir); o assistente e o bot do Telegram respondem "o que tenho hoje?" incluindo esses compromissos.

Público por ora: o proprietário e poucas pessoas (até 100). O Google mostra a tela "app não verificado" na conexão; a verificação fica para quando o app abrir ao público.

## Decisões

- **Só leitura.** O GeoAI mostra os eventos externos; nunca cria, altera ou apaga nada no Outlook ou no Google.
- **Espelho, não cópia.** Os eventos externos não viram `tasks`. Ficam numa tabela própria e são somados à agenda na hora de mostrar, como as aplicações da Testosterona. Não podem ser editados nem concluídos no GeoAI.
- **OAuth pelo Clerk.** O Clerk faz a autorização e guarda e renova os tokens do Google e da Microsoft. O GeoAI não guarda tokens; pede ao Clerk na hora de sincronizar (`clerkClient().users.getUserOauthAccessToken`).
- **Uma conta por provedor por usuário** (uma Microsoft e uma Google). Só a agenda principal de cada conta.
- **"Teams" é a agenda do Microsoft 365.** As reuniões do Teams estão na agenda do Outlook; uma conexão Microsoft cobre conta corporativa e pessoal (outlook.com, hotmail).

## Telas

### Configurações › Calendário & lembretes

Duas linhas novas acima do importar/exportar `.ics`: **Outlook / Teams** e **Google Agenda**. Cada linha mostra:

| Estado | Texto | Botões |
|---|---|---|
| sem conexão | "Não conectado" | **Conectar** |
| `ok` | "Conectado como voce@empresa.com · atualizado há 5 min" | **Atualizar agora**, **Desconectar** |
| `reconnect` | "Precisa reconectar" | **Reconectar**, **Desconectar** |
| `error` | "Não foi possível atualizar agora · última atualização há 2 h" | **Atualizar agora**, **Desconectar** |

- **Conectar** leva à autorização da Microsoft ou do Google, pedindo só leitura da agenda, e volta para `/perfil?agenda=<provedor>`. Na volta, a primeira sincronização roda na hora e o aviso diz "Outlook conectado: 23 compromissos." (ou "Google Agenda conectado: …"). O parâmetro some da URL.
- **Desconectar** confirma ("Os compromissos do Outlook saem da sua agenda do GeoAI.") e apaga a conexão e o espelho. O login com Google ou Microsoft, se a pessoa usar, continua funcionando. Para revogar o acesso de vez, o texto de ajuda aponta as configurações da conta Google ou Microsoft.
- O texto atual "Importação e exportação de arquivo. Não é sincronização automática." passa a valer só para o bloco `.ics`; o título do bloco continua "Seu calendário onde você preferir".

### Agenda (Dia, Semana, Mês) e "Seu dia" na tela inicial

- Eventos externos entram na mesma lista das ações, por horário. Os de dia inteiro vêm primeiro, com "Dia inteiro".
- Linha externa: no lugar da caixa de concluir, um ícone de calendário; selo **Outlook** ou **Google** no lugar de "Tarefa/Compromisso"; horário "09:00–09:30". Sem menu de editar/excluir e sem o atalho do Pomodoro.
- Clicar abre um resumo (modal): título, data, horário de início e fim (ou "Dia inteiro"), local, botão **Entrar na reunião** (quando houver link do Teams ou Meet) e link **Abrir no Outlook** / **Abrir no Google Agenda**. Links abrem em nova aba.
- Eventos de vários dias aparecem em cada dia que tocam.
- Não aparecem: cancelados e recusados pelo usuário. "Talvez" aparece normalmente.
- O progresso do dia (anel e "X de Y ações concluídas") e o "X ações" contam só os itens do GeoAI. Quando houver externos, o cabeçalho do dia na Agenda ganha " · N da agenda externa".
- Na vista Mês, os três primeiros títulos do dia incluem os externos.

### Atualização

- Ao abrir o app: se algum espelho tiver mais de 10 minutos, sincroniza em segundo plano e atualiza a tela quando terminar.
- **Atualizar agora** força a sincronização daquele provedor (no máximo uma por minuto; antes disso devolve o espelho atual).
- Cron diário da Vercel sincroniza todas as conexões, para o assistente e o Telegram terem dados mesmo sem ninguém abrir o app.
- Janela: de 30 dias atrás até 90 dias à frente, contados a partir do momento da sincronização.

## Dados

Tabela nova `calendar_feeds` (migração Drizzle), uma linha por usuário e provedor:

| Coluna | Tipo | Observação |
|---|---|---|
| `user_id` | text | chave primária junto com `provider` |
| `provider` | text | `microsoft` ou `google` |
| `account` | text | e-mail da conta conectada, para exibir |
| `events` | text | JSON com a lista de `ExternalEvent` da última sincronização boa; padrão `[]` |
| `synced_at` | text, opcional | ISO da última tentativa concluída (boa ou com erro) |
| `status` | text | `ok`, `reconnect` ou `error` |
| `error` | text, opcional | mensagem para o usuário, até 200 caracteres |
| `connected_at` | text | ISO |

- Ter a linha significa que a sincronização está ligada. Desconectar apaga a linha.
- Cada sincronização boa substitui `events` inteiro. Uma sincronização com erro mantém `events` e muda só `status`, `error` e `synced_at`.
- "Apagar meus dados" (`reset` em `/api/state`) também apaga as linhas do usuário.
- O espelho não entra no workspace JSON nem no backup e não muda a versão do workspace.

`ExternalEvent` (normalizado):

```ts
type ExternalEvent = {
  id: string;            // id do provedor, até 200 caracteres
  provider: 'microsoft' | 'google';
  title: string;         // até 180 caracteres; vazio vira "(Sem título)"
  allDay: boolean;
  start: string;         // allDay: 'AAAA-MM-DD'; senão ISO UTC 'AAAA-MM-DDTHH:mm:ssZ'
  end: string;           // mesmo formato; em allDay o fim é exclusivo
  location?: string;     // até 200 caracteres
  joinUrl?: string;      // só https, até 2000 caracteres
  webLink?: string;      // só https, até 2000 caracteres
};
```

Até 1000 eventos por provedor (cerca de 400 KB no pior caso). Não guardamos descrição, participantes nem anexos.

## Lógica pura (`lib/external-calendar.ts`, testada)

- `normalizeGraphEvent(raw)`: devolve `ExternalEvent` ou `null`. Descarta `isCancelled` e `responseStatus.response === 'declined'`. As datas vêm em UTC (cabeçalho `Prefer: outlook.timezone="UTC"`) no formato `2026-10-20T12:00:00.0000000`, sem `Z`: corta as frações e acrescenta `Z`. Em `isAllDay`, usa só a parte da data de `start` e `end`. `joinUrl` = `onlineMeeting.joinUrl`; `webLink` = `webLink`; `location` = `location.displayName`.
- `normalizeGoogleEvent(raw)`: descarta `status === 'cancelled'` e eventos em que o participante `self` tem `responseStatus === 'declined'`. Dia inteiro usa `start.date`/`end.date`; com horário, converte `start.dateTime`/`end.dateTime` (RFC 3339 com fuso) para UTC. `joinUrl` = `hangoutLink` ou o primeiro `conferenceData.entryPoints` com `entryPointType === 'video'`; `webLink` = `htmlLink`.
- Ambos recusam URLs que não sejam `https:` e cortam textos nos limites.
- `externalOn(events, date, timezone)`: itens do dia `date` no fuso do perfil, cada um como `Item` com `_collection: 'external'`, `provider`, `time` e `endTime` (HH:mm no fuso; ausentes em dia inteiro), `allDay`, `type: 'event'`. Um evento com horário aparece no dia local de início, com o horário (uma reunião das 23:00 às 00:30 aparece só no primeiro dia). Se durar 24 horas ou mais, aparece também nos dias seguintes até o dia em que termina (um fim exatamente à 00:00 não conta o dia), sem horário e com `continued: true`, exibido como "Continua". Dia inteiro aparece de `start` até o dia anterior a `end`.
- `agendaItems(state, events, date)`: `scheduledItems(state, date)` mais `externalOn(events, date, state.profile.timezone)`. A ordenação continua nas telas (dia inteiro primeiro, depois por horário).

## Provedores (`lib/calendar-providers.ts`)

`fetch` injetado, para testar sem rede. Cada página com tempo máximo de 10 s.

- **Microsoft:** `GET https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=…&endDateTime=…&$select=id,subject,start,end,isAllDay,isCancelled,location,onlineMeeting,webLink,responseStatus&$top=200`, cabeçalhos `Authorization: Bearer <token>` e `Prefer: outlook.timezone="UTC"`. Segue `@odata.nextLink` até 1000 eventos.
- **Google:** `GET https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=…&timeMax=…&singleEvents=true&orderBy=startTime&maxResults=250&fields=items(id,status,summary,start,end,location,hangoutLink,conferenceData/entryPoints,htmlLink,attendees(self,responseStatus)),nextPageToken`. Segue `nextPageToken` até 1000 eventos.
- As duas APIs já devolvem as ocorrências de eventos recorrentes expandidas.
- Respostas 401 e 403 viram o erro `reconnect`; 429, 5xx, falha de rede e tempo esgotado viram `error`.

## Sincronização (`lib/calendar-sync.ts`)

Dependências injetadas (como em `trt-reminders.ts`): `getToken(userId, provider)`, `fetch`, `store` (ler, gravar e apagar linhas de `calendar_feeds`), `now`.

- `REQUIRED_SCOPES`: Google `https://www.googleapis.com/auth/calendar.events.readonly`; Microsoft `Calendars.Read` (aceito com ou sem o prefixo `https://graph.microsoft.com/`, sem diferenciar maiúsculas).
- `syncFeed(userId, provider)`: pede o token ao Clerk. Sem token, ou com `scopes` informados sem o escopo exigido, grava `reconnect`. Senão, busca a janela, normaliza e grava `events` com `status: 'ok'`. Erros conforme a seção "Provedores".
- `connectFeed(userId, provider)`: cria a linha (com `account` = e-mail da conta externa no Clerk) e roda `syncFeed`.
- `ensureFresh(userId, maxAgeMs)`: roda `syncFeed` para as linhas com `synced_at` vazio ou mais antigo que `maxAgeMs`, em paralelo entre provedores. Devolve as linhas atualizadas.
- `loadExternal(userId, {maxAgeMs, budgetMs})`: para o assistente e o Telegram. Chama `ensureFresh`, mas não espera mais que `budgetMs`; no tempo esgotado ou em erro, devolve o espelho atual.
- Duas sincronizações simultâneas do mesmo usuário gravam o mesmo resultado; vale a última.

## Rotas

| Rota | Faz |
|---|---|
| `GET /api/calendar` | sessão. Devolve `{feeds: [{provider, account, status, error, syncedAt}], events}` lendo só o banco. |
| `POST /api/calendar` | sessão + mesma origem. Corpo `{provider}`: conecta (se não houver linha) ou força a sincronização daquele provedor (respeitando um minuto entre sincronizações). Corpo `{}`: `ensureFresh` com 10 minutos. Devolve o mesmo formato do `GET`. |
| `DELETE /api/calendar` | sessão + mesma origem. Corpo `{provider}`: apaga a linha. |
| `GET /api/cron/calendar-sync` | `Authorization: Bearer <CRON_SECRET>`. Percorre as linhas da mais antiga para a mais nova e força `syncFeed`; não começa uma nova depois de 45 s. Falha em uma não interrompe as demais. Responde só com contagens. |

`maxDuration = 60` nas rotas de sincronização. `vercel.json` ganha `{path: "/api/cron/calendar-sync", schedule: "0 9 * * *"}` (6h de Brasília).

## Tela (código)

- `NorteApp` carrega `GET /api/calendar` junto com `/api/state`. Se algum `syncedAt` tiver mais de 10 minutos, chama `POST /api/calendar` com `{}` em segundo plano e atualiza ao terminar. Falha aqui não bloqueia o app.
- O contexto (`AppContext`) ganha `calendar: {events, feeds, refresh(provider?), connect(provider), disconnect(provider)}`.
- `planning.tsx`: `HomeView` e `AgendaView` usam `agendaItems` no lugar de `scheduledItems`; o progresso filtra `_collection === 'external'`. `TaskList` desenha a linha externa e abre o `ExternalEventModal`. `openItem` trata `external`.
- Cartão novo em `settings.tsx` (`CalendarAccounts`), no estilo do `TelegramCard`. Para conectar, usa `useUser()` do Clerk:
  - conta externa do provedor já ligada com o escopo (`approvedScopes`): chama direto `POST /api/calendar {provider}`;
  - ligada sem o escopo: `externalAccount.reauthorize({additionalScopes, redirectUrl})`;
  - não ligada: `user.createExternalAccount({strategy: 'oauth_<provedor>', additionalScopes, redirectUrl})`, envolvida em `useReverification`;
  - em seguida, `window.location.href = verification.externalVerificationRedirectURL`.
- Ao abrir `/perfil?agenda=<provedor>`, o cartão chama `POST /api/calendar {provider}`, mostra o aviso e limpa o parâmetro com `history.replaceState`.

## Assistente e Telegram

- `agendaRange(s, start, end, external = [])` inclui os externos de cada dia como `{title, time?, endTime?, type: 'outlook' | 'google', readOnly: true}` (sem `done`).
- `agentTools(state, today, onProposals, external = [])` repassa os externos à ferramenta da agenda.
- `/api/assistant` e `/api/telegram` carregam os externos com `loadExternal(userId, {maxAgeMs: 30 min, budgetMs: 5 s})`.
- `agentInstructions` ganha: "Itens do tipo outlook ou google vêm da agenda externa do usuário e são só leitura: mostre-os, mas nunca proponha editar, concluir ou apagar."

## Erros

| Situação | O que acontece |
|---|---|
| Sem token, escopo faltando, 401/403 | `status: reconnect`; linha "Precisa reconectar" e botão **Reconectar**. |
| 429, 5xx, rede, tempo esgotado | `status: error`, mensagem "Não foi possível atualizar agora."; espelho anterior mantido; nova tentativa na próxima abertura ou no cron. |
| Volta da autorização sem conta ligada ou sem escopo | Aviso: "Não foi possível conectar. Se for uma conta da empresa, ela pode precisar aprovar o GeoAI no Microsoft 365." |
| Provedor não ativado no Clerk (`createExternalAccount` falha) | Aviso: "A conexão com o Google/Outlook ainda não foi ativada." |
| Mais de 1000 eventos na janela | Guarda os 1000 primeiros por data. |
| Assistente/Telegram com sincronização lenta ou com erro | Respondem com o espelho atual. |

## Segurança e privacidade

- Tokens nunca saem do servidor e não são gravados pelo GeoAI.
- Escopos mínimos de leitura: `calendar.events.readonly` (Google) e `Calendars.Read` (Microsoft).
- O espelho guarda só título, horários, local e links. Desconectar ou "Apagar meus dados" apaga tudo.
- Links externos só `https:`, abertos com `target="_blank" rel="noreferrer"`.
- Rotas com sessão e mesma origem; cron com `CRON_SECRET`.

## Configuração externa (feita pelo proprietário)

Passo a passo detalhado em `docs/agenda-integracao.md`.

1. **Google Cloud Console:** criar o projeto; ativar a **Google Calendar API**; tela de consentimento OAuth **Externo**, com nome, e-mail de suporte e o escopo `.../auth/calendar.events.readonly`; **publicar como "Em produção"** sem pedir verificação (em "Teste", o Google expira o token em 7 dias e a sincronização para); criar o **ID do cliente OAuth (Aplicativo da Web)** com a URI de redirecionamento que o Clerk mostra.
2. **Microsoft Entra** (portal.azure.com › Registros de aplicativo): novo registro para **contas em qualquer diretório organizacional e contas pessoais da Microsoft**; URI de redirecionamento (Web) do Clerk; **segredo do cliente** (anotar a validade, até 24 meses); permissões delegadas do Microsoft Graph: `Calendars.Read`, `offline_access`, `User.Read`, `openid`, `email`, `profile`.
3. **Clerk** (a instância usada pelo domínio de produção): em *SSO connections*, ativar **Google** e **Microsoft** com **credenciais próprias** e os escopos acima. Conferir se a opção de mostrar esses provedores na tela de login fica ligada ou não (os dois funcionam para conectar a agenda).
4. **Conta corporativa (Ivory):** se a autorização pedir aprovação do administrador, o administrador do Microsoft 365 precisa consentir o app.
5. **Vercel:** conferir que `CRON_SECRET` existe em produção (criado para o lembrete da Testosterona). Nenhuma variável nova.

## Testes

- Unitários, `tests/external-calendar.test.mjs`: `normalizeGraphEvent` e `normalizeGoogleEvent` com JSONs de exemplo (reunião do Teams, Meet, dia inteiro, cancelado, recusado, sem título, URL não https); `externalOn` com `America/Sao_Paulo` (evento à 01h UTC que cai no dia anterior no fuso, reunião que cruza a meia-noite só no primeiro dia, evento de 48 h com "Continua", dia inteiro de três dias com fim exclusivo); `agendaItems` somando ações e externos.
- Unitários, `tests/calendar-sync.test.mjs`, com `fetch`, token e `store` falsos: sincronização ok; escopo faltando → `reconnect`; 401 → `reconnect`; 500 → `error` mantendo o espelho; paginação nos dois provedores; limite de 1000; `ensureFresh` só sincroniza os vencidos; `loadExternal` devolve o espelho quando o tempo esgota; cron com contagens e falha isolada.
- `tests/agent.test.mjs`: `agendaRange` com externos marcados como só leitura.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Manual, depois da configuração externa: conectar a conta Microsoft e a Google do proprietário em produção (as prévias da Vercel ficam atrás de login), conferir os compromissos na Agenda e no painel inicial, abrir uma reunião do Teams pelo resumo, cancelar um evento na origem e ver sumir com **Atualizar agora**, perguntar ao assistente "o que tenho hoje?", desconectar e conferir que os eventos saem.

## Documentação

- `docs/agenda-integracao.md`: passo a passo da configuração externa, com onde clicar em cada painel.
- README, "Integrações e limites": trocar "não inclui sincronização OAuth contínua com Google Calendar" pela descrição da sincronização só leitura com Outlook/Teams e Google, e o que precisa ser configurado.

## Fora do escopo

Criar ou editar eventos no Outlook ou no Google; mais de uma conta por provedor; agendas secundárias e compartilhadas; lembrete de reunião no Telegram; sincronização em tempo real (webhooks/notificações de mudança); verificação do app no Google para lançamento público.
