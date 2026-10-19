import {eq,and} from 'drizzle-orm';import {clerkClient} from '@clerk/nextjs/server';import {getDb} from '@/db';import {calendarFeeds} from '@/db/schema';import type {FeedRow,FeedStore,SyncDeps} from './calendar-sync';import type {ExternalEvent,FeedStatus,Provider} from './external-calendar';
// Liga a sincronização das agendas ao banco (calendar_feeds), aos tokens guardados pelo Clerk e à rede.
const parse=(text:string):ExternalEvent[]=>{try{const v=JSON.parse(text);return Array.isArray(v)?v:[];}catch{return [];}};
const toRow=(r:typeof calendarFeeds.$inferSelect):FeedRow=>({userId:r.userId,provider:r.provider as Provider,account:r.account,events:parse(r.events),syncedAt:r.syncedAt,status:r.status as FeedStatus,error:r.error,connectedAt:r.connectedAt});
const columns=(r:FeedRow)=>({account:r.account,events:JSON.stringify(r.events),syncedAt:r.syncedAt,status:r.status,error:r.error});
const match=(userId:string,provider:Provider)=>and(eq(calendarFeeds.userId,userId),eq(calendarFeeds.provider,provider));
export const feedStore:FeedStore={
 list:async userId=>(await getDb().select().from(calendarFeeds).where(eq(calendarFeeds.userId,userId))).map(toRow),
 get:async(userId,provider)=>{const row=(await getDb().select().from(calendarFeeds).where(match(userId,provider)).limit(1))[0];return row?toRow(row):null;},
 create:async r=>{await getDb().insert(calendarFeeds).values({userId:r.userId,provider:r.provider,connectedAt:r.connectedAt,...columns(r)}).onConflictDoNothing();},
 update:async r=>{await getDb().update(calendarFeeds).set(columns(r)).where(match(r.userId,r.provider));},
 remove:async(userId,provider)=>{await getDb().delete(calendarFeeds).where(provider?match(userId,provider):eq(calendarFeeds.userId,userId));},
 all:async()=>(await getDb().select().from(calendarFeeds)).map(toRow)};
// O Clerk renova o token quando preciso. Conta não ligada (erro 4xx do Clerk) conta como "sem token".
async function getToken(userId:string,provider:Provider){try{const res=await (await clerkClient()).users.getUserOauthAccessToken(userId,provider);const t=res.data[0];return t?.token?{token:t.token,scopes:t.scopes}:null;}
 catch(e){const status=(e as {status?:number}).status;if(status&&status>=400&&status<500)return null;throw e;}}
async function account(userId:string,provider:Provider){const user=await (await clerkClient()).users.getUser(userId);return user.externalAccounts.find(x=>x.provider===provider||x.provider==='oauth_'+provider)?.emailAddress||'';}
export const calendarDeps=():SyncDeps=>({store:feedStore,getToken,account,fetch:(url,init)=>fetch(url,init)});
