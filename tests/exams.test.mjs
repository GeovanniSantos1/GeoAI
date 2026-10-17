import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryFileStore } from '../lib/exam-files.ts';
import { emptyWorkspace, applyCommand } from '../lib/core.ts';
import { createExamFromFile, createExamManual, reviewExam, deleteExam, readExamFile, UNREADABLE, REVIEW_UNAVAILABLE } from '../lib/exam-service.ts';

const PDF=new TextEncoder().encode('%PDF-1.4 laudo');
function harness({userId='user_1',extract=async()=>({date:'2026-10-02',lab:'Lab Teste',markers:[{key:'testosterona_total',label:'Testosterona total',value:312,unit:'ng/dL',refMin:249,refMax:836},{key:'hematocrito',label:'Hematócrito',value:'x'}]}),review=async()=>({overall:'ok',summary:'Valores dentro das faixas.',points:[],tips:['Durma bem.'],model:'teste'}),quota=()=>true,files=memoryFileStore(),state=emptyWorkspace('Geo')}={}){
 const box={state,used:[]};
 const deps={userId,now:()=>new Date('2026-10-16T15:00:00Z'),files,extract,review,quota:async(kind,day)=>{box.used.push(kind+':'+day);return quota(kind);},load:async()=>({state:box.state}),mutate:async c=>{box.state=applyCommand(box.state,c,'2026-10-16');return {state:box.state,version:1};}};
 return {deps,box,files};}

test('armazenamento em memória guarda, lê e apaga por caminho e prefixo',async()=>{const f=memoryFileStore();const data=new Uint8Array([1,2,3]);
 await f.save('exames/u1/a.pdf',data,'application/pdf');await f.save('exames/u1/b.pdf',data,'application/pdf');await f.save('exames/u2/c.pdf',data,'application/pdf');
 assert.equal((await f.read('exames/u1/a.pdf')).contentType,'application/pdf');
 await f.remove(['exames/u1/a.pdf']);assert.equal(await f.read('exames/u1/a.pdf'),null);
 await f.removePrefix('exames/u1/');assert.equal(await f.read('exames/u1/b.pdf'),null);assert.ok(await f.read('exames/u2/c.pdf'));});

test('envio guarda o arquivo, lê os valores e cria o rascunho',async()=>{const {deps,files,box}=harness();const r=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 assert.equal(r.exam.status,'draft');assert.equal(r.exam.date,'2026-10-02');assert.equal(r.exam.lab,'Lab Teste');assert.equal(r.exam.markers.length,1);assert.equal(r.warning,undefined);
 assert.match(r.exam.file.path,/^exames\/user_1\/[\w-]+\.pdf$/);assert.ok(await files.read(r.exam.file.path));assert.deepEqual(box.used,['exam_upload:2026-10-16']);});
test('laudo ilegível vira rascunho com arquivo e aviso',async()=>{const {deps}=harness({extract:async()=>{throw new Error('timeout');}});const r=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 assert.equal(r.warning,UNREADABLE);assert.deepEqual(r.exam.markers,[]);assert.equal(r.exam.date,'2026-10-16');assert.ok(r.exam.file);});
test('recusa tipo, tamanho, cota e armazenamento ausente',async()=>{
 await assert.rejects(createExamFromFile(harness().deps,{bytes:new TextEncoder().encode('MZ executável'),name:'x.pdf'}),{status:415});
 await assert.rejects(createExamFromFile(harness().deps,{bytes:new Uint8Array(4*1024*1024+1).fill(37),name:'x.pdf'}),{status:413});
 await assert.rejects(createExamFromFile(harness({quota:()=>false}).deps,{bytes:PDF,name:'x.pdf'}),{status:429});
 await assert.rejects(createExamFromFile(harness({files:null}).deps,{bytes:PDF,name:'x.pdf'}),{status:503});});
test('parecer usa os valores conferidos, nunca rebaixa a situação e respeita a cota',async()=>{const {deps,box}=harness();const {exam}=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 const r=await reviewExam(deps,exam.id,{date:'2026-10-02',lab:'',markers:[{key:'testosterona_total',label:'Testosterona total',value:312,unit:'ng/dL',refMin:249,refMax:836},{key:'hematocrito',label:'Hematócrito',value:55,unit:'%',refMin:40,refMax:50}]});
 assert.equal(r.exam.status,'reviewed');assert.equal(r.exam.review.overall,'doctor');assert.equal(r.exam.review.model,'teste');assert.equal(r.exam.lab,undefined);assert.equal(r.exam.markers[1].value,55);assert.ok(box.used.includes('exam_review:2026-10-16'));
 const limited=harness({quota:k=>k!=='exam_review',state:box.state});const again=await reviewExam(limited.deps,exam.id,{date:'2026-10-02',markers:[{key:'testosterona_total',label:'Testosterona total',value:300}]});
 assert.match(again.warning,/limite de pareceres/);assert.equal(again.exam.review,undefined);});
test('parecer indisponível salva a classificação e avisa; dados inválidos são recusados',async()=>{const {deps}=harness({review:async()=>{throw new Error('500');}});const {exam}=await createExamManual(deps);
 const r=await reviewExam(deps,exam.id,{date:'2026-10-01',markers:[{key:'shbg',label:'SHBG',value:30}]});assert.equal(r.warning,REVIEW_UNAVAILABLE);assert.equal(r.exam.status,'reviewed');
 await assert.rejects(reviewExam(deps,exam.id,{date:'2026-10-20',markers:[{key:'shbg',label:'SHBG',value:30}]}),/data da coleta/);
 await assert.rejects(reviewExam(deps,exam.id,{date:'2026-10-01',markers:[]}),/pelo menos um marcador/);
 await assert.rejects(reviewExam(deps,'nao-existe',{date:'2026-10-01',markers:[{key:'shbg',label:'SHBG',value:30}]}),{status:404});});
test('arquivo só abre para o dono e some ao excluir o exame',async()=>{const files=memoryFileStore();const {deps,box}=harness({files});const {exam}=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 const f=await readExamFile(deps,exam.id);assert.equal(f.contentType,'application/pdf');assert.equal(f.name,'laudo.pdf');
 await assert.rejects(readExamFile(harness({userId:'user_2',files}).deps,exam.id),{status:404});
 const forged=structuredClone(box.state);forged.labExams[0].file.path='exames/user_9/roubado.pdf';await files.save('exames/user_9/roubado.pdf',PDF,'application/pdf');
 await assert.rejects(readExamFile(harness({files,state:forged}).deps,exam.id),{status:404});
 await deleteExam(deps,exam.id);assert.equal(box.state.labExams.length,0);assert.equal(await files.read(exam.file.path),null);});
test('excluir exame com caminho forjado não apaga arquivo de outra conta',async()=>{const files=memoryFileStore();const {deps,box}=harness({files});const {exam}=await createExamFromFile(deps,{bytes:PDF,name:'laudo.pdf'});
 await files.save('exames/user_9/alvo.pdf',PDF,'application/pdf');const forged=structuredClone(box.state);forged.labExams[0].file.path='exames/user_9/alvo.pdf';const h=harness({files,state:forged});
 await deleteExam(h.deps,exam.id);assert.equal(h.box.state.labExams.length,0);assert.ok(await files.read('exames/user_9/alvo.pdf'));});
