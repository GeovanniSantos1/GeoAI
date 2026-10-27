import type {Metadata} from 'next';import Link from 'next/link';import {LegalPage,Contact} from '@/components/legal';import {LEGAL} from '@/lib/legal';
export const metadata:Metadata={title:'Política de privacidade — GeoAI',description:'Como o GeoAI trata seus dados pessoais.'};
export default function PrivacyPage(){return <LegalPage title="Política de privacidade">
<p>Esta política explica quais dados pessoais o {LEGAL.product} trata, para quê, com quem compartilha e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, “LGPD”). Ela complementa os <Link href="/termos">Termos de uso</Link>.</p>

<section><h2>1. Quem cuida dos seus dados</h2>
<p>O controlador dos dados é {LEGAL.company}, CNPJ {LEGAL.cnpj}, com sede em {LEGAL.city}.</p>
<p>Somos um agente de tratamento de pequeno porte e, por isso, não temos encarregado (DPO) nomeado. Os contatos do item 12 são o nosso canal de comunicação com você e com a Autoridade Nacional de Proteção de Dados (ANPD).</p></section>

<section><h2>2. Dados que tratamos</h2>
<ul>
<li><strong>Conta:</strong> nome, e-mail, foto (quando você entra com login social) e um identificador interno. A senha fica com o provedor de login, e nós não temos acesso a ela.</li>
<li><strong>O que você registra:</strong> tarefas, agenda, hábitos, metas, notas, diário, sono, treinos, medidas e peso, alimentação, água, estudos, cards do quadro Foco e suas preferências, como fuso horário, tema e forma de tratamento.</li>
<li><strong>Finanças:</strong> receitas, despesas, contas, cartões, parcelas e investimentos. A fatura em PDF é lida no seu aparelho. Só o texto extraído vai para a IA, e o arquivo não é enviado nem guardado.</li>
<li><strong>Dados de saúde, que são dados sensíveis:</strong> exames de laboratório (o arquivo e os valores), protocolo e aplicações de testosterona, ciclo menstrual, anticoncepcional, registros íntimos, preventivos e acompanhamento de vícios e recaídas.</li>
<li><strong>Agenda conectada:</strong> eventos da agenda principal do Google ou do Outlook, de 30 dias atrás a 90 dias à frente, só para leitura.</li>
<li><strong>Telegram e WhatsApp:</strong> se você conectar, guardamos o identificador da conversa, o nome do perfil, as últimas mensagens trocadas com o assistente (para dar contexto às respostas) e as respostas aos lembretes. Áudios são transcritos e descartados: só o texto fica.</li>
<li><strong>Pagamentos:</strong> se você contratar um plano pago, os dados que a AbacatePay pede para a cobrança (como nome, e-mail, CPF ou CNPJ e telefone) e o status do pagamento. Não recebemos dados completos de cartão.</li>
<li><strong>Dados técnicos:</strong> endereço IP, navegador, data e hora de acesso e registros de erro, mantidos pela hospedagem e pelo provedor de login.</li>
</ul></section>

<section><h2>3. Para que usamos e com qual base legal</h2>
<ul>
<li><strong>Prestar o serviço:</strong> guardar e mostrar seus registros, sincronizar entre aparelhos, enviar lembretes e responder pelo assistente. A base é a execução do contrato com você (art. 7º, V, da LGPD).</li>
<li><strong>Dados de saúde:</strong> a base é o seu consentimento (art. 11, I), que você dá ao cadastrar esses dados nos menus de saúde. Para retirá-lo, apague os registros ou peça a exclusão.</li>
<li><strong>Segurança e prevenção de abusos:</strong> proteger contas, aplicar cotas de uso e investigar falhas. A base é o legítimo interesse (art. 7º, IX).</li>
<li><strong>Cobrança e obrigações fiscais:</strong> a base é a execução do contrato e o cumprimento de obrigação legal (art. 7º, II e V).</li>
<li><strong>Atendimento:</strong> responder ao que você nos enviar pelos contatos.</li>
</ul>
<p>Não vendemos seus dados, não os usamos para publicidade e não os usamos para treinar modelos de IA.</p></section>

<section><h2>4. Com quem compartilhamos</h2>
<p>Usamos fornecedores que tratam dados em nosso nome, só para prestar o serviço:</p>
<ul>
<li><strong>Clerk:</strong> login e conta.</li>
<li><strong>Vercel:</strong> hospedagem do app, arquivos de exames (em armazenamento privado, separado por usuário) e registros técnicos.</li>
<li><strong>Neon:</strong> banco de dados.</li>
<li><strong>OpenAI:</strong> assistente, leitura de exames e de faturas e transcrição de áudio, quando necessário. Pedimos que o conteúdo não fique guardado do lado deles sempre que a opção existe.</li>
<li><strong>Groq:</strong> transcrição de áudio.</li>
<li><strong>Telegram e WhatsApp:</strong> só se você conectar. O {LEGAL.product} no WhatsApp funciona num número administrado por nós, e as mensagens dessa conversa ficam visíveis para quem administra esse número.</li>
<li><strong>Google e Microsoft:</strong> só se você conectar sua agenda.</li>
<li><strong>AbacatePay:</strong> processamento de pagamentos.</li>
</ul>
<p>Também podemos compartilhar dados com autoridades, quando a lei ou uma ordem judicial exigir.</p></section>

<section><h2>5. Transferência internacional</h2>
<p>Clerk, Vercel, Neon, OpenAI e Groq guardam ou processam dados em servidores nos Estados Unidos. A transferência é necessária para executar o contrato com você (art. 33, IX, da LGPD) e é feita com fornecedores que adotam cláusulas contratuais de proteção de dados.</p></section>

<section><h2>6. Por quanto tempo guardamos</h2>
<ul>
<li>Seus registros ficam guardados enquanto sua conta existir.</li>
<li>Em Configurações, “Apagar meus dados” apaga na hora seus registros, os arquivos dos exames, as agendas conectadas e o quadro do Foco.</li>
<li>Desconectar o Telegram ou o WhatsApp apaga o vínculo e o histórico daquela conversa.</li>
<li>Para excluir a conta, peça pelos contatos do item 12. Apagamos a conta e os dados em até 15 dias.</li>
</ul>
<p>Guardamos depois disso só o que a lei obriga, como os registros de pagamento para fins fiscais. Cópias em backups automáticos dos fornecedores podem permanecer por um curto período até serem substituídas.</p></section>

<section><h2>7. Seus direitos</h2>
<p>Pelo art. 18 da LGPD, você pode:</p>
<ul>
<li>confirmar se tratamos seus dados e acessá-los;</li>
<li>corrigir dados incompletos ou errados;</li>
<li>pedir anonimização, bloqueio ou eliminação de dados desnecessários;</li>
<li>pedir a portabilidade dos dados;</li>
<li>eliminar os dados tratados com base no seu consentimento;</li>
<li>saber com quem os compartilhamos;</li>
<li>retirar o consentimento;</li>
<li>reclamar à ANPD.</li>
</ul>
<p>Boa parte disso você faz direto no app: editar registros, baixar o backup em Configurações e apagar seus dados. Para o resto, fale com a gente pelos contatos do item 12. Respondemos em até 15 dias.</p></section>

<section><h2>8. Cookies e armazenamento no navegador</h2>
<p>Usamos só os cookies necessários para manter você conectado, definidos pelo provedor de login. O navegador também guarda algumas preferências do app, como o tema claro ou escuro. Não usamos cookies de publicidade nem de rastreamento.</p></section>

<section><h2>9. Segurança</h2>
<p>Usamos conexão criptografada (HTTPS), acesso restrito à sua conta e chaves de serviço guardadas só no servidor. Os arquivos de exames ficam em armazenamento privado, separado por usuário.</p>
<p>Nenhum sistema é totalmente seguro. Se houver um incidente que possa trazer risco ou dano relevante a você, avisaremos você e a ANPD.</p></section>

<section><h2>10. Menores de idade</h2>
<p>O {LEGAL.product} é destinado a maiores de 18 anos e não coleta dados de crianças ou adolescentes de propósito.</p></section>

<section><h2>11. Mudanças nesta política</h2>
<p>Quando mudarmos esta política, publicaremos a nova versão nesta página, com a data no topo. Mudanças relevantes serão avisadas no app ou por e-mail.</p></section>

<section><h2>12. Contato</h2><Contact/></section>
</LegalPage>;}
