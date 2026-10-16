# GeoAI — Seu dia com direção

Aplicativo em português para organização pessoal do público masculino, reconstruído a partir dos fluxos e artefatos do Direct Line. O código e o banco são novos e independentes do sistema original.

## O que funciona

- Painel diário, agenda semanal/mensal, tarefas e hábitos recorrentes, objetivos e acompanhamento de conclusão.
- Finanças com receitas, despesas, orçamento, contas mensais, cartões e parcelas com valores exatos em centavos.
- Diário, sono, treinos, medidas, rotinas de alimentação e cuidados, acompanhamento de vícios e recaídas.
- Cursos, estudos e livros com progresso de leitura; casa, compras, trabalho, clientes e metas.
- Notas, revisão semanal, Pomodoro, recompensas e avatar masculino personalizável.
- Perfil e fuso horário, temas claro/escuro, backup JSON validado e calendário ICS para importar/exportar eventos.
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

## Integrações e limites

- IA generativa: opcional; exige os segredos de servidor `AI_API_KEY` e `AI_MODEL` (e `AI_BASE_URL` para um endpoint compatível com a OpenAI). Com eles, o assistente vira um agente de conversa que consulta agenda, finanças e registros do usuário e sugere tarefas, lançamentos e notas; nada é salvo sem a confirmação do usuário. Sem eles, funciona no modo guiado. Nunca exponha a chave no cliente.
- Calendário: importação/exportação ICS; não inclui sincronização OAuth contínua com Google Calendar.
- Lembretes: notificações do navegador com permissão e a tela de configurações aberta. Não há serviço de push em segundo plano.
- Telegram: com o segredo `TELEGRAM_BOT_TOKEN`, cada usuário conecta o próprio chat em Configurações > GeoAI no Telegram (link de uso único, válido por 15 minutos). Ao gerar o link, o app registra o webhook `/api/telegram` com um segredo derivado do token; o bot só responde em chats privados vinculados e as sugestões são confirmadas por botões. Gere o link pelo domínio de produção: as URLs de preview da Vercel ficam protegidas por login e o Telegram não consegue chamá-las. Comandos no bot: /ajuda e /desconectar.
- WhatsApp: exibe o estado desconectado; nenhum provedor ou número foi vinculado.
- Sem acesso ao backend original, não são recuperados usuários, históricos, assinaturas, mídias privadas ou segredos do Direct Line.

Para trazer dados de uma versão anterior do app, use Configurações > Baixar backup na versão antiga e Restaurar backup na nova.
