import {LEGAL} from './legal.ts';

// Página /obrigado (boas-vindas depois da compra). A AbacatePay volta para /obrigado?assinatura=ok:
// "Entrar no app" repassa o parâmetro para o app confirmar o pagamento ("Confirmando pagamento…").
// Quem abre o link mandado por mensagem vai só para o app, sem aviso de pagamento.
export function entrarUrl(assinatura:string|string[]|undefined){return assinatura==='ok'?'/?assinatura=ok':'/';}

export const SUPORTE_TEXTO='Olá! Acabei de assinar o GeoAI e preciso de ajuda.';
export function suporteWhatsapp(){return LEGAL.whatsappUrl+'?text='+encodeURIComponent(SUPORTE_TEXTO);}

// Vídeo gerado no projeto geoai-video (projetos/boas_vindas_conexoes); os capítulos são o começo de cada parte, em segundos.
export const VIDEO={src:'/boas-vindas/tutorial.mp4',capa:'/boas-vindas/capa.jpg',duracao:76.4} as const;
export const CAPITULOS=[
 {rotulo:'Configurações',inicio:6.5},
 {rotulo:'WhatsApp',inicio:9},
 {rotulo:'Telegram',inicio:23.7},
 {rotulo:'Agenda',inicio:35.5},
] as const;
