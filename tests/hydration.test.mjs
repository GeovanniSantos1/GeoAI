import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,applyCommand,validateWorkspace} from '../lib/core.ts';
import {waterGoal,waterDay,expectedBy,paceOf,parseWater,waterSummary,waterAddedText,reminderDue,behindNow,reminderText,waterButtons,parseWaterCallback,minutesInZone,fmtMl,waterWeek,waterStreak,cleanSips,TIPS,tipOf} from '../lib/hydration.ts';
import {resolveChoice} from '../lib/chat-actions.ts';
import {waterChat,sendWaterReminders} from '../lib/water-channels.ts';

const TODAY='2026-10-23';
// 14:30 em São Paulo (UTC-3).
const AT=(h,m=0)=>new Date(Date.UTC(2026,9,23,h+3,m));
const base=()=>{const s=emptyWorkspace('Geo');s.profile.gender='male';return s;};
const add=(s,ml,h=10,via)=>applyCommand(s,{type:'water',action:'add',ml,...(via?{via}:{})},TODAY,AT(h));

test('meta automática: 35 ml por kg do último peso, arredondada, com teto e piso; 2 L sem peso',()=>{
 const s=base();assert.deepEqual(waterGoal(s,TODAY),{ml:2000,auto:true,weight:undefined,base:2000,training:false});
 s.measurements.push({id:'m1',title:'Medidas',date:'2026-10-01',weight:70},{id:'m2',title:'Medidas',date:'2026-10-20',weight:82.4},{id:'m3',title:'Medidas',date:'2026-10-30',weight:60});
 assert.equal(waterGoal(s,TODAY).ml,2900);assert.equal(waterGoal(s,TODAY).weight,82.4);
 s.measurements=[{id:'m',title:'M',date:'2026-10-01',weight:200}];assert.equal(waterGoal(s,TODAY).ml,5000);
 s.measurements=[{id:'m',title:'M',date:'2026-10-01',weight:30}];assert.equal(waterGoal(s,TODAY).ml,1500);});

test('meta: +500 ml no dia com treino registrado; a manual vale todo dia, sem acréscimo',()=>{
 const s=base();s.sessions.push({id:'t',title:'Treino',date:TODAY,duration:40});
 assert.deepEqual(waterGoal(s,TODAY),{ml:2500,auto:true,weight:undefined,base:2000,training:true});
 assert.equal(waterGoal(s,'2026-10-22').ml,2000);
 const m=applyCommand(s,{type:'profile',profile:{waterGoal:3200}},TODAY);assert.deepEqual(waterGoal(m,TODAY),{ml:3200,auto:false,base:3200,training:false});
 const back=applyCommand(m,{type:'profile',profile:{waterGoal:0}},TODAY);assert.equal(waterGoal(back,TODAY).auto,true);
 for(const bad of [500,7000,1.5,-1,'2000'])assert.throws(()=>applyCommand(s,{type:'profile',profile:{waterGoal:bad}},TODAY),/meta de água/i,String(bad));});

test('lembretes: liga e desliga no perfil; espaços antigos começam desligados',()=>{
 const s=base();assert.equal(s.profile.waterReminders,false);assert.equal(s.profile.waterGoal,0);
 assert.equal(applyCommand(s,{type:'profile',profile:{waterReminders:true}},TODAY).profile.waterReminders,true);
 const old=JSON.parse(JSON.stringify(s));delete old.water;delete old.profile.waterGoal;delete old.profile.waterReminders;
 const v=validateWorkspace(old);assert.deepEqual(v.water,[]);assert.equal(v.profile.waterReminders,false);assert.equal(v.profile.waterGoal,0);});

test('gole: soma no dia, guarda horário no fuso e origem; desfazer e remover recalculam o total',()=>{
 let s=add(base(),250,9);s=add(s,500,14,'whatsapp');
 const d=waterDay(s,TODAY);assert.equal(d.id,'water-'+TODAY);assert.equal(d.ml,750);assert.equal(d.title,'Água');
 assert.deepEqual(d.sips.map(x=>[x.at,x.ml,x.via]),[['09:00',250,'web'],['14:00',500,'whatsapp']]);
 s=applyCommand(s,{type:'water',action:'undo'},TODAY,AT(15));assert.equal(waterDay(s,TODAY).ml,250);
 s=applyCommand(s,{type:'water',action:'remove',sipId:waterDay(s,TODAY).sips[0].id},TODAY,AT(15));assert.equal(waterDay(s,TODAY).ml,0);
 assert.throws(()=>applyCommand(s,{type:'water',action:'undo'},TODAY),/Nenhum registro/);
 assert.throws(()=>applyCommand(s,{type:'water',action:'remove',sipId:'x'},TODAY),/não encontrado/);});

test('gole: valida quantidade, data e origem',()=>{
 const s=base();for(const ml of [0,5,3001,12.5,'250',undefined])assert.throws(()=>add(s,ml),/entre 10 ml e 3 L/,String(ml));
 assert.throws(()=>applyCommand(s,{type:'water',action:'add',ml:250,date:'2026-10-24'},TODAY),/futura/);
 assert.throws(()=>applyCommand(s,{type:'water',action:'pour',ml:250},TODAY),/não reconhecida/);
 const y=applyCommand(s,{type:'water',action:'add',ml:300,date:'2026-10-22'},TODAY,AT(9));assert.equal(waterDay(y,'2026-10-22').sips[0].at,'12:00');
 assert.equal(waterDay(add(s,250,9,'hacker'),TODAY).sips[0].via,'web');});

test('gole: o portal escolhe o id (para o Desfazer); id inválido ou repetido ganha um novo',()=>{
 let s=applyCommand(base(),{type:'water',action:'add',ml:250,sipId:'web-1'},TODAY,AT(9));assert.equal(waterDay(s,TODAY).sips[0].id,'web-1');
 s=applyCommand(s,{type:'water',action:'add',ml:250,sipId:'web-1'},TODAY,AT(9));s=applyCommand(s,{type:'water',action:'add',ml:250,sipId:'a b'},TODAY,AT(9));
 const ids=waterDay(s,TODAY).sips.map(x=>x.id);assert.equal(new Set(ids).size,3);assert.ok(ids.every(x=>/^[\w-]+$/.test(x)));
 s=applyCommand(s,{type:'water',action:'remove',sipId:'web-1'},TODAY,AT(10));assert.equal(waterDay(s,TODAY).ml,500);});

test('meta batida dá 15 pontos uma vez por dia',()=>{
 let s=add(base(),1500,9);const xp=s.profile.xp;s=add(s,500,10);assert.equal(s.profile.xp,xp+15);
 s=add(s,250,11);assert.equal(s.profile.xp,xp+15);assert.ok(s.rewarded.includes('water:'+TODAY));});

test('validação do dia: total sempre igual à soma; goles inválidos são recusados',()=>{
 const s=add(base(),250,9);const raw=JSON.parse(JSON.stringify(s));raw.water[0].ml=99999;
 assert.equal(validateWorkspace(raw).water[0].ml,250);
 assert.deepEqual(cleanSips([{id:'a1',at:'08:00',ml:200,via:'telegram',extra:1}]),[{id:'a1',at:'08:00',ml:200,via:'telegram'}]);
 for(const bad of ['x',[{id:'a',at:'25:00',ml:200,via:'web'}],[{id:'a',at:'08:00',ml:0,via:'web'}],[{id:'a b',at:'08:00',ml:200,via:'web'}],Array.from({length:81},(_,i)=>({id:'s'+i,at:'08:00',ml:10,via:'web'}))])assert.throws(()=>cleanSips(bad),/água/i);
 assert.throws(()=>applyCommand(s,{type:'upsert',collection:'water',item:{title:'Água',sips:[]}},TODAY),/data/);});

test('ritmo: meta distribuída entre acordar e dormir',()=>{
 const p={waketime:'07:00',bedtime:'23:00'};
 assert.equal(expectedBy(2400,p,6*60),0);assert.equal(expectedBy(2400,p,7*60),0);
 assert.equal(expectedBy(2400,p,15*60),1200);assert.equal(expectedBy(2400,p,23*60),2400);assert.equal(expectedBy(2400,p,23*60+30),2400);
 assert.equal(expectedBy(2400,{waketime:'08:00',bedtime:'00:30'},23*60+59),2300);});

test('ritmo: meta batida, adiantado, no ritmo e atrás (15% da meta, mínimo 300 ml)',()=>{
 assert.equal(paceOf(2500,2400,1200),'done');assert.equal(paceOf(1500,2400,1200),'ahead');assert.equal(paceOf(1300,2400,1200),'on');
 assert.equal(paceOf(900,2400,1200),'on');assert.equal(paceOf(840,2400,1200),'behind');assert.equal(paceOf(0,1600,290),'on');assert.equal(paceOf(0,1600,300),'behind');});

test('mensagens: registra água com volume, copos, garrafas, litros e "+"',()=>{
 const cases={'bebi 500 ml':500,'Bebi 500ml de água':500,'tomei 2 copos de água':500,'meio litro de água':500,'+300 ml':300,'+300':300,'1 garrafa':500,'uma garrafa de agua':500,
  'bebi 1,5 l':1500,'tomei 2 litros de água':2000,'água 300 ml':300,'bebi um copo':250,'bebi uma caneca de água':350,'2 copos de 300 ml':600,'1 garrafa de 1,5 L':1500,'garrafinha':500,'Bebi 1 litro!':1000,'tomei três copos d\'água':750,'100 ml':100,'meio copo':125,'um litro e meio de água':1500,'bebi 2 litros e meio':2500};
 for(const [text,ml] of Object.entries(cases))assert.deepEqual(parseWater(text),{kind:'add',ml},text);});

test('mensagens: consulta, desfazer e o que não é água',()=>{
 for(const t of ['água','Agua?','quanto de água hoje?','minha água'])assert.deepEqual(parseWater(t),{kind:'status'},t);
 for(const t of ['desfazer água','apagar última água','cancelar a ultima agua'])assert.deepEqual(parseWater(t),{kind:'undo'},t);
 for(const t of ['bebi um copo de suco','tomei 2 cafés','bebi 600 ml de cerveja','tomei um copo de leite','comprei 2 garrafas de água por R$ 10','reunião às 15h','gastei 500 no mercado','bebi 5 litros de água','tomei 4 l','/start','paguei 300','10 ml de xarope','tomei 1 litro e meio de suco',''.padEnd(300,'a')])assert.equal(parseWater(t),null,t);});

test('textos: resumo do dia, gole somado e meta batida',()=>{
 let s=add(base(),900,10);
 assert.equal(waterSummary(s,TODAY),'Hoje: 0,9 de 2 L (45%). Faltam 1,1 L.');
 assert.equal(waterAddedText(s,TODAY,500),'💧 +500 ml. Hoje: 1,4 de 2 L (70%). Faltam 600 ml.');
 assert.equal(waterAddedText(s,TODAY,1100),'💧 +1,1 L. Meta do dia batida: 2 de 2 L. 🎉');
 assert.equal(waterSummary(base(),TODAY),'Hoje: 0 de 2 L (0%). Faltam 2 L.');
 assert.equal(fmtMl(50),'50 ml');assert.equal(fmtMl(1000),'1 L');assert.equal(fmtMl(1250),'1,25 L');});

test('lembrete: só ligado, atrás do ritmo, dentro da janela, 2 h de intervalo e até 4 por dia',()=>{
 const on=s=>applyCommand(s,{type:'profile',profile:{waterReminders:true}},TODAY);
 let s=base();assert.equal(reminderDue(s,TODAY,15*60),null);assert.deepEqual(behindNow(s,TODAY,15*60),{goal:2000,total:0,expected:1000});assert.equal(behindNow(s,TODAY,7*60+30),null);
 s=on(s);const due=reminderDue(s,TODAY,15*60);assert.deepEqual(due,{goal:2000,total:0,expected:1000});
 assert.equal(reminderDue(s,TODAY,7*60+59),null);assert.equal(reminderDue(s,TODAY,22*60+1),null);assert.ok(reminderDue(s,TODAY,8*60+30)===null,'atraso pequeno no começo do dia');
 const ok=add(s,900,14);assert.equal(reminderDue(ok,TODAY,15*60),null);
 let r=applyCommand(s,{type:'water',action:'reminded'},TODAY,AT(15));assert.equal(waterDay(r,TODAY).reminded,1);assert.equal(waterDay(r,TODAY).remindedAt,'15:00');
 // Na Hobby o cron roda em algum momento dentro da hora: o intervalo conta rodadas de hora, não minutos.
 assert.equal(reminderDue(r,TODAY,16*60),null);assert.equal(reminderDue(r,TODAY,16*60+59),null);assert.ok(reminderDue(r,TODAY,17*60));
 for(const h of [17,19])r=applyCommand(r,{type:'water',action:'reminded'},TODAY,AT(h));r=applyCommand(r,{type:'water',action:'reminded'},TODAY,AT(21));
 assert.equal(waterDay(r,TODAY).reminded,4);assert.equal(reminderDue(r,TODAY,22*60),null);});

test('lembrete: texto, botões e resposta pelo 1/2 registram o gole',()=>{
 assert.equal(reminderText(600,2400,1200),'💧 Pausa para a água: 600 ml de 2,4 L. Uma garrafa agora te coloca no ritmo.');
 assert.equal(reminderText(900,2400,1200),'💧 Pausa para a água: 900 ml de 2,4 L. Um copo agora te coloca no ritmo.');
 assert.deepEqual(waterButtons,{inline_keyboard:[[{text:'Bebi 250 ml',callback_data:'wt:250'},{text:'Bebi 500 ml',callback_data:'wt:500'}]]});
 assert.deepEqual(parseWaterCallback('wt:500'),{ml:500});for(const d of ['wt:5000','wt:abc','wt:','add:x'])assert.equal(parseWaterCallback(d),null,d);
 const s=base(),r=resolveChoice('wt:250',s,{},AT(15));
 assert.deepEqual(r.command,{type:'water',action:'add',ml:250,via:'reminder'});assert.equal(r.ack,'Registrado!');assert.match(r.reply,/^💧 \+250 ml\. Hoje: 0,25 de 2 L/);});

test('canais: registra, consulta e desfaz pela conversa, com resposta pronta',async()=>{
 let state=base();const calls=[];const deps={load:async()=>({state}),mutate:async(_u,c)=>{calls.push(c);state=applyCommand(state,c,TODAY,AT(10));return {state};},now:AT(10)};
 assert.equal(await waterChat(deps,'u',{kind:'add',ml:500},'whatsapp'),'💧 +500 ml. Hoje: 0,5 de 2 L (25%). Faltam 1,5 L.');
 assert.deepEqual(calls[0],{type:'water',action:'add',ml:500,via:'whatsapp'});
 assert.equal(await waterChat(deps,'u',{kind:'status'},'telegram'),'💧 Hoje: 0,5 de 2 L (25%). Faltam 1,5 L.');
 assert.equal(await waterChat(deps,'u',{kind:'undo'},'telegram'),'Último registro de água desfeito (500 ml). Hoje: 0 de 2 L (0%). Faltam 2 L.');
 assert.equal(await waterChat(deps,'u',{kind:'undo'},'telegram'),'Você ainda não registrou água hoje.');
 const broken={...deps,mutate:async()=>{throw new Error('db');}};assert.equal(await waterChat(broken,'u',{kind:'add',ml:250},'telegram'),'Não foi possível registrar agora. Tente de novo.');});

test('cron: envia só para quem está atrasado, em todos os canais, e marca o lembrete',async()=>{
 const on=applyCommand(base(),{type:'profile',profile:{waterReminders:true}},TODAY),states={a:on,b:base(),c:add(on,1500,9)};const sent=[];
 const deps={links:async()=>[{chatId:'1',userId:'a'},{chatId:'wa:x@s',userId:'a'},{chatId:'2',userId:'b'},{chatId:'3',userId:'c'}],load:async u=>({state:states[u]}),
  mutate:async(u,c)=>{states[u]=applyCommand(states[u],c,TODAY,AT(15));},send:async(chatId,text,markup)=>{sent.push([chatId,text,markup]);},now:AT(15)};
 assert.deepEqual(await sendWaterReminders(deps),{checked:3,sent:2,failed:0});
 assert.deepEqual(sent.map(x=>x[0]),['1','wa:x@s']);assert.equal(sent[0][2],waterButtons);assert.equal(waterDay(states.a,TODAY).reminded,1);
 assert.deepEqual(await sendWaterReminders(deps),{checked:3,sent:0,failed:0});});

test('semana, sequência e dica do dia',()=>{
 let s=base();for(const [d,ml] of [['2026-10-20',2100],['2026-10-21',2000],['2026-10-22',1200],[TODAY,2000]])s=applyCommand(s,{type:'water',action:'add',ml:Math.min(ml,3000),date:d},TODAY,AT(9));
 const w=waterWeek(s,TODAY);assert.equal(w.length,7);assert.equal(w.at(-1).date,TODAY);assert.deepEqual(w.slice(-4).map(x=>[x.ml,x.hit]),[[2100,true],[2000,true],[1200,false],[2000,true]]);
 assert.equal(waterStreak(s,TODAY),1);s=applyCommand(s,{type:'water',action:'add',ml:900,date:'2026-10-22'},TODAY,AT(9));assert.equal(waterStreak(s,TODAY),4);
 assert.ok(TIPS.length>=7);assert.equal(tipOf(TODAY),tipOf(TODAY));assert.notEqual(tipOf('2026-10-23'),tipOf('2026-10-24'));});

test('histórico: cada dia guarda a meta da época; mudar a meta não reescreve os dias passados',()=>{
 let s=applyCommand(base(),{type:'water',action:'add',ml:2100,date:'2026-10-22'},TODAY,AT(9));assert.equal(waterDay(s,'2026-10-22').goal,2000);
 s=applyCommand(s,{type:'profile',profile:{waterGoal:3000}},TODAY);
 const w=waterWeek(s,TODAY);assert.deepEqual([w.at(-2).goal,w.at(-2).hit],[2000,true]);assert.equal(w.at(-1).goal,3000);assert.equal(waterStreak(s,TODAY),1);
 s=add(s,500,10);assert.equal(waterDay(s,TODAY).goal,3000);});

test('fuso: minutos do dia no fuso do perfil',()=>{assert.equal(minutesInZone('America/Sao_Paulo',AT(14,30)),14*60+30);assert.equal(minutesInZone('UTC',AT(14,30)),17*60+30);});
