# Acervo: cortar sem teto — do mínimo de 5 s até o fim da fala

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1046
Priority: P2
Impeccable: B — encaixe no player/detalhe do acervo
Rascunho UI: docs/plans/c170-corte-sem-limite-ui-draft.html
Appetite: ~0,5–1 dia eng; um outcome verificável — qualquer trecho de 5 s até o fim da fala corta, publica e baixa exatamente o intervalo escolhido
Responsável: —

## Intenção

O corte do acervo trava em 3 min (180 s). A assessoria precisa cortar trechos longos — um discurso inteiro, uma fala de vários minutos — e esbarra num teto que não é do material, é da ferramenta: acima de 3 min a barra de seleção não anda e o servidor recusa o corte, então o trecho longo sai por fora (baixar a sessão, editar em outra ferramenta). Esta fatia remove o teto de produto: o limite passa a ser a própria fala — do mínimo de 5 s até o fim — e o corte publicado/baixado corresponde exatamente ao trecho escolhido. Sem superfície nova, sem editor: é a mesma seleção do C166 e o mesmo corte do C167, sem teto.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (communicator; coordenação e candidatura também), na mesa ou em campo, montando peça com o discurso inteiro ou uma fala de vários minutos.
- **Job principal:** selecionar e cortar o trecho exato que a peça precisa, inclusive um trecho longo, sem teto artificial de duração.
- **Fluxo desejado:** abre a fala → "Selecionar trecho" → marca o início nas frases (ímã) e leva o fim até onde precisar — até o fim da fala; a barra não trava mais em 3 min e a duração aparece enquanto seleciona → "Compartilhar" (C166) ou "Cortar vídeo" (C167) → o corte publicado/baixado começa e termina nos marcos escolhidos, mesmo com 12 min ou a fala inteira.
- **Anti-goals de produto:** não é editor de vídeo nem timeline com zoom; não muda o mínimo de 5 s; não mexe no mecanismo de corte nem no resolver (item irmão de pipeline, C169) nem na publicação/kill switch (C167/C168); não cria presets de duração nem seleção multi-trecho; não muda o gate do acervo nem o crédito CC BY.

### Esboço de fluxo (B/C/D)

```text
[detalhe da fala] → "Selecionar trecho" → [início nas frases] + [fim até onde precisar: ≥5s, até o fim da fala]
→ duração visível (ex.: 12min) → [Compartilhar (C166) | Cortar vídeo (C167)]
→ corte publicado/baixado = [início,fim] exatos (sem teto de 3 min)
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/c170-corte-sem-limite-ui-draft.html` — cenas: detalhe com seleção longa (12 min) e o rótulo novo do limite; diálogo "Cortar vídeo" com a copy nova; variantes (até o fim da fala; fala inteira); mobile com seleção longa e diálogo.

## Objetivo e aceite

- Selecionar [início,fim] de 5 s até a duração total da fala: o fim alcança o último segundo da fala e o início, o primeiro; a barra não trava mais em 180 s.
- O corte publicado/baixado corresponde exatamente ao trecho escolhido — começa e termina nos marcos escolhidos, inclusive trechos longos (12 min, fala inteira).
- Robustez: um corte longo acima dos ~3 min atuais conclui — o arquivo toca e baixa; se o pipeline falhar por limite operacional (download do VOD, tempo do ffmpeg), falha honesta como hoje e nada é publicado (causa no item de pipeline, não vira teto de produto).
- A copy diz a verdade: limite visível = "Mínimo 5s · sem limite — até o fim da fala"; a duração aparece durante a seleção.
- Mínimo de 5 s mantido (decisão de produto: evita corte de 1 s sem uso). _(assumido — validar no gate)_
- Guardrails: `excerptTMs`/seleção exata [início,fim] intocados; crédito "Fonte: Câmara dos Deputados · CC BY 4.0"; gate do acervo intocado (communicator/coordinator/candidate; advisor/leader negados fail-closed); kill switch/publicação do C167/C168 intocados; sem editor de vídeo; sem trocar início/fim depois de cortado.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é a barra de seleção e o diálogo de corte; duração/`mm:ss` é feedback de ação, não dado do acervo.
- **Decisões desbloqueadas:** a assessoria decide cortar um trecho longo (discurso inteiro, fala de vários minutos) sem sair da ferramenta; a coordenação decide o que fica no ar (C168).
- **Forma:** _adiada ao plano de implementação_ — restrição: sem KPI/telemetria de corte nesta fatia.

## Dados da decisão (literais)

- Teto atual **removido**: `MAX_EXCERPT_SECONDS = 180` (`src/lib/speechExcerptSelection.ts:21`), aplicado em `normalizeExcerptRange` (:54) e `moveRangeEdge` (:125,134).
- Mínimo **mantido**: `MIN_EXCERPT_SECONDS = 5` (`src/lib/speechExcerptSelection.ts:44-53`).
- Limite efetivo: `durationSeconds` da fala — [início,fim] pode ir de 5 s até a duração total (fala inteira permitida).
- Copy nova (exata):
  - Barra de seleção (`SpeechExcerptControls.tsx:31`): `Mínimo 5s · máximo 3min` → `Mínimo 5s · sem limite — até o fim da fala`; `aria-valuemin/max` (:114,119) passam a refletir 0–duração.
  - Diálogo de corte (`SpeechCutDialog.tsx:242-244`): `dentro da faixa de 5–180 s` → `mínimo 5 s · até o fim da fala` (linha vira `<duração> · mínimo 5 s · até o fim da fala`).
  - Mensagem de erro (`src/lib/schemas/speechCut.ts:17`): `Selecione um trecho de 5 a 180 segundos.` → `Selecione um trecho de 5 segundos até o fim da fala.`
  - Prompt da IA (`src/utilities/speech/speechCutMetadata.ts:42`): `Receberá tipo, data, resumo oficial e a transcrição automática (ASR) de um trecho de 5 a 180 segundos.` → `Receberá tipo, data, resumo oficial e a transcrição automática (ASR) de um trecho da fala com 5 segundos ou mais.`
- Servidor: `src/app/(campaign)/campanha/actions/speech.ts:133` (`resolveExcerptRange`, também usado na sugestão de IA em :338) — o guard de máximo passa a ser só a duração da fala; `src/lib/schemas/speechCut.ts:16-17` — zod já limita 0–86.400 (`excerptBoundarySeconds`), o teto real é a action.
- Testes que pinam 180 a atualizar: `tests/unit/speechExcerptSelection.unit.spec.ts:41-42,113,130`; `tests/unit/speechDetailPlayer.unit.spec.tsx:290,306,321,444`; `tests/int/speechCut.int.spec.ts:300` (regex `/5 a 180/`).
- Limites operacionais que um corte longo encosta (aceite de robustez, sem engenharia aqui): `SOURCE_DOWNLOAD_TIMEOUT_MS=180_000`, `MAX_SOURCE_BYTES=2GiB`, `FFMPEG_MAX_TIMEOUT_MS=300_000`, reaper `SPEECH_CUT_STALE_MS=15min` (`src/utilities/speech/speechCutJob.ts:37-44`); qualquer corte >~37,5 s já roda no teto de 5 min do ffmpeg.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/speechExcerptSelection.ts` (geometria/limites), `src/components/campaign/speech/` (`SpeechExcerptControls`, `SpeechCutDialog`), `src/app/(campaign)/campanha/actions/speech.ts` + `src/lib/schemas/speechCut.ts` (validação/servidor), `src/utilities/speech/speechCutMetadata.ts` (prompt da IA).
- **Precedente a olhar:** C166 (`c166-compartilhar-trecho-link.md`) e C167 (`c167-cortar-trecho-publicar.md`) — a barra e a validação nasceram com o teto; os testes acima são o mapa da mudança.
- **Risco de acoplamento:** o teto está espalhado (geometria, aria, action, schema, prompt, testes) — remover só a UI deixaria o servidor recusando o corte longo; `campaignSpeechAcervo` (e2e) e as units de `speechDetailPlayer`/`speechExcerptSelection` cobrem o caminho.

## Dependências

- Nenhuma dura. Observação: C169 (defeito do resolver) toca o pipeline de corte — validar um corte longo real depende do pipeline funcionar; risco registrado, sem bloquear.

## Fora de escopo

- Mudar o mínimo de 5 s; editor/timeline/zoom/precisão de frame; segundo player/preview do corte.
- Mecanismo de corte e resolver VOD (C169); publicação, kill switch e biblioteca (C167/C168).
- Corte em partes/streaming/fila assíncrona; presets de duração; seleção multi-trecho; legenda no corte.
- Ampliar papéis com acesso ao acervo; `Consent`/collection novas.

## Rabbit holes de produto

- **"Sem teto = cortar 2 h de sessão de uma vez."** Se alguém "só completar": ffmpeg em partes, fila, storage fragmentado. **Corte neste item:** o teto é a duração da fala; robustez mínima para um corte longo real concluir; infra de mídia não muda.
- **"Já que destravou, tira o mínimo também."** Se alguém "só completar": cortes de 1 s, dezenas por fala, biblioteca poluída. **Corte neste item:** mínimo de 5 s permanece.
- **"Aproveitar e refazer a barra com zoom."** Se alguém "só completar": timeline, precisão de frame, preview. **Corte neste item:** barra atual + ímã de frase, segundos inteiros.
- **"Preview do corte longo antes de publicar."** Se alguém "só completar": render extra, segundo player. **Corte neste item:** o progresso honesto do C167 já basta.
- **"Aumentar timeouts para garantir o corte longo."** Se alguém "só completar": mexer no pipeline às cegas. **Corte neste item:** se o pipeline não aguentar, é defeito do pipeline (C169) — não teto de produto.

## Questões em aberto (produto)

- **O mínimo continua 5 s?** **Opções:** A) manter | B) reduzir junto com o teto. **Recomendação:** A — 5 s evita corte de 1 s sem uso e não é o que a assessoria pediu. _(assumido — validar no gate)_
- **Texto do limite?** **Opções:** A) `Mínimo 5s · sem limite — até o fim da fala` | B) só `até o fim da fala`. **Recomendação:** A — "sem limite" mata a memória do teto de 3 min e "até o fim da fala" diz qual é o teto real. _(assumido)_
- **Selecionar a fala inteira é permitido?** **Opções:** A) sim, [00:00, duração] | B) exigir deixar algo de fora. **Recomendação:** A — o teto é a duração; a peça decide o recorte.
- **Corte longo que falha por limite operacional?** **Opções:** A) tratar como defeito do pipeline (C169), com aceite de robustez aqui | B) reintroduzir teto técnico. **Recomendação:** A — teto de produto não se justifica por timeout; a falha honesta já existe (C167).

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c170-corte-sem-limite-ui-draft.html`
- Planos irmãos: [`c166-compartilhar-trecho-link.md`](c166-compartilhar-trecho-link.md), [`c167-cortar-trecho-publicar.md`](c167-cortar-trecho-publicar.md)
- Arquivos-chave (pista, não contrato): `src/lib/speechExcerptSelection.ts`, `src/components/campaign/speech/SpeechExcerptControls.tsx`, `src/components/campaign/speech/SpeechCutDialog.tsx`, `src/app/(campaign)/campanha/actions/speech.ts`, `src/lib/schemas/speechCut.ts`, `src/utilities/speech/speechCutMetadata.ts`, `src/utilities/speech/speechCutJob.ts`
- `AGENTS.md` — vertical Comunicação, gate do acervo e crédito CC BY.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (selecionar de 5 s até o fim da fala e cortar exato) sem nova superfície; (2) appetite de ~0,5–1 dia para remover o teto nas pontas + robustez do corte longo, com os limites operacionais declarados; (3) persona, job e aceite em linguagem de produto, com a copy literal separada; (4) direção no codebase é hipótese (áreas, testes que pinam 180 e o risco C169); (5) zero decisão dura de engenharia — mecanismo, schema e infra ficam na implementação.
