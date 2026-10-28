import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEGAL,canonicalRedirect} from '../lib/legal.ts';

const digits=s=>s.replace(/\D/g,'');
const checkDigit=(base,weights)=>{const r=[...base].reduce((t,d,i)=>t+Number(d)*weights[i],0)%11;return r<2?0:11-r;};

test('CNPJ do rodapé tem os dígitos verificadores certos',()=>{
 const n=digits(LEGAL.cnpj);assert.equal(n.length,14);
 const d1=checkDigit(n.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);const d2=checkDigit(n.slice(0,12)+d1,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
 assert.equal(n.slice(12),`${d1}${d2}`);
 assert.ok(LEGAL.company.startsWith(n.slice(0,8).replace(/^(\d{2})(\d{3})(\d{3})$/,'$1.$2.$3')),'razão social do MEI começa pela raiz do CNPJ');
});

test('contatos: link do WhatsApp aponta para o número exibido e o e-mail é válido',()=>{
 assert.equal(LEGAL.whatsappUrl,'https://wa.me/55'+digits(LEGAL.whatsapp));
 assert.equal(digits(LEGAL.whatsapp).length,11);
 assert.match(LEGAL.email,/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/);
});

test('endereço antigo da Vercel: páginas vão para o domínio próprio, APIs continuam nele',()=>{
 assert.equal(canonicalRedirect('geo-ai-mocha.vercel.app','/termos','?x=1'),'https://geochat.ia.br/termos?x=1');
 assert.equal(canonicalRedirect('geo-ai-mocha.vercel.app','/',''),'https://geochat.ia.br/');
 assert.equal(canonicalRedirect('geo-ai-mocha.vercel.app','/api/billing/webhook','?webhookSecret=s'),null);
 assert.equal(canonicalRedirect('geochat.ia.br','/',''),null);
 assert.equal(canonicalRedirect('geo-ai-git-feat-x.vercel.app','/',''),null,'prévias seguem no endereço delas');
 assert.equal(canonicalRedirect(null,'/',''),null);
});
