import {collectBoard} from './focus-api';import type {Workspace} from '@/lib/types';
export function download(filename:string,text:string,type='application/json'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
// Backup: o workspace e o quadro do Foco, que fica em tabela própria e vem em pedaços. Usado em Configurações e na tela de assinatura.
export async function downloadBackup(state:Workspace,today:string){const board=await collectBoard();download('geoai-backup-'+today+'.json',JSON.stringify({app:'norte',version:2,exportedAt:new Date().toISOString(),state,board},null,2));}
