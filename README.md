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

Dados são salvos no D1 por identidade autenticada. A API protege operações com sessão, origem e controle de versão para evitar sobrescrever edições concorrentes. O acesso nesta hospedagem usa **Entrar com ChatGPT**; as credenciais do aplicativo original não são reutilizadas.

## Executar localmente

Requer Node.js 22.13+ e npm. A prévia utiliza uma identidade de demonstração somente no endereço local.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_optimal_squadron_sinister.sql
npm run dev
```

Abra http://127.0.0.1:5173. Aplique a migração apenas uma vez por banco local novo. A hospedagem Sites provisiona o banco e aplica as migrações na publicação.

## Verificação

```sh
npm test
npm run typecheck
npm run build
# Com a prévia local ativa; usa Chrome instalado:
npm run test:e2e
```

Defina `CHROME_PATH` se o executável do navegador estiver em outro caminho. Os testes de navegador limpam e preenchem somente a conta de demonstração local. Resultados e critérios estão em `docs/qa-results.json`, `docs/progress.md` e `docs/spec.md`.

## Integrações e limites

- IA generativa: opcional; exige os segredos de servidor `AI_API_KEY` e `AI_MODEL` (e `AI_BASE_URL` para um endpoint compatível com a OpenAI). Com eles, o assistente vira um agente de conversa que consulta agenda, finanças e registros do usuário e sugere tarefas, lançamentos e notas; nada é salvo sem a confirmação do usuário. Sem eles, funciona no modo guiado. Nunca exponha a chave no cliente.
- Calendário: importação/exportação ICS; não inclui sincronização OAuth contínua com Google Calendar.
- Lembretes: notificações do navegador com permissão e a tela de configurações aberta. Não há serviço de push em segundo plano.
- Telegram: com o segredo `TELEGRAM_BOT_TOKEN`, cada usuário conecta o próprio chat em Configurações > GeoAI no Telegram (link de uso único, válido por 15 minutos). Ao gerar o link, o app registra o webhook `/api/telegram` com um segredo derivado do token; o bot só responde em chats privados vinculados e as sugestões são confirmadas por botões. O webhook precisa ser acessível publicamente por HTTPS. Comandos no bot: /ajuda e /desconectar.
- WhatsApp: exibe o estado desconectado; nenhum provedor ou número foi vinculado.
- Sem acesso ao backend original, não são recuperados usuários, históricos, assinaturas, mídias privadas ou segredos do Direct Line.

O site é privado. Para distribuição a clientes e integrações externas, configure provedores e política de acesso em uma etapa posterior. Preserve `.openai/hosting.json`, `sites()` e a migração ao evoluir a aplicação.
