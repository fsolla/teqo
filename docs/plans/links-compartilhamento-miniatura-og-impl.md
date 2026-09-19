# Impl: Links de compartilhamento com miniatura personalizada

Status: em execução
Atualizado em: 2026-09-19
Issue: #1207
Intenção: docs/plans/links-compartilhamento-miniatura-og.md
Appetite restante: herdado (~1 dia eng — cadastro novo no admin + uma rota pública + testes; sem gordura de analytics/expiração)

## Leitura da intenção

- **Outcome:** a equipe de comunicação cria no admin um `shareLink` (slug de 1 segmento, destino http/https, título, descrição e imagem opcionais) e `jorgesolla1313.com.br/<slug>` serve HTML com o OG configurado — o crawler do WhatsApp lê esse HTML — enquanto a pessoa que clica chega ao destino imediatamente, sem interstício; sem imagem configurada, a miniatura cai na imagem padrão do site; despublicado → 404; destino inválido, slug duplicado ou reservado → recusa no formulário com mensagem clara; página `noindex,nofollow`; a URL de destino crua nunca aparece na miniatura.
- **O que NÃO negociar:** contrato de URL de 1 segmento na raiz (produto); OG renderizado no servidor; clique direto; fallback de imagem do site (nunca miniatura quebrada); fail-closed nas quatro frentes (não publicado, destino fora de `http`/`https`, duplicado, reservado); destino fora da descrição/OG; instruções pt-BR visíveis no formulário; grupo `Publicações`; zero analytics/UTM/persistência de quem clica.
- **O que reavaliar:** as decisões assumidas no produto (imagem por upload A; clique instantâneo A; editores A; grupo `Publicações` A; sem agendamento A) — a engenharia confirma A em todas e mantém agendamento/expiração fora; a hipótese de rota também se confirma: o Next 15.4.11 lança E337 para `[slug]` ao lado de `[type]`, então não há pasta dinâmica nova possível e o destino do ramo é o dono existente.

## Abordagem recomendada

```mermaid
flowchart LR
  E["Editor no admin<br/>Publicações › Links de compartilhamento"] --> C["shareLink<br/>slug · destino · título · descrição · imagem · published"]
  C -->|afterChange / afterDelete| T["revalidateShareLinksListing<br/>tag shareLinks (documents.ts)"]
  W["Crawler do WhatsApp / pessoa"] -->|GET /:slug| R["[type]/page.tsx<br/>!isPostType(type)"]
  R --> L["getCachedPublishedShareLinkBySlug<br/>unstable_cache · tag shareLinks"]
  L --> DB[("shareLink published=true")]
  R -->|achou + destino http(s)| H["200 HTML<br/>og:* + meta refresh + location.replace"]
  R -->|não achou / despublicado / destino inválido| N["404"]
  H -->|pessoa navega na hora| D["destino externo"]
```

**Opções consideradas:** A (ramificar dentro de `[type]/page.tsx`) | B (prefixo estático `/l/<slug>`) | C (`middleware.ts` com rewrite) | D (renomear o segmento para `[[...segments]]`)

**Recomendação:** A — nenhuma rota nova: quando `!isPostType(type)`, o dono do segmento tenta o loader do share link por slug; achou + publicado + destino válido → renderiza a página-redirect; senão `notFound()`. Reusa o molde do `/corte/[id]` (loader + `noindex` + 404 uniforme) e o contrato de URL do produto. `generateStaticParams` continua só com os tipos de post; `dynamicParams = true` (já no arquivo) cobre o slug em runtime, e os estáticos (`/artigos`, `/cards`) seguem vencendo o dinâmico sem interferir.

**Rejeitadas:** B — viola o contrato de 1 segmento na raiz; C — não existe `middleware` no frontend, acoplaria leitura de DB na borda e taxaria toda rota; D — reescreveria todas as rotas de posts (blast radius desproporcional) e ainda deixaria o custo de precedência no mesmo lugar.

### Decisões de engenharia

1. **Mecânica do redirect — 200 HTML com OG + meta refresh + `location.replace` (caro).**
   **Opções:** A) `generateMetadata` (OG/twitter/noindex/canonical) + `<meta httpEquiv="refresh" content="0;url=…">` (React 19 hoista `<meta>` para o `<head>`) + script inline `location.replace` com URL escapada; B) `redirect()` 307 server-side; C) página intermediária com botão.
   **Recomendação:** A — o crawler do WhatsApp lê o HTML servido e não executa refresh/JS; B faria o crawler seguir o 307 e perder o nosso OG (a miniatura seria a do destino ou vazia), e o `noindex` não viajaria; C é anti-goal explícito ("sem tela intermediária perceptível"). O meta refresh cobre no-JS; o script navega antes do paint; o destino cru só existe no `content`/script do HTML, nunca em `og:description`. No render, o destino é **revalidado** com o mesmo validador puro antes de emitir (defense-in-depth: dado inválido → 404, nunca redireciona para esquema estranho).
   **Rejeitadas:** B e C acima.

2. **Publicação — checkbox `published`, default `false` (caro).**
   **Opções:** A) boolean `published` (kill switch) com default `false` (publicar é ato explícito); B) drafts/versions (como `Post`); C) select `status` (como `SpeechCut`).
   **Recomendação:** A — o produto pede um kill switch, não fluxo editorial: versions adicionam `_status`, tabelas `_v` e autosave sem consumidor; o select do corte carrega um ciclo de job (`processing`/`failed`) que não existe aqui. Default `false` porque o repo é fail-closed: o link nasce invisível e a editora marca "Publicado" no mesmo formulário (descrição no campo diz que desmarcado responde 404); a leitura anônima (REST) também filtra `published: true`.
   **Rejeitadas:** B — cerimônia de versões para um doc de 5 campos; C — vocabulário de status que mente sobre o domínio.

3. **Leitura cacheada e revalidação — tag de listing no vocabulário de `documents.ts` (caro).**
   **Opções:** A) `getCachedPublishedShareLinkBySlug` em `src/utilities/shareLinkReads.ts` (`unstable_cache`, tags `[getCollectionListingTag('shareLink')]` → `shareLinks`) + `revalidateShareLinksListing()` exportado por `documents.ts` e chamado em `afterChange`/`afterDelete`; B) sem cache (DB a cada view); C) tag por documento no loader por slug.
   **Recomendação:** A — reusa o dono do vocabulário de tags (o privado `getListingTag` vira `getCollectionListingTag` exportado; precedente `revalidatePostsListing`) e mantém o grafo acíclico: a lib pura não importa `@payload-config`; só `shareLinkReads.ts` importa config, com `import 'server-only'` e imports estáticos (guardas de convenção). O loader por slug não conhece o id antes da leitura, então uma tag por documento nasceria sem leitor.
   **Rejeitadas:** B — toda view quente bateria no Postgres, contra o precedente do corte; C — tag morta (nenhum leitor por id).

4. **Validação de slug — `beforeValidate` (slugify) + `validate` assíncrono + índice único (caro).**
   **Opções:** A) `beforeValidate` reusando `slugify` (`src/lib/slug.ts`, precedente `Post.ts`), `validate` async com formato kebab-case, reservados e duplicata via `req.payload.find` (`overrideAccess: true` com comentário de bypass), e `unique: true` no campo; B) só `unique: true` (mensagem genérica do Payload); C) schema zod em `src/lib/schemas/`.
   **Recomendação:** A — mensagens pt-BR claras no formulário (o pedido literal do produto), com o índice único como backstop para a corrida entre validate e insert; a query de unicidade enxerga todas as linhas independentemente do ator. O padrão kebab-case ainda exclui `_next`/`favicon.ico`/caminhos com ponto por construção. Zod é dono de input de action HTTP (precedente), não de campo do admin.
   **Rejeitadas:** B — erro genérico e sem reservados; C — fora do precedente do admin.

5. **Imagem e forma do OG — molde do `/corte/[id]` (caro o suficiente).**
   **Opções:** A) `image` upload opcional → `toAbsoluteUrl`; vazio → imagem do global `metadata` via `getCachedDocumentById('media', …)`; OG `type: 'website'`, `url`/canonical = URL curta, twitter `summary_large_image`, `robots: {index:false, follow:false}`; B) exigir imagem no link; C) criar `imageSizes`/derivadas no `Media`.
   **Recomendação:** A — reusa `resolveSiteMetadata`/`absoluteSitePath`/`toAbsoluteUrl`/`truncate` (`src/utilities/seo.ts`) e a resolução global→mídia do corte e do layout raiz. Sem `siteUrl`, omite a imagem em vez de emitir `og:image` relativa (o crawler não resolve relativa). `og:title` = título configurado **literal** (o card mostra o que a editora escolheu; o `<title>` da aba leva `| <siteName>`); `og:site_name` segue o global. Descrição só com o texto configurado (jamais o destino).
   **Rejeitadas:** B — a intenção diz opcional com fallback; C — a instrução de 1200×630 no formulário resolve e derivadas/transcode são rabbit hole.

6. **Modelo do cadastro — `shareLink` no grupo `Publicações` (caro).**
   **Opções:** A) collection `shareLink`, labels "Link de compartilhamento"/"Links de compartilhamento", campos `title` (text, required, `maxLength` 90), `slug` (text, required, unique, index, slugify+validate), `destination` (text, required, trim + validate http/https), `description` (textarea, required, `maxLength` 160, whitespace colapsado no metadata), `image` (upload → media, opcional), `published` (checkbox, default false), `admin.description` com os literais de instrução; B) `shortLink`; C) `redirect`.
   **Recomendação:** A — o nome diz a função de produto; `Publicações` já existe (`Post`) e é onde a comunicação publica. Os `admin.description` copiam os literais da intenção (imagem 1200×630/600 KB/JPG-PNG/300 px/4:1; título ~60–90; descrição ~80–160; URL pública absoluta resolvida pelo upload; cache do WhatsApp por URL com orientação de slug novo). `useAsTitle: 'title'`; sem `versions`; sem `createdBy` (conteúdo público de CMS, como `Post`).
   **Rejeitadas:** B — puxa o rabbit hole "encurtador"; C — colide com o conceito de infra de redirect e não descreve o produto.

7. **Access — leitura fail-closed, sem Consent novo (barato).**
   `read`: staff (`hasPayloadPanelAccess`) vê tudo; anônimo recebe `{ published: { equals: true } }` (molde `canReadSpeechCut`, `access/speeches.ts`); `create`/`update`/`delete`: `canManagePublishedContent` (editores/admin, como `Post`/`Media`). Sem `Consent` (não há PII/opt-in), sem `Contact`, sem transação multi-collection (a escrita é de um doc só), sem `stampCampaignCreatedBy` (não é coleção de campanha).

### Componentes / mudanças

- **`src/lib/shareLink.ts`** (novo, puro/client-safe): dono do vocabulário — `SHARE_LINK_TITLE_MAX_LENGTH` (90), `SHARE_LINK_DESCRIPTION_MAX_LENGTH` (160), `SHARE_LINK_RESERVED_SLUGS` (literal da intenção: `cards, artigos, corte, privacidade, mandato-no-whatsapp, abaixo-assinado, api, admin, noticia, campanha, artigo, evento`), `isValidShareLinkSlug`, `isReservedShareLinkSlug`, `isValidShareLinkDestination` (`new URL` + protocolo http/https), `shareLinkPath`, `normalizeShareLinkDescription` (colapsa whitespace), e as mensagens pt-BR (`SHARE_LINK_SLUG_INVALID_MESSAGE`, `SHARE_LINK_SLUG_RESERVED_MESSAGE`, `SHARE_LINK_SLUG_DUPLICATE_MESSAGE`, `SHARE_LINK_DESTINATION_INVALID_MESSAGE`).
- **`src/collections/ShareLink.ts`** (novo): config da collection; reusa `slugify` e `canManagePublishedContent`/`hasPayloadPanelAccess`; `beforeValidate` de slug; `validate` async de unicidade com bypass comentado; hooks `afterChange`/`afterDelete` chamando `revalidateShareLinksListing()`.
- **`src/payload.config.ts`** (editar): import + entrada no array (junto de `Post`/`Tag`).
- **`src/utilities/documents.ts`** (editar): `getListingTag` → `getCollectionListingTag` exportado + `revalidateShareLinksListing()` (sem importar config).
- **`src/utilities/shareLinkReads.ts`** (novo, `server-only`, imports estáticos): `getCachedPublishedShareLinkBySlug(slug, depth = 1)` — `find` com `slug equals` + `published equals true`, `unstable_cache` tags `[getCollectionListingTag('shareLink')]`, key `['share-link-by-slug', slug, String(depth)]`; e `resolveShareLinkOgImageUrl(link)` — imagem do link → fallback do global `metadata` (número → mídia) → `null`, com `siteUrl` derivado de `resolveSiteMetadata` e URL sempre absoluta via `toAbsoluteUrl` (nunca relativa).
- **`src/app/(frontend)/[type]/page.tsx`** (editar): ramo `!isPostType(type)` no `Page` (achou → `<ShareLinkRedirect>`; senão `notFound()`) e o mesmo ramo no `generateMetadata` (OG completo; `{}` quando não achou).
- **`src/components/ShareLinkRedirect.tsx`** (novo): server component sem DOM visível — `<meta httpEquiv="refresh" content=... />` (hoisted) + `<script dangerouslySetInnerHTML>` com `location.replace(JSON.stringify(destination).replace(/</g, '\\u003c'))`; sem `SiteHeader`/hierarquia.
- **Testes:** `tests/unit/shareLink.unit.spec.ts` (puros + lista de reservados literal + drift: todo segmento de rota estático em `src/app/(frontend)`/`(home)` está reservado), `tests/int/shareLink.int.spec.ts` (getPayload real em `teqo_test`, mock de `next/cache` como `speechCut.int.spec.ts`: validações/mensagens, default `published: false`, slugify, loader só publicado, kill switch, access), `tests/e2e/frontendShareLink.e2e.spec.ts` (OG HTML + redirect real + 404 + republicação + fallback).
- **Manifesto e2e:** entrada nova em `scripts/lib/e2e-affected-manifest.mjs` (prefixos `src/app/(frontend)/[type]`, `src/lib/shareLink.ts`, `src/utilities/shareLinkReads.ts`, `src/collections/ShareLink.ts`, `src/components/ShareLinkRedirect.tsx` → spec `frontendShareLink`) + `frontendShareLink` em `E2E_CURATED_SPECS` com o pin atualizado em `tests/unit/e2eAffectedManifest.unit.spec.ts` (a migration torna todo PR high-risk; precedente C167).
- **Migration:** `add_share_link` via `pnpm migrate:create add_share_link` (tabela + FK de `image` + índice único de `slug`; aditiva, sem backfill); commitar `.ts`+`.json`+`index.ts`; `src/payload-types.ts` regenerado.
- **Access / Consent:** access inline na collection (acima); sem Consent; sem tocar `campaignAccess.ts`.
- **UI:** Impeccable **A** — a única "tela" é o redirect sem pixels; no admin, só o formulário com `admin.description` pt-BR.

## Fases verificáveis

1. **Puros + schema + migration (tracer ~0,3 dia).** `src/lib/shareLink.ts` + `tests/unit/shareLink.unit.spec.ts`; `src/collections/ShareLink.ts`; registro no `payload.config.ts`; `pnpm generate:types`; `pnpm migrate:create add_share_link`, revisar SQL e `pnpm migrate` **só no banco local do worktree** (produção aplica no deploy via `pnpm build`; `push:false` intocado); `pnpm gate:fast`. Verificação: unit verde, `payload-types.ts` com `shareLink`, `migrate:status` aplicado.
2. **Leitura + revalidação (~0,2 dia).** `documents.ts`; `src/utilities/shareLinkReads.ts`; hooks na collection; `tests/int/shareLink.int.spec.ts` com mock de `next/cache`. Verificação: loader devolve só publicado; despublicar zera; validações com as mensagens pt-BR; access anônimo × editor.
3. **Rota + componente (~0,2 dia).** `ShareLinkRedirect.tsx` + ramo no `[type]/page.tsx` (`Page` e `generateMetadata`). Verificação manual no `pnpm dev` do worktree: link criado → `curl` mostra `og:*`, `noindex`, `http-equiv="refresh"`, `location.replace`; despublicar → 404; republicar → 200.
4. **Testes de superfície (~0,2 dia).** e2e `frontendShareLink`: 200 com `og:title`/`og:description`/`og:image` absoluto e `og:url` curto; `og:description` sem o destino; navegação real do browser para o destino (script e meta refresh sem JS); 404 uniforme para despublicado e slug inexistente; ciclo despublicar→republicar. O fallback de imagem é do `resolveShareLinkOgImageUrl` (int, com mock do global `metadata` — o global é estado compartilhado entre int e e2e no mesmo banco, então o teste não o escreve); manifesto + curado + pin; `pnpm test`.
5. **Gates + changelog + PR (~0,1 dia).** `pnpm gate:fast`; changelog `docs/changelog/2026-09-19-s19.md`; `pnpm push` e PR ready (CI de PR roda unit/int full + e2e curado por causa de `src/collections`/`src/migrations` — esperado).

## Rabbit holes / Não escopo (engenharia)

- Analytics/contagem de cliques/UTM, expiração/agendamento, QR code, encurtador genérico/domínio próprio, múltiplos destinos/A-B, preview do card no admin (lista da intenção).
- `imageSizes`/derivadas/validação de dimensão-pixel/transcode da imagem (a instrução no formulário é o contrato).
- `middleware.ts`, refatorar `[type]` para catch-all, redirects no `next.config`, histórico/redirect de slug renomeado (renomeou → link antigo morre; a orientação de cache no formulário já cobre o caso do WhatsApp).
- Tag por documento/revalidação por path; versionamento/auditoria do link; apagar mídia órfã ao excluir o link (mídia é do `Media`, como a capa do `Post`).
- Qualquer Consent novo, `Contact` ou escrita multi-collection (não existem no fluxo).
- **Defer com gatilho:** a entrada S19 do manifesto (`src/utilities/documents.ts`) acorda só o `frontendShareLink`; quando esse arquivo mudar por listagens além de shareLink, ampliar a entrada para `specs: ['frontend', 'frontendShareLink']`.

## Riscos e mitigação

- **Colisão com rota estática futura** (estático vence o dinâmico e o link sumiria): lista de reservados + teste unitário de drift que varre os segmentos estáticos de rota de `src/app/(frontend)` (incl. `(home)`) e exige reserva; o padrão kebab-case exclui `_next`/pontos.
- **404→200 após republicar** (cache de rota cheia): o e2e cobre o ciclo completo (publicar → despublicar → republicar); se falhar, o remédio documentado é `dynamic = 'force-dynamic'` no `[type]` (custo no cache das listagens — decidir com a prova do e2e, não preventivamente).
- **Corrida de slug** (validate × insert): índice único é o backstop; a corrida rara cai no erro genérico do banco.
- **Cache do WhatsApp**: orientação no formulário, sem mecanismo de invalidação (corte aceito no produto).
- **`og:image` relativa** (sem `siteUrl`/global): omitida em vez de quebrada; `siteUrl` cai no `NEXT_PUBLIC_SITE_URL` do build.
- **Crawler real do WhatsApp não roda em CI**: o contrato testado é o HTML servido (OG + refresh sem depender de JS).
- **Migration em produção**: aditiva e sem backfill, aplicada pelo deploy (`pnpm build` → `payload migrate`); em dev, só no banco local do worktree.
- **Sondagens a slugs inexistentes** populam o cache de dados (uma entrada por slug, LRU do Next) — sem impacto de correção.
- **CI mais caro**: `src/collections/`/`src/migrations/` são high-risk → unit/int full + e2e curado (previsto).

## Aceite de engenharia

- [ ] Aceite de produto: criar pelo admin e compartilhar `/<slug>` mostra título/descrição/imagem configurados no HTML servido; clique instantâneo; fallback para a imagem padrão; 404 para não publicado; recusa clara para destino inválido, slug duplicado e reservado; `noindex,nofollow`; destino nunca na miniatura; instruções pt-BR no formulário; nada de analytics/PII.
- [ ] Invariantes: leitura anônima fail-closed (`published` where) e escrita só editor/admin; Local API com bypass só com comentário; sem Consent/Contact/transação (não se aplicam); copy pt-BR e identificadores em inglês; collection só via migration nova (`push:false`, nenhuma migration editada); entrega via `pnpm push`.
- [ ] Testes: unit dos puros + drift de reservados; int das validações/default/loader/access; e2e do HTML OG, redirect real, 404, republicação e fallback.

## Self-score de decision-quality (gate ≥4)

**4,5/5.**

1. Decisões caras com rejeitadas — 5/5: roteamento (A×B×C×D), mecânica do redirect, modelo de publicação, cache/tag, validação de slug, OG/fallback e modelo do cadastro, todas com o porquê e o que foi recusado.
2. Appetite — 4/5: cabe em ~1 dia (lib pura, collection, loader, ramo de rota, componente, migration e testes); o ciclo publicar→despublicar→republicar no e2e é o único custo além do previsto.
3. Rabbit holes — 5/5: nomeados (analytics, expiração, QR, encurtador, preview do card, `imageSizes`, middleware, histórico de slug).
4. Depth check — 5/5: reusa `slugify`, `canManagePublishedContent`/`hasPayloadPanelAccess`, o vocabulário de tags de `documents.ts`, `resolveSiteMetadata`/`absoluteSitePath`/`toAbsoluteUrl`/`truncate`, o molde de OG/fallback do `/corte/[id]`, o upload do `Media` e o grupo `Publicações`; nenhum wrapper raso.
5. Intenção satisfeita — 5/5: o aceite de produto (URL de 1 segmento, miniatura do crawler, clique direto, fallback, fail-closed, noindex, instruções) não foi reescrito pela engenharia; a única cedência técnica é o ramo no dono do segmento, imposto pelo E337 e contido por reservados + teste de drift.
