# Finanças: gastos, orçamento e relatórios (parte 1 de 3) — especificação

Data: 20/10/2026. Aprovado em conversa com o proprietário, em três seções (o que você vê; dados e regras; assistente, código e testes).

Ponto de partida: o app do proprietário **GGFinance** (`D:\GGFinance`, TanStack/Vite, valores em reais com casas decimais). Ele traz para o menu **Finanças** do GeoAI o que o GGFinance tem de controle de gastos, orçamento e relatórios. O resultado segue o visual e o modelo de dados do GeoAI.

Divisão combinada:
1. **Gastos, orçamento e relatórios** (esta spec).
2. **Importar fatura em PDF** (spec própria, depois).
3. **Investimentos** (spec própria, depois).

## Decisões tomadas com o proprietário

- **Dados:** começar do zero. Nada do banco do GGFinance é importado, e o GGFinance continua como está.
- **Categorias:** a junção das duas listas (abaixo), com ícone e cor. Nos lançamentos e nas contas fixas existentes, "Casa" passa a "Moradia".
- **Entram nesta parte:** forma de pagamento, exportar CSV e o assistente com orçamento. Importar fatura em PDF fica para a parte 2.
- **Ficam de fora:** a sincronização com bancos (Open Finance/Pluggy) e o Admin do GGFinance.
- **Continuam como hoje:** Contas fixas e Cartões & parcelas, que o GGFinance não tem.
- **Visual:** o do GeoAI. Valores em centavos inteiros, como já é no GeoAI.
- **Gráficos:** em CSS, sem biblioteca nova. O `recharts` instalado continua sem uso.

## O que se vê

**Abas de Finanças**, com o seletor de mês de hoje valendo para todas: Visão geral · Lançamentos · Orçamento · Relatórios · Contas fixas · Cartões & parcelas. No celular, as abas rolam para o lado, como já fazem.

### Visão geral

- **Continuam:** o cartão "Saldo no período" (com o olho que esconde valores), "Entradas do mês" e "Saídas do mês".
- **Orçamento do mês:**
  - mostra "R$ gasto de R$ teto", a barra, e "N% do teto usado" ou "acima do teto" (barra vermelha);
  - sem teto: "Defina um teto na aba Orçamento.";
  - o link **Ajustar tetos** abre a aba Orçamento;
  - continuam os botões "+ Despesa" e "+ Receita".
- **Ajuste de saldo:** o botão "Ajustar saldo inicial" abre o modal de hoje, agora só com o saldo inicial. O teto do mês sai do modal e passa para a aba Orçamento.
- **Para onde está indo:**
  - barras por categoria de despesa (ícone, cor, nome, valor e % das saídas do mês), da maior para a menor;
  - quando a categoria tem teto, a linha mostra também "N% do teto (R$ teto)";
  - sem saídas, mantém o texto de hoje.
- **Tendência de saídas (novo):** barras das saídas dos últimos 6 meses até o mês escolhido, com o mês abreviado embaixo e o valor no `title`.
- **Últimos movimentos:**
  - a lista de hoje, com ícone e cor da categoria em cada linha;
  - mostra até 6 lançamentos e mantém o "Ver todos".

### Lançamentos

- **Filtros:**
  - tipo: Todos / Despesas / Receitas;
  - Categoria: todas as categorias, mais as antigas fora da lista que aparecem no mês;
  - Forma de pagamento: inclui "Cartão de crédito" e "Não informada";
  - busca por texto em título, notas e categoria, sem diferenciar maiúsculas nem acentos.
- **Cabeçalho:** "N no filtro · saídas R$ X", somando só as despesas filtradas. Botões **Novo lançamento** e **Compra parcelada** (como hoje).
- **Linha:**
  - ícone e cor da categoria, título, categoria, forma de pagamento ou nome do cartão, data DD/MM e valor com sinal;
  - tocar no título abre o editor, como hoje;
  - sem resultados: "Nenhum lançamento com esses filtros.".
- **Formulário de lançamento:**
  - campo **Forma de pagamento** com as opções Não informada, PIX, Débito, Crédito, Dinheiro e Transferência;
  - a **Categoria** mostra a lista de despesas ou a de receitas, conforme o tipo;
  - com um cartão escolhido, a forma de pagamento é salva como Crédito.

### Orçamento (nova)

- **Teto do mês:**
  - campo em R$ salvo ao sair do campo. Vazio ou zero volta para "sem teto".
  - selo:
    - "Sem teto";
    - "Dentro do teto";
    - "Perto do teto" (85% ou mais);
    - "Acima do teto".
  - "Gasto até agora: R$ X · N% do teto" (sem teto: só "Gasto até agora: R$ X").
  - barra, limitada a 100%, em vermelho no estouro.
- **Categorias:**
  - cabeçalho "Categorias" com "Soma R$ (soma dos tetos por categoria)";
  - uma linha por categoria de despesa da lista, na ordem dela, com:
    - ícone e nome;
    - "R$ gasto de R$ teto" ou "R$ gasto · sem teto";
    - barra na cor da categoria (vermelha no estouro);
    - selo "Estouro" acima de 100% e "Perto" a partir de 85%;
    - campo **TETO**, salvo ao sair do campo (vazio ou zero = sem teto).
  - quando a soma dos tetos por categoria passa do teto do mês, aparece o aviso: "A soma dos tetos por categoria passa do teto do mês em R$ X."
- **Validade dos tetos:** valem para todos os meses. Mudar um teto muda a leitura de qualquer mês.
- **Erro ao salvar:** um valor inválido mostra o erro do app (toast) e o campo volta ao valor salvo.

### Relatórios (nova)

- **Cartões:**
  - **Média diária:** saídas ÷ dias corridos (detalhe na regra). Mês futuro: "—".
  - **vs mês anterior:** "+12%" ou "−8%", ou "Novo" ou "Estável", com o rodapé "R$ X no mês anterior".
  - **Maior categoria:** nome e valor; sem saídas, "—".
- **Alertas:** de 1 a 6 linhas, na ordem da regra; sem alertas, "Nenhum alerta neste mês.".
- **Entradas e saídas:** barras lado a lado (entradas em verde, saídas em terracota) dos últimos 6 meses, com legenda.
- **Composição do mês:** as mesmas barras por categoria da Visão geral.
- **Maiores saídas:** as 5 maiores despesas do mês (título, categoria, data e valor).
- **Exportar CSV:** baixa `geoai-lancamentos.csv` com todos os lançamentos. Sem lançamentos, o botão fica desabilitado.

## Dados

### Categorias (`lib/finance.ts`)

O lançamento guarda o **nome** da categoria em `category`, como hoje. Cada categoria tem `{name, kind:'expense'|'income', icon, color}`. O `icon` é uma chave de texto; a tela troca pelo ícone do lucide.

| Nome | Tipo | Ícone (lucide) | Cor |
|---|---|---|---|
| Moradia | despesa | Home | #315e4d |
| Alimentação | despesa | UtensilsCrossed | #d5aa72 |
| Mercado | despesa | ShoppingCart | #a77b61 |
| Transporte | despesa | Car | #647982 |
| Saúde | despesa | HeartPulse | #b5655b |
| Educação | despesa | GraduationCap | #6f8fa6 |
| Lazer | despesa | Clapperboard | #8d7aa3 |
| Contas | despesa | Zap | #c49a3c |
| Compras | despesa | ShoppingBag | #85a18a |
| Assinaturas | despesa | Repeat | #5f8a8b |
| Outros | despesa | Ellipsis | #9aa39b |
| Salário | receita | Banknote | #285442 |
| Renda extra | receita | Briefcase | #7a9671 |
| Outras receitas | receita | PiggyBank | #a7b38f |

- **Categoria fora da lista** (texto livre antigo, ou vazio): aparece com o próprio nome (vazio vira "Outros"), mas com o ícone e a cor de "Outros". Nas somas por categoria, ela conta separada, pelo nome.
- **Atualização do workspace** (`upgradeWorkspace`, idempotente): `category === 'Casa'` vira `'Moradia'` em `transactions` e `bills`.
- **Formulário de contas fixas:** passa a oferecer a lista de despesas.

### Forma de pagamento

- Campo novo `payment` no lançamento, opcional, com os valores `pix`, `debit`, `credit`, `cash` e `transfer`. Os rótulos são PIX, Débito, Crédito, Dinheiro e Transferência. Qualquer outro valor dá "Forma de pagamento inválida".
- Lançamento com `cardId`: o `payment` é salvo como `credit`, qualquer que fosse o informado.

### Tetos

- **Teto do mês:** `profile.budget` (centavos), que já existe.
- **Teto por categoria:** campo novo `profile.categoryBudgets: Record<nome, centavos>`, com padrão `{}`.
  - Só entram categorias de despesa da lista. Cada valor precisa ser um inteiro seguro de 0 a 1e12; um valor inválido dá "Configuração inválida".
  - O comando `profile` **mescla** `categoryBudgets` com o que já existe; valor 0 remove a categoria do mapa.
  - Workspaces antigos ganham `{}`.
- **Situação de um teto** com gasto `g` e teto `t`:
  - `t = 0`: `none`;
  - `g > t`: `over`;
  - `g ≥ 0,85 × t`: `near`;
  - senão: `ok`.
  - O percentual é `round(g / t × 100)`, sem limite (a barra é que se limita a 100%).

## Regras puras (`lib/finance.ts`)

Todas recebem o workspace (ou as listas) e o mês `AAAA-MM`. Um lançamento é do mês quando `date.startsWith(mês)`.

- **`categoryInfo(nome)`:** devolve `{name, kind, icon, color, known}`. Fora da lista, devolve `known:false` com o ícone e a cor de Outros.
- **`expenseByCategory(s, mês)`:**
  - devolve `[{name, total, count, share, cap?, capPct?, state}]` das despesas do mês, ordenado por total decrescente;
  - `share = total / saídas do mês`;
  - `cap`, `capPct` e `state` vêm do teto da categoria.
- **`budgetView(s, mês)`:** devolve:
  - `{month:{cap, spent, pct, state}, categories:[…], capsSum, capsOverMonth}`;
  - `categories` traz uma linha por categoria de despesa da lista, na ordem dela (inclusive as sem gasto);
  - `capsOverMonth = capsSum − cap`, quando o teto do mês é maior que 0 e a soma passa dele; senão 0.
- **`trend(s, mês, n=6)`:**
  - devolve `[{month, income, expense}]` dos `n` meses terminando em `mês`, em ordem cronológica;
  - atravessa a virada do ano.
- **`reportCards(s, mês, hoje)`:**
  - **`dailyAvg`:**
    - mês de `hoje`: saídas ÷ dia de hoje;
    - mês passado: saídas ÷ dias do mês;
    - mês futuro: `null`.
    - O resultado é arredondado para centavos.
  - **`vsPrev`:**
    - `{kind:'new'}` quando o mês anterior teve 0 e este não;
    - `{kind:'stable'}` quando os dois têm 0, ou quando o percentual arredondado dá 0;
    - senão `{kind:'delta', pct}`, com `pct = round((saídas − anteriores) / anteriores × 100)`.
    - Sempre traz `prev`, o total do mês anterior.
  - **`top`:** a maior categoria `{name, total}` ou `null`.
- **`insights(s, mês, hoje)`:** devolve uma lista de textos, nesta ordem.
  1. **Saídas comparadas ao mês anterior**, só com o anterior > 0:
     - `pct ≥ 8`: "Suas saídas subiram N% em relação a {mês anterior por extenso}.";
     - `pct ≤ −8`: "Suas saídas caíram N% em relação a {mês anterior por extenso}.".
  2. **Teto do mês:**
     - `over`: "Você passou do teto do mês em R$ X.";
     - `near`: "Você já usou N% do teto do mês.".
  3. **Categorias com teto em `over`**, até 3, da maior para a menor ultrapassagem: "{Categoria} passou do teto em R$ X.".
  4. **Crescimento:** a primeira das 4 maiores categorias do mês que cresceu mais de 20% sobre o mês anterior (com o anterior > 0): "{Categoria} cresceu N% em relação ao mês anterior.".

  Sem nenhum alerta, devolve `[]` e a tela mostra o texto padrão.
- **`topExpenses(s, mês, n=5)`:** as `n` maiores despesas do mês. Desempate pela data mais recente.
- **`filterTransactions(lista, {type, category, payment, text})`:**
  - `type`: `all`, `expense` ou `income`;
  - `category`: `''` para todas;
  - `payment`: `''` para todas, `'card'` para os lançamentos com `cardId` e `'none'` para os sem forma nem cartão;
  - `text`: busca sem acento e sem diferenciar maiúsculas em `title`, `notes` e `category`;
  - devolve a lista em ordem de data decrescente.
- **`transactionsCsv(s)`:**
  - uma string com BOM (`\uFEFF`) e cabeçalho `Data,Tipo,Categoria,Descrição,Valor,Pagamento,Notas`, uma linha por lançamento em ordem de data crescente;
  - **Data:** `dd/mm/aaaa`.
  - **Tipo:** `Despesa` ou `Receita`.
  - **Valor:** com vírgula decimal e sem separador de milhar, negativo nas despesas (`-35,90`).
  - **Pagamento:** o rótulo da forma de pagamento. Com cartão, "Crédito (nome do cartão)".
  - **Escape:** campos com vírgula, aspas ou quebra de linha vão entre aspas, com as aspas internas dobradas.
  - **Quebras de linha:** `\r\n`.
- **`budgetAlerts(s, itens)`:** o aviso dado ao confirmar sugestões.
  - Recebe os itens de `confirmPlan` (`{collection, item}`) e considera os da coleção `transactions` com `direction==='expense'`, `amount` e `date`.
  - Os itens chegam validados por `checkProposals`, que sempre preenche a data (padrão: hoje). Por isso a função não precisa de `hoje`, e item sem data não entra.
  - Para cada mês envolvido (o da data do item), soma ao gasto já registrado.
  - Devolve os textos das categorias com teto que passam para `near` ou `over`, e do teto do mês se ele passar para `near` ou `over`:
    - "⚠️ Alimentação: R$ 650,00 de R$ 600,00, passou do teto.";
    - "⚠️ Alimentação já usou 90% do teto.";
    - "⚠️ Teto do mês: R$ X de R$ Y, passou do teto." ou "⚠️ Você já usou N% do teto do mês.".
  - Só avisa quando a situação muda com os itens (não repete um estouro que já existia antes), em no máximo 3 linhas.

O **saldo do período** continua com a regra de hoje (`financeSummary`): saldo inicial + todos os lançamentos até o fim do mês.

## Assistente

- **Ferramenta `financas`** (`financeReport`): passa a incluir:
  - `tetoDoMes: {teto, gasto, situacao}`, com a situação em pt-BR: sem teto, dentro, perto ou estourado;
  - `tetosPorCategoria: [{categoria, teto, gasto, restante, situacao}]`, só das categorias com teto.
- **Proposta (`propor_acoes`):**
  - a descrição de `category` lista as categorias de despesa e de receita;
  - entra o campo opcional `payment` (`pix|debit|credit|cash|transfer`);
  - nas instruções: "Para lançamentos, use uma categoria da lista e, se a pessoa disser, a forma de pagamento.".
- **Aviso de teto ao confirmar:**
  - **Telegram e WhatsApp:** `resolveChoice` acrescenta à resposta de confirmação (`✅ … adicionados ao seu GeoAI.`) as linhas de `budgetAlerts`, calculadas com o estado de antes de salvar, separadas por quebra de linha.
  - **App:** depois de confirmar, o toast de sucesso inclui as mesmas linhas.

## Código

- **`lib/finance.ts` (novo, puro, sem `@/…`):** categorias, formas de pagamento e todas as regras acima.
  - O `formatMoney` sai de `lib/core.ts` e passa para cá, e o core o reexporta (`export {formatMoney} from './finance.ts'`). Os imports atuais continuam valendo.
  - Este arquivo não importa o core, porque o core usa ele para validar.
- **`lib/core.ts`:**
  - `payment` (valores, e cartão força `credit`);
  - `categoryBudgets` em `cleanProfile`, `emptyWorkspace` e na atualização;
  - "Casa" → "Moradia" em `upgradeWorkspace`.
- **`components/norte/finance.tsx`:** vira a moldura (título, seletor de mês e abas). Cada aba ganha um arquivo:
  - `finance-overview.tsx`;
  - `finance-transactions.tsx`;
  - `finance-budget.tsx`;
  - `finance-reports.tsx`;
  - `finance-ui.tsx`, com as peças comuns: `CategoryIcon`, `CategoryBars`, `BarChart` em CSS e a linha de lançamento.
  - As abas Contas fixas e Cartões & parcelas são movidas sem mudança de comportamento.
- **`components/norte/catalog.ts`:**
  - em `transactions`, dois campos de categoria com `showIf` por tipo (despesa/receita) e o `payment`;
  - em `bills`, a lista de despesas.
- **`lib/agent.ts`, `lib/agent-runtime.ts`, `lib/chat-actions.ts` e `components/norte/NorteApp.tsx`:** o assistente e o aviso de teto.
- **`app/globals.css`:** classes das abas novas, com tema escuro e celular de 375 px sem rolagem horizontal.

## Testes

- **`tests/finance.test.mjs` (novo):**
  - `categoryInfo` (conhecida, antiga e vazia);
  - "Casa" → "Moradia";
  - `expenseByCategory` com teto e sem teto;
  - situações do teto (none, ok, near em 85% e over);
  - `budgetView` com a soma dos tetos passando do teto do mês;
  - `trend` atravessando o ano;
  - `reportCards` em mês atual, passado e futuro, e `vsPrev` (novo, estável, + e −);
  - ordem e limites dos `insights`;
  - `topExpenses` com desempate;
  - `filterTransactions` (tipo, categoria, cartão, sem forma, texto com acento);
  - `transactionsCsv` (BOM, cabeçalho, data, sinal, cartão, aspas e quebra de linha);
  - `budgetAlerts` (só avisa quando muda, mês do item e limite de 3).
- **Validação:** `payment` inválido, cartão forçando crédito, `categoryBudgets` (inválido, mescla, zero remove) e workspace antigo.
- **Assistente:** `financeReport` com tetos, e `resolveChoice` acrescentando o aviso.
- **Verificação:** typecheck, lint dos arquivos alterados, build e `npm test`.
- **Conferência visual** das quatro abas na página isolada (sem Clerk), em 375 px e 1440 px, nos temas claro e escuro.

## Fora do escopo

- Importar fatura em PDF (parte 2) e Investimentos (parte 3).
- Sincronização bancária, contas e carteiras, recorrências novas e metas.
- Categorias criadas pelo usuário.
- Tetos diferentes por mês.
