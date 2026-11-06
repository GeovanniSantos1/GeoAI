import type {Metadata} from 'next';import {ArrowRight,CalendarDays,Check,Mail,MessageCircle,Mic,Smartphone,Sparkles} from 'lucide-react';
import {PublicShell} from '@/components/legal';import {VideoTutorial} from '@/components/boas-vindas';import {entrarUrl,suporteWhatsapp} from '@/lib/boas-vindas';import {LEGAL} from '@/lib/legal';
import './boas-vindas.css';

// Boas-vindas depois da compra: a AbacatePay volta para /obrigado?assinatura=ok. Página pública, fora do Google.
// Os passos seguem o app: Configurações (settings.tsx), áudio no WhatsApp e no Telegram, agenda só leitura.
export const metadata:Metadata={title:'Boas-vindas — GeoAI',description:'Obrigado por assinar o GeoAI. Veja como conectar o WhatsApp, o Telegram e a sua agenda.',robots:{index:false,follow:false}};

const FAIXA=['Seu dia com direção','Lembretes no WhatsApp e no Telegram','Agenda num lugar só','IA que organiza com você'];

const PASSOS=[
 {icone:Smartphone,titulo:'Coloque o GeoAI na tela inicial',texto:<>No iPhone, abra no <strong>Safari</strong> e toque em Compartilhar → “Adicionar à Tela de Início”. No Android, abra no <strong>Chrome</strong> e toque em ⋮ → “Adicionar à tela inicial”.</>},
 {icone:MessageCircle,titulo:'Conecte o WhatsApp ou o Telegram',texto:<>No menu, abra <strong>Configurações</strong>, toque em Conectar e siga o vídeo. Os lembretes chegam por lá.</>},
 {icone:CalendarDays,titulo:'Conecte a sua agenda',texto:<>Em Configurações, em “Calendário &amp; lembretes”, toque em Conectar ao lado do <strong>Google Agenda</strong> ou do <strong>Outlook / Teams</strong>. O GeoAI só lê a agenda.</>},
 {icone:Mic,titulo:'Mande um áudio contando o seu dia',texto:<>No WhatsApp ou no Telegram. O GeoAI organiza em ações, e você confirma cada sugestão.</>},
];

const AJUDA=[
 'Entre com o mesmo e-mail da sua conta.',
 'O código do WhatsApp e o link do Telegram valem 15 minutos. Se passar, gere outro em Configurações.',
 'Agenda da empresa (Microsoft): o TI pode precisar aprovar o GeoAI.',
 'Pagou e o app ainda pede assinatura? Espere alguns minutos e recarregue a página. Não pague de novo.',
];

export default async function Obrigado({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const entrar=entrarUrl((await searchParams).assinatura);
 return <PublicShell>
  {/* Duas metades iguais (a animação anda meia faixa); cada metade repete as frases para cobrir telas largas sem vão. */}
  <div className="welcome-ticker" aria-hidden="true"><div>{[0,1].map(k=><p key={k}>{[0,1,2].flatMap(r=>FAIXA.map(f=><span key={r+f}><Sparkles size={13}/>{f}</span>))}</p>)}</div></div>
  <main className="welcome-page">
   <header className="welcome-hero">
    <span className="legal-mark" aria-hidden="true">G<span>↗</span></span>
    <h1>Boas-vindas ao <em>GeoAI</em></h1>
    <p className="welcome-lead">Obrigado por assinar! Em poucos minutos o GeoAI fica pronto para organizar o seu dia.</p>
    <p className="welcome-check"><span><Check size={14} strokeWidth={3}/></span>Assista ao vídeo: ele mostra como conectar o WhatsApp, o Telegram e a sua agenda.</p>
   </header>
   <VideoTutorial/>
   <section className="welcome-card" aria-labelledby="welcome-passos">
    <h2 id="welcome-passos">Seus próximos <em>passos</em></h2>
    <ol className="welcome-steps">{PASSOS.map(({icone:Icone,titulo,texto},i)=><li key={titulo}><span className="welcome-num">{i+1}</span><div><strong><Icone size={16} aria-hidden="true"/>{titulo}</strong><p>{texto}</p></div></li>)}</ol>
    <a className="button primary welcome-cta" href={entrar}>Entrar no app<ArrowRight size={18} aria-hidden="true"/></a>
   </section>
   <section className="welcome-card welcome-help" aria-labelledby="welcome-ajuda">
    <h2 id="welcome-ajuda">Precisa de <em>ajuda</em>?</h2>
    <ul>{AJUDA.map(t=><li key={t}>{t}</li>)}</ul>
    <div className="welcome-actions">
     <a className="button primary" href={suporteWhatsapp()} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true"/>Falar no WhatsApp<ArrowRight size={18} aria-hidden="true"/></a>
     <a className="button welcome-ghost" href={'mailto:'+LEGAL.email}><Mail size={18} aria-hidden="true"/>Mandar e-mail</a>
    </div>
   </section>
  </main>
 </PublicShell>;}
