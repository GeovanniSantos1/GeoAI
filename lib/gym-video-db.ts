import {eq} from 'drizzle-orm';import {getDb} from '@/db';import {gymVideos} from '@/db/schema';import type {VideoCache,Video} from './gym-video';
// Cache dos vídeos por exercício (sem dono: só o nome do exercício do catálogo foi buscado).
export const dbVideoCache:VideoCache={
 async get(exerciseId){const r=await getDb().select().from(gymVideos).where(eq(gymVideos.exerciseId,exerciseId)).limit(1);if(!r[0])return null;try{return {videos:JSON.parse(r[0].videos) as Video[],fetchedAt:r[0].fetchedAt};}catch{return null;}},
 async put(exerciseId,videos,fetchedAt){const data=JSON.stringify(videos);await getDb().insert(gymVideos).values({exerciseId,videos:data,fetchedAt}).onConflictDoUpdate({target:gymVideos.exerciseId,set:{videos:data,fetchedAt}});}};
