# Versão feminina do GeoAI

Data: 2026-10-18. Parte 1 de 2. A Parte 2 é o menu Saúde feminina, que substitui o menu Testosterona para mulheres e terá spec própria.

## Objetivo

Quem se identifica como mulher vê o GeoAI no feminino: avatar feminino, textos no feminino, categorias de cuidados próprias e assistente que fala no feminino. O menu Testosterona, voltado a homens, some para ela.

## Decisões

- **Escolha do gênero**: pergunta no primeiro acesso para contas novas ("Como você quer ser tratado(a)?", com cartões Homem e Mulher mostrando o avatar). Depois, troca em Configurações ("Como o GeoAI trata você") e em Sua jornada (seletor Homem | Mulher). Fechar a pergunta sem escolher a adia até o próximo acesso.
- **Contas existentes**: continuam no masculino, sem ver a pergunta.
- **Avatar feminino**: penteados longo liso, cacheado e coque (o chanel foi descartado na escolha visual), brincos de argola opcionais, colar fino e blusa com decote. Tom de pele, cor do cabelo e cor da roupa usam as paletas atuais. O avatar masculino não muda.
- **Textos**: "Sua melhor companheira? Você mesma.", "Blusa", "Com brincos", "Como você quer ser chamada?", "Bem-vinda ao GeoAI.". Sem gênero definido, vale o masculino, padrão do app.
- **Cuidados pessoais**: para mulheres, as abas são Pele, Cabelo, Unhas, Maquiagem, Higiene e Autocuidado. Rotinas antigas de "Cabelo & barba" aparecem em Cabelo, e o inverso vale para homens. Unhas e Maquiagem aparecem em Autocuidado para homens.
- **Menu Testosterona**: oculto para mulheres. Nada é apagado: protocolos, aplicações e exames voltam a aparecer se o perfil for trocado para masculino.
- **Assistente (app e Telegram)**: o contexto informa o gênero ("fale com ela no feminino", "fale com ele no masculino" ou "linguagem neutra"). As regras de testosterona saem do prompt para mulheres.

## Dados

- `Profile.gender`: `'male' | 'female' | ''`. O vazio significa que a pessoa ainda não escolheu. `emptyWorkspace` cria contas novas com `''`.
- `Profile.avatar` ganha `style` (`'longo' | 'cacheado' | 'coque'`, padrão `'longo'`) e `earrings` (padrão `true`). `beard` continua valendo só para o avatar masculino.
- `upgradeWorkspace` completa perfis antigos: `gender` ausente vira `'male'`, e `style`/`earrings` ausentes recebem o padrão. A função copia o perfil em vez de alterá-lo.
- `cleanProfile` aceita só `'male'`/`'female'` (não volta para vazio), os três penteados e `earrings` booleano. Valores inválidos são ignorados, como os demais campos do perfil.

## Código

- `lib/gender.ts`: regras puras (`byGender`, `hiddenSections`, `careCategories`, `careTab`, `categoryOptions`, `genderBrief`, `HAIR_STYLES`).
- `components/norte/Avatar.tsx`: desenha o corpo masculino ou o feminino. Os ids de clipPath são únicos (`useId`), porque a pergunta do primeiro acesso mostra dois avatares ao mesmo tempo. A classe CSS mudou de `male-avatar` para `person-avatar`. O tema escuro pinta o fundo pelo primeiro `rect` e pelo primeiro `circle` do grupo, então os desenhos não aninham grupos.
- `NorteApp.tsx`: menu filtrado por `hiddenSections` e pergunta do primeiro acesso. `settings.tsx`: Jornada e Configurações. `health.tsx` e `catalog.ts`: categorias de cuidados.

## Testes

`tests/gender.test.mjs` cobre: padrão de contas novas, migração de contas antigas sem alterar o original, validação do perfil, troca de gênero sem perder dados, textos e menus, categorias e o contexto do assistente. A interface foi conferida num harness local com o app real e `/api/state` simulado em memória (desktop e 390 px, temas claro e escuro).
