# Skill de reels: narração rascunho (TTS pt-BR) + transcrição sempre

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1156
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~1 dia eng; um outcome verificável — pacote com transcrição sempre e áudio rascunho opcional
Responsável: —

## Intenção

O ranking de valor dado pelo humano é explícito: o vídeo sozinho já ajuda; o texto da narração ajuda; o áudio, mais sucesso ainda. Este item completa o motor de reels do C196 com **voz e transcrição**: todo pacote sai com a transcrição do roteiro (`.srt` + `roteiro.md`) para a assessoria **regravar o áudio** ou acrescentar o áudio que quiser, e, quando o humano pedir, sai também um rascunho de narração em TTS pt-BR (`narracao.mp3`) e a variante do MP4 com esse áudio muxado. O vídeo continua sendo o formato primário; o áudio é rascunho, nunca voz clonada, e a decisão final do áudio é humana.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação do mandato, sem editor de vídeo; produz o reel pela skill e entrega/usa a mídia nos canais.
- **Job principal:** ter o roteiro falado em mãos (para regravar) e, quando quiser, um áudio de rascunho já pronto na duração certa.
- **Fluxo desejado:** roda a skill do C196 e chega ao gate de áudio → o gate pergunta **com ou sem áudio** (padrão: sem áudio) → sem áudio: o pacote sai com `reel.mp4` + `narracao.srt` + `roteiro.md`; com áudio: além disso, `narracao.mp3` + `reel-audio.mp4` (mesma trilha de vídeo, áudio muxado) → a assessoria publica o que quiser; se preferir a própria voz, regrava lendo o `roteiro.md`/`narracao.srt` e troca o áudio sem re-renderizar o vídeo.
- **Anti-goals de produto:** não clona voz; não embute música licenciada; não publica em rede social; não é editor de áudio; não substitui a decisão humana sobre a voz final.

## Objetivo e aceite

- Transcrição **sempre** no pacote: `narracao.srt` com timecodes por beat e `roteiro.md` legível (fala + marcação de beat/cena).
- Com áudio: `narracao.mp3` separado e `reel-audio.mp4` ao lado do `reel.mp4` sem áudio; a trilha de vídeo das duas variantes é idêntica.
- Voz 100% TTS pt-BR institucional/rascunho; nenhum áudio do Solla é usado como referência ou clonagem.
- O áudio rascunho cabe na duração do vídeo (a pessoa consegue trocar o áudio sem re-renderizar o vídeo).
- O manifesto do pacote lista todos os arquivos gerados; a biblioteca (C194) baixa mp3, `.srt` e transcrição no detalhe do reel.
- Nenhuma publicação automática em rede social; música licenciada não é embutida.

## Dados (intenção)

- **Vou apresentar dados?** Não — áudio e texto do roteiro, sem superfície de dados.
- **Decisões desbloqueadas:** a assessoria decide se aproveita o rascunho ou regrava com a voz que quiser; a coordenação decide o que vai ao ar.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: transcrição sempre, áudio opcional, sem clonagem, sem música.

## Dados da decisão (literais)

- Transcrição **sempre** no pacote: `narracao.srt` (timecodes por beat) + `roteiro.md` legível (o que a assessoria usa para regravar).
- Áudio quando houver: `narracao.mp3` + `reel-audio.mp4` (mesma trilha de vídeo com o áudio muxado), ao lado do `reel.mp4` sem áudio.
- Voz: TTS pt-BR **institucional/rascunho**; **jamais clonar a voz do Solla**; o áudio final é decisão humana (a assessoria regrava ou aproveita o rascunho).
- A skill pergunta no gate se o pacote sai **com ou sem áudio**; o padrão é **sem áudio + transcrição** (a maioria assiste no mudo; a legenda queimada é o formato primário).
- Música: não embutir trilha licenciada (a assessoria usa o áudio do próprio Instagram); sem publicação automática em rede social.
- O texto narrado é o roteiro aprovado no gate — a skill não parafraseia por conta própria.

## Direção no codebase (hipótese)

- **Áreas prováveis:** um módulo de narração dentro do mesmo diretório da skill C196 (o dono do motor de reels), atrás de um adapter fino de TTS (provider decidido na implementação); sem pipeline paralela.
- **Precedente a olhar:** padrão ffmpeg do repo — array de args (nunca string de shell), `execFile` com timeout, `FFMPEG_PATH` override (`src/lib/speechCut.ts:157-195`, `src/utilities/speech/speechMediaPipeline.ts:18,73-97`); fixtures `tests/fixtures/fake-ffmpeg.mjs` e `tests/int/speechCut.int.spec.ts` como molde de teste; mux com `-c:v copy` (sem re-encode) e `+faststart`.
- **Risco de acoplamento:** não existe TTS no repo hoje (o único áudio é STT, em `src/app/(campaign)/campanha/api/ai-transcribe/route.ts`); `edge-tts` é Python e a workstation tem Python 3.12 mas não `pip`/`pipx` — a instalação/fornecedor entra como decisão de implementação, fail-closed se o provider faltar.

## Dependências

- **C196 (duro):** motor de reels, estrutura do pacote/manifesto e o gate onde a pergunta "com ou sem áudio?" entra.
- **C194 (soft):** o detalhe do reel já prevê os downloads de mp3, `.srt` e transcrição; este item produz os arquivos.
- **ffmpeg real** no ambiente (pré-requisito herdado do C196).
- **Decisão de fornecedor/instalação do TTS** (ver questões em aberto).

## Fora de escopo

- Clonagem de voz (deepfake) ou uso de gravações do Solla no TTS.
- Embutir música/trilha licenciada.
- Publicação automática no Instagram ou em qualquer rede (inclusive marcar `is_ai_generated` — a declaração, se necessária, é humana).
- Edição de áudio (cortes, mixagem, loudness avançado) e interface de gravação.
- STT/legenda automática a partir de fala — o reel é roteirizado; transcrição vem do shot list.

## Rabbit holes de produto

- **Polir a naturalidade do TTS além do "rascunho publicável".** O áudio é draft; a assessoria regrava. **Corte neste item:** inteligibilidade na duração certa.
- **Normalização de loudness e drift de duração.** **Corte neste item:** se o par `reel.mp4`/`reel-audio.mp4` sai consistente, refino depois.
- **Quebra de linha/timestamps perfeitos no `.srt`.** **Corte neste item:** um bloco por beat, simples.
- **Múltiplas takes/variações de narração.** **Corte neste item:** uma por render.
- **Waveform/preview de áudio na biblioteca.** **Corte neste item:** player/download; preview é outro item.

## Questões em aberto (produto)

- **Provider TTS?** **Opções:** A) `edge-tts` (grátis, sem key, vozes neurais Microsoft) | B) Google Cloud TTS (1M chars/mês grátis, ~US$16/1M depois) | C) Azure (500k/mês grátis) | D) ElevenLabs (melhor pt-BR, caro). **Recomendação:** A como rascunho (custo zero e sem credencial), com B/C como upgrade se a qualidade incomodar. OpenAI está reservado ao design no Teqo. _(assumido — validar com produto)_
- **Como instalar o TTS na workstation sem `pip`/`pipx`?** **Opções:** A) venv Python dedicado | B) provider HTTP com key no env | C) binário empacotado. **Recomendação:** A para `edge-tts` (sem key, isolado no venv); B se o provider escolhido for cloud. _(assumido)_
- **O gate deve permitir edição humana da narração antes do TTS?** **Opções:** A) não — narra o roteiro aprovado | B) sim, editar o texto falado. **Recomendação:** A no primeiro ciclo; a edição é no shot list. _(assumido)_
- **Formato do mp3 e do mux?** **Opções:** A) mono ~96–128 kbps, AAC no mp4 com `+faststart`. **Recomendação:** A — suficiente para rascunho e leve para download.

## Referências

- C196 (motor de reels), C194 (biblioteca) e C195 (ingestão) — planos irmãos.
- `src/lib/speechCut.ts:157-195` e `src/utilities/speech/speechMediaPipeline.ts:18,73-97` — padrão ffmpeg.
- `tests/fixtures/fake-ffmpeg.mjs`, `tests/int/speechCut.int.spec.ts` — molde de teste.
- `src/app/(campaign)/campanha/api/ai-transcribe/route.ts` — precedente de áudio (STT).
- Pesquisa web 2026-09-18: TTS pt-BR (`edge-tts`, Google, Azure, ElevenLabs) e `is_ai_generated` do Instagram.
