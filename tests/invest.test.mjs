import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INVEST_KINDS,kindInfo,modeOf,moveLabel,moveProblem,monthEnd,position,positions,portfolio,incomeInYear,formatRate,formatQty,formatPrice,priceToCents} from '../lib/invest.ts';
const NB=String.fromCharCode(160);
const ev=(id,assetId,move,date,f={})=>({id,title:move,assetId,move,date,...f});
const PETR={id:'p',title:'Petrobras',kind:'acao',ticker:'PETR4'},CDB={id:'c',title:'CDB Banco X',kind:'cdb',indexer:'cdi',rate:110};
const EVENTS=[ev('e1','p','buy','2026-01-10',{quantity:10,amount:30000}),ev('e2','p','buy','2026-02-10',{quantity:10,amount:40000}),ev('e3','p','sell','2026-03-10',{quantity:5,amount:25000}),ev('e4','p','valuation','2026-04-01',{price:4500}),ev('e5','p','dividend','2026-04-15',{amount:1200}),
 ev('c1','c','buy','2026-01-05',{amount:100000}),ev('c2','c','buy','2026-02-05',{amount:50000}),ev('c3','c','valuation','2026-03-01',{amount:160000}),ev('c4','c','sell','2026-03-10',{amount:80000}),ev('c5','c','interest','2026-03-20',{amount:500})];

test('tipos, modos e rótulos dos movimentos',()=>{
 assert.deepEqual(INVEST_KINDS.map(k=>k.id),['cdb','tesouro','lci_lca','acao','fii','etf','cripto','fundo','outro']);
 assert.deepEqual(INVEST_KINDS.filter(k=>k.mode==='quantity').map(k=>k.id),['acao','fii','etf','cripto']);
 assert.equal(kindInfo('xyz').id,'outro');assert.equal(modeOf('fundo'),'value');
 assert.deepEqual([moveLabel('buy','cdb'),moveLabel('buy','acao'),moveLabel('sell','cdb'),moveLabel('sell','fii'),moveLabel('valuation','cdb'),moveLabel('valuation','cripto'),moveLabel('dividend','fii'),moveLabel('interest','cdb')],['Aplicação','Compra','Resgate','Venda','Valor atual','Cotação','Dividendo','Juros']);});
test('exigências de cada movimento pelo modo do ativo',()=>{
 assert.equal(moveProblem({move:'buy',amount:100},'acao'),'Informe a quantidade');
 assert.equal(moveProblem({move:'buy',quantity:1},'acao'),'Informe o valor');
 assert.equal(moveProblem({move:'buy',amount:100},'cdb'),null);
 assert.equal(moveProblem({move:'valuation',amount:100},'acao'),'Informe a cotação');
 assert.equal(moveProblem({move:'valuation',price:100},'cdb'),'Informe o valor atual');
 assert.equal(moveProblem({move:'dividend'},'fii'),'Informe o valor do provento');
 assert.equal(moveProblem({move:'sell',quantity:2,amount:10},'acao'),null);});
test('modo quantidade: compras, venda com preço médio, cotação e proventos',()=>{const p=position(PETR,EVENTS);
 assert.deepEqual({q:p.quantity,inv:p.invested,avg:p.avgPrice,val:p.value,un:p.unrealized,re:p.realized,inc:p.income,pnl:p.pnl,pct:p.pct,price:p.lastPrice,date:p.priceDate,closed:p.closed},{q:15,inv:52500,avg:3500,val:67500,un:15000,re:7500,inc:1200,pnl:23700,pct:28.6,price:4500,date:'2026-04-01',closed:false});});
test('posição no fim de um mês passado',()=>{const p=position(PETR,EVENTS,'2026-02-28');
 assert.deepEqual({q:p.quantity,inv:p.invested,val:p.value,pct:p.pct,date:p.priceDate},{q:20,inv:70000,val:80000,pct:14.3,date:'2026-02-10'});
 assert.equal(position(PETR,EVENTS,'2025-12-31').value,0);});
test('modo valor: aplicações, valor atual e resgate parcial com custo proporcional',()=>{const c=position(CDB,EVENTS);
 assert.deepEqual({inv:c.invested,val:c.value,un:c.unrealized,re:c.realized,inc:c.income,pct:c.pct,date:c.priceDate},{inv:75000,val:80000,un:5000,re:5000,inc:500,pct:6.7,date:'2026-03-01'});});
test('no mesmo dia vale a ordem em que os movimentos foram salvos',()=>{const a={id:'x',title:'X',kind:'acao'};
 const p=position(a,[ev('1','x','buy','2026-05-01',{quantity:2,amount:2000}),ev('2','x','sell','2026-05-01',{quantity:2,amount:2400})]);
 assert.deepEqual({q:p.quantity,re:p.realized,closed:p.closed},{q:0,re:400,closed:true});});
test('venda maior que a posição em dados antigos não deixa nada negativo',()=>{const a={id:'x',title:'X',kind:'acao'};
 const p=position(a,[ev('1','x','buy','2026-05-01',{quantity:5,amount:5000}),ev('2','x','sell','2026-05-02',{quantity:8,amount:9600})]);
 assert.deepEqual({q:p.quantity,inv:p.invested,val:p.value,re:p.realized},{q:0,inv:0,val:0,re:4600});});
test('carteira: totais, alocação na ordem dos tipos e encerradas no fim',()=>{const closed={id:'z',title:'Antiga',kind:'fii'};
 const list=positions([PETR,CDB,closed],[...EVENTS,ev('z1','z','buy','2026-01-02',{quantity:1,amount:1000}),ev('z2','z','sell','2026-01-03',{quantity:1,amount:1100})]);
 assert.deepEqual(list.map(p=>p.asset.id),['c','p','z']);
 const t=portfolio(list);
 assert.deepEqual({inv:t.invested,val:t.value,un:t.unrealized,re:t.realized,inc:t.income,pct:t.pct,count:t.count},{inv:127500,val:147500,un:20000,re:12600,inc:1700,pct:15.7,count:2});
 assert.deepEqual(t.allocation.map(x=>[x.kind,x.value]),[['cdb',80000],['acao',67500]]);
 assert.equal(Math.round(t.allocation[0].share*1000),542);});
test('proventos no ano até a data',()=>{assert.equal(incomeInYear(EVENTS,'2026'),1700);assert.equal(incomeInYear(EVENTS,'2026','2026-04-10'),500);assert.equal(incomeInYear(EVENTS,'2025'),0);});
test('último dia do mês',()=>{assert.deepEqual([monthEnd('2026-02'),monthEnd('2028-02'),monthEnd('2026-12')],['2026-02-28','2028-02-29','2026-12-31']);});
test('taxa, quantidade e cotação formatadas',()=>{
 assert.deepEqual([formatRate({indexer:'cdi',rate:110}),formatRate({indexer:'selic',rate:100}),formatRate({indexer:'ipca',rate:6.5}),formatRate({indexer:'pre',rate:12.5}),formatRate({indexer:'none',rate:5}),formatRate({})],['110% do CDI','100% da Selic','IPCA + 6,5%','12,5% a.a.','','']);
 assert.deepEqual([formatQty(10),formatQty(0.5),formatQty(1234.5),formatQty(0.00012345)],['10','0,5','1.234,5','0,00012345']);
 assert.deepEqual([formatPrice(3850),formatPrice(35000000),formatPrice(0.0123)],['R$'+NB+'38,50','R$'+NB+'350.000,00','R$'+NB+'0,000123']);});
test('cotação digitada vira centavos, com fração para cripto',()=>{
 assert.deepEqual([priceToCents('38,50'),priceToCents('0,000123'),priceToCents('1.234,5'),priceToCents('350.000'),priceToCents('38.5'),priceToCents('R$ 10')],[3850,0.0123,123450,35000000,3850,1000]);
 for(const bad of ['','abc','0','-5'])assert.throws(()=>priceToCents(bad),/Informe uma cotação válida/);});

import {emptyWorkspace,applyCommand,validateItem,upgradeWorkspace,checkInvestmentEvent} from '../lib/core.ts';
const T='2026-10-18';
const up=(s,collection,item)=>applyCommand(s,{type:'upsert',collection,item},T);
function wallet(){let s=emptyWorkspace('Geo');s=up(s,'investments',{id:'p',title:'Petrobras',kind:'acao',ticker:'PETR4'});s=up(s,'investments',{id:'c',title:'CDB Banco X',kind:'cdb',indexer:'cdi',rate:110});
 s=up(s,'investmentEvents',{id:'e1',assetId:'p',move:'buy',date:'2026-10-01',quantity:10,amount:30000});s=up(s,'investmentEvents',{id:'c1',assetId:'c',move:'buy',date:'2026-10-01',amount:100000});return s;}
test('ativo: tipo, código e campos de renda fixa só na renda fixa',()=>{
 const a=validateItem('investments',{title:'Petrobras',kind:'acao',ticker:' petr 4 ',indexer:'cdi',rate:10,dueDate:'2030-01-01'});
 assert.deepEqual([a.ticker,a.indexer,a.rate,a.dueDate],['PETR4',undefined,undefined,undefined]);
 const c=validateItem('investments',{title:'CDB',kind:'cdb',indexer:'cdi',rate:110,dueDate:'2028-05-01'});
 assert.deepEqual([c.indexer,c.rate,c.dueDate],['cdi',110,'2028-05-01']);
 assert.throws(()=>validateItem('investments',{title:'X',kind:'imovel'}),/Tipo de investimento inválido/);
 assert.throws(()=>validateItem('investments',{title:'X',kind:'cdb',indexer:'poupanca'}),/Indexador inválido/);
 assert.throws(()=>validateItem('investments',{title:'X',kind:'acao',ticker:'A'.repeat(17)}),/até 16/);});
test('movimento: título padrão, tipo e ativo obrigatórios',()=>{
 assert.equal(validateItem('investmentEvents',{assetId:'p',move:'dividend',date:T,amount:100}).title,'Dividendo');
 assert.throws(()=>validateItem('investmentEvents',{assetId:'p',move:'gift',date:T}),/Movimento inválido/);
 assert.throws(()=>validateItem('investmentEvents',{move:'buy',date:T,amount:1}),/Selecione um ativo da carteira/);
 assert.throws(()=>validateItem('investmentEvents',{assetId:'p',move:'buy',amount:1}),/Informe a data/);});
test('movimento salvo: ativo existente, data e exigências pelo modo do ativo',()=>{const s=wallet();
 assert.throws(()=>up(s,'investmentEvents',{assetId:'zz',move:'buy',date:T,quantity:1,amount:100}),/Selecione um ativo da carteira/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'buy',date:'2026-10-19',quantity:1,amount:100}),/A data não pode ser futura/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'buy',date:T,amount:100}),/Informe a quantidade/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'valuation',date:T,amount:100}),/Informe a cotação/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'c',move:'valuation',date:T,price:100}),/Informe o valor atual/);
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'dividend',date:T}),/Informe o valor do provento/);
 assert.equal(up(s,'investmentEvents',{assetId:'p',move:'valuation',date:T,price:3850.5}).investmentEvents.length,3);});
test('venda maior que a posição na data',()=>{const s=wallet();
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'sell',date:T,quantity:11,amount:100}),{message:'Você tem só 10 nessa data.'});
 assert.throws(()=>up(s,'investmentEvents',{assetId:'p',move:'sell',date:'2026-09-30',quantity:1,amount:100}),{message:'Você tem só 0 nessa data.'});
 assert.throws(()=>up(s,'investmentEvents',{assetId:'c',move:'sell',date:T,amount:150000}),{message:'O resgate passa do valor da posição (R$'+String.fromCharCode(160)+'1.000,00).'});
 const sold=up(s,'investmentEvents',{id:'e2',assetId:'p',move:'sell',date:T,quantity:10,amount:35000});
 assert.equal(up(sold,'investmentEvents',{id:'e2',assetId:'p',move:'sell',date:T,quantity:10,amount:36000,_rev:1}).investmentEvents.find(x=>x.id==='e2').amount,36000);});
test('ativo novo junto do movimento: cria uma vez e reaproveita por código ou nome',()=>{let s=emptyWorkspace('Geo');
 const cmd={id:'e1',move:'buy',date:T,quantity:10,amount:38000,newAsset:{title:'Petrobras',kind:'acao',ticker:'petr4'}};
 s=up(s,'investmentEvents',cmd);
 assert.deepEqual(s.investments.map(a=>[a.id,a.title,a.ticker]),[['e1-a','Petrobras','PETR4']]);
 assert.equal(s.investmentEvents[0].assetId,'e1-a');assert.equal(s.investmentEvents[0].newAsset,undefined);
 s=up(s,'investmentEvents',{...cmd,_rev:1});assert.deepEqual([s.investments.length,s.investmentEvents.length],[1,1]);
 s=up(s,'investmentEvents',{id:'e2',move:'buy',date:T,quantity:1,amount:3900,newAsset:{title:'Petro',kind:'acao',ticker:'PETR4'}});
 s=up(s,'investmentEvents',{id:'e3',move:'buy',date:T,quantity:1,amount:3900,newAsset:{title:'petrobrás',kind:'acao'}});
 assert.equal(s.investments.length,1);assert.deepEqual(s.investmentEvents.map(x=>x.assetId),['e1-a','e1-a','e1-a']);
 s=up(s,'investmentEvents',{id:'f1',move:'buy',date:T,amount:50000,newAsset:{id:'cdb1',title:'CDB Novo',kind:'cdb',indexer:'cdi',rate:105}});
 assert.deepEqual([s.investments.find(a=>a.id==='cdb1').rate,s.investmentEvents.find(x=>x.id==='f1').assetId],[105,'cdb1']);
 assert.throws(()=>up(s,'investmentEvents',{id:'g1',move:'buy',date:T,amount:1,newAsset:{title:'Casa',kind:'imovel'}}),/Tipo de investimento inválido/);
 assert.throws(()=>up(s,'investmentEvents',{id:'g2',move:'sell',date:T,quantity:1,amount:1,newAsset:{title:'Vale',kind:'acao'}}),{message:'Você tem só 0 nessa data.'});});
test('excluir o ativo exclui os movimentos dele',()=>{const s=applyCommand(wallet(),{type:'delete',collection:'investments',id:'p'},T);
 assert.deepEqual([s.investments.map(a=>a.id),s.investmentEvents.map(e=>e.id)],[['c'],['c1']]);});
test('espaço antigo ganha as coleções de investimentos',()=>{const old=emptyWorkspace('Geo');delete old.investments;delete old.investmentEvents;
 const s=upgradeWorkspace(old);assert.deepEqual([s.investments,s.investmentEvents],[[],[]]);assert.deepEqual(emptyWorkspace().investmentEvents,[]);});
test('checkInvestmentEvent devolve o ativo encontrado ou null para o ativo novo',()=>{const s=wallet();
 assert.equal(checkInvestmentEvent(s,validateItem('investmentEvents',{assetId:'p',move:'dividend',date:T,amount:10}),T).id,'p');
 assert.equal(checkInvestmentEvent(s,validateItem('investmentEvents',{move:'buy',date:T,quantity:1,amount:10,newAsset:{title:'Vale',kind:'acao'}}),T),null);});
