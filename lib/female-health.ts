// Regras do menu Saúde feminina. Datas, previsões e alertas são calculados aqui; a IA só lê laudos e escreve pareceres.
// Não importa o core: o core usa este arquivo para validar registros e montar a agenda.
export const SYMPTOMS=['Cólica','Dor de cabeça','Inchaço','Seios sensíveis','Acne','Cansaço','Alteração de humor','Ansiedade','Insônia','Desejo por doce','Náusea','Sangramento fora do período'] as const;
export const FLOWS=[['leve','Leve'],['moderado','Moderado'],['intenso','Intenso']] as const;
export const METHODS=[['daily','Uso diário (pílula, comprimido ou gel)'],['injection','Injeção'],['iud','DIU ou implante']] as const;
export const METHOD_SHORT:Record<string,string>={daily:'uso diário',injection:'injeção',iud:'DIU ou implante'};
export const FLOW_LABEL:Record<string,string>=Object.fromEntries(FLOWS);
