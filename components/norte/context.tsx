'use client';
import {createContext,useContext} from 'react';import type {Workspace,Command,Collection,Item} from '@/lib/types';
export type AppContext={state:Workspace;today:string;date:string;setDate:(d:string)=>void;navigate:(p:string)=>void;mutate:(c:Command)=>Promise<boolean>;edit:(collection:Collection,item?:Item,defaults?:any,installments?:boolean)=>void;remove:(collection:Collection,item:Item)=>void;toast:(message:string,error?:boolean)=>void;openAssistant:()=>void;busy:boolean;user:{name:string;email:string}};
export const Context=createContext<AppContext>(null as any);export const useApp=()=>useContext(Context);

