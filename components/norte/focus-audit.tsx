'use client';
import {useEffect,useState} from 'react';import {LoaderCircle,ShieldCheck} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {Empty} from './primitives';import {ChangesTable,clock} from './focus-ui';import {foco} from './focus-api';
import {AUDIT_LABEL,type AuditEntry} from '@/lib/board';
// Auditoria: as ações da IA que a pessoa aprovou e as triagens aplicadas, da mais nova para a mais antiga.
export function FocusAudit(){const {toast}=useApp(),f=useFoco();const [entries,setEntries]=useState<AuditEntry[]|null>(null);
 useEffect(()=>{foco.audit().then(r=>setEntries(r.entries)).catch(e=>{toast(e instanceof Error?e.message:'Não foi possível abrir a auditoria.',true);setEntries([]);});},[toast]);
 if(!entries)return <p className="quiet-copy"><LoaderCircle size={15} className="spin"/> Carregando…</p>;
 if(!entries.length)return <Empty title="Auditoria vazia" description="Nenhuma ação da IA aprovada ainda." icon={ShieldCheck}/>;
 const open=(id:string)=>{if(f.cards.some(c=>c.id===id))f.open(id);else toast('Esse card não está mais no quadro.',true);};
 return <><p className="quiet-copy fo-lead">As ações da IA que você aprovou e as triagens aplicadas, com quando e o que mudou.</p>
  <ol className="fo-audit">{entries.map(e=><li key={e.id} className="panel"><header><span className="pill">{AUDIT_LABEL[e.tool]}</span><span>{e.changes.length} {e.changes.length===1?'alteração':'alterações'}</span><small>aprovado por você · {clock(e.at)}</small></header><ChangesTable changes={e.changes} onOpen={open}/></li>)}</ol></>;}
