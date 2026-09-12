# Piloto da fonte: vídeos e transcrição minutada de um discurso da Câmara

Status: rascunho
Atualizado em: 2026-09-12
Issue: #954
Priority: P1
Impeccable: A — N/A (spike de fonte de dados, sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~1 dia; um outcome verificável — 2–3 discursos de legislaturas diferentes processados ponta a ponta com relatório de viabilidade
Responsável: —

## Intenção

O catálogo de falas do Solla depende de uma fonte externa (a Câmara dos Deputados) que nunca foi usada neste repo. Antes de construir banco, import e tela, é preciso provar que o caminho existe de ponta a ponta e travar as quatro incógnitas que decidem o desenho do acervo: os links de vídeo por discurso são permanentes? Sessões antigas (2011–2015) têm trechos por orador? A transcrição via Deep Infra devolve segmentos com minutagem? O casamento discurso ↔ evento ↔ trecho funciona em anos antigos? Este item responde isso com 2–3 discursos reais e um relatório curto — sem construir o acervo.

## Persona e fluxo

- **Persona / contexto:** agente de engenharia no terminal, sem UI; o resultado interessa a quem vai construir o acervo (C153).
- **Job principal:** processar 2–3 discursos de legislaturas diferentes e responder as quatro incógnitas com evidência (URL, arquivo, JSON).
- **Fluxo desejado:** escolher discursos (um recente, um da 55ª/56ª) → achar o evento e o trecho do orador → baixar o MP4 do VOD → extrair áudio → transcrever com segmentos → imprimir relatório (tempos, custos, links, falhas).
- **Anti-goals de produto:** não é o acervo; não cria collection, UI nem importa em produção; não baixa o acervo inteiro.

## Objetivo e aceite

- 2–3 discursos processados ponta a ponta, com o MP4 do VOD baixado e a transcrição com segmentos exibida (início/fim/texto).
- Relatório responde: (1) permanência dos links `vod.camara.leg.br`; (2) cobertura de trechos na 55ª/56ª; (3) timestamps no Deep Infra (qual endpoint/param funciona); (4) casamento discurso ↔ evento ↔ trecho em anos antigos.
- Custos e tempos medidos (download, extração de áudio, transcrição) e fallback recomendado para cada incógnita que falhar.
- **Guardrail:** nada escrito em banco de produção; artefatos do piloto ficam fora do repo (ou em `data/`, gitignored).

## Dados (intenção)

- **Vou apresentar dados?** N/A — relatório técnico de engenharia, sem superfície de produto; quem consome é o C153.

## Dados da decisão (literais)

- Lista de discursos: `GET https://dadosabertos.camara.leg.br/api/v2/deputados/178857/discursos?dataInicio=…&dataFim=…&itens=100&ordenarPor=dataHoraInicio&ordem=ASC` (header `X-Total-Count`; campos `transcricao`, `sumario`, `keywords`; `urlVideo`/`urlAudio` vêm nulos).
- Eventos: `GET https://dadosabertos.camara.leg.br/api/v2/eventos?dataInicio=…&dataFim=…` e `GET …/eventos/{id}` (campo `urlRegistro` = YouTube do evento).
- Página do evento (trechos por orador): `https://www.camara.leg.br/evento-legislativo/{id}` — cada trecho tem orador, partido, horário, duração, `a` (= idAudio) e `t` (= epoch ms do início).
- Vídeo do trecho: `GET https://www.camara.leg.br/evento-legislativo/{id}/video-sob-demanda?idAudio={a}&trecho={t}` → JSON `{ estado, video: { titulo, subtitulo, duracao, horario, linkParaDownload, linkParaReproducao } }`.
- Fallback YouTube: `startTimestamp` do VOD; offset = `t / 1000 − startTimestamp`.
- Transcrição: Deep Infra `openai/whisper-large-v3`, `language=pt`, US$ 0,00045/min; testar o endpoint compatível (`verbose_json` + segmentos) e, se não houver timestamp, o nativo (`chunk_level: segment|word`).
- Licença da fonte: transmissões de atividades legislativas são CC BY 4.0 — crédito obrigatório, marca d'água intocada.

## Direção no codebase (hipótese)

- **Áreas prováveis:** script `.mjs` em `scripts/` no padrão de `scripts/lib/cli.mjs` (`loadCliEnv`, `dieWithLabel`) e `scripts/recover-media.mjs` (download + cache + relatório); sem collection, sem Payload.
- **Precedente a olhar:** `scripts/recover-media.mjs` (download com cache/`sha256`), `src/utilities/ai/deepInfraTranscribe.ts` (chamada Deep Infra existente).
- **Risco de acoplamento:** nenhum com o app; só não deixar artefatos de mídia no git.

## Dependências

- Nenhuma — é a raiz do encadeamento (C153 depende deste).

## Fora de escopo

- Construir o acervo/import (C153), UI (C154), backfill (C155).
- Classificação por facetas e enriquecimento de metadados.
- ASR local em GPU própria; worker/scheduler; espelhamento em S3.

## Rabbit holes de produto

- **"Já baixar o acervo inteiro."** Se alguém "só completar": ~25 GB e horas de máquina antes de validar a fonte. **Corte neste item:** 2–3 discursos.
- **"Montar o pipeline definitivo de import."** Se alguém "só completar": desenho de collection/transação cedo demais. **Corte neste item:** prova descartável + relatório.
- **"Transcrever na GPU local."** Se alguém "só completar": setup CUDA/Blackwell vira o projeto. **Corte neste item:** Deep Infra; GPU é assunto separado.

## Questões em aberto (produto)

- **Deep Infra compat ou nativo?** **Opções:** A) endpoint compatível (`/v1/openai/audio/transcriptions` com `verbose_json`) | B) endpoint nativo (`/v1/inference/…` com `chunk_level`). **Recomendação:** A se devolver segmentos (menos código, reusa o padrão do B173); B como fallback. _(assumido — validar no piloto)_
- **Sessão antiga sem trecho por orador?** **Opções:** A) cair para o YouTube do evento (offset pelo `startTimestamp`) | B) reportar e seguir. **Recomendação:** A quando houver VOD; B documentado no relatório. _(assumido — validar no piloto)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI: N/A
- `src/utilities/ai/deepInfraTranscribe.ts` · `scripts/recover-media.mjs` · `scripts/lib/cli.mjs`
- Pesquisa do planejamento (2026-09-12): acervo 54ª–57ª = 1/362/414/234 discursos; trechos por orador confirmados na página do evento; MP4 direto do VOD com Range/206.
