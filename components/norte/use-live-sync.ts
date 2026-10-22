'use client';
import {useEffect,useRef} from 'react';
import {CHECK_MS,shouldCheck,wokeUp} from '@/lib/live-sync';
const ACTIVITY=['pointerdown','pointermove','keydown','wheel','touchstart','scroll'] as const;
// Atualização automática: chama `check` a cada 10 s com a aba visível e em uso, e na hora ao voltar para a aba, à janela ou à internet.
export function useLiveSync(check:()=>Promise<void>,busy:boolean){
 const checkRef=useRef(check),busyRef=useRef(busy);
 useEffect(()=>{checkRef.current=check;busyRef.current=busy;},[check,busy]);
 useEffect(()=>{
  let lastActivity=Date.now(),lastCheck=0,running=false;
  const run=()=>{const now=Date.now();if(running||!shouldCheck({visible:document.visibilityState==='visible',busy:busyRef.current,now,lastActivity,lastCheck}))return;running=true;lastCheck=now;checkRef.current().catch(()=>{}).finally(()=>{running=false;});};
  const active=()=>{const now=Date.now(),woke=wokeUp(now,lastActivity);lastActivity=now;if(woke)run();};
  const back=()=>{lastActivity=Date.now();run();};
  const visible=()=>{if(document.visibilityState==='visible')back();};
  const timer=window.setInterval(run,CHECK_MS);
  // Captura: a rolagem de painéis internos não sobe até a janela.
  for(const e of ACTIVITY)window.addEventListener(e,active,{passive:true,capture:true});
  window.addEventListener('focus',back);window.addEventListener('online',back);document.addEventListener('visibilitychange',visible);
  return()=>{window.clearInterval(timer);for(const e of ACTIVITY)window.removeEventListener(e,active,{capture:true});window.removeEventListener('focus',back);window.removeEventListener('online',back);document.removeEventListener('visibilitychange',visible);};
 },[]);}
