// Formato dos exames do menu Testosterona guardados no workspace. Sem dependências: usado pelo core e pelas regras do menu.
export const MARKER_KEYS=['testosterona_total','testosterona_livre','testosterona_biodisponivel','shbg','estradiol','lh','fsh','prolactina','hematocrito','hemoglobina','psa_total','psa_livre','vitamina_d','tsh','t4_livre','glicemia','hba1c','colesterol_total','hdl','ldl','triglicerides','tgo','tgp','creatinina','outro'] as const;
export type MarkerKey=typeof MARKER_KEYS[number];
export type Marker={key:MarkerKey;label:string;value:number;qualifier?:'<'|'>';unit?:string;refMin?:number;refMax?:number};
export const OVERALLS=['ok','attention','doctor'] as const;
export type Overall=typeof OVERALLS[number];
export type ExamReview={overall:Overall;summary:string;points:{marker:string;text:string}[];tips:string[];reviewedAt:string;model:string};
export const FILE_TYPES=['application/pdf','image/jpeg','image/png','image/webp'] as const;
export type FileType=typeof FILE_TYPES[number];
export type ExamFile={path:string;name:string;type:FileType;size:number};
export const MAX_FILE_BYTES=4*1024*1024;
const blank=(v:unknown)=>v===undefined||v===null||v==='';
const text=(v:unknown,max:number,field:string)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error('Campo inválido: '+field);return v.trim();};
const num=(v:unknown,field:string)=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e9)throw new Error('Valor inválido: '+field);return v;};
const record=(v:unknown,message:string)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(message);return v as Record<string,unknown>;};
export function cleanMarkers(raw:unknown):Marker[]{
 if(!Array.isArray(raw)||raw.length>80)throw new Error('Informe até 80 marcadores');
 return raw.map((entry,i)=>{const r=record(entry,'Marcador inválido');const label=text(r.label,80,'marcador '+(i+1));
  const m:Marker={key:(MARKER_KEYS as readonly unknown[]).includes(r.key)?r.key as MarkerKey:'outro',label,value:num(r.value,'valor de '+label)};
  if(r.qualifier==='<'||r.qualifier==='>')m.qualifier=r.qualifier;
  if(!blank(r.unit))m.unit=text(r.unit,30,'unidade de '+label);
  if(!blank(r.refMin))m.refMin=num(r.refMin,'faixa mínima de '+label);
  if(!blank(r.refMax))m.refMax=num(r.refMax,'faixa máxima de '+label);
  if(m.refMin!==undefined&&m.refMax!==undefined&&m.refMin>m.refMax)throw new Error('Faixa invertida em '+label);
  return m;});
}
export function cleanReview(raw:unknown):ExamReview{
 const r=record(raw,'Parecer inválido');
 if(!(OVERALLS as readonly unknown[]).includes(r.overall))throw new Error('Situação do parecer inválida');
 const points=Array.isArray(r.points)?r.points:[],tips=Array.isArray(r.tips)?r.tips:[];
 if(points.length>12||tips.length>8)throw new Error('Parecer muito longo');
 return {overall:r.overall as Overall,summary:text(r.summary,1500,'resumo do parecer'),points:points.map(p=>{const q=record(p,'Ponto do parecer inválido');return {marker:text(q.marker,80,'ponto do parecer'),text:text(q.text,600,'ponto do parecer')};}),tips:tips.map(t=>text(t,300,'dica')),reviewedAt:text(r.reviewedAt,40,'data do parecer'),model:text(r.model,80,'modelo')};
}
export function cleanFile(raw:unknown):ExamFile{
 const r=record(raw,'Arquivo inválido');const path=text(r.path,300,'arquivo');
 if(!/^exames\/[\w-]+\/[\w.-]+$/.test(path)||path.includes('..'))throw new Error('Arquivo inválido');
 if(!(FILE_TYPES as readonly unknown[]).includes(r.type))throw new Error('Tipo de arquivo não aceito');
 const size=num(r.size,'tamanho do arquivo');if(!Number.isInteger(size)||size<1||size>MAX_FILE_BYTES)throw new Error('Arquivo muito grande');
 return {path,name:text(r.name,200,'nome do arquivo'),type:r.type as FileType,size};
}
