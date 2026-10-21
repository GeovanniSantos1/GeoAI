export const COLLECTIONS = ['tasks','objectives','transactions','bills','cards','journal','workouts','sessions','measurements','courses','activities','books','readingLogs','rooms','chores','shopping','clients','workGoals','sleep','vices','relapses','notes','reviews','focusSessions','labExams','trtProtocols','trtDoses','periods','symptoms','contraceptives','contraceptiveDoses','preventives','intimacy','investments','investmentEvents'] as const;
export type Collection = typeof COLLECTIONS[number];
export type Item = { id: string; title: string; [key: string]: any };
export type Gender = 'male'|'female'|'';
export type HairStyle = 'longo'|'cacheado'|'coque';
export type Profile = { name:string;timezone:string;theme:string;budget:number;openingBalance:number;categoryBudgets:Record<string,number>;sleepGoal:number;bedtime:string;waketime:string;dailyTarget:number;assistantName:string;xp:number;points:number;gender:Gender;avatar:{skin:string;hair:string;beard:boolean;shirt:string;style:HairStyle;earrings:boolean};unlockedMoments:string[] };
export type Workspace = { profile:Profile;completions:Record<string,boolean>;rewarded:string[] } & Record<Collection,Item[]>;
export type Command = { type:string;collection?:string;item?:any;id?:string;date?:string;done?:boolean;month?:string;profile?:any;state?:any;items?:any[];text?:string };
export type Proposal = {collection:Collection;item:Partial<Item>};
export type StateResponse = {state:Workspace;version:number;user:{name:string;email:string}};

