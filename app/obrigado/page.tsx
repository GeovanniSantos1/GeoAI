import type {Metadata} from 'next';import {ArrowRight,CalendarDays,Check,Mail,MessageCircle,Mic,Smartphone,Sparkles} from 'lucide-react';
import {PublicShell} from '@/components/legal';import {VideoTutorial} from '@/components/boas-vindas';import {entrarUrl,suporteWhatsapp,abertura,partes,PASSOS,AJUDA,type IconePasso} from '@/lib/boas-vindas';import {LEGAL} from '@/lib/legal';
import './boas-vindas.css';

// Boas-vindas: a AbacatePay volta para /obrigado?assinatura=ok, e os e-mails de boas-vindas trazem para cá (?origem=email).
// Página pública, fora do Google. Os passos e as dicas vêm de lib/boas-vindas.ts, os mesmos dos e-mails.
export const metadata:Metadata={title:'Boas-vindas — GeoAI',description:'Boas-vindas ao GeoAI. Veja como conectar o WhatsApp, o Telegram e a sua agenda.',robots:{index:false,follow:false}};

const FAIXA=['Seu dia com direção','Lembretes no WhatsApp e no Telegram','Agenda num lugar só','IA que organiza com você'];

const ICONES:Record<IconePasso,typeof Smartphone>={tela:Smartphone,conversa:MessageCircle,agenda:CalendarDays,audio:Mic};

export default async function Obrigado({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {assinatura}=await searchParams,entrar=entrarUrl(assinatura);
 return <PublicShell>
  {/* Duas metades iguais (a animação anda meia faixa); cada metade repete as frases para cobrir telas largas sem vão. */}
  <div className="welcome-ticker" aria-hidden="true"><div>{[0,1].map(k=><p key={k}>{[0,1,2].flatMap(r=>FAIXA.map(f=><span key={r+f}><Sparkles size={13}/>{f}</span>))}</p>)}</div></div>
  <main className="welcome-page">
   <header className="welcome-hero">
    <span className="legal-mark" aria-hidden="true">G<span>↗</span></span>
    <h1>Boas-vindas ao <em>GeoAI</em></h1>
    <p className="welcome-lead">{abertura(assinatura)}</p>
    <p className="welcome-check"><span><Check size={14} strokeWidth={3}/></span>Assista ao vídeo: ele mostra como conectar o WhatsApp, o Telegram e a sua agenda.</p>
   </header>
   <VideoTutorial/>
   <section className="welcome-card" aria-labelledby="welcome-passos">
    <h2 id="welcome-passos">Seus próximos <em>passos</em></h2>
    <ol className="welcome-steps">{PASSOS.map(({icone,titulo,texto},i)=>{const Icone=ICONES[icone];return <li key={titulo}><span className="welcome-num">{i+1}</span><div><strong><Icone size={16} aria-hidden="true"/>{titulo}</strong><p>{partes(texto).map((p,k)=>p.forte?<strong key={k}>{p.t}</strong>:p.t)}</p></div></li>;})}</ol>
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
