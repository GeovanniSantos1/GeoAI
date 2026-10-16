import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Norte — Seu dia com direção',description:'Organize sua rotina, cuide de você e avance no que importa.',manifest:'/manifest.webmanifest',icons:{icon:'/icon.svg',apple:'/icon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
