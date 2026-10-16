# Norte Implementation Plan
> Execução nesta sessão, autorizada pelo usuário. Referência: docs/spec.md e ../investigacao/directline/matriz-reconstrucao.md.

**Goal:** reconstruir o aplicativo para homens com módulos persistentes e fluxos reais.
**Architecture:** React/Vinext + API autenticada + workspace D1 com versão e regras puras de domínio.
**Tech Stack:** starter Sites, React, TypeScript, Drizzle, D1, Lucide, testes nativos Node.
**Spec:** docs/spec.md.

## Restrições
Português brasileiro; valores em centavos; dados separados por identidade; nenhum acesso ao backend original; login ChatGPT; IA e integrações externas somente se configuradas. Publicação privada.

## Foco de revisão
- Fuso e datas sem UTC acidental alterando o dia.
- Duplo clique/retry não gerando recompensa ou despesa duplicada.
- Alteração concorrente não perdendo estado de outra aba.
- Importação inválida não sobrescrevendo dados.
- Falhas HTTP não sendo apresentadas como sucesso.

## Tarefas
- [x] 1. Domínio: escrever testes RED, implementar datas/valores/validação/recorrência/ações/assistente, rodar GREEN.
  Arquivos: lib/types.ts, lib/core.ts, tests/domain.test.mjs.
  Produz: emptyWorkspace, occursOn, allocateInstallments, applyCommand, planFromText, validateWorkspace.
- [x] 2. Persistência: schema workspaces, migração, GET/POST /api/state com autenticação e CAS, endpoint assistente.
  Consome applyCommand e Workspace; produz StateResponse e comando confirmado pelo servidor.
- [x] 3. Interface: shell responsivo, dashboard, formulários e páginas por módulo, confirmação e feedback.
  Consome StateResponse e POST Command; navega pelas rotas recuperadas.
- [x] 4. Fluxos compostos: foco, finanças, estudos, treinos, avatar, backup, revisão e integrações.
- [x] 5. Preview, testes API/banco/browser, tsc, build, revisão independente e reparos.
- [ ] 6. Sincronizar fonte, empacotar e publicar privado. Entregar URL, código e limitações verificadas.

Cada tarefa termina com verificação apropriada. Nenhuma pausa de aprovação entre tarefas já autorizadas.

