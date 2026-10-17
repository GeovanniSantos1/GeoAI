import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, validateItem, validateWorkspace, applyCommand, upgradeWorkspace, scheduledItems, isComplete } from '../lib/core.ts';
const protocol={id:'p1',title:'Durateston',dose:250,unit:'mg',intervalDays:14,startDate:'2026-09-01',status:'active',remind:true};

test('valida exames com marcadores, parecer e arquivo',()=>{const e=validateItem('labExams',{title:'Exame de 02/10/2026',date:'2026-10-02',markers:[{key:'testosterona_total',label:'Testosterona total',value:312,unit:'ng/dL',refMin:249,refMax:836},{key:'xyz',label:'Ferritina',value:80}],file:{path:'exames/user_1/e1-ab.pdf',name:'laudo.pdf',type:'application/pdf',size:1200},review:{overall:'ok',summary:'Tudo certo.',points:[],tips:['Durma bem.'],reviewedAt:'2026-10-02T10:00:00Z',model:'gpt-6-luna'}});assert.equal(e.status,'draft');assert.equal(e.markers[1].key,'outro');assert.equal(e.file.path,'exames/user_1/e1-ab.pdf');assert.equal(e.review.tips[0],'Durma bem.');});
test('recusa marcadores, arquivos e pareceres inválidos',()=>{
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',markers:[{key:'psa_total',label:'PSA',value:'alto'}]}),/Valor inválido/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',markers:[{key:'psa_total',label:'PSA',value:1,refMin:5,refMax:2}]}),/Faixa invertida/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',markers:Array.from({length:81},(_,i)=>({key:'outro',label:'M'+i,value:1}))}),/até 80/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',file:{path:'../outro/x.pdf',name:'x.pdf',type:'application/pdf',size:10}}),/Arquivo inválido/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',file:{path:'exames/u/x.exe',name:'x.exe',type:'application/x-msdownload',size:10}}),/Tipo de arquivo/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',review:{overall:'great',summary:'x',points:[],tips:[],reviewedAt:'2026-10-02T10:00:00Z',model:'m'}}),/Situação do parecer/);
 assert.throws(()=>validateItem('labExams',{title:'E',date:'2026-10-02',status:'final'}),/Situação do exame/);
 assert.throws(()=>validateItem('labExams',{title:'E'}),/data/);});
test('valida protocolos e aplicações',()=>{const p=validateItem('trtProtocols',{...protocol,unit:undefined,status:undefined});assert.equal(p.unit,'mg');assert.equal(p.status,'active');assert.equal(p.remind,true);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,intervalDays:0}),/intervalo/);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,dose:0}),/dose/);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,remind:'sim'}),/inválido/);
 assert.throws(()=>validateItem('trtProtocols',{...protocol,startDate:undefined}),/início/);
 assert.equal(validateItem('trtDoses',{title:'Aplicação',date:'2026-10-02',protocolId:'p1',dose:250,site:'Glúteo'}).site,'Glúteo');
 assert.throws(()=>validateItem('trtDoses',{title:'Aplicação',date:'2026-10-02'}),/protocolo/);});
test('patch altera só os campos enviados e incrementa a revisão',()=>{let s=emptyWorkspace('Geo');s=applyCommand(s,{type:'upsert',collection:'trtProtocols',item:protocol},'2026-10-16');s=applyCommand(s,{type:'patch',collection:'trtProtocols',id:'p1',item:{remindedOn:'2026-10-16'}},'2026-10-16');
 assert.equal(s.trtProtocols[0].remindedOn,'2026-10-16');assert.equal(s.trtProtocols[0].dose,250);assert.equal(s.trtProtocols[0]._rev,2);
 assert.throws(()=>applyCommand(s,{type:'patch',collection:'trtProtocols',id:'nao',item:{}},'2026-10-16'),/não encontrado/);
 assert.throws(()=>applyCommand(s,{type:'patch',collection:'trtProtocols',id:'p1',item:{intervalDays:500}},'2026-10-16'),/intervalo/);});
test('espaços antigos sem as coleções novas carregam e restauram',()=>{const old=emptyWorkspace('Geo');delete old.labExams;delete old.trtProtocols;delete old.trtDoses;
 const up=upgradeWorkspace(structuredClone(old));assert.deepEqual([up.labExams,up.trtProtocols,up.trtDoses],[[],[],[]]);
 assert.deepEqual(validateWorkspace(structuredClone(old)).trtDoses,[]);
 const broken=emptyWorkspace('Geo');delete broken.tasks;assert.throws(()=>validateWorkspace(broken),/Backup não reconhecido/);});

import { classifyMarker, criticalFlags, codeOverall, mergeOverall, finalOverall, parseDecimal, protocolStatus, punctuality, cycleDay, dueReminder, guardStateCommand, detectFileType, reviewContext, examTitle, doseId } from '../lib/testosterone.ts';
const m=(key,value,extra={})=>({key,label:key,value,...extra});

test('classifica pelo número e pela faixa do laudo',()=>{
 assert.equal(classifyMarker(m('testosterona_total',240,{refMin:249,refMax:836})),'low');
 assert.equal(classifyMarker(m('testosterona_total',900,{refMin:249,refMax:836})),'high');
 assert.equal(classifyMarker(m('testosterona_total',500,{refMin:249,refMax:836})),'normal');
 assert.equal(classifyMarker(m('outro',5)),'none');
 assert.equal(classifyMarker(m('psa_total',0.01,{qualifier:'<',refMax:4})),'normal');
 assert.equal(classifyMarker(m('vitamina_d',20,{qualifier:'<',refMin:20})),'low');
 assert.equal(classifyMarker(m('prolactina',30,{qualifier:'>',refMax:30})),'high');
 assert.equal(classifyMarker(m('vitamina_d',35,{refMin:30})),'normal');});
test('alertas críticos de hematócrito e PSA',()=>{
 assert.deepEqual(criticalFlags({date:'2026-10-02',markers:[m('hematocrito',53.9,{unit:'%'})]},[]),[]);
 assert.equal(criticalFlags({date:'2026-10-02',markers:[m('hematocrito',54,{unit:'%'})]},[]).length,1);
 assert.equal(criticalFlags({date:'2026-10-02',markers:[m('psa_total',4.5,{unit:'ng/mL',refMax:4})]},[]).length,1);
 const old=[{id:'a',title:'A',status:'reviewed',date:'2026-01-10',markers:[m('psa_total',0.8,{unit:'ng/mL'})]},{id:'b',title:'B',status:'reviewed',date:'2025-06-01',markers:[m('psa_total',0.1,{unit:'ng/mL'})]},{id:'c',title:'C',status:'draft',date:'2026-05-01',markers:[m('psa_total',0.2,{unit:'ng/mL'})]}];
 assert.match(criticalFlags({date:'2026-10-02',markers:[m('psa_total',2.3,{unit:'ng/mL',refMax:4})]},old)[0],/subiu 1,5/);
 assert.deepEqual(criticalFlags({date:'2026-10-02',markers:[m('psa_total',2.2,{unit:'ng/mL',refMax:4})]},old),[]);
 assert.deepEqual(criticalFlags({date:'2026-10-02',markers:[m('psa_total',2.1,{unit:'ng/mL',refMax:4})]},old),[]);});
test('situação geral: o código define o piso e a IA não rebaixa',()=>{
 assert.equal(codeOverall([m('shbg',30,{refMin:10,refMax:57})],[]),'ok');
 assert.equal(codeOverall([m('estradiol',50,{refMin:11,refMax:44})],[]),'attention');
 assert.equal(codeOverall([],['x']),'doctor');
 assert.equal(mergeOverall('doctor','ok'),'doctor');assert.equal(mergeOverall('ok','attention'),'attention');
 const exam={id:'e',title:'E',date:'2026-10-02',status:'reviewed',markers:[m('hematocrito',55,{unit:'%',refMin:40,refMax:50})],review:{overall:'ok'}};
 assert.equal(finalOverall(exam,[exam]),'doctor');});
test('lê números no formato brasileiro e com ponto',()=>{assert.equal(parseDecimal('0,85'),0.85);assert.equal(parseDecimal('1.234,5'),1234.5);assert.equal(parseDecimal('0.85'),0.85);assert.equal(parseDecimal(' 312 '),312);assert.equal(parseDecimal('1.050'),1050);assert.equal(parseDecimal('250.000'),250000);assert.equal(parseDecimal('1.05'),1.05);assert.ok(Number.isNaN(parseDecimal('alto')));assert.ok(Number.isNaN(parseDecimal('')));});
test('próxima aplicação, atraso, pontualidade e dia do ciclo',()=>{
 const doses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-09-01'},{id:'d2',title:'A',protocolId:'p1',date:'2026-09-15'},{id:'d3',title:'A',protocolId:'p1',date:'2026-10-01'},{id:'x',title:'A',protocolId:'outro',date:'2026-10-10'}];
 assert.deepEqual(protocolStatus(protocol,[],'2026-08-25'),{next:'2026-09-01',daysLeft:7,overdue:0});
 assert.deepEqual(protocolStatus(protocol,doses,'2026-10-18'),{next:'2026-10-15',daysLeft:0,overdue:3});
 assert.equal(punctuality(protocol,doses,'2026-10-16'),50);
 assert.equal(punctuality(protocol,doses.slice(0,1),'2026-10-16'),null);
 assert.equal(cycleDay(protocol,doses,'2026-10-13'),12);assert.equal(cycleDay(protocol,[],'2026-10-13'),null);
 assert.equal(doseId('p1','2026-10-16'),'dose-p1-2026-10-16');});
test('lembrete: do dia previsto até 3 dias depois, uma vez por dia, com adiamento',()=>{
 const doses=[{id:'d1',title:'A',protocolId:'p1',date:'2026-10-02'}];
 assert.equal(dueReminder(protocol,doses,'2026-10-15'),false);
 assert.equal(dueReminder(protocol,doses,'2026-10-16'),true);
 assert.equal(dueReminder(protocol,doses,'2026-10-19'),true);
 assert.equal(dueReminder(protocol,doses,'2026-10-20'),false);
 assert.equal(dueReminder({...protocol,remindedOn:'2026-10-16'},doses,'2026-10-16'),false);
 assert.equal(dueReminder({...protocol,snoozedUntil:'2026-10-17'},doses,'2026-10-16'),false);
 assert.equal(dueReminder({...protocol,snoozedUntil:'2026-10-17'},doses,'2026-10-17'),true);
 assert.equal(dueReminder({...protocol,status:'paused'},doses,'2026-10-16'),false);
 assert.equal(dueReminder({...protocol,remind:false},doses,'2026-10-16'),false);});
test('/api/state não altera exames e o backup perde arquivos de outra conta',()=>{
 assert.throws(()=>guardStateCommand({type:'upsert',collection:'labExams',item:{}},'user_1'),/menu Testosterona/);
 assert.throws(()=>guardStateCommand({type:'delete',collection:'labExams',id:'e'},'user_1'),/menu Testosterona/);
 assert.throws(()=>guardStateCommand({type:'patch',collection:'labExams',id:'e',item:{}},'user_1'),/Ação não permitida/);assert.throws(()=>guardStateCommand({type:'patch',collection:'trtProtocols',id:'p1',item:{}},'user_1'),/Ação não permitida/);
 assert.throws(()=>guardStateCommand({type:'confirmPlan',items:[{collection:'labExams',item:{}}]},'user_1'),/menu Testosterona/);
 const cmd={type:'upsert',collection:'tasks',item:{title:'x'}};assert.equal(guardStateCommand(cmd,'user_1'),cmd);
 const state={labExams:[{id:'a',title:'A',file:{path:'exames/user_1/a.pdf'}},{id:'b',title:'B',file:{path:'exames/user_2/b.pdf'}},{id:'c',title:'C'}]};
 const out=guardStateCommand({type:'import',state},'user_1');assert.equal(out.state.labExams[0].file.path,'exames/user_1/a.pdf');assert.equal(out.state.labExams[1].file,undefined);assert.equal(out.state.labExams[2].id,'c');});
test('reconhece o tipo do arquivo pelo conteúdo',()=>{const b=s=>new Uint8Array([...s].map(c=>c.charCodeAt(0)));
 assert.equal(detectFileType(b('%PDF-1.4')),'application/pdf');assert.equal(detectFileType(new Uint8Array([0xff,0xd8,0xff,0xe0])),'image/jpeg');assert.equal(detectFileType(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d])),'image/png');assert.equal(detectFileType(b('RIFF0000WEBPVP8 ')),'image/webp');assert.equal(detectFileType(b('MZ\x90\x00')),null);});
test('contexto do parecer traz classificação, alertas, ciclo e histórico',()=>{
 const s={labExams:[{id:'old',title:'Antigo',date:'2026-04-01',status:'reviewed',markers:[m('testosterona_total',280,{unit:'ng/dL'})]}],trtProtocols:[protocol],trtDoses:[{id:'d',title:'A',protocolId:'p1',date:'2026-09-20'}]};
 const ctx=reviewContext({id:'new',date:'2026-10-02',markers:[m('testosterona_total',612,{unit:'ng/dL',refMin:249,refMax:836}),m('hematocrito',55,{unit:'%',refMin:40,refMax:50})]},s);
 assert.equal(ctx.codeOverall,'doctor');assert.match(ctx.text,/testosterona_total.*Normal/);assert.match(ctx.text,/12 dia\(s\) após a última aplicação/);assert.match(ctx.text,/Exame anterior \(2026-04-01\): testosterona_total 280 ng\/dL/);assert.match(ctx.text,/Hematócrito em 55%/);
 assert.equal(examTitle('2026-10-02'),'Exame de 02/10/2026');});
test('agenda mostra a aplicação prevista e marca como feita quando registrada',()=>{let s=emptyWorkspace('Geo');s.trtProtocols=[{...protocol}];
 assert.deepEqual(scheduledItems(s,'2026-09-01').map(x=>[x.title,x._collection,x.type]),[['Aplicação: Durateston','trtProtocols','event']]);
 assert.equal(scheduledItems(s,'2026-09-15').length,0);
 s.trtDoses=[{id:'d1',title:'Aplicação',protocolId:'p1',date:'2026-09-01'}];
 assert.equal(isComplete(s,scheduledItems(s,'2026-09-01')[0],'2026-09-01'),true);
 assert.equal(scheduledItems(s,'2026-09-15').length,1);assert.equal(isComplete(s,scheduledItems(s,'2026-09-15')[0],'2026-09-15'),false);
 s.trtProtocols[0].status='paused';assert.equal(scheduledItems(s,'2026-09-15').length,0);});
test('uma aplicação por protocolo por dia no núcleo',()=>{let s=emptyWorkspace('Geo');s=applyCommand(s,{type:'upsert',collection:'trtProtocols',item:protocol},'2026-10-16');const dose={id:'a',title:'Aplicação',date:'2026-10-16',protocolId:'p1'};s=applyCommand(s,{type:'upsert',collection:'trtDoses',item:dose},'2026-10-16');
 assert.throws(()=>applyCommand(s,{type:'upsert',collection:'trtDoses',item:{...dose,id:'b'}},'2026-10-16'),/Já existe uma aplicação deste protocolo nesta data/);
 s=applyCommand(s,{type:'upsert',collection:'trtDoses',item:{...dose,notes:'editado'}},'2026-10-16');assert.equal(s.trtDoses.length,1);assert.equal(s.trtDoses[0].notes,'editado');
 s=applyCommand(s,{type:'upsert',collection:'trtDoses',item:{...dose,id:'c',date:'2026-10-17'}},'2026-10-17');assert.equal(s.trtDoses.length,2);});
