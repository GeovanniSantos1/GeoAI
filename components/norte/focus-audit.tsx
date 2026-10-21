'use client';
import {useEffect,useState,type CSSProperties} from 'react';import {LoaderCircle,ShieldCheck} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {Empty} from './primitives';import {ChangesTable,clock} from './focus-ui';import {foco} from './focus-api';
import {AUDIT_LABEL,type AuditEntry,type AuditTool} from '@/lib/board';
// Auditoria: as ações da IA que a pessoa aprovou e as triagens aplicadas, da mais nova para a mais antiga.
// Cor do ponto pela autoria: a triagem é gravada como da pessoa; refino e testes são texto da IA aceito; o resto, ação do assistente aprovada.
type Who='you'|'ai'|'approved';
const WHO:Record<AuditTool,Who>={aplicar_triagem:'you',refino:'ai',casos_de_teste:'ai',mover_cards:'approved',arquivar_cards:'approved',alterar_cards:'approved',criar_cards:'approved'};
const WHO_LABEL:Record<Who,string>={you:'Você',ai:'IA, aceito por você',approved:'Assistente, aprovado por você'};
export function FocusAudit(){const {toast}=useApp(),f=useFoco();const [entries,setEntries]=useState<AuditEntry[]|null>(null);
 useEffect(()=>{foco.audit().then(r=>setEntries(r.entries)).catch(e=>{toast(e instanceof Error?e.message:'Não foi possível abrir a auditoria.',true);setEntries([]);});},[toast]);
 if(!entries)return <p className="quiet-copy"><LoaderCircle size={15} className="spin"/> Carregando…</p>;
 if(!entries.length)return <Empty title="Auditoria vazia" description="Nenhuma ação da IA aprovada ainda." icon={ShieldCheck}/>;
 const open=(id:string)=>{if(f.cards.some(c=>c.id===id))f.open(id);else toast('Esse card não está mais no quadro.',true);};
 return <><p className="quiet-copy fo-lead">As ações da IA que você aprovou e as triagens aplicadas, com quando e o que mudou.</p>
  <ul className="fo-audit-legend">{(['you','ai','approved'] as const).filter(k=>entries.some(e=>WHO[e.tool]===k)).map(k=><li key={k} className={'fo-by-'+k}>{WHO_LABEL[k]}</li>)}</ul>
  <ol className="fo-audit">{entries.map((e,i)=><li key={e.id} className={'panel fo-by-'+WHO[e.tool]} style={{'--i':Math.min(i,8)} as CSSProperties}><header><span className="pill">{AUDIT_LABEL[e.tool]}</span><span>{e.changes.length} {e.changes.length===1?'alteração':'alterações'}</span><small>aprovado por você · {clock(e.at)}</small></header><ChangesTable changes={e.changes} onOpen={open}/></li>)}</ol></>;}
