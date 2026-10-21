'use client';
import {useEffect,useRef,useState} from 'react';import {useChat} from '@ai-sdk/react';import {DefaultChatTransport,type UIMessage} from 'ai';
import {Sparkles,Send,X,LoaderCircle,Check,TriangleAlert,RefreshCw,Square} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {ChangesTable} from './focus-ui';import {foco,ApiError} from './focus-api';import {useRemaining} from './focus-mini-timer';
import {AUDIT_LABEL,sortCards,codeOf,type ChangeSet} from '@/lib/board';import {APPROVAL_TOOLS} from '@/lib/foco-agent';
// Painel do assistente do Foco: as ferramentas de mudança só mostram a prévia; gravar é com o Aprovar daqui.
type Decision='approved'|'rejected';
type ToolPartData={type:string;toolCallId:string;state:string;input?:Record<string,unknown>;output?:Record<string,unknown>};
// As partes de ferramenta chegam tipadas como união genérica; aqui só se leem os campos comuns a todas.
const toolParts=(m:UIMessage)=>m.parts.filter(p=>p.type.startsWith('tool-')) as unknown as ToolPartData[];
const isApproval=(p:ToolPartData)=>(APPROVAL_TOOLS as readonly string[]).includes(p.type.slice(5));
// Um transporte para o app inteiro, como o do assistente geral; as decisões e o card aberto vão junto com a conversa.
const context={decisions:{} as Record<string,Decision>,openCardId:null as string|null};
const transport=new DefaultChatTransport<UIMessage>({api:'/api/foco/assistant',prepareSendMessagesRequest:({messages})=>({body:{messages,decisions:context.decisions,openCardId:context.openCardId}})});
const STATUS:Record<string,string>={buscar_cards:'Buscando cards…',relatorio_foco:'Somando os pomodoros…',abrir_card:'Abrindo o card…',iniciar_pomodoro:'Iniciando o pomodoro…',montar_plano:'Montando o plano…',criar_cards:'Preparando os cards…'};
const ACTION:Record<string,string>={mover_cards:'mover cards',arquivar_cards:'arquivar cards',alterar_cards:'alterar cards',criar_cards:'criar cards'};
function chatError(error:Error){try{return JSON.parse(error.message).error||'Tente novamente.';}catch{return error.message&&error.message.length<200?error.message:'Não foi possível falar com o assistente. Tente novamente.';}}
export function FocusAssistant({open,onClose,onQueue}:{open:boolean;onClose:()=>void;onQueue:(n:number)=>void}){const a=useApp(),f=useFoco();const {toast,sync}=a;
 const [text,setText]=useState(''),[mode,setMode]=useState<'ai'|'guided'|''>(''),[decisions,setDecisions]=useState<Record<string,Decision>>({}),[shown,setShown]=useState<string[]>([]),[applying,setApplying]=useState<string[]>([]);
 const opened=useRef(new Set<string>()),thread=useRef<HTMLDivElement>(null),inflight=useRef(new Set<string>());
 useEffect(()=>{context.decisions=decisions;context.openCardId=f.openId;},[decisions,f.openId]);
 const refresh=useRef(async()=>{});useEffect(()=>{refresh.current=async()=>{try{sync(await foco.state());}catch{}await f.reload();window.dispatchEvent(new Event('geoai:foco-refresh'));};});
 const {messages,sendMessage,status,error,stop,regenerate}=useChat({transport,onFinish:()=>{refresh.current();}});
 useEffect(()=>{fetch('/api/foco/assistant').then(r=>r.json()).then(j=>setMode(j.mode==='ai'?'ai':'guided')).catch(()=>setMode('guided'));},[]);
 useEffect(()=>{thread.current?.scrollTo({top:thread.current.scrollHeight,behavior:'smooth'});},[messages,status]);
 const parts=messages.flatMap(toolParts);
 useEffect(()=>{for(const p of parts){const id=p.output?.abrir;if(p.type==='tool-abrir_card'&&p.state==='output-available'&&typeof id==='string'&&!opened.current.has(p.toolCallId)){opened.current.add(p.toolCallId);f.open(id);}}},[parts,f]);
 const t=a.state.focusTimer,left=useRemaining(t),quiet=!!(a.state.profile.focus.focusMode&&t&&t.kind==='focus'&&t.pausedLeft===undefined&&left>0);
 const pending=parts.filter(p=>isApproval(p)&&p.state==='output-available'&&!p.output?.erro&&!decisions[p.toolCallId]);
 const queued=quiet?pending.filter(p=>!shown.includes(p.toolCallId)).length:0;
 useEffect(()=>{onQueue(queued);},[queued,onQueue]);
 async function decide(p:ToolPartData,d:Decision){if(d==='rejected'){setDecisions(x=>({...x,[p.toolCallId]:'rejected'}));return;}
  const id=p.toolCallId;if(inflight.current.has(id))return;inflight.current.add(id);setApplying(s=>[...s,id]);
  try{const r=await foco.apply(p.type.slice(5),p.input||{});setDecisions(x=>({...x,[p.toolCallId]:'approved'}));toast(AUDIT_LABEL[r.set.tool]+': feito.');await refresh.current();}
  catch(e){toast(e instanceof ApiError&&e.body.set?.errors?.length?e.body.set.errors.join(' '):e instanceof Error?e.message:'Não foi possível aplicar.',true);}finally{inflight.current.delete(id);setApplying(s=>s.filter(x=>x!==id));}}
 const loading=status==='submitted'||status==='streaming',todo=sortCards(f.cards.filter(c=>c.status==='todo'))[0];
 const suggestions=['O que está atrasado?',...(todo?['Vamos começar o '+codeOf(todo)]:[]),'Quantos pomodoros fiz esta semana?','Move para Concluída o que está em revisão há mais de 3 dias','Monta meu dia com 8 pomodoros'];
 const send=(value:string)=>{const v=value.trim();if(!v||loading)return;sendMessage({text:v});setText('');};
 const state=error?'Erro':loading?'Respondendo':pending.length?'Aguardando você':'Pronto';
 return <aside className="fo-panel" aria-label="Assistente do Foco" hidden={!open}>
  <header className="fo-panel-head"><span className="fo-orb"><Sparkles size={17}/></span><div><b>Assistente do Foco</b><small>{state}</small></div><button className="icon-button" aria-label="Fechar o assistente" onClick={onClose}><X size={18}/></button></header>
  <div className="fo-thread" ref={thread} aria-live="polite">
   {mode==='guided'?<p className="quiet-copy">O assistente precisa da IA configurada. O quadro e o pomodoro funcionam sem ela.</p>
    :!messages.length&&!quiet&&<div className="fo-suggest">{suggestions.map(s=><button key={s} className="fo-chip" onClick={()=>send(s)}>{s}</button>)}</div>}
   {messages.map(m=><div key={m.id} className={'chat-msg '+m.role}>{m.parts.map((p,i)=>{if(p.type==='text')return p.text?<p key={i}>{p.text}</p>:null;if(!p.type.startsWith('tool-'))return null;const tp=p as unknown as ToolPartData;
    return <ToolView key={i} part={tp} decision={decisions[tp.toolCallId]} busy={applying.includes(tp.toolCallId)} collapsed={quiet&&!decisions[tp.toolCallId]&&!shown.includes(tp.toolCallId)} onShow={()=>setShown(s=>[...s,tp.toolCallId])} onDecide={d=>decide(tp,d)}/>;})}</div>)}
   {status==='submitted'&&<div className="chat-msg assistant"><small className="chat-status"><LoaderCircle size={13} className="spin"/>Pensando…</small></div>}
   {error&&<div className="fo-error" role="alert"><TriangleAlert size={15}/><span>{chatError(error)}</span><button className="button ghost small" onClick={()=>regenerate()}><RefreshCw size={14}/>Tentar de novo</button></div>}</div>
  {mode!=='guided'&&<form className="fo-panel-form" onSubmit={e=>{e.preventDefault();send(text);}}><textarea rows={2} value={text} maxLength={4000} placeholder="Pergunte sobre seus cards…" aria-label="Mensagem para o assistente" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(text);}}}/>
   {loading?<button type="button" className="button outline small" onClick={()=>stop()}><Square size={14}/>Parar</button>:<button className="button primary small" disabled={!text.trim()}><Send size={15}/>Enviar</button>}</form>}</aside>;}
type CardRow={id:string;codigo:string;titulo:string;coluna?:string;area?:string;prazo?:string;prioridade?:string};
function ToolView({part,decision,busy,collapsed,onShow,onDecide}:{part:ToolPartData;decision?:Decision;busy:boolean;collapsed:boolean;onShow:()=>void;onDecide:(d:Decision)=>void}){const f=useFoco();const name=part.type.slice(5);
 if(part.state==='output-error')return <small className="chat-status fo-tool-error">Não deu certo agora.</small>;
 if(part.state!=='output-available')return <small className="chat-status"><LoaderCircle size={13} className="spin"/>{STATUS[name]||'Preparando a mudança…'}</small>;
 const out=part.output||{};if(typeof out.erro==='string')return <small className="chat-status fo-tool-error">{out.erro}</small>;
 if(name==='buscar_cards'){const items=(Array.isArray(out.items)?out.items:[]) as CardRow[];return items.length?<ul className="fo-tool-cards">{items.map(c=><li key={c.id}><button onClick={()=>f.open(c.id)}><b>{c.codigo}</b> {c.titulo}<small>{[c.coluna,c.area,c.prazo&&'prazo '+c.prazo.slice(8,10)+'/'+c.prazo.slice(5,7),c.prioridade].filter(Boolean).join(' · ')}</small></button></li>)}</ul>:<small className="chat-status">Nenhum card encontrado.</small>;}
 if(name==='relatorio_foco'){const rows=(Array.isArray(out.byCard)?out.byCard:[]) as {cardId:string|null;code:string;title:string;pomodoros:number}[];return <div className="fo-tool-report"><b>{String(out.total)} pomodoros · {String(out.interrupted)} interrompidos</b>{rows.slice(0,8).map(x=><small key={x.cardId||'livre'}>{x.code?x.code+' ':''}{x.title}: {x.pomodoros} 🍅</small>)}</div>;}
 if(name==='abrir_card')return <small className="chat-status"><Check size={13}/>Abri o {String(out.codigo)}.</small>;
 if(name==='iniciar_pomodoro')return out.conflito?null:<small className="chat-status"><Check size={13}/>Pomodoro iniciado{out.codigo?' no '+String(out.codigo):''}.</small>;
 if(name==='montar_plano')return <small className="chat-status"><Check size={13}/>Plano de hoje: {String(out.planejados)} pomodoros em {String(out.itens)} cards.</small>;
 if(!isApproval(part))return null;const set=out as unknown as ChangeSet;
 if(collapsed)return <div className="fo-approval queued"><span>Na fila do modo foco: aparece quando o pomodoro acabar.</span><button className="button ghost small" onClick={onShow}>Ver agora</button></div>;
 return <div className="fo-approval"><b>{AUDIT_LABEL[set.tool]||name}</b><p className="quiet-copy">O assistente quer {ACTION[name]}. Nada muda sem a sua aprovação.</p>
  {set.changes?.length>0&&<ChangesTable changes={set.changes} onOpen={id=>{if(f.cards.some(c=>c.id===id))f.open(id);}}/>}
  {set.notes?.map(n=><small key={n} className="fo-note">ℹ️ {n}</small>)}{set.errors?.map(e=><small key={e} className="fo-tool-error">{e}</small>)}
  {decision?<p className={'fo-decided '+decision}>{decision==='approved'?'Aprovado ✓':'Rejeitado: nada foi alterado'}</p>
   :<div className="fo-row-end"><button className="button ghost small" disabled={busy} onClick={()=>onDecide('rejected')}>Rejeitar</button><button className="button primary small" disabled={busy||!set.canApply} onClick={()=>onDecide('approved')}>{busy?<LoaderCircle size={15} className="spin"/>:<Check size={15}/>}Aprovar</button></div>}</div>;}
