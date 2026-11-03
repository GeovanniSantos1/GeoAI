'use client';
import {BODY} from '@/lib/gym-body-paths';
import {SLUG_MUSCLE,type Level} from '@/lib/gym-muscles';
import {MUSCLES} from '@/lib/gym-catalog';
import type {Gender} from '@/lib/types';
// Mapa de músculos, frente e costas. Cada contorno acende pela intensidade (0..1); com onPick, os músculos viram botões.
export function BodyMap({level,gender,size='md',onPick,selected,label}:{level:Level;gender:Gender;size?:'xs'|'sm'|'md'|'lg';onPick?:(slug:string)=>void;selected?:string;label:string}){
 const female=gender==='female',views=female?[BODY.femaleFront,BODY.femaleBack]:[BODY.maleFront,BODY.maleBack];
 return <div className={'gy-body '+size} role={onPick?'group':'img'} aria-label={label}>{views.map((v,i)=><svg key={i} viewBox={v.box.join(' ')} aria-hidden={onPick?undefined:true}>
  {Object.entries(v.parts).map(([slug,paths])=>{const muscle=SLUG_MUSCLE[slug],lv=level[slug]||0,pick=onPick&&muscle;
   const cls='gy-part'+(muscle?'':' decor')+(lv>0?' on':'')+(selected&&SLUG_MUSCLE[selected]===muscle&&muscle?' picked':'')+(pick?' pick':'');
   return <g key={slug} className={cls} style={lv>0?{['--lv' as string]:String(Math.round(25+lv*75))+'%'}:undefined} {...(pick?{role:'button',tabIndex:0,'aria-label':MUSCLES[muscle]||muscle,onClick:()=>onPick(slug),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(slug);}}}:{})}>{paths.map((d,k)=><path key={k} d={d}/>)}</g>;})}
 </svg>)}</div>;}
