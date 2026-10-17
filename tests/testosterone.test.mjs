import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, validateItem, validateWorkspace, applyCommand, upgradeWorkspace } from '../lib/core.ts';

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
