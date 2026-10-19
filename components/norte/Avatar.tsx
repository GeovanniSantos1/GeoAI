'use client';import {useId} from 'react';import type {Profile} from '@/lib/types';
// O tema escuro pinta o fundo pelo primeiro rect e pelo primeiro circle do grupo: os desenhos mantêm essa ordem e não aninham grupos.
export default function Avatar({profile,small=false}:{profile:Profile;small?:boolean}){const a=profile.avatar,clip=useId(),female=profile.gender==='female';return <svg className={'person-avatar '+(small?'small':'')} viewBox="0 0 240 270" role="img" aria-label="Seu avatar GeoAI"><defs><clipPath id={clip}><rect x="0" y="0" width="240" height="270" rx="100"/></clipPath></defs><g clipPath={'url(#'+clip+')'}><rect width="240" height="270" fill="#e8eadf"/><circle cx="120" cy="102" r="92" fill="#d8dfcb"/>{female?<Female a={a}/>:<Male a={a}/>}<path d="m174 238 10-16 10 16-10-4z" fill="#d4b078"/></g></svg>;}
type Look=Profile['avatar'];
function Male({a}:{a:Look}){return <><path d="M32 280v-47q0-46 60-57h56q60 11 60 57v47" fill={a.shirt}/><path d="M101 151v29q19 25 38 0v-29" fill={a.skin}/><path d="M99 163q21 15 42 0v-12H99" fill="#000" opacity=".08"/><ellipse cx="78" cy="109" rx="9" ry="15" fill={a.skin}/><ellipse cx="163" cy="109" rx="9" ry="15" fill={a.skin}/><path d="M77 86q0-43 43-43t44 43v37q-2 45-44 49-41-4-43-49z" fill={a.skin}/><path d="M76 100V74q-2-31 26-34 9-19 36-9 33 6 28 47l-3 22-9-31q-21 13-47-4-13 13-25 15z" fill={a.hair}/><path d="m93 99 17-2m21 0 16 2" stroke={a.hair} strokeWidth="4" strokeLinecap="round"/><circle cx="102" cy="111" r="3" fill="#302b28"/><circle cx="138" cy="111" r="3" fill="#302b28"/><path d="m119 113-4 15h7" fill="none" stroke="#000" opacity=".13" strokeWidth="3" strokeLinecap="round"/>{a.beard?<path d="m79 120 15 21q27 14 52 0l16-21q-1 41-42 51-39-8-41-51m24 23q17 13 34 0" fill={a.hair}/>:<path d="M106 144q14 9 28 0" fill="none" stroke="#54372a" strokeWidth="3" strokeLinecap="round"/>}<path d="m86 185 14 23 20-14 20 14 15-23" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="2"/><path d="M120 197v78" stroke="#fff" strokeOpacity=".08" strokeWidth="2"/></>;}
const CURLS=[[60,84,17],[62,114,17],[70,142,16],[74,56,17],[96,36,18],[122,30,18],[148,36,18],[168,56,17],[180,84,17],[178,114,17],[170,142,16],[84,160,14],[156,160,14]];
function Female({a}:{a:Look}){const s=a.style;return <>
 {s==='longo'&&<path d="M68 102q0-66 52-66t52 66v98q-12 8-26 4V150H94v54q-14 4-26-4z" fill={a.hair}/>}
 {s==='cacheado'&&<><ellipse cx="120" cy="96" rx="66" ry="62" fill={a.hair}/>{CURLS.map(([cx,cy,r])=><circle key={cx+'-'+cy} cx={cx} cy={cy} r={r} fill={a.hair}/>)}</>}
 {s==='coque'&&<circle cx="120" cy="34" r="20" fill={a.hair}/>}
 <path d="M32 280v-47q0-46 60-57h56q60 11 60 57v47" fill={a.shirt}/>
 {s==='longo'&&<><path d="M68 160q-4 34 6 58q12 4 22-4-6-26-4-54z" fill={a.hair}/><path d="M172 160q4 34-6 58q-12 4-22-4 6-26 4-54z" fill={a.hair}/></>}
 <path d="M96 175q24 36 48 0z" fill={a.skin}/><path d="M103 150v28q17 22 34 0v-28" fill={a.skin}/>
 <path d="M101 179q19 24 38 0" fill="none" stroke="#d4b078" strokeWidth="1.5"/><circle cx="120" cy="191" r="2.5" fill="#d4b078"/>
 <path d="M103 160q17 13 34 0v-10h-34" fill="#000" opacity=".08"/>
 <ellipse cx="81" cy="110" rx="8" ry="13" fill={a.skin}/><ellipse cx="159" cy="110" rx="8" ry="13" fill={a.skin}/>
 {a.earrings&&<><circle cx="80" cy="128" r="4.5" fill="none" stroke="#d4b078" strokeWidth="2"/><circle cx="160" cy="128" r="4.5" fill="none" stroke="#d4b078" strokeWidth="2"/></>}
 <path d="M80 88q0-44 40-44t40 44v34q-2 42-40 48-38-6-40-48z" fill={a.skin}/>
 {s==='longo'&&<path d="M76 104Q72 38 122 38Q170 40 164 104Q156 72 134 62Q110 86 76 104z" fill={a.hair}/>}
 {s==='cacheado'&&<path d="M78 98q-6-58 42-58 48 0 42 58-6-12-16-12-4-12-16-10-8-10-16-2-10-6-16 4-10-2-16 20z" fill={a.hair}/>}
 {s==='coque'&&<><path d="M77 106Q70 40 120 40T163 106Q160 74 140 62Q120 56 100 62Q80 74 77 106z" fill={a.hair}/><path d="M120 42v16" stroke="#000" opacity=".12" strokeWidth="2"/></>}
 <path d="M92 100q8-6 17-3M131 97q9-3 17 3" fill="none" stroke={a.hair} strokeWidth="3" strokeLinecap="round"/>
 <circle cx="102" cy="112" r="3.2" fill="#302b28"/><circle cx="138" cy="112" r="3.2" fill="#302b28"/>
 <path d="M98 109l-3-3M142 109l3-3" stroke="#302b28" strokeWidth="2" strokeLinecap="round"/>
 <path d="m119 114-3 13h6" fill="none" stroke="#000" opacity=".13" strokeWidth="3" strokeLinecap="round"/>
 <ellipse cx="96" cy="129" rx="7" ry="4" fill="#e0806e" opacity=".22"/><ellipse cx="144" cy="129" rx="7" ry="4" fill="#e0806e" opacity=".22"/>
 <path d="M109 143q11 9 22 0q-11 3-22 0z" fill="#b8615a"/>
</>;}
