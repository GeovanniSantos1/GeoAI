import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEGAL} from '../lib/legal.ts';

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
