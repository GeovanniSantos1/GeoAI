import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekRange,focusReport,formatMinutes} from '../lib/focus-report.ts';
test('weekRange: segunda a domingo, termina no máximo hoje, atravessa o mês',()=>{
 assert.deepEqual(weekRange('2026-10-20'),{start:'2026-10-19',end:'2026-10-20',days:['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']});
 assert.deepEqual([weekRange('2026-10-20',-1).start,weekRange('2026-10-20',-1).end],['2026-10-12','2026-10-18']);
 assert.deepEqual([weekRange('2026-11-01').start,weekRange('2026-11-01').end],['2026-10-26','2026-11-01']);});
test('focusReport: totais, interrompidas, foco livre, card excluído e sessões antigas',()=>{
 const cards=[{id:'c1',number:12,title:'Frete',estimate:4}];
 const s=[{id:'1',title:'Frete',date:'2026-10-19',duration:25,boardCardId:'c1',status:'completed',kind:'focus'},{id:'2',title:'Frete',date:'2026-10-20',duration:25,boardCardId:'c1'},
  {id:'3',title:'Ler',date:'2026-10-20',duration:50},{id:'4',title:'x',date:'2026-10-20',duration:10,status:'interrupted',boardCardId:'c1'},{id:'5',title:'Velho',date:'2026-10-20',duration:25,boardCardId:'gone'},{id:'6',title:'Fora',date:'2026-10-26',duration:25}];
 const r=focusReport(s,cards,'2026-10-19','2026-10-25');
 assert.deepEqual([r.total,r.minutes,r.interrupted],[4,125,1]);
 assert.deepEqual(r.byDay.map(d=>[d.date,d.pomodoros,d.minutes]).slice(0,2),[['2026-10-19',1,25],['2026-10-20',3,100]]);assert.equal(r.byDay.length,7);
 assert.deepEqual(r.byCard.map(x=>[x.cardId,x.code,x.title,x.pomodoros,x.minutes,x.estimated]),[['c1','#12','Frete',2,50,4],[null,'','Foco livre',1,50,null],['gone','—','Card excluído',1,25,null]]);
 assert.throws(()=>focusReport(s,cards,'2026-01-01','2026-03-15'),/62 dias/);assert.throws(()=>focusReport(s,cards,'2026-10-20','2026-10-19'),/Período inválido/);});
test('formatMinutes',()=>{assert.deepEqual([formatMinutes(45),formatMinutes(60),formatMinutes(205)],['45 min','1h00','3h25']);});
