// Sobe as faixas do menu Músicas para o Vercel Blob público geoai-musicas.
// Uso: node --env-file=<arquivo com MUSIC_BLOB_TOKEN=...> --experimental-strip-types scripts/upload-music.mjs [id ...]
// O token de leitura e escrita do armazenamento nunca vai para o repositório.
import {put} from '@vercel/blob';
import {TRACKS,MUSIC_BASE_URL} from '../lib/sounds.ts';
const token=process.env.MUSIC_BLOB_TOKEN;
if(!token){console.error('Defina MUSIC_BLOB_TOKEN.');process.exit(1);}
const only=new Set(process.argv.slice(2));
for(const t of TRACKS.filter(x=>!only.size||only.has(x.id))){
 const r=await fetch(t.downloadUrl,{headers:{'User-Agent':'GeoAI-music-upload/1.0 (https://geo-ai-mocha.vercel.app)'}});
 if(!r.ok)throw new Error(t.id+': download '+r.status);
 const body=Buffer.from(await r.arrayBuffer());
 const blob=await put('musicas/'+t.file,body,{access:'public',token,addRandomSuffix:false,allowOverwrite:true,contentType:'audio/mpeg',cacheControlMaxAge:31536000});
 console.log(t.id,(body.length/1048576).toFixed(1)+' MB',blob.url===MUSIC_BASE_URL+t.file?'ok':'ENDEREÇO DIFERENTE: '+blob.url);
}
