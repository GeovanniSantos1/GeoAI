export const COLLECTIONS = ['tasks','objectives','transactions','bills','cards','journal','workouts','sessions','measurements','courses','activities','books','readingLogs','rooms','chores','shopping','clients','workGoals','sleep','vices','relapses','notes','reviews','focusSessions','labExams','trtProtocols','trtDoses'] as const;
export type Collection = typeof COLLECTIONS[number];
export type Item = { id: string; title: string; [key: string]: any };
export type Profile = { name:string;timezone:string;theme:string;budget:number;openingBalance:number;sleepGoal:number;bedtime:string;waketime:string;dailyTarget:number;assistantName:string;xp:number;points:number;avatar:{skin:string;hair:string;beard:boolean;shirt:string};unlockedMoments:string[] };
export type Workspace = { profile:Profile;completions:Record<string,boolean>;rewarded:string[] } & Record<Collection,Item[]>;
export type Command = { type:string;collection?:string;item?:any;id?:string;date?:string;done?:boolean;month?:string;profile?:any;state?:any;items?:any[];text?:string };
export type Proposal = {collection:Collection;item:Partial<Item>};
export type StateResponse = {state:Workspace;version:number;user:{name:string;email:string}};

