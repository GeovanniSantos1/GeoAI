import {collectBoard} from './focus-api';import type {Workspace} from '@/lib/types';import type {GymProfile} from '@/lib/gym';import type {Workout} from '@/lib/gym-active';
export function download(filename:string,text:string,type='application/json'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
// Backup: o workspace, o quadro do Foco e o Gym, que ficam em tabelas próprias e vêm em pedaços. Usado em Configurações e na tela de assinatura.
export async function downloadBackup(state:Workspace,today:string){const [board,gym]=await Promise.all([collectBoard(),collectGym()]);download('geoai-backup-'+today+'.json',JSON.stringify({app:'norte',version:2,exportedAt:new Date().toISOString(),state,board,gym},null,2));}
export type GymBackup={profile:GymProfile;workouts:Workout[]};
async function getJson<T>(url:string):Promise<T>{const r=await fetch(url,{cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Não foi possível ler o Gym para o backup.');return j as T;}
export async function collectGym():Promise<GymBackup>{const first=await getJson<{profile:GymProfile;workouts:Workout[];next:string|null}>('/api/gym');const workouts=[...first.workouts];let next=first.next;
 while(next){const page=await getJson<{workouts:Workout[];next:string|null}>('/api/gym/workouts?before='+encodeURIComponent(next));workouts.push(...page.workouts);next=page.next;}return {profile:first.profile,workouts};}
// Sobe o Gym do backup em pedaços de até 300 treinos; o primeiro substitui o Gym atual e leva o perfil.
export async function pushGym(gym:GymBackup){const list=Array.isArray(gym.workouts)?gym.workouts:[];let skipped=0;
 for(let i=0;i===0||i<list.length;i+=300){const body={replace:i===0,...(i===0?{profile:gym.profile}:{}),workouts:list.slice(i,i+300)};const r=await fetch('/api/gym/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Não foi possível restaurar o Gym.');skipped+=j.skipped||0;}
 return skipped;}
