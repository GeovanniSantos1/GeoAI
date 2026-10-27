# Assinatura paga com a AbacatePay — especificação

Data: 27/10/2026. Desenho aprovado em conversa com o proprietário depois de duas rodadas de perguntas: o modelo de negócio e depois o teste e o bloqueio.

## Objetivo

Cobrar pelo GeoAI com uma assinatura no cartão, processada pela AbacatePay.

Decisões do proprietário:
- o plano pago libera o app inteiro;
- quem cria conta tem **3 dias de teste grátis, sem cartão**;
- a assinatura é **cobrada no cartão automaticamente**, em dois planos: **Mensal** e **Anual**;
- **as contas que já existem ficam grátis para sempre**, assim como os e-mails que o proprietário indicar;
- quando o teste acaba ou a assinatura vence, o app mostra só a tela de planos, mas continua permitindo baixar o backup, apagar os dados e sair.

Sucesso:
- uma conta nova vê a faixa do teste, assina o Mensal no checkout da AbacatePay e volta ao app com o acesso liberado;
- uma conta com o teste vencido vê só a tela de planos;
- uma conta grátis nunca vê cobrança;
- "Cancelar renovação" mantém o acesso até a data já paga;
- um webhook repetido não estende o acesso duas vezes.

## O que a API da AbacatePay oferece (v2, conferido em 27/10/2026)

**Base e autenticação**
- Base: `https://api.abacatepay.com/v2`. Produção e dev mode usam o mesmo servidor; a chave decide o ambiente.
- Autenticação: `Authorization: Bearer <chave>`.
- Respostas vêm no envelope `{data, success, error}`.
- Valores são sempre em centavos.

**Produtos e assinaturas**
- `GET /products/get?id=prod_…` devolve `price` e `cycle` (`MONTHLY`, `ANNUALLY` …). Permissão: `PRODUCT:READ`.
- `POST /subscriptions/create` cria um checkout de assinatura (`bill_…`) e devolve a `url` da página de pagamento. Permissão: `SUBSCRIPTION:CREATE`.
  - Corpo: `items` (exatamente 1 produto com ciclo), `methods` (assinatura só aceita `["CARD"]`), `externalId`, `metadata`, `returnUrl`, `completionUrl` e `retryPolicy {maxRetry 1–10, retryEvery 1–30 dias}`.
- `POST /subscriptions/cancel {id: "subs_…"}` cancela **na hora** (`cancelPolicy: NOW`), sem carência. Permissão: `SUBSCRIPTION:DELETE`.

**Webhooks**
- Envelope comum: `{id: "log_…", event, apiVersion: 2, devMode, data}`. O `id` é o mesmo em todas as retentativas de um evento.
- Autenticação, em duas camadas:
  - o segredo cadastrado chega na query `webhookSecret` e é o que prova a origem;
  - o cabeçalho `X-Webhook-Signature` traz o HMAC-SHA256 do corpo cru, em base64, feito com a chave pública fixa publicada na documentação.
- Entrega: qualquer `2xx` em até 30 s conta como entregue. A AbacatePay faz até 7 tentativas em cerca de 18 h, e repete em `5xx`, `408`, `429` e timeout. Um `4xx` não é repetido, e um `410` desativa o webhook.
- Eventos usados:
  - `subscription.completed` (assinatura ativada): traz `data.subscription.id`, `.frequency`, `data.customer.id`, `data.payment` e `data.checkout.id` (o `bill_…` que criamos);
  - `subscription.renewed` (cobrança recorrente paga): traz `data.subscription.id`, e o `data.checkout.id` é um `bill_` novo;
  - `subscription.cancelled`: traz `data.subscription.cancelledDueTo`, que vale `"max_payment_retries_exceeded"` quando as tentativas de cobrança acabam;
  - `checkout.refunded`: traz `data.checkout.id` e `data.checkout.customerId`.
- O app não valida o payload inteiro com um schema rígido, como a documentação recomenda. Ele lê só os campos de que precisa.

## O que a pessoa vê

- **Conta nova:** o app funciona por completo. No topo aparece uma faixa discreta: "Teste grátis: faltam 2 dias · Assinar". "Assinar" abre os planos numa janela.
- **Planos:** dois cartões.
  - **Mensal:** "R$ X por mês".
  - **Anual:** "R$ Y por ano", com a linha "equivale a R$ Y/12 por mês" e o selo "economize N%" quando houver desconto.
  - Os preços vêm do produto na AbacatePay.
  - Abaixo dos cartões vem a nota: "Cobrança automática no cartão. Cancele quando quiser em Configurações; o acesso continua até o fim do período pago. 7 dias para desistir com reembolso integral." e os links para os Termos.
  - "Assinar" leva ao checkout da AbacatePay, que é só cartão.
- **Volta do checkout** (`/?assinatura=ok`): o app mostra "Confirmando pagamento…" e consulta `/api/state` a cada 3 s, por até 60 s, até o acesso ficar ativo. Ao confirmar, aparece o aviso "Assinatura ativa. Obrigado!" e o parâmetro sai da URL. Se o tempo acabar, a mensagem é "O pagamento ainda não foi confirmado. Se você pagou, aguarde alguns minutos e recarregue a página."
- **Teste ou assinatura vencidos:** a tela de planos ocupa o lugar do app.
  - Título: "Seu teste grátis acabou" ou "Sua assinatura venceu".
  - Texto: "Seus dados continuam guardados."
  - Abaixo dos planos ficam os botões "Baixar backup", "Apagar meus dados" (com confirmação, como em Configurações) e "Sair".
  - O rodapé legal continua.
- **Configurações → cartão "Assinatura"** (não aparece com a cobrança desligada):
  - grátis: "Acesso liberado, sem cobrança.";
  - teste: "Teste grátis até DD/MM." e o botão "Ver planos";
  - ativa: "Plano Mensal · renova em DD/MM." e o botão "Cancelar renovação". A confirmação diz: "Nenhuma nova cobrança será feita. Você continua com acesso até DD/MM.";
  - cancelada com dias pagos: "Plano Mensal cancelado · acesso até DD/MM." e o botão "Ver planos".
- **WhatsApp e Telegram com acesso vencido:**
  - toda mensagem recebe "Seu acesso ao GeoAI venceu. Para voltar a usar o assistente e os lembretes, assine em <link do app>.";
  - os comandos de desconectar e de ajuda continuam funcionando;
  - nada vai para a IA.
- **Lembretes** (testosterona, saúde feminina e água) **e a sincronização da agenda** pulam as contas vencidas.

## Regras de acesso

O app avalia uma conta nesta ordem e para na primeira regra que se aplica (`accessOf`, uma função pura):

1. **Cobrança desligada** (falta alguma variável da AbacatePay) → `off`. Libera tudo e não mostra nada de cobrança. Assim, um erro de configuração não tranca ninguém para fora.
2. **Conta grátis** (`free`) → `free`. É grátis:
   - toda conta que já tem espaço salvo quando a migração roda;
   - todo e-mail listado em `BILLING_FREE_EMAILS`. O `GET /api/state` confere o e-mail e grava `free = true`. Tirar o e-mail da lista depois não revoga o acesso.
3. **`paid_until` + 3 dias de folga > agora** → `active`. Vale mesmo com a assinatura cancelada. A folga cobre as novas tentativas de cobrança: até 3, uma por dia.
4. **`trial_ends_at` > agora** → `trial`.
5. Nenhuma das anteriores → `expired`.

O registro da conta é criado na primeira vez que o app pede o acesso dela, com `trial_ends_at` = agora + 3 dias. Uma conta que existe no Clerk mas nunca abriu o app começa o teste quando abrir.

### Datas

O "pago até" é guardado sem a folga, como o fim do período.

| Evento | Efeito |
|---|---|
| `subscription.completed` e `subscription.renewed` | `paid_until = max(paid_until atual, agora + período)`. O período é 1 mês no Mensal e 1 ano no Anual, contado com `addMonths`/`addYears`. O `max` torna os eventos fora de ordem inofensivos. |
| `subscription.cancelled` | Grava `cancelled_at` e não mexe no `paid_until`. |
| `checkout.refunded` | `paid_until = agora`, sem folga. Grava também `refunded_at`, para a folga não se aplicar. O checkout é localizado pelo `bill_` (em `billing_checkouts`) ou pelo `customerId` (em `billing_accounts`). |

O plano vem de `data.subscription.frequency`: `MONTHLY` é o Mensal e `ANNUALLY` é o Anual. Um evento sem frequência conhecida usa o produto de `data.checkout.items[0].id`, comparado com as variáveis de ambiente.

### O que fica bloqueado com `expired`

O servidor responde `402` com `{error: "Seu acesso venceu. Assine para continuar.", billing}` em:
- `POST /api/state`, exceto o comando `reset` ("Apagar meus dados");
- `GET /api/state/version`;
- `/api/assistant`, `/api/calendar`, `/api/finance/fatura`, `/api/telegram/link` e `/api/whatsapp/link`;
- `/api/exams`, `/api/exams/[id]` e `/api/exams/[id]/review`;
- as rotas do Foco que gravam ou chamam IA: todas as que passam por `boardUser(request)` com `write = true`, inclusive a de importar.

Continuam respondendo, porque servem ao backup ou são só leitura:
- `GET /api/state`, que sempre devolve o espaço e `billing`;
- `GET /api/foco/export`, as outras leituras do Foco e `GET /api/exams/[id]/file`.

## Fluxo do pagamento

1. **`POST /api/billing/checkout {plan: "monthly" | "annual"}`.** Exige sessão e mesma origem.
   - Só aceita contas em `trial` ou `expired`, ou em `active` com a assinatura cancelada. Nos outros casos, responde `409`: "Você já tem acesso."
   - Chama `POST /subscriptions/create` com:
     - o produto do plano;
     - `methods: ["CARD"]`;
     - `externalId` = userId;
     - `metadata: {userId, plan}`;
     - `returnUrl` = `<origem>/`;
     - `completionUrl` = `<origem>/?assinatura=ok`;
     - `retryPolicy: {maxRetry: 3, retryEvery: 1}`.
   - Grava `billing_checkouts(bill_…, userId, plan)` e devolve `{url}`.
   - O app manda o navegador para essa URL.
2. **`POST /api/billing/webhook?webhookSecret=…`.**
   - Sem configuração, responde `404`.
   - Com segredo ou HMAC inválido, responde `401`.
   - Com corpo que não é JSON, responde `400`.
   - Numa transação, insere o `id` do evento em `billing_events`. Se o `id` já existia, responde `200` sem fazer nada. Se não, aplica o efeito e grava.
   - Um erro na transação desfaz tudo e responde `500`, para a AbacatePay tentar de novo.
   - Evento de usuário desconhecido, ou de tipo não usado: o `id` é gravado e o app responde `200`, com um registro no log.
   - `subscription.completed`: localiza o usuário pelo `data.checkout.id` em `billing_checkouts`. Grava `subscription_id`, `customer_id` e `plan`, estende o `paid_until` e limpa `cancelled_at` e `refunded_at`.
   - `subscription.renewed`: localiza o usuário por `subscription_id` e estende o `paid_until`.
3. **`POST /api/billing/cancel`.** Exige sessão, mesma origem, `subscription_id` gravado e assinatura ainda não cancelada.
   - Chama `POST /subscriptions/cancel` e grava `cancelled_at`. O webhook `subscription.cancelled` que chega depois não muda nada.
   - Devolve o novo `billing`.
4. **`GET /api/billing/plans`.** Exige sessão.
   - Busca os 2 produtos em `GET /products/get`, com cache de 10 minutos na memória da função.
   - Devolve `[{plan, name, price}]`, com o preço em centavos.
   - Se a AbacatePay falhar, devolve `503`, e a tela mostra "Não foi possível carregar os planos. Tente de novo."

## Dados (migração `0005`)

| Tabela | Colunas |
|---|---|
| `billing_accounts` | `user_id` (PK), `free` (boolean, padrão false), `trial_ends_at`, `paid_until`, `plan`, `subscription_id` (único), `customer_id`, `cancelled_at`, `refunded_at`, `updated_at` |
| `billing_checkouts` | `id` (`bill_…`, PK), `user_id`, `plan`, `created_at` |
| `billing_events` | `id` (`log_…`, PK), `event`, `received_at` |

- As datas são texto ISO, como no resto do esquema.
- A migração termina com um passo de dados escrito à mão: insere `free = true` para todo `user_id` de `workspaces`, com `ON CONFLICT DO NOTHING`.
- O build da Vercel roda `db:migrate`. Como as prévias e a produção usam o mesmo banco, "conta existente" quer dizer "existe quando o primeiro build com a `0005` roda".

## Código

| Arquivo | O que faz |
|---|---|
| `lib/billing.ts` | Funções puras e tipos: `accessOf`, `addPeriod`, `extendPaid`, `planOfEvent`, `annualSaving`, `isFreeEmail`, o tipo `BillingView` e as constantes `TRIAL_DAYS = 3` e `GRACE_DAYS = 3`. |
| `lib/abacatepay.ts` | Cliente da API (`fetch` com a chave), `verifyWebhook(rawBody, signature, querySecret)` e a leitura tolerante dos eventos (`readEvent`). |
| `lib/billing-server.ts` | Acesso ao banco: `ensureAccount`, `billingView`, `requireAccess(userId)` (devolve a `Response` 402 ou `null`), `activeUserIds(ids)` para os crons, `applyEvent` (a transação) e `markFree`. |
| `app/api/billing/{checkout,webhook,cancel,plans}/route.ts` | As 4 rotas novas. |
| Rotas e bots existentes | Chamam `requireAccess` nos pontos listados acima. O Telegram e o WhatsApp usam `EXPIRED_TEXT`. |
| `GET /api/state` e `StateResponse` | Ganham `billing: BillingView`. |
| `components/norte/billing.tsx` | `Paywall`, `PlansPicker`, `TrialBar`, `BillingCard` e a confirmação da volta do checkout. |
| `NorteApp.tsx` | Mostra o `Paywall` no lugar do app quando a conta está `expired`. |
| `settings.tsx` | Ganha o `BillingCard`. O download do backup sai para uma função compartilhada, porque o `Paywall` também usa. |
| `lib/legal.ts` | Ganha `site: 'https://geo-ai-mocha.vercel.app'`, usado no texto dos bots. |
| Termos e Privacidade | Ver a seção seguinte. `LEGAL.updatedAt` passa para a data do lançamento. |

## Termos e Privacidade

**Termos, item 5 ("Planos pagos e pagamentos"):**
- conta nova tem 3 dias de teste grátis sem cartão;
- depois, o uso continua com o plano Mensal ou o Anual, cobrado no cartão pela AbacatePay e renovado automaticamente a cada período até ser cancelado;
- o preço aparece antes do pagamento;
- o cancelamento é feito em Configurações → Assinatura ou pelos contatos; ele impede as próximas cobranças, e o acesso segue até o fim do período pago;
- arrependimento em 7 dias, com reembolso integral; o acesso pago termina no reembolso;
- sem assinatura ativa, os dados ficam guardados e podem ser baixados ou apagados.

**Privacidade, itens 2 e 6:**
- os dados de pagamento passam a incluir o plano, a situação e as datas da assinatura e os identificadores da AbacatePay (assinatura e cliente);
- esses registros são guardados pelo prazo das obrigações fiscais.

## Configuração

**Variáveis de ambiente.** Ficam na Vercel, nunca no repositório. As sensíveis são marcadas como sensíveis.
- `ABACATEPAY_API_KEY` (sensível);
- `ABACATEPAY_WEBHOOK_SECRET` (sensível): o mesmo segredo cadastrado no webhook;
- `ABACATEPAY_PRODUCT_MONTHLY` e `ABACATEPAY_PRODUCT_ANNUAL`: os `prod_…`;
- `BILLING_FREE_EMAILS`: e-mails separados por vírgula, sem diferença entre maiúsculas e minúsculas.

A cobrança só liga com as 4 primeiras preenchidas.

**O que o proprietário faz no painel da AbacatePay:**
1. Cria o produto "GeoAI Mensal" com ciclo `MONTHLY` e o produto "GeoAI Anual" com ciclo `ANNUALLY`, com os preços que escolher e sem `trialDays`.
2. Cria uma chave de API com `SUBSCRIPTION:CREATE`, `SUBSCRIPTION:DELETE` e `PRODUCT:READ`.
3. Cria o webhook com a URL `https://geo-ai-mocha.vercel.app/api/billing/webhook?webhookSecret=<segredo>` e os eventos `subscription.completed`, `subscription.renewed`, `subscription.cancelled` e `checkout.refunded`.

O primeiro teste acontece em dev mode, com uma chave e produtos de dev e o cartão `4242 4242 4242 4242`. Depois, as variáveis passam para os valores de produção.

**Atenção:** como o banco é o mesmo, um pagamento simulado em dev mode libera acesso de verdade para a conta usada. O teste deve ser feito com uma conta de teste.

## Testes

**Unitários** (`tests/billing.test.mjs`, no padrão do repositório):
- `accessOf` em cada regra e nas bordas: folga de 3 dias, cancelada com dias pagos e reembolsada;
- `addPeriod` em 31/01 → 28 ou 29/02 e no Anual;
- `extendPaid` com eventos fora de ordem e repetidos;
- `planOfEvent` pela frequência e pelo produto;
- `annualSaving`;
- `isFreeEmail`;
- `verifyWebhook` com segredo certo, segredo errado, HMAC certo, HMAC errado e cabeçalho ausente. O HMAC de teste é gerado com a chave pública;
- `readEvent` com os payloads de exemplo da documentação;
- `applyEvent` com um repositório falso: `completed` com `bill_` conhecido, `bill_` desconhecido, `renewed`, `cancelled`, `refunded` pelo `customerId` e um evento repetido aplicado uma vez só.

**Verificações:** `npm test`, `npm run typecheck`, `npm run lint` (sem problemas novos em relação à `main`) e `npm run build`.

**Ponta a ponta,** depois do merge e com as variáveis de dev:
1. Uma conta nova assina durante o teste com o cartão de teste. O webhook chega, a faixa some e o cartão mostra "renova em".
2. Cancelar renovação mostra "acesso até".
3. Simular um reembolso ou o vencimento: trocar o `trial_ends_at` ou o `paid_until` dessa conta no banco mostra o `Paywall`.
4. O WhatsApp e o Telegram dessa conta recebem o aviso de vencido.

## Fora do escopo

- PIX, boleto e o teste com cartão da AbacatePay;
- trocar de plano com a assinatura ativa;
- cupons;
- e-mail de aviso antes do teste acabar;
- nota fiscal;
- painel administrativo. As contas grátis novas são liberadas pela variável `BILLING_FREE_EMAILS`.
