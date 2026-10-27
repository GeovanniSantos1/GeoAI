import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accessOf,hasAccess,newAccount,addPeriod,extendPaid,planOfEvent,eventPatch,processEvent,annualSaving,isFreeEmail,TRIAL_DAYS,GRACE_DAYS,EXPIRED_TEXT} from '../lib/billing.ts';
import {verifyWebhook,signBody,readEvent,abacateConfig,webhookConfig,subscriptionBody,abacateApi} from '../lib/abacatepay.ts';

const DAY=86400000;
const NOW=new Date('2026-11-10T12:00:00.000Z');
const at=days=>new Date(NOW.getTime()+days*DAY).toISOString();
const PRODUCTS={monthly:'prod_mensal',annual:'prod_anual'};
const account=(over={})=>({...newAccount('user_1',new Date(NOW.getTime()-10*DAY)),...over});

test('conta nova ganha 3 dias de teste a partir de agora',()=>{
 const a=newAccount('user_1',NOW);
 assert.equal(TRIAL_DAYS,3);
 assert.deepEqual(a,{userId:'user_1',free:false,trialEndsAt:at(3),paidUntil:null,plan:null,subscriptionId:null,customerId:null,cancelledAt:null,refundedAt:null});
 const v=accessOf(a,NOW);
 assert.equal(v.status,'trial');assert.equal(v.until,at(3));assert.equal(v.canSubscribe,true);assert.equal(v.canCancel,false);assert.ok(hasAccess(v));
});

test('acesso: grátis vence tudo, depois pago com folga, depois teste, senão vencido',()=>{
 assert.equal(accessOf(account({free:true}),NOW).status,'free');
 assert.equal(accessOf(account({free:true}),NOW).canSubscribe,false);
 assert.equal(accessOf(account(),NOW).status,'expired');
 assert.equal(hasAccess(accessOf(account(),NOW)),false);
 assert.equal(accessOf(account({trialEndsAt:at(1)}),NOW).status,'trial');
 // Pago até ontem: ainda dentro da folga de 3 dias para as novas tentativas de cobrança.
 assert.equal(GRACE_DAYS,3);
 const late=accessOf(account({paidUntil:at(-1),plan:'monthly',subscriptionId:'subs_1'}),NOW);
 assert.equal(late.status,'active');assert.equal(late.until,at(-1));assert.equal(late.late,true);assert.equal(late.canCancel,true);assert.equal(late.canSubscribe,false);
 assert.equal(accessOf(account({paidUntil:at(5),subscriptionId:'subs_1'}),NOW).late,false);
 assert.equal(accessOf(account({paidUntil:at(-3.01),plan:'monthly'}),NOW).status,'expired');
 // Teste ainda valendo e pagamento antigo vencido: volta para o teste.
 assert.equal(accessOf(account({paidUntil:at(-30),trialEndsAt:at(1)}),NOW).status,'trial');
});

test('cancelada mantém o acesso até a data paga e pode assinar de novo; reembolsada perde a folga',()=>{
 const c=accessOf(account({paidUntil:at(10),plan:'annual',subscriptionId:'subs_1',cancelledAt:at(-1)}),NOW);
 assert.equal(c.status,'active');assert.equal(c.cancelled,true);assert.equal(c.canCancel,false);assert.equal(c.canSubscribe,true);assert.equal(c.plan,'annual');
 assert.equal(accessOf(account({paidUntil:at(-0.5),refundedAt:at(-0.5)}),NOW).status,'expired');
 const expired=accessOf(account({paidUntil:at(-10),plan:'monthly'}),NOW);
 assert.equal(expired.paidBefore,true);assert.equal(accessOf(account(),NOW).paidBefore,false);
});

test('addPeriod soma 1 mês ou 1 ano e respeita o fim do mês',()=>{
 assert.equal(addPeriod(new Date('2026-01-31T10:00:00.000Z'),'monthly').toISOString(),'2026-02-28T10:00:00.000Z');
 assert.equal(addPeriod(new Date('2028-01-31T10:00:00.000Z'),'monthly').toISOString(),'2028-02-29T10:00:00.000Z');
 assert.equal(addPeriod(new Date('2026-12-15T10:00:00.000Z'),'monthly').toISOString(),'2027-01-15T10:00:00.000Z');
 assert.equal(addPeriod(new Date('2028-02-29T10:00:00.000Z'),'annual').toISOString(),'2029-02-28T10:00:00.000Z');
});

test('extendPaid soma o período a partir do fim do período atual, ou de agora se ele já passou',()=>{
 assert.equal(extendPaid(null,NOW,'monthly'),'2026-12-10T12:00:00.000Z');
 // Assinar de novo com dias pagos sobrando não perde esses dias.
 assert.equal(extendPaid('2027-06-01T00:00:00.000Z',NOW,'monthly'),'2027-07-01T00:00:00.000Z');
 assert.equal(extendPaid('2026-11-09T00:00:00.000Z',NOW,'annual'),'2027-11-10T12:00:00.000Z');
});

const ev=over=>({id:'log_1',event:'subscription.completed',devMode:false,subscriptionId:null,customerId:null,checkoutId:null,frequency:null,productId:null,userId:null,...over});
test('planOfEvent: pela frequência da assinatura e, sem ela, pelo produto',()=>{
 const e=ev;
 assert.equal(planOfEvent(e({frequency:'MONTHLY'}),PRODUCTS),'monthly');
 assert.equal(planOfEvent(e({frequency:'ANNUALLY'}),PRODUCTS),'annual');
 assert.equal(planOfEvent(e({productId:'prod_anual'}),PRODUCTS),'annual');
 assert.equal(planOfEvent(e({frequency:'WEEKLY',productId:'outro'}),PRODUCTS),null);
});

test('annualSaving e isFreeEmail',()=>{
 assert.equal(annualSaving(2990,29900),17);
 assert.equal(annualSaving(2990,35880),0);
 assert.equal(annualSaving(0,1000),0);
 assert.equal(isFreeEmail('Geo@Exemplo.com',' outra@x.com , geo@exemplo.com'),true);
 assert.equal(isFreeEmail('geo@exemplo.com',undefined),false);
 assert.equal(isFreeEmail('',','),false);
 assert.match(EXPIRED_TEXT,/venceu.*https:\/\/geo-ai-mocha\.vercel\.app/);
});

// Payloads de exemplo da documentação da AbacatePay (Webhooks → Eventos), resumidos aos campos lidos.
const COMPLETED={id:'log_taQArRTApemxwcbw5EJeF3hS',event:'subscription.completed',apiVersion:2,devMode:false,data:{subscription:{id:'subs_tAFq',amount:2990,method:'CARD',status:'ACTIVE',frequency:'MONTHLY'},customer:{id:'cust_def456',name:'Maria Santos',email:'maria@exemplo.com'},payment:{id:'char_xyz789',status:'PAID'},checkout:{id:'bill_jskd3',externalId:null,frequency:'SUBSCRIPTION',items:[{id:'prod_mensal',quantity:1}],status:'PAID',customerId:'cust_def456'}}};
const REFUNDED={event:'checkout.refunded',apiVersion:2,devMode:false,data:{checkout:{id:'bill_abc123xyz',customerId:'cust_abc123',items:[{id:'prod_xyz',quantity:1}],status:'PAID'},customer:{id:'cust_abc123'},reason:'requested_by_customer'}};

test('readEvent lê só os campos usados e tolera o que falta',()=>{
 assert.deepEqual(readEvent(COMPLETED),{id:'log_taQArRTApemxwcbw5EJeF3hS',event:'subscription.completed',devMode:false,subscriptionId:'subs_tAFq',customerId:'cust_def456',checkoutId:'bill_jskd3',frequency:'MONTHLY',productId:'prod_mensal',userId:null});
 // O exemplo de reembolso não traz id: o evento ganha um id estável pelo checkout, para as retentativas não contarem duas vezes.
 assert.deepEqual(readEvent(REFUNDED),{id:'checkout.refunded:bill_abc123xyz',event:'checkout.refunded',devMode:false,subscriptionId:null,customerId:'cust_abc123',checkoutId:'bill_abc123xyz',frequency:null,productId:'prod_xyz',userId:null});
 assert.equal(readEvent({...COMPLETED,data:{...COMPLETED.data,checkout:{...COMPLETED.data.checkout,metadata:{userId:'user_9',plan:'annual'}}}}).userId,'user_9');
 assert.equal(readEvent({event:'x'}),null);
 assert.equal(readEvent(null),null);
 assert.equal(readEvent({id:'log_1',data:{}}),null);
});

test('verifyWebhook: o segredo da URL prova a origem; com ele certo, um HMAC diferente é separado para a rota pedir nova tentativa',()=>{
 const raw=JSON.stringify(COMPLETED),sig=signBody(raw);
 assert.equal(Buffer.from(sig,'base64').length,32);
 assert.equal(verifyWebhook(raw,sig,'segredo','segredo'),'ok');
 assert.equal(verifyWebhook(raw,sig,'errado','segredo'),'secret');
 assert.equal(verifyWebhook(raw,sig,null,'segredo'),'secret');
 assert.equal(verifyWebhook(raw,null,'segredo','segredo'),'signature');
 assert.equal(verifyWebhook(raw+' ',sig,'segredo','segredo'),'signature');
 assert.equal(verifyWebhook(raw,'curta','segredo','segredo'),'signature');
});

test('abacateConfig liga a cobrança só com as 4 variáveis',()=>{
 const env={ABACATEPAY_API_KEY:'k',ABACATEPAY_WEBHOOK_SECRET:'s',ABACATEPAY_PRODUCT_MONTHLY:'prod_m',ABACATEPAY_PRODUCT_ANNUAL:'prod_a'};
 assert.deepEqual(abacateConfig(env),{apiKey:'k',webhookSecret:'s',products:{monthly:'prod_m',annual:'prod_a'}});
 assert.equal(abacateConfig({...env,ABACATEPAY_PRODUCT_ANNUAL:' '}),null);
 assert.equal(abacateConfig({}),null);
 // O webhook continua recebendo mesmo sem a chave de API.
 assert.deepEqual(webhookConfig({...env,ABACATEPAY_API_KEY:''}),{webhookSecret:'s',products:{monthly:'prod_m',annual:'prod_a'}});
 assert.equal(abacateConfig({...env,ABACATEPAY_API_KEY:''}),null);
});

test('subscriptionBody: um produto, só cartão, volta para o app e até 3 novas tentativas',()=>{
 assert.deepEqual(subscriptionBody('annual',PRODUCTS,'user_1','https://geo.example'),{items:[{id:'prod_anual',quantity:1}],methods:['CARD'],metadata:{userId:'user_1',plan:'annual'},returnUrl:'https://geo.example/',completionUrl:'https://geo.example/?assinatura=ok',retryPolicy:{maxRetry:3,retryEvery:1}});
});

test('abacateApi envia a chave e lê o envelope {data,success}; erro vira exceção com a mensagem da API',async()=>{
 const calls=[];
 const ok=async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({data:{id:'prod_m',name:'GeoAI Mensal',price:2990,cycle:'MONTHLY'},success:true,error:null}),{status:200});};
 const p=await abacateApi('chave',ok).product('prod_m');
 assert.equal(p.price,2990);
 assert.equal(calls[0].url,'https://api.abacatepay.com/v2/products/get?id=prod_m');
 assert.equal(calls[0].init.headers.Authorization,'Bearer chave');
 const fail=async()=>new Response(JSON.stringify({data:null,success:false,error:'Insufficient permissions'}),{status:403});
 await assert.rejects(abacateApi('chave',fail).cancelSubscription('subs_1'),/403.*Insufficient permissions/);
});

// Repositório em memória com o mesmo contrato do banco.
function memoryRepo(accounts,checkouts={}){const seen=new Set(),saved=[];return {saved,accounts,
 claim:async e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;},
 checkout:async id=>checkouts[id]??null,
 account:async userId=>accounts.find(a=>a.userId===userId)??null,
 accountBy:async (field,value)=>accounts.find(a=>a[field]===value)??null,
 save:async (userId,patch)=>{saved.push({userId,patch});const a=accounts.find(x=>x.userId===userId);Object.assign(a,patch);}};}

test('subscription.completed liga a assinatura pelo bill_ criado no checkout e libera um mês',async()=>{
 const repo=memoryRepo([account({trialEndsAt:at(1),cancelledAt:at(-40),refundedAt:at(-40)})],{bill_jskd3:{userId:'user_1',plan:'monthly'}});
 assert.equal((await processEvent(repo,readEvent(COMPLETED),NOW,PRODUCTS)).result,'applied');
 assert.deepEqual(repo.saved[0].patch,{plan:'monthly',subscriptionId:'subs_tAFq',customerId:'cust_def456',paidUntil:'2026-12-10T12:00:00.000Z',cancelledAt:null,refundedAt:null});
 assert.equal(accessOf(repo.accounts[0],NOW).status,'active');
 // A mesma entrega de novo (retentativa) não estende outra vez.
 assert.equal((await processEvent(repo,readEvent(COMPLETED),NOW,PRODUCTS)).result,'duplicate');
 assert.equal(repo.saved.length,1);
});

test('evento de checkout desconhecido, de tipo não usado ou sem efeito não grava nada',async()=>{
 const repo=memoryRepo([account()]);
 assert.equal((await processEvent(repo,readEvent(COMPLETED),NOW,PRODUCTS)).result,'unknown');
 assert.equal((await processEvent(repo,{...readEvent(COMPLETED),id:'log_2',event:'payout.completed'},NOW,PRODUCTS)).result,'ignored');
 const cancelled=memoryRepo([account({subscriptionId:'subs_tAFq',cancelledAt:at(-1)})]);
 assert.equal((await processEvent(cancelled,{...readEvent(COMPLETED),id:'log_3',event:'subscription.cancelled'},NOW,PRODUCTS)).result,'ignored');
 assert.equal(repo.saved.length+cancelled.saved.length,0);
});

test('renewed estende pela assinatura; cancelled guarda a data sem tirar os dias pagos',async()=>{
 const repo=memoryRepo([account({plan:'annual',subscriptionId:'subs_tAFq',paidUntil:at(0.5)})]);
 const renewed={...readEvent(COMPLETED),id:'log_r',event:'subscription.renewed',checkoutId:'bill_novo',frequency:'ANNUALLY'};
 assert.equal((await processEvent(repo,renewed,NOW,PRODUCTS)).result,'applied');
 assert.equal(repo.accounts[0].paidUntil,'2027-11-11T00:00:00.000Z');
 assert.equal((await processEvent(repo,{...renewed,id:'log_c',event:'subscription.cancelled'},NOW,PRODUCTS)).result,'applied');
 assert.equal(repo.accounts[0].cancelledAt,NOW.toISOString());
 assert.equal(repo.accounts[0].paidUntil,'2027-11-11T00:00:00.000Z');
 assert.equal(accessOf(repo.accounts[0],NOW).status,'active');
});

test('checkout.refunded corta o acesso na hora e cancela a assinatura, achando a conta pelo bill_ ou pelo cliente',async()=>{
 const byCustomer=memoryRepo([account({customerId:'cust_abc123',subscriptionId:'subs_1',plan:'monthly',paidUntil:at(25)})]);
 assert.deepEqual(await processEvent(byCustomer,readEvent(REFUNDED),NOW,PRODUCTS),{result:'applied',cancel:'subs_1'});
 assert.deepEqual(byCustomer.saved[0].patch,{paidUntil:NOW.toISOString(),refundedAt:NOW.toISOString(),cancelledAt:NOW.toISOString()});
 assert.equal(accessOf(byCustomer.accounts[0],NOW).canSubscribe,true);
 assert.equal(accessOf(byCustomer.accounts[0],NOW).status,'expired');
 const byCheckout=memoryRepo([account({userId:'user_2',paidUntil:at(25)})],{bill_abc123xyz:{userId:'user_2',plan:'monthly'}});
 assert.equal((await processEvent(byCheckout,readEvent(REFUNDED),NOW,PRODUCTS)).result,'applied');
 assert.equal(byCheckout.saved[0].userId,'user_2');
});

test('eventPatch: renovação depois de um reembolso volta a ter folga',()=>{
 const p=eventPatch(ev({event:'subscription.renewed',subscriptionId:'subs_1',frequency:'MONTHLY'}),account({plan:'monthly',refundedAt:at(-5),paidUntil:at(-5)}),NOW,PRODUCTS);
 assert.deepEqual(p,{plan:'monthly',paidUntil:'2026-12-10T12:00:00.000Z',refundedAt:null});
});

test('ativação sem frequência nem produto usa o plano escolhido no checkout (anual não vira mensal)',async()=>{
 const repo=memoryRepo([account()],{bill_x:{userId:'user_1',plan:'annual'}});
 assert.equal((await processEvent(repo,ev({id:'log_a',subscriptionId:'subs_a',checkoutId:'bill_x'}),NOW,PRODUCTS)).result,'applied');
 assert.equal(repo.accounts[0].plan,'annual');assert.equal(repo.accounts[0].paidUntil,'2027-11-10T12:00:00.000Z');
});

test('segunda assinatura da mesma conta: a nova vale e a antiga sai para ser cancelada; com assinatura viva não se assina de novo',async()=>{
 const repo=memoryRepo([account({subscriptionId:'subs_old',plan:'monthly',paidUntil:at(20)})],{bill_2:{userId:'user_1',plan:'monthly'}});
 assert.equal(accessOf(repo.accounts[0],NOW).canSubscribe,false);
 assert.deepEqual(await processEvent(repo,ev({id:'log_2',subscriptionId:'subs_new',checkoutId:'bill_2',frequency:'MONTHLY'}),NOW,PRODUCTS),{result:'applied',cancel:'subs_old'});
 assert.equal(repo.accounts[0].subscriptionId,'subs_new');
 // A mesma assinatura chegando de novo com outro id de evento: nada a cancelar.
 assert.deepEqual(await processEvent(repo,ev({id:'log_3',subscriptionId:'subs_new',checkoutId:'bill_2',frequency:'MONTHLY'}),NOW,PRODUCTS),{result:'applied'});
});

test('ativação sem bill_ conhecido acha a conta pelo userId do metadata',async()=>{
 const repo=memoryRepo([account()]);
 assert.equal((await processEvent(repo,ev({id:'log_m',subscriptionId:'subs_m',checkoutId:'bill_desconhecido',frequency:'MONTHLY',userId:'user_1'}),NOW,PRODUCTS)).result,'applied');
 assert.equal(repo.accounts[0].subscriptionId,'subs_m');
 assert.equal((await processEvent(repo,ev({id:'log_n',subscriptionId:'subs_n',userId:'user_x'}),NOW,PRODUCTS)).result,'unknown');
});
