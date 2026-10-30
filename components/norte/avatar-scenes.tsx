'use client';import {useId,type ReactNode} from 'react';import type {AvatarScene} from '@/lib/types';
// Cenários do palco em 1200x600: o personagem fica no centro e, no celular, o corte (slice) mostra só o miolo (x 360 a 840), por isso cada um tem algo perto dele.
// No tema escuro o grupo sc-night escurece a cena e acende as luzes; sc-day some.
type U={g:(n:string)=>string;u:(n:string)=>string};
export const leaf=(x:number,y:number,angle:number,len:number,w:number)=>({d:`M0 0C${w} ${-len*.3} ${w*.8} ${-len*.8} 0 ${-len}C${-w*.8} ${-len*.8} ${-w} ${-len*.3} 0 0Z`,transform:`translate(${x} ${y}) rotate(${angle})`});
const lin=(id:string,top:string,bottom:string)=><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top}/><stop offset="1" stopColor={bottom}/></linearGradient>;
// Céu de dia e de noite, brilho das luzes e degradês próprios de cada cenário.
function Defs({g,extra}:{g:U['g'];extra?:ReactNode}){return <defs>{lin(g('sky'),'#c8e0e4','#eef4e8')}{lin(g('night'),'#0d1824','#1f3445')}{lin(g('floor'),'#e3d1b2','#d2bc98')}<radialGradient id={g('glow')}><stop offset="0" stopColor="#ffd894" stopOpacity=".5"/><stop offset="1" stopColor="#ffd894" stopOpacity="0"/></radialGradient>{extra}</defs>;}
const Dim=()=><rect width="1200" height="600" fill="#081009" opacity=".6"/>;
const Stars=({at}:{at:number[][]})=><>{at.map(([x,y])=><circle key={x+'.'+y} cx={x} cy={y} r="2" fill="#f4ecd2" opacity=".85"/>)}</>;
const Moon=({x,y}:{x:number;y:number})=><><circle cx={x} cy={y} r="46" fill="#f4ecd2" opacity=".1"/><circle cx={x} cy={y} r="22" fill="#f4ecd2"/><circle cx={x-7} cy={y-4} r="4" fill="#000" opacity=".06"/><circle cx={x+6} cy={y+7} r="3" fill="#000" opacity=".06"/></>;
const Cloud=({x,y}:{x:number;y:number})=><g fill="#fff" opacity=".9"><ellipse cx={x} cy={y} rx="48" ry="17"/><circle cx={x-18} cy={y-10} r="19"/><circle cx={x+14} cy={y-15} r="24"/></g>;
const Planks=()=><path d="M0 482H1200M0 524H1200M0 572H1200M180 446l-8 36M520 482l-6 42M860 446l6 36M300 524l-8 48M1010 524l8 48M700 572l-4 28" stroke="#000" strokeOpacity=".05" strokeWidth="2"/>;
const Floor=({u,base='#f8f7f0'}:{u:U['u'];base?:string})=><><rect y="446" width="1200" height="154" fill={u('floor')}/><Planks/><rect y="430" width="1200" height="16" fill={base}/><path d="M0 446H1200" stroke="#000" strokeOpacity=".07" strokeWidth="2"/></>;
const Book=({x,y,w,h,c}:{x:number;y:number;w:number;h:number;c:string})=><rect x={x} y={y-h} width={w} height={h} rx="2" fill={c}/>;
const BOOKS=['#285442','#a77d4e','#8a5544','#31495e','#e1d3b4','#b9606f'];

export function Scene({id,name}:{id:string;name:AvatarScene}){const ids:U={g:n=>id+n,u:n=>'url(#'+id+n+')'};
 return name==='parque'?<Park {...ids}/>:name==='academia'?<Gym {...ids}/>:name==='praia'?<Beach {...ids}/>:name==='escritorio'?<Office {...ids}/>:<Room {...ids}/>;}
// Miniatura do cenário para o seletor (sem o personagem).
export function SceneThumb({name}:{name:AvatarScene}){const id=useId();return <svg className="scene-thumb" viewBox="240 40 720 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><Scene id={id} name={name}/></svg>;}

const PLANT=[[-62,150,30,'#4d7a59'],[-34,170,32,'#5d8b68'],[-10,182,30,'#6f9c78'],[14,176,30,'#5d8b68'],[38,160,32,'#4d7a59'],[60,138,28,'#6f9c78']] as const;
const Plant=({x,y,s=1}:{x:number;y:number;s?:number})=><g transform={`translate(${x} ${y}) scale(${s})`}>{PLANT.map(([r,len,w,c])=><path key={r} {...leaf(0,0,r,len,w)} fill={c}/>)}<path d="M-40 2H40L30 74H-30Z" fill="#c98f69"/><rect x="-46" y="-6" width="92" height="14" rx="4" fill="#d39e78"/></g>;
function Room({g,u}:U){return <>
 <Defs g={g} extra={lin(g('wall'),'#f1f2e9','#e2e7d8')}/>
 <rect width="1200" height="440" fill={u('wall')}/><Floor u={u}/>
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
 {[[166,16,52],[184,12,44],[198,15,48],[215,12,40],[229,14,46]].map(([x,w,h],i)=><Book key={x} x={x} y={236} w={w} h={h} c={BOOKS[i]}/>)}
 <path d="M290 236l-6-24h30l-6 24z" fill="#e9e2d0"/>{[-30,0,30].map(r=><path key={r} {...leaf(299,212,r,26,8)} fill="#6f9c78"/>)}
 <Plant x={190} y={396}/>
 {/* relógio, mesinha e abajur à direita do personagem */}
 <circle cx="762" cy="178" r="25" fill="#fffefa" stroke="#b99567" strokeWidth="5"/><path d="M762 178v-14M762 178l9 6" stroke="#26382f" strokeWidth="3" strokeLinecap="round"/>
 <path d="M722 414v56M798 414v56" stroke="#a9875f" strokeWidth="6" strokeLinecap="round"/><rect x="714" y="404" width="92" height="12" rx="4" fill="#c9a27a"/><rect x="722" y="416" width="76" height="30" rx="4" fill="#d9bc95"/><circle cx="760" cy="431" r="3" fill="#a9875f"/>
 <path d="M752 404Q748 384 760 376Q772 384 768 404Z" fill="#a77d4e"/><path d="M738 376H782L773 336H747Z" fill="#f5ecd8"/><rect x="778" y="392" width="22" height="12" rx="2" fill="#285442"/>
 <ellipse cx="600" cy="560" rx="270" ry="44" fill="#c3d1b8"/><ellipse cx="600" cy="560" rx="238" ry="35" fill="none" stroke="#adbf9f" strokeWidth="3" strokeDasharray="10 8"/>
 <g className="sc-night"><Dim/>
  <rect x="850" y="84" width="172" height="242" fill={u('night')}/><Stars at={[[880,110],[930,150],[968,104],[900,230],[1000,200],[952,262],[870,180]]}/>
  <circle cx="988" cy="128" r="16" fill="#f4ecd2"/><circle cx="996" cy="122" r="14" fill="#0f1c28"/>
  <path d="M932 84h8v242h-8zM850 200h172v8H850z" fill="#3a4540"/>
  <circle cx="760" cy="372" r="210" fill={u('glow')}/><path d="M738 376H782L773 336H747Z" fill="#fbe2ad"/>
 </g>
</>;}

const Tree=({x,y=440}:{x:number;y?:number})=><><rect x={x-12} y={y-200} width="24" height="200" rx="8" fill="#8b6a4a"/>{[[0,-240,74,'#6f9c78'],[-56,-200,52,'#5d8b68'],[58,-204,56,'#5d8b68'],[0,-290,52,'#7fa489']].map(([dx,dy,r,c])=><circle key={dx+'.'+dy} cx={x+(dx as number)} cy={y+(dy as number)} r={r} fill={c as string}/>)}</>;
const FLOWERS=[[300,500,'#e8b97a'],[340,540,'#f6f3e6'],[250,560,'#b9606f'],[930,510,'#e8b97a'],[980,560,'#f6f3e6'],[1050,520,'#b9606f'],[150,470,'#f6f3e6'],[1120,480,'#e8b97a']] as const;
function Park({g,u}:U){return <>
 <Defs g={g} extra={lin(g('grass'),'#b9d3a2','#9dbc86')}/>
 <g className="sc-day"><rect width="1200" height="440" fill={u('sky')}/><circle cx="960" cy="104" r="60" fill="#fbe3a6" opacity=".35"/><circle cx="960" cy="104" r="34" fill="#fbe3a6"/><Cloud x={330} y={110}/><Cloud x={720} y={74}/></g>
 <g className="sc-night"><rect width="1200" height="440" fill={u('night')}/></g>
 <path d="M0 350Q200 290 420 330T820 320T1200 335V440H0Z" fill="#b8d0ac"/><path d="M0 395Q300 355 600 388T1200 382V440H0Z" fill="#a3c296"/>
 <rect y="430" width="1200" height="170" fill={u('grass')}/>
 <path d="M360 600C470 520 560 470 590 432H650C660 470 720 530 880 600Z" fill="#e9dfc6"/><path d="M590 432H650" stroke="#000" strokeOpacity=".05" strokeWidth="2"/>
 <Tree x={170}/><Tree x={1040}/>
 <circle cx="452" cy="438" r="26" fill="#7fa489"/><circle cx="484" cy="446" r="20" fill="#6f9c78"/><circle cx="800" cy="440" r="22" fill="#7fa489"/>
 <rect x="396" y="250" width="8" height="200" rx="3" fill="#3f4140"/><path d="M386 252h28l-5-20h-18z" fill="#3f4140"/><rect x="390" y="232" width="20" height="18" rx="3" fill="#f6eedb"/>
 <path d="M752 430v30M868 430v30M758 404v22M862 404v22" stroke="#3f4140" strokeWidth="6" strokeLinecap="round"/>
 <rect x="742" y="390" width="136" height="9" rx="3" fill="#a77d4e"/><rect x="742" y="403" width="136" height="9" rx="3" fill="#b8916a"/><rect x="736" y="424" width="148" height="10" rx="3" fill="#a77d4e"/>
 {FLOWERS.map(([x,y,c])=><circle key={x} cx={x} cy={y} r="5" fill={c}/>)}
 <g className="sc-night"><Dim/><Moon x={860} y={92}/><Stars at={[[300,70],[520,120],[640,60],[980,150],[1100,80],[440,190],[720,180]]}/><circle cx="400" cy="250" r="170" fill={u('glow')}/><rect x="390" y="232" width="20" height="18" rx="3" fill="#fbe2ad"/></g>
</>;}

const Dumbbell=({x,y,c}:{x:number;y:number;c:string})=><><rect x={x-11} y={y-2} width="22" height="4" rx="2" fill="#6b706c"/><rect x={x-16} y={y-8} width="7" height="16" rx="2" fill={c}/><rect x={x+9} y={y-8} width="7" height="16" rx="2" fill={c}/></>;
const Kettlebell=({x,y,c}:{x:number;y:number;c:string})=><><path d={`M${x-11} ${y-12}Q${x} ${y-36} ${x+11} ${y-12}`} fill="none" stroke={c} strokeWidth="6"/><circle cx={x} cy={y} r="18" fill={c}/><ellipse cx={x-6} cy={y-6} rx="5" ry="3" fill="#fff" opacity=".18"/></>;
function Gym({g,u}:U){return <>
 <Defs g={g} extra={lin(g('wall'),'#eceee8','#dfe3db')}/>
 <rect width="1200" height="440" fill={u('wall')}/><rect y="292" width="1200" height="10" fill="#8fae94" opacity=".6"/><Floor u={u}/>
 {/* janela alta */}
 <rect x="372" y="52" width="456" height="146" rx="6" fill="#fffefa"/><rect x="384" y="64" width="432" height="122" fill={u('sky')}/>
 <path d="M384 186Q450 150 520 176Q600 140 680 172Q750 150 816 178V186Z" fill="#b6ceb0"/><path d="M524 64v122M672 64v122" stroke="#fffefa" strokeWidth="8"/>
 {/* luminárias pendentes */}
 <path d="M520 0v22M680 0v22" stroke="#3f4140" strokeWidth="2"/><path d="M500 40Q520 14 540 40ZM660 40Q680 14 700 40Z" fill="#3f4140"/>
 {/* espaldar à esquerda */}
 <rect x="180" y="120" width="12" height="326" rx="4" fill="#c9a27a"/><rect x="308" y="120" width="12" height="326" rx="4" fill="#c9a27a"/>
 {[150,192,234,276,318,360,402].map(y=><rect key={y} x="192" y={y} width="116" height="8" rx="4" fill="#d9bc95"/>)}
 {/* suporte de halteres à direita */}
 <path d="M748 446V372M892 446V372" stroke="#3f4140" strokeWidth="8" strokeLinecap="round"/><rect x="740" y="384" width="160" height="7" rx="3" fill="#3f4140"/><rect x="740" y="420" width="160" height="7" rx="3" fill="#3f4140"/>
 {[[768,'#285442'],[806,'#a77d4e'],[844,'#2f3532'],[880,'#285442']].map(([x,c])=><Dumbbell key={x} x={x as number} y={376} c={c as string}/>)}
 {[[768,'#2f3532'],[806,'#285442'],[844,'#a77d4e'],[880,'#2f3532']].map(([x,c])=><Dumbbell key={x} x={x as number} y={412} c={c as string}/>)}
 <circle cx="1010" cy="150" r="25" fill="#fffefa" stroke="#3f4140" strokeWidth="5"/><path d="M1010 150v-14M1010 150l9 6" stroke="#26382f" strokeWidth="3" strokeLinecap="round"/>
 <Plant x={1090} y={400} s={.8}/>
 <path d="M478 520H722L762 584H438Z" fill="#8fae94"/><path d="M478 520H722L725 526H475Z" fill="#7a9c80"/>
 <Kettlebell x={410} y={510} c="#3f4140"/><Kettlebell x={448} y={528} c="#285442"/>
 <rect x="912" y="414" width="18" height="44" rx="7" fill="#eef3ea"/><rect x="915" y="406" width="12" height="10" rx="3" fill="#285442"/>
 <g className="sc-night"><Dim/>
  <rect x="384" y="64" width="432" height="122" fill={u('night')}/><Stars at={[[420,90],[470,140],[560,84],[620,130],[720,96],[780,150]]}/><path d="M524 64v122M672 64v122" stroke="#3a4540" strokeWidth="8"/>
  <circle cx="520" cy="60" r="170" fill={u('glow')}/><circle cx="680" cy="60" r="170" fill={u('glow')}/><path d="M504 40h32M664 40h32" stroke="#fbe2ad" strokeWidth="4" strokeLinecap="round"/>
 </g>
</>;}

function Beach({g,u}:U){return <>
 <Defs g={g} extra={<>{lin(g('beach'),'#bfe2ee','#f6ecd6')}{lin(g('sea'),'#7cbccb','#a8d6d4')}{lin(g('sand'),'#efdcb4','#e3c995')}</>}/>
 <g className="sc-day"><rect width="1200" height="300" fill={u('beach')}/><circle cx="900" cy="170" r="70" fill="#ffd98e" opacity=".3"/><circle cx="900" cy="170" r="42" fill="#ffd98e"/><Cloud x={420} y={90}/><Cloud x={1080} y={70}/></g>
 <g className="sc-night"><rect width="1200" height="300" fill={u('night')}/></g>
 <rect y="300" width="1200" height="140" fill={u('sea')}/>
 <path d="M40 330h60M180 352h80M420 336h50M640 360h70M860 340h60M1040 362h80M300 396h70M760 400h60M520 384h40" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round"/>
 <path d="M520 298l18-34v34z" fill="#fffefa"/><path d="M508 300h42l-6 6h-30z" fill="#a77d4e"/>
 <path d="M0 426Q150 408 300 424T600 420T900 426T1200 420V448H0Z" fill="#f6efe0" opacity=".9"/>
 <path d="M0 440Q300 426 600 438T1200 436V600H0Z" fill={u('sand')}/>
 {[[120,500],[260,560],[420,470],[700,590],[960,560],[1100,500],[880,470]].map(([x,y])=><circle key={x} cx={x} cy={y} r="2.5" fill="#c9ab78"/>)}
 {/* coqueiro */}
 <path d="M196 470C188 400 200 320 248 252" fill="none" stroke="#a7845d" strokeWidth="20" strokeLinecap="round"/>
 <path d="M190 440h22M190 410h22M194 380h22M200 350h22M210 320h22M222 292h20" stroke="#8b6a4a" strokeWidth="3" strokeLinecap="round"/>
 {[[-120,130,'#5d8b68'],[-80,140,'#6f9c78'],[-40,124,'#4d7a59'],[30,120,'#6f9c78'],[70,136,'#5d8b68'],[110,128,'#4d7a59']].map(([r,len,c])=><path key={r} {...leaf(250,252,r as number,len as number,22)} fill={c as string}/>)}
 <circle cx="242" cy="262" r="9" fill="#8b6a4a"/><circle cx="258" cy="266" r="9" fill="#7a5c3e"/>
 {/* guarda-sol e toalha */}
 <path d="M820 290L804 540" stroke="#f6f3e6" strokeWidth="6" strokeLinecap="round"/>
 <path d="M708 322Q812 212 932 312Z" fill="#b9606f"/><path d="M770 316Q786 252 818 232Q804 272 802 316ZM860 316Q856 262 818 232Q866 252 896 316Z" fill="#f6f3e6"/>
 <path d="M690 522L862 512L874 548L702 558Z" fill="#285442"/><path d="M694 534L866 524" stroke="#f6f3e6" strokeWidth="5"/>
 <path d="M452 548l6 12 13 1-10 8 4 13-13-7-11 8 2-13-10-9 13-1z" fill="#e8a37a"/>
 <g className="sc-night"><Dim/><Moon x={980} y={96}/><Stars at={[[420,60],[560,120],[700,70],[860,150],[1110,60],[640,200],[360,150]]}/>
  <path d="M960 316h40M950 340h60M966 364h30M956 392h48M970 416h22" stroke="#f4ecd2" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round"/></g>
</>;}

const BUILDINGS=[[262,250,40],[300,200,34],[332,226,38],[368,170,40],[406,214,32],[436,236,44]];
function Office({g,u}:U){return <>
 <Defs g={g} extra={<>{lin(g('wall'),'#f3f0e7','#e7e2d4')}<radialGradient id={g('screen')}><stop offset="0" stopColor="#8fb3d1" stopOpacity=".4"/><stop offset="1" stopColor="#8fb3d1" stopOpacity="0"/></radialGradient></>}/>
 <rect width="1200" height="440" fill={u('wall')}/><Floor u={u}/>
 {/* janela com a cidade */}
 <rect x="246" y="76" width="244" height="262" rx="6" fill="#fffefa"/><rect x="258" y="88" width="220" height="238" fill={u('sky')}/>
 {BUILDINGS.map(([x,y,w])=><rect key={x} x={x} y={y} width={w} height={326-y} fill="#b9c8cb"/>)}
 <path d="M364 88v238M258 204h220" stroke="#fffefa" strokeWidth="8"/><rect x="238" y="336" width="260" height="12" rx="3" fill="#f6f4ec"/>
 {/* estante */}
 <rect x="56" y="140" width="150" height="306" rx="6" fill="#c9a27a"/><rect x="66" y="150" width="130" height="288" fill="#e9dcc4"/>
 {[214,288,362,436].map((y,s)=><g key={y}><rect x="66" y={y} width="130" height="8" fill="#c9a27a"/>{[0,1,2,3,4].map(i=><Book key={i} x={74+i*22+(s%2)*6} y={y} w={16} h={40+((i*7+s*5)%22)} c={BOOKS[(i+s)%6]}/>)}</g>)}
 {/* prateleira e relógio */}
 <rect x="760" y="226" width="180" height="9" rx="3" fill="#c9a27a"/><rect x="772" y="190" width="30" height="36" rx="3" fill="#b99567"/><rect x="777" y="195" width="20" height="26" fill="#e3ecdf"/>
 <path d="M900 226l-5-22h26l-5 22z" fill="#e9e2d0"/>{[-30,0,30].map(r=><path key={r} {...leaf(908,204,r,24,8)} fill="#6f9c78"/>)}
 {[[818,12,30],[832,10,26],[844,13,32]].map(([x,w,h],i)=><Book key={x} x={x} y={226} w={w} h={h} c={BOOKS[i+2]}/>)}
 <circle cx="712" cy="150" r="24" fill="#fffefa" stroke="#b99567" strokeWidth="5"/><path d="M712 150v-13M712 150l8 6" stroke="#26382f" strokeWidth="3" strokeLinecap="round"/>
 {/* cadeira, mesa, notebook, caneca e luminária */}
 <rect x="866" y="300" width="74" height="90" rx="16" fill="#285442"/><path d="M903 384v70M876 470l27-16 27 16" stroke="#3f4140" strokeWidth="6" strokeLinecap="round" fill="none"/>
 <rect x="720" y="372" width="290" height="12" rx="4" fill="#c9a27a"/><path d="M732 384v86M998 384v86" stroke="#a9875f" strokeWidth="7" strokeLinecap="round"/><rect x="930" y="384" width="62" height="60" rx="4" fill="#d9bc95"/><circle cx="961" cy="414" r="3" fill="#a9875f"/>
 <rect x="762" y="314" width="92" height="54" rx="5" fill="#31495e"/><rect x="768" y="320" width="80" height="42" rx="2" fill="#4c6a83"/><path d="M776 332h40M776 342h56M776 352h30" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round"/><path d="M750 366h116l-6 6H756Z" fill="#3f4140"/>
 <rect x="878" y="350" width="20" height="22" rx="3" fill="#f6f3e6"/><path d="M898 356q8 0 8 6t-8 6" fill="none" stroke="#f6f3e6" strokeWidth="3"/>
 <path d="M972 372l-4-36 22-22" fill="none" stroke="#3f4140" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M978 304l26 8-10 18z" fill="#a77d4e"/><rect x="960" y="366" width="26" height="6" rx="2" fill="#3f4140"/>
 <Plant x={1110} y={390} s={.75}/>
 <ellipse cx="600" cy="560" rx="270" ry="44" fill="#d6c4a6"/><ellipse cx="600" cy="560" rx="238" ry="35" fill="none" stroke="#c4af8c" strokeWidth="3" strokeDasharray="10 8"/>
 <g className="sc-night"><Dim/>
  <rect x="258" y="88" width="220" height="238" fill={u('night')}/>{BUILDINGS.map(([x,y,w])=><rect key={x} x={x} y={y} width={w} height={326-y} fill="#1b2630"/>)}
  {BUILDINGS.flatMap(([x,y,w],i)=>[0,1,2].map(r=><rect key={x+'.'+r} x={x+6+(r+i)%2*(w-18)} y={y+14+r*26} width="6" height="8" fill="#f3d38a" opacity=".8"/>))}
  <Stars at={[[280,110],[330,130],[420,104],[460,150]]}/><path d="M364 88v238M258 204h220" stroke="#3a4540" strokeWidth="8"/>
  <rect x="768" y="320" width="80" height="42" rx="2" fill="#8fb3d1"/><circle cx="808" cy="340" r="150" fill={u('screen')}/>
  <circle cx="992" cy="330" r="190" fill={u('glow')}/><path d="M978 304l26 8-10 18z" fill="#fbe2ad"/>
 </g>
</>;}
