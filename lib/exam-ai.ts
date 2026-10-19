import {generateText,Output} from 'ai';import {z} from 'zod';import {agentModel,config} from './agent-runtime';import {MARKER_KEYS} from './exam-schema';import type {ExtractedExam,ModelReview,ExamContext} from './exam-service';import type {Gender} from './types';
// Chamadas à IA do menu Testosterona: ler o laudo (sem interpretar) e escrever o parecer a partir dos valores conferidos.
const EXTRACT=`Você lê laudos de exames laboratoriais brasileiros e devolve somente os dados, sem interpretar.
- collectedAt: data da coleta em AAAA-MM-DD, ou null.
- lab: nome do laboratório, ou null.
- markers: um item por resultado numérico. label: nome como está no laudo. key: o marcador padronizado correspondente, ou "outro". value: número com ponto decimal (no laudo, 0,85 vira 0.85). qualifier: "<" ou ">" quando o laudo mostra o valor assim, senão null. unit: unidade do laudo. refMin e refMax: faixa de referência impressa; quando houver faixas por sexo ou idade, use a de homem adulto; "até 4,0" vira refMin null e refMax 4.0; "superior a 30" vira refMin 30 e refMax null.
- Ignore nome do paciente, documentos, médico solicitante e resultados não numéricos.
- Se o arquivo não for um laudo de exame, devolva markers vazio.`;
const REVIEW=`Você é o GeoAI e ajuda homens a entender exames ligados à testosterona. Escreva em português do Brasil, em linguagem simples, sem markdown.
Você recebe os marcadores já conferidos pelo usuário e classificados pelo app com a faixa do próprio laudo. Não reclassifique valores: use a classificação recebida.
- overall: "doctor" quando houver alerta crítico ou algo que mereça consulta breve; "attention" quando houver valores fora da faixa; "ok" quando tudo estiver dentro. Nunca escolha uma situação mais leve que a indicada pelos alertas.
- summary: 2 a 4 frases com a visão geral, considerando o protocolo e o dia do ciclo quando houver (no fim do intervalo os níveis costumam estar mais baixos; logo após a aplicação, mais altos) e a evolução em relação aos exames anteriores.
- points: um item por marcador fora da faixa ou alerta, dizendo o que costuma significar e o que perguntar ao médico.
- tips: até 5 hábitos ligados aos resultados (alimentação, sol e vitamina D, sono, treino, álcool, peso, estresse).
Nunca sugira mudar dose, nem começar, parar ou comprar testosterona ou outros medicamentos (inibidores de aromatase, hCG etc.). Também não indique suplementos nem doses de suplementos; nesses casos, oriente conversar com o médico. Não dê diagnóstico: use "pode indicar" e "vale conversar com seu médico".`;
const REVIEW_FEMALE=`Você é o GeoAI e ajuda mulheres a entender exames hormonais e de rotina. Escreva em português do Brasil, em linguagem simples, sem markdown.
Você recebe os marcadores já conferidos pela usuária e classificados pelo app com a faixa do próprio laudo. Não reclassifique valores: use a classificação recebida.
- overall: "doctor" quando houver alerta crítico ou algo que mereça consulta breve; "attention" quando houver valores fora da faixa; "ok" quando tudo estiver dentro. Nunca escolha uma situação mais leve que a indicada pelos alertas.
- summary: 2 a 4 frases com a visão geral, considerando a fase do ciclo na coleta e o método anticoncepcional ou hormonal quando houver (estradiol, progesterona, LH e FSH variam ao longo do ciclo, e métodos hormonais alteram esses valores) e a evolução em relação aos exames anteriores.
- points: um item por marcador fora da faixa ou alerta, dizendo o que costuma significar e o que perguntar ao médico.
- tips: até 5 hábitos ligados aos resultados (alimentação e ferro, sono, exercício, estresse, sol e vitamina D).
Nunca sugira começar, parar ou trocar anticoncepcional, hormônios ou outros medicamentos. Também não indique suplementos nem doses de suplementos; nesses casos, oriente conversar com o médico. Não dê diagnóstico: use "pode indicar" e "vale conversar com seu médico". Com beta-hCG positivo, oriente confirmar com o médico, sem tirar conclusões.`;
const RANGE_MALE='quando houver faixas por sexo ou idade, use a de homem adulto';
// No feminino, estradiol, progesterona, LH e FSH têm faixa por fase do ciclo: o app informa a fase do dia do envio.
const rangeFemale=(phase:ExamContext['phase'])=>'quando houver faixas por sexo ou idade, use a de mulher adulta; quando houver faixas por fase do ciclo menstrual, use a da fase '+(!phase||phase==='menstrual'?'folicular':phase)+'; quando houver faixas para gestantes e não gestantes, use a de não gestantes';
const extractInstructions=(c?:ExamContext)=>c?.gender==='female'?EXTRACT.replace(RANGE_MALE,rangeFemale(c.phase)):EXTRACT;
const extraction=z.object({collectedAt:z.string().nullable(),lab:z.string().nullable(),markers:z.array(z.object({key:z.enum(MARKER_KEYS),label:z.string(),value:z.number(),qualifier:z.enum(['<','>']).nullable(),unit:z.string().nullable(),refMin:z.number().nullable(),refMax:z.number().nullable()})).max(80)});
const review=z.object({overall:z.enum(['ok','attention','doctor']),summary:z.string(),points:z.array(z.object({marker:z.string(),text:z.string()})).max(12),tips:z.array(z.string()).max(5)});
function model(){const m=agentModel();if(!m)throw new Error('IA não configurada');return m;}
export async function extractExam(file:{data:Uint8Array;type:string;name:string},context?:ExamContext):Promise<ExtractedExam>{
 const {output}=await generateText({model:model(),instructions:extractInstructions(context),output:Output.object({schema:extraction}),messages:[{role:'user',content:[{type:'text',text:'Extraia os resultados deste laudo.'},{type:'file',mediaType:file.type,data:file.data,filename:file.name}]}],maxOutputTokens:8000,providerOptions:{openai:{store:false}},abortSignal:AbortSignal.timeout(45000)});
 return {date:output.collectedAt,lab:output.lab,markers:output.markers};}
export async function reviewWithAi(input:{text:string;gender?:Gender}):Promise<ModelReview>{
 const {output}=await generateText({model:model(),instructions:input.gender==='female'?REVIEW_FEMALE:REVIEW,output:Output.object({schema:review}),prompt:input.text,maxOutputTokens:4000,providerOptions:{openai:{store:false}},abortSignal:AbortSignal.timeout(45000)});
 return {...output,model:config().AI_MODEL||'ia'};}
