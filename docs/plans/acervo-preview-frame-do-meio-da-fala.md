# Acervo: o preview de cada fala mostra um frame do meio daquela fala

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1104
Priority: P2
Impeccable: A — N/A sem nova superfície (muda a origem da imagem num slot já existente; sem mudança de layout/interação)
Design UI: N/A — sem UI nova (o artefato de design não representa o frame real — placeholder não é evidência)
Appetite: ~1–1,5 dia eng; um outcome verificável: cada resultado da busca/lista do acervo mostra uma imagem da PRÓPRIA fala (não a capa da sessão inteira), e falas da mesma sessão deixam de repetir a mesma imagem.
Responsável: —

## Intenção

Relato do usuário (verbatim): _"Os previews de cada fala na página de busca estão mostrando sempre o mesmo frame do Youtube. Quando na verdade eu queria um frame do meio da fala de Jorge Solla. O frame do youtube geralmente mostra uma pessoa aleatória, pois é o início da sessão inteira e não da fala de Jorge Solla."_

Hoje o preview de cada fala na busca do acervo (`/campanha/comunicacao/acervo`) é sempre a capa do vídeo do YouTube — o primeiro frame da sessão inteira. Como toda fala de uma sessão aponta para o mesmo vídeo, todos os resultados daquela sessão exibem a MESMA imagem, e essa imagem costuma mostrar outra pessoa, não Jorge Solla. A assessoria varre a lista e não reconhece nada: a miniatura não ajuda a distinguir uma fala da outra e ainda obriga a abrir fala por fala para descobrir qual é qual. O que se quer é uma âncora visual por fala: um frame do meio daquela fala.

## Reabertura de anti-goal (evidência de produto)

C175/#1085 (`docs/plans/acervo-preview-do-trecho-na-listagem.md` + `...-impl.md`) entregou a miniatura `hqdefault` do YouTube e declarou EXPLICITAMENTE como anti-goal extrair/renderizar um frame no servidor ou usar ffmpeg — "meio do trecho" foi dado como impossível. A evidência de produto acima mostra que o anti-goal produziu um preview inútil (repetido por sessão e mostrando o começo da sessão). Este item **reabre aquele anti-goal**, conforme `AGENTS.md` ("reopen only with new product evidence"). O que muda: agora há um pedido de produto explícito e já existe no repo um caminho de extração de vídeo (o pipeline ffmpeg do corte de trecho) que torna o frame do meio viável para falas com VOD da Câmara.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (jornalista/videomaker), com prazo curto, varrendo a busca do acervo no escritório ou em campo.
- **Job principal:** reconhecer cada fala pela imagem e decidir qual abrir, sem abrir fala por fala.
- **Fluxo desejado:** busca/filtra → cada resultado mostra uma imagem daquela fala → bate o olho e reconhece a cena → abre só a fala certa.
- **Anti-goals de produto:** LLM ou curadoria manual de frames; expor dado novo; mexer no leader/advisor (seguem fora do acervo); mirroring/backfill de todas as capas; o valor é por-fala, nunca por-sessão; player/hover-play na lista.

## Objetivo e aceite

- Cada fala com VOD da Câmara mostra um frame do meio da fala (não a capa da sessão).
- Falas da mesma sessão deixam de compartilhar a mesma imagem.
- Quando não há VOD, mantém-se a capa atual do YouTube (fallback honesto) ou um slot neutro — nunca imagem quebrada.
- **Guardrail (performance):** miniatura pequena, `lazy`, sem CLS, nunca bloqueia a listagem.
- **Guardrail (LGPD/escopo):** nada novo de Consent; nada exposto além do que a fala já expõe na lista.

## Dados (intenção)

- **Vou apresentar dados?** Não — não é métrica nem agregado; é uma escolha de origem de imagem (reconhecimento visual). Nenhum número nasce aqui.
- **Decisões desbloqueadas:** a assessoria escolhe qual fala abrir pelo reconhecimento da cena.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: nada de dashboard/contagem nova.

## Dados da decisão (literais)

- **O que existe hoje:** `youtubeThumbnailUrl(videoId)` → `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg` (`src/lib/speechVod.ts:168-169`), consumido em `src/utilities/speech/speechViewModels.ts:240` (`SpeechListItemViewModel.thumbnailUrl`) e renderizado por `SpeechResultThumbnail.tsx` (`h-20 w-32`) em `SpeechResultCard.tsx:175-181`.
- **A API do VOD não traz poster:** `parseVodStatus` (`src/lib/speechVod.ts:72-92`) mapeia só `titulo/subtitulo/duracao/horario/linkParaDownload/linkParaReproducao`.
- **Campos da fala disponíveis hoje** (`src/collections/Speech.ts`): `durationSeconds:155`, `eventStartAt:218`, `youtubeUrl:230`, `excerptTMs:252`, `vodPlaybackUrl:259`, `vodDownloadUrl:265`; `excerptTMs` é o offset de início da fala na sessão.
- **Instante que define "meio da fala":** `excerptTMs + durationSeconds/2` (início da fala + metade da duração). Este é o único literal que a intenção fixa; o resto (onde/como gerar, cache) é implementação.
- **Sem campo de poster:** `src/collections/Media.ts:37-39` só tem `alt`; nenhum cache de poster de fala existe.
- **Pipeline de vídeo já existente:** `src/utilities/speech/speechCutJob.ts:230-245` baixa o VOD para `source.mp4` e roda ffmpeg; `buildSpeechCutFfmpegArgs` (`src/lib/speechCut.ts:157-195`) só corta `[start,end]`, sem extrair still.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/speech/speechViewModels.ts` (campo da miniatura), `SpeechResultThumbnail.tsx`/`SpeechResultCard.tsx` (slot já existe), `src/utilities/speech/speechVodResolver.ts`/`speechCutJob.ts`/`src/lib/speechCut.ts` (ffmpeg), campos de `src/collections/Speech.ts`.
- **Precedente a olhar:** `docs/plans/acervo-preview-do-trecho-na-listagem-impl.md` (o VM já é dono do link da miniatura; raw `<img>`; e2e pina o literal).
- **Risco de acoplamento:** não transformar isto no chore DRY C179/#1093 (helper único da URL `hqdefault`); não alterar busca/excerto/highlight; leader lockdown intocado; os testes que hoje pinam `hqdefault` precisarão de revisão no plano de implementação.

## Dependências

- Nenhuma dura. Soft: C172 (mesma matemática de coordenadas da fala) e C178 (mesma vertical do acervo). C179 é só DRY do helper de thumbnail.

## Fora de escopo

- Player, autoplay ou hover-play na lista.
- Mirroring/backfill de todas as capas em S3/bucket.
- Extração de frame para falas sem VOD.
- Trocar `next/image` (o e2e browserless não alcança `i.ytimg.com`).
- Consolidar o helper `hqdefault` nas 3 ocorrências existentes (destino: C179/#1093).

## Rabbit holes de produto

- **"Extrair frame de todas as falas / backfill geral."** Se alguém "só completar": job de mirroring, storage, reconciliação e custo. **Corte neste item:** extração sob demanda, só onde há VOD.
- **"Escolher o frame à mão / curadoria manual."** Se alguém "só completar": fila editorial e UI de seleção. **Corte neste item:** o instante é `excerptTMs + durationSeconds/2`, sem curadoria.
- **"Preview em vídeo no hover."** Se alguém "só completar": embed, autoplay, banda e ruído na varredura. **Corte neste item:** imagem estática.
- **"Consertar os 3 hotlinks de `hqdefault` de uma vez."** Se alguém "só completar": blast radius em `corte/[id]` e no player e quebra do pino e2e. **Corte neste item:** fica no C179.

## Questões em aberto (produto)

- **De onde vem o frame do meio?** **Opções:** A) extrair do MP4 do VOD da Câmara no instante `excerptTMs + durationSeconds/2`, reusando o pipeline ffmpeg do corte, gerado sob demanda e cacheado | B) storyboard do YouTube na janela da fala (frágil/não documentado) | C) manter `hqdefault` como está. **Recomendação:** A quando há VOD — é o único caminho que entrega o meio da fala real; B rejeitada salvo prova de que funciona; C rejeitada — é exatamente o defeito. _(assumido — validar com produto)_
- **E quando não há VOD?** **Opções:** A) capa atual do YouTube como fallback honesto | B) slot neutro. **Recomendação:** A — mantém reconhecimento parcial sem mentir sobre a origem; usar B só se o fallback confundir (mesma imagem repetida por sessão).
- **O frame é cacheado ou recalculado a cada render?** **Opções:** A) gerar uma vez e reusar | B) recalcular sob demanda. **Recomendação:** A — miniatura pequena e estável, sem custo por varredura. _(a forma concreta fica na implementação)_
- **Comportamento quando o frame extraído vier ruim/escuro?** **Opções:** A) aceitar e mostrar | B) cair para a capa do YouTube. **Recomendação:** A — não inventar heurística de qualidade neste item; reavaliar com uso real.

## Referências

- `docs/plans/acervo-preview-do-trecho-na-listagem.md` (C175 — anti-goal reaberto) e `docs/plans/acervo-preview-do-trecho-na-listagem-impl.md`
- `docs/plans/c167-cortar-trecho-publicar.md` (precedente do pipeline de corte)
- `src/utilities/speech/speechCutJob.ts` · `src/lib/speechCut.ts` · `src/lib/speechVod.ts` · `src/utilities/speech/speechViewModels.ts`
- `AGENTS.md` / `AGENTS-campaign.md` — convenções do acervo e da campanha

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (cada fala com uma imagem da própria fala, sem repetição por sessão); (2) appetite ~1–1,5 dia, aditivo ao slot existente; (3) persona + job + aceite claros, com fallback honesto declarado; (4) direção no codebase é hipótese, sem schema/signature; (5) zero decisão dura de engenharia — só o literal do instante "meio da fala" e a reabertura de anti-goal explicitada.
