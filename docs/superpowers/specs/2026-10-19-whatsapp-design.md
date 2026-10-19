# GeoAI no WhatsApp (Evolution API) — especificação

Data: 19/10/2026. Aprovado em conversa com o proprietário, em duas partes (o que o usuário vê e as regras do bot; código, configuração e testes). O proprietário pediu para seguir direto para a implementação, com revisão por tarefa e revisão final.

## Objetivo

Ativar o "GeoAI no WhatsApp" pela Evolution API, como o bot do Telegram já faz:
- conversar com o assistente, que consulta agenda, gastos e registros e sugere tarefas, lançamentos e notas;
- confirmar cada sugestão pela própria conversa;
- receber os lembretes da Testosterona e da Saúde feminina.

Sucesso:
- o proprietário conecta o WhatsApp dele pela conversa "Mensagem para você mesmo", pergunta "o que tenho hoje?" e recebe a resposta;
- aceita uma sugestão respondendo "1";
- recebe um lembrete e registra respondendo "1";
- mensagens de amigos e de grupos nunca recebem resposta automática.

## Ambiente

- **Evolution API 2.3.7** na máquina do proprietário, exposta pelo ngrok em `<URL pública do túnel>`. Só funciona com o PC, a Evolution e o ngrok ligados.
- **Instância `Evolution`:** conectada, número **+55 11 90000-0000** (`5511900000000@s.whatsapp.net`). É o **WhatsApp pessoal** do proprietário.
- **Autenticação:** chave global no cabeçalho `apikey`. Toda chamada leva também `ngrok-skip-browser-warning: true`, para o ngrok não devolver a página de aviso.
- **Variáveis de ambiente** (Vercel, produção e prévias; nunca no repositório):
  - `EVOLUTION_API_URL`;
  - `EVOLUTION_API_KEY` (sensível);
  - `EVOLUTION_INSTANCE` = `Evolution`.

  Sem elas, o cartão mostra "Não configurado" e nada roda.

## Regras do bot (número pessoal)

Para cada mensagem recebida (`messages.upsert`):
1. **Grupos e listas são ignorados:** `remoteJid` terminando em `@g.us` ou `@broadcast`, ou com `participant`.
2. **Mensagens enviadas pelo proprietário** (`fromMe`) só valem na conversa consigo mesmo, quando `remoteJid` é o número da instância. As que ele manda para outras pessoas são ignoradas. O número da instância só é buscado para essas mensagens; grupos e listas saem antes de qualquer chamada de rede ou ao banco.
3. **Eco do bot:** toda resposta do bot começa com `🤖 `, e mensagens que começam com `🤖` são ignoradas. Isso evita laço na conversa consigo mesmo.
4. **Só texto:** texto vazio é ignorado. Áudio, figurinha e afins recebem "Por enquanto eu entendo só mensagens de texto." apenas se a conversa estiver ligada. Na conversa consigo mesmo, ficam em silêncio (são anotações do proprietário); lá, todo texto vai para o assistente. Texto e mídia são lidos também dentro das mensagens embrulhadas em `.message` (`ephemeralMessage`, `viewOnceMessage`, `viewOnceMessageV2`, `documentWithCaptionMessage`, `deviceSentMessage`).
5. **Repetidos:** o mesmo `key.id` processado de novo é ignorado.
6. **Conversa não ligada:** só reage ao texto `GEOAI <código>` (maiúsculas ou minúsculas, espaços em volta). Qualquer outra mensagem fica sem resposta e sem consulta à IA. A falta de ligação fica em memória por 5 minutos (até ~500 conversas), para as mensagens de contatos não consultarem o banco; o `GEOAI <código>` aceito tira a conversa dessa lista.
7. **Mensagens antigas:** eventos com `messageTimestamp` de mais de 10 minutos são ignorados, para que a fila acumulada enquanto o PC esteve desligado (inclusive um `1` velho) não seja processada.

## Telas

**Configurações › GeoAI no WhatsApp** (no lugar do cartão atual "Não conectado"), no estilo do cartão do Telegram:

| Situação | Pílula | Texto | Ação |
|---|---|---|---|
| sem as variáveis | "Não configurado" | "O WhatsApp precisa da Evolution API configurada no servidor." | — |
| não ligado | "Não conectado" | "Converse com o assistente pelo WhatsApp. Você confirma cada sugestão respondendo 1 ou 2." | **Conectar WhatsApp** |
| código gerado | "Não conectado" | "Envie a mensagem `GEOAI <código>` para +55 11 90000-0000. O código vale por 15 minutos." | **Abrir WhatsApp** (`https://wa.me/5511900000000?text=GEOAI%20<código>`), com o código visível |
| ligado | "Conectado" | "Conversando pelo WhatsApp em <nome/número>." | **Desconectar WhatsApp** |

Com o código aberto, o cartão consulta o estado a cada 4 segundos, por até 15 minutos, como o do Telegram; ao fim dos 15 minutos, o código some do cartão.

Nos estados "não ligado" e "código gerado", o cartão mostra em letra menor: "As mensagens passam pelo WhatsApp pessoal de <número> (o número do GeoAI) e ficam visíveis para quem administra esse número. Se você já conversa com esse número, essa conversa passa a ser respondida pelo assistente." Sem o número (antes de gerar o código), "de <número> (o número do GeoAI)" vira "do número do GeoAI".

## Conversa ligada

- **Ao conectar:** "🤖 Pronto! Este WhatsApp está conectado ao seu GeoAI." mais a ajuda.
- **Ajuda:** "🤖 Me conte o que você quer organizar ou pergunte sobre sua agenda, seus gastos e seus registros. Eu sugiro as ações e você confirma respondendo 1 ou 2.\n\nComandos: ajuda e desconectar."
- **Comandos:** `ajuda` e `desconectar`, com ou sem `/`, ignorando maiúsculas. `desconectar` responde "🤖 WhatsApp desconectado do GeoAI. Para conectar de novo, use Configurações no app."
- **Mensagem normal:**
  - passa pela mesma rodada do assistente do Telegram (modo guiado sem IA; com IA, o mesmo modelo, as mesmas ferramentas e a agenda externa), com o canal `whatsapp` nas instruções: "respondendo 1 no WhatsApp";
  - com sugestões, a resposta termina com a lista e "Responda 1 para adicionar ou 2 para descartar.";
  - texto quebrado em partes de até 4000 caracteres.
- **Escolhas "1/2":** cada mensagem do bot com opções grava, na ligação, a lista das escolhas (os mesmos códigos dos botões do Telegram: `add:<id>`, `drop:<id>`, `trt:d:<id>`, `trt:s:<id>`, `fh:d:<id>`, `fh:h:<id>`, `fh:s:<id>`) com a hora da gravação: `{"at":"<ISO>","items":[…]}`. Um valor antigo (lista simples) ou inválido conta como sem escolhas.
  - As escolhas valem por **12 horas**; depois disso são ignoradas.
  - Uma resposta exatamente `1` ou `2` (espaços ignorados) aplica a escolha correspondente da última mensagem com opções, uma vez só: a lista é limpa com uma troca condicional (`WHERE choices = <valor lido>`) antes de aplicar, e um segundo `1` ao mesmo tempo não aplica nem responde. Se não for possível salvar, a lista volta, para o "Tente de novo" funcionar. As respostas são as mesmas do Telegram, com `🤖`.
  - Toda mensagem que não for uma escolha válida limpa as escolhas logo ao chegar, antes do assistente. Um lembrete que chegue durante a resposta do assistente grava escolhas novas, que continuam valendo, porque a rodada só grava escolhas quando traz sugestões novas.
  - `1` ou `2` sem escolhas válidas (nenhuma, vencidas ou já usadas) vai para o assistente como texto normal.

## Lembretes

- As funções `sendDueReminders` (Testosterona) e `sendFemaleReminders` (Saúde feminina) passam a **agrupar as conversas por usuário**. Cada lembrete devido é enviado para todas as conversas ligadas do usuário (Telegram e WhatsApp), e o "já lembrado" (`remindedOn`) é gravado uma vez, se ao menos um envio der certo. Uma falha num canal não impede o outro.
- Os crons existentes listam as ligações dos dois canais. No WhatsApp, as conversas usam o prefixo `wa:`, e o envio troca os botões por texto: "🤖 <texto do lembrete>\n\nResponda 1 para ✅ Apliquei · 2 para Adiar 1 dia". O texto vem dos rótulos dos botões, e as escolhas ficam gravadas na ligação depois do envio.
- Na conversa consigo mesmo, as mensagens do bot podem chegar sem notificação; para o dono, o Telegram continua sendo o canal que avisa.

## Dados

Tabelas novas (migração Drizzle):
- `whatsapp_links`:
  - `jid` (PK) e `user_id` (único);
  - `label`;
  - `history` (JSON, padrão `[]`), `pending` (JSON, padrão `{}`) e `choices` (JSON `{at,items}`, padrão `[]`, que conta como sem escolhas);
  - `recent_ids` (JSON, padrão `[]`, últimos 20 `key.id`);
  - `linked_at`.
- `whatsapp_codes`: `code` (PK, 6 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`), `user_id`, `expires_at` (15 minutos). Uso único; gerar um código apaga os anteriores do usuário e os vencidos.

## Rotas

| Rota | Faz |
|---|---|
| `POST /api/whatsapp` | Webhook público. Confere o cabeçalho `x-geoai-secret` (SHA-256 de `'geoai-whatsapp:'+EVOLUTION_API_KEY`) e responde 401 se não bater. Processa só `messages.upsert` da instância configurada e responde sempre 200, para a Evolution não reenviar. |
| `GET /api/whatsapp/link` | Sessão. Devolve `{configured, number, linked:{label,linkedAt}|null}`; `number` vem só do cache, sem chamar a Evolution (pode ser `null`). |
| `POST /api/whatsapp/link` | Sessão + mesma origem. Registra o webhook da instância (`POST /webhook/set/<instância>` com `url = origem + '/api/whatsapp'`, `enabled:true`, `events:['MESSAGES_UPSERT']`, `byEvents:false`, `base64:false`, `headers:{'x-geoai-secret':…}`), só em produção (`VERCEL_ENV=production`) e quando o host da origem é `VERCEL_PROJECT_PRODUCTION_URL`, para que uma prévia ou a URL fixa de um deploy antigo não tome o webhook. Cria o código e devolve `{code, url, number, webhook}`. |
| `DELETE /api/whatsapp/link` | Sessão + mesma origem. Desfaz a ligação. |

O número da instância vem de `GET /instance/fetchInstances?instanceName=<instância>` (`ownerJid`), com cache em memória de 5 minutos.

## Erros

- **Evolution fora do ar ou ngrok desligado:** o `POST /link` responde 502 com "Não foi possível falar com o WhatsApp: …", e o cartão mostra o aviso. Tempo esgotado vira "A Evolution demorou para responder."; falha de rede, "Não foi possível alcançar a Evolution. Confira se o computador, a Evolution e o ngrok estão ligados." No webhook, uma falha de envio é registrada no log e a rota ainda responde 200.
- **IA indisponível:** "🤖 O assistente está indisponível agora. Tente novamente em instantes."
- **Código vencido ou usado:** "🤖 Este código expirou ou já foi usado. Gere um novo em Configurações no GeoAI."
- **Falha ao salvar:** "🤖 Não foi possível salvar agora. Tente de novo."

## Testes

- Unitários (`tests/whatsapp.test.mjs`):
  - leitura do evento e cada regra: grupo, `fromMe` para outro contato, conversa consigo mesmo, eco do 🤖, texto de `conversation`/`extendedTextMessage`, vazio, evento de outra instância;
  - comando `GEOAI` e comandos `ajuda`/`desconectar`;
  - texto das opções e leitura do "1/2";
  - segredo;
  - link `wa.me`;
  - quebra de texto;
  - cliente da Evolution com `fetch` falso (cabeçalhos `apikey` e do ngrok, corpo do `sendText` e do webhook, erro HTTP).
- Unitários da resolução de escolhas, comum aos dois canais: `trt`, `fh`, `add`, `drop`, escolha vencida.
- Lembretes:
  - um usuário com dois canais recebe nos dois e é marcado uma vez;
  - falha num canal não impede o outro;
  - os testes atuais continuam passando.
- Também `npm test`, `npm run typecheck`, `npm run build` e ESLint sem erros nos arquivos novos, sem aumentar os já existentes.
- Manual, em produção:
  - conectar pela conversa consigo mesmo;
  - "o que tenho hoje?";
  - aceitar uma sugestão com 1;
  - lembrete com 1;
  - mensagem de um amigo sem resposta;
  - grupo sem resposta.

## Fora do escopo

Botões interativos do WhatsApp, áudio, imagens, mensagens em grupo e o uso da API oficial do WhatsApp Business.
