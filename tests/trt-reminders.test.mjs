import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, applyCommand } from '../lib/core.ts';
import { sendDueReminders, parseTrtCallback, trtCallbackAction, REMINDER_TEXT } from '../lib/trt-reminders.ts';

const protocol={id:'p1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-09-01',status:'active',remind:true};
function space(extra={}){const s=emptyWorkspace('Geo');s.trtProtocols=[{...protocol,...extra}];s.trtDoses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-10-02'}];return s;}

test('envia um lembrete por protocolo devido, marca o dia e não para por erro de um usuário',async()=>{const states={u1:space(),u2:space({remind:false}),u3:space()};const sent=[];
 const r=await sendDueReminders({now:new Date('2026-10-16T11:00:00Z'),links:async()=>[{chatId:'c1',userId:'u1'},{chatId:'c2',userId:'u2'},{chatId:'c3',userId:'quebrado'},{chatId:'c4',userId:'u3'}],load:async u=>{if(u==='quebrado')throw new Error('falhou');return {state:states[u]};},mutate:async(u,c)=>{states[u]=applyCommand(states[u],c,'2026-10-16');},send:async(chatId,text,markup)=>{sent.push([chatId,text,markup.inline_keyboard[0].map(b=>b.callback_data)]);}});
 assert.deepEqual(r,{checked:4,sent:2,failed:1});assert.deepEqual(sent[0],['c1',REMINDER_TEXT,['trt:d:p1','trt:s:p1']]);assert.equal(sent[1][0],'c4');assert.equal(states.u1.trtProtocols[0].remindedOn,'2026-10-16');
 const again=await sendDueReminders({now:new Date('2026-10-16T11:30:00Z'),links:async()=>[{chatId:'c1',userId:'u1'}],load:async u=>({state:states[u]}),mutate:async()=>{},send:async()=>{sent.push('dup');}});assert.equal(again.sent,0);});
test('usa o fuso do usuário para decidir o dia',async()=>{let count=0;await sendDueReminders({now:new Date('2026-10-16T02:00:00Z'),links:async()=>[{chatId:'c',userId:'u'}],load:async()=>({state:space()}),mutate:async()=>{},send:async()=>{count++;}});assert.equal(count,0);});
test('lê os botões do lembrete',()=>{assert.deepEqual(parseTrtCallback('trt:d:p1'),{action:'done',protocolId:'p1'});assert.deepEqual(parseTrtCallback('trt:s:p1'),{action:'snooze',protocolId:'p1'});assert.equal(parseTrtCallback('add:abc'),null);assert.equal(parseTrtCallback('trt:x:p1'),null);});
test('Apliquei registra uma vez por dia e informa a próxima data',()=>{let s=space();const first=trtCallbackAction(s,'2026-10-16',{action:'done',protocolId:'p1'});assert.equal(first.reply,'Aplicação registrada. Próxima: 30/10/2026.');
 s=applyCommand(s,first.command,'2026-10-16');const second=trtCallbackAction(s,'2026-10-16',{action:'done',protocolId:'p1'});assert.equal(second.command,undefined);assert.equal(second.reply,'A aplicação de hoje já estava registrada. Próxima: 30/10/2026.');
 assert.equal(s.trtDoses.filter(d=>d.date==='2026-10-16').length,1);assert.equal(s.trtDoses.find(d=>d.date==='2026-10-16').dose,250);});
test('Apliquei não mexe em aplicação do dia já registrada com outro id, local e notas',()=>{const s=space();s.trtDoses.push({id:'rand-1',title:'Aplicação: Durateston',date:'2026-10-16',protocolId:'p1',dose:200,site:'Glúteo',notes:'ok'});const before=structuredClone(s.trtDoses);const r=trtCallbackAction(s,'2026-10-16',{action:'done',protocolId:'p1'});assert.equal(r.command,undefined);assert.match(r.reply,/já estava registrada/);assert.deepEqual(s.trtDoses,before);});
test('Adiar 1 dia grava o adiamento; protocolo removido avisa',()=>{let s=space();const r=trtCallbackAction(s,'2026-10-16',{action:'snooze',protocolId:'p1'});s=applyCommand(s,r.command,'2026-10-16');
 assert.equal(s.trtProtocols[0].snoozedUntil,'2026-10-17');assert.equal(r.reply,'Combinado, lembro amanhã.');
 const gone=trtCallbackAction(s,'2026-10-16',{action:'done',protocolId:'nao'});assert.equal(gone.command,undefined);assert.match(gone.reply,/não existe/);});
