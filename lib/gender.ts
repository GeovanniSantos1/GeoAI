import type { Gender } from './types.ts';
// Versão feminina: textos, categorias e menus que mudam com o gênero do perfil.
// Sem escolha ainda (conta nova antes da pergunta do primeiro acesso), vale o masculino, padrão do app.
export const HAIR_STYLES=[['longo','Longo'],['curto','Curto'],['cacheado','Cacheado'],['coque','Coque']] as const;
export const HAIR_CUTS=[['curto','Curto'],['cacheado','Cacheado'],['raspado','Raspado']] as const;
export const byGender=(gender:Gender,male:string,female:string)=>gender==='female'?female:male;
export const hiddenSections=(gender:Gender)=>gender==='female'?['testosterona']:['saude-feminina'];
const CARE_MALE=['Pele','Cabelo & barba','Higiene','Autocuidado'],CARE_FEMALE=['Pele','Cabelo','Unhas','Maquiagem','Higiene','Autocuidado'];
export const careCategories=(gender:Gender)=>gender==='female'?CARE_FEMALE:CARE_MALE;
// Rotinas criadas antes de trocar de gênero continuam visíveis na aba equivalente.
export function careTab(category:string|undefined,gender:Gender){const cats=careCategories(gender);if(!category)return cats[0];if(cats.includes(category))return category;if(category==='Cabelo & barba'||category==='Cabelo')return byGender(gender,'Cabelo & barba','Cabelo');return 'Autocuidado';}
export const categoryOptions=(options:string[][],gender:Gender)=>gender==='female'?options.flatMap(o=>o[0]==='Cabelo & barba'?[['Cabelo','Cabelo'],['Unhas','Unhas'],['Maquiagem','Maquiagem']]:[o]):options;
export const genderBrief=(gender:Gender)=>gender==='female'?'Gênero: mulher. Fale com ela no feminino (você mesma, pronta, bem-vinda).':gender==='male'?'Gênero: homem. Fale com ele no masculino.':'Gênero: não informado. Use linguagem neutra.';
