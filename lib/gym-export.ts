// Exportar o Gym: os treinos em CSV (uma linha por série, para planilha) e tudo em JSON. Puro.
import type {GymProfile} from './gym.ts';
import type {Workout} from './gym-active.ts';
import {nameOf} from './gym-catalog.ts';
const cell=(v:unknown)=>{const s=v===null||v===undefined?'':String(v);return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
export const CSV_HEADER=['data','inicio','treino','duracao_min','exercicio','exercicio_id','serie','tipo','peso_kg','reps','tempo_s','rir','nota'];
export function workoutsCsv(workouts:Workout[],p:GymProfile){const rows=[CSV_HEADER];
 for(const w of workouts.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.startedAt.localeCompare(b.startedAt)))for(const e of w.exercises)e.sets.forEach((s,i)=>rows.push([w.date,w.startedAt,w.name,String(w.durationMin),nameOf(e.exerciseId,p.custom),e.exerciseId,String(i+1),s.kind,s.weight??'',s.reps??'',s.timeSec??'',s.effort??'',e.notes].map(String)));
 return rows.map(r=>r.map(cell).join(',')).join('\n')+'\n';}
export function gymJson(workouts:Workout[],p:GymProfile,at:Date){return JSON.stringify({app:'GeoAI Gym',version:1,exportedAt:at.toISOString(),profile:p,workouts},null,1);}
