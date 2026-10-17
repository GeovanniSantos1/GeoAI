import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryFileStore } from '../lib/exam-files.ts';

test('armazenamento em memória guarda, lê e apaga por caminho e prefixo',async()=>{const f=memoryFileStore();const data=new Uint8Array([1,2,3]);
 await f.save('exames/u1/a.pdf',data,'application/pdf');await f.save('exames/u1/b.pdf',data,'application/pdf');await f.save('exames/u2/c.pdf',data,'application/pdf');
 assert.equal((await f.read('exames/u1/a.pdf')).contentType,'application/pdf');
 await f.remove(['exames/u1/a.pdf']);assert.equal(await f.read('exames/u1/a.pdf'),null);
 await f.removePrefix('exames/u1/');assert.equal(await f.read('exames/u1/b.pdf'),null);assert.ok(await f.read('exames/u2/c.pdf'));});
