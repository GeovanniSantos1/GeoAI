import {generateText,Output} from 'ai';import {z} from 'zod';import {agentModel} from './agent-runtime';import {normalizeAiFatura} from './fatura';
// Leitura da fatura com a IA: recebe só o texto (o PDF fica no aparelho) e devolve as linhas no formato de lib/fatura.
const INSTRUCTIONS=`Você lê o texto de faturas de cartão de crédito brasileiras e devolve só os dados, sem comentar.
- issuer: banco ou cartão emissor, ou null.
- closingDate e dueDate: data de fechamento e de vencimento em AAAA-MM-DD, ou null.
- total: total da fatura em centavos inteiros (R$ 1.234,56 = 123456), ou null.
- lines: uma linha por compra, saque, tarifa, IOF, juros ou estorno. date: data da compra em AAAA-MM-DD, com o ano deduzido pelo fechamento (compras de meses depois do mês do fechamento são do ano anterior). description: o texto da compra como está, mantendo "PARC 03/10" quando houver. amount: valor em centavos inteiros; estornos e créditos são negativos.
- Ignore pagamentos da fatura, saldo anterior, subtotais, totais e limites.`;
const schema=z.object({issuer:z.string().nullable(),closingDate:z.string().nullable(),dueDate:z.string().nullable(),total:z.number().int().nullable(),lines:z.array(z.object({date:z.string(),description:z.string(),amount:z.number().int()})).max(250)});
export async function readFaturaWithAi(text:string){const model=agentModel();if(!model)throw new Error('IA não configurada');
 const {output}=await generateText({model,instructions:INSTRUCTIONS,output:Output.object({schema}),prompt:text,maxOutputTokens:16000,providerOptions:{openai:{store:false}},abortSignal:AbortSignal.timeout(55000)});
 return normalizeAiFatura(output);}
