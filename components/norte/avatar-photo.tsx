'use client';import {useState,useEffect} from 'react';import {ImageUp,Sparkles} from 'lucide-react';import {useApp} from './context';import {Modal} from './primitives';import Avatar from './Avatar';import type {Profile} from '@/lib/types';
// Avatar a partir de uma foto: a imagem é reduzida e regravada em JPEG no aparelho (isso também tira localização e outros metadados),
// vai para /api/avatar, que devolve só o visual sugerido, e não fica guardada. A pessoa vê o resultado antes de aplicar.
type Look=Partial<Profile['avatar']>;
async function shrink(file:File){const bitmap=await createImageBitmap(file),scale=Math.min(1,768/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
 canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('imagem')),'image/jpeg',.85));}
export function PhotoAvatar({onClose}:{onClose:()=>void}){const a=useApp(),p=a.state.profile;
 const [photo,setPhoto]=useState<{blob:Blob;url:string}|null>(null),[look,setLook]=useState<Look|null>(null),[reading,setReading]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo.url);},[photo]);
 async function choose(file?:File){if(!file)return;setError('');setLook(null);try{const blob=await shrink(file);setPhoto({blob,url:URL.createObjectURL(blob)});}catch{setError('Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG.');}}
 async function read(){if(!photo)return;setReading(true);setError('');
  try{const body=new FormData();body.append('photo',photo.blob,'foto.jpg');body.append('gender',p.gender||'male');
   const r=await fetch('/api/avatar',{method:'POST',body}),j=await r.json().catch(()=>({}));if(!r.ok||!j.look)throw new Error(j.error||'Não consegui ler a foto agora. Tente de novo.');setLook(j.look);}
  catch(e){setError(e instanceof Error?e.message:'Não consegui ler a foto agora. Tente de novo.');}finally{setReading(false);}}
 async function apply(){if(look&&await a.mutate({type:'profile',profile:{avatar:look}})){a.toast('Avatar atualizado a partir da sua foto.');onClose();}}
 return <Modal eyebrow="SEU AVATAR" title="Avatar a partir de uma foto" subtitle="A IA olha a foto e ajusta pele, cabelo, barba, brincos e óculos do avatar. A foto não fica guardada." onClose={onClose}>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="photo-avatar">
   <label className="photo-pick">{photo?<>
    {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob), sem otimização do Next */}
    <img src={photo.url} alt="Sua foto"/></>:<><ImageUp size={28} strokeWidth={1.6}/><strong>Escolher uma foto</strong><small>De frente, com boa luz e só você nela.</small></>}
    <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={photo?'Trocar a foto':'Escolher uma foto'} disabled={reading} onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}}/></label>
   {look&&<div className="photo-result"><Avatar profile={{...p,avatar:{...p.avatar,...look}}}/><span>Ficou assim</span></div>}
  </div>
  <div className="modal-footer">
   {look?<><button className="button ghost" onClick={()=>{setLook(null);setPhoto(null);}}>Tentar outra foto</button><button className="button primary" disabled={a.busy} onClick={apply}>Usar este visual</button></>
    :<><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={!photo||reading} onClick={read}><Sparkles size={16}/>{reading?'Olhando a foto…':'Criar meu avatar'}</button></>}
  </div>
 </Modal>;}
