# Build resiliente ao global `metadata` ausente

Status: entregue
Atualizado em: 2026-07-27
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Site público → Próximos)
Impeccable: A — N/A (sem superfície visual; só `<head>` / JSON-LD)
Appetite: ~0,4–0,5d eng (auditoria ampliou o escopo do roadmap de ~0,25d)
Responsável: —

## Dados → decisão → apresentação

Dados: N/A — a entrega só evita crash no prerender e omite canonical/OG quando não há URL; não apresenta métrica, mapa, série nem ranking.

## Contexto

Fonte: simplify B16 (2026-07-25) — build local morreu no prerender de `/abaixo-assinado/[id]` porque `stripTrailingSlash(globalMetadata.URL)` recebia `undefined` (global vazio ou entrada de `unstable_cache` gravada vazia). `rm -rf .next` contornava o cache envenenado, mas o código continuava frágil.

Auditoria na implementação (2026-07-27) achou o mesmo padrão nas três rotas de posts (`/[type]`, `/[type]/[category]`, `/[type]/[category]/[slug]`) e nos acessos a `openGraph.siteName` / `twitter.creator` / `keywords.map` — corrigir só `URL` em só uma rota não desbloqueava o build.

## Objetivos

- `next build` degrada em vez de morrer quando o global `metadata` está vazio.
- Cadeia de URL: `global.URL` → `NEXT_PUBLIC_SITE_URL` → omitir canonical / Open Graph url / JSON-LD url.
- Defaults textuais (`siteName`, `title`, `description`, `twitterCreator`) centralizados; layout deixa de hardcodar `https://jorgesolla.com.br` como fallback de OG url.
- Todo consumidor do global passa por `resolveSiteMetadata` (guard em `codebaseConventions`).

## Decisões travadas

- **Escopo = 4 rotas + layout + todos os campos frágeis**, via resolver em `src/utilities/seo.ts`. **Rejeitado:** literal do roadmap (só `URL` em `/abaixo-assinado/[id]`) — o build ainda quebraria nas rotas de post e no `openGraph.siteName`.
- **`siteUrl === null` → omitir**, não inventar domínio. **Rejeitado:** cair sempre em `https://jorgesolla.com.br` (o layout antigo mentia canonical em banco vazio) e omitir sem tentar `NEXT_PUBLIC_SITE_URL` (o segundo degrau cobre build local com env).
- **Impeccable A.** Softened `[&_blockquote]:border-l-4` → `border-l` na página de artigo só porque o design hook bloqueava o write SEO; alinhado ao padrão já usado na página de abaixo-assinado.

## As-built

- `resolveSiteMetadata` + `SITE_METADATA_DEFAULTS` em [`src/utilities/seo.ts`](../../src/utilities/seo.ts).
- Consumidores: [`layout.tsx`](../../src/app/(frontend)/layout.tsx), [`abaixo-assinado/[id]/page.tsx`](../../src/app/(frontend)/abaixo-assinado/[id]/page.tsx), [`[type]/page.tsx`](../../src/app/(frontend)/[type]/page.tsx), [`[type]/[category]/page.tsx`](../../src/app/(frontend)/[type]/[category]/page.tsx), [`[type]/[category]/[slug]/page.tsx`](../../src/app/(frontend)/[type]/[category]/[slug]/page.tsx).
- Cópias locais de `stripTrailingSlash` / `truncate` / `toAbsoluteUrl` na página de abaixo-assinado removidas.
- Pins: `tests/unit/siteMetadata.unit.spec.ts`, `tests/int/siteMetadataFallback.int.spec.ts`, guard em `tests/unit/codebaseConventions.unit.spec.ts`.

## Verificação

- `tsc --noEmit`, `lint` (0 warnings), `format:check`, `check:cycles` (0), unit 548, int do pin (3) + petition layout (4), `pnpm build` local verde (84 páginas estáticas geradas).
- knip: P3 pré-existente (`payload.config.ts` não carrega).
- Aikido: 0 findings novos; `dangerouslySetInnerHTML` em JSON-LD / Lexical é pré-existente (CMS/admin-controlled + escape de `<` no JSON-LD do artigo).

## Não escopo

- Fallbacks dos globais `home` / `site-settings` (já usam `?.` / `??`).
- Textos finais de privacidade / O0+ (item separado no roadmap).
- Popular o global `metadata` no seed (o app falha fechado de propósito no SEO, não no HTML).

## Revisões

- 2026-07-27 — entrega: escopo ampliado na auditoria; as-built acima.
