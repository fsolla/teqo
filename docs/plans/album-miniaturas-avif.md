# C248 — Miniaturas AVIF pré-geradas do álbum público (previews rápidos nos cards)

Status: rascunho
Atualizado em: 2026-10-02
Issue: #1424
Priority: P1
Impeccable: A — sem UI (mudança de performance; nenhuma tela/fluxo novo)
Design UI: N/A — sem UI
Appetite: ~1–2 dias eng + tempo de máquina do backfill; um outcome verificável — os previews da grade são servidos de uma derivada armazenada, sem resize do original por request
Responsável: —

## Intenção

Os previews das fotos do álbum estão demorando para carregar. A página `/fotos` é superfície pública viva — ~6.492 fotos publicadas e a eleição é em 04/10 — e cada card da grade paga hoje um resize por request no proxy da foto, sem nenhuma variante armazenada. Isso é exatamente o gatilho de revisita registrado quando o v1 shipou: "variante armazenada se a CPU/p95 incomodar" (C233, D4). A intenção é gerar, uma vez por foto, uma miniatura AVIF na resolução dos cards e servi-la dali — mantendo a rota pública e a experiência atuais, só que rápida.

## Persona e fluxo

- **Persona / contexto:** eleitor/cidadão no celular, muitas vezes em rede móvel, navegando a grade pública `/fotos` e a busca por selfie; paciência curta, quer ver as fotos agora.
- **Job principal:** rolar a grade e reconhecer as fotos sem esperar previews em branco.
- **Fluxo desejado:** abre `/fotos` → a grade aparece preenchida rápido → toca uma foto → o lightbox abre no original (como hoje). O visitante não vê nada diferente — só mais rápido.
- **Anti-goals de produto:** virar um pipeline genérico de mídia; criar segunda URL/contrato público; adotar cache público/CDN; mexer na UI ou no lightbox.

## Objetivo e aceite

- Preview da grade (`?tamanho=grade`) deixa de depender de resize por request: quando existe derivada, ela é servida direto.
- Derivada ausente, ilegível ou original indisponível/quebrado cai no fallback atual, sem imagem quebrada em nenhum caso.
- Navegador sem suporte a AVIF recebe o fallback (JPEG atual) — nenhum preview quebrado por formato.
- Remoção/pull-down continua imediato: derivada só é servida se a foto estiver aprovada no read cacheado; foto despublicada some na hora, como hoje.
- Fotos novas passam a ser cobertas automaticamente pelo fluxo de entrada/aprovação.
- Backfill único das fotos existentes com recibo legível (processadas, puladas, falhas) e idempotente — reexecutar não duplica nem corrompe nada.
- Nenhum original é alterado; nenhuma URL pública muda; nenhuma tela/fluxo novo.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhuma superfície de dados nova. O único artefato é o recibo operacional do lote (contagens e skips), consumido por operador, não por tela de produto.
- **Decisões desbloqueadas:** N/A — nenhuma decisão de produto pendente de leitura de dados.
- **Forma:** N/A.

## Dados da decisão (literais)

- URL pública inalterada: `/fotos/<id>/midia?tamanho=grade` (contrato congelado).
- Resolução: **720px** de largura (2× do card mais largo, ~352px no desktop; card ~169px no mobile); formato **AVIF ~q60** na régua do repo.
- Acervo: **6.492** fotos ingeridas/publicadas (de 6.577 na conta Flickr).
- Filename determinístico por foto: `flickr-<id>.<ext>` — a derivada segue o mesmo padrão determinístico.
- Cache mantido: `private, no-store`; bucket privado (Garage), sem CDN.
- Lotes com guarda de intenção explícita no padrão `*_CONFIRM` (`FACE_INDEX_CONFIRM`, `ARCHIVE_CATALOG_CONFIRM`, `ARCHIVE_PUBLISH_CONFIRM`, `MEDIA_RECOVER_CONFIRM`).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/fotos/` (cards consomem `thumbnailPath`), `src/app/(frontend)/fotos/[id]/midia/route.ts`, `src/utilities/privateMedia/privateMediaResponse.ts`, `src/collections/ArchivePhoto.ts`, `src/utilities/flickr/` e `scripts/` (lote/backfill).
- **Precedente a olhar:** derivada privada determinística do frame C226 (`content-piece-frame-<id>.jpg`); AVIF q60 e `pnpm images:resize` (`scripts/lib/imageResize.mjs:19,26-39`); escrita S3 por CLI via `PutObjectCommand` (`scripts/recover-media.mjs:95,235-242`); serviço de maintenance do deploy (`scripts/deploy-homeserver.sh:157,336`).
- **Risco de acoplamento:** C245/C246 operam sobre os mesmos originais (C246 re-ingere no mesmo key); o backfill deve rodar serializado com essas ops e tratar objeto ausente/quebrado como skip honesto, re-gerando quando a foto for recuperada. Não tocar no contrato `?tamanho=grade` nem no comportamento de pull-down.

## Dependências

- Soft: C245 (#1417, catalogação em produção) e C246 (#1418, integridade do Garage) — apenas serializar o backfill; sem dependência dura.

## Fora de escopo

- Variante média para o lightbox — segue servindo o original.
- Redimensionar ou tocar no original; mudar a resolução/qualidade das fotos.
- CDN/cache novo, `next/image`, refazer a UI da grade ou da busca por selfie.
- Qualquer alteração da URL pública ou do mecanismo de pull-down (right to erasure).

## Rabbit holes de produto

- **"Já que geramos AVIF, geramos vários tamanhos."** Se alguém "só completar": matriz de variantes, invalidação, custo de storage. **Corte neste item:** só 720px da grade.
- **"Gerar no upload e pronto."** Sem fallback, original ausente/quebrado vira card quebrado. **Corte neste item:** fallback on-the-fly sempre que a derivada faltar.
- **"Cache público/CDN resolve de vez."** Muda a postura de privacidade e a remoção imediata. **Corte neste item:** `no-store` e pull-down como hoje.
- **"Backfill sem guarda, roda e vê."** Duplica trabalho durante C245/C246 e mascara falha. **Corte neste item:** lote idempotente, com `*_CONFIRM`, recibo e skip honesto.

## Questões em aberto (produto)

- **Quando gerar a derivada?** **Opções:** A) no ingest; B) na aprovação (staff); C) backfill one-shot das existentes + geração automática no fluxo de entrada/aprovação. **Recomendação:** C — cobre o acervo inteiro já e não deixa foto nova descoberta; fallback cobre a janela até a geração. _(assumido — validar com produto)_
- **Falha ao gerar derivada bloqueia publicação?** **Opções:** sim | não. **Recomendação:** não — a foto publica e o fallback atende; derivada é otimização, nunca requisito. _(assumido — validar com produto)_
- **Backfill inclui fotos ainda não publicadas?** **Opções:** sim | só aprovadas/publicadas. **Recomendação:** só aprovadas/publicadas — alinha com o guardrail de remoção e evita trabalho descartável. _(assumido — validar com produto)_
- **Navegador sem suporte a AVIF?** **Opções:** A) negociar por `Accept` e cair no fallback JPEG atual | B) servir AVIF sempre (limiar de suporte aceito). **Recomendação:** A — a promessa é "nenhum preview quebrado", e o fallback já existe. _(assumido — validar com produto)_

## Referências

- GitHub Issue # — a definir no registro.
- C233 impl, D4 (gatilho de variante armazenada): `docs/plans/album-fotos-publico-busca-impl.md:87-92,184`.
- C245 (#1417) e C246 (#1418) — ops nos mesmos originais.
- Post-mortem das imagens lentas da home (não confundir: lá era `next/image` + masters AVIF 4K): `docs/postmortems/2026-10-01-imagens-lentas-home-campanha.md:31-35`.

## Self-score (shaping)

**5/5** — (1) um outcome verificável: previews servidos de derivada armazenada com fallback; (2) appetite declarado (~1–2 dias eng) e a intenção cabe, com rabbit holes cortados; (3) persona, job e aceite em linguagem de produto; (4) direção no codebase é hipótese com pistas, não contrato; (5) zero decisões duras de engenharia — schema, nomes e signatures ficam para o plano de implementação.
