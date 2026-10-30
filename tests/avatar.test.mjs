import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, upgradeWorkspace, applyCommand } from '../lib/core.ts';
import { lookFromAnalysis, SCENES } from '../lib/avatar.ts';

const analysis={face:true,skin:'#C48B68',hair:'#302c28',style:'cacheado',cut:'careca',beard:true,glasses:true,earrings:true};
test('foto sem rosto não muda o avatar',()=>{assert.equal(lookFromAnalysis({...analysis,face:false},'male'),null);assert.equal(lookFromAnalysis(null,'female'),null);});
test('no masculino a foto define corte, barba e óculos, sem penteado nem brincos',()=>{assert.deepEqual(lookFromAnalysis(analysis,'male'),{glasses:true,skin:'#c48b68',hair:'#302c28',cut:'careca',beard:true});
 assert.deepEqual(lookFromAnalysis({...analysis,beard:false,glasses:false},''),{glasses:false,skin:'#c48b68',hair:'#302c28',cut:'careca',beard:false});});
test('no feminino a foto define penteado, brincos e óculos, sem corte nem barba',()=>{assert.deepEqual(lookFromAnalysis(analysis,'female'),{glasses:true,skin:'#c48b68',hair:'#302c28',style:'cacheado',earrings:true});});
test('cores e opções inválidas da IA ficam de fora',()=>{assert.deepEqual(lookFromAnalysis({...analysis,skin:'bege',hair:'#12345',cut:'moicano'},'male'),{glasses:true,beard:true});
 assert.deepEqual(lookFromAnalysis({...analysis,style:'trança',earrings:'sim'},'female'),{glasses:true,skin:'#c48b68',hair:'#302c28',earrings:false});});
test('avatar tem óculos e cenário: padrão sem óculos no quarto, e só cenários conhecidos',()=>{const s0=emptyWorkspace('Geo');assert.deepEqual([s0.profile.avatar.glasses,s0.profile.avatar.scene],[false,'quarto']);
 const old=emptyWorkspace('Geo');delete old.profile.avatar.glasses;delete old.profile.avatar.scene;const up=upgradeWorkspace({...old});assert.deepEqual([up.profile.avatar.glasses,up.profile.avatar.scene],[false,'quarto']);
 let s=applyCommand(emptyWorkspace('Geo'),{type:'profile',profile:{avatar:{glasses:true,scene:'praia',cut:'careca'}}},'2026-10-30');assert.deepEqual([s.profile.avatar.glasses,s.profile.avatar.scene,s.profile.avatar.cut],[true,'praia','careca']);
 s=applyCommand(s,{type:'profile',profile:{avatar:{glasses:'sim',scene:'lua'}}},'2026-10-30');assert.deepEqual([s.profile.avatar.glasses,s.profile.avatar.scene],[true,'praia']);
 assert.deepEqual(SCENES.map(([id])=>id),['quarto','parque','academia','praia','escritorio']);});
