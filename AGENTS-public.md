# Public site domain (AGENTS layer — load when touching `(frontend)`)

## Posts & Tags (news / publications)

The public news/publications system is backed by two collections (both in the `Publicações` admin group) plus the helpers in `src/utilities/posts.ts`.

- **`post`** (`src/collections/Post.ts`) — fields: `title`, `slug` (unique, indexed, auto-slugified from `title` when left empty), `type` (select enum `noticia|campanha|artigo|evento`), `category` (required single relationship → `tag`), `tags` (`hasMany` relationship → `tag`), `subtitle`, `coverImage` (upload → `media`), `publishedDate`, `body` (richText). Has drafts/versions (`schedulePublish`, `maxPerDoc: 5`).
- **`tag`** (`src/collections/Tag.ts`) — fields: `name`, `slug` (unique, indexed, auto-slugified from `name`), and `hidden` (checkbox, admin label "Esconder", default `false`). Tags are the shared taxonomy for both `post.category` and `post.tags`.

**Tags are a taxonomy, not a person record.** The `Contact` convention applies to _people_; `tag` is publication metadata (categories + a visibility control flag), so post/tag relations do not touch `Contact`. Don't fold taxonomy into `Contact` or vice-versa.

**Electoral visibility control (`hidden` + fail-closed `isPostVisible`).** Marking a tag `hidden` hides every post that references it — as `category` or in `tags` — with a single toggle. This exists so campaign / pre-candidacy content (tagged `eleitoral`) can be pulled from the public site during the electoral period. `isPostVisible(post)` (`src/utilities/posts.ts`) returns true only when the post is `published` AND none of its related tags (`category` + `tags`) is `hidden`. It **fails closed**: an unpopulated relation (a bare numeric id) is treated as hiding, so callers must fetch with `depth >= 1`. Every public read filters through `getVisiblePosts()`, which applies this predicate to the cached published list.

**URLs and Portuguese SEO values.** The canonical article path is `/[type]/[category]/[slug]` (e.g. `/noticia/saude/<slug>`), with `/[type]` and `/[type]/[category]` listing routes and the home "Últimas notícias" list. The `type` enum values (`noticia|campanha|artigo|evento`) and tag/category slugs (`saude`, `eleitoral`, …) are deliberately Portuguese for SEO and are **data, not identifiers** — never translate them (see the naming-conventions bullet above). The route folders are `[type]/[category]/[slug]` (English param keys); the article route redirects any stale/mismatched URL to the canonical path derived from the post's _current_ `type` + category slug. Article pages emit JSON-LD (`Article`) and Open Graph metadata.

**Caching (mixed ISR, `posts` tag).** Public reads go through the `unstable_cache` wrappers in `src/utilities/posts.ts` (`getCachedPublishedPosts`, `getCachedPostBySlug`), all tagged `posts`. The routes set `export const dynamicParams = true` and build `generateStaticParams` from `getVisiblePosts()`: known paths are statically generated, unknown ones render on demand, and everything stays cached until the `posts` tag is busted. `revalidatePostsListing()` (`src/utilities/documents.ts`) is `revalidateTag('posts')` (the listing tag is `` `${collection}s` `` → `posts`), so one call busts the home page, every listing route, and every article route at once.

**Self-revalidation on admin edits.** Both collections have an `afterChange` hook. `post` busts its own document tag + the `posts` listing on every publish/update (skipping only the initial draft that the admin create view generates during render). `tag` is broader: on change it re-reads every post referencing that tag (as `category` or in `tags`, passing `req` for transaction safety) and revalidates each one plus the listing — so flipping `hidden` is reflected on the site immediately.

**Seeding news content (`pnpm db:seed:posts`).** `scripts/seed-posts.mjs` (loaded via `scripts/seed-loader.mjs`) fetches ~43 articles live from jorgesolla.com.br (WordPress REST API, with an HTML-crawl fallback), imports them as `type: 'noticia'` published posts, converts the WP HTML body to Payload Lexical, and uploads cover images through the configured media storage (Garage S3 when the `S3_*` envs are set — the adapter overwrites the deterministic `<slug>.<ext>` key natively, no pre-delete needed; local disk otherwise). The taxonomy (categories + the `eleitoral` control tag, and the per-slug classification) is hardcoded in the script; it reads/writes the `hidden` flag. It is **idempotent by slug** (existing posts are skipped; tags/media are reused by slug/filename) and reuses the same non-local `DATABASE_URL` guard as `pnpm dev` (override only with `ALLOW_REMOTE_DB=true`). `pnpm db:seed:posts --dry-run` is the plan-only pre-flight (fetches, resolves covers, reports what WOULD be created — no writes). **Since OPS60, sync with the `S3_*` envs set also requires explicit bucket-write intent: `SEED_MEDIA_CONFIRM=1`** (fail-closed, same `isTruthyEnv` pattern as `MEDIA_RECOVER_CONFIRM`; without it the sync refuses with exit 1 before any write — the `S3_*` envs alone must never arm a bucket write, since a worktree with a prod-credentials copy running sync against a local DB would write covers to the prod bucket). `--dry-run` stays flag-free. The OPS58 runbook documents the production sync (post-merge, homeserver, stack env, dry-run → sync → bust `posts` cache → verify) — copy it for future syncs (see `docs/plans/ops58-sincronizar-posts-prod-impl.md`).

### Revalidating after a manual/direct DB change

Admin edits made through the deployed app self-revalidate via the `afterChange` hooks above. But any write that does **not** go through the deployed Payload runtime — direct SQL, `pnpm db:seed:posts`, a DB restore / `db:pull` — will **not** bust production's frozen `posts` cache. (Even when such a write triggers the hook, its `revalidateTag('posts')` runs in that CLI/local process and cannot touch the deployed server's cache.) The pages keep serving stale content until the tag is busted.

Bust it with the secured endpoint (`src/app/(frontend)/api/revalidate/route.ts`):

```bash
# News (`posts` tag — default)
curl -X POST "https://<prod-domain>/api/revalidate" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET"

# Privacy policy global after Onda 0 migration/seed (`global_privacy-policy`)
curl -X POST "https://<prod-domain>/api/revalidate?tag=global_privacy-policy" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET"
```

- **Auth:** send the secret via `x-revalidate-secret` or `Authorization: Bearer <secret>`; it is compared to `REVALIDATE_SECRET` with a constant-time check.
- `REVALIDATE_SECRET` must be set in the **production** env (and in your local env if you want to test the endpoint). It is documented in `.env.example`.
- **Tag:** optional `?tag=` query or JSON body `{ "tag": "..." }` (query wins). Allowlist: `posts` (default), `global_privacy-policy`, `election-tse` (bust after re-running `pnpm db:seed:tse` so the cached elections-tab reads refresh), `municipality-catalog` (bust after a migration/seed that adds or renames a município so chip indexes and `unstable_cache` loaders refresh), `social-feed` (bust after a direct-DB write to the `social-feed-settings` global — e.g. an admin-less seed of the YouTube/Instagram feed config; admin edits self-revalidate). Unknown tag → `400`.
- **Instagram sync status (S11):** the global's `instagramSyncStatus` jsonb (hidden) is written by the render path, by `afterChange` (re-sync only when IG credentials changed), and by the admin button `POST /api/social-feed/sync` (admin session via `payload.auth` + same-origin guard); the `InstagramSyncStatusPanel` ui field renders it. Runbook de credenciais: `docs/ops/instagram-feed-token-runbook.md`.
- **Responses:** `200 { revalidated: true, tag: '...' }` on success; `401` if the secret is missing/wrong; `500` if `REVALIDATE_SECRET` is not configured on the server.
- This POST is the required last step of the post-seed / direct-DB-change runbook.
