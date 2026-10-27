import type {Metadata} from 'next';import Link from 'next/link';import {LegalPage,Contact} from '@/components/legal';import {LEGAL} from '@/lib/legal';
export const metadata:Metadata={title:'Termos de uso — GeoAI',description:'Regras de uso do GeoAI.'};
export default function TermsPage(){return <LegalPage title="Termos de uso">
<p>Estes termos regem o uso do {LEGAL.product}, aplicativo de organização pessoal oferecido por {LEGAL.company}, inscrito no CNPJ {LEGAL.cnpj}, com sede em {LEGAL.city} (“nós”). Ao criar uma conta ou usar o {LEGAL.product}, você concorda com estes termos e com a <Link href="/privacidade">Política de privacidade</Link>.</p>

<section><h2>1. O serviço</h2>
<p>O {LEGAL.product} ajuda a organizar a rotina: agenda, tarefas e hábitos, finanças pessoais, saúde e bem-estar, estudos, quadro de foco, músicas e um assistente com inteligência artificial (IA). Funciona no navegador e, se você quiser, também pelo Telegram e pelo WhatsApp.</p>
<p>Podemos incluir, mudar ou retirar funções para melhorar o serviço. Mudanças que afetem o que você contratou serão avisadas com antecedência.</p></section>

<section><h2>2. Sua conta</h2>
<p>Para usar o {LEGAL.product} você cria uma conta com e-mail ou com login social. É preciso ter 18 anos ou mais, informar dados verdadeiros e manter seu acesso em segurança. Você responde pelo que for feito na sua conta. Se suspeitar de uso indevido, fale com a gente.</p></section>

<section><h2>3. Uso permitido</h2>
<p>Ao usar o {LEGAL.product}, você se compromete a não:</p>
<ul><li>usar o serviço para fins ilegais ou para prejudicar outras pessoas;</li><li>tentar acessar contas ou dados de outras pessoas, ou burlar a segurança, as cotas e os limites do serviço;</li><li>enviar dados ou exames de terceiros sem autorização deles;</li><li>sobrecarregar o serviço, automatizar acessos em massa ou revender o serviço sem nossa autorização.</li></ul>
<p>Podemos suspender ou encerrar contas que violem estas regras, avisando você sempre que possível.</p></section>

<section><h2>4. Saúde, finanças e IA</h2>
<p>O {LEGAL.product} não é um serviço médico, psicológico, nutricional nem de consultoria financeira ou de investimentos. Ele não substitui um profissional. Isso vale para:</p>
<ul><li>a leitura de exames e o parecer da IA;</li><li>os lembretes de protocolo e de anticoncepcional;</li><li>as previsões do ciclo, que são estimativas e não servem como método contraceptivo;</li><li>as metas de água e os relatórios financeiros.</li></ul>
<p>Decisões sobre saúde, medicamentos e doses, ou sobre investimentos, devem ser tomadas com um profissional habilitado.</p>
<p>As respostas da IA podem conter erros: confira antes de confirmar. O assistente só grava algo depois da sua confirmação.</p></section>

<section><h2>5. Planos pagos e pagamentos</h2>
<p>O {LEGAL.product} pode ter funções gratuitas e planos pagos. Antes de qualquer cobrança, mostramos o preço, a periodicidade e o que está incluído.</p>
<p>Os pagamentos são processados pela AbacatePay. Recebemos dela só o necessário para identificar a compra e o status do pagamento.</p>
<p>Você pode cancelar uma assinatura a qualquer momento pelos contatos abaixo. O cancelamento impede as próximas cobranças, e o acesso pago continua até o fim do período já pago.</p>
<p>Pelo direito de arrependimento (art. 49 do Código de Defesa do Consumidor), você pode desistir de uma contratação feita pela internet em até 7 dias e receber de volta o valor pago. A devolução é feita pelo mesmo meio de pagamento.</p></section>

<section><h2>6. Integrações</h2>
<p>Você pode conectar o Telegram, o WhatsApp, o Google Agenda e o Outlook/Teams. Esses serviços são de terceiros e têm termos próprios. O {LEGAL.product} só lê a sua agenda e não cria nem altera eventos nela. Você pode desconectar qualquer integração em Configurações.</p></section>

<section><h2>7. Seus dados e seu conteúdo</h2>
<p>O que você registra no {LEGAL.product} é seu. Você nos autoriza a guardar e processar esse conteúdo só para prestar o serviço, como explica a <Link href="/privacidade">Política de privacidade</Link>. Em Configurações você pode baixar um backup e apagar seus dados quando quiser.</p></section>

<section><h2>8. Propriedade intelectual</h2>
<p>A marca, o código e o visual do {LEGAL.product} nos pertencem. As músicas do app são de domínio público ou de licença livre, com os créditos na tela.</p></section>

<section><h2>9. Disponibilidade e responsabilidade</h2>
<p>Trabalhamos para manter o {LEGAL.product} no ar e seguro, mas ele pode ficar fora do ar por manutenção, por falhas de fornecedores ou por causas fora do nosso controle.</p>
<p>Lembretes pelo Telegram e pelo WhatsApp dependem desses serviços e podem atrasar ou falhar. Não use só esses lembretes para medicamentos ou compromissos críticos.</p>
<p>Na medida permitida pela lei, não respondemos por danos indiretos nem por decisões tomadas só com base no app. Nada nestes termos limita os direitos garantidos pelo Código de Defesa do Consumidor.</p></section>

<section><h2>10. Encerramento</h2>
<p>Você pode parar de usar o {LEGAL.product} e pedir a exclusão da sua conta a qualquer momento. Como fazer isso está na <Link href="/privacidade">Política de privacidade</Link>.</p></section>

<section><h2>11. Mudanças nestes termos</h2>
<p>Quando mudarmos estes termos, publicaremos a nova versão nesta página, com a data no topo. Mudanças relevantes serão avisadas no app ou por e-mail antes de valerem.</p></section>

<section><h2>12. Lei e foro</h2>
<p>Estes termos seguem as leis do Brasil. Fica eleito o foro de {LEGAL.city}, mas, se você for consumidor, pode propor a ação no foro do seu domicílio.</p></section>

<section><h2>13. Contato</h2><Contact/></section>
</LegalPage>;}
