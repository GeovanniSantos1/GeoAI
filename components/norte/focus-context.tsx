'use client';
import {createContext,useContext} from 'react';import type {CardSummary} from '@/lib/board';
// Estado comum às abas do Foco: os cards do quadro e as ações que todas usam.
export type FocoTab='board'|'timer'|'today'|'triage'|'report'|'audit';
export type FocoApi={cards:CardSummary[];archivedCount:number;loading:boolean;ai:boolean;reload:()=>Promise<void>;setCards:(f:(cards:CardSummary[])=>CardSummary[])=>void;open:(id:string)=>void;start:(id:string)=>Promise<void>;setTab:(t:FocoTab)=>void;clientName:(id:string|null)=>string;openId:string|null};
export const FocoCtx=createContext<FocoApi>(null as unknown as FocoApi);export const useFoco=()=>useContext(FocoCtx);
