// Dados da empresa no rodapé e nas páginas de Termos e Privacidade (pedidos pela AbacatePay para a conta de produção).
// Ao mudar o texto de /termos ou /privacidade, atualize também updatedAt.
export const LEGAL={
 product:'GeoAI',
 site:'https://geochat.ia.br',
 company:'63.938.480 Geovanni Santos de Oliveira',
 cnpj:'63.938.480/0001-56',
 city:'Belo Horizonte/MG',
 email:'geovanni.oliveira.dev@gmail.com',
 whatsapp:'(31) 98433-7637',
 whatsappUrl:'https://wa.me/5531984337637',
 updatedAt:'27 de outubro de 2026',
} as const;

// O endereço antigo da Vercel leva as páginas ao domínio próprio, onde fica o login do Clerk de produção.
// As APIs continuam respondendo nele, para os webhooks já cadastrados (Telegram, WhatsApp, AbacatePay) não se perderem.
export const OLD_HOST='geo-ai-mocha.vercel.app';
export function canonicalRedirect(host:string|null,pathname:string,search:string){return host===OLD_HOST&&!pathname.startsWith('/api/')?LEGAL.site+pathname+search:null;}
