import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../lib/core.ts';
import {normalizeGraphEvent,normalizeGoogleEvent,externalOn,agendaItems,agendaOrder,externalWhen,hasScope,isStale,timeAgo} from '../lib/external-calendar.ts';

const teams={id:'AAMk1',subject:'Daily do projeto',start:{dateTime:'2026-10-20T12:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2026-10-20T12:30:00.0000000',timeZone:'UTC'},isAllDay:false,isCancelled:false,location:{displayName:'Microsoft Teams Meeting'},onlineMeeting:{joinUrl:'https://teams.microsoft.com/l/meetup-join/abc'},webLink:'https://outlook.office365.com/owa/?itemid=AAMk1',responseStatus:{response:'accepted'}};
const meet={id:'g1',status:'confirmed',summary:'Dentista',start:{dateTime:'2026-10-20T14:00:00-03:00'},end:{dateTime:'2026-10-20T15:00:00-03:00'},location:'Rua A, 10',hangoutLink:'https://meet.google.com/abc-defg-hij',htmlLink:'https://www.google.com/calendar/event?eid=g1'};
const ev=extra=>({id:'e',provider:'microsoft',title:'Evento',allDay:false,start:'2026-10-20T12:00:00Z',end:'2026-10-20T13:00:00Z',...extra});
const SP='America/Sao_Paulo',NOW=Date.parse('2026-10-18T12:00:00Z');

test('Graph: reunião do Teams vira evento em UTC com link e local',()=>{
 assert.deepEqual(normalizeGraphEvent(teams),{id:'AAMk1',provider:'microsoft',title:'Daily do projeto',allDay:false,start:'2026-10-20T12:00:00Z',end:'2026-10-20T12:30:00Z',location:'Microsoft Teams Meeting',joinUrl:'https://teams.microsoft.com/l/meetup-join/abc',webLink:'https://outlook.office365.com/owa/?itemid=AAMk1'});});
test('Graph: dia inteiro, cancelado, recusado, sem título e link sem https',()=>{
 const day=normalizeGraphEvent({...teams,id:'d',isAllDay:true,start:{dateTime:'2026-10-21T00:00:00.0000000'},end:{dateTime:'2026-10-22T00:00:00.0000000'},onlineMeeting:null});
 assert.equal(day.allDay,true);assert.equal(day.start,'2026-10-21');assert.equal(day.end,'2026-10-22');assert.equal('joinUrl' in day,false);
 assert.equal(normalizeGraphEvent({...teams,isCancelled:true}),null);
 assert.equal(normalizeGraphEvent({...teams,responseStatus:{response:'declined'}}),null);
 assert.equal(normalizeGraphEvent({...teams,id:undefined}),null);
 const bare=normalizeGraphEvent({...teams,subject:'  ',webLink:'http://outlook.example.com/x',location:{displayName:''}});
 assert.equal(bare.title,'(Sem título)');assert.equal('webLink' in bare,false);assert.equal('location' in bare,false);
 const long=normalizeGraphEvent({...teams,subject:'Linha 1\nLinha 2 '+'x'.repeat(300)});assert.equal(long.title.length,180);assert.ok(long.title.startsWith('Linha 1 Linha 2 x'));});
test('evento sem fim ou com fim antes do início não quebra',()=>{
 assert.equal(normalizeGraphEvent({...teams,end:undefined}).end,'2026-10-20T12:00:00Z');
 assert.equal(normalizeGraphEvent({...teams,end:{dateTime:'2026-10-20T11:00:00.0000000'}}).end,'2026-10-20T12:00:00Z');
 assert.equal(normalizeGoogleEvent({id:'g',summary:'X',start:{date:'2026-10-23'},end:{date:'2026-10-23'}}).end,'2026-10-24');
 assert.equal(normalizeGoogleEvent({id:'g',summary:'X',start:{date:'2026-10-23'}}).end,'2026-10-24');});
test('Google: Meet, Zoom pela conferência, dia inteiro, cancelado e recusado',()=>{
 assert.deepEqual(normalizeGoogleEvent(meet),{id:'g1',provider:'google',title:'Dentista',allDay:false,start:'2026-10-20T17:00:00Z',end:'2026-10-20T18:00:00Z',location:'Rua A, 10',joinUrl:'https://meet.google.com/abc-defg-hij',webLink:'https://www.google.com/calendar/event?eid=g1'});
 assert.equal(normalizeGoogleEvent({...meet,hangoutLink:undefined,conferenceData:{entryPoints:[{entryPointType:'phone',uri:'tel:+5511'},{entryPointType:'video',uri:'https://zoom.us/j/1'}]}}).joinUrl,'https://zoom.us/j/1');
 const trip=normalizeGoogleEvent({id:'g2',summary:'Viagem',start:{date:'2026-10-23'},end:{date:'2026-10-26'}});assert.deepEqual([trip.allDay,trip.start,trip.end],[true,'2026-10-23','2026-10-26']);
 assert.equal(normalizeGoogleEvent({...meet,status:'cancelled'}),null);
 assert.equal(normalizeGoogleEvent({...meet,attendees:[{email:'a@x.com',responseStatus:'accepted'},{self:true,responseStatus:'declined'}]}),null);
 assert.notEqual(normalizeGoogleEvent({...meet,attendees:[{email:'a@x.com',responseStatus:'declined'},{self:true,responseStatus:'accepted'}]}),null);});
test('externalOn usa o fuso do perfil, cruza a meia-noite e continua eventos longos',()=>{
 assert.deepEqual(externalOn([ev({start:'2026-10-21T01:00:00Z',end:'2026-10-21T02:00:00Z'})],'2026-10-20',SP),[{id:'microsoft:e',title:'Evento',type:'event',provider:'microsoft',_collection:'external',time:'22:00',endTime:'23:00'}]);
 assert.deepEqual(externalOn([ev({start:'2026-10-21T01:00:00Z',end:'2026-10-21T02:00:00Z'})],'2026-10-21',SP),[]);
 const night=ev({start:'2026-10-21T02:00:00Z',end:'2026-10-21T03:30:00Z'});
 assert.deepEqual(externalOn([night],'2026-10-20',SP).map(x=>[x.time,x.endTime]),[['23:00','00:30']]);assert.deepEqual(externalOn([night],'2026-10-21',SP),[]);
 const long=ev({start:'2026-10-20T12:00:00Z',end:'2026-10-22T12:00:00Z'});
 const first=externalOn([long],'2026-10-20',SP)[0];assert.equal(first.time,'09:00');assert.equal('endTime' in first,false);
 for(const d of ['2026-10-21','2026-10-22'])assert.deepEqual(externalOn([long],d,SP).map(x=>[x.allDay,x.continued,x.time]),[[true,true,undefined]]);
 assert.deepEqual(externalOn([long],'2026-10-23',SP),[]);
 const fullDay=ev({start:'2026-10-20T03:00:00Z',end:'2026-10-21T03:00:00Z'});assert.equal(externalOn([fullDay],'2026-10-20',SP)[0].time,'00:00');assert.deepEqual(externalOn([fullDay],'2026-10-21',SP),[]);
 const trip=ev({allDay:true,start:'2026-10-23',end:'2026-10-26'});
 assert.deepEqual(['2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26'].map(d=>externalOn([trip],d,SP).length),[0,1,1,1,0]);
 const linked=externalOn([ev({joinUrl:'https://teams.microsoft.com/x',location:'Sala 3'})],'2026-10-20',SP)[0];assert.equal(linked.joinUrl,'https://teams.microsoft.com/x');assert.equal(linked.location,'Sala 3');});
test('externalOn acompanha o horário de verão de Lisboa',()=>{
 assert.deepEqual(externalOn([ev({start:'2026-10-24T09:00:00Z',end:'2026-10-24T10:00:00Z'})],'2026-10-24','Europe/Lisbon').map(x=>[x.time,x.endTime]),[['10:00','11:00']]);
 assert.deepEqual(externalOn([ev({start:'2026-10-26T09:00:00Z',end:'2026-10-26T10:00:00Z'})],'2026-10-26','Europe/Lisbon').map(x=>[x.time,x.endTime]),[['09:00','10:00']]);
 assert.equal(externalOn([ev({start:'2026-10-24T09:00:00Z',end:'2026-10-24T10:00:00Z'})],'2026-10-24',SP)[0].time,'06:00');});
test('agendaItems junta ações e externos; dia inteiro primeiro e sem horário por último',()=>{
 const s=emptyWorkspace('Geo');s.tasks=[{id:'t1',title:'Revisar proposta',date:'2026-10-20',time:'10:30',type:'task'},{id:'t2',title:'Ler',date:'2026-10-20',type:'task'}];
 const items=agendaItems(s,[ev({id:'m',title:'Daily',start:'2026-10-20T12:00:00Z',end:'2026-10-20T12:30:00Z'}),ev({id:'f',provider:'google',title:'Feriado',allDay:true,start:'2026-10-20',end:'2026-10-21'})],'2026-10-20').sort(agendaOrder);
 assert.deepEqual(items.map(x=>x.title),['Feriado','Daily','Revisar proposta','Ler']);assert.deepEqual(items.map(x=>x._collection),['external','external','tasks','tasks']);});
test('textos de horário, escopos, espelho vencido e "há X"',()=>{
 assert.equal(externalWhen({id:'a',title:'a',time:'09:00',endTime:'09:30'}),'09:00–09:30');assert.equal(externalWhen({id:'a',title:'a',time:'09:00'}),'09:00');
 assert.equal(externalWhen({id:'a',title:'a',allDay:true}),'Dia inteiro');assert.equal(externalWhen({id:'a',title:'a',allDay:true,continued:true}),'Continua');
 assert.equal(hasScope('google',['openid','https://www.googleapis.com/auth/calendar.events.readonly']),true);assert.equal(hasScope('google',['openid']),false);
 assert.equal(hasScope('google',['https://www.googleapis.com/auth/calendar']),true);assert.equal(hasScope('microsoft',['https://graph.microsoft.com/Calendars.Read']),true);
 assert.equal(hasScope('microsoft',['calendars.read']),true);assert.equal(hasScope('microsoft',['User.Read']),false);assert.equal(hasScope('microsoft',undefined),true);
 assert.equal(isStale([{syncedAt:null}],NOW,600000),true);assert.equal(isStale([{syncedAt:'2026-10-18T11:55:00Z'}],NOW,600000),false);
 assert.equal(isStale([{syncedAt:'2026-10-18T11:49:00Z'}],NOW,600000),true);assert.equal(isStale([],NOW,600000),false);
 assert.deepEqual(['2026-10-18T11:59:30Z','2026-10-18T11:55:00Z','2026-10-18T10:00:00Z','2026-10-17T12:00:00Z','2026-10-15T12:00:00Z'].map(x=>timeAgo(x,NOW)),['agora','há 5 min','há 2 h','há 1 dia','há 3 dias']);});
