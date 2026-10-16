# Norte — especificação de reconstrução
Autorização: em 16/10/2026 o proprietário pediu executar a recriação com o material recuperado e implementar novamente o que faltasse. A matriz anterior é a referência funcional; decisões reversíveis serão tomadas durante a execução.

## Produto
Aplicação de rotina e organização para homens, nome provisório Norte. Preservar ações, agenda, objetivos, hábitos/tracker, Pomodoro, diário, treinos/medidas, alimentação/hidratação, cuidados, finanças/cartões/parcelas/contas, estudos/leitura, casa/compras, trabalho/clientes, sono, vícios, avatar, notas, revisão e perfil. Módulo ciclo omitido da navegação por público solicitado; nenhuma função médica equivalente inventada.

## Implementação
React/Vinext do starter Sites; Cloudflare D1 persistente; rotas API protegidas pela identidade de hospedagem ChatGPT. Publicação inicial privada. O login desta hospedagem usa ChatGPT em lugar da senha do sistema original, sem reutilizar credenciais. O código mantém os dados por usuário e todos os módulos usam a mesma API.
Cada usuário tem um workspace JSON versionado no D1. Alterações leem uma versão e fazem compare-and-swap; conflitos são refeitos até três vezes. Estado e recompensas são atualizados atomicamente no mesmo documento. Limite de 1 MB e 2.000 itens por coleção.
Nenhuma requisição é feita ao sistema original ou ao Supabase antigo.

## Comportamento
CRUD real com datas, validação, erros visíveis e confirmação antes de excluir; recorrência por dia, semana, dias úteis e mês. Conclusão registrada por ocorrência, pontos concedidos uma vez. Finanças em centavos inteiros, parcelas distribuídas exatamente, contas pagas não duplicam gastos. Sono atravessa meia-noite; sequências consideram lacunas de datas. Diário editável por data. Pomodoro persiste sessão ao concluir e usa relógio real. Avatar masculino SVG configurável e catálogo com compra atômica. Exportar/importar backup do próprio usuário, com prévia e validação.
Assistente guiado entende tarefas, hábitos e gastos e exige confirmação antes de gravar. Endpoint preparado para provedor de IA via segredo do servidor; sem chave, explicar modo guiado. Áudio pode usar reconhecimento de fala quando suportado, com tratamento de permissão.
Calendário oferece arquivo ICS e importação; WhatsApp/push apresentam estado real e dependem de configuração externa. Nunca simular integração ativa.

## Interface
Verde profundo, fundo areia, detalhes cobre, tipografia legível, ícones Lucide, sidebar organizada e navegação inferior móvel com quatro itens. Dashboard com faixa de data, progresso do dia, ações em timeline, foco e resumo semanal. Não apresentar indicadores fictícios. Estados vazios levam a uma ação real; exemplos são carregados somente por opção explícita.
Teclado, labels, foco visível, modais com Escape e retorno de foco, contraste e redução de movimento. Suportar 375–1440 px e tema escuro.

## Verificação
Testes unitários de centavos/parcelas, calendário/recorrência, sequências, validação, importação e recompensas idempotentes. API e banco em preview local: login, gravar, recarregar, editar/excluir, conflitos e isolamento. Verificar navegação de todos os módulos e layout móvel; build antes de publicação. Integrações sem credenciais são reportadas como não conectadas.

