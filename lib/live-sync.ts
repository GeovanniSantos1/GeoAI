// Atualização automática do portal. Puro: decide quando conferir a versão do espaço no servidor e quando aplicar o que voltou.
export const CHECK_MS=10_000,IDLE_MS=10*60_000,MIN_GAP_MS=2_000;
export type SyncClock={visible:boolean;busy:boolean;now:number;lastActivity:number;lastCheck:number};
// Só com a aba visível, sem gravação em andamento e com uso recente: parado, o banco pode hibernar. Foco e visibilidade chegam juntos, daí o intervalo mínimo.
export const shouldCheck=(c:SyncClock)=>c.visible&&!c.busy&&c.now-c.lastActivity<IDLE_MS&&c.now-c.lastCheck>=MIN_GAP_MS;
// Uma interação depois de um tempo parado confere na hora, sem esperar o próximo ciclo.
export const wokeUp=(now:number,lastActivity:number)=>now-lastActivity>=IDLE_MS;
// Só um espaço mais novo que o da tela é aplicado: uma leitura antiga não desfaz uma gravação local que terminou antes.
export const isNewer=(server:number,local:number)=>Number.isSafeInteger(server)&&server>local;
export const parseSince=(raw:string|null)=>raw!==null&&/^\d+$/.test(raw)&&Number.isSafeInteger(Number(raw))?Number(raw):null;
