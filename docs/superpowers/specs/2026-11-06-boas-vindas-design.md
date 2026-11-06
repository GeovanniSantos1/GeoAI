# Página de boas-vindas pós-compra (/obrigado) — especificação

Data: 06/11/2026. O proprietário aprovou o desenho na conversa. A referência de estrutura é a página de obrigado da Direct Line (appdirectline.com/obrigado). Copiamos a estrutura, não o visual.

## Objetivo

Quem acabou de assinar o GeoAI chega a uma página que agradece e dá as direções para deixar tudo pronto: um vídeo tutorial feito pelo motion (projeto geoai-video), os próximos passos, o botão para entrar no app e a ajuda.

Decisões do proprietário:
- a página aparece **depois do pagamento**, e o mesmo link serve para mandar a qualquer pessoa;
- o vídeo é o **tutorial de conexões**, com um final de boas-vindas no lugar de "Teste grátis";
- **não há bloco de comunidade**;
- o bot do Telegram aparece como **@GeoAIbot**.

Sucesso:
- depois de pagar na AbacatePay, a pessoa cai em `/obrigado?assinatura=ok`;
- "Entrar no app" leva a `/?assinatura=ok`, e o app continua confirmando o pagamento como hoje ("Confirmando pagamento…" e depois "Assinatura ativa. Obrigado!");
- quem abre `/obrigado` sem o parâmetro vai para `/`, sem aviso de pagamento;
- a página abre sem login, funciona no celular (390 px) e no computador, nos temas claro e escuro;
- o vídeo começa no mudo, tem "Toque para ouvir" e capítulos que pulam para cada parte.

## O que muda no app

1. `lib/abacatepay.ts`, em `subscriptionBody`: `completionUrl` passa de `origin + '/?assinatura=ok'` para `origin + '/obrigado?assinatura=ok'`. O `returnUrl` (quem desiste do checkout) continua sendo `origin + '/'`.
2. Nova rota `app/obrigado/page.tsx`. É página estática, que tem precedência sobre `app/[section]`. Ela é pública, já que o `proxy.ts` não bloqueia páginas, e usa o `PublicShell` com o rodapé legal de sempre. Metadados: título "Boas-vindas — GeoAI" e `robots: noindex`.
3. Novo `components/boas-vindas.tsx` com as partes interativas, que são componentes de cliente:
   - o vídeo, que começa com `muted`, `autoPlay`, `playsInline` e `preload="metadata"`, usa uma imagem de capa e tem um botão "Toque para ouvir" que tira o mudo e volta ao começo;
   - os capítulos, que mudam o `currentTime`;
   - o botão "Entrar no app", que repassa `?assinatura=ok` só quando a página foi aberta com ele.
4. CSS novo em `app/globals.css`, com prefixo `.welcome-`. Ele usa os tokens que já existem (`--canvas`, `--surface`, `--green`, `--gold`, `--border`…), e o tema escuro vem de graça por `:root[data-theme=dark]`. A faixa correndo para quando há `prefers-reduced-motion`.
5. Arquivos em `public/boas-vindas/`: `tutorial.mp4` (720×1280, H.264 + AAC, por volta de 5 MB, com `+faststart`) e `capa.jpg`.

## Conteúdo da página (pt-BR)

- **Faixa correndo:** Seu dia com direção · Lembretes no WhatsApp e no Telegram · Agenda num lugar só · IA que organiza com você.
- **Topo:** "Boas-vindas ao *GeoAI*", com GeoAI em itálico Georgia dourado. Abaixo, "Obrigado por assinar! Em poucos minutos o GeoAI fica pronto para organizar o seu dia." e "✓ Assista ao vídeo: ele mostra como conectar o WhatsApp, o Telegram e a sua agenda."
- **Vídeo**, com capítulos: Configurações, WhatsApp, Telegram, Agenda. Os tempos são lidos das palavras do vídeo gerado.
- **Seus próximos *passos*:**
  1. Coloque o GeoAI na tela inicial. No iPhone, abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início". No Android, abra no Chrome, toque no menu ⋮ e depois em "Adicionar à tela inicial".
  2. Conecte o WhatsApp ou o Telegram. Em Configurações, toque em Conectar e siga o vídeo.
  3. Conecte a sua agenda. Em Configurações, em "Calendário & lembretes", toque em Conectar ao lado do Google Agenda ou do Outlook / Teams. É só leitura.
  4. Mande um áudio contando o seu dia. No WhatsApp ou no Telegram, o GeoAI organiza, e você confirma cada sugestão.
  - Botão: "Entrar no app →".
- **Precisa de *ajuda*?** Quatro dicas:
  - Entre com o mesmo e-mail da sua conta.
  - O código do WhatsApp e o link do Telegram valem 15 minutos; se passar, gere outro.
  - Uma conta Microsoft da empresa pode precisar da aprovação do TI.
  - Se você pagou e o app ainda pede assinatura, espere alguns minutos e recarregue, sem pagar de novo.
  - Botões: "Falar no WhatsApp →" vai para `LEGAL.whatsappUrl` com o texto "Olá! Acabei de assinar o GeoAI e preciso de ajuda.". "Mandar e-mail →" vai para `mailto:LEGAL.email`.
- **Rodapé:** o `SiteFooter` que já existe.

Todos os textos sobre o app foram conferidos no código: settings.tsx, as rotas do WhatsApp e do Telegram (áudio com `voiceReady`), billing.tsx e manifest.webmanifest.

## Vídeo (projeto geoai-video, fora deste repositório)

- **Captura do Telegram:** refazer com `?bot=GeoAIbot` e gerar de novo `tutorial_conexoes` (a versão dos Reels).
- **Nova pasta `projetos/boas_vindas_conexoes`:** é uma cópia do tutorial com três mudanças:
  - a primeira fala vira "Boas-vindas ao GeoAI! Vamos conectar…";
  - a última fala vira "Pronto, está tudo configurado. Se precisar, fale com a gente pelo suporte.";
  - a última cena vira um `icone_destaque` com o ícone de check e "Tudo pronto", no lugar de `chamada_seguir`.
- **Versão para a web:** sai da versão `_celular` (720p), comprimida de novo para por volta de 5 MB. A capa é um quadro do começo.

## Testes

- `tests/billing.test.mjs`: o teste de `subscriptionBody` passa a esperar `completionUrl` em `/obrigado?assinatura=ok`. Escrevo o teste antes de mudar o código.
- Um teste pequeno do botão "Entrar no app", com e sem `?assinatura=ok`, numa função pura em `lib/boas-vindas.ts`.
- `npx tsc --noEmit` e `npm test`.
- Visual: a página vai para o harness isolado (esbuild + Playwright, sem chaves do Clerk). Fotos em 390 px e 1280 px, nos temas claro e escuro. Também confiro os capítulos e o botão de som.
- O build da Vercel no PR confirma o `next build`.

## Fora do escopo

- Comunidade, página de sugestões e qualquer mudança no fluxo do Clerk.
- Publicar em produção: só depois do merge, quando o proprietário pedir.
