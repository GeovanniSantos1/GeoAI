import {LEGAL} from './legal.ts';

// Página /obrigado (boas-vindas depois da compra). A AbacatePay volta para /obrigado?assinatura=ok:
// "Entrar no app" repassa o parâmetro para o app confirmar o pagamento ("Confirmando pagamento…").
// Quem abre o link mandado por mensagem vai só para o app, sem aviso de pagamento.
export function entrarUrl(assinatura:string|string[]|undefined){return assinatura==='ok'?'/?assinatura=ok':'/';}

// "Obrigado por assinar" só para quem veio do pagamento; quem chega pelo e-mail de boas-vindas ou por um link vê o texto neutro.
export function abertura(assinatura:string|string[]|undefined){const base='Em poucos minutos o GeoAI fica pronto para organizar o seu dia.';return assinatura==='ok'?'Obrigado por assinar! '+base:base;}

// Os passos e as dicas da página e dos e-mails (lib/email-templates.ts). **texto** vira negrito.
// Os textos seguem o app: Configurações (settings.tsx), áudio no WhatsApp e no Telegram, agenda só leitura.
export const PASSOS=[
 {icone:'tela',titulo:'Coloque o GeoAI na tela inicial',texto:'No iPhone, abra no **Safari** e toque em Compartilhar → “Adicionar à Tela de Início”. No Android, abra no **Chrome** e toque em ⋮ → “Adicionar à tela inicial”.'},
 {icone:'conversa',titulo:'Conecte o WhatsApp ou o Telegram',texto:'No menu, abra **Configurações**, toque em Conectar e siga o vídeo. Os lembretes chegam por lá.'},
 {icone:'agenda',titulo:'Conecte a sua agenda',texto:'Em Configurações, em “Calendário & lembretes”, toque em Conectar ao lado do **Google Agenda** ou do **Outlook / Teams**. O GeoAI só lê a agenda.'},
 {icone:'audio',titulo:'Mande um áudio contando o seu dia',texto:'No WhatsApp ou no Telegram. O GeoAI organiza em ações, e você confirma cada sugestão.'},
] as const;
export type IconePasso=typeof PASSOS[number]['icone'];

export const AJUDA=[
 'Entre com o mesmo e-mail da sua conta.',
 'O código do WhatsApp e o link do Telegram valem 15 minutos. Se passar, gere outro em Configurações.',
 'Agenda da empresa (Microsoft): o TI pode precisar aprovar o GeoAI.',
 'Pagou e o app ainda pede assinatura? Espere alguns minutos e recarregue a página. Não pague de novo.',
] as const;

export function partes(texto:string){return texto.split('**').map((t,i)=>({t,forte:i%2===1})).filter(p=>p.t);}

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
