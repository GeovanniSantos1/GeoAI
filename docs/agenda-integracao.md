# Conectar Outlook / Teams e Google Agenda

O GeoAI lê (sem alterar) a agenda principal de cada conta conectada. Quem faz a autorização e guarda os tokens é o Clerk; o GeoAI pede o token ao Clerk na hora de sincronizar. Para isso, o Clerk precisa de um app seu no Google e outro na Microsoft. Faça uma vez, na instância do Clerk usada pelo domínio de produção (hoje, a instância de desenvolvimento, com chaves `pk_test`).

## 1. Google

1. Abra o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto (por exemplo, "GeoAI").
2. Em **APIs e serviços › Biblioteca**, procure **Google Calendar API** e clique em **Ativar**.
3. Em **Google Auth Platform** (antiga "Tela de consentimento OAuth"):
   - **Branding**: nome do app "GeoAI", e-mail de suporte e e-mail do desenvolvedor.
   - **Público-alvo**: tipo **Externo**. Clique em **Publicar app** para ficar **Em produção**. Não peça verificação agora. Em "Teste", o Google derruba o acesso a cada 7 dias e a sincronização para.
   - **Acesso a dados**: **Adicionar ou remover escopos** e marque `.../auth/calendar.events.readonly`.
4. No painel do Clerk, abra **Configure › SSO connections › Google** (ou **Add connection › For all users › Google**), ligue **Use custom credentials** e copie a **Authorized Redirect URI**.
5. De volta ao Google, em **Clientes › Criar cliente**, escolha **Aplicativo da Web**, cole a URI do passo anterior em **URIs de redirecionamento autorizados** e crie. Copie o **ID do cliente** e a **Chave secreta**.
6. No Clerk, cole o ID e a chave e salve. Deixe o campo **Scopes** sem o escopo da agenda: o GeoAI pede essa permissão só quando a pessoa clica em **Conectar**; com o escopo ali, todo login com o Google pediria acesso à agenda. Só acrescente `https://www.googleapis.com/auth/calendar.events.readonly` em **Scopes** se a conexão continuar voltando sem a permissão da agenda.

Na hora de conectar, o Google mostra "O Google não verificou este app". Para seguir: **Avançado › Acessar GeoAI (não seguro)**. Esse aviso some quando o app for verificado pelo Google (necessário antes de abrir para o público; limite de 100 usuários até lá).

## 2. Microsoft (Outlook e Teams)

1. Abra o [portal do Azure](https://portal.azure.com/) › **Microsoft Entra ID › Registros de aplicativo › Novo registro**.
2. Nome "GeoAI"; em **Tipos de conta com suporte**, escolha **Contas em qualquer diretório organizacional e contas pessoais da Microsoft**.
3. No Clerk, abra **Configure › SSO connections › Microsoft**, ligue **Use custom credentials** e copie a **Authorized Redirect URI**. No Azure, em **URI de redirecionamento**, escolha **Web** e cole. Clique em **Registrar**.
4. Na **Visão geral** do app, copie o **ID do aplicativo (cliente)**.
5. Em **Certificados e segredos › Novo segredo do cliente**, crie um segredo (validade de até 24 meses) e copie o **Valor**. Anote a data em que ele expira: depois disso, a conexão para até você criar outro e trocar no Clerk.
6. Em **Permissões de API › Adicionar uma permissão › Microsoft Graph › Permissões delegadas**, marque `Calendars.Read`, `offline_access`, `User.Read`, `openid`, `email` e `profile`.
7. No Clerk, cole o ID e o valor do segredo e salve. Deixe o campo **Scopes** sem os escopos da agenda: o GeoAI pede `Calendars.Read` e `offline_access` só quando a pessoa clica em **Conectar**; com eles ali, todo login com a Microsoft pediria acesso à agenda. Só acrescente `Calendars.Read` e `offline_access` em **Scopes** se a conexão continuar voltando sem a permissão da agenda.

### Conta da empresa

Se ao conectar aparecer "Precisa de aprovação do administrador", a empresa bloqueia apps externos. O administrador do Microsoft 365 pode aprovar o GeoAI para todos em `https://login.microsoftonline.com/<id-do-locatário>/adminconsent?client_id=<id-do-aplicativo>`.

## 3. Login com Google ou Microsoft

Ativar as conexões no Clerk também mostra "Continuar com Google/Microsoft" na tela de entrada. Se não quiser isso, confira no Clerk se a opção de usar a conexão para entrar e cadastrar pode ser desligada; a conexão da agenda funciona dos dois jeitos.

## 4. Conferir

1. Em produção, abra **Configurações › Calendário & lembretes** e clique em **Conectar** no Outlook / Teams e no Google Agenda.
2. Veja os compromissos na **Agenda** e no painel **Seu dia**. Clique numa reunião do Teams e use **Entrar na reunião**.
3. A sincronização roda sozinha ao abrir o app (se passou de 10 minutos), pelo botão **Atualizar agora** e todo dia às 6h pelo cron `/api/cron/calendar-sync`.
