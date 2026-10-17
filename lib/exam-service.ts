import {todayInZone,validDate} from './core.ts';
import {cleanMarkers,cleanReview,MAX_FILE_BYTES,type Marker,type Overall} from './exam-schema.ts';
import {detectFileType,examPrefix,examTitle,FILE_EXT,mergeOverall,reviewContext} from './testosterone.ts';
import type {ExamFileStore,StoredFile} from './exam-files.ts';
import type {Command,Item,Workspace} from './types.ts';

// Casos de uso dos exames com dependências injetadas: as rotas ligam banco, Blob e IA; os testes usam versões em memória.
export type ExtractedExam={date?:string|null;lab?:string|null;markers:unknown[]};
export type ModelReview={overall:Overall;summary:string;points:{marker:string;text:string}[];tips:string[];model:string};
export type ExamDeps={userId:string;load:()=>Promise<{state:Workspace}>;mutate:(command:Command)=>Promise<{state:Workspace;version:number}>;files:ExamFileStore|null;quota:(kind:'exam_upload'|'exam_review',day:string)=>Promise<boolean>;extract:((file:{data:Uint8Array;type:string;name:string})=>Promise<ExtractedExam>)|null;review:((input:{text:string})=>Promise<ModelReview>)|null;now?:()=>Date};
export class ExamError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export const UNREADABLE='Não consegui ler este exame. Confira e digite os valores.';
export const REVIEW_UNAVAILABLE='O parecer da IA está indisponível agora. A classificação dos valores já está salva; tente Revisar de novo em instantes.';
const now=(d:ExamDeps)=>d.now?d.now():new Date();
const result=(r:{state:Workspace;version:number},id:string,warning?:string)=>({...r,exam:r.state.labExams.find(e=>e.id===id) as Item,...(warning?{warning}:{})});
const safeName=(name:string,ext:string)=>name.split('').filter(c=>c>=' '&&c!=='/'&&c!=='\\').join('').trim().slice(0,200)||'exame.'+ext;
function cleanExtracted(x:ExtractedExam,today:string){
 const markers=(Array.isArray(x?.markers)?x.markers:[]).flatMap(m=>{try{return cleanMarkers([m]);}catch{return [] as Marker[];}}).slice(0,80);
 const date=typeof x?.date==='string'&&validDate(x.date)&&x.date<=today?x.date:today;
 const lab=typeof x?.lab==='string'&&x.lab.trim()?x.lab.trim().slice(0,120):undefined;
 return {markers,date,lab};}
async function findExam(d:ExamDeps,id:string){const {state}=await d.load();const exam=state.labExams.find(e=>e.id===id);if(!exam)throw new ExamError('Exame não encontrado.',404);return {state,exam};}

export async function createExamFromFile(d:ExamDeps,input:{bytes:Uint8Array;name:string}){
 if(!d.files)throw new ExamError('Envio de arquivos indisponível no momento. Use Digitar exame.',503);
 if(!input.bytes.length||input.bytes.length>MAX_FILE_BYTES)throw new ExamError('Envie um arquivo de até 4 MB.',413);
 const type=detectFileType(input.bytes);if(!type)throw new ExamError('Envie um PDF ou uma foto (JPEG, PNG ou WEBP).',415);
 const {state}=await d.load();const today=todayInZone(state.profile.timezone,now(d));
 if(!await d.quota('exam_upload',today))throw new ExamError('Você atingiu o limite de envios de hoje. Tente amanhã.',429);
 const id=crypto.randomUUID(),path=examPrefix(d.userId)+id+'-'+crypto.randomUUID().slice(0,8)+'.'+FILE_EXT[type];
 await d.files.save(path,input.bytes,type);
 let read:{markers:Marker[];date:string;lab?:string}={markers:[],date:today};
 if(d.extract){try{read=cleanExtracted(await d.extract({data:input.bytes,type,name:input.name}),today);}catch(e){console.error('exam:extract',e instanceof Error?e.message:'erro');}}
 const exam={id,title:examTitle(read.date),date:read.date,status:'draft',createdOn:today,markers:read.markers,...(read.lab?{lab:read.lab}:{}),file:{path,name:safeName(input.name,FILE_EXT[type]),type,size:input.bytes.length}};
 try{return result(await d.mutate({type:'upsert',collection:'labExams',item:exam}),id,read.markers.length?undefined:UNREADABLE);}
 catch(e){await d.files.remove([path]).catch(()=>{});throw e;}
}
export async function createExamManual(d:ExamDeps){const {state}=await d.load();const today=todayInZone(state.profile.timezone,now(d));const id=crypto.randomUUID();
 return result(await d.mutate({type:'upsert',collection:'labExams',item:{id,title:examTitle(today),date:today,status:'draft',createdOn:today,markers:[]}}),id);}
export async function reviewExam(d:ExamDeps,id:string,input:{date?:unknown;lab?:unknown;markers?:unknown}){
 const {state,exam:current}=await findExam(d,id);const today=todayInZone(state.profile.timezone,now(d));
 if(typeof input.date!=='string'||!validDate(input.date)||input.date>today)throw new ExamError('Informe a data da coleta (hoje ou antes).');
 const markers=cleanMarkers(input.markers);if(!markers.length)throw new ExamError('Informe pelo menos um marcador.');
 const lab=typeof input.lab==='string'&&input.lab.trim()?input.lab.trim().slice(0,120):undefined;
 const exam:Item={...current,date:input.date,title:examTitle(input.date),markers,status:'reviewed'};delete exam.review;delete exam.lab;if(lab)exam.lab=lab;
 const ctx=reviewContext({id,date:input.date,markers},state);let warning:string|undefined;
 if(!d.review)warning=REVIEW_UNAVAILABLE;
 else if(!await d.quota('exam_review',today))warning='Você atingiu o limite de pareceres de hoje. A classificação dos valores já está salva.';
 else{try{const r=await d.review({text:ctx.text});exam.review=cleanReview({...r,overall:mergeOverall(ctx.codeOverall,r.overall),reviewedAt:now(d).toISOString()});}catch(e){console.error('exam:review',e instanceof Error?e.message:'erro');warning=REVIEW_UNAVAILABLE;}}
 return result(await d.mutate({type:'upsert',collection:'labExams',item:exam}),id,warning);
}
export async function deleteExam(d:ExamDeps,id:string){const {exam}=await findExam(d,id);
 if(exam.file){if(!d.files)throw new ExamError('Exclusão de arquivos indisponível no momento. Tente mais tarde.',503);if(typeof exam.file.path==='string'&&exam.file.path.startsWith(examPrefix(d.userId)))await d.files.remove([exam.file.path]);}
 return await d.mutate({type:'delete',collection:'labExams',id});}
export async function readExamFile(d:ExamDeps,id:string):Promise<StoredFile&{name:string}>{const {exam}=await findExam(d,id);const file=exam.file;
 if(!file||!d.files||typeof file.path!=='string'||!file.path.startsWith(examPrefix(d.userId)))throw new ExamError('Arquivo não encontrado.',404);
 const stored=await d.files.read(file.path);if(!stored)throw new ExamError('Arquivo não encontrado.',404);return {...stored,name:file.name};}
