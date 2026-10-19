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
- WhatsApp: exibe o estado desconectado; nenhum provedor ou número foi vinculado.
- Sem acesso ao backend original, não são recuperados usuários, históricos, assinaturas, mídias privadas ou segredos do Direct Line.

Para trazer dados de uma versão anterior do app, use Configurações > Baixar backup na versão antiga e Restaurar backup na nova.
