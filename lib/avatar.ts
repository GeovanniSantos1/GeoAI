import type { Gender, Profile } from './types.ts';
import { HAIR_STYLES, HAIR_CUTS } from './gender.ts';
// Cenários do palco em Sua jornada e leitura da foto para o avatar.
export const SCENES=[['quarto','Quarto'],['parque','Parque'],['academia','Academia'],['praia','Praia'],['escritorio','Escritório']] as const;
// O que a IA devolve ao olhar a foto; o app aproveita só o que o desenho conhece.
export type PhotoAnalysis={face:boolean;skin:string;hair:string;style:string;cut:string;beard:boolean;glasses:boolean;earrings:boolean};
const HEX=/^#[0-9a-f]{6}$/i;
// Sem rosto na foto devolve null. Pele e cabelo só entram como #rrggbb; penteado e brincos valem no feminino, corte e barba no masculino.
export function lookFromAnalysis(r:PhotoAnalysis,gender:Gender):Partial<Profile['avatar']>|null{
 if(!r||r.face!==true)return null;const look:Partial<Profile['avatar']>={glasses:r.glasses===true};
 if(typeof r.skin==='string'&&HEX.test(r.skin))look.skin=r.skin.toLowerCase();
 if(typeof r.hair==='string'&&HEX.test(r.hair))look.hair=r.hair.toLowerCase();
 if(gender==='female'){const style=HAIR_STYLES.find(([id])=>id===r.style);if(style)look.style=style[0];look.earrings=r.earrings===true;}
 else{const cut=HAIR_CUTS.find(([id])=>id===r.cut);if(cut)look.cut=cut[0];look.beard=r.beard===true;}
 return look;}
