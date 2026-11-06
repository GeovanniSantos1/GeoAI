import {LEGAL} from './legal.ts';import {PASSOS,AJUDA,partes,suporteWhatsapp} from './boas-vindas.ts';import {PLAN_NAMES,type Plan} from './billing.ts';

// E-mails de boas-vindas (cadastro) e de assinatura confirmada (compra), com o guia da página /obrigado.
// HTML de tabela com os estilos na própria tag (o que os leitores de e-mail aceitam), em tema claro, e a versão em texto puro.
export type Mensagem={subject:string;html:string;text:string};

const C={fundo:'#f5f5ef',cartao:'#fffefa',borda:'#e2e5da',texto:'#26382f',suave:'#69736b',verde:'#285442',verdeClaro:'#eaf0e5',dourado:'#a77d4e',creme:'#faf7ec'};
const FONTE="'Segoe UI',Arial,Helvetica,sans-serif",SERIFA="Georgia,'Times New Roman',serif";
const VIDEO_URL=LEGAL.site+'/obrigado?origem=email',CAPA_URL=LEGAL.site+'/boas-vindas/capa-email.jpg';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const semMarcas=(s:string)=>s.replaceAll('**','');

// "Ana Ribeiro" → "Ana". Quem não pôs nome no cadastro chega com um pedaço do e-mail ("joao.silva"): aí a saudação fica sem nome.
export function primeiroNome(nome:string){const n=nome.trim().split(/\s+/)[0]||'';return /[._@\d]/.test(n)?'':n;}

function data(iso:string,zone:string){let f:Intl.DateTimeFormatPart[];const o:Intl.DateTimeFormatOptions={day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'};
 try{f=new Intl.DateTimeFormat('pt-BR',{...o,timeZone:zone}).formatToParts(new Date(iso));}catch{f=new Intl.DateTimeFormat('pt-BR',{...o,timeZone:'America/Sao_Paulo'}).formatToParts(new Date(iso));}
 const g=(t:string)=>f.find(p=>p.type===t)?.value||'';return {curta:`${g('day')}/${g('month')}, ${g('hour')}:${g('minute')}`,longa:`${g('day')}/${g('month')}/${g('year')}`};}

type Corpo={assunto:string;resumo:string;nome:string;tituloHtml:string;tituloTexto:string;abertura:string;destaque:string|null};

function passosHtml(){return PASSOS.map((p,i)=>`<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fundo};border:1px solid ${C.borda};border-radius:14px"><tr>
<td width="48" valign="top" style="padding:16px 0 16px 16px"><div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${C.verde};color:${C.cartao};text-align:center;font-family:${SERIFA};font-size:17px">${i+1}</div></td>
<td valign="top" style="padding:16px 16px 16px 12px;font-family:${FONTE}"><div style="font-size:15px;font-weight:700;line-height:1.35;color:${C.texto};margin:0 0 4px">${esc(p.titulo)}</div>
<div style="font-size:14px;line-height:1.55;color:${C.suave}">${partes(p.texto).map(x=>x.forte?`<strong style="color:${C.texto}">${esc(x.t)}</strong>`:esc(x.t)).join('')}</div></td></tr></table></td></tr>`).join('\n');}

const botao=(href:string,txt:string)=>`<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${C.verde}" style="border-radius:12px"><a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONTE};font-size:14px;font-weight:700;letter-spacing:.06em;color:${C.cartao};text-decoration:none">${txt}</a></td></tr></table>`;
const subtitulo=(txt:string,destaque:string)=>`<div style="text-align:center;font-family:${FONTE};font-size:13px;font-weight:700;letter-spacing:.12em;color:${C.texto};margin:0 0 18px">${txt} <em style="font-family:${SERIFA};font-size:21px;font-weight:400;letter-spacing:0;color:${C.dourado}">${destaque}</em></div>`;

function html(c:Corpo){const ola=c.nome?`Olá, ${esc(c.nome)}!`:'Olá!';
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(c.assunto)}</title></head>
<body style="margin:0;padding:0;background:${C.fundo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.resumo)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.fundo}" style="background:${C.fundo}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 18px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="40" height="40" align="center" bgcolor="${C.verde}" style="border-radius:11px;font-family:${FONTE};font-size:21px;font-weight:600;color:${C.creme}">G</td><td style="padding-left:10px;font-family:${FONTE};font-size:20px;font-weight:650;letter-spacing:-.03em;color:${C.texto}">${LEGAL.product}</td></tr></table></td></tr>
<tr><td style="background:${C.cartao};border:1px solid ${C.borda};border-radius:20px;padding:32px 26px">
<p style="margin:0 0 6px;font-family:${FONTE};font-size:14px;color:${C.suave}">${ola}</p>
<h1 style="margin:0 0 12px;font-family:${FONTE};font-size:30px;line-height:1.15;font-weight:500;letter-spacing:-.03em;color:${C.texto}">${c.tituloHtml}</h1>
<p style="margin:0 0 16px;font-family:${FONTE};font-size:16px;line-height:1.55;color:${C.texto}">${esc(c.abertura)}</p>
${c.destaque?`<p style="margin:0 0 20px;padding:12px 16px;border-radius:12px;background:${C.verdeClaro};font-family:${FONTE};font-size:14px;font-weight:600;line-height:1.5;color:${C.verde}">${esc(c.destaque)}</p>`:''}
<a href="${esc(VIDEO_URL)}" style="display:block;text-decoration:none"><img src="${esc(CAPA_URL)}" width="506" alt="Assista ao tutorial em vídeo: como conectar o WhatsApp, o Telegram e a sua agenda (1 min)" style="display:block;width:100%;max-width:506px;height:auto;border:0;border-radius:16px"></a>
<p style="margin:10px 0 28px;text-align:center;font-family:${FONTE};font-size:14px"><a href="${esc(VIDEO_URL)}" style="color:${C.verde};font-weight:600">Assistir ao tutorial em vídeo (1 min) →</a></p>
${subtitulo('SEUS PRÓXIMOS','passos')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${passosHtml()}</table>
<div style="height:14px"></div>${botao(LEGAL.site,'ABRIR O GEOAI →')}
</td></tr>
<tr><td style="height:16px"></td></tr>
<tr><td style="background:${C.cartao};border:1px solid ${C.borda};border-radius:20px;padding:28px 26px">
${subtitulo('PRECISA DE','ajuda?')}
${AJUDA.map(t=>`<p style="margin:0 0 10px;font-family:${FONTE};font-size:14px;line-height:1.55;color:${C.suave}"><span style="color:${C.dourado}">●</span>&nbsp; ${esc(t)}</p>`).join('\n')}
<p style="margin:18px 0 0;text-align:center;font-family:${FONTE};font-size:14px;line-height:1.9"><a href="${esc(suporteWhatsapp())}" style="color:${C.verde};font-weight:700">Falar no WhatsApp ${esc(LEGAL.whatsapp)}</a><br><a href="mailto:${esc(LEGAL.email)}" style="color:${C.verde};font-weight:700">${esc(LEGAL.email)}</a></p>
</td></tr>
<tr><td align="center" style="padding:22px 10px 0;font-family:${FONTE};font-size:12px;line-height:1.6;color:${C.suave}">
Você recebeu este e-mail porque tem uma conta no ${LEGAL.product}.<br>
<a href="${LEGAL.site}/termos" style="color:${C.verde}">Termos de uso</a> · <a href="${LEGAL.site}/privacidade" style="color:${C.verde}">Política de privacidade</a><br>
${esc(LEGAL.company)} · CNPJ ${LEGAL.cnpj} · ${esc(LEGAL.city)}
</td></tr>
</table></td></tr></table></body></html>`;}

function texto(c:Corpo){return [c.nome?`Olá, ${c.nome}!`:'Olá!','',c.tituloTexto,c.abertura,...(c.destaque?[c.destaque]:[]),'',
 `Assista ao tutorial em vídeo (1 min): ${VIDEO_URL}`,'','SEUS PRÓXIMOS PASSOS',...PASSOS.flatMap((p,i)=>[`${i+1}. ${p.titulo}`,`   ${semMarcas(p.texto)}`]),'',
 `Abrir o ${LEGAL.product}: ${LEGAL.site}`,'','PRECISA DE AJUDA?',...AJUDA.map(t=>`- ${t}`),`WhatsApp: ${suporteWhatsapp()}`,`E-mail: ${LEGAL.email}`,'',
 '—',`Você recebeu este e-mail porque tem uma conta no ${LEGAL.product}.`,`${LEGAL.company} · CNPJ ${LEGAL.cnpj} · ${LEGAL.city}`].join('\n');}

const montar=(c:Corpo):Mensagem=>({subject:c.assunto,html:html(c),text:texto(c)});

// Cadastro: a linha do teste só aparece para quem está no teste grátis (trialUntil = fim do teste).
export function welcomeEmail(p:{name:string;trialUntil:string|null;zone:string}):Mensagem{
 return montar({assunto:'Boas-vindas ao GeoAI: seu guia para começar',resumo:'Seu guia para conectar o WhatsApp, o Telegram e a sua agenda.',nome:primeiroNome(p.name),
  tituloHtml:`Boas-vindas ao <em style="font-family:${SERIFA};font-weight:400;color:${C.dourado}">${LEGAL.product}</em>`,tituloTexto:`Boas-vindas ao ${LEGAL.product}`,
  abertura:'Em poucos minutos o GeoAI fica pronto para organizar o seu dia. Este é o seu guia para começar.',
  destaque:p.trialUntil?`Seu teste grátis vai até ${data(p.trialUntil,p.zone).curta}.`:null});}

// Compra: o plano e a data da renovação (paid_until).
export function purchaseEmail(p:{name:string;plan:Plan|null;until:string|null;zone:string}):Mensagem{
 const plano=p.plan?PLAN_NAMES[p.plan]:'';const linha=plano?`Seu plano ${plano} está ativo`+(p.until?` e renova em ${data(p.until,p.zone).longa}.`:'.'):null;
 return montar({assunto:'Assinatura confirmada: boas-vindas ao GeoAI',resumo:'Sua assinatura está ativa. Veja como deixar tudo pronto.',nome:primeiroNome(p.name),
  tituloHtml:`Obrigado por assinar o <em style="font-family:${SERIFA};font-weight:400;color:${C.dourado}">${LEGAL.product}</em>`,tituloTexto:`Obrigado por assinar o ${LEGAL.product}`,
  abertura:'Assinatura confirmada. Em poucos minutos o GeoAI fica pronto para organizar o seu dia.',destaque:linha});}
