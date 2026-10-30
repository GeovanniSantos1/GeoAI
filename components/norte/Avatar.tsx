'use client';import {useId} from 'react';import type {Gender,Profile} from '@/lib/types';import {HAIR_STYLES,HAIR_CUTS} from '@/lib/gender';
// Avatar desenhado em camadas (arte própria): o mesmo personagem aparece como busto (topo e escolha de gênero) ou de corpo inteiro num quarto (Sua jornada).
// O tema escuro troca as cores pelas classes av-bg/av-halo e mostra o quarto à noite (grupos sc-day/sc-night).
type Look=Profile['avatar'];
export const SKINS=['#f1cfb2','#e1b28c','#c48b68','#9b6347','#633d2e'],HAIRS=['#302c28','#725140','#b99865','#a4532e','#82807b'],OUTFITS=['#24594c','#31495e','#8a5544','#b9606f','#3f4140'];
const pick=<T,>(list:readonly T[])=>list[Math.floor(Math.random()*list.length)];
export function randomLook(gender:Gender):Partial<Look>{const look={skin:pick(SKINS),hair:pick(HAIRS),shirt:pick(OUTFITS)};return gender==='female'?{...look,style:pick(HAIR_STYLES)[0],earrings:Math.random()<.5}:{...look,cut:pick(HAIR_CUTS)[0],beard:Math.random()<.5};}
// Escurece (t>0) ou clareia (t<0) uma cor #rrggbb.
const tone=(hex:string,t:number)=>'#'+[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16);return Math.round(t>0?c*(1-t):c+(255-c)*-t).toString(16).padStart(2,'0');}).join('');
export default function Avatar({profile,small=false,stage=false}:{profile:Profile;small?:boolean;stage?:boolean}){const id=useId(),female=profile.gender==='female';
 if(stage)return <svg className="person-avatar stage" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Seu avatar GeoAI no quarto"><Room id={id}/><g transform="translate(600 50) scale(1.1)"><ellipse cx="0" cy="463" rx="70" ry="9" fill="#000" opacity=".16"/><Person a={profile.avatar} female={female} full/></g></svg>;
 return <svg className={'person-avatar '+(small?'small':'')} viewBox="-80 -8 160 180" role="img" aria-label="Seu avatar GeoAI"><defs><clipPath id={id}><rect x="-80" y="-8" width="160" height="180" rx="66"/></clipPath></defs><g clipPath={'url(#'+id+')'}><rect className="av-bg" x="-80" y="-8" width="160" height="180" fill="#e8eadf"/><circle className="av-halo" cx="0" cy="70" r="62" fill="#d8dfcb"/><Person a={profile.avatar} female={female}/></g></svg>;}

// No palco o braço direito dobra segurando a garrafa d'água (antebraço, garrafa e mão vêm por cima do cabelo); no busto os dois braços ficam soltos.
function Person({a,female,full=false}:{a:Look;female:boolean;full?:boolean}){const skin=a.skin,hair=a.hair,top=a.shirt,shade='#000',legs=female?tone(top,.3):'#3a403c',w=female?15:18;
 const arms=female?'M-41 146C-47 176-50 206-49 238'+(full?'M41 146C48 168 54 190 55 210':'M41 146C47 176 50 206 50 238'):'M-55 170C-59 196-60 216-58 240'+(full?'M55 170C60 188 64 204 65 220':'M55 170C59 196 60 216 58 240');
 const hands=female?[[-49,242],full?[40,176]:[50,242]]:[[-58,246],full?[46,196]:[58,244]];
 return <>
  {female&&<BackHair a={a}/>}
  {female?<path d="M-35 236C-39 270-36 302-30 338L-22 436H-7L-3 302Q0 296 3 302L7 436H22L30 338C36 302 39 270 35 236Z" fill={legs}/>
   :<><path d="M-43 240C-46 280-43 320-38 350L-32 434H-7L-4 302Q0 296 4 302L7 434H32L38 350C43 320 46 280 43 240Z" fill={legs}/><path d="M-32 424H-7v10H-32zM7 424H32v10H7z" fill="#000" opacity=".18"/></>}
  <path d="M-4 300Q0 294 4 300L6 380" fill="none" stroke={shade} strokeOpacity=".12" strokeWidth="2"/>
  <path d={female?'M-21 430H-7v14H-21zM7 430H21v14H7z':'M-30 432H-8v12H-30zM8 432H30v12H8z'} fill="#f3f1e9"/>
  <Shoe accent={top}/><g transform="scale(-1 1)"><Shoe accent={top}/></g>
  {female?<path d="M-24 124C-38 126-44 134-45 148L-40 176H40L45 148C44 134 38 126 24 124Z" fill={skin}/>:null}
  <path d={arms} fill="none" stroke={skin} strokeWidth={w} strokeLinecap="round"/>
  <path d={female?'M-10 102V130Q0 136 10 130V102Z':'M-12 100V128Q0 134 12 128V100Z'} fill={skin}/>
  {female?<><path d="M-29 134L-20 132C-16 146-9 152 0 152S16 146 20 132L29 134C33 150 36 168 34 186C31 204 29 218 31 240H-31C-29 218-31 204-34 186C-36 168-33 150-29 134Z" fill={top}/><path d="M18 150C24 148 27 140 29 134C33 150 36 168 34 186C31 204 29 218 31 240H22C24 212 24 180 18 150Z" fill={shade} opacity=".12"/><path d="M-32 232H32V244H-32z" fill={tone(legs,.18)}/></>
   :<><path d="M-20 124C-8 132 8 132 20 124L44 130C56 134 62 146 64 162L66 180L48 184L46 168C44 196 44 220 45 248H-45C-44 220-44 196-46 168L-48 184L-66 180L-64 162C-62 146-56 134-44 130Z" fill={top}/><path d="M30 140C40 160 42 200 45 248H34C34 210 34 170 30 140Z" fill={shade} opacity=".12"/><path d="M-20 124C-8 136 8 136 20 124" fill="none" stroke={tone(top,.3)} strokeWidth="3.5"/><path d="M-46 168L-48 184M46 168L48 184" stroke={shade} strokeOpacity=".15" strokeWidth="2"/></>}
  <path d={female?'M-10 104Q0 120 10 104V102H-10Z':'M-12 104Q0 120 12 104V100H-12Z'} fill={shade} opacity=".14"/>
  {(full?hands.slice(0,1):hands).map(([x,y])=><circle key={x} cx={x} cy={y} r={w/2+.5} fill={skin}/>)}
  <g className="av-head">
   <ellipse cx="-36" cy="74" rx="6.5" ry="10" fill={skin}/><ellipse cx="36" cy="74" rx="6.5" ry="10" fill={skin}/><path d="M-37 70v8M37 70v8" stroke={shade} strokeOpacity=".1" strokeWidth="3" strokeLinecap="round"/>
   <path d={female?'M-36 60C-36 33-19 22 0 22S36 33 36 60V74C36 97 19 111 0 112S-36 97-36 74Z':'M-37 60C-37 32-19 22 0 22S37 32 37 60V78C37 98 20 110 0 111S-37 98-37 78Z'} fill={skin}/>
   {female&&a.earrings&&<><circle cx="-37" cy="89" r="4.5" fill="none" stroke="#d4b078" strokeWidth="2"/><circle cx="37" cy="89" r="4.5" fill="none" stroke="#d4b078" strokeWidth="2"/></>}
   <ellipse cx="-22" cy="89" rx="6" ry="3.5" fill="#e47f6c" opacity={female?.3:.14}/><ellipse cx="22" cy="89" rx="6" ry="3.5" fill="#e47f6c" opacity={female?.3:.14}/>
   {!female&&a.beard&&<path fillRule="evenodd" d="M-37 64V78C-37 100-20 116 0 117S37 100 37 78V64C34 76 30 86 22 90C14 92-14 92-22 90C-30 86-34 76-37 64ZM0 93.5a9.5 5.5 0 1 0 .1 0Z" fill={hair}/>}
   <g className="av-eyes"><ellipse cx="-14" cy="74" rx="4.8" ry="5.8" fill="#2a221e"/><ellipse cx="14" cy="74" rx="4.8" ry="5.8" fill="#2a221e"/><circle cx="-12.3" cy="71.8" r="1.7" fill="#fff"/><circle cx="15.7" cy="71.8" r="1.7" fill="#fff"/></g>
   {female&&<path d="M-18 71.5l-3.6-2.6M18 71.5l3.6-2.6" stroke="#2a221e" strokeWidth="1.8" strokeLinecap="round"/>}
   <path d={female?'M-21 62Q-14 57.5-7 60.5M7 60.5Q14 57.5 21 62':'M-22 61Q-14 56-6 59M6 59Q14 56 22 61'} fill="none" stroke={tone(hair,.25)} strokeWidth={female?2.6:4} strokeLinecap="round"/>
   <path d="M-3 87q3 2 6 0" fill="none" stroke={shade} strokeOpacity=".22" strokeWidth="2" strokeLinecap="round"/>
   {female?<path d="M-8 96q8 8 16 0q-8 3-16 0z" fill="#b4574f"/>:<path d="M-7 97q7 5 14 0" fill="none" stroke="#5d362b" strokeWidth="2.6" strokeLinecap="round"/>}
   {female?<FrontHair a={a}/>:<Cut a={a}/>}
  </g>
  {full&&<><path d={female?'M55 210L40 176':'M65 220L46 196'} fill="none" stroke={skin} strokeWidth={w} strokeLinecap="round"/><g transform={'translate('+hands[1].join(' ')+')'}><rect x="-6" y="-41" width="12" height="11" rx="3" fill="#285442"/><rect x="-11" y="-32" width="22" height="64" rx="8" fill="#eef3ea"/><rect x="-11" y="12" width="22" height="13" fill="#285442" opacity=".85"/><path d="M-5-25v46" stroke="#fff" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round"/><rect x="-13" y="-8" width="26" height="17" rx="8" fill={skin}/><path d="M-4-7v6M3-7v6" stroke={shade} strokeOpacity=".16" strokeWidth="1.6" strokeLinecap="round"/></g></>}
 </>;}

function Shoe({accent}:{accent:string}){return <><path d="M-33 446Q-34 438-25 438H-9Q-4 438-3 446L-2 456H-35Q-36 450-33 446Z" fill="#fbfaf5"/><path d="M-36 455H-1v6q0 3-3 3H-33q-3 0-3-3z" fill="#d9d5c8"/><path d="M-29 450Q-19 450-11 443" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/></>;}

const CURLS=[[-46,36,17],[-52,64,17],[-50,92,17],[-44,118,16],[-30,136,14],[-40,12,15],[-22,2,17],[0,-2,17],[22,2,17],[40,12,15],[50,40,17],[54,66,17],[50,94,17],[44,118,16],[30,136,14]];
function BackHair({a}:{a:Look}){const h=a.hair,s=a.style;
 if(s==='curto')return <path d="M-43 60C-46 16-22 6 0 6S46 16 43 60L45 104C45 114 38 120 28 118H-28C-38 120-45 114-45 104Z" fill={h}/>;
 if(s==='cacheado')return <><ellipse cx="0" cy="64" rx="52" ry="60" fill={h}/>{CURLS.map(([x,y,r])=><circle key={x+'.'+y} cx={x} cy={y} r={r} fill={h}/>)}</>;
 if(s==='coque')return <><circle cx="0" cy="2" r="17" fill={h}/><path d="M-9-2Q0-10 9-2" fill="none" stroke="#000" strokeOpacity=".15" strokeWidth="2"/><path d="M-40 68C-44 22-20 10 0 10S44 22 40 68Z" fill={h}/></>;
 return <path d="M-41 62C-46 18-22 4 0 4S46 18 41 62L47 156C49 176 44 190 34 194C18 198-18 198-34 194C-44 190-49 176-47 156Z" fill={h}/>;}
function FrontHair({a}:{a:Look}){const h=a.hair,s=a.style,shine=<path d="M-26 25C-33 34-36 46-36 58" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round"/>;
 if(s==='curto')return <><path d="M0 12C-26 12-43 28-41 62L-42 104C-42 112-36 116-30 114C-32 98-33 80-32 62C-28 54-20 48-10 46C2 44 16 40 24 36C30 44 33 52 33 62C33 80 32 98 30 114C36 116 42 112 42 104L41 62C43 28 26 12 0 12Z" fill={h}/>{shine}</>;
 if(s==='cacheado')return <><path d="M-40 70C-46 26-20 10 0 10S46 26 40 70C38 58 34 50 28 46C26 52 18 54 14 48C10 54 2 54-2 48C-6 54-14 54-18 48C-22 54-30 52-32 46C-36 50-38 58-40 70Z" fill={h}/>{[[-25,47],[-8,49],[8,49],[23,47]].map(([x,y])=><circle key={x} cx={x} cy={y} r="5" fill={h}/>)}</>;
 if(s==='coque')return <><path d="M-39 66C-41 30-20 16 0 16S41 30 39 66C36 50 26 38 12 36C4 35-4 35-12 36C-26 38-36 50-39 66Z" fill={h}/><rect x="-9" y="14" width="18" height="5" rx="2.5" fill={a.shirt}/><path d="M-36 58q-4 14 0 26" fill="none" stroke={h} strokeWidth="2" strokeLinecap="round"/>{shine}</>;
 return <><path d="M0 10C-28 10-44 30-41 66C-41 84-39 98-35 108C-33 86-31 66-24 50C-16 36-6 28 0 20C6 28 16 36 24 50C31 66 33 86 35 108C39 98 41 84 41 66C44 30 28 10 0 10Z" fill={h}/><path d="M-38 100C-42 130-40 160-32 182C-28 186-22 184-22 178C-28 156-30 128-30 104ZM38 100C42 130 40 160 32 182C28 186 22 184 22 178C28 156 30 128 30 104Z" fill={h}/>{shine}</>;}
function Cut({a}:{a:Look}){const h=a.hair;
 if(a.cut==='raspado')return <path d="M-37 66C-39 30-20 18 0 18S39 30 37 66C35 54 30 46 22 42C10 38-10 38-22 42C-30 46-35 54-37 66Z" fill={h} opacity=".88"/>;
 if(a.cut==='cacheado')return <><path d="M-39 70C-41 40-32 26 0 26S41 40 39 70C37 60 35 54 32 50H-32C-35 54-37 60-39 70Z" fill={h}/>{[[-30,36,11],[-20,24,12],[-6,18,12],[8,17,12],[22,22,12],[32,34,11],[-34,46,8],[34,46,8],[-16,36,9],[0,32,9],[16,34,9]].map(([x,y,r])=><circle key={x+'.'+y} cx={x} cy={y} r={r} fill={h}/>)}</>;
 return <><path d="M-39 70C-43 26-20 8 3 9C27 10 43 28 39 70C37 60 35 52 31 46C22 46 10 42 0 34C-8 42-20 46-31 47C-35 54-37 62-39 70Z" fill={h}/><path d="M-24 22Q-8 14 12 16" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="3" strokeLinecap="round"/></>;}

// Quarto em 1200x600: o personagem fica no centro; no celular o corte (slice) mostra só o miolo, por isso relógio, quadro e abajur ficam perto dele.
const leaf=(x:number,y:number,angle:number,len:number,w:number)=>({d:`M0 0C${w} ${-len*.3} ${w*.8} ${-len*.8} 0 ${-len}C${-w*.8} ${-len*.8} ${-w} ${-len*.3} 0 0Z`,transform:`translate(${x} ${y}) rotate(${angle})`});
const PLANT=[[-62,150,30,'#4d7a59'],[-34,170,32,'#5d8b68'],[-10,182,30,'#6f9c78'],[14,176,30,'#5d8b68'],[38,160,32,'#4d7a59'],[60,138,28,'#6f9c78']] as const;
const STARS=[[880,110],[930,150],[968,104],[900,230],[1000,200],[952,262],[870,180]];
function Room({id}:{id:string}){const g=(n:string)=>id+n,u=(n:string)=>'url(#'+id+n+')';
 return <>
  <defs>
   <linearGradient id={g('wall')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1f2e9"/><stop offset="1" stopColor="#e2e7d8"/></linearGradient>
   <linearGradient id={g('floor')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e3d1b2"/><stop offset="1" stopColor="#d2bc98"/></linearGradient>
   <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c8e0e4"/><stop offset="1" stopColor="#eef4e8"/></linearGradient>
   <linearGradient id={g('night')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1824"/><stop offset="1" stopColor="#1f3445"/></linearGradient>
   <radialGradient id={g('glow')}><stop offset="0" stopColor="#ffd894" stopOpacity=".5"/><stop offset="1" stopColor="#ffd894" stopOpacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="440" fill={u('wall')}/>
  <rect y="446" width="1200" height="154" fill={u('floor')}/>
  <path d="M0 482H1200M0 524H1200M0 572H1200M180 446l-8 36M520 482l-6 42M860 446l6 36M300 524l-8 48M1010 524l8 48M700 572l-4 28" stroke="#000" strokeOpacity=".05" strokeWidth="2"/>
  <rect y="430" width="1200" height="16" fill="#f8f7f0"/><path d="M0 446H1200" stroke="#000" strokeOpacity=".07" strokeWidth="2"/>
  <g className="sc-day"><path d="M862 446H1010L930 600H690Z" fill="#fff" opacity=".22"/></g>
  {/* janela com cortinas */}
  <rect x="806" y="54" width="262" height="6" rx="3" fill="#b59368"/>
  <rect x="836" y="70" width="200" height="270" rx="6" fill="#fffefa"/><rect x="850" y="84" width="172" height="242" fill={u('sky')}/>
  <circle cx="988" cy="128" r="18" fill="#fbe7b8"/><path d="M850 300Q890 254 940 292Q980 262 1022 294V326H850Z" fill="#b6ceb0"/>
  <path d="M932 84h8v242h-8zM850 200h172v8H850z" fill="#fffefa"/><rect x="826" y="338" width="220" height="12" rx="3" fill="#f6f4ec"/>
  <path d="M820 58H862C854 150 858 250 848 362H812C822 250 816 150 820 58ZM1052 58H1010C1018 150 1014 250 1024 362H1060C1050 250 1056 150 1052 58Z" fill="#f4efe1" opacity=".95"/>
  {/* poltrona */}
  <path d="M972 332Q972 302 1004 300H1128Q1160 302 1160 332V428H972Z" fill="#b5c6ab"/><path d="M952 424Q952 402 976 402H1156Q1180 402 1180 424V472H952Z" fill="#a4b799"/>
  <rect x="944" y="390" width="34" height="84" rx="14" fill="#b5c6ab"/><rect x="1154" y="390" width="34" height="84" rx="14" fill="#b5c6ab"/><path d="M962 472v18M1170 472v18" stroke="#8b6f4e" strokeWidth="6" strokeLinecap="round"/>
  <rect x="1010" y="340" width="70" height="56" rx="18" fill="#e7d4b0" transform="rotate(-8 1045 368)"/>
  {/* quadro, prateleira e planta à esquerda */}
  <path d="M440 104L398 118M440 104L482 118" stroke="#b59368" strokeOpacity=".7" strokeWidth="2"/>
  <rect x="390" y="116" width="100" height="130" rx="4" fill="#b99567"/><rect x="398" y="124" width="84" height="114" fill="#f6f3e6"/>
  <circle cx="452" cy="158" r="11" fill="#e8b97a"/><path d="M398 238L424 186L444 212L462 180L482 238Z" fill="#7fa489"/><path d="M398 238Q432 212 482 228V238Z" fill="#5e8a6b"/>
  <rect x="150" y="236" width="180" height="9" rx="3" fill="#c9a57b"/>
  {[[166,16,52,'#285442'],[184,12,44,'#a77d4e'],[198,15,48,'#8a5544'],[215,12,40,'#31495e'],[229,14,46,'#e1d3b4']].map(([x,w,h,c])=><rect key={x} x={x as number} y={236-(h as number)} width={w as number} height={h as number} rx="2" fill={c as string}/>)}
  <path d="M290 236l-6-24h30l-6 24z" fill="#e9e2d0"/>{[-30,0,30].map(r=><path key={r} {...leaf(299,212,r,26,8)} fill="#6f9c78"/>)}
  {PLANT.map(([r,len,w,c])=><path key={r} {...leaf(190,396,r,len,w)} fill={c}/>)}
  <path d="M150 398H230L220 470H160Z" fill="#c98f69"/><rect x="144" y="390" width="92" height="14" rx="4" fill="#d39e78"/>
  {/* relógio, mesinha e abajur à direita do personagem */}
  <circle cx="762" cy="178" r="25" fill="#fffefa" stroke="#b99567" strokeWidth="5"/><path d="M762 178v-14M762 178l9 6" stroke="#26382f" strokeWidth="3" strokeLinecap="round"/>
  <path d="M722 414v56M798 414v56" stroke="#a9875f" strokeWidth="6" strokeLinecap="round"/><rect x="714" y="404" width="92" height="12" rx="4" fill="#c9a27a"/><rect x="722" y="416" width="76" height="30" rx="4" fill="#d9bc95"/><circle cx="760" cy="431" r="3" fill="#a9875f"/>
  <path d="M752 404Q748 384 760 376Q772 384 768 404Z" fill="#a77d4e"/><path d="M738 376H782L773 336H747Z" fill="#f5ecd8"/><rect x="778" y="392" width="22" height="12" rx="2" fill="#285442"/>
  {/* tapete */}
  <ellipse cx="600" cy="560" rx="270" ry="44" fill="#c3d1b8"/><ellipse cx="600" cy="560" rx="238" ry="35" fill="none" stroke="#adbf9f" strokeWidth="3" strokeDasharray="10 8"/>
  {/* noite: escurece o quarto, mostra lua e estrelas e acende o abajur */}
  <g className="sc-night">
   <rect width="1200" height="600" fill="#081009" opacity=".6"/>
   <rect x="850" y="84" width="172" height="242" fill={u('night')}/>{STARS.map(([x,y])=><circle key={x+'.'+y} cx={x} cy={y} r="2" fill="#f4ecd2" opacity=".85"/>)}
   <circle cx="988" cy="128" r="16" fill="#f4ecd2"/><circle cx="996" cy="122" r="14" fill="#0f1c28"/>
   <path d="M932 84h8v242h-8zM850 200h172v8H850z" fill="#3a4540"/>
   <circle cx="760" cy="372" r="210" fill={u('glow')}/><path d="M738 376H782L773 336H747Z" fill="#fbe2ad"/>
  </g>
 </>;}
