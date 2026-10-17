import {put,get,del,list} from '@vercel/blob';
// Arquivos dos exames: Vercel Blob privado em produção; memória em testes e no desenvolvimento local (EXAM_FILES=memory).
export type StoredFile={body:ReadableStream<Uint8Array>|Uint8Array;contentType:string};
export type ExamFileStore={save(path:string,data:Uint8Array,contentType:string):Promise<void>;read(path:string):Promise<StoredFile|null>;remove(paths:string[]):Promise<void>;removePrefix(prefix:string):Promise<void>};
export function memoryFileStore():ExamFileStore{const files=new Map<string,StoredFile>();return {
 async save(path,data,contentType){files.set(path,{body:data,contentType});},
 async read(path){return files.get(path)||null;},
 async remove(paths){for(const p of paths)files.delete(p);},
 async removePrefix(prefix){for(const p of [...files.keys()])if(p.startsWith(prefix))files.delete(p);}};}
const blobStore:ExamFileStore={
 async save(path,data,contentType){await put(path,Buffer.from(data),{access:'private',contentType,addRandomSuffix:false});},
 async read(path){const r=await get(path,{access:'private'});return r&&r.statusCode===200?{body:r.stream,contentType:r.blob.contentType}:null;},
 async remove(paths){if(paths.length)await del(paths);},
 async removePrefix(prefix){let cursor:string|undefined;do{const page=await list({prefix,cursor,limit:1000});if(page.blobs.length)await del(page.blobs.map(b=>b.pathname));cursor=page.hasMore?page.cursor:undefined;}while(cursor);},
};
const cache=globalThis as unknown as {geoaiExamFiles?:ExamFileStore};
export function examFiles():ExamFileStore|null{if(process.env.EXAM_FILES==='memory')return cache.geoaiExamFiles??=memoryFileStore();return process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID?blobStore:null;}
