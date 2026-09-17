# Escala DRY pós-C182: robustez do cache do poster do acervo

Status: rascunho
Atualizado em: 2026-09-16
Issue: a registrar — C185
Priority: P3
Impeccable: A — sem superfície nova (cache/rota interna; nada visual)
Appetite: ~3 h eng (fill-in); sem schema, sem URL pública, sem Consent
Depende de: #1104 (C182) — o cache e a rota do poster nasceram lá; destrava sozinha quando o C182 flipar `done`.

## Intenção

O C182 (`docs/plans/acervo-preview-frame-do-meio-da-fala-impl.md`) entregou o frame do meio da fala do acervo com um cache por nome determinístico (`speech-poster-<id>.jpg`) e uma rota interna que gera sob demanda. Dois achados dos revisores de `/simplify` ficaram fora do escopo da entrega por serem robustez/teste, não o defeito.

## Fases verificáveis

1. **F1 — poster obsoleto (achado D4).** O nome do arquivo não carrega o instante: se `durationSeconds`/`excerptTMs` da fala mudarem (o import faz `update` do bundle), o frame cacheado continua no meio antigo e nunca é invalidado. Opções: (A) incluir o offset no nome (`speech-poster-<id>-<offset>.jpg`) | (B) invalidar no `upsertSpeechBundle` quando os campos mudam. **Recomendação:** A — o hit continua sendo um lookup por filename determinístico e um re-import gera um nome novo sozinho; aceitar o objeto antigo órfão (mesmo balde do risco D5 do C182). Verificação: int de re-import com duração nova gera/prova o novo frame e o VM aponta para o href novo.
2. **F2 — teste do teto e do fallback (achado D6).** Provar que o estouro de `SPEECH_POSTER_WAIT_MS` responde o fallback (capa ou `404`) com `Cache-Control: no-store` enquanto a geração conclui em background e cacheia. Verificação: int da rota com geração segurável (stub de ffmpeg lento) + asserção do header.

## Já resolvido no simplify/critique (não reabrir)

- URLs cruas do VOD fora da query da lista; cache negativo cobrindo os `null` de indisponível/gerando; slot de concorrência antes de `resolveSpeechVod`; `rm` do temp antes de liberar o slot; `Location` relativa no 302; `speechPosterTarget`/`speechCoverUrl` como donos únicos; `runFfmpeg` recebendo a copy de fallback; poda do `failures`; testes de single-flight e cache negativo. Tudo no diff do C182.

## Explicitamente fora

- **D3 — frame derivado publicamente legível** (`Media.read = () => true`, nome adivinhável): decisão travada no C182 — o conteúdo é frame de sessão pública da Câmara, sem PII nem VOD cru; a alternativa gated adiciona código e não muda a natureza do vídeo-fonte. Só revisita se o conteúdo-fonte mudar de natureza.
- **D1 — primeira varredura parcial:** fala lenta mostra a capa nesta visita e o frame na seguinte (o cache se auto-aquece). Gatilho: produto exigir frame na 1ª visita (caminho: retry no cliente ou aquecimento no loader).
- **D2 — poluição da biblioteca `media`** com linhas derivadas `speech-poster-*`. Gatilho: a lista de mídia do admin ficar ruidosa (o marcador de origem exigiria migration).
- **D5 — órfão no bucket S3 / rename por colisão** (objeto sem linha; regeneração por custo). Gatilho: órfãos crescendo no bucket.
- **D7 — gate de concorrência in-process**: multiplicaria com múltiplas réplicas. Gatilho: scale-out acima de um container.
- Consolidar o literal `hqdefault` — escopo do **C179 (#1093)**, não deste lote.

## Self-score (decisão)

4/5 — decisão barata de reverter, escopo fechado (robustez do cache + prova do fallback), depth check: reusa o cache/rota do C182 sem nova collection/rota, e os defers têm gatilho nomeado.
