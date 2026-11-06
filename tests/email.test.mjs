import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emailConfig,permitido,resendBody,sendEmail,sendOnce} from '../lib/email.ts';
import {welcomeEmail,purchaseEmail,primeiroNome} from '../lib/email-templates.ts';
import {PASSOS,abertura,partes} from '../lib/boas-vindas.ts';
import {LEGAL} from '../lib/legal.ts';

const ZONA='America/Sao_Paulo';

test('abertura da página: "Obrigado por assinar" só vindo do pagamento',()=>{
 assert.match(abertura('ok'),/^Obrigado por assinar!/);
 assert.equal(abertura(undefined),'Em poucos minutos o GeoAI fica pronto para organizar o seu dia.');
 assert.equal(abertura('email'),abertura(undefined));
});

test('partes: **negrito** vira trechos fortes',()=>{
 assert.deepEqual(partes('No **Safari** e no **Chrome**.'),[{t:'No ',forte:false},{t:'Safari',forte:true},{t:' e no ',forte:false},{t:'Chrome',forte:true},{t:'.',forte:false}]);
});

test('primeiro nome: nome de verdade sim, pedaço de e-mail não',()=>{
 assert.equal(primeiroNome('Ana Ribeiro'),'Ana');
 assert.equal(primeiroNome('  Lucas  '),'Lucas');
 assert.equal(primeiroNome('joao.silva'),'');
 assert.equal(primeiroNome('user_123'),'');
 assert.equal(primeiroNome(''),'');
});

test('boas-vindas no teste: data do fim do teste no fuso da pessoa, guia completo e links',()=>{
 const m=welcomeEmail({name:'Ana Ribeiro',trialUntil:'2026-11-09T17:05:00.000Z',zone:ZONA});
 assert.equal(m.subject,'Boas-vindas ao GeoAI: seu guia para começar');
 assert.match(m.html,/Olá, Ana!/);
 assert.match(m.html,/Seu teste grátis vai até 09\/11, 14:05\./);
 assert.match(m.text,/Seu teste grátis vai até 09\/11, 14:05\./);
 for(const p of PASSOS){assert.ok(m.html.includes(p.titulo),p.titulo);assert.ok(m.text.includes(p.titulo),p.titulo+' no texto');}
 assert.ok(m.html.includes('href="'+LEGAL.site+'/obrigado?origem=email"'),'capa leva ao vídeo');
 assert.ok(m.html.includes('src="'+LEGAL.site+'/boas-vindas/capa-email.jpg"'),'capa com endereço completo');
 assert.ok(m.html.includes('href="'+LEGAL.site+'"'),'botão abre o app');
 assert.ok(m.html.includes('https://wa.me/5531984337637?text=Ol%C3%A1!'),'WhatsApp do suporte com a mensagem pronta');
 assert.ok(m.html.includes(LEGAL.cnpj)&&m.text.includes(LEGAL.cnpj),'rodapé com CNPJ');
 assert.match(m.html,/Você recebeu este e-mail porque tem uma conta no GeoAI\./);
 assert.ok(m.text.includes(LEGAL.site+'/obrigado?origem=email'));
 assert.doesNotMatch(m.html,/\*\*/,'sem marcadores de negrito sobrando');
});

test('boas-vindas sem teste (conta grátis ou paga) e sem nome: sem a linha do teste',()=>{
 const m=welcomeEmail({name:'joao.silva',trialUntil:null,zone:ZONA});
 assert.match(m.html,/Olá!/);
 assert.doesNotMatch(m.html,/teste grátis/i);
 assert.doesNotMatch(m.text,/teste grátis/i);
});

test('o nome é escapado no HTML',()=>{
 const m=welcomeEmail({name:'<b>Ana</b> & Cia',trialUntil:null,zone:ZONA});
 assert.ok(!m.html.includes('<b>Ana</b>'));
 assert.match(m.html,/Olá, &lt;b&gt;Ana&lt;\/b&gt;!/);
});

test('assinatura confirmada: plano e data de renovação',()=>{
 const m=purchaseEmail({name:'Lucas Andrade',plan:'monthly',until:'2026-12-06T20:00:00.000Z',zone:ZONA});
 assert.equal(m.subject,'Assinatura confirmada: boas-vindas ao GeoAI');
 assert.match(m.html,/Olá, Lucas!/);
 assert.match(m.html,/Obrigado por assinar o/);
 assert.match(m.html,/Seu plano Mensal está ativo e renova em 06\/12\/2026\./);
 assert.match(m.text,/Seu plano Mensal está ativo e renova em 06\/12\/2026\./);
 assert.doesNotMatch(m.html,/teste grátis/i);
 for(const p of PASSOS)assert.ok(m.html.includes(p.titulo));
 assert.match(purchaseEmail({name:'',plan:'annual',until:null,zone:ZONA}).html,/Seu plano Anual está ativo\./);
});

test('configuração: sem chave não envia; remetente padrão contato@geochat.ia.br e respostas no e-mail do rodapé',()=>{
 assert.equal(emailConfig({}),null);
 assert.equal(emailConfig({RESEND_API_KEY:'  '}),null);
 assert.deepEqual(emailConfig({RESEND_API_KEY:'re_x'}),{apiKey:'re_x',from:'GeoAI <contato@geochat.ia.br>',replyTo:LEGAL.email,somente:null});
 assert.equal(emailConfig({RESEND_API_KEY:'re_x',EMAIL_FROM:'GeoAI <ola@geochat.ia.br>'}).from,'GeoAI <ola@geochat.ia.br>');
});

test('trava EMAIL_SOMENTE: enquanto existir, só esses endereços recebem',()=>{
 const livre=emailConfig({RESEND_API_KEY:'re_x'}),trava=emailConfig({RESEND_API_KEY:'re_x',EMAIL_SOMENTE:' Dono@Exemplo.com , outra@exemplo.com '});
 assert.deepEqual(trava.somente,['dono@exemplo.com','outra@exemplo.com']);
 assert.equal(permitido(livre,'qualquer@exemplo.com'),true);
 assert.equal(permitido(trava,'DONO@exemplo.com'),true);
 assert.equal(permitido(trava,'cliente@exemplo.com'),false);
 assert.equal(emailConfig({RESEND_API_KEY:'re_x',EMAIL_SOMENTE:' , '}).somente,null,'vazia = sem trava');
});

test('envio pelo Resend: endereço, chave, idempotência e corpo',async()=>{
 const cfg={apiKey:'re_teste',from:'GeoAI <contato@geochat.ia.br>',replyTo:LEGAL.email,somente:null},m={subject:'Oi',html:'<p>Oi</p>',text:'Oi'};
 assert.deepEqual(resendBody(cfg,'ana@exemplo.com',m),{from:cfg.from,to:['ana@exemplo.com'],reply_to:LEGAL.email,subject:'Oi',html:'<p>Oi</p>',text:'Oi'});
 let chamada;const ok=async(url,init)=>{chamada={url,init};return new Response(JSON.stringify({id:'email_1'}),{status:200});};
 assert.equal(await sendEmail(cfg,'ana@exemplo.com',m,'boas-vindas/user_1',ok),'email_1');
 assert.equal(chamada.url,'https://api.resend.com/emails');
 assert.equal(chamada.init.method,'POST');
 assert.equal(chamada.init.headers.Authorization,'Bearer re_teste');
 assert.equal(chamada.init.headers['Idempotency-Key'],'boas-vindas/user_1');
 assert.deepEqual(JSON.parse(chamada.init.body),resendBody(cfg,'ana@exemplo.com',m));
 const falha=async()=>new Response(JSON.stringify({message:'The geochat.ia.br domain is not verified.'}),{status:403});
 await assert.rejects(sendEmail(cfg,'ana@exemplo.com',m,'k',falha),/Resend 403: The geochat\.ia\.br domain is not verified\./);
 await assert.rejects(sendEmail(cfg,'sem-arroba',m,'k',ok),/e-mail inválido/);
});

test('uma vez só: envia, não repete e libera a reserva quando o envio falha',async()=>{
 const linhas=new Set(),store={claim:async(u,k)=>{const id=u+'|'+k;if(linhas.has(id))return false;linhas.add(id);return true;},release:async(u,k)=>{linhas.delete(u+'|'+k);}};
 let envios=0;const envia=async()=>{envios++;};
 assert.equal(await sendOnce(store,'user_1','boas-vindas',envia),'sent');
 assert.equal(await sendOnce(store,'user_1','boas-vindas',envia),'skipped');
 assert.equal(envios,1);
 assert.equal(await sendOnce(store,'user_1','compra:subs_1',envia),'sent','outro tipo é outro envio');
 await assert.rejects(sendOnce(store,'user_2','boas-vindas',async()=>{throw new Error('Resend 500');}),/Resend 500/);
 assert.ok(!linhas.has('user_2|boas-vindas'),'reserva liberada');
 assert.equal(await sendOnce(store,'user_2','boas-vindas',envia),'sent','tenta de novo depois');
});
