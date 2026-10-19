import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOT_PREFIX,parseEvolutionEvent,linkCodeOf,newLinkCode,waCommand,waLink,displayNumber,choicesFrom,choiceIndex,choicesJson,choicesOf,waChunks,waSecret,evolutionConfig,evolutionApi,evolutionErrorText,CODE_ALPHABET} from '../lib/whatsapp.ts';

const OWNER='5511900000000@s.whatsapp.net',FRIEND='5531999990000@s.whatsapp.net';
const ev=(key,message={conversation:'oi'},extra={})=>({event:'messages.upsert',instance:'Evolution',data:{key:{id:'ID1',...key},pushName:'Ana',message,messageType:'conversation',...extra}});

test('mensagem de um contato vira evento com rótulo',()=>{
 assert.deepEqual(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false}),'Evolution',OWNER),{id:'ID1',jid:FRIEND,fromMe:false,text:'oi',label:'Ana · +5531999990000',textless:false});});
test('regras do número pessoal: grupos, mensagens do dono para outros e ecos do bot ficam de fora',()=>{
 assert.equal(parseEvolutionEvent(ev({remoteJid:'1203630@g.us',fromMe:false,participant:FRIEND}),'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:'status@broadcast',fromMe:false}),'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:true}),'Evolution',OWNER),null);
 const self=parseEvolutionEvent(ev({remoteJid:OWNER,fromMe:true}),'Evolution',OWNER);assert.equal(self.fromMe,true);assert.equal(self.jid,OWNER);
 assert.equal(parseEvolutionEvent(ev({remoteJid:OWNER,fromMe:true},{conversation:BOT_PREFIX+'Pronto.'}),'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:OWNER,fromMe:true},{conversation:'  🤖 eco'}),'Evolution',OWNER),null);});
test('sem o número da instância, só a mensagem do dono pede a conferência; grupos saem antes',()=>{
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:true}),'Evolution').fromMe,true);
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false}),'Evolution').fromMe,false);
 assert.equal(parseEvolutionEvent(ev({remoteJid:'1203630@g.us',fromMe:true}),'Evolution'),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:'status@broadcast',fromMe:true}),'Evolution'),null);});
test('na conversa consigo mesmo, foto e áudio ficam em silêncio',()=>{
 assert.equal(parseEvolutionEvent(ev({remoteJid:OWNER,fromMe:true},{imageMessage:{}}),'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:OWNER,fromMe:true},{audioMessage:{}}),'Evolution'),null);});
test('mensagens com mais de 10 minutos ficam de fora, inclusive um "1" velho',()=>{const NOW=Date.parse('2026-10-19T12:00:00Z'),at=messageTimestamp=>({messageTimestamp});
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{conversation:'1'},at(NOW/1000-11*60)),'Evolution',OWNER,NOW),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{conversation:'1'},at(String(NOW/1000-11*60))),'Evolution',OWNER,NOW),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{conversation:'1'},at(NOW/1000-9*60)),'Evolution',OWNER,NOW).text,'1');
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false}),'Evolution',OWNER,NOW).text,'oi');});
test('texto dentro de mensagem efêmera, de visualização única ou enviada de outro aparelho',()=>{
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{ephemeralMessage:{message:{extendedTextMessage:{text:'oi efêmero'}}}}),'Evolution',OWNER).text,'oi efêmero');
 assert.equal(parseEvolutionEvent(ev({remoteJid:OWNER,fromMe:true},{deviceSentMessage:{destinationJid:OWNER,message:{conversation:'do celular'}}}),'Evolution',OWNER).text,'do celular');
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{viewOnceMessageV2:{message:{imageMessage:{}}}}),'Evolution',OWNER).textless,true);
 assert.equal(parseEvolutionEvent(ev({remoteJid:OWNER,fromMe:true},{ephemeralMessage:{message:{conversation:BOT_PREFIX+'eco'}}}),'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{ephemeralMessage:{message:{reactionMessage:{text:'👍'}}}}),'Evolution',OWNER),null);});
test('erros de rede e de tempo da Evolution em português',()=>{
 assert.equal(evolutionErrorText(new DOMException('The operation was aborted due to timeout','TimeoutError')),'A Evolution demorou para responder.');
 assert.equal(evolutionErrorText(new TypeError('fetch failed')),'Não foi possível alcançar a Evolution. Confira se o computador, a Evolution e o ngrok estão ligados.');
 assert.equal(evolutionErrorText(new Error('Evolution respondeu 404')),'Evolution respondeu 404');assert.equal(evolutionErrorText('x'),'tente novamente');});
test('texto de extendedTextMessage, sem texto e eventos de outra instância ou de outro tipo',()=>{
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{extendedTextMessage:{text:'oi ext'}}),'Evolution',OWNER).text,'oi ext');
 const audio=parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{audioMessage:{}}),'Evolution',OWNER);assert.equal(audio.textless,true);assert.equal(audio.text,'');
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},{imageMessage:{}}),'Evolution',OWNER).textless,true);
 for(const m of [{reactionMessage:{text:'👍'}},{protocolMessage:{type:0}},{editedMessage:{message:{}}},{senderKeyDistributionMessage:{}}])assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false},m),'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false}),'Outra',OWNER),null);
 assert.equal(parseEvolutionEvent({...ev({remoteJid:FRIEND,fromMe:false}),event:'messages.update'},'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(ev({remoteJid:FRIEND,fromMe:false,id:''}),'Evolution',OWNER),null);
 assert.equal(parseEvolutionEvent(null,'Evolution',OWNER),null);});
test('código de ligação e comandos',()=>{
 assert.equal(linkCodeOf('GEOAI K7Q2PX'),'K7Q2PX');assert.equal(linkCodeOf('  geoai k7q2px '),'K7Q2PX');assert.equal(linkCodeOf('GEOAI K7Q2P'),null);assert.equal(linkCodeOf('oi GEOAI K7Q2PX'),null);
 const code=newLinkCode();assert.equal(code.length,6);assert.ok([...code].every(ch=>CODE_ALPHABET.includes(ch)));
 assert.equal(newLinkCode(n=>new Uint8Array(n)),'AAAAAA');
 assert.equal(waCommand('ajuda'),'ajuda');assert.equal(waCommand(' /Ajuda '),'ajuda');assert.equal(waCommand('help'),'ajuda');assert.equal(waCommand('DESCONECTAR'),'desconectar');assert.equal(waCommand('ajuda por favor'),null);});
test('link do wa.me e número exibido',()=>{
 assert.equal(waLink(OWNER,'K7Q2PX'),'https://wa.me/5511900000000?text=GEOAI%20K7Q2PX');
 assert.equal(displayNumber(OWNER),'+55 11 90000-0000');assert.equal(displayNumber('5531999990000@s.whatsapp.net'),'+55 31 99999-0000');assert.equal(displayNumber('14155550100@s.whatsapp.net'),'+14155550100');});
test('botões viram opções 1/2 e a resposta vira índice',()=>{
 const r=choicesFrom({inline_keyboard:[[{text:'✅ Apliquei',callback_data:'trt:d:p1'},{text:'Adiar 1 dia',callback_data:'trt:s:p1'}]]});
 assert.deepEqual(r,{choices:['trt:d:p1','trt:s:p1'],text:'Responda 1 para ✅ Apliquei · 2 para Adiar 1 dia'});
 assert.equal(choiceIndex('1'),0);assert.equal(choiceIndex(' 2 '),1);assert.equal(choiceIndex('12'),null);assert.equal(choiceIndex('0'),null);assert.equal(choiceIndex('um'),null);});
test('escolhas valem 12 horas e a lista antiga conta como sem escolhas',()=>{const NOW=Date.parse('2026-10-19T12:00:00Z');
 assert.equal(choicesJson(['trt:d:p1','trt:s:p1'],NOW),'{"at":"2026-10-19T12:00:00.000Z","items":["trt:d:p1","trt:s:p1"]}');
 assert.deepEqual(choicesOf(choicesJson(['add:g1','drop:g1'],NOW-11*3600000),NOW),['add:g1','drop:g1']);
 assert.deepEqual(choicesOf(choicesJson(['add:g1','drop:g1'],NOW-12*3600000-1),NOW),[]);
 for(const old of ['["trt:d:p1","trt:s:p1"]','[]','null','lixo','{"items":["a"]}','{"at":"2026-10-19T11:00:00.000Z","items":[1]}'])assert.deepEqual(choicesOf(old,NOW),[]);});
test('toda parte de uma mensagem longa começa com o prefixo do bot',()=>{
 const parts=waChunks('linha\n'.repeat(1500));assert.ok(parts.length>1);assert.ok(parts.every(p=>p.startsWith(BOT_PREFIX)));assert.ok(parts.every(p=>p.length<=4000));
 assert.deepEqual(waChunks('Oi'),[BOT_PREFIX+'Oi']);});
test('segredo do webhook deriva da chave',async()=>{const a=await waSecret('k1'),b=await waSecret('k2');assert.match(a,/^[0-9a-f]{64}$/);assert.notEqual(a,b);assert.equal(await waSecret('k1'),a);});
test('configuração exige as três variáveis e limpa a barra final',()=>{
 assert.equal(evolutionConfig({EVOLUTION_API_URL:'https://x.ngrok-free.dev/',EVOLUTION_API_KEY:'k'}),null);
 assert.deepEqual(evolutionConfig({EVOLUTION_API_URL:'https://x.ngrok-free.dev/',EVOLUTION_API_KEY:' k ',EVOLUTION_INSTANCE:'Evolution'}),{url:'https://x.ngrok-free.dev',key:'k',instance:'Evolution'});});
test('cliente da Evolution: cabeçalhos, corpo e erros',async()=>{const calls=[];
 const fetcher=async(url,init)=>{calls.push({url,init});if(url.includes('fetchInstances'))return Response.json([{name:'Evolution',ownerJid:OWNER}]);if(url.includes('falha'))return new Response('{}',{status:500});return Response.json({ok:true},{status:201});};
 const api=evolutionApi({url:'https://x.ngrok-free.dev',key:'k',instance:'Evolution'},fetcher);
 await api.sendText(FRIEND,'🤖 oi');assert.equal(calls[0].url,'https://x.ngrok-free.dev/message/sendText/Evolution');assert.equal(calls[0].init.method,'POST');
 assert.equal(calls[0].init.headers.apikey,'k');assert.equal(calls[0].init.headers['ngrok-skip-browser-warning'],'true');assert.deepEqual(JSON.parse(calls[0].init.body),{number:FRIEND,text:'🤖 oi'});
 await api.setWebhook('https://geo.app/api/whatsapp','s3');assert.deepEqual(JSON.parse(calls[1].init.body),{webhook:{enabled:true,url:'https://geo.app/api/whatsapp',events:['MESSAGES_UPSERT'],byEvents:false,base64:false,headers:{'x-geoai-secret':'s3'}}});
 assert.equal(await api.ownerJid(),OWNER);assert.equal(calls[2].url,'https://x.ngrok-free.dev/instance/fetchInstances?instanceName=Evolution');assert.equal(calls[2].init.method,'GET');
 const bad=evolutionApi({url:'https://x.ngrok-free.dev/falha',key:'k',instance:'Evolution'},fetcher);await assert.rejects(bad.sendText(FRIEND,'oi'),/Evolution respondeu 500/);
 const none=evolutionApi({url:'https://x',key:'k',instance:'Evolution'},async()=>Response.json([{name:'Outra',ownerJid:FRIEND}]));await assert.rejects(none.ownerJid(),/Instância não encontrada/);});
