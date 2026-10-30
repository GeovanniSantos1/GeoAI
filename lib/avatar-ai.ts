import {generateText,Output} from 'ai';import {z} from 'zod';import {agentModel} from './agent-runtime';import {HAIR_STYLES,HAIR_CUTS} from './gender';import type {PhotoAnalysis} from './avatar';
// "Criar a partir de uma foto": a IA descreve a aparência para o avatar ilustrado, sem identificar a pessoa. Nada fica guardado.
const INSTRUCTIONS=`Você olha a foto de uma pessoa e descreve a aparência dela para montar um avatar ilustrado. Não identifique a pessoa, não estime idade e não comente a foto.
- face: true se houver um rosto humano real visível; false para desenhos, objetos, paisagens ou rosto coberto. Quando for false, preencha o resto com qualquer valor válido.
- skin: cor da pele do rosto em #rrggbb, como seria sob luz neutra (ignore sombras, reflexos, maquiagem forte e filtros).
- hair: cor principal do cabelo em #rrggbb sob luz neutra; para cabelo grisalho use um cinza; se a pessoa for careca, use a cor da barba ou das sobrancelhas.
- style, penteado no desenho feminino: longo (passa dos ombros, solto, liso ou ondulado), curto (até o queixo ou o pescoço), cacheado (cachos ou crespo com volume), coque (preso no alto, coque ou rabo de cavalo).
- cut, corte no desenho masculino: curto (cabelo curto com volume no alto), cacheado (cachos ou crespo no alto), raspado (máquina, bem rente), careca (sem cabelo no alto da cabeça).
- beard: true se houver barba ou cavanhaque visível.
- glasses: true se a pessoa usar óculos de grau ou de sol.
- earrings: true se houver brincos visíveis.`;
const ids=<T extends readonly (readonly [string,string])[]>(list:T)=>list.map(([id])=>id) as [T[number][0],...T[number][0][]];
const analysis=z.object({face:z.boolean(),skin:z.string(),hair:z.string(),style:z.enum(ids(HAIR_STYLES)),cut:z.enum(ids(HAIR_CUTS)),beard:z.boolean(),glasses:z.boolean(),earrings:z.boolean()});
export async function readAvatarPhoto(photo:{data:Uint8Array;type:string}):Promise<PhotoAnalysis>{const model=agentModel();if(!model)throw new Error('IA não configurada');
 const {output}=await generateText({model,instructions:INSTRUCTIONS,output:Output.object({schema:analysis}),messages:[{role:'user',content:[{type:'text',text:'Descreva a aparência desta pessoa para o avatar.'},{type:'file',mediaType:photo.type,data:photo.data}]}],maxOutputTokens:1000,providerOptions:{openai:{store:false}},abortSignal:AbortSignal.timeout(40000)});
 return output;}
