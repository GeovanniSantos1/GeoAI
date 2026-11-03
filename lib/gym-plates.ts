// Anilhas por lado da barra e a rampa de aquecimento antes das séries de trabalho. Puro; tudo em kg.
import {LB} from './gym.ts';
export const KG_PLATES=[25,20,15,10,5,2.5,1.25];
export const LB_PLATES=[45,35,25,10,5,2.5].map(p=>p*LB);
// Guloso do maior para o menor, com pares à vontade: o que cabe de cada lado e o total que dá para montar.
export function platesFor(total:number,bar:number,plates:number[]=KG_PLATES){if(!(total>0))return null;if(total<=bar)return {perSide:[] as number[],achieved:bar,exact:Math.abs(total-bar)<.01};
 let side=(total-bar)/2;const perSide:number[]=[];for(const p of [...plates].sort((a,b)=>b-a)){while(side>=p-.005){perSide.push(p);side-=p;}}
 const achieved=Math.round((bar+2*perSide.reduce((a,b)=>a+b,0))*100)/100;return {perSide,achieved,exact:Math.abs(achieved-total)<.01};}
// Rampa: só a barra, depois 40%, 60% e 80% da carga de trabalho, arredondados ao incremento; sem repetir carga nem passar da de trabalho.
export function warmupRamp(work:number,bar:number,increment:number){if(!(work>=bar*1.5))return [] as {weight:number;reps:number}[];const step=increment>0?increment:2.5;
 const round=(v:number)=>Math.max(bar,Math.round(v/step)*step);const out:{weight:number;reps:number}[]=[{weight:bar,reps:10}];
 for(const [pct,reps] of [[.4,5],[.6,3],[.8,2]] as [number,number][]){const w=Math.round(round(work*pct)*100)/100;if(w>out[out.length-1].weight&&w<work)out.push({weight:w,reps});}
 return out;}
