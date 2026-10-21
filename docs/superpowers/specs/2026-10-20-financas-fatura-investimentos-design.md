# Finanças: importar fatura em PDF e Investimentos (partes 2 e 3 de 3) — especificação

Data: 20/10/2026. Aprovada em conversa com o proprietário, em três seções: fatura; investimentos; assistente, dados e testes. Ele pediu as duas partes juntas e a implementação sem parar para revisão.

Ponto de partida: o GGFinance (`D:\GGFinance\fH8N4SqTlINfHeXu-grok-workspace`):
- `src/lib/fatura-parse.ts`: a fatura;
- `src/lib/invest-core.ts`, `src/lib/invest-types.ts` e `src/routes/investimentos.tsx`: os investimentos.

O trabalho fica sobre a parte 1 (branch `feat/financas`, PR #9), na branch `feat/financas-fatura-invest`.

## Decisões tomadas com o proprietário

- **Leitura da fatura: híbrida.**
  - O PDF é lido no aparelho, com o `unpdf`, e aceita senha.
  - As linhas são reconhecidas pelas regras do GGFinance, adaptadas.
  - "Ler com a IA" manda só o texto para a OpenAI quando nada é reconhecido ou quando a soma lida não bate com o total da fatura.
  - O PDF nunca sai do aparelho.
- **Carteira separada:** a aba Investimentos tem o próprio patrimônio. Saldo, gastos, orçamento, relatórios e CSV não mudam.
- **Assistente com a carteira:**
  - vê patrimônio, resultado, proventos e ativos;
  - registra compras, vendas, proventos e cotações pelo chat, Telegram e WhatsApp, sempre com confirmação.
- **Ficam de fora:**
  - fatura enviada pelo Telegram ou WhatsApp;
  - cotação automática;
  - sincronização com bancos.
- **Abordagem:** tudo no workspace JSON do GeoAI, no mesmo padrão da parte 1. Há duas coleções novas, regras puras em `lib/fatura.ts` e `lib/invest.ts`, e uma rota no servidor, só para a IA.
- **Limites:** os lançamentos sobem de 2.000 para 5.000, e o workspace sobe de 1 MB para 2,5 MB. Com uma fatura por mês, o limite antigo acabaria em uns 2 anos.

## Parte 2 — Importar fatura

### Onde fica

- **Lançamentos:** botão **Importar fatura**, ao lado de "Compra parcelada".
- **Cartões & parcelas:** botão **Importar fatura** em cada cartão, que abre com aquele cartão já escolhido.

### Passo 1: escolher

- **Campos:**
  - **Cartão:** os cartões cadastrados, mais "Sem cartão";
  - **Arquivo PDF;**
  - **Senha do PDF (se tiver).**
- **Lançamentos importados:** todos recebem o `cardId` do cartão escolhido, e o core grava `payment:'credit'`. Com "Sem cartão", a gravação usa `payment:'credit'`, sem `cardId`.
- **Leitura no aparelho:** `components/norte/fatura-pdf.ts`.
  - `pdfText(file,password?)` carrega o `unpdf` com `import()` só nessa hora e extrai o texto de todas as páginas, unidas por `\n`.
  - Arquivo que não é PDF ou com mais de 10 MB: "Escolha um PDF de até 10 MB.".
  - **Erros do `unpdf`:**
    - pede senha e nenhuma foi informada: "Esta fatura está protegida. Informe a senha do PDF.";
    - senha errada: "Senha do PDF incorreta.";
    - qualquer outro: "Não consegui ler este PDF. Tente exportar de novo pelo app do banco.".

### Passo 2: reconhecer (`lib/fatura.ts`, puro)

#### Linhas

Cada linha do texto, com os espaços compactados, é testada contra estes formatos, nesta ordem:

1. `DD/MM descrição valor`, `DD/MM/AA descrição valor` e `DD/MM/AAAA descrição valor`;
2. `DD mmm descrição valor`, com o mês abreviado em português (jan … dez), sem diferenciar maiúsculas.

- **Valor:** `-?\d{1,3}(\.\d{3})*,\d{2}`, opcionalmente precedido de `R$`. Valor negativo, ou terminado em "-", é crédito (estorno).
- **Ano, quando a linha não traz:**
  - a referência é o fechamento; sem ele, o vencimento; sem os dois, `today`;
  - mês da linha maior que o mês da referência: ano da referência menos 1;
  - caso contrário: o ano da referência;
  - com ano de 2 dígitos: 20AA.
- **Datas inválidas** (como 31/02) são descartadas.

#### Dados da fatura

- **Emissor:** PicPay, Nubank, Inter, C6 Bank, Itaú, Bradesco, Santander, Caixa, Banco do Brasil, Mercado Pago ou XP. Se nenhum for reconhecido, "Cartão".
- **Fechamento e vencimento:** os padrões do GGFinance (`vencimento: DD/MM/AAAA`, `fechamento: DD/MM/AAAA` e `DD-MM-AAAA | DD-MM-AAAA`) e também `data de vencimento` e `data do fechamento`.
- **Total da fatura:** o primeiro destes encontrados:
  - "total da fatura";
  - "total geral dos lançamentos";
  - "valor total";
  - "total a pagar";
  - "despesas do mês".
- **Ignoradas (não viram linha):** descrições com pagamento de fatura, pagamento recebido, pagamento efetuado, fatura anterior, saldo anterior, subtotal, "total" seguido de geral, da fatura, dos lançamentos ou a pagar, créditos e estornos (como título de seção) e limite disponível.
- **Encargos, IOF, juros, multa e anuidade:** entram como despesa, categoria "Outros".

#### Parcelas

- **Formatos:** `PARC k/n`, `PARCELA k/n` ou `k/n` no fim da descrição, com 1 ≤ k ≤ n ≤ 48 e espaços opcionais em volta da barra. O trecho é retirado do título.
- **k ≥ 2:** a data passa a ser o fechamento (se não houver, o vencimento; se não houver, fica a da linha), e a nota ganha "Parcela k/n · compra em DD/MM".
- **k = 1:** fica com a data da linha, e a nota ganha "Parcela 1/n".

#### Título

- tira `*`, prefixos de adquirente (`dl`, `ebn`, `mp`, `pag`, `pg`, `ec`) e espaços duplos;
- aplica "Title Case", com palavras de até 2 letras em minúsculas;
- usa o nome da regra de loja quando houver;
- corta em 120 caracteres.

#### Categoria (só despesas)

1. A categoria do lançamento mais recente com o mesmo título, sem diferenciar maiúsculas nem acentos, desde que seja uma categoria de despesa da lista.
2. As regras de loja, a primeira que bater no título dobrado (sem acento e em minúsculas):
   - **Transporte:** uber, 99, cabify, posto, shell, ipiranga, petrobras, br mania, estacionamento, sem parar, conectcar, veloe, bhbus, transfacil, metro.
   - **Alimentação:** ifood, 99food, rappi, restaurante, lanchonete, padaria, pizzaria, hamburgueria, acai, cafe, starbucks, mcdonalds, burger king, kfc, subway, outback.
   - **Mercado:** supermercado, mercado (exceto mercado livre e mercado pago), atacadao, assai, carrefour, pao de acucar, extra, super nosso, hortifruti, sacolao, verdemar.
   - **Saúde:** farmacia, drogaria, droga raia, drogasil, pague menos, araujo, panvel, laboratorio, clinica, hospital, odonto.
   - **Compras:** mercado livre, mercadolivre, amazon, shopee, shein, aliexpress, magalu, magazine luiza, americanas, casas bahia, centauro, renner, riachuelo, c&a, zara, tiktok.
   - **Assinaturas:** netflix, spotify, disney, hbo, max, prime video, amazon prime, youtube, google one, icloud, apple.com, deezer, globoplay, paramount, chatgpt, openai.
   - **Contas:** claro, vivo, tim, oi, cemig, enel, copel, sabesp, copasa, light, energia, internet, net virtua.
   - **Lazer:** cinema, ingresso, sympla, eventim, steam, playstation, xbox, nintendo, bar, festa.
   - **Educação:** udemy, alura, coursera, escola, faculdade, curso, livraria.

   "amazon prime" é testado antes de "amazon". As palavras curtas (99, max, tim, oi, bar, extra, metro, cafe) só valem como palavra inteira.
3. "Outros".

#### Estorno

- O título vira "Estorno · X", e o lançamento é uma receita na categoria "Outras receitas".
- Vem desmarcado, com o motivo "Estorno: marque para lançar como receita".

#### Já lançado

- **Mesmo lançamento:** já existe um lançamento com a mesma data, o mesmo valor, o mesmo tipo e os 48 primeiros caracteres do título dobrado iguais.
  - A contagem é por ocorrência: duas linhas iguais contra um lançamento existente marcam só uma.
  - Motivo: "Já está nos lançamentos".
- **Parcela já registrada:** a linha tem parcela k/n e existe um lançamento de Compra parcelada (`installmentGroup`) com `installmentIndex=k`, `installmentCount=n` e valor a até n centavos de distância.
  - Motivo: "Já está nas compras parceladas".
- Em qualquer um dos casos, a linha vem desmarcada.

#### Notas

O emissor e a parcela, unidos por " · ", em até 240 caracteres.

#### Soma e conferência

- `soma` = despesas menos estornos, todas as linhas, marcadas ou não.
- `diferente` = existe um total da fatura e |soma − total| > máx(1% do total, R$ 1,00).

#### Limites

- Até 250 linhas.
- Se houver mais, a prévia avisa: "Mostrando as 250 primeiras linhas.".

#### Funções

- `parseFaturaText(text,ctx)` devolve `{issuer,closingDate,dueDate,total,rows,sum,mismatch,truncated}`.
- `faturaFromLines(lines,meta,ctx)` faz o mesmo tratamento para as linhas vindas da IA.
- `ctx = {transactions, today}`.
- Cada linha é `{key,date,title,amount,direction,category,notes,installment,reason,selected}`.

### "Ler com a IA"

- **Quando aparece:** quando nenhuma linha é reconhecida ("Não achei lançamentos neste PDF.") ou quando `mismatch`, com o aviso "A soma lida (R$ X) não bate com o total da fatura (R$ Y). Pode faltar alguma linha.".
  - Fica o aviso "Só o texto da fatura vai para a OpenAI para ser lido. Nada fica guardado.".
- **Rota `POST /api/finance/fatura`:**
  - **Corpo:** JSON `{text}`, com até 120.000 caracteres; se passar: "Texto da fatura grande demais.".
  - **Proteções:** login e mesma origem, como as outras rotas, e `maxDuration` de 60.
  - **Leitura:** `lib/fatura-ai.ts` usa `generateText` com `Output.object`, o modelo do assistente e `providerOptions.openai.store=false`, no padrão de `lib/exam-ai.ts`.
  - **Resposta:** `{issuer, closingDate, dueDate, total, lines:[{date:'AAAA-MM-DD', description, amount}]}`. O `amount` vem em centavos inteiros, negativo para crédito, e são até 250 linhas.
  - **Instruções ao modelo:**
    - extrair todas as compras, inclusive parcelas, mantendo "PARC k/n" na descrição;
    - ignorar pagamentos e totais;
    - deduzir o ano pelo fechamento.
  - **Validação:** a saída passa por `normalizeAiFatura`, puro, que descarta datas e valores inválidos.
  - **Erros:** sem a chave da OpenAI: "A leitura com IA não está configurada."; falha do modelo: "Não consegui ler a fatura com a IA. Tente de novo.".
- **No app:** as linhas da IA passam por `faturaFromLines`, com a mesma categoria, parcela, estorno e duplicado.

### Passo 3: prévia

- **Topo:** emissor, vencimento e "N lidos · M selecionados · R$ total selecionado", com o total das despesas marcadas menos os estornos marcados.
- **Botões:** "Marcar todos" e "Desmarcar todos". Marcar todos inclui as linhas "Já lançado".
- **Linha:**
  - caixa de seleção, data DD/MM, título e valor;
  - seletor de categoria: despesas, ou receitas no estorno;
  - selos: "Parcela k/n", "Já lançado" e "Estorno";
  - o motivo, em texto pequeno, quando houver.
- **Rodapé:** "Cancelar" e "Lançar M", desabilitado com zero.
- **Ocultar valores:** troca os valores por "•••••".

### Gravação

- **Comando novo `importTransactions` (`lib/core.ts`):**
  - `items` é um array de 1 a 250 itens; fora disso: "Importação inválida";
  - cada item ganha um `id` novo e passa por `validateItem('transactions')`;
  - **tudo ou nada:** é verificado se cabe no limite de 5.000 ("Limite de registros excedido") antes de gravar.
- **Depois:**
  - toast "M lançamentos importados", com as linhas de `budgetAlerts(estadoAntes, itens)` em linhas seguintes, como na confirmação do assistente;
  - a janela fecha.

## Parte 3 — Investimentos

### Aba

- **Posição da nova aba:** Visão geral · Lançamentos · Orçamento · Relatórios · **Investimentos** · Contas fixas · Cartões & parcelas.
- **Posição exibida:**
  - a do fim do mês escolhido no seletor;
  - no mês atual e em meses futuros, a de hoje.
  - Só entram movimentos com data até esse dia.

### Tipos e modos (`lib/invest.ts`)

| id | rótulo | grupo | modo |
|---|---|---|---|
| cdb | CDB | Renda fixa | valor |
| tesouro | Tesouro Direto | Renda fixa | valor |
| lci_lca | LCI / LCA | Renda fixa | valor |
| acao | Ações | Renda variável | quantidade |
| fii | FIIs | Renda variável | quantidade |
| etf | ETFs | Renda variável | quantidade |
| cripto | Cripto | Renda variável | quantidade |
| fundo | Fundos | Outros | valor |
| outro | Outros | Outros | valor |

- **Cores:** cada tipo tem uma cor própria, que também funciona no tema escuro.
- **Indexadores** (só renda fixa): `none` Sem indexador, `cdi` % do CDI, `selic` % da Selic, `ipca` IPCA +, `pre` Prefixado % a.a.

### Dados

#### Coleção `investments` (ativo)

| Campo | Regra |
|---|---|
| `title` | nome, obrigatório |
| `kind` | da tabela; senão, "Tipo de investimento inválido" |
| `ticker` | opcional, em maiúsculas, sem espaços, até 16 |
| `broker` | opcional, até 40 |
| `notes` | opcional |
| `indexer`, `rate` (% a.a. ou % do índice, de 0 a 1000), `dueDate` (vencimento) | só renda fixa; nos outros tipos são removidos |

#### Coleção `investmentEvents` (movimento)

| Campo | Regra |
|---|---|
| `assetId` | ativo existente |
| `move` | `buy`, `sell`, `dividend`, `yield`, `interest` ou `valuation` |
| `date` | obrigatória, nunca futura ("A data não pode ser futura") |
| `quantity` | até 8 casas |
| `price` | cotação em centavos, pode ter fração (até 4 casas) |
| `amount` | centavos inteiros |
| `notes` | opcional |
| `title` | se não vier, o core preenche com o rótulo do movimento |

**Exigências por movimento:**

| Movimento | Modo quantidade | Modo valor | Erro |
|---|---|---|---|
| Compra e venda | `quantity` > 0 e `amount` > 0 | `amount` > 0 | "Informe a quantidade" ou "Informe o valor" |
| Provento (dividend, yield, interest) | `amount` > 0 | `amount` > 0 | "Informe o valor do provento" |
| `valuation` | `price` > 0 | `amount` > 0 (valor atual) | "Informe a cotação" ou "Informe o valor atual" |

**Venda acima do que existe na data do movimento:**
- modo quantidade: "Você tem só N nessa data.";
- modo valor: um resgate acima do valor registrado vale como resgate total (o ganho vira resultado realizado); sem saldo na data: "Não há saldo para resgatar nessa data.".

#### Ativo novo junto com o movimento

- **Campo `newAsset` do movimento:** um objeto com os campos de ativo, opcionalmente com `id`.
- **No upsert:**
  1. Se já existe ativo com o mesmo `ticker` (quando informado) ou com o mesmo nome (sem diferenciar maiúsculas nem acentos), usa esse ativo.
  2. Senão, cria o ativo com o `id` informado ou com `id do movimento + '-a'`.
  3. Depois, preenche `assetId` e remove `newAsset`.
- **Repetição:** confirmar a mesma sugestão de novo não duplica nada.

#### Exclusão em cascata

Excluir um ativo exclui os movimentos dele.

### Cálculo (puro)

- **Ordem:** os movimentos são aplicados por data e, no mesmo dia, pela ordem em que foram salvos.

**Modo quantidade**

| Movimento | Efeito |
|---|---|
| `buy` | qtd += q; custo += valor; cotação = `price` ou valor/q; data da cotação = data |
| `sell` | médio = custo/qtd; custo −= médio×q; qtd −= q; realizado += valor − médio×q; cotação = `price` ou valor/q |
| provento | proventos += valor |
| `valuation` | cotação = `price`; data da cotação = data |

- Valor atual = qtd × cotação (arredondado).

**Modo valor**

| Movimento | Efeito |
|---|---|
| `buy` | custo += valor; posição += valor |
| `sell` | fração = mín(1, valor/posição); realizado += valor − custo×fração; custo −= custo×fração; posição = máx(0, posição − valor) |
| provento | proventos += valor |
| `valuation` | posição = valor; data da cotação = data |

- Valor atual = posição.

**Totais da posição**
- resultado = valor atual − custo;
- resultado total = resultado + realizado + proventos;
- % = resultado/custo × 100, com uma casa (0 sem custo);
- preço médio = custo/qtd.

**Carteira (`portfolio`)**
- soma de custo, valor, resultado, realizado e proventos;
- % sobre o custo;
- alocação por tipo, na ordem da tabela, só com valor > 0.

**Outras funções**
- `incomeInYear(events, year, until)`;
- `formatRate`: "110% do CDI", "IPCA + 6,5%", "12,5% a.a.";
- `formatPrice`: até 6 casas abaixo de R$ 1, e 2 casas nos demais.

### Tela

- **Cartões:**
  - Patrimônio, com "N ativos" ou "Carteira vazia";
  - Investido;
  - Resultado, verde ou vermelho, com "+3,2% não realizado";
  - Proventos no ano (o ano do mês escolhido).
- **Alocação:** barras por tipo, com "R$ X · N%". Tocar numa barra filtra a lista, e "Ver tudo" limpa o filtro.
- **Ativos:**
  - **Ordem:** por valor atual, decrescente.
  - **Identificação da linha:** um selo com o código (ou as 4 primeiras letras do tipo) na cor do tipo, o nome e a linha "tipo · corretora · taxa · vence DD/MM/AAAA".
  - **Valores:** o valor atual, "custo R$ X" e um selo com o resultado e o %.
  - **Linha extra no modo quantidade:** "10 un. · médio R$ X · cotação R$ Y em DD/MM".
  - **Linha extra no modo valor:** "Atualizado em DD/MM", quando houver atualização.
  - **Posição zerada:** aparece no fim, com "Posição encerrada".
  - **Botões:**
    - Atualizar cotação (modo quantidade) ou Atualizar valor (modo valor);
    - Comprar ou Aplicar;
    - Vender ou Resgatar;
    - Provento;
    - Editar;
    - Excluir, com a confirmação "Excluir X e os movimentos dele?".
- **Movimentos recentes:**
  - os 8 mais recentes até o dia da posição;
  - cada um mostra nome do ativo, rótulo do movimento, data e valor (proventos com +, vendas com −);
  - tocar edita, e há a ação de excluir.
- **Carteira vazia:** "Nenhum ativo ainda", "Cadastre CDB, Tesouro, ações, FIIs, ETFs e o restante da carteira." e o botão "Começar carteira".
- **Rodapé:** "As cotações são as que você informa.".
- **Ocultar valores:** troca todos os valores por "•••••".

### Formulários (Editor)

- **Ativo:**
  - Nome, Tipo, Código, Corretora;
  - Indexador, Taxa (%) e Vencimento, só na renda fixa;
  - Notas.
  - **Ativo novo:** também Data da primeira aplicação, Quantidade (modo quantidade) e Valor aplicado (R$). Ao salvar, vira um único `upsert` do movimento `buy` com `newAsset`.
- **Movimento:**
  - Ativo, Movimento e Data;
  - Quantidade, em compra e venda no modo quantidade;
  - Cotação (R$), em `valuation` no modo quantidade;
  - Valor: "Valor total (R$)" em compra e venda, "Valor (R$)" em provento, "Valor atual (R$)" em `valuation` no modo valor;
  - Notas.
  - Os botões da linha abrem o formulário com o ativo e o movimento já escolhidos.
- **Mudanças genéricas no Editor:**
  - `showIf(values, state)` passa a receber também o estado;
  - campo `number` aceita vírgula decimal;
  - campo novo do tipo `price`, com até 6 casas em reais, convertido por `priceToCents`;
  - o catálogo pode declarar `saveCommand` para montar o comando de salvar.

## Assistente

- **Relatório de finanças (`financeReport`):** quando há ativos, ganha `investimentos`, com a posição do fim do mês pedido:
  - `patrimonio`, `investido`, `resultado`, `resultadoPct` (por exemplo "+3,2%") e `proventosNoAno`;
  - `ativos`: até 30, por valor, cada um com `{id, nome, codigo, tipo, quantidade, valorAtual, resultado, cotacaoEm}`.
- **Busca:** `buscar` aceita `investments` e `investmentEvents`, e a descrição da ferramenta cita os dois.
- **Sugestões (`propor_acoes`):**
  - `PROPOSABLE` ganha `investmentEvents`;
  - o esquema aceita `assetId`, `move`, `quantity`, `price`, `amount` e `newAsset {title, kind, ticker, broker}`;
  - **validação:** `checkProposals` exige `assetId` de ativo existente ou `newAsset` válido, com as mesmas regras do core;
  - **texto da confirmação:** o título é "movimento · código" e a descrição traz quantidade, valor e data, como "Compra · PETR4" com "10 un. · R$ 380,00 · 2026-10-18", "Dividendo · MXRF11" com "R$ 12,40 · …" e "Cotação · BTC" com "R$ 350.000,00 · …".
- **Regra nas instruções:**
  - "Investimentos: consulte financas antes de falar da carteira.";
  - "Explique os números, mas nunca recomende comprar, vender ou escolher ativos; as cotações são as informadas pela pessoa.";
  - "Para registrar um movimento, use propor_acoes com investmentEvents e o assetId; para um ativo novo, envie newAsset.".

## Código

- **`lib/fatura.ts` (novo, puro):** reconhecimento, categoria, parcela, estorno, duplicado e soma.
- **`lib/fatura-ai.ts` (novo):** chamada à IA, mais `normalizeAiFatura`, que é puro.
- **`app/api/finance/fatura/route.ts` (novo).**
- **`lib/invest.ts` (novo, puro):** tipos, rótulos, `positions`, `portfolio`, `incomeInYear`, `formatRate`, `formatPrice`, `priceToCents` e `heldAt`.
- **`lib/core.ts`:**
  - coleções novas, chaves e validações;
  - `newAsset`, cascata e `importTransactions`;
  - limites de 5.000 lançamentos e 2,5 MB.
- **`lib/types.ts`:** `investments` e `investmentEvents` em `COLLECTIONS`, e as duas em `ADDED_COLLECTIONS` no core.
- **`components/norte/fatura-pdf.ts` (novo)** e **`components/norte/finance-fatura.tsx` (novo):** janela de importação.
- **`components/norte/finance-invest.tsx` (novo):** a aba.
- **`components/norte/finance.tsx`:** a aba nova.
- **`components/norte/finance-transactions.tsx` e `components/norte/finance-accounts.tsx`:** botões de importar.
- **`components/norte/catalog.ts` e `components/norte/primitives.tsx`:** formulários e mudanças genéricas do Editor.
- **`lib/agent.ts`, `lib/agent-runtime.ts` e `components/norte/NorteApp.tsx`:** assistente e textos de confirmação.
- **`app/globals.css`:** classes `fin-invest-*` e `fin-fatura-*`, no tema escuro e no celular de 375 px sem rolagem horizontal.
- **`package.json`:** `unpdf` fixado em `1.8.1`; os testes novos entram no `npm test`.

## Testes

- **`tests/fatura.test.mjs`:** textos de exemplo, sem dados reais.
  - **Formatos:**
    - linhas DD/MM, DD/MM/AAAA e DD mmm;
    - virada de ano pelo fechamento;
    - data inválida descartada.
  - **Linhas da fatura:**
    - pagamento e total ignorados;
    - encargos e IOF como "Outros".
  - **Parcelas e estornos:**
    - parcela k ≥ 2 com a data do fechamento e a nota;
    - parcela 1/n;
    - estorno desmarcado e como receita.
  - **Categoria:** pelo histórico, pelas regras ("mercado livre" é Compras; "amazon prime" é Assinaturas; palavra curta só inteira) e "Outros".
  - **Duplicados:**
    - "Já está nos lançamentos", contado por ocorrência;
    - "Já está nas compras parceladas".
  - **Totais:** soma e `mismatch`; limite de 250.
  - **IA:** `faturaFromLines` e `normalizeAiFatura` (data inválida, valor não inteiro, mais de 250).
- **`tests/invest.test.mjs`:**
  - **Modo quantidade:**
    - compra, compra e venda, com preço médio e realizado;
    - cotação.
  - **Modo valor:**
    - aplicação, valor atual e resgate parcial, com custo proporcional;
    - proventos.
  - **Posição e carteira:**
    - posição no fim de um mês passado;
    - ordem no mesmo dia;
    - `portfolio` e alocação.
  - **Funções auxiliares:** `incomeInYear`, `formatRate`, `formatPrice` e `priceToCents`.
- **Core (em `tests/invest.test.mjs` e `tests/finance.test.mjs`):**
  - **Validação:**
    - campos de renda fixa removidos nos outros tipos;
    - movimento sem ativo;
    - data futura;
    - venda acima do que existe;
    - exigências por movimento.
  - **Ativos e cascata:**
    - `newAsset` criando, reaproveitando por código ou nome, e sem duplicar ao repetir;
    - cascata ao excluir.
  - **Importação e limites:**
    - `importTransactions` tudo ou nada, com o limite de 250 e o de 5.000;
    - workspace antigo ganhando as coleções novas.
- **Assistente (`tests/agent.test.mjs`):**
  - `financeReport` com `investimentos`;
  - `checkProposals` com `assetId` e com `newAsset`;
  - `describeProposal` dos movimentos.
- **Verificação:** typecheck, lint dos arquivos alterados, build e `npm test`.
- **Conferência visual** na página isolada, em 375 px e 1440 px, nos temas claro e escuro:
  - a aba Investimentos;
  - a importação com um PDF de exemplo gerado pelo Chrome;
  - "Ocultar valores" e a ausência de rolagem horizontal.

## Fora do escopo

- Fatura pelo Telegram ou WhatsApp.
- Cotação automática, índices (CDI/IPCA) calculados e projeções de renda fixa.
- Sincronização bancária e Open Finance.
- Imposto de renda e come-cotas.
- Investimentos mexendo no saldo, nos gastos ou no CSV.
