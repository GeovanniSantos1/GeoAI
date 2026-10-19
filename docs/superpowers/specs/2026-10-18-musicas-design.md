# Menu Músicas — especificação

Data: 18/10/2026. Aprovado em conversa com o proprietário, em três partes (o que o usuário vê; motor de áudio, faixas e código; erros, configuração e testes). O proprietário pediu para seguir direto para a implementação, com revisão por tarefa e revisão final.

## Objetivo

Um menu **Músicas** com músicas instrumentais relaxantes e ondas binaurais (alfa e teta) para ouvir enquanto usa o GeoAI. O som continua tocando ao trocar de tela.

Sucesso: abrir o menu, tocar com um clique, ir para Agenda ou Finanças e o som continuar; ajustar música e ondas separadamente; programar para desligar sozinho; o Pomodoro poder tocar as ondas de foco ao começar.

## Decisões

- **Músicas livres dentro do app:** de 9 a 12 faixas instrumentais em MP3, com licença que permite redistribuir sem alteração: gravações em domínio público ou CC0 do Wikimedia Commons, e Kevin MacLeod (CC BY 4.0). Crédito de cada faixa no menu. Nada de Pixabay, NC, ND ou "royalty-free" sem licença CC/PD.
- **Ondas e ruídos gerados no navegador** (Web Audio): nenhum arquivo e nenhum direito autoral, e tocam sem fim.
- **Arquivos no Vercel Blob público `geoai-musicas`** (`store_mNAjGb8XmDrdyUwL`), separado do Blob privado dos exames. O app toca pelos endereços públicos e não usa token. O armazenamento fica ligado ao projeto só no ambiente de desenvolvimento enquanto as faixas sobem; depois a ligação é desfeita.
- **Nada salvo na conta.** Volumes, ruído de cada momento, última aba e a opção do Pomodoro ficam no aparelho (`localStorage`, com try/catch).
- **Vale para homens e mulheres.**

## Telas

### Menu "Músicas"

Item de menu `musicas`, rota `/musicas`, rótulo "Músicas", ícone `Headphones`, grupo "CUIDE DE VOCÊ", logo depois de "Sono".

- Cabeçalho: eyebrow "RESPIRE, FOQUE, DESCANSE", título "Músicas & ondas", descrição "Sons para focar, relaxar e dormir enquanto você usa o GeoAI."
- Abas **Foco**, **Relaxar** e **Dormir**. Cada aba tem:
  - **Ondas:** botão tocar/pausar das ondas do momento:
    - Foco: "Ondas alfa · 10 Hz".
    - Relaxar: "Ondas alfa · 8 Hz".
    - Dormir: "Ondas teta · 6 Hz".

    Seletor de ruído de fundo: Nenhum, Branco, Rosa ou Marrom. Aviso fixo: "Use fones de ouvido: as ondas binaurais precisam dos dois lados."
  - **Músicas:** lista das faixas do momento (título, autor, duração `m:ss`). Clicar numa faixa toca a faixa; ao terminar, segue para a próxima do mesmo momento, voltando ao início no fim da lista. A faixa tocando fica destacada.
  - **Mixer:** dois controles deslizantes de 0 a 100: "Música" e "Ondas".
  - **Timer:** "Desligar em" 15 min, 30 min, 60 min ou Sem timer. Com timer, o som baixa aos poucos nos últimos 30 segundos e para.
- **Opção do Pomodoro:** "Tocar ondas de foco ao iniciar um Pomodoro" (desligada por padrão).
- **Créditos**, no fim da página: uma linha por faixa (o `credit` do catálogo), com links para a fonte e para a licença.

### Mini-player

Aparece depois do primeiro play e fica em todas as telas até a pessoa fechar.

- **Posição:** no celular, logo acima da barra inferior; no computador, fixo no canto inferior esquerdo, sem cobrir o botão do assistente (canto inferior direito).
- **Conteúdo:**
  - texto "tocando agora", por exemplo "Gymnopédie nº 1 · Ondas alfa 10 Hz", "Ondas teta 6 Hz · ruído marrom" ou "Pausado";
  - tocar/pausar e próxima faixa;
  - tempo restante do timer ("desliga em 12:30");
  - fechar, que para tudo e esconde o mini-player.
- Clicar no texto abre `/musicas` na aba do momento atual.

### Integrações

- **Foco (Pomodoro):** com a opção ligada, iniciar o Pomodoro toca as ondas de Foco (com o ruído salvo para Foco), sem mexer na música. Pausar ou zerar pausa as ondas. Terminar a sessão baixa o som em 30 segundos e para. Com a opção desligada, o Pomodoro não mexe no som.
- **Sono:** botão "Sons para dormir" no menu Sono, que abre `/musicas` na aba Dormir. A aba vai por `sessionStorage`, chave `norte-music-moment`, como o Foco faz com `norte-focus-label`.
- **Controles do sistema** (Media Session): título e autor da faixa e as ações tocar, pausar e próxima, na tela de bloqueio e nas teclas de mídia, enquanto a aba estiver aberta.

## Lógica pura (`lib/sounds.ts`, testada)

```ts
export type Moment='foco'|'relaxar'|'dormir';
export type Noise='none'|'white'|'pink'|'brown';
export type Track={id:string;file:string;title:string;author:string;moment:Moment;durationSec:number;license:string;licenseUrl:string;sourceUrl:string;credit:string};
```

- `MOMENTS`: rótulos e ajustes de cada momento:
  - Foco: alfa 10 Hz, ruído padrão `none`;
  - Relaxar: alfa 8 Hz, ruído padrão `pink`;
  - Dormir: teta 6 Hz, ruído padrão `brown`.

  Nota base de 200 Hz.
- `binaural(moment)` → `{left:200, right:200+beat}`.
- `MUSIC_BASE_URL` = `https://mnajgb8xmdrdyuwl.public.blob.vercel-storage.com/musicas/` (confirmado no primeiro envio); `trackUrl(track)` = base + `file`.
- `TRACKS`: o catálogo, com pelo menos 3 faixas por momento, `id` único, campos todos preenchidos e `licenseUrl`/`sourceUrl` em `https:`.
- `tracksFor(moment)`, `nextTrack(moment, currentId)` (volta ao início; `currentId` desconhecido ou vazio → primeira faixa).
- `noiseSamples(kind, length, random=Math.random)`: `Float32Array` com valores entre -1 e 1. Branco é uniforme. Rosa usa o filtro de Paul Kellet. Marrom é a integração com vazamento, normalizada. `none` devolve zeros.
- `fadeGain(remainingMs, fadeMs=30000)`: 1 antes da descida, 0 no fim, linear entre os dois.
- `formatClock(ms)` → `m:ss` (ou `h:mm:ss` a partir de 1 hora); `formatDuration(sec)` → `m:ss`.
- `nowPlaying(state)`: o texto do mini-player a partir de `{moment, track?, wavesOn, noise, playing}`.

## Motor de som (`components/norte/sound-player.tsx`)

`'use client'`. Um contexto React (`SoundContext`, `useSound()`), com o `SoundProvider` montado em volta de todo o conteúdo do `NorteApp`, para o som continuar ao trocar de tela.

- **Música:** um único `HTMLAudioElement` (criado no cliente, `preload="none"`). No evento `ended`, toca `nextTrack`. No evento `error`, mostra um aviso e pula para a próxima. Se todas as faixas do momento falharem seguidas, para a música e mantém as ondas.
- **Ondas:** um `AudioContext` criado só no primeiro gesto, e então:
  - dois `OscillatorNode` senoidais (esquerdo e direito), cada um num `StereoPannerNode` (-1 e +1);
  - o ruído num `AudioBufferSourceNode` em repetição, com 4 segundos gerados por `noiseSamples`;
  - os dois passam por um `GainNode` "ondas" até a saída.

  Trocar o momento ajusta as frequências; trocar o ruído recria a fonte do ruído. O ruído fica cerca de 6 dB abaixo dos tons.
- **Volumes:** música em `audio.volume`, ondas no `GainNode`, ambos de 0 a 1 vindos do mixer e multiplicados por `fadeGain` durante a descida do timer.
- **Timer:** guarda `endsAt` (instante absoluto). Um intervalo de 250 ms aplica `fadeGain` e, em 0, para tudo e limpa o timer. Por usar o relógio, continua certo com a aba em segundo plano.
- **Media Session:** metadados da faixa e ações `play`, `pause` e `nexttrack`, quando houver `navigator.mediaSession`.
- **iPhone no modo silencioso:** quando existir `navigator.audioSession`, usa `type='playback'` antes de tocar.
- **Preferências:** chave `geoai-sound`, com `{musicVolume, wavesVolume, noise:{foco,relaxar,dormir}, focusAutoplay, moment}`. Leitura e gravação com try/catch; sem armazenamento, usa os padrões.
- **API exposta pelo contexto:** `state` (`moment`, `trackId`, `musicPlaying`, `wavesPlaying`, `noise`, volumes, `timerEndsAt`, `focusAutoplay`, `visible`, `wavesSupported`), `playTrack(moment, trackId?)`, `toggleWaves(moment)`, `togglePlay()`, `next()`, `stop()`, `setMoment`, `setNoise`, `setVolume('music'|'waves', v)`, `setTimer(minutes|null)`, `setFocusAutoplay(on)` e `focusSession('start'|'pause'|'end')`.

## Arquivos

- `scripts/upload-music.mjs`: lê `scripts/music-manifest.json` (o catálogo com `downloadUrl`), baixa cada faixa e sobe para `musicas/<file>` com `@vercel/blob` (`access:'public'`, `addRandomSuffix:false`, `allowOverwrite:true`, `contentType:'audio/mpeg'`, `cacheControlMaxAge` de 1 ano). O token vem da variável `MUSIC_BLOB_TOKEN` e nunca é gravado. O script imprime os endereços.
- O manifesto fica no repositório, para as faixas poderem ser reenviadas e para registrar a origem e a licença.

## Erros

| Situação | O que acontece |
|---|---|
| Faixa não carrega | Aviso "Não foi possível tocar esta faixa agora." e pula para a próxima; se todas falharem, a música para e as ondas continuam. |
| Navegador sem Web Audio | Os controles de ondas somem, com o aviso "Seu navegador não toca as ondas. As músicas funcionam normalmente." |
| `play()` recusado pelo navegador | Aviso "Toque em ▶ para começar." |
| iPhone no modo silencioso, sem `audioSession` | Nota fixa na aba: "No iPhone, desligue o modo silencioso para ouvir as ondas." |
| Tela bloqueada no celular | A música costuma continuar; as ondas podem pausar porque o sistema suspende o Web Audio. Nota na aba. |

## Testes

- Unitários, `tests/sounds.test.mjs`:
  - integridade do catálogo: ao menos 3 faixas por momento, `id` e `file` únicos, `file` terminando em `.mp3`, campos preenchidos, `https:`;
  - `binaural` dos três momentos;
  - `nextTrack`: avança, volta ao início, e `id` desconhecido vira a primeira faixa;
  - `noiseSamples`: tamanho certo, todos os valores entre -1 e 1, `none` só com zeros, e marrom e rosa com média próxima de zero numa amostra longa com sorteio determinístico;
  - `fadeGain` nas bordas e no meio;
  - `formatClock` e `formatDuration`;
  - `nowPlaying` nas combinações principais.
- `npm test`, `npm run typecheck`, `npm run build` e ESLint sem erros nos arquivos novos, sem aumentar os erros já existentes nos arquivos alterados.
- Manual, no app publicado:
  - tocar em cada aba e trocar de tela com o som continuando;
  - mixer;
  - timer com descida suave;
  - Pomodoro com a opção ligada;
  - atalho no Sono;
  - controles na tela de bloqueio;
  - iPhone no modo silencioso.

## Fora do escopo

Tocar com o app fechado (exige app instalado ou nativo), envio de músicas pelo usuário, Spotify ou YouTube, uso offline, preferências salvas na conta, sons de natureza sintetizados.
