// Lê no aparelho o texto de um PDF de fatura; o unpdf só é baixado quando a pessoa importa uma fatura.
export async function pdfText(file:File,password?:string):Promise<string>{
 if(file.size>10*1024*1024||!(file.type==='application/pdf'||/\.pdf$/i.test(file.name)))throw new Error('Escolha um PDF de até 10 MB.');
 let mod:typeof import('unpdf');try{mod=await import('unpdf');}catch{throw new Error('Não consegui abrir o leitor de PDF. Confira a conexão e tente de novo.');}
 const {getDocumentProxy,extractText}=mod;
 try{const pdf=await getDocumentProxy(new Uint8Array(await file.arrayBuffer()),password?{password}:undefined);
  // Libera o documento depois de ler, mesmo se a extração falhar.
  try{const {text}=await extractText(pdf,{mergePages:false});return (Array.isArray(text)?text:[text]).join('\n');}finally{void pdf.loadingTask.destroy();}}
 catch(e){const err=e as {name?:string;code?:number};
  // PasswordException do pdf.js: código 1 pede senha, código 2 é senha errada.
  if(err?.name==='PasswordException')throw new Error(err.code===2||password?'Senha do PDF incorreta.':'Esta fatura está protegida. Informe a senha do PDF.');
  throw new Error('Não consegui ler este PDF. Tente exportar de novo pelo app do banco.');}}
