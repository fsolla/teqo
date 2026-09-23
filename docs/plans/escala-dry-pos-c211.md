# Escala e DRY pós-C211 (Central de Conteúdos)

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1267 (`depends: [1254]`)
Item do roadmap: — (follow-up de engenharia da entrega C211)
Responsável: —
Appetite: ~0,5–1 dia eng (fill-in; três fases pequenas, sem migration)
Impeccable: A — só backend/refactor

## Contexto

A entrega C211 ([central-conteudos-ingestao.md](central-conteudos-ingestao.md), Issue #1254) criou o pipeline de peças reusando deliberadamente os mecanismos do C199 (job `after()` + reaper + retry condicional, mídia privada, transcrição, classificador de facetas). A passagem `/simplify` (2 revisores, 0 achados altos) aplicou ~18 correções na própria sessão — `revalidateTag` do listing na collection, passo morto no job, narrowing de relação, texto arquivando o arquivo, `filename` no anexo, mensagens de limite alcançáveis, `SetCampaignPageChrome`, labels pt-BR dos campos curados, guard de anexo no util, pin do chrome, entre outras. O que sobrou são débitos **maiores que o cleanup da sessão** e do mesmo lote (mesma superfície: `src/utilities/content/` + testes novos). Sem este item: (a) o guard de stream com teto e o `staticDirOf` da mídia privada passam a ter 3ª/4ª cópia (o dono `src/utilities/privateMedia/` já existe); (b) os `select` da peça e o ponto do reaper ficam re-escritos entre action/loader/rotas; (c) a marcação de campos curados na action carrega generalidade morta; (d) asserts fracos nos specs novos deixam regressões passarem.

## Objetivos

- O guard de stream com teto (raw body e resposta HTTP) e o `staticDirOf` da mídia privada vivem **num dono único** em `src/utilities/privateMedia/` (ou no upload owner), reusados por C199/C211/speech sem mudar teto, mensagens ou comportamento.
- `contentPieceSelect`/selects do loader da peça vivem num módulo do domínio e o ponto de `reapStaleContentPiece` é único (hoje: status action; o loader é read-only desde a sessão).
- A marcação de `curatedFields` na action da ficha perde a tupla+loop (o form envia todos os campos; `title`/`type` são obrigatórios no schema).
- Asserts dos specs de C211 apertados: valores exatos de mídia/arquivo onde hoje há `toBeTruthy()`; sem round-trip no-op no e2e.
- Guardrails: sem migration; sem mudança de comportamento visível; `overrideAccess`/transação inalterados; `pnpm gate:fast` + int + e2e da vertical verdes.

## Fases

1. **F1 — dono do stream/staticDir de mídia privada (score 3, maior ROI).** Extrair `streamBodyToFile`/`streamResponseToFile`/`staticDirOf` para o dono (`src/utilities/privateMedia/`), migrar `recordings/recordingUpload.ts`, `recordings/recordingJob.ts`, `content/contentPieceUpload.ts`, `content/contentPieceLink.ts`, `content/contentPieceJob.ts` (e `speech/speechMediaPipeline.ts` se couber sem arrastar escopo). Prova: unit do guard (teto por chunk/Content-Length mentiroso) + int/e2e existentes verdes.
2. **F2 — resíduos DRY do domínio `content`.** Selects da peça num módulo (`contentPieceData.ts` ou o loader) reusados pela action/rotas; ponto único do reaper; `curatedFields` sem generalidade morta. Prova: int de C211 verde sem mudança de asserção.
3. **F3 — apertar os asserts.** `tests/int/contentPiece.int.spec.ts` e a seção C211 do e2e: valores exatos de `media`/`filesize`, remover `replace('Peça ', '')`. Prova: os próprios specs.

## Já resolvido no simplify (não reabrir)

- `revalidateTag` do listing na collection (`afterChange` → `revalidateContentPiecesListing`).
- Passo `catalogando` morto no job; duração só quando medida; narrowing de `media` na resolução de fonte.
- Peça `texto` arquivando o arquivo; `filename` preservado no anexo; guard de "já tem arquivo" no util (não só na rota).
- `CONTENT_PIECE_UPLOAD_SAFE_MESSAGES` compartilhado e mensagens de limite alcançáveis.
- `SetCampaignPageChrome` na ficha + seta única; preview de texto; labels pt-BR de `curatedFields`; `postCampaignJson` no diálogo de link; `contentPieceStepLabels` como dono único do passo; loader sem reaper (write fora do render); sem re-fetch do município em update parcial.

## Explicitamente fora (descartes e defers com gatilho)

- **VM carrega `statusLabel`/`processingLabel`/`retryHref`/`isPublished` sem consumidor de produção** — descartar: é o padrão da casa (os VMs de `recording`/`reel` fazem igual; o VM é o contrato de apresentação do wire).
- **`deriveContentPieceCatalogIndex` lê o município quando a relação é tocada (1 query por save de ficha)** — descartar: micro-otimização sem N+1 real.
- **Bloco "Sem mídia oficial" da ficha para peça de arquivo** — descartar: ramo defensivo correto para peça-link (a linha de arquivo só nasce com mídia).
- **Pin de `contentPiece`/`contentMedia` em `campaignFixtures`** — defer, gatilho: 2º spec que precise das fixtures (o int spec limpa as próprias linhas; precedente C199).
- **`normalizeForSearch` não dobra `×`→`x`** — defer, gatilho: uso real da variante tipográfica na base **ou** próximo item que já toque o normalizador/backfill de `search_text` (aí o backfill + trigram vêm de carona).
- **Picker de município (435 `<option>` no `<select>` nativo)** — defer, gatilho: 2º consumidor do picker (filtros públicos do S27/S28) ou feedback real de UX na ficha.

## Self-score (decision-quality)

1. Decisões caras com rejeitadas? **Sim** — o lote é cheap_polish; nada de access/LGPD/schema/unicidade entra (piso 4–5 não se aplica), e os descartes/defers estão nomeados com gatilho.
2. Cabe no appetite? **Sim** (~0,5–1 dia, três fases pequenas, sem migration).
3. Rabbit holes nomeados? **Sim** — extrair helper com um call site (defer), refatorar o normalizador compartilhado (defer), picker com um consumidor (defer).
4. Depth check? **Sim** — reusa o dono de mídia privada existente; não cria módulo de pureza.
5. Outcome do C211 intocado? **Sim** — só estrutura interna e asserts.

**Score: 5/5.**
