import Link from 'next/link';import {LEGAL} from '@/lib/legal';

// Rodapé das páginas públicas (início, login, cadastro, termos e privacidade): contato, links legais e CNPJ.
export function SiteFooter(){return <footer className="site-footer"><nav aria-label="Informações legais"><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Política de privacidade</Link></nav><p>Contato: <a href={'mailto:'+LEGAL.email}>{LEGAL.email}</a> · WhatsApp <a href={LEGAL.whatsappUrl} target="_blank" rel="noopener noreferrer">{LEGAL.whatsapp}</a></p><p>{LEGAL.company} · CNPJ {LEGAL.cnpj} · {LEGAL.city}</p></footer>;}

export function PublicShell({children}:{children:React.ReactNode}){return <div className="public-shell">{children}<SiteFooter/></div>;}

export function LegalPage({title,children}:{title:string;children:React.ReactNode}){return <PublicShell><main className="legal-page"><Link className="legal-back" href="/"><span className="legal-mark">G<span>↗</span></span>{LEGAL.product}</Link><p className="eyebrow">{LEGAL.product} · Informações legais</p><h1>{title}</h1><p className="legal-updated">Última atualização: {LEGAL.updatedAt}</p>{children}</main></PublicShell>;}

export function Contact(){return <ul><li>E-mail: <a href={'mailto:'+LEGAL.email}>{LEGAL.email}</a></li><li>WhatsApp: <a href={LEGAL.whatsappUrl} target="_blank" rel="noopener noreferrer">{LEGAL.whatsapp}</a></li><li>{LEGAL.company}, CNPJ {LEGAL.cnpj}, {LEGAL.city}</li></ul>;}
