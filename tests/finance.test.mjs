import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,applyCommand,validateItem,upgradeWorkspace,validateWorkspace,formatMoney as coreMoney} from '../lib/core.ts';
import {formatMoney,categoryInfo,EXPENSE_CATEGORIES,INCOME_CATEGORIES,capState,capPct,shiftYm} from '../lib/finance.ts';
const T='2026-10-18';
const up=(s,collection,item)=>applyCommand(s,{type:'upsert',collection,item},T);

test('categorias: lista, antigas e vazias',()=>{
 assert.deepEqual(EXPENSE_CATEGORIES,['Moradia','Alimentação','Mercado','Transporte','Saúde','Educação','Lazer','Contas','Compras','Assinaturas','Outros']);
 assert.deepEqual(INCOME_CATEGORIES,['Salário','Renda extra','Outras receitas']);
 assert.deepEqual(categoryInfo('Mercado'),{name:'Mercado',kind:'expense',icon:'cart',color:'#a77b61',known:true});
 assert.deepEqual(categoryInfo('Viagem'),{name:'Viagem',kind:'expense',icon:'ellipsis',color:'#9aa39b',known:false});
 assert.deepEqual([categoryInfo('').name,categoryInfo('').known,categoryInfo(undefined).name,categoryInfo('  ').name],['Outros',true,'Outros','Outros']);
 assert.equal(categoryInfo('Salário').kind,'income');});
test('formatMoney mudou de arquivo e o core continua exportando',()=>{assert.equal(formatMoney(3590),'R$ 35,90');assert.equal(coreMoney(3590),'R$ 35,90');});
test('situação e percentual do teto',()=>{
 assert.deepEqual([capState(100,0),capState(84,100),capState(85,100),capState(100,100),capState(101,100)],['none','ok','near','near','over']);
 assert.deepEqual([capPct(50,0),capPct(1075,1000),capPct(1,3)],[0,108,33]);});
test('meses atravessam o ano',()=>{assert.deepEqual([shiftYm('2026-12',1),shiftYm('2027-01',-1),shiftYm('2026-10',-12)],['2027-01','2026-12','2025-10']);});
test('forma de pagamento: valores válidos e cartão vira crédito',()=>{const base={title:'Almoço',amount:3590,direction:'expense',date:T};
 assert.equal(validateItem('transactions',{...base,payment:'pix'}).payment,'pix');
 assert.throws(()=>validateItem('transactions',{...base,payment:'boleto'}),/Forma de pagamento inválida/);
 assert.equal(validateItem('transactions',{...base,payment:'pix',cardId:'c1'}).payment,'credit');
 assert.equal(validateItem('transactions',{...base,cardId:'c1'}).payment,'credit');
 assert.equal(validateItem('transactions',base).payment,undefined);
 assert.equal(up(emptyWorkspace('Geo'),'transactions',{...base,id:'t1',payment:'cash'}).transactions[0].payment,'cash');});
test('tetos por categoria: mescla, zero remove e valores inválidos',()=>{let s=emptyWorkspace('Geo');assert.deepEqual(s.profile.categoryBudgets,{});
 s=applyCommand(s,{type:'profile',profile:{categoryBudgets:{Moradia:150000,Lazer:30000}}},T);
 s=applyCommand(s,{type:'profile',profile:{categoryBudgets:{Lazer:0,Mercado:80000}}},T);
 assert.deepEqual(s.profile.categoryBudgets,{Moradia:150000,Mercado:80000});
 s=applyCommand(s,{type:'profile',profile:{budget:300000}},T);assert.deepEqual(s.profile.categoryBudgets,{Moradia:150000,Mercado:80000});
 for(const bad of [{Salário:1000},{Lazer:10.5},{Lazer:-1},[1],null,'x'])assert.throws(()=>applyCommand(s,{type:'profile',profile:{categoryBudgets:bad}},T),/Configuração inválida/);});
test('espaço antigo: Casa vira Moradia e ganha tetos vazios',()=>{const old=emptyWorkspace('Geo');delete old.profile.categoryBudgets;
 old.transactions=[{id:'t1',title:'Aluguel',amount:150000,direction:'expense',date:T,category:'Casa'},{id:'t2',title:'Feira',amount:5000,direction:'expense',date:T,category:'Mercado'}];
 old.bills=[{id:'b1',title:'Condomínio',amount:60000,day:10,category:'Casa'}];
 const u=upgradeWorkspace(structuredClone(old));assert.deepEqual(u.transactions.map(x=>x.category),['Moradia','Mercado']);assert.equal(u.bills[0].category,'Moradia');assert.deepEqual(u.profile.categoryBudgets,{});
 assert.deepEqual(upgradeWorkspace(structuredClone(u)).transactions.map(x=>x.category),['Moradia','Mercado']);
 assert.equal(old.transactions[0].category,'Casa');
 assert.doesNotThrow(()=>validateWorkspace(structuredClone(old)));});
