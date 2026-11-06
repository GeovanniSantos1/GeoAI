# E-mails de boas-vindas (cadastro) e de assinatura confirmada (compra) — especificação

Data: 06/11/2026. O proprietário aprovou o desenho na conversa. Esta especificação depende da página `/obrigado` (PR #24, `docs/superpowers/specs/2026-11-06-boas-vindas-design.md`).

## Objetivo

Mandar por e-mail o guia da página `/obrigado` em dois momentos: logo depois do cadastro no GeoAI e logo depois da compra.

Decisões do proprietário:
- o serviço é o **Resend**, instalado pela loja da Vercel, no plano grátis (3.000 e-mails por mês e 100 por dia);
- o remetente é **`GeoAI <contato@geochat.ia.br>`**, e as respostas vão para `LEGAL.email`;
- o de cadastro vai para as **contas novas e, uma única vez, para as que já existem**;
- são **dois e-mails diferentes**: o de cadastro e o de compra.

Sucesso:
- uma conta nova recebe "Boas-vindas ao GeoAI" ao abrir o app pela primeira vez, com a data do fim do teste;
- uma conta antiga recebe o mesmo e-mail uma vez, sem a linha do teste quando for grátis ou paga;
- quem não abre o app recebe pelo envio diário;
- quem assina recebe "Assinatura confirmada", com o plano e a data de renovação;
- ninguém recebe o mesmo e-mail duas vezes, mesmo com duas abas abertas ou com o webhook repetido;
- uma falha no envio não derruba o app nem o webhook, e o e-mail é tentado de novo depois;
- sem `RESEND_API_KEY`, nada é enviado e o resto continua igual.

## Envio

- **API do Resend sem SDK:** `lib/email.ts` faz um `POST https://api.resend.com/emails` com `Authorization: Bearer RESEND_API_KEY` e o cabeçalho `Idempotency-Key` (`<tipo>/<userId>`, que o Resend guarda por 24 h).
- **Corpo da chamada:** `from`, `to`, `reply_to`, `subject`, `html` e `text`.
- **Configuração:** `emailConfig(env)` devolve `{apiKey, from, replyTo}` ou `null`. `EMAIL_FROM` é opcional; o padrão é `GeoAI <contato@geochat.ia.br>`.

## Uma vez só

- **Tabela nova `email_sends`** (migração 0008), com as colunas `user_id`, `kind` e `sent_at`. A chave primária é `(user_id, kind)`.
- **`sendOnce(store, userId, kind, enviar)`, em `lib/email.ts` (puro e testável):**
  1. reserva a linha com `insert … on conflict do nothing returning`;
  2. se não conseguir reservar, não faz nada;
  3. se reservar, envia;
  4. se o envio falhar, apaga a reserva para tentar de novo depois.
- **Tipos de envio (`kind`):**
  - `boas-vindas`;
  - `compra:<subscriptionId>`: cada assinatura nova tem o seu, e as renovações não mandam nada.

## Gatilhos

1. **Ao abrir o app** (`GET /api/state`): depois da resposta, com `after()`, chama `welcomeOnce`. A rota já tem o nome, o e-mail e a situação da assinatura. Isso cobre as contas novas e, na próxima vez que abrirem o app, as antigas.
2. **Envio diário** (`/api/cron/boas-vindas`, às 13h UTC, com `CRON_SECRET`):
   - lê as contas do Clerk (`users.getUserList`), tira quem já tem `boas-vindas` e envia no máximo 40 por dia, um a cada 600 ms, porque o Resend aceita 2 por segundo;
   - a linha do teste usa a conta de cobrança que já existe (`accountOf`). O envio **não cria** conta de cobrança, para o teste não começar antes da pessoa abrir o app.
3. **Compra** (webhook da AbacatePay): quando `subscription.completed` é aplicado, acha a conta pela `subscriptionId` e envia `compra:<subscriptionId>` com `after()`. `processEvent` não muda.

## Conteúdo

Os dois e-mails são em HTML de tabela com estilos dentro das tags (creme `#f5f5ef`, verde `#285442`, dourado `#a77d4e`, itálico Georgia) e também em texto puro. Têm:

- **Saudação:** "Olá, {primeiro nome}!".
- **Cadastro:**
  - assunto "Boas-vindas ao GeoAI: seu guia para começar";
  - abertura "Boas-vindas ao *GeoAI*";
  - no teste, a linha "Seu teste grátis vai até {dd/mm, HHh}", no fuso da pessoa (ou `America/Sao_Paulo`).
- **Compra:**
  - assunto "Assinatura confirmada: boas-vindas ao GeoAI";
  - a linha "Seu plano {Mensal|Anual} está ativo e renova em {dd/mm/aaaa}".
- **Capa do vídeo:** `public/boas-vindas/capa-email.jpg`, 4:3, com o botão ▶ "Assista ao tutorial · 1 min". O link é `/obrigado?origem=email`.
- **O guia:** os mesmos 4 passos da página, vindos de um módulo comum, e o botão "Abrir o GeoAI" para `LEGAL.site`.
- **Ajuda:** o WhatsApp do suporte com a mensagem pronta e o e-mail.
- **Rodapé:** "Você recebeu este e-mail porque tem uma conta no GeoAI.", com a empresa, o CNPJ e a cidade.

Os textos dos passos saem de `lib/boas-vindas.ts` (`PASSOS`, `AJUDA`), que a página `/obrigado` também usa.

**Ajuste na página `/obrigado`:** "Obrigado por assinar!" só aparece com `?assinatura=ok`. Sem o parâmetro, o texto é "Em poucos minutos o GeoAI fica pronto para organizar o seu dia.".

## Configuração (pela conta do proprietário na Vercel)

1. `vercel integration add resend/resend-email`, no plano grátis. O proprietário aceita os termos no navegador. A integração cria `RESEND_API_KEY` no projeto.
2. O domínio `geochat.ia.br` é cadastrado no Resend. Os registros de DNS (MX, SPF e DKIM do subdomínio de envio) vão na Vercel DNS, que já é o DNS do domínio.
3. Nenhuma chave é mostrada nem gravada em arquivo do projeto.

## Privacidade

O Resend entra em `/privacidade` como serviço que recebe o nome e o e-mail para enviar as mensagens da conta. Ele também entra na lista de serviços com servidores nos Estados Unidos. `LEGAL.updatedAt` muda.

## Testes

- `tests/email.test.mjs`:
  - conteúdo dos dois e-mails, com e sem teste;
  - escape do nome com HTML;
  - links, configuração e corpo da chamada ao Resend (com `fetch` falso);
  - `sendOnce`: envia uma vez, não repete e libera a reserva quando o envio falha.
- Os testes atuais continuam passando, e o `npm run typecheck` também.
- Teste real: os dois e-mails vão para o Gmail do proprietário antes de publicar.

## Fora do escopo

Lista de marketing, descadastro, e-mails de renovação ou de cancelamento, WhatsApp e Telegram.
