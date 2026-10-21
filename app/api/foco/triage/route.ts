import {boardDeps,boardFail,boardUser,readBody} from '@/lib/board-deps';import {prepareTriage,runTriage,AI_FAILED} from '@/lib/board-service';import type {Card} from '@/lib/board';
export const dynamic='force-dynamic';export const maxDuration=60;
// Validação e cota antes do streaming (erros com status); depois, uma linha JSON por card triado, conforme chegam.
export async function POST(request:Request){const g=await boardUser(request);if('error' in g)return g.error;const d=boardDeps(g.userId);
 let cards:Card[];try{cards=await prepareTriage(d,await readBody(request));}catch(e){return boardFail(e);}
 const enc=new TextEncoder();
 const stream=new ReadableStream({async start(controller){const line=(x:unknown)=>controller.enqueue(enc.encode(JSON.stringify(x)+'\n'));
  try{await runTriage(d,cards,s=>line(s));}catch(e){console.error('foco triage',e instanceof Error?e.message:'erro');line({error:AI_FAILED});}controller.close();}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'}});}
