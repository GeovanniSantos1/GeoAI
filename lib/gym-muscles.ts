// Liga os músculos do catálogo aos contornos do mapa corporal e calcula quanto cada um acende. Puro.
import type {Exercise} from './gym-catalog.ts';
// Músculo do catálogo → contornos do mapa, com peso (o oblíquo acende menos num abdominal comum).
export const MUSCLE_SLUGS:Record<string,[slug:string,weight:number][]>={abdominals:[['abs',1],['obliques',.6]],abductors:[['gluteal',.5]],adductors:[['adductors',1]],biceps:[['biceps',1]],calves:[['calves',1]],chest:[['chest',1]],forearms:[['forearm',1]],glutes:[['gluteal',1]],hamstrings:[['hamstring',1]],lats:[['upper-back',1]],'lower back':[['lower-back',1]],'middle back':[['rhomboids',1],['upper-back',.6]],neck:[['neck',1]],quadriceps:[['quadriceps',1]],shoulders:[['deltoids',1]],traps:[['trapezius',1]],triceps:[['triceps',1]]};
// Contorno tocado no mapa → músculo do catálogo (para filtrar a biblioteca).
export const SLUG_MUSCLE:Record<string,string>={abs:'abdominals',obliques:'abdominals',adductors:'adductors',biceps:'biceps',calves:'calves',chest:'chest',forearm:'forearms',gluteal:'glutes',hamstring:'hamstrings','upper-back':'lats','lower-back':'lower back',rhomboids:'middle back',neck:'neck',quadriceps:'quadriceps',deltoids:'shoulders',trapezius:'traps',triceps:'triceps'};
export type Level=Record<string,number>;
// Soma por contorno e normaliza para 0..1 (o mais trabalhado fica em 1).
export function levelFrom(score:Record<string,number>):Level{const out:Level={};for(const [m,v] of Object.entries(score))for(const [slug,w] of MUSCLE_SLUGS[m]||[])out[slug]=(out[slug]||0)+v*w;
 const max=Math.max(0,...Object.values(out));if(max>0)for(const k of Object.keys(out))out[k]=Math.round(out[k]/max*100)/100;return out;}
// Exercícios (de uma rotina, de um treino): o principal vale 1 e o secundário 0,5, multiplicados pelas séries.
export function levelOfExercises(list:{exercise?:Exercise;sets?:number}[]){const score:Record<string,number>={};
 for(const {exercise:e,sets=1} of list){if(!e)continue;for(const m of e.primary)score[m]=(score[m]||0)+sets;for(const m of e.secondary)score[m]=(score[m]||0)+sets*.5;}return levelFrom(score);}
