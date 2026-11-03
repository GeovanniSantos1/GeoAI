// Catálogo de exercícios do Gym: os fatos (músculos, equipamento, categoria) vêm da free-exercise-db (Unlicense);
// nomes, passos e dicas em pt-BR foram escritos para o GeoAI. Sem fotos: o visual é o mapa de músculos.
import {ROWS_1} from './gym-exercises-1.ts';import {ROWS_2} from './gym-exercises-2.ts';
import type {CustomExercise} from './gym.ts';
export type Row=[id:string,name:string,en:string,equipment:string,primary:string[],secondary:string[],category:string,level:string,force:string|null,mechanic:string|null,steps:string[],tip:string];
export type Exercise={id:string;name:string;en:string;equipment:string;primary:string[];secondary:string[];category:string;level:string;force:string|null;mechanic:string|null;steps:string[];tip:string;timed:boolean;custom:boolean};

export const MUSCLES:Record<string,string>={abdominals:'Abdômen',abductors:'Abdutores',adductors:'Adutores',biceps:'Bíceps',calves:'Panturrilhas',chest:'Peito',forearms:'Antebraços',glutes:'Glúteos',hamstrings:'Posteriores da coxa',lats:'Dorsais','lower back':'Lombar','middle back':'Meio das costas',neck:'Pescoço',quadriceps:'Quadríceps',shoulders:'Ombros',traps:'Trapézio',triceps:'Tríceps'};
export const EQUIPMENT:Record<string,string>={barbell:'Barra',dumbbell:'Halteres',cable:'Polia',machine:'Máquina','body only':'Peso corporal',kettlebells:'Kettlebell',bands:'Elástico','medicine ball':'Medicine ball','exercise ball':'Bola suíça','foam roll':'Rolo de espuma','e-z curl bar':'Barra W',other:'Outros',none:'Sem equipamento'};
export const CATEGORIES:Record<string,string>={strength:'Força',stretching:'Alongamento',plyometrics:'Pliometria',powerlifting:'Powerlifting','olympic weightlifting':'Levantamento olímpico',strongman:'Strongman',cardio:'Cardio'};
export const LEVELS:Record<string,string>={beginner:'Iniciante',intermediate:'Intermediário',expert:'Avançado'};
// Os chips da biblioteca agrupam músculos; Cardio e Alongamento vêm da categoria.
export const BODY_PARTS:{id:string;label:string;muscles?:string[];category?:string}[]=[
 {id:'peito',label:'Peito',muscles:['chest']},{id:'costas',label:'Costas',muscles:['lats','middle back','lower back','traps']},{id:'ombros',label:'Ombros',muscles:['shoulders']},
 {id:'bracos',label:'Braços',muscles:['biceps','triceps','forearms']},{id:'pernas',label:'Pernas',muscles:['quadriceps','hamstrings','calves','adductors','abductors']},{id:'gluteos',label:'Glúteos',muscles:['glutes']},
 {id:'abdomen',label:'Abdômen',muscles:['abdominals']},{id:'cardio',label:'Cardio',category:'cardio'},{id:'alongamento',label:'Alongamento',category:'stretching'}];

const fromRow=([id,name,en,equipment,primary,secondary,category,level,force,mechanic,steps,tip]:Row):Exercise=>
 ({id,name,en,equipment,primary,secondary,category,level,force,mechanic,steps,tip,timed:force==='static'||category==='stretching'||category==='cardio',custom:false});
export const EXERCISES:Exercise[]=[...ROWS_1,...ROWS_2].map(fromRow);
const BY_ID=new Map(EXERCISES.map(e=>[e.id,e]));
export const isCatalogId=(id:string)=>BY_ID.has(id);
export const fromCustom=(c:CustomExercise):Exercise=>({id:c.id,name:c.name,en:'',equipment:c.equipment,primary:c.primary,secondary:c.secondary,category:c.category,level:'beginner',force:c.timed?'static':null,mechanic:null,steps:[],tip:'',timed:c.timed,custom:true});
export function exerciseOf(id:string,custom:CustomExercise[]=[]):Exercise|undefined{const e=BY_ID.get(id);if(e)return e;const c=custom.find(x=>x.id===id);return c?fromCustom(c):undefined;}
export const nameOf=(id:string,custom:CustomExercise[]=[])=>exerciseOf(id,custom)?.name||'Exercício removido';
export const bodyweight=(e?:Exercise)=>!e||e.equipment==='body only'||e.equipment==='none';
export const musclesOf=(e?:Exercise)=>e?[...e.primary,...e.secondary].map(m=>MUSCLES[m]||m):[];

// Incremento padrão por equipamento (kg): barra 2,5, halteres 2, máquina e polia 5, kettlebell 4; peso corporal só soma reps.
export function defaultIncrement(e?:Exercise){if(!e)return 2.5;switch(e.equipment){case 'dumbbell':return 2;case 'machine':case 'cable':return 5;case 'kettlebells':return 4;case 'body only':case 'none':return 0;default:return e.primary.some(m=>['quadriceps','hamstrings','glutes'].includes(m))&&e.mechanic==='compound'?5:2.5;}}

export const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export type Filter={query?:string;part?:string;equipment?:string;favorites?:string[];onlyFavorites?:boolean};
// Busca sem acento e sem caixa no nome em pt-BR e em inglês; com várias palavras, todas precisam aparecer.
export function searchExercises(list:Exercise[],f:Filter){const words=fold(f.query||'').split(/\s+/).filter(Boolean),part=BODY_PARTS.find(p=>p.id===f.part),fav=new Set(f.favorites||[]);
 return list.filter(e=>{if(f.onlyFavorites&&!fav.has(e.id))return false;if(f.equipment&&e.equipment!==f.equipment)return false;
  if(part){if(part.category?e.category!==part.category:!e.primary.some(m=>part.muscles!.includes(m)))return false;}
  if(!words.length)return true;const hay=fold(e.name+' '+e.en+' '+musclesOf(e).join(' ')+' '+(EQUIPMENT[e.equipment]||''));return words.every(w=>hay.includes(w));})
  .sort((a,b)=>Number(fav.has(b.id))-Number(fav.has(a.id))||(words.length?Number(fold(b.name).startsWith(words[0]))-Number(fold(a.name).startsWith(words[0])):0)||a.name.localeCompare(b.name,'pt-BR'));}
