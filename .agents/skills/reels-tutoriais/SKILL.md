---
name: reels-tutoriais
description: 'Gera um Reel tutorial vertical (MP4 1080×1920, legenda queimada, zoom/cursor) de uma funcionalidade do site de campanha, dirigindo o site real em viewport de celular e compondo com ffmpeg; mostra o pacote no gate e regenera a partir de ajustes em linguagem natural (o shot list é a fonte única).'
---

# Reels tutoriais do site (C196/C197)

Entrega, numa invocação, um **pacote publicável de Reel vertical** ensinando uma
funcionalidade do site (`jorgesolla1313.com.br`) — o primeiro é o tutorial dos
cards de apoio (`#cards`). O operador de comunicação dirige o site real numa
emulação de celular, a skill captura o fluxo, compõe o MP4 com legenda
queimada, zoom suave nos cliques, cursor sintético e marca da campanha, e
mostra o resultado no gate: **aprovar** (o pacote segue para a biblioteca
privada, C195) ou **ajustar** em linguagem natural — o ajuste edita o **shot
list** e regenera; o arquivo renderizado nunca é editado.

O pacote sai **sempre com a transcrição do roteiro** (`narracao.srt` +
`roteiro.md`) para a assessoria regravar; o gate pergunta ainda **com ou sem
áudio** (padrão: **sem áudio**). Com áudio, saem também um rascunho de narração
em **TTS pt-BR** (`narracao.mp3`) e a variante `reel-audio.mp4` (mesma trilha de
vídeo, áudio muxado). A voz do rascunho **nunca clona a do Solla** — a decisão
da voz final é humana.

**Nada é publicado em rede social por esta skill.** O Instagram/canais são da
assessoria; aqui o produto é o arquivo no disco.

## Quando usar

- A comunicação pede "o reel de <funcionalidade>" — ex.: `/reels-tutoriais cards`.
- Quem executa é o **agente principal** (orquestrador do gate) + o builder
  determinístico (`pnpm reels:build`). Não há sub-agente de pesquisa: o roteiro
  vive no shot list versionado e a captura é do site real.

## Pré-requisitos

- **ffmpeg real** com `libx264` e os filtros do compositor. A skill resolve
  sozinha, nesta ordem: `FFMPEG_PATH` → `ffmpeg` do PATH →
  `@ffmpeg-installer/ffmpeg` (o binário empacotado do registry, padrão da
  workstation). Se nenhum servir, o build **falha fechado** com a mensagem
  acionável — não há fallback silencioso. Com `--audio`, o probe exige também o
  encoder `libmp3lame` e o filtro `atempo`.
- **Site no ar** e alcançável: a captura navega o site de produção por padrão.
  Para outro ambiente: `--base-url=` ou `REELS_BASE_URL` (ex.: staging/local).
- Chromium do `@playwright/test` (já instalado com as dependências do repo).
- **Só com `--audio`:** o provider TTS `edge-tts` em venv dedicado — prepare com
  `pnpm reels:tts:setup` (idempotente). A skill resolve, nesta ordem:
  `EDGE_TTS_PATH` → venv `scripts/reels/.venv` → `edge-tts` do PATH; sem
  provider, o build **falha fechado antes da captura**, com a mensagem de setup.
- O build é local (workstation): **não toca banco, não escreve no site** — o
  visitante é anônimo e o download do card é client-side.

## Pipeline (o que o build faz)

```text
pnpm reels:build <slug> [--audio]
  shot list (scripts/reels/shot-lists/<slug>.json)   ← fonte única da verdade
    └─ captura: Chromium mobile (360×640 @3x = 1080×1920 nativo)
         ├─ cursor sintético + halo amarelo no alvo do clique
         └─ screencast com timestamps de parede (sem drift) → frames JPEG
              └─ assets: legendas/etiqueta em PNG transparente + capa.png
                   └─ clipes por cena: zoompan (do log de cliques) + overlay
                        └─ concat H.264/yuv420p 30fps
                             ├─ transcrição SEMPRE: narracao.srt + roteiro.md
                             └─ com --audio: edge-tts por beat → PCM medido
                                (atempo ≤1.5 + silêncio na janela da cena)
                                → narracao.mp3 + reel-audio.mp4 (-c:v copy)
                                     └─ pacote + metadata.json
```

Comandos:

```bash
pnpm reels:build cards                 # pacote em data/reels/cards/ (transcrição sempre)
pnpm reels:build cards --audio         # + rascunho narrado (TTS pt-BR)
pnpm reels:build cards --dry-run       # valida o shot list e imprime cenas + fala
pnpm reels:build cards --capture-only  # só a captura (debug do roteiro)
pnpm reels:build cards --base-url=http://127.0.0.1:3100
pnpm reels:tts:setup                   # venv do edge-tts (só para --audio)
```

## Contrato do shot list

`scripts/reels/shot-lists/<slug>.json` é **versionado** e é a fonte única da
verdade. A primeira cena é o `hook`, a última é o `cta` (gráficas) e no meio
ficam as cenas de captura com `badge` (etiqueta de passo), `caption` (legenda
queimada), `setup` (preparo invisível, ex. `scrollIntoView`) e `steps`
(`click`, `fill`, `waitFor`, `download`). O `fixture.cardName` é fictício
(zero PII de terceiros). Qualquer ajuste de roteiro, texto, ordem, ritmo ou
alvo de clique é feito **aqui** — nunca no MP4.

A fala de cada cena vive **no shot list**, no campo `narration` (opcional, até
600 caracteres): as cenas de captura caem no texto da própria `caption` quando
ele falta (os espaços autorais são preservados), e cenas gráficas sem
`narration` ficam em silêncio. O `coverAlt` (opcional; fallback: o `title`) é o
texto alternativo da capa no manifesto. A skill **não parafraseia**: o texto
narrado é o roteiro aprovado aqui.

O hash do shot list vai no `metadata.json` e identifica a versão do reel:
re-render com o mesmo hash é a mesma versão; hash novo é reel novo (a ingestão
do C195 usa essa chave).

## Pacote e gate

O build escreve em `data/reels/<slug>/` (gitignored):

- `reel.mp4` — 1080×1920, 30fps, H.264, **sem áudio** (o primário);
- `capa.png` — composição própria (não frame do vídeo), título dentro do
  recorte central 1080×1350 (sobrevive ao feed 4:5 e à grade do perfil);
- `narracao.srt` — transcrição com um bloco por beat (timecodes das cenas);
- `roteiro.md` — fala legível por cena/beat, para a assessoria regravar;
- `metadata.json` — título, funcionalidade, duração, hash do shot list, data,
  `coverAlt`, voz (quando houver áudio) e a lista de artefatos do pacote;
- com `--audio`: `narracao.mp3` (rascunho TTS) + `reel-audio.mp4` (trilha de
  vídeo idêntica ao `reel.mp4`, áudio AAC muxado).

Intermediários ficam em `data/reels/.work/<slug>/` (frames, log de cliques,
capturas gráficas, áudio por cena) e podem ser apagados a qualquer momento.

**Gate (apresente no chat):** pergunte primeiro **com ou sem áudio** (padrão:
sem) e então mostre os artefatos e o resumo (duração, cenas, hash). Depois:

- **Aprovar** → o pacote está pronto para a biblioteca privada (C195). Enquanto
  o C195 não estiver disponível, o pacote fica no disco e o caminho é o
  contrato de entrega; **nada sobe para o Instagram**.
- **Ajustar** → traduza o pedido ("hook mais curto", "a legenda some antes",
  "clicar em outro botão") para o **shot list** (`scripts/reels/shot-lists/`),
  mostre o que mudou e rode `pnpm reels:build <slug>` de novo. Sempre. Mudar de
  ideia sobre o áudio é só re-rodar com (ou sem) `--audio`.

## Limites e troubleshooting

- **Seletor do site mudou** → o build falha fechado dizendo o alvo que não
  apareceu; corrija o shot list (ou o site) e regenere.
- **Site fora do ar** → erro de HTTP com a URL; nada é gravado.
- **Fonte de marca** → o build embute as fontes do próprio site (Inter/Brexter)
  e usa a Brexter oficial nas cenas gráficas; se o site não servir a fonte, o
  build avisa e usa a fallback do sistema (nunca em silêncio).
- **ffmpeg ausente/sem libx264** → mensagem com o que instalar/configurar;
  não tente compor sem o probe.
- **edge-tts ausente/offline** → `--audio` falha **antes da captura** com a
  mensagem de `pnpm reels:tts:setup` (ou `EDGE_TTS_PATH`); sem provider/rede não
  existe pacote "quase pronto" — regenere depois.
- **Fala não cabe na cena** → o build falha dizendo a cena e a duração; encurte
  a fala no shot list (ou divida a cena) — o `atempo` só acelera até 1.5× e a
  transcrição sai mesmo assim.
- **Ajuste nunca é no render** — se alguém pedir para "cortar direto no vídeo",
  a resposta é editar o shot list e regenerar.

## Design

A superfície gráfica (hook, legenda, etiqueta de passo, cursor/halo, capa,
safe zone) vem do artefato aprovado `docs/plans/reels-tutoriais-ui-design.html`
+ assets; o port é classe-a-classe em `scripts/lib/reelTemplates.mjs`. O
`designer` é dono da estrutura visual — não improvise layout.

## Marca oficial (kit 1313)

Os ativos oficiais da campanha vivem em `public/campaign-kit/` (mapa de uso no
`README.md` de lá; manual completo em
`docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`). Regras:

- **Positiva** (`marca-positiva-completa`, `jorge-solla-positivo`) em fundo
  claro; **negativa** (`marca-negativa-completa`, `jorge-solla-negativo`) em
  fundo vermelho/escuro. Nunca recriar lockup tipográfico quando o ativo
  oficial existe.
- Paleta oficial nas cenas gráficas: `#e4102f`, `#184e92`, `#ffeb00` (verde
  `#009647` só dentro dos ativos). As **cenas de captura preservam a paleta do
  site** (`#a21c1c/#ffe607/creme`) — o vídeo mostra o site real.
- Slogan **"Mais Saúde, Mais Futuro"** só dentro das marcas completas — não é
  headline nem quarta mensagem.
- A **estrela** oficial (`estrela.png`) é usada a 100% sobre disco branco do
  mesmo diâmetro; opacidade reduzida mistura as cores com o fundo e suja o
  ativo.

## Fora de escopo

- Clonagem de voz (referência/áudio do Solla), trilha/música licenciada e
  publicação no Instagram — o rascunho TTS é opcional e a voz final é decisão
  humana; STT/legenda a partir de fala; edição de áudio (loudness/mixagem);
  outras funcionalidades além da do shot list corrente; editar o MP4
  renderizado; idiomas além de pt-BR.
