import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHECK_MS,IDLE_MS,MIN_GAP_MS,shouldCheck,wokeUp,isNewer,parseSince} from '../lib/live-sync.ts';

const NOW=1_800_000_000_000;
const base={visible:true,busy:false,now:NOW,lastActivity:NOW-1000,lastCheck:NOW-CHECK_MS};

test('intervalos: confere a cada 10 s e pausa após 10 min sem uso',()=>{
 assert.equal(CHECK_MS,10_000);assert.equal(IDLE_MS,10*60_000);assert.ok(MIN_GAP_MS<CHECK_MS);});

test('confere com a aba visível, em uso e sem gravação em andamento',()=>{
 assert.equal(shouldCheck(base),true);
 assert.equal(shouldCheck({...base,lastCheck:0}),true);});

test('não confere com a aba escondida nem durante uma gravação',()=>{
 assert.equal(shouldCheck({...base,visible:false}),false);
 assert.equal(shouldCheck({...base,busy:true}),false);});

test('pausa depois de 10 min sem mouse, teclado ou toque',()=>{
 assert.equal(shouldCheck({...base,lastActivity:NOW-IDLE_MS+1}),true);
 assert.equal(shouldCheck({...base,lastActivity:NOW-IDLE_MS}),false);
 assert.equal(shouldCheck({...base,lastActivity:NOW-3*IDLE_MS}),false);});

test('não repete a conferência em menos de 2 s (foco e visibilidade chegam juntos)',()=>{
 assert.equal(shouldCheck({...base,lastCheck:NOW-MIN_GAP_MS+1}),false);
 assert.equal(shouldCheck({...base,lastCheck:NOW-MIN_GAP_MS}),true);});

test('uma interação depois de um tempo parado confere na hora',()=>{
 assert.equal(wokeUp(NOW,NOW-IDLE_MS),true);
 assert.equal(wokeUp(NOW,NOW-IDLE_MS+1),false);
 assert.equal(wokeUp(NOW,NOW-5),false);});

test('só aplica um espaço mais novo que o da tela',()=>{
 assert.equal(isNewer(8,7),true);
 assert.equal(isNewer(7,7),false);
 assert.equal(isNewer(6,7),false);
 assert.equal(isNewer(Number.NaN,7),false);
 assert.equal(isNewer(1.5,1),false);});

test('since: aceita só inteiro não negativo',()=>{
 assert.equal(parseSince('0'),0);
 assert.equal(parseSince('42'),42);
 for(const bad of [null,'','-1','1.5','abc','1e3',' 4','9'.repeat(20)])assert.equal(parseSince(bad),null,String(bad));});
