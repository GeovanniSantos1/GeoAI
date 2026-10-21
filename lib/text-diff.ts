// Diff por palavra (maior subsequência comum) para a revisão das propostas da IA.
export type DiffPart={op:'same'|'add'|'del';text:string};
// Acima disso a tabela da subsequência ficaria grande demais para o navegador.
const MAX=2000;
const tokens=(s:string)=>s.match(/\s+|\S+\s*/g)??[];
function lcs<T>(a:T[],b:T[],eq:(x:T,y:T)=>boolean){const n=a.length,m=b.length,w=m+1,t=new Uint16Array((n+1)*w);
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)t[i*w+j]=eq(a[i],b[j])?t[(i+1)*w+j+1]+1:Math.max(t[(i+1)*w+j],t[i*w+j+1]);
 const out:{op:DiffPart['op'];i:number;j:number}[]=[];let i=0,j=0;
 while(i<n&&j<m){if(eq(a[i],b[j])){out.push({op:'same',i,j});i++;j++;}else if(t[(i+1)*w+j]>=t[i*w+j+1])out.push({op:'del',i:i++,j:-1});else out.push({op:'add',i:-1,j:j++});}
 while(i<n)out.push({op:'del',i:i++,j:-1});while(j<m)out.push({op:'add',i:-1,j:j++});return out;}
const merge=(parts:DiffPart[])=>parts.reduce<DiffPart[]>((acc,p)=>{const last=acc.at(-1);if(!p.text)return acc;if(last&&last.op===p.op)last.text+=p.text;else acc.push({...p});return acc;},[]);
export function wordDiff(before:string,after:string):DiffPart[]{const a=tokens(before),b=tokens(after);if(a.length>MAX||b.length>MAX)return merge([{op:'del',text:before},{op:'add',text:after}]);
 return merge(lcs(a,b,(x,y)=>x.trim()===y.trim()).map(s=>s.op==='same'?{op:'same' as const,text:b[s.j]}:s.op==='del'?{op:'del' as const,text:a[s.i]}:{op:'add' as const,text:b[s.j]}));}
export function listDiff(before:string[],after:string[]):DiffPart[]{const k=(x:string)=>x.trim().toLowerCase();
 return lcs(before,after,(x,y)=>k(x)===k(y)).map(s=>s.op==='same'?{op:'same' as const,text:after[s.j]}:s.op==='del'?{op:'del' as const,text:before[s.i]}:{op:'add' as const,text:after[s.j]});}
