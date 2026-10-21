export const COLLECTIONS = ['tasks','objectives','transactions','bills','cards','journal','workouts','sessions','measurements','courses','activities','books','readingLogs','rooms','chores','shopping','clients','workGoals','sleep','vices','relapses','notes','reviews','focusSessions','labExams','trtProtocols','trtDoses','periods','symptoms','contraceptives','contraceptiveDoses','preventives','intimacy','investments','investmentEvents'] as const;
export type Collection = typeof COLLECTIONS[number];
export type Item = { id: string; title: string; [key: string]: any };
export type Gender = 'male'|'female'|'';
export type HairStyle = 'longo'|'cacheado'|'coque';
export type FocusKind='focus'|'short'|'long';
export type FocusTimer={id:string;kind:FocusKind;boardCardId?:string;code?:string;title:string;minutes:number;startedAt:string;endsAt:string;pausedLeft?:number};
export type FocusSettings={focusMinutes:number;shortBreakMinutes:number;longBreakMinutes:number;focusMode:boolean};
export type Profile = { name:string;timezone:string;theme:string;budget:number;openingBalance:number;categoryBudgets:Record<string,number>;focus:FocusSettings;sleepGoal:number;bedtime:string;waketime:string;dailyTarget:number;assistantName:string;xp:number;points:number;gender:Gender;avatar:{skin:string;hair:string;beard:boolean;shirt:string;style:HairStyle;earrings:boolean};unlockedMoments:string[] };
export type Workspace = { profile:Profile;completions:Record<string,boolean>;rewarded:string[];focusTimer:FocusTimer|null } & Record<Collection,Item[]>;
export type Command = { type:string;collection?:string;item?:any;id?:string;date?:string;done?:boolean;month?:string;profile?:any;state?:any;items?:any[];text?:string;action?:string;kind?:string;boardCardId?:string;code?:string;title?:string;minutes?:number;replace?:boolean;reason?:string };
// boardCards: card sugerido para o quadro do Foco (fica em tabela própria, não no workspace).
export type Proposal = {collection:Collection|'boardCards';item:Partial<Item>};
export type StateResponse = {state:Workspace;version:number;user:{name:string;email:string}};

