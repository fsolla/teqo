---
description: Gera um Reel tutorial vertical (MP4 1080×1920 com legenda queimada, zoom e cursor) de uma funcionalidade do site — captura o site real em viewport de celular, compõe o pacote com transcrição sempre e áudio TTS opcional, e abre o gate de aprovar/ajustar
---

Carregue a skill `reels-tutoriais` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: leia/edite o shot list versionado, pergunte no gate com ou sem áudio (padrão sem), rode `pnpm reels:build <slug> [--audio]` (captura mobile do site real + composição ffmpeg + transcrição/`--audio`) e apresente no gate o pacote (`reel.mp4` + `capa.png` + `narracao.srt` + `roteiro.md` + `metadata.json`, e com áudio `narracao.mp3` + `reel-audio.mp4`) para aprovar ou ajustar em linguagem natural — ajuste edita o shot list e regenera; nada é publicado em rede social. A fonte canônica é `.agents/skills/reels-tutoriais/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/reels-tutoriais <funcionalidade>` — ex.: `/reels-tutoriais cards`.

$ARGUMENTS
