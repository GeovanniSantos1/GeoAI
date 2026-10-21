import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFatura,parseFaturaText,faturaFromLines,normalizeAiFatura,faturaItems} from '../lib/fatura.ts';
const TODAY='2026-10-18',ctx=(transactions=[])=>({transactions,today:TODAY});
const TEXT=['Nubank','Fatura de outubro','Data de fechamento: 03/10/2026','Data de vencimento: 10/10/2026','Total da fatura R$ 1.234,56',
 '05/09 UBER *TRIP 23,90','12/09 IFOOD *RESTAURANTE 45,00','15/09 SUPERMERCADO BOM PRECO 210,35','20/09 MERCADOLIVRE*LOJA 150,00','22/09 AMAZON PRIME 14,90',
 '25/09 LOJA ABC PARC 03/10 100,00','28/09 POSTO SHELL 1.000,00','01/10 ESTORNO LOJA XYZ -50,00','02/10 IOF COMPRA INTERNACIONAL 3,50','02/10 PAGAMENTO DE FATURA -900,00',
 '30/12 COMPRA ANTIGA 10,00','31/02 DATA RUIM 10,00','03 OUT BAR DO ZE 80,00'].join('\n');

test('dados da fatura: emissor, fechamento, vencimento e total',()=>{const {meta}=readFatura(TEXT,TODAY);
 assert.deepEqual(meta,{issuer:'Nubank',closingDate:'2026-10-03',dueDate:'2026-10-10',total:123456});
 assert.deepEqual(readFatura('linha solta',TODAY).meta,{issuer:'Cartão',closingDate:null,dueDate:null,total:null});});
test('linhas reconhecidas: título, categoria, data, valor e seleção',()=>{const r=parseFaturaText(TEXT,ctx());
 assert.deepEqual(r.rows.map(x=>x.title),['Uber','iFood','Supermercado Bom Preco','Mercado Livre','Amazon Prime','Loja Abc','Posto Shell','Estorno Loja Xyz','Iof Compra Internacional','Compra Antiga','Bar do Ze']);
 assert.deepEqual(r.rows.map(x=>x.category),['Transporte','Alimentação','Mercado','Compras','Assinaturas','Outros','Transporte','Outras receitas','Outros','Outros','Lazer']);
 assert.deepEqual(r.rows.map(x=>x.date),['2026-09-05','2026-09-12','2026-09-15','2026-09-20','2026-09-22','2026-10-03','2026-09-28','2026-10-01','2026-10-02','2025-12-30','2026-10-03']);
 assert.deepEqual(r.rows.map(x=>x.amount),[2390,4500,21035,15000,1490,10000,100000,5000,350,1000,8000]);
 assert.deepEqual(r.rows.map(x=>x.selected),[true,true,true,true,true,true,true,false,true,true,true]);
 assert.deepEqual([r.sum,r.mismatch,r.truncated],[158765,true,false]);});
test('parcela, estorno e notas',()=>{const r=parseFaturaText(TEXT,ctx());const parc=r.rows[5],ref=r.rows[7];
 assert.deepEqual([parc.installment,parc.notes,parc.direction],['3/10','Nubank · Parcela 3/10 · compra em 25/09','expense']);
 assert.deepEqual([ref.direction,ref.refund,ref.duplicate,ref.reason],['income',true,false,'Estorno: marque para lançar como receita']);
 assert.equal(r.rows[0].notes,'Nubank');
 const t=parseFaturaText(['Fechamento: 03/10/2026','10/09 TV NOVA PARC 01/12 250,00','11/09 CURSO XYZ 02/06 99,90','12/09 COMPRA PARCELA 4/3 10,00'].join('\n'),ctx());
 assert.deepEqual(t.rows.map(x=>[x.title,x.date,x.installment,x.notes,x.category]),[['Tv Nova','2026-09-10','1/12','Parcela 1/12','Outros'],['Curso Xyz','2026-10-03','2/6','Parcela 2/6 · compra em 11/09','Educação'],['Compra Parcela 4/3','2026-09-12',null,'','Outros']]);});
test('formatos de data e valor: ano explícito, ano de 2 dígitos, R$, menos no fim e virada pelo dia de hoje',()=>{
 const r=parseFaturaText(['05/09/2025 HOTEL CENTRAL 300,00','06/09/25 LIVRARIA CULTURA 59,90','07/01 LOJA R$ 1.234,56','08/01 CREDITO LOJA 10,00-','20/12 NATAL 10,00'].join('\n'),{transactions:[],today:'2026-01-15'});
 assert.deepEqual(r.rows.map(x=>[x.date,x.title,x.amount,x.direction]),[['2025-09-05','Hotel Central',30000,'expense'],['2025-09-06','Livraria Cultura',5990,'expense'],['2026-01-07','Loja',123456,'expense'],['2026-01-08','Estorno · Credito Loja',1000,'income'],['2025-12-20','Natal',1000,'expense']]);
 assert.equal(r.rows[1].category,'Educação');assert.equal(r.mismatch,false);});
test('lojas: palavras curtas só inteiras e exceções do mercado',()=>{
 const r=parseFaturaText(['Fechamento: 03/10/2026','13/09 99 TECNOLOGIA 12,00','14/09 CAFETERIA LEGAL 9,00','16/09 TIM CELULAR 49,99','17/09 MAXXI ATACADO 80,00','18/09 MERCADO PAGO*LOJINHA 30,00','19/09 NETFLIX.COM 39,90'].join('\n'),ctx());
 assert.deepEqual(r.rows.map(x=>[x.title,x.category]),[['99','Transporte'],['Cafeteria Legal','Outros'],['TIM','Contas'],['Maxxi Atacado','Outros'],['Mercado Pago Lojinha','Outros'],['Netflix','Assinaturas']]);});
test('categoria pelo histórico vence as regras; categoria fora da lista é ignorada',()=>{
 const r=parseFaturaText(TEXT,ctx([{id:'h1',title:'Loja Abc',amount:5000,direction:'expense',date:'2026-08-01',category:'Compras'},{id:'h0',title:'Loja ABC',amount:5000,direction:'expense',date:'2026-07-01',category:'Lazer'},{id:'h2',title:'Bar do Ze',amount:100,direction:'expense',date:'2026-08-01',category:'Viagem'},{id:'h3',title:'Uber',amount:100,direction:'expense',date:'2026-08-02',category:'Saúde'}]));
 assert.deepEqual([r.rows[5].category,r.rows[10].category,r.rows[0].category],['Compras','Lazer','Saúde']);});
test('já lançado: por ocorrência e contra compras parceladas',()=>{
 const one=parseFaturaText(['Fechamento: 03/10/2026','05/09 UBER *TRIP 23,90','05/09 UBER *TRIP 23,90'].join('\n'),ctx([{id:'d1',title:'Uber',amount:2390,direction:'expense',date:'2026-09-05'}]));
 assert.deepEqual(one.rows.map(x=>[x.duplicate,x.selected,x.reason]),[[true,false,'Já está nos lançamentos'],[false,true,null]]);
 const parc=parseFaturaText(TEXT,ctx([{id:'g-part-3',title:'Loja Abc (3/10)',amount:10001,direction:'expense',date:'2026-12-25',installmentGroup:'g',installmentIndex:3,installmentCount:10}]));
 assert.deepEqual([parc.rows[5].duplicate,parc.rows[5].selected,parc.rows[5].reason],[true,false,'Já está nas compras parceladas']);});
test('importar a mesma fatura de novo marca tudo como já lançado',()=>{const first=parseFaturaText(TEXT,ctx());
 const saved=faturaItems(first.rows.map(r=>({...r,selected:true})),'c1').map((x,i)=>({id:'i'+i,...x}));
 const again=parseFaturaText(TEXT,ctx(saved));
 assert.ok(again.rows.every(r=>r.duplicate&&!r.selected));});
test('texto sem linhas reconhecíveis devolve zero linhas sem erro',()=>{const r=parseFaturaText('Extrato\nNome  Valor  Data\nqualquer coisa',ctx());
 assert.deepEqual([r.rows.length,r.sum,r.mismatch],[0,0,false]);});
test('total: tolerância de 1% ou R$ 1,00',()=>{const base=['05/09 UBER 23,90','06/09 LOJA 10,00'];
 assert.deepEqual(['33,90','34,00','40,00'].map(t=>parseFaturaText(['Total da fatura '+t,...base].join('\n'),ctx()).mismatch),[false,false,true]);});
test('no máximo 250 linhas',()=>{const r=parseFaturaText(Array.from({length:260},(_,i)=>'05/09 LOJA '+i+' 1,00').join('\n'),ctx());
 assert.deepEqual([r.rows.length,r.truncated],[250,true]);});
test('linhas da IA passam pelo mesmo tratamento',()=>{
 const r=faturaFromLines([{date:'2026-09-05',description:'UBER *TRIP',amount:2390},{date:'2026-09-25',description:'LOJA ABC PARC 03/10',amount:10000},{date:'2026-10-01',description:'ESTORNO X',amount:-500},{date:'2026-10-02',description:'PAGAMENTO DE FATURA',amount:-90000}],{issuer:'Itaú',closingDate:'2026-10-03',dueDate:null,total:null},ctx());
 assert.deepEqual(r.rows.map(x=>[x.title,x.date,x.category,x.notes]),[['Uber','2026-09-05','Transporte','Itaú'],['Loja Abc','2026-10-03','Outros','Itaú · Parcela 3/10 · compra em 25/09'],['Estorno X','2026-10-01','Outras receitas','Itaú']]);
 assert.equal(r.mismatch,false);});
test('resposta da IA conferida',()=>{
 const n=normalizeAiFatura({issuer:' Nubank ',closingDate:'2026-10-03',dueDate:'2026-02-30',total:12345,lines:[{date:'2026-09-05',description:' Uber ',amount:2390},{date:'2026-13-01',description:'x',amount:100},{date:'2026-09-06',description:'y',amount:10.5},{date:'2026-09-07',description:'',amount:100},{date:'2026-09-08',description:'z',amount:0}]});
 assert.deepEqual(n,{meta:{issuer:'Nubank',closingDate:'2026-10-03',dueDate:null,total:12345},lines:[{date:'2026-09-05',description:'Uber',amount:2390}]});
 assert.deepEqual(normalizeAiFatura('lixo'),{meta:{issuer:'Cartão',closingDate:null,dueDate:null,total:null},lines:[]});
 assert.equal(normalizeAiFatura({lines:Array.from({length:300},()=>({date:'2026-09-05',description:'a',amount:1}))}).lines.length,250);});
test('linhas marcadas viram itens para importar, com cartão ou como crédito',()=>{const r=parseFaturaText(TEXT,ctx());
 const withCard=faturaItems(r.rows,'c1'),noCard=faturaItems(r.rows);
 assert.equal(withCard.length,10);
 assert.deepEqual(withCard[0],{title:'Uber',amount:2390,direction:'expense',category:'Transporte',date:'2026-09-05',notes:'Nubank',cardId:'c1'});
 assert.deepEqual([noCard[0].payment,noCard[0].cardId],['credit',undefined]);});
test('loja só casa como palavra inteira: Uberlândia não vira Uber',()=>{const r=parseFaturaText(['Fechamento: 03/10/2026','05/09 UBERLANDIA SUPERMERCADO 20,00','06/09 AUTO POSTO COMPOSTO 50,00','07/09 FARMACIAS PACHECO 30,00'].join('\n'),ctx());
 assert.deepEqual(r.rows.map(x=>[x.title,x.category]),[['Uberlandia Supermercado','Mercado'],['Auto Posto Composto','Transporte'],['Farmacias Pacheco','Saúde']]);});
