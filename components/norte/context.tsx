'use client';
import {createContext,useContext} from 'react';import type {Workspace,Command,Collection,Item} from '@/lib/types';import type {ExternalEvent,FeedStatus,FeedView,Provider} from '@/lib/external-calendar';
export type CalendarResult={provider:Provider;status:FeedStatus;count:number};
export type CalendarState={events:ExternalEvent[];feeds:FeedView[];refresh:(provider?:Provider,connect?:boolean)=>Promise<CalendarResult|null>;reload:()=>Promise<void>;disconnect:(provider:Provider)=>Promise<boolean>};
export type AppContext={state:Workspace;today:string;date:string;setDate:(d:string)=>void;navigate:(p:string)=>void;mutate:(c:Command)=>Promise<boolean>;sync:(r:{state:Workspace;version:number})=>void;edit:(collection:Collection,item?:Item,defaults?:any,installments?:boolean)=>void;remove:(collection:Collection,item:Item)=>void;toast:(message:string,error?:boolean)=>void;openAssistant:()=>void;busy:boolean;user:{name:string;email:string};calendar:CalendarState};
export const Context=createContext<AppContext>(null as any);export const useApp=()=>useContext(Context);
