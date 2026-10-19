import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, applyCommand } from '../lib/core.ts';
import { femaleReminderDue } from '../lib/female-health.ts';
import { sendFemaleReminders, femaleCallbackAction, parseFemaleCallback, femaleButtons, hourInZone, FEMALE_REMINDER_TEXT } from '../lib/female-reminders.ts';
import { sendDueReminders } from '../lib/trt-reminders.ts';

const pill={id:'m1',title:'Yasmin',method:'daily',startDate:'2026-10-01',activeDays:21,pauseDays:7,status:'active',remind:true,time:'21:00'};
const NIGHT=new Date('2026-10-11T00:30:00Z'); // 21h30 de 10/10 em São Paulo
function space(extra={}){const s=emptyWorkspace('Ana');s.profile.gender='female';s.contraceptives=[{...pill,...extra}];return s;}
function harness(state){const sent=[];let s=state;return {sent,get state(){return s;},deps:{links:async()=>[{chatId:'c1',userId:'u1'}],load:async()=>({state:s}),mutate:async(_u,c)=>{s=applyCommand(s,c,'2026-10-10');},send:async(chatId,text,markup)=>{sent.push({chatId,text,markup});}}};}

test('hora local pelo fuso do perfil',()=>{assert.equal(hourInZone('America/Sao_Paulo',NIGHT),21);assert.equal(hourInZone('UTC',NIGHT),0);});
test('envia na hora local, uma vez, com os botões do uso diário',async()=>{const h=harness(space());
 assert.deepEqual(await sendFemaleReminders({...h.deps,now:NIGHT}),{checked:1,sent:1,failed:0});
 assert.equal(h.sent[0].text,FEMALE_REMINDER_TEXT);assert.deepEqual(h.sent[0].markup,femaleButtons(pill));assert.equal(h.state.contraceptives[0].remindedOn,'2026-10-10');
 assert.equal((await sendFemaleReminders({...h.deps,now:NIGHT})).sent,0);
 const early=harness(space());assert.equal((await sendFemaleReminders({...early.deps,now:new Date('2026-10-10T23:30:00Z')})).sent,0);});
test('não envia para quem não vê o menu e falha de um chat não para os outros',async()=>{const male=space();male.profile.gender='male';const h=harness(male);assert.equal((await sendFemaleReminders({...h.deps,now:NIGHT})).sent,0);
 const broken=harness(space());broken.deps.load=async()=>{throw new Error('db');};assert.deepEqual(await sendFemaleReminders({...broken.deps,now:NIGHT}),{checked:1,sent:0,failed:1});});
test('testosterona não lembra quem tem o menu oculto',async()=>{const s=emptyWorkspace('Ana');s.trtProtocols=[{id:'t1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-10-10',status:'active',remind:true}];
 const run=()=>sendDueReminders({links:async()=>[{chatId:'c',userId:'u'}],load:async()=>({state:s}),mutate:async()=>{},send:async()=>{},now:new Date('2026-10-10T15:00:00Z')});
 s.profile.gender='female';assert.equal((await run()).sent,0);s.profile.gender='male';assert.equal((await run()).sent,1);});
test('Tomei registra uma vez e informa a próxima',()=>{let s=space();const r=femaleCallbackAction(s,'2026-10-10',21,{action:'done',methodId:'m1'});assert.equal(r.command.item.id,'take-m1-2026-10-10');assert.equal(r.reply,'Registrado. Próxima: amanhã.');
 s=applyCommand(s,r.command,'2026-10-10');const again=femaleCallbackAction(s,'2026-10-10',21,{action:'done',methodId:'m1'});assert.equal(again.command,undefined);assert.match(again.reply,/já estava feito/);
 assert.equal(femaleCallbackAction(space(),'2026-10-21',21,{action:'done',methodId:'m1'}).reply,'Registrado. Pausa até 28/10.');
 assert.equal(femaleCallbackAction(space(),'2026-10-10',21,{action:'done',methodId:'x'}).reply,'Este cuidado não existe mais no seu GeoAI.');});
test('Lembrar em 1h volta na hora seguinte; às 23h fica para amanhã; Adiar 1 dia',()=>{let s=space({remindedOn:'2026-10-10'});
 const r=femaleCallbackAction(s,'2026-10-10',21,{action:'hour',methodId:'m1'});assert.deepEqual(r.command.item,{remindedOn:'',snoozedUntil:'2026-10-10',snoozeHour:22});
 s=applyCommand(s,r.command,'2026-10-10');const m=s.contraceptives[0];assert.equal(m.remindedOn,undefined);assert.deepEqual([21,22].map(h=>femaleReminderDue(m,[],'2026-10-10',h)),[false,true]);
 assert.deepEqual(femaleCallbackAction(space(),'2026-10-10',23,{action:'hour',methodId:'m1'}).command.item,{remindedOn:'',snoozedUntil:'2026-10-11',snoozeHour:''});
 const shot=space({method:'injection',intervalDays:90,startDate:'2026-07-12'});const a=femaleCallbackAction(shot,'2026-10-10',9,{action:'snooze',methodId:'m1'});
 assert.deepEqual(a.command.item,{snoozedUntil:'2026-10-11',snoozeHour:''});assert.equal(a.reply,'Combinado, lembro amanhã.');
 assert.match(femaleCallbackAction(shot,'2026-10-10',9,{action:'done',methodId:'m1'}).reply,/Próxima injeção: 08\/01\/2027/);});
test('callback_data do Telegram',()=>{assert.deepEqual(['fh:d:m1','fh:h:m1','fh:s:m1'].map(parseFemaleCallback).map(x=>x.action),['done','hour','snooze']);assert.equal(parseFemaleCallback('trt:d:m1'),null);assert.equal(parseFemaleCallback('fh:x:m1'),null);
 assert.deepEqual(femaleButtons({id:'i',method:'injection'}).inline_keyboard[0].map(b=>b.callback_data),['fh:d:i','fh:s:i']);
 assert.ok(femaleButtons({id:crypto.randomUUID(),method:'daily'}).inline_keyboard[0].every(b=>Buffer.byteLength(b.callback_data)<=64));});
