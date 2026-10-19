# GeoAI — Seu dia com direção

Aplicativo em português para organização pessoal do público masculino, reconstruído a partir dos fluxos e artefatos do Direct Line. O código e o banco são novos e independentes do sistema original.

## O que funciona

- Painel diário, agenda semanal/mensal, tarefas e hábitos recorrentes, objetivos e acompanhamento de conclusão.
- Finanças com receitas, despesas, orçamento, contas mensais, cartões e parcelas com valores exatos em centavos.
- Diário, sono, treinos, medidas, rotinas de alimentação e cuidados, acompanhamento de vícios e recaídas.
- Cursos, estudos e livros com progresso de leitura; casa, compras, trabalho, clientes e metas.
- Notas, revisão semanal, Pomodoro, recompensas e avatar personalizável, masculino ou feminino.
- Perfil e fuso horário, temas claro/escuro, backup JSON validado, calendário ICS para importar/exportar eventos e agenda sincronizada (só leitura) com Outlook/Teams e Google Agenda.
- Assistente de IA em conversa: consulta agenda, finanças e registros e sugere ações, sempre confirmadas pelo usuário; sem chave de IA, modo guiado que transforma texto em propostas de ações.
- Menu Músicas com músicas instrumentais livres e ondas binaurais (alfa para foco e relaxamento, teta para dormir) geradas no navegador, mixer, timer para desligar e um mini-player que continua tocando entre as telas.

Feito em Next.js e hospedado na Vercel. Os dados ficam em Postgres (Neon) por usuário, com login pelo Clerk. A API protege as operações com sessão, origem e controle de versão, para não sobrescrever edições feitas em outra aba.

## Publicar na Vercel

1. Importe o repositório na Vercel (o framework detectado é Next.js).
2. Em **Storage**, conecte um banco **Neon (Postgres)**. A integração cria a variável `DATABASE_URL`.
3. Em **Settings > Environment Variables**, adicione `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` (painel do Clerk > API Keys) e, se quiser, as variáveis opcionais de IA e Telegram abaixo.
4. Faça o deploy. O `vercel.json` roda `npm run db:migrate` antes do `next build`, então as tabelas são criadas a cada publicação, se faltarem.

Para mudar o esquema do banco: edite `db/schema.ts` e rode `npm run db:generate`; a nova migração em `drizzle/` é aplicada no próximo deploy.

## Executar localmente

Requer Node.js 22.13+, npm e um Postgres (pode ser um branch de desenvolvimento do Neon). Crie um `.env.local` a partir do `.env.example` com `DATABASE_URL` e as chaves do Clerk.

```sh
npm ci
npm run db:migrate
npm run dev
```

Abra http://localhost:3000.

## Verificação

```sh
npm test
npm run typecheck
npm run build
```

Os scripts de navegador (`npm run test:e2e` e `tests/smoke-ui.mjs`) foram escritos para o login automático da hospedagem anterior e precisam ser adaptados ao Clerk antes de voltar a rodar. Critérios originais em `docs/qa-results.json`, `docs/progress.md` e `docs/spec.md`.

## Menu Testosterona

- Exames: o usuário envia o laudo (PDF ou imagem), a IA lê os valores e o usuário confere e corrige antes de salvar. A classificação de cada valor (abaixo, dentro ou acima) usa a faixa de referência do próprio laudo e é feita pelo código, não pela IA. O parecer da IA resume os resultados e não dá orientação de dose.
- Protocolo: cadastro do protocolo com as aplicações previstas na Agenda e lembrete diário no Telegram, com os botões Apliquei e Adiar (exige o `TELEGRAM_BOT_TOKEN` e o chat conectado). Também há dicas no menu.
- Arquivos: ficam em um Vercel Blob privado, com prefixo `exames/<userId>/`, e são apagados junto com o exame e em Configurações > Apagar meus dados. Em **Storage**, conecte o Blob ao projeto (cria `BLOB_STORE_ID`/`BLOB_READ_WRITE_TOKEN`).
- Cotas por usuário: 20 envios e 40 pareceres por dia.
- Lembrete diário: a tarefa agendada do `vercel.json` (`0 11 * * *`) chama `/api/cron/trt-reminders`. Cadastre o segredo `CRON_SECRET` na Vercel; sem o cabeçalho `Authorization: Bearer <CRON_SECRET>` a rota responde 401.
- Desenvolvimento local: use `EXAM_FILES=memory` no `.env.local` para guardar os arquivos na memória do servidor, sem Blob. Eles se perdem ao reiniciar.

## Versão feminina

- O perfil guarda como a pessoa quer ser tratada (`gender`: `male`, `female` ou vazio). Contas novas respondem no primeiro acesso; contas criadas antes desta versão seguem no masculino. Dá para trocar em Configurações e em Sua jornada.
- No feminino: avatar com penteado (longo, cacheado ou coque) e brincos opcionais, textos no feminino, categorias Cabelo, Unhas e Maquiagem em Cuidados pessoais, e o assistente (app e Telegram) fala no feminino.
- O menu Testosterona fica oculto para mulheres. Os dados continuam salvos e voltam a aparecer se o perfil for trocado para masculino.

## Menu Saúde feminina

- Aparece para quem escolheu ser tratada no feminino, no lugar do menu Testosterona. Abas: Resumo, Ciclo, Anticoncepcional, Exames, Preventivos e Dicas.
- Ciclo: a previsão usa a média dos últimos 6 ciclos (ou 28 dias, sem histórico); ovulação 14 dias antes da próxima menstruação e janela fértil de 5 dias antes a 1 dia depois. São estimativas, não método contraceptivo.
- Anticoncepcional: uso diário (com ou sem pausa), injeção mensal ou trimestral e DIU/implante. Lembrete no Telegram na hora escolhida, com os botões Tomei e Lembrar em 1h ou Adiar 1 dia.
- Lembrete: na Vercel Hobby cada cron roda uma vez por dia, então o `vercel.json` tem 24 entradas diárias (`0 H * * *`) para `/api/cron/female-reminders`; a rota calcula a hora local de cada pessoa. Usa o mesmo `CRON_SECRET` do lembrete de testosterona.
- Exames: mesma leitura e parecer da IA, com faixas femininas, fase do ciclo na coleta e alertas para hemoglobina abaixo de 8 g/dL, TSH fora de 0,1 a 10 e beta-hCG positivo.

## Integrações e limites

- IA generativa: opcional; exige os segredos de servidor `AI_API_KEY` e `AI_MODEL` (e `AI_BASE_URL` para um endpoint compatível com a OpenAI). Com eles, o assistente vira um agente de conversa que consulta agenda, finanças e registros do usuário e sugere tarefas, lançamentos e notas; nada é salvo sem a confirmação do usuário. Sem eles, funciona no modo guiado. Nunca exponha a chave no cliente.
- Calendário: importação/exportação ICS e sincronização só leitura com Outlook/Teams (Microsoft 365 ou conta pessoal) e Google Agenda, conectados em Configurações. O OAuth e os tokens ficam com o Clerk, que precisa de credenciais próprias do Google e da Microsoft (passo a passo em `docs/agenda-integracao.md`). Lê só a agenda principal, de 30 dias atrás a 90 à frente; atualiza ao abrir o app, pelo botão "Atualizar agora" e uma vez por dia pelo cron `/api/cron/calendar-sync` (usa o mesmo `CRON_SECRET` do lembrete da Testosterona).
- Lembretes: notificações do navegador com permissão e a tela de configurações aberta. Não há serviço de push em segundo plano.
- Telegram: com o segredo `TELEGRAM_BOT_TOKEN`, cada usuário conecta o próprio chat em Configurações > GeoAI no Telegram (link de uso único, válido por 15 minutos). Ao gerar o link, o app registra o webhook `/api/telegram` com um segredo derivado do token; o bot só responde em chats privados vinculados e as sugestões são confirmadas por botões. Gere o link pelo domínio de produção: as URLs de preview da Vercel ficam protegidas por login e o Telegram não consegue chamá-las. Comandos no bot: /ajuda e /desconectar.
- WhatsApp: pela Evolution API (variáveis `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE`). Cada usuário conecta em Configurações › GeoAI no WhatsApp, enviando a mensagem `GEOAI <código>` (válido por 15 minutos) para o número da instância. Em produção, ao gerar o código, o app registra o webhook `/api/whatsapp` na instância, com um segredo derivado da chave; gere o código pelo domínio de produção (`VERCEL_PROJECT_PRODUCTION_URL`; as prévias e as URLs fixas de deploys antigos não registram o webhook). O número pode ser pessoal: o bot ignora grupos, as mensagens que o dono envia para outras pessoas e qualquer conversa não ligada. O dono conversa com o assistente pela conversa "Mensagem para você mesmo", e as respostas do bot começam com 🤖. As sugestões e os lembretes (Testosterona e Saúde feminina) são confirmados respondendo 1 ou 2. Comandos: ajuda e desconectar. Com a Evolution atrás do ngrok, só funciona com o computador, a Evolution e o túnel ligados. Nas configurações da instância da Evolution, ligue `groupsIgnore`, para que as mensagens de grupos nem cheguem ao webhook.

  Privacidade: as mensagens passam pelo WhatsApp pessoal do número do GeoAI e ficam visíveis para quem administra esse número; se o usuário já conversa com esse número, essa conversa passa a ser respondida pelo assistente (o cartão avisa isso antes de conectar). Na conversa consigo mesmo, todo texto e todo áudio enviados vão para o assistente (fotos ficam em silêncio), e as mensagens do bot podem chegar sem notificação: para o dono, o Telegram continua sendo o canal que avisa.
- Áudio no Telegram e no WhatsApp: o assistente transcreve áudios de até 2 minutos (até 50 por pessoa por dia), segue o mesmo fluxo do texto e responde em texto, começando pelo que ouviu (🎙️ “…”), para a pessoa conferir antes de confirmar as sugestões. A confirmação continua pelos botões ou digitando 1 ou 2, e os comandos continuam digitados. Usa o Groq (`whisper-large-v3-turbo`, grátis no plano básico) quando houver `GROQ_API_KEY` e, sem ela ou se o Groq falhar, a OpenAI (`gpt-4o-mini-transcribe`, cerca de US$ 0,003 por minuto) com a mesma `AI_API_KEY` do assistente; com `AI_BASE_URL` preenchido, a OpenAI não é usada para áudio. Sem nenhum dos dois, o bot responde que entende só texto. No WhatsApp, o arquivo é buscado na Evolution só para conversas ligadas.

  Privacidade: o áudio não é guardado; só o texto transcrito entra no histórico da conversa. A transcrição da OpenAI não retém o áudio. No Groq, desligue a retenção em Data Controls no console, porque as conversas podem citar dados de saúde.
- Sem acesso ao backend original, não são recuperados usuários, históricos, assinaturas, mídias privadas ou segredos do Direct Line.
- Músicas: as faixas ficam no Vercel Blob público `geoai-musicas`. São gravações em domínio público ou CC0 do Wikimedia Commons e de Kevin MacLeod (CC BY 4.0), com os créditos na tela. Para trocar ou acrescentar faixas, edite `TRACKS` em `lib/sounds.ts` e rode `node --env-file=<arquivo com MUSIC_BLOB_TOKEN> --experimental-strip-types scripts/upload-music.mjs [id ...]` (os `id` no fim são opcionais e enviam só essas faixas). Para substituir uma faixa, use um novo nome em `file`: a CDN guarda os arquivos por 1 ano, e o mesmo nome continuaria servindo a gravação antiga. O token de leitura e escrita do armazenamento fica fora do repositório. As ondas e os ruídos são gerados no navegador (Web Audio) e pedem fones de ouvido. Não toca com o app fechado; no iPhone, as ondas não tocam no modo silencioso e o volume da música segue o volume do aparelho.

Para trazer dados de uma versão anterior do app, use Configurações > Baixar backup na versão antiga e Restaurar backup na nova.
