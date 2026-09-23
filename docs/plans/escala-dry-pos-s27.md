# Escala e DRY pós-S27 (Central de Conteúdos pública)

Status: rascunho
Atualizado em: 2026-09-23
Issue: a registrar (`depends: [1255]`)
Item do roadmap: — (follow-up de engenharia da entrega S27)
Responsável: —
Appetite: ~0,5 dia eng (fill-in; uma extração + migração de call sites, sem migration)
Impeccable: A — só backend/refactor (nenhuma superfície visual muda)

## Contexto

A entrega S27 ([central-conteudos-publica.md](central-conteudos-publica.md), Issue #1255) criou a Central pública (`/conteudos` + peça + serving privado + share de voto) e a passagem `/simplify` (2 revisores, 0 achados altos) aplicou as correções da própria sessão: type honesty do VM (`file` como união, sem campos parcialmente populados), `ContentPieceActions` único para baixar/compartilhar, `resolvePrivateMediaStaticDir` no dono da mídia privada (rota pública + interna), foco/restauração do sheet, `-right-auto` inválido do blob do YouTube, partição única large/compact no catálogo, filtros computados uma vez, `ui.ts` → `contentPieceClasses.ts` e o script temporário de screenshots removido. O que sobrou é **um** débito maior que o cleanup da sessão: o fallback de imagem OG (global `metadata` → `contentMedia`/`media`) está repetido em 6–7 páginas públicas — o S27 adicionou a 5ª e a 6ª cópia (`conteudos/(catalog)/page.tsx` e `conteudos/[slug]/page.tsx`), ao lado de `jingles`, `corte/[id]` e `abaixo-assinado/[id]` (×2). Sem este item, a próxima página pública copia o bloco de novo e o dia em que o fallback mudar (ex.: formato do global, imagem por tipo) a mudança fica espalhada.

## Objetivos

- O fallback de imagem OG do frontend público vive **num dono único** server-only, com a assinatura que os call sites já usam: resolve a imagem configurada (quando houver), senão a imagem do global `metadata` (populando o id quando numérico), senão `null` — sempre absoluta contra o origin de deploy (`resolveDeploymentOrigin`), nunca contra o domínio canônico do global.
- `src/utilities/seo.ts` permanece **puro** (sem I/O): o resolver com I/O nasce ao lado dos reads de global (`src/utilities/ogImageReads.ts` ou equivalente), reusando `resolveSiteMetadata`/`toAbsoluteUrl`.
- Migrar os **2 call sites do S27** e, na sequência, os pré-existentes (`jingles/page.tsx`, `corte/[id]/page.tsx`, `abaixo-assinado/[id]/page.tsx` ×2, `[type]/[category]/[slug]/page.tsx`, `layout.tsx`) sem mudar comportamento observável (mesmas URLs de OG nos e2e atuais).
- `artigos/page.tsx` fica fora: a fonte da imagem é `home.image`, não o global.
- Guardrails: sem migration; sem mudança de comportamento visível; `pnpm gate:fast` + int + e2e das rotas públicas verdes.

## Fases

1. **F1 — dono único (maior ROI).** Criar o resolver server-only (global `metadata` + mídia + origin) e migrar os 2 call sites do S27. Prova: unit do resolver (sem imagem → `null`; global numérico → media populada; URL relativa → absoluta no deployment origin) + e2e `frontendConteudos` (og:image) verde.
2. **F2 — migrar as cópias pré-existentes.** `jingles`, `corte/[id]`, `abaixo-assinado/[id]` (×2), `[type]/[category]/[slug]` e o `layout.tsx` que hoje repetem o bloco. Prova: e2e `frontendJingles`/`campaignSpeechCut`/`frontend` verdes sem mudança de asserção.
3. **F3 — apertar a rede.** Caracterização do OG por rota (meta `og:image`) onde o e2e já cobre a página; nenhum teste novo além do unit de F1.

## Já resolvido no simplify (não reabrir)

- Type honesty do VM público: `file` é união (`{ id, path, mimeType, downloadFilename } | null`), sem `mediaId`/`mediaPath`/`mediaMimeType`/`downloadFilename` soltos.
- `ContentPieceDownloadLink`/`ContentPieceShareButton` únicos (`ContentPieceActions.tsx`), usados por card e página.
- `resolvePrivateMediaStaticDir` no dono `src/utilities/privateMedia/privateMediaResponse.ts`, usado pela rota pública e pela interna do C211.
- Sheet de compartilhamento: foco inicial no textarea, restauração do foco ao fechar, overlay fora da ordem de tabulação.
- `-right-auto`/`-bottom-auto` inválidos corrigidos (`right-auto bottom-auto`) no placeholder de peça-link.
- Partição large/compact em um único loop; filtros ativos computados uma vez na page e passados por prop.
- `ui.ts` renomeado para `contentPieceClasses.ts`; `EMPTY_CONTENT_PIECE_CATALOG_PARAMS` e `hasActiveContentPieceCatalogFilters` removidos.
- Script temporário de screenshots removido antes do commit.

## Explicitamente fora (descartes e defers com gatilho)

- **`contentPieceDownloadFilename` gêmeo de `jingleDownloadFilename`** — defer, gatilho: 3º filename de download (corte/speech) **ou** próximo toque em `src/lib/jingle.ts` (2 call sites hoje; DRY prematuro).
- **`contentPieceReads` cacheia `media` em depth 1** — defer, gatilho já registrado no impl plan do S27: catálogo na casa dos milhares **ou** troca de arquivo de `contentMedia` relatada → depth 0 + resolução por id (padrão `jingleReads`).
- **`firstValue`/`ContentPieceCatalogSearchParams` duplicando `RawSearchParams`** — defer, gatilho: 5ª cópia **ou** próximo toque em `campaignListUrl.firstValue` (mover o canônico para `src/lib/` e reexportar; reusar hoje violaria a Dependency Rule lib→utilities).
- **`buildContentPieceWhatsAppUrl` wrapper pass-through** — descartar: é a costura de vocabulário do S27 (o irmão do S4 compõe mensagem+URL), com unit test; revisitar só com um 2º tipo de share.
- **Shell `conteudos/layout.tsx` idêntico ao de jingles** — defer, gatilho: 3º shell `campaign-site` → extrair um `CampaignScrollShell`.

## Self-score (decision-quality)

1. Decisões caras com rejeitadas? **Sim** — o lote é cheap_polish; nada de access/LGPD/schema/unicidade entra (piso 4–5 não se aplica) e os descartes/defers estão nomeados com gatilho.
2. Cabe no appetite? **Sim** (~0,5 dia, uma extração + migração mecânica, sem migration).
3. Rabbit holes nomeados? **Sim** — helper com 1 call site (defer), refatorar o normalizador compartilhado (defer), mover `seo.ts` para I/O (rejeitado: o módulo é puro por contrato).
4. Depth check? **Sim** — reusa `resolveSiteMetadata`/`toAbsoluteUrl`/`getCachedDocumentById`; cria um módulo só onde há I/O real.
5. Outcome do S27 intocado? **Sim** — só estrutura interna; as URLs de OG e o comportamento observável não mudam.

**Score: 5/5.**
