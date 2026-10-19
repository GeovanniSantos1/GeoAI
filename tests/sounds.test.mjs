import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,MOMENTS,MOMENT_ORDER,NOISES,DEFAULT_PREFS,MUSIC_BASE_URL,binaural,waveLabel,trackUrl,tracksFor,nextTrack,noiseSamples,fadeGain,formatClock,formatDuration,nowPlaying,sanitizePrefs} from '../lib/sounds.ts';

let seed=7;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};

test('catálogo: 3+ faixas por momento, ids e arquivos únicos, campos e links válidos',()=>{
 for(const m of MOMENT_ORDER)assert.ok(tracksFor(m).length>=3,m);
 assert.equal(new Set(TRACKS.map(t=>t.id)).size,TRACKS.length);assert.equal(new Set(TRACKS.map(t=>t.file)).size,TRACKS.length);
 for(const t of TRACKS){assert.ok(t.file.endsWith('.mp3'),t.id);for(const k of ['title','author','license','credit'])assert.ok(t[k].trim(),t.id+' '+k);
  for(const k of ['licenseUrl','sourceUrl','downloadUrl'])assert.equal(new URL(t[k]).protocol,'https:',t.id+' '+k);
  assert.ok(Number.isInteger(t.durationSec)&&t.durationSec>60,t.id);assert.ok(MOMENT_ORDER.includes(t.moment),t.id);assert.equal(trackUrl(t),MUSIC_BASE_URL+t.file);}
 assert.ok(MUSIC_BASE_URL.startsWith('https://')&&MUSIC_BASE_URL.endsWith('/musicas/'));});
test('ondas: alfa 10 Hz no foco, alfa 8 Hz no relaxar, teta 6 Hz no dormir',()=>{
 assert.deepEqual(binaural('foco'),{left:200,right:210});assert.deepEqual(binaural('relaxar'),{left:200,right:208});assert.deepEqual(binaural('dormir'),{left:200,right:206});
 assert.equal(waveLabel('foco'),'Ondas alfa 10 Hz');assert.equal(waveLabel('relaxar'),'Ondas alfa 8 Hz');assert.equal(waveLabel('dormir'),'Ondas teta 6 Hz');
 assert.deepEqual(MOMENT_ORDER.map(m=>MOMENTS[m].noise),['none','pink','brown']);assert.deepEqual(NOISES.map(n=>n.id),['none','white','pink','brown']);});
test('próxima faixa avança, volta ao início e começa pela primeira',()=>{const list=tracksFor('relaxar');
 assert.equal(nextTrack('relaxar',list[0].id).id,list[1].id);assert.equal(nextTrack('relaxar',list.at(-1).id).id,list[0].id);
 assert.equal(nextTrack('relaxar','nao-existe').id,list[0].id);assert.equal(nextTrack('relaxar',null).id,list[0].id);
 assert.equal(nextTrack('relaxar',tracksFor('foco')[0].id).id,list[0].id);});
test('ruídos ficam entre -1 e 1, têm o tamanho pedido, média perto de zero e emenda do loop sem salto',()=>{
 for(const kind of ['white','pink','brown']){const s=noiseSamples(kind,48000,rand);assert.equal(s.length,48000);let sum=0;for(const v of s){assert.ok(v>=-1&&v<=1,kind);sum+=v;}
  assert.ok(Math.abs(sum/s.length)<0.2,kind+' média');assert.ok(s.some(v=>v!==0),kind);}
 assert.ok(noiseSamples('none',1000,rand).every(v=>v===0));
 const brown=noiseSamples('brown',48000,rand);assert.ok(Math.abs(brown[0]-brown.at(-1))<0.1,'emenda');});
test('descida do volume, relógio e duração',()=>{
 assert.equal(fadeGain(60000),1);assert.equal(fadeGain(30000),1);assert.equal(fadeGain(15000),0.5);assert.equal(fadeGain(0),0);assert.equal(fadeGain(-5),0);
 assert.deepEqual([0,1500,61000,750000,3661000].map(formatClock),['0:00','0:02','1:01','12:30','1:01:01']);assert.equal(formatDuration(205),'3:25');});
test('texto do tocando agora',()=>{const t=TRACKS.find(x=>x.id==='satie-gymnopedie-1');
 assert.equal(nowPlaying({moment:'foco',track:t,musicPlaying:true,wavesPlaying:true,noise:'none'}),'Gymnopédie nº 1 · Ondas alfa 10 Hz');
 assert.equal(nowPlaying({moment:'dormir',track:null,musicPlaying:false,wavesPlaying:true,noise:'brown'}),'Ondas teta 6 Hz · ruído marrom');
 assert.equal(nowPlaying({moment:'relaxar',track:t,musicPlaying:true,wavesPlaying:false,noise:'pink'}),'Gymnopédie nº 1');
 assert.equal(nowPlaying({moment:'relaxar',track:t,musicPlaying:false,wavesPlaying:false,noise:'pink'}),'Pausado');});
test('preferências inválidas voltam aos padrões',()=>{
 assert.deepEqual(sanitizePrefs(null),DEFAULT_PREFS);assert.deepEqual(sanitizePrefs('x'),DEFAULT_PREFS);
 assert.deepEqual(sanitizePrefs({musicVolume:2,wavesVolume:0.5,noise:{foco:'brown',relaxar:'xx'},focusAutoplay:'yes',moment:'nada'}),{musicVolume:0.7,wavesVolume:0.5,noise:{foco:'brown',relaxar:'pink',dormir:'brown'},focusAutoplay:false,moment:'foco'});
 assert.deepEqual(sanitizePrefs({musicVolume:0,wavesVolume:1,noise:{foco:'none',relaxar:'white',dormir:'pink'},focusAutoplay:true,moment:'dormir'}),{musicVolume:0,wavesVolume:1,noise:{foco:'none',relaxar:'white',dormir:'pink'},focusAutoplay:true,moment:'dormir'});});
