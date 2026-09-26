# C231 — Acervo de fotos do Flickr — ingestão completa

Status: rascunho
Atualizado em: 2026-09-26
Issue: #1366
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~1 dia eng (script + inventário; sem UI); um outcome verificável — as 6.577 fotos originais do Flickr e seus metadados passam a viver no storage do Teqo, reexecutável sem duplicar e com recibo honesto
Responsável: —

## Intenção

O acervo de milhares de fotos do Jorge Solla vive só no Flickr — conta própria `depjorgesolla`, 6.577 fotos, criada em 2022 — fora do Teqo: sem storage próprio, sem inventário, refém de uma plataforma de terceiro. Enquanto o acervo de falas já tem esteira e a Central de Conteúdos organiza o que publicar, as fotos não têm onde morar. Antes de catalogar (C232) e publicar (C233/C234), elas precisam estar em casa: originais + metadados (data, álbuns, título/descrição/tags, geotag, EXIF) no storage do Teqo, com inventário conferível e reexecução que não duplica.

## Persona e fluxo

- **Persona / contexto:** coordenação técnica rodando a ingestão (mesa, uma vez agora e de novo a cada lote novo do Flickr); a consumidora final é a comunicação, que hoje não enxerga o acervo.
- **Job principal:** trazer o acervo fotográfico inteiro para o storage do Teqo, sem perder nada, sem duplicar e com um recibo que se possa conferir.
- **Fluxo desejado:** roda em dry-run → confere o que entraria → roda com confirmação explícita → originais + metadados descem para o storage → lê o recibo "novas / já existiam / falharam com motivo" e o inventário → reexecuta quando quiser, convergindo.
- **Anti-goals de produto:** não é catálogo curado nem galeria; não publica nada; não edita/saneia foto; não cria cadastro de pessoa; não altera nada no Flickr.

## Objetivo e aceite

- O acervo do Flickr (`depjorgesolla`) fica recuperável e inventariável no storage do Teqo: originais + metadados por foto (data, álbum(ns), título/descrição/tags do Flickr, geotag quando houver, EXIF quando houver).
- Nada se perde: cada foto termina em um de dois estados honestos — arquivada ou falha nomeada no recibo; falha nunca em silêncio e nenhum arquivo órfão.
- Reexecutar é seguro: a identidade é o id da foto no Flickr; rodar de novo não duplica, converge e reporta "novas / já existiam / falharam com motivo".
- O inventário responde sozinho "quantas vieram, quantas já existiam, quais falharam e por quê" sem abrir o Flickr.
- Guardrails: dry-run por padrão; escrever no bucket exige confirmação explícita; a CLI nunca aponta para DB/bucket de produção fora do runbook; nenhuma foto é publicada neste item; nada no Flickr é tocado.

## Dados (intenção)

- **Vou apresentar dados?** Não — é operação/ingestão, não analytics: sem agregado, KPI ou superfície nova. O recibo da execução é conferência operacional (novas / já existiam / falharam), não métrica — não desbloqueia decisão de produto e não ganha painel.
- **Decisões desbloqueadas:** N/A — a decisão aqui é operacional ("o acervo está em casa? posso reexecutar?"), não numérica.
- **Forma:** N/A — sem engajamento/alcance; inventário é contagem de conferência.

## Dados da decisão (literais)

- Fonte: API oficial do Flickr da conta própria `depjorgesolla` (flickr.com/photos/depjorgesolla) — **6.577 fotos** confirmadas em 2026-09-26; baixar **originais**.
- Metadados a preservar por foto: data, álbum(ns), título/descrição/tags do Flickr, geotag quando houver, EXIF quando houver.
- Idempotência: identidade = **id da foto no Flickr**; reexecutar não duplica e converge.
- Storage: storage S3 do Teqo (bucket privado + proxy) — nunca disco efêmero de prod.
- Recibo por execução: "novas / já existiam / falharam com motivo" — falha nunca em silêncio; nenhum arquivo órfão.
- Guardas de escrita: dry-run por padrão + confirmação explícita para escrever no bucket (precedente `SEED_MEDIA_CONFIRM`/`MEDIA_RECOVER_CONFIRM`); CLI nunca aponta para DB/bucket de produção fora do runbook.

## Direção no codebase (hipótese)

- **Áreas prováveis:** script em `scripts/` no padrão dos imports idempotentes (dry-run, confirmação, relatório); storage em `src/utilities/mediaStorage.ts` + padrão das collections de upload privado (`ContentMedia`/`RecordingMedia`), fora do mapa S3 das collections públicas do `payload.config.ts`; download com teto como `downloadToFile.ts`.
- **Precedente a olhar:** `scripts/import-web-speeches.mjs` e `scripts/lib/cli.mjs` (dry-run, `assertWriteConfirm`, `ensureCachedDownload` com sha256), `scripts/recover-media.mjs` (`--dry-run/--verify/reconcile` + inventário verificável), `scripts/seed-posts.mjs` (`SEED_MEDIA_CONFIRM`, idempotência por chave), `src/utilities/speech/speechImport.ts` e `src/utilities/reels/reelPackageIngest.ts` (gravação transacional por chave natural).
- **Risco de acoplamento:** não criar segundo cadastro de pessoa; não pendurar o acervo na `media` pública (leitura anônima); não herdar o mapa S3 das collections públicas sem revisar visibilidade; egress de rede pelo proxy com allowlist já usado pelos scripts; `push: false` e migração commitada se houver schema novo.

## Dependências

- Nenhuma dura. C232 (catalogação) e C233/C234 (publicação) dependem deste.
- Credenciais da API do Flickr (Q1) e capacidade do bucket do homeserver (Q3) precisam estar resolvidas antes do lote.

## Fora de escopo

- Catalogação com IA/tags (C232); publicação (C233/C234); curadoria/edição/saneamento de imagem; álbum público e selfie; vídeos do Flickr e outras plataformas (têm donos próprios); qualquer alteração no Flickr; UI de administração do acervo.

## Rabbit holes de produto

- **"Já que baixa foto, baixa os vídeos do Flickr também".** Se alguém "só completar": formatos de vídeo, streaming, GBs a mais. **Corte neste item:** só fotos; vídeo tem dono próprio.
- **"Reorganiza/renomeia tudo no Flickr".** Se alguém "só completar": re-upload, perda de data/álbum, links quebrados. **Corte neste item:** baixar como está; nome/organização é decisão da catalogação (C232).
- **"Monta a UI de administração do acervo agora".** Se alguém "só completar": tela, filtros, curadoria — fora do appetite. **Corte neste item:** script + inventário; UI é C232/C233.
- **"Apaga do Flickr o que já baixou".** Se alguém "só completar": perda irreversível da fonte. **Corte neste item:** nunca; o Flickr é fonte e não se toca.

## Questões em aberto (produto)

- **Quem fornece as credenciais da API do Flickr e onde elas vivem?** **Opções:** A) chave de API da própria conta, provisionada pelo dono e só no env do runbook (nunca no repo) | B) OAuth do dono executado na hora | C) scraping da página pública. **Recomendação:** A — caminho oficial para conta própria, segredo fora do repo; C é proibido pelo padrão anti-scraping. _(assumido — validar com produto)_
- **Fotos que aparecem em múltiplos álbuns duplicam?** **Opções:** A) não — dedupe pelo id já resolve e os álbuns viram metadado da mesma foto | B) uma cópia por álbum. **Recomendação:** A — uma foto, N álbuns no metadado; registrar a contagem no inventário.
- **O bucket do homeserver comporta o lote?** **Opções:** A) medir antes (quantidade × tamanho médio dos originais) e só então rodar o lote completo | B) rodar em lotes por álbum. **Recomendação:** A com verificação prévia; se apertar, B é a contingência. _(assumido — verificar antes do lote)_
- **Existem fotos de terceiros em álbuns próprios?** **Opções:** A) inventariar com proveniência e não republicar sem revisão | B) excluir da ingestão. **Recomendação:** A — o risco é de publicação, não de arquivo: baixar para preservar e marcar para revisão futura.

## Referências

- GitHub Issue [#1366](https://github.com/fsolla/teqo/issues/1366)
- Design UI (gate): N/A — sem UI
- Plano irmão: C232 (catalogação do acervo — depende deste); C230 `docs/plans/central-conteudos-importar-perfil.md` (precedente de ingestão sob demanda — janela recente/dedupe por id; aqui é o oposto intencional: backfill em massa da fonte própria).
- Arquivos-pista: `src/utilities/mediaStorage.ts` · `src/payload.config.ts` (mapa S3) · `src/collections/ContentMedia.ts` e `src/collections/RecordingMedia.ts` (mídia privada) · `src/utilities/media/downloadToFile.ts` · `scripts/import-web-speeches.mjs` · `scripts/recover-media.mjs` · `scripts/seed-posts.mjs` · `scripts/lib/cli.mjs` · `src/utilities/speech/speechImport.ts` · `src/utilities/reels/reelPackageIngest.ts`
- `AGENTS.md` (storage S3, guards de escrita, `push: false`/migrações)

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — 6.577 fotos originais + metadados no storage do Teqo, reexecutável e com recibo.
2. Appetite declarado e a intenção cabe? **Sim** (~1 dia, script + inventário; UI/edição/vídeo cortados).
3. Persona + job + aceite claros sem jargão de stack? **Sim**.
4. Direção no codebase é hipótese? **Sim** — áreas/pistas, sem schema/signature.
5. Zero decisões duras de engenharia? **Sim** — collection, chave, formato de inventário e download ficam no plano de implementação.

**Score: 5/5.**
