import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordDiff,listDiff} from '../lib/text-diff.ts';
test('wordDiff marca palavras novas e removidas',()=>{assert.deepEqual(wordDiff('a b c','a x c'),[{op:'same',text:'a '},{op:'del',text:'b '},{op:'add',text:'x '},{op:'same',text:'c'}]);});
test('wordDiff preserva quebras de linha e junta partes iguais',()=>{assert.deepEqual(wordDiff('linha um\nlinha dois','linha um\nlinha três'),[{op:'same',text:'linha um\nlinha '},{op:'del',text:'dois'},{op:'add',text:'três'}]);});
test('wordDiff com textos iguais ou vazios',()=>{assert.deepEqual(wordDiff('a b','a b'),[{op:'same',text:'a b'}]);assert.deepEqual(wordDiff('','novo texto'),[{op:'add',text:'novo texto'}]);assert.deepEqual(wordDiff('velho',''),[{op:'del',text:'velho'}]);assert.deepEqual(wordDiff('',''),[]);});
test('wordDiff acima de 2.000 palavras vira tudo removido e tudo adicionado',()=>{const big=Array(2001).fill('p').join(' ');assert.deepEqual(wordDiff(big,'curto'),[{op:'del',text:big},{op:'add',text:'curto'}]);});
test('listDiff compara itens sem diferenciar maiúsculas e espaços nas pontas',()=>{assert.deepEqual(listDiff(['A','B'],[' a ','C']),[{op:'same',text:' a '},{op:'del',text:'B'},{op:'add',text:'C'}]);assert.deepEqual(listDiff([],['x']),[{op:'add',text:'x'}]);});
