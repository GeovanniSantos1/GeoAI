import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entrarUrl,suporteWhatsapp,CAPITULOS,VIDEO} from '../lib/boas-vindas.ts';
import {LEGAL} from '../lib/legal.ts';

test('Entrar no app: vindo do checkout, o app confirma o pagamento; pelo link mandado, só abre o app',()=>{
 assert.equal(entrarUrl('ok'),'/?assinatura=ok');
 assert.equal(entrarUrl(undefined),'/');
 assert.equal(entrarUrl(''),'/');
 assert.equal(entrarUrl('qualquer'),'/');
 assert.equal(entrarUrl(['ok','ok']),'/','parâmetro repetido não conta');
});

test('Suporte no WhatsApp: o número do rodapé, com a mensagem pronta',()=>{
 const u=new URL(suporteWhatsapp());
 assert.equal(u.origin+u.pathname,LEGAL.whatsappUrl);
 assert.equal(u.searchParams.get('text'),'Olá! Acabei de assinar o GeoAI e preciso de ajuda.');
});

test('Capítulos do vídeo: na ordem do tutorial, dentro da duração',()=>{
 assert.deepEqual(CAPITULOS.map(c=>c.rotulo),['Configurações','WhatsApp','Telegram','Agenda']);
 CAPITULOS.forEach((c,i)=>{
  assert.ok(c.inicio>=0&&c.inicio<VIDEO.duracao,c.rotulo+' dentro do vídeo');
  if(i)assert.ok(c.inicio>CAPITULOS[i-1].inicio,c.rotulo+' depois do anterior');
 });
 assert.match(VIDEO.src,/^\/boas-vindas\/.+\.mp4$/);
 assert.match(VIDEO.capa,/^\/boas-vindas\/.+\.jpg$/);
});
