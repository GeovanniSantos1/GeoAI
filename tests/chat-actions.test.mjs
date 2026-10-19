import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../lib/core.ts';
import {resolveChoice} from '../lib/chat-actions.ts';

const NOON=new Date('2026-10-16T15:00:00Z'); // 12h de 16/10 em São Paulo
function space(){const s=emptyWorkspace('Geo');s.trtProtocols=[{id:'p1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-09-01',status:'active',remind:true}];s.trtDoses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-10-02'}];
 s.profile.gender='female';s.contraceptives=[{id:'m1',title:'Yasmin',method:'daily',startDate:'2026-10-01',activeDays:21,pauseDays:7,status:'active',remind:true,time:'21:00'}];return s;}
const pending={g1:{items:[{collection:'tasks',item:{id:'x',title:'Ler',date:'2026-10-16'}},{collection:'notes',item:{id:'y',title:'Ideia'}}],createdAt:'2026-10-16T10:00:00Z'},g2:{items:[{collection:'tasks',item:{id:'z',title:'Correr',date:'2026-10-16'}}],createdAt:'2026-10-16T11:00:00Z'}};

test('Apliquei e Adiar da testosterona',()=>{const r=resolveChoice('trt:d:p1',space(),{},NOON);
 assert.equal(r.command.collection,'trtDoses');assert.equal(r.ack,'Registrado!');assert.equal(r.reply,'Aplicação registrada. Próxima: 30/10/2026.');assert.equal(r.pending,undefined);
 const s=resolveChoice('trt:s:p1',space(),{},NOON);assert.equal(s.command.item.snoozedUntil,'2026-10-17');assert.equal(s.ack,'Adiado.');});
test('Tomei do anticoncepcional',()=>{const r=resolveChoice('fh:d:m1',space(),{},NOON);assert.equal(r.command.collection,'contraceptiveDoses');assert.equal(r.ack,'Registrado!');assert.match(r.reply,/^Registrado\./);});
test('protocolo apagado responde sem comando',()=>{const r=resolveChoice('trt:d:nao',space(),{},NOON);assert.equal(r.command,undefined);assert.equal(r.ack,'Ok');assert.match(r.reply,/não existe/);});
test('Adicionar confirma o grupo e tira só ele das pendências',()=>{const r=resolveChoice('add:g1',space(),pending,NOON);
 assert.deepEqual(r.command,{type:'confirmPlan',items:pending.g1.items});assert.equal(r.reply,'✅ 2 itens adicionados ao seu GeoAI.');assert.equal(r.ack,'Adicionado!');assert.deepEqual(Object.keys(r.pending),['g2']);
 assert.equal(resolveChoice('add:g2',space(),pending,NOON).reply,'✅ 1 item adicionado ao seu GeoAI.');});
test('Descartar não salva nada',()=>{const r=resolveChoice('drop:g2',space(),pending,NOON);assert.equal(r.command,undefined);assert.equal(r.reply,'Sugestões descartadas.');assert.equal(r.ack,'Descartado.');assert.deepEqual(Object.keys(r.pending),['g1']);});
test('sugestões vencidas ou escolha desconhecida',()=>{for(const data of ['add:nao','drop:','xyz','add:constructor','drop:__proto__','add:toString']){const r=resolveChoice(data,space(),pending,NOON);assert.equal(r.expired,true);assert.equal(r.command,undefined);assert.equal(r.reply,'Essas sugestões não estão mais disponíveis.');}});
