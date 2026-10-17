import {House,CalendarDays,Target,ChartNoAxesCombined,Timer,Heart, Dumbbell,Utensils, Sparkles,Wallet,BookOpen,ShoppingBasket,Briefcase,ShieldCheck,Moon,UserRound,NotebookPen,Settings,Compass,ClipboardCheck} from 'lucide-react';
import type {Collection,Workspace} from '@/lib/types';
export const NAV=[
{id:'inicio',path:'/',label:'Meu dia',icon:House,group:'SEU DIA'},
{id:'agenda',path:'/agenda-v2',label:'Agenda',icon:CalendarDays,group:'SEU DIA'},
{id:'plano',path:'/habits',label:'Meus objetivos',icon:Target,group:'SEU DIA'},
{id:'tracker',path:'/tracker',label:'Habit tracker',icon:ChartNoAxesCombined,group:'SEU DIA'},
{id:'foco',path:'/pomodoro',label:'Foco',icon:Timer,group:'SEU DIA'},
{id:'treinos',path:'/treinos',label:'Treinos',icon:Dumbbell,group:'CUIDE DE VOCÊ'},
{id:'alimentacao',path:'/alimentacao',label:'Alimentação',icon:Utensils,group:'CUIDE DE VOCÊ'},
{id:'cuidados',path:'/beleza',label:'Cuidados pessoais',icon:Sparkles,group:'CUIDE DE VOCÊ'},
{id:'journal',path:'/journal',label:'Bem-estar',icon:Heart,group:'CUIDE DE VOCÊ'},
{id:'sono',path:'/sono',label:'Sono',icon:Moon,group:'CUIDE DE VOCÊ'},
{id:'vicios',path:'/vicios',label:'Novos caminhos',icon:ShieldCheck,group:'CUIDE DE VOCÊ'},
{id:'financas',path:'/financas',label:'Finanças',icon:Wallet,group:'SUA VIDA EM ORDEM'},
{id:'estudos',path:'/estudos',label:'Estudos & leituras',icon:BookOpen,group:'SUA VIDA EM ORDEM'},
{id:'casa',path:'/casa',label:'Casa & compras',icon:ShoppingBasket,group:'SUA VIDA EM ORDEM'},
{id:'trabalho',path:'/trabalho',label:'Trabalho',icon:Briefcase,group:'SUA VIDA EM ORDEM'},
{id:'notas',path:'/brain-dump',label:'Esvaziar a mente',icon:NotebookPen,group:'SUA VIDA EM ORDEM'},
{id:'revisao',path:'/revisao-semanal',label:'Revisão semanal',icon:ClipboardCheck,group:'EVOLUA'},
{id:'avatar',path:'/it-girl-collection',label:'Sua jornada',icon:Compass,group:'EVOLUA'},
{id:'perfil',path:'/perfil',label:'Configurações',icon:Settings,group:'EVOLUA'}
];
export type Field={key:string;label:string;type?:string;options?:string[][];required?:boolean;hint?:string;min?:number;max?:number;step?:string;source?:Collection;default?:any};
const title:Field={key:'title',label:'Título',required:true};
const date:Field={key:'date',label:'Data',type:'date',required:true};
const notes:Field={key:'notes',label:'Observações',type:'textarea'};
const amount:Field={key:'amount',label:'Valor (R$)',type:'money',required:true};
const status:Field={key:'status',label:'Status',type:'select',options:[['active','Em andamento'],['done','Concluído'],['paused','Pausado']],default:'active'};
const repeat:Field={key:'repeat',label:'Repetição',type:'select',options:[['none','Não repetir'],['daily','Todos os dias'],['weekdays','Dias úteis'],['weekly','Semanalmente'],['monthly','Mensalmente']],default:'none'};
const cat=(options:string[])=>({key:'category',label:'Categoria',type:'select',options:options.map(x=>[x,x])} as Field);
export const FIELDS:Record<Collection,Field[]>={
tasks:[{...title,label:'O que você vai fazer?'},{key:'type',label:'Tipo',type:'select',options:[['task','Tarefa'],['habit','Hábito'],['event','Compromisso']],default:'task'},date,{key:'time',label:'Horário',type:'time'},{key:'duration',label:'Duração (min)',type:'number',default:30,min:1},repeat,{key:'repeatUntil',label:'Repetir até',type:'date'},{key:'section',label:'Área',type:'select',options:[['pessoal','Pessoal'],['trabalho','Trabalho'],['alimentacao','Alimentação'],['cuidados','Cuidados'],['estudos','Estudos']],default:'pessoal'},{key:'priority',label:'Prioridade',type:'select',options:[['normal','Normal'],['high','Alta'],['low','Baixa']],default:'normal'},{key:'objectiveId',label:'Vincular a objetivo',type:'select',source:'objectives'},{key:'clientId',label:'Cliente',type:'select',source:'clients'},cat(['Rotina','Refeições','Hidratação','Suplementos','Planejamento','Pele','Cabelo & barba','Higiene','Autocuidado']),notes],
objectives:[{...title,label:'Qual é o seu objetivo?'},{key:'target',label:'Meta',type:'number',required:true,min:1,default:1},{key:'current',label:'Progresso atual',type:'number',default:0},{key:'unit',label:'Unidade',hint:'Ex.: livros, km, aulas'},{key:'deadline',label:'Prazo',type:'date'},status,notes],
transactions:[title,amount,{key:'direction',label:'Tipo',type:'select',options:[['expense','Despesa'],['income','Receita']],default:'expense'},date,cat(['Alimentação','Mercado','Casa','Transporte','Saúde','Educação','Lazer','Salário','Contas','Outros']),{key:'cardId',label:'Cartão',type:'select',source:'cards'},notes],
bills:[title,amount,{key:'day',label:'Dia de vencimento',type:'number',min:1,max:31,default:10},cat(['Casa','Assinaturas','Saúde','Educação','Contas','Outros']),notes],
cards:[{...title,label:'Nome do cartão'},{key:'target',label:'Limite (R$)',type:'money'}, {key:'closingDay',label:'Dia de fechamento',type:'number',min:1,max:31,default:25},{key:'dueDay',label:'Dia de vencimento',type:'number',min:1,max:31,default:5}],
journal:[{...title,label:'Título do registro'},date,{key:'mood',label:'Como você está?',type:'select',options:[['5','Muito bem'],['4','Bem'],['3','Na média'],['2','Um pouco difícil'],['1','Dia difícil']],default:3},{key:'content',label:'O que está passando pela sua cabeça?',type:'textarea'},{key:'tags',label:'Palavras que descrevem o dia',hint:'Trabalho, família, cansaço…'}],
workouts:[title,{key:'exercises',label:'Exercícios, séries e repetições',type:'textarea',required:true,hint:'Um exercício por linha. Ex.: Agachamento · 3 séries de 10'}, {key:'duration',label:'Duração prevista (min)',type:'number',default:45},notes],
sessions:[title,date,{key:'workoutId',label:'Treino',type:'select',source:'workouts'},{key:'duration',label:'Duração (min)',type:'number',default:45},notes],
measurements:[title,date,{key:'weight',label:'Peso (kg)',type:'number',step:'0.1'},{key:'waist',label:'Cintura (cm)',type:'number',step:'0.1'},{key:'chest',label:'Peito (cm)',type:'number',step:'0.1'},{key:'arm',label:'Braço (cm)',type:'number',step:'0.1'},notes],
courses:[title,{key:'subject',label:'Área de estudo'},{key:'url',label:'Link do material',type:'url'},status,notes],
activities:[title,date,{key:'courseId',label:'Estudo',type:'select',source:'courses'},{key:'duration',label:'Tempo previsto (min)',type:'number',default:30},status,notes],
books:[{...title,label:'Livro'},{key:'subject',label:'Autor'},{key:'pages',label:'Total de páginas',type:'number',min:1,required:true},{key:'pagesRead',label:'Páginas lidas',type:'number',default:0},status,notes],
readingLogs:[title,date,{key:'bookId',label:'Livro',type:'select',source:'books'},{key:'pages',label:'Páginas lidas',type:'number',min:1},notes],
rooms:[{...title,label:'Nome do cômodo'},notes],
chores:[title,{key:'roomId',label:'Cômodo',type:'select',source:'rooms'},date,repeat,{key:'checked',label:'Concluída',type:'checkbox'},notes],
shopping:[{...title,label:'O que falta comprar?'},{key:'quantity',label:'Quantidade',type:'number',default:1,min:1},cat(['Mercado','Casa','Pessoal','Outros']),{key:'checked',label:'Já comprei',type:'checkbox'},notes],
clients:[{...title,label:'Nome do cliente'},{key:'company',label:'Empresa'},{key:'email',label:'Email',type:'email'},{key:'phone',label:'Telefone'},notes],
workGoals:[title,{key:'clientId',label:'Cliente',type:'select',source:'clients'},{key:'deadline',label:'Prazo',type:'date'},{key:'target',label:'Etapas previstas',type:'number',default:1,min:1},{key:'current',label:'Etapas concluídas',type:'number',default:0},status,notes],
sleep:[title,date,{key:'bedtime',label:'Fui dormir às',type:'time',required:true,default:'23:00'},{key:'waketime',label:'Acordei às',type:'time',required:true,default:'07:00'},{key:'quality',label:'Qualidade da noite',type:'select',options:[['5','Excelente'],['4','Boa'],['3','Regular'],['2','Ruim'],['1','Muito ruim']],default:3},notes],
vices:[{...title,label:'O que você quer deixar para trás?'},{key:'startDate',label:'Comecei em',type:'date',required:true},{key:'costPerDay',label:'Quanto gastava por dia (R$)',type:'money'},notes],
relapses:[title,date,{key:'viceId',label:'Qual caminho?',type:'select',source:'vices',required:true},{key:'trigger',label:'O que desencadeou?',type:'textarea'},notes],
notes:[title,cat(['Ideias','Tarefas','Compras','Notas']),{key:'content',label:'Tire da cabeça',type:'textarea',required:true}],
reviews:[title,date,{key:'category',label:'Direção da próxima semana',type:'select',options:[['space','Mais espaço livre'],['progress','Avançar no objetivo'],['keep','Manter o ritmo'],['reorganize','Reorganizar horários']]},{key:'content',label:'Reflexão da semana',type:'textarea'}],
focusSessions:[title,date,{key:'duration',label:'Minutos de foco',type:'number',min:1,default:25},notes],
labExams:[],
trtProtocols:[{...title,label:'Medicamento',hint:'Ex.: Durateston, Deposteron, Nebido, testosterona gel'},{key:'dose',label:'Dose',type:'number',step:'0.1',min:0,required:true},{key:'unit',label:'Unidade',type:'select',options:[['mg','mg'],['mL','mL'],['g','g']],default:'mg'},{key:'intervalDays',label:'Intervalo entre aplicações (dias)',type:'number',min:1,max:90,required:true,default:14},{key:'startDate',label:'Início',type:'date',required:true},{key:'doctor',label:'Médico responsável'},{key:'status',label:'Situação',type:'select',options:[['active','Ativo'],['paused','Pausado']],default:'active'},{key:'remind',label:'Lembrar no Telegram',type:'checkbox',default:true},notes],
trtDoses:[{...title,label:'Registro'},date,{key:'protocolId',label:'Protocolo',type:'select',source:'trtProtocols',required:true},{key:'dose',label:'Dose',type:'number',step:'0.1',min:0},{key:'site',label:'Local',type:'select',options:[['','Não informado'],['Glúteo','Glúteo'],['Coxa','Coxa'],['Deltoide','Deltoide'],['Abdômen','Abdômen'],['Outro','Outro']]},{...notes,label:'Como você se sentiu?'}]
};
export const COLLECTION_LABELS:Record<Collection,string>={tasks:'Nova ação',objectives:'Novo objetivo',transactions:'Novo lançamento',bills:'Nova conta',cards:'Novo cartão',journal:'Registrar meu dia',workouts:'Novo treino',sessions:'Registrar treino',measurements:'Peso e medidas',courses:'Novo estudo',activities:'Planejar atividade',books:'Adicionar livro',readingLogs:'Registrar leitura',rooms:'Novo cômodo',chores:'Nova tarefa de casa',shopping:'Adicionar à lista',clients:'Novo cliente',workGoals:'Nova meta de trabalho',sleep:'Registrar minha noite',vices:'Começar um novo caminho',relapses:'Registrar recomeço',notes:'Nova anotação',reviews:'Minha revisão',focusSessions:'Registrar foco',labExams:'Novo exame',trtProtocols:'Novo protocolo',trtDoses:'Registrar aplicação'};
export const relationOptions=(field:Field,state:Workspace)=>field.source?[['','Sem vínculo'],...state[field.source].map(x=>[x.id,x.title])]:field.options||[];

