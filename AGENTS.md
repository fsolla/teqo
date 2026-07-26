# Payload CMS Development Rules

You are an expert Payload CMS developer. When working with Payload projects, follow these rules:

## Teqo Project Context (read this first)

Teqo is the digital platform for deputado federal Jorge Solla (PT-BA): public site + editorial CMS + an internal `/campanha` campaign-management area, all in this one Next.js + Payload app. Full architecture/decision doc lives outside this repo at `plano-arquitetura-campanha-2026.md` (Cowork workspace) — check it for the "why" behind decisions below.

**Locked decisions — do not relitigate without a new concrete reason:**

- Single Next.js app, three route groups: `(frontend)` public site, `(payload)` admin, `(campaign)` internal campaign tool. No separate Rust service or frontend app for `/campanha`; it is modeled with Payload collections. The campaign roles are `coordinator` (label "Coordenador Geral"), `advisor` ("Assessor"), `leader` ("Liderança"), and `candidate` ("Candidato", unrestricted visibility), all on the separate auth collection `campaignUser` (see "Campaign auth" below). An advisor sees and manages ONLY the municipalities they administer; a leader is locked down to the supporter contact tool.
- **2026-07-23 remodel (DEPLOYED to production 2026-07-23): "Município" is the operational unit** (it replaced "Praça", which replaced "Núcleo Eleitoral"). Municípios are PREDEFINED (seeded, geography read-only): 435 rows — one per Bahia municipality (416), except Salvador (19 zone Municípios, ZE 1–19); Camaçari is a single whole municipality (ZE 170/171 aggregated); shared/leaky TSE zones are cut at the municipal boundary. Code identifier: `municipality`. Leaderships are one record per person (`contact` UNIQUE) linked to N municipalities and N organizations; vote pledges are per leadership×municipality with `declaredVotes` (staff-entered, leader-visible) vs `estimatedVotes` (three scenarios, staff-only, hidden from the leader). Campaign production data was reset by the remodel migrations (public-site data untouched). Master plan: `docs/plans/remodelagem-municipios.md` (supersedes `remodelagem-pracas.md`). Details: "Campaign Municípios model" below.
- Hosting stays on Vercel for now. No self-host/Coolify migration in progress.
- Donations are NOT handled in this app — they run through QueroApoiar (`apoiar.me/jorgesolla`, TSE-homologated). The site only needs a "Doar" link/CTA out to that URL.

- **Embasamento de produto/domínio:** `docs/research/` guarda o compêndio de literatura (campanha de DF na Bahia, geografia do voto, cartografia eleitoral) e o relatório de discovery aprovado (2026-07-21) com o playbook dado→decisão. Para métricas, análises territoriais, mapa e priorização em `/campanha`, consulte-o antes de inventar — o kernel: a disputa de DF é conta de quociente fragmentada; leitura útil é relativa e local (captura, LQ, quantis, cobertura de meta por pledges), nunca % estadual absoluto.

**Real conventions already established in this codebase (follow these, not just the generic patterns below):**

- `Contact` is the normalized "person" record (name, email, phone, state/city via `src/lib/cities.ts`, CEP). Don't create a parallel "person" collection for new features (e.g. líderanças/apoiadores) — add a join collection that relates to `Contact`, the same way `Signature` and `Subscription` do.
- Every action that writes to more than one collection (see `src/app/(frontend)/actions/*.ts`) wraps the writes in a Payload transaction (`payload.db.beginTransaction/commitTransaction/rollbackTransaction`) and passes `req: { transactionID }` to every `payload.create`/`payload.update` call. Follow this pattern for any new multi-collection write.
- LGPD consent is tracked via a `Consent` collection (richText, versioned, optional stable `key`) referenced by relationship from `Signature`/`Subscription`/campaign `leadership`. New campaign opt-in flows resolve Consent by stable `key` (e.g. `lideranca-autopreenchimento`) and fail closed when missing — don't invent a parallel consent mechanism or hardcode document IDs for new work.
- Cache invalidation: collections/globals call `revalidateDocumentById` (`src/utilities/documents.ts`) / `revalidateGlobal` (`src/utilities/globals.ts`) in an `afterChange` hook. Add the same hook to any new collection/global that backs a public page. Collections whose listing is cached under a shared tag also call the listing helper (`revalidateCollectionListing`, e.g. `revalidatePostsListing()` → `revalidateTag('posts')`) — see "Posts & Tags" below.
- Admin UI is organized via `admin.group` (e.g. `'Abaixo-assinados'`, `'Contatos'`, `'Configurações'`, `'Paginas'`, `'Campanha'`, `'Dados Eleitorais'`) — group new collections consistently instead of leaving them ungrouped.
- i18n: Payload admin defaults to `pt` (not `pt-BR` — see `payload.config.ts`, `payload/i18n/pt`).
- Language & naming conventions: ALL code identifiers are in English — variable, function, parameter, type/interface names, local constants, and Next.js dynamic route segment folder names used as param keys (e.g. `[type]/[category]/[slug]`, not `[tipo]/[categoria]`). Portuguese is allowed ONLY in: user-visible string literals (JSX text, button/labels), image `alt` text, SEO/metadata values (title/description/keywords), Payload admin config text (`labels`/`singular`/`plural`/`admin.description`/field `label`), and intentional URL slug/enum VALUES kept in Portuguese for SEO (e.g. the `post.type` enum values `noticia|campanha|artigo|evento`, tag/category slugs like `saude`, `eleitoral`). Never translate those data/URL values or admin labels. Renaming a route segment folder changes only the param KEY, never the public URL (segment values come from the data).

**Database & local development (safety-critical — production is a live Neon Postgres with real citizens' PII):**

- Local dev and tests must NEVER touch production. Local dev runs against a local Docker Postgres (`pnpm db:start`); `pnpm dev` refuses a non-local `DATABASE_URL` (guard: `scripts/guard-dev-db.mjs`) unless `ALLOW_REMOTE_DB=true`. Tests load `.env.test` (`teqo_test`) and refuse any database whose name doesn't end in `_test` (`tests/helpers/assertTestDatabase.ts`). Never repoint `.env`/`.env.local`/`.env.test` `DATABASE_URL` at Neon. Full workflow lives in the `local-database` skill (`.cursor/skills/local-database`).
- Schema changes go through committed Payload migrations — `push: false` everywhere, never flip it on against a remote DB. Edit configs → `pnpm migrate:create <name>` → commit `src/migrations/*` (both `.ts` and `.json`, plus `index.ts`) → `pnpm migrate` locally. `pnpm build` runs `payload migrate`, so **every Vercel deploy applies pending migrations to prod**. Prod is baselined at migration `20260715_163458_initial` — never regenerate or replace the initial migration. Full workflow (incl. hand-written data/reconciliation migrations) lives in the `payload-migrations` skill (`.cursor/skills/payload-migrations`).
- `Consent.text` was reconciled from `varchar` to `jsonb` via `20260715_163500_consent_text_to_jsonb` (matching the `richText` field). Any future field-type change is a migration, not a manual DB edit.
- To copy production content locally, use `pnpm db:pull` (`scripts/db-pull.mjs`): it only reads prod, only writes local, and excludes supporter PII (`contact`/`signature`/`subscription` row data).
- `pnpm db:doctor` diagnoses local database connectivity for the dev AND test targets: it names who holds the port, points at exited/crash-looping containers, and flags Postgres containers sharing one data volume (two postmasters on one PGDATA corrupt the WAL — this destroyed the local cluster's checkpoint on 2026-07-25; the canonical setup is ONE compose container on 5432 hosting `teqo` + `teqo_test`). `pnpm dev` runs the same preflight via `guard-dev-db` and refuses to start with a named remedy instead of a later ECONNREFUSED.
- To (re)populate news content, `pnpm db:seed:posts` fetches articles live from jorgesolla.com.br into the LOCAL db (same non-local `DATABASE_URL` guard as `pnpm dev`). It writes from a CLI process outside the deployed runtime, so after seeding — or after ANY direct-DB change — you must bust the production `posts` cache via `POST /api/revalidate`. See "Posts & Tags" below.
- To (re)populate the TSE 2022 election baseline, `pnpm db:seed:tse` downloads TSE open data and imports the Bahia scope into the LOCAL db (same guard). Since the 2026-07-23 hardening, elections-tab reads are cached under the `election-tse` tag — after re-seeding a database the deployed app reads, bust it via `POST /api/revalidate?tag=election-tse`. See "Election baseline data (TSE 2022)" below.

## Known Gaps (as of 2026-07-24 — resolve before relying on this file for onboarding new devs)

Backlog consolidado (bloqueadores, site, campanha, white-label): [`docs/roadmap.md`](docs/roadmap.md).

1. **Payload admin roles are still absent (access lockdown shipped 2026-07-23).** Every collection now declares explicit `access` — `users`, `signature`, `subscription`, `consent` are Payload-admin-only, and CMS writes (`post`/`tag`/`media`/`petition`) are admin-only — so campaign JWTs can no longer act on them via `/api`. But the `users` collection still has no `roles` field: every admin user remains omnipotent inside `/admin`. Add admin roles (schema migration) before opening `/admin` to a broader team.
2. **RESOLVED 2026-07-25 (Pass 2 D3):** the last hardcoded consent document id is gone — `submitWhatsapp.ts` now resolves `Consent.key = 'whatsapp-inscricao'` fail-closed (migration `20260725_170000_whatsapp_subscription_consent_key` tags the live document; keys live in `src/lib/campaignConsentKeys.ts`).
3. **`Post`/`Tag` ship the news system, but there is still no `Pages` collection for institutional content.** Partly resolved: the `post`/`tag` collections back the news/publications system, and the home "Últimas notícias" list plus the `/[type]`, `/[type]/[category]`, and article routes are live (see "Posts & Tags" below). Still hardcoded/pending: the home hero heading + subtitle copy (`HomePage` global still exposes only a single `image` field — the text lives in `src/app/(frontend)/(home)/page.tsx`), and there is no `Pages` collection yet for institutional content such as the bio and propostas.
4. **Campaign LGPD consent texts are not yet configured in production.** Invites and self-service leadership flows fail closed until an admin creates `Consent.key = 'lideranca-autopreenchimento'` with counsel-approved copy. The C2 supporter registry (merged to `main`, production-blocked) additionally requires `Consent.key = 'apoiador-cadastro'` and `Consent.key = 'apoiador-intencao-voto'` (vote intention is sensitive data) — same fail-closed behavior. All four keys are bundled in the single legal batch of Onda 0 (see deploy checklist).

**Recently resolved (2026-07-18):** the `/campanha` nuclei MVP shipped (auth/RBAC, nuclei, leaderships, vote estimates, updates, WhatsApp invites, dashboard) with consolidated migration `20260718_010733_consolidate_campaign_schema`. Later the same day, cycle 2 was merged and deployed: multi-municipality/neighborhood territory arrays (migration `20260718_190559_territorio_multi_municipio_bairro`), TSE 2022 election baseline collections + `pnpm db:seed:tse` (migration `20260718_195854_add_election_results`), the filtered nuclei-list overview panel, the nucleus share dialog, and the installable `/campanha` PWA. Still on 2026-07-18, **A2** shipped: static Bahia municipality↔TSE zone map (`src/lib/bahiaTseZones.ts` from TSE 2024 `detalhe_votacao_munzona` BA) plus opt-in territory/zone suggestion chips in the nucleus form (`territorySuggestions`, `NucleusTerritoryAndZonesFields`) — no migration, no forced equality on save. Also the same day: **C2** Cadastro nominal de apoiadores (`supporter` join `Contact`↔campanha with optional `nucleus`, migration `20260718_222656_add_supporter` with `UNIQUE NULLS NOT DISTINCT (contact_id, nucleus_id)`, consent keys `apoiador-cadastro` / `apoiador-intencao-voto` resolved via a generalized `campaignConsent.ts` that fails closed, `/campanha/apoiadores` vertical with list+KPIs/detail/CSV-import wizard; phone required in v1, `lideranca` has no access to the area; production use with real data still waits on Consent keys + legal sign-off). Also the same day: C3 Planos de Ação (`actionPlan` + `/campanha/planos`, migration `20260718_222832_add_action_plan`, blocos "Próximos eventos") — **renamed to `activity` / `/campanha/atividades` by C13 on 2026-07-25**; the old names survive only in frozen migration history. Also the same day: **B2** map foundation — static TopoJSON for Bahia municipalities + identity territories, `bahiaMunicipalityCodes`, helpers in `bahiaGeometries`, re-runnable `pnpm build:geometries` (no migration, no UI; Leaflet is B3). Post-`/simplify` scale follow-ups for that delivery are registered as **B5** (`docs/plans/escala-dry-pos-b2.md`). Earlier (2026-07-15): local Postgres via `docker-compose.yml` (Postgres 17, `teqo_test`); Payload migrations baselined; dev/test database guards; `post`/`tag` news routes deployed (see "Posts & Tags" below).

**Recently resolved (2026-07-18 evening / 2026-07-19):** **A4** Baseline no produto + Gap vs 2022 shipped and merged to `main` — `getNucleusElectoralBaseline` / `loadNucleusBaseline2022Overview` aggregate TSE 2022 by nucleus geography; `computeGapVs2022` + `NucleusInsights` on the overview tab; `NucleusElectoralBaseline` card (candidate / president / governor via `BASELINE_TICKET_2022`); "Baseline 2022" card on the filtered nuclei-list overview. No migration (reads existing A3 collections). A `/simplify` pass applied targeted cleanup (role-generic ticket config, per-city `zoneNumber in […]`, shared geography helpers). Scale/DRY debits larger than cleanup (aggregate federal ranking on detail instead of loading all nominal rows, filter by TSE `cityCode`, Alert `confirmed` + `Progress` reuse) are registered as **A7** (`docs/plans/escala-dry-pos-a4.md`).

**Recently resolved (2026-07-19):** **C6** Escala e DRY pós-C2 shipped and merged to `main` — bulk supporter import via `payload.db.drizzle` inside the existing Payload transaction (`supporterImportBulk.ts`, `ON CONFLICT DO NOTHING` on `(contact_id, nucleus_id)`, 500-row chunks), `skipContactPhoneInvariant` opt-in on `Contact.enforceUniqueContactPhone` (fail-closed: only honored inside an active `req.transactionID`), single-SQL KPI aggregate (`supporterListOverviewAggregate.ts`, `COUNT(*) FILTER` mirroring `buildSupporterListWhere` + access constraint), HMAC-SHA256 single-use import token + ephemeral `supporterImportBatch` staging collection (migration `20260719_011015_add_supporter_import_batch`, TTL 10 min, actor-bound, consumed on confirm), and shared shells (`campaignListUrl.ts`, `CampaignListPagination`, `campaignFormFields.ts`, `mapCampaignFormActionError.ts`) replacing the three per-list pagination components. A `/simplify` pass applied targeted cleanup (identity maps, dead branches, `relationshipId`/`canManageCampaignUsers` reuse, native `base64url`, `rowCount ?? 0` bug fix). Scale/DRY debits the simplify reviewers flagged as larger than cleanup (locks in 1 round-trip, `.returning()`, `pg_trgm`, shared `drizzleBulk.ts`, column-name assertion, migrating the remaining `formActions`) are registered as **C8** (`docs/plans/escala-dry-pos-c6.md`). Production use with real supporter data still waits on the Onda 0 legal batch (Consent keys `apoiador-cadastro` / `apoiador-intencao-voto`).

**Recently resolved (2026-07-21):** **B6** `BahiaMap` setStyle incremental — layer GeoJSON estável entre troca de ano/métrica/escala; `pathByKeyRef` + restyle O(2) no hover/select; `fitBounds` só em `mode`/`highlightKeys`; helpers em `src/lib/bahiaMapStyle.ts`. Fecha débitos de perf de B10/B11. Plano: `docs/plans/escala-dry-pos-b3.md`.

**Recently resolved (2026-07-21):** **B11** Escala % dos válidos no Mapa das Praças — `validVotesByYear` in `MunicipalityMapBundle`, `scaleMode` selector (`absolute` | `percentValid`, default %), `computeValidVoteShares`, readout em % com votos absolutos secundários; `/simplify` fix `scaleMax` (legenda 0–100% alinhada ao fill). Plano: `docs/plans/escala-percentual-mapa-pracas.md`.

**Recently resolved (2026-07-21):** **B12** Aproximar mapa ao footprint filtrado + correção hover — `fitToKeys` / `interactiveKeys` em `BahiaMap` (`municipalitiesByIbgeCode`); `canonicalMapKeysKey`; hover stroke-only; clear síncrono no mouseout; fit só quando footprint muda. Plano: `docs/plans/aproximar-mapa-pracas.md`.

**Recently resolved (2026-07-21):** **Discovery "Inteligência de campanha"** — ciclo literatura→persona→entrevista sintética aprovado. Embasamento canônico de produto/domínio em **`docs/research/`** (compêndio de ~67 fontes sobre campanha de DF na Bahia; relatório com kernel, playbook de 25 padrões dado→decisão, anti-goals): agentes devem consultá-lo antes de propor métricas/análises territoriais novas. Programa registrado no roadmap: **E8–E16 + B13 + C12** (+ adjacentes A11/E17; sessão real com o CG em 2026-07-23 validou/calibrou o programa — `docs/CUSTOMER.md`; plano-mestre `docs/plans/inteligencia-campanha.md`) — conta da cadeira (metas derivadas sobre válidos projetados), fila de alocação, registro-fundação (versions em `votePledge`, sinais tipados, `allocationDecision`), classificação relativa (substitui limiares 35/20/10 p/ DF), escala relativa no mapa (quantis/LQ/rank + símbolo proporcional), níveis N0–N4 staff-only, motor de sugestões com humano no loop, camada TI (salvaguardas MAUP), planejador de giros, backtest pós-eleição. Anti-metas travadas: % estadual absoluto como KPI, contagem bruta de cadastros, cartograma, "caça ao alienado", sugestão automática sem decisão humana.

**Recently resolved (2026-07-23):** **Export CSV de assinaturas e contatos** no admin Payload — `@payloadcms/plugin-import-export@3.82.0` habilitado em `signature` e `contact` (`import: false`, export CSV síncrono); flatten de `contact`/`petition` via `toCSV` em [`src/utilities/signatureExport.ts`](src/utilities/signatureExport.ts) (só assinaturas); `consent` excluído do export de assinaturas; collections `exports`/`imports` com access `isPayloadAdmin`; migration `20260723_025513_add_import_export_plugin`. Plano: [`docs/plans/exportar-csv-assinaturas.md`](docs/plans/exportar-csv-assinaturas.md).

**Recently resolved (2026-07-23):** **Engineering-standards hardening** (tracker: [`docs/IMPROVE-CODE-QUALITY-PLAN.md`](docs/IMPROVE-CODE-QUALITY-PLAN.md); ledger: [`docs/TECH-DEBT.md`](docs/TECH-DEBT.md); safety net: [`docs/TESTING.md`](docs/TESTING.md); standards rule: `.cursor/rules/engineering-standards.mdc` — READ IT before coding). Phases: (0) explicit `access` on every collection — `users`/`signature`/`subscription`/`consent` admin-only, CMS writes admin-only, leader route gates on `demandas*`/`planos*`, `createLeaderSupporter` scope fixed, `candidate` treated as unrestricted staff consistently; (1) tooling gate — knip in CI (`.github/workflows/ci.yml` on the GitHub mirror), `pnpm lint --max-warnings=0`, `as never` banned (typed helpers `hookFilledCreateData` / tests' `stub<T>`), tsconfig include consolidated + `noUnusedLocals`, ~12 dead modules deleted; (2) caching — committed TSE aggregate artifact (`pnpm build:election-aggregates` → `src/lib/electionAggregates/`, loader `bahiaElectionAggregates.ts`), `loadMunicipalityScope` React `cache()` dedup, `unstable_cache` + `election-tse` tag on elections-tab loaders; (3) "Feel the action" gaps closed — task-toggle revalidation bug, shared `CampaignListPendingBoundary` dimming results, map-compare transition, dashboard map + detail tabs stream behind Suspense; (4) state scoping — map hover isolated in `MunicipalityMapSelection`, scenario provider narrowed, `LeaderContactsPanel` server-rendered with a client form island; (5) structure — `campaignAccess` split into `src/utilities/access/*` (re-exported), supporter actions split (`supporterImport.ts`), `runStaffEntityMutation` + `runCampaignRedirectFormAction` dedupe the org/dobradinha twins and 4 formActions ladders, Plaza→Municipality identifier rename finished.

**Recently resolved (2026-07-24):** **A11** Posição em votos do município — rank denso sobre as 435 unidades do catálogo + **% da própria votação** estadual (artefato `bahiaElectionAggregates`); helper `src/lib/municipalityVoteRank.ts`; UI no `MunicipalityBaselineCard` (por ano) e coluna/ordenação `?sort=votos` na lista (`sort`/`dir` mínimo `name`|`votos`; B15 amplia as demais keys). Plano: [`docs/plans/ranking-votos-municipio.md`](docs/plans/ranking-votos-municipio.md).

**Recently resolved (2026-07-24):** **E4R** Import único da planilha de projeção — `pnpm db:seed:projecao` (`scripts/import-projecao.mjs`) lê o xlsx canônico em `docs/sheets/`, faz match via `canonicalizeMunicipalityName` + `municipalityCatalog`, e **sempre sobrescreve** `municipality.expectedVotes` + `priority` (re-seed quando a mesa manda planilha nova); Salvador pulado; `--dry-run` + guard `ALLOW_REMOTE_DB`; parser puro em `src/lib/projectionSheetParse.ts` (Bom→`optimistic`, Regular→`central`, Mínimo→`pessimistic`). **Fase 2 (mesmo dia, decisão do produto — não é mais zero PII):** o seed também importa as colunas de estratégia, com PRIORITÁRIAS sobrepondo MAPA GERAL quando não-vazia — SITUAÇÃO→`politicalTrend` (QUEDA/MANTÉM/AUMENTO→desfavorável/neutra/favorável, com nota de proveniência), DOBRADINHAS→`stateDeputy`+`stateDeputies` (união; célula crua em `dobradinhaNotes`), LIDERANÇAS→`contact` name-only **sem telefone** + `leadership` (dedup estadual por slug do nome; `Contact.phone` virou opcional via migration `20260724_175500_contact_phone_optional`, UI continua exigindo), ASSESSOR RESPONSÁVEL→`campaignUser`+`advisors` (união; Edizio=coordinator, Solla=candidate — `candidate` agora é elegível como assessor em `eligibleCampaignStaffWhere`; novos usuários com email `<slug>@planilha.invalid` + senha aleatória, sem login até um admin trocar), ENCAMINHAMENTOS→`nextSteps`, OBSERVAÇÃO→`strengths`/`risks` (classificação curada por slug). Relações são união (nunca removem vínculos da UI); re-run idempotente; nomes de atores políticos entraram sem trilha de consentimento — regularizar com a assessoria jurídica. No mesmo dia, o grupo duplicado `municipality.voteGoals` ("Meta Bom/Regular/Mínimo") foi **removido** — collection, zod, view models, form/card e utilitário `voteGoals.ts` — via migration `20260724_133600_drop_municipality_vote_goals` (backfill metas→estimativas onde a estimativa estava vazia): `expectedVotes` (pessimista/média/otimista) é a única série por cenário do município. Plano: [`docs/plans/import-planilha-projecao.md`](docs/plans/import-planilha-projecao.md).

**Recently resolved (2026-07-25):** **B21 Página dos Territórios de Identidade** — nova rota staff-only `/campanha/territorios` com os 27 TIs no sistema de listas: sort/filtros/busca canônicos na URL, Metropolitano decomposto em sub-linhas, primeira coluna sticky no mobile e linha → `/campanha/municipios?region=<TI>`. O chrome rico agora é compartilhado por `CampaignSortableHead`/`CampaignHeaderFilterPopover`; wrappers de municípios mantêm a política de domínio. O painel de TI e `territorySlot` foram removidos do Início. Sem migration/collection/action. Plano: [`docs/plans/pagina-territorios-identidade.md`](docs/plans/pagina-territorios-identidade.md).

**Recently resolved (2026-07-25): Engineering Consolidation Pass 2** (tracker: [`docs/IMPROVE-CODE-QUALITY-PLAN.md`](docs/IMPROVE-CODE-QUALITY-PLAN.md) § Pass 2; architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); agent map: `.cursor/rules/codebase-map.mdc`). Highlights: **W1 sistema de listas** — colunas como dado em `CampaignTable` (seams B17/B18), URL state compartilhado (`campaignListUrl` + módulos por domínio; o god module `municipalityUi.ts` virou `municipalityListUrl`/`municipalityListFilters`/`municipalityLabels`/`municipalitySignal`), shells (`CampaignListFooter`, `CampaignListEmptyState`), 8 superfícies migradas (municípios, lideranças, organizações, dobradinhas, demandas, apoiadores, assessores, atividades-shells), B16+ absorvido (`useOptimistic`, hrefs por serializador canônico, facet por slugs, facets no mesmo `Promise.all`); **W2** — fronteiras: `slug`/`phone`/`wordStartFilter`/`voteEstimate` movidos para `lib/`, 21 loaders `server-only`, `campaignRoles.ts` client-safe (sidebar sem o barrel de access), `votePledgeViews` (contract) vs `votePledgeData` (loaders), ciclo supporter quebrado, `components/campaign` em 15 subpastas de domínio; decisão D1: sem `src/domains/`, sem ports-and-adapters; **W4a** — `electionInsights.ts` (941 linhas, 2 exports vivos) deletado; sobreviventes em `electionFormat.ts`/`voteTrend.ts`; E10 nasce limpo; **W4b** — knip `exports`/`types`/`enumMembers` em **ERROR** no CI (0 findings; kit ui sem peças mortas); **W4c** — tabs das páginas de detalhe extraídas (`MunicipalityDetailTabs`, `ActivityOverviewTab`) + factory `detailTabUi`; **W4d** — `runCampaignFormAction` fecha o C8 F4 (13 ações em 7 arquivos; exceções documentadas); **W4e** — tipos de fonte única; **W4f** — copy "Praça"→"Município" varrida (apoiadores desambiguado: cidade do contato = "Cidade"); **D3** — consent do WhatsApp por chave estável (`whatsapp-inscricao`, fail-closed). Suites: 46 unit / 48 int / 7 e2e.

**Recently resolved (2026-07-25):** **C13** "Plano de Ação" → "Atividade" — the vertical speaks one word now, the one the mesa already uses. Collection `actionPlan` → `activity` (`src/collections/Activity.ts`, labels "Atividade"/"Atividades"), `campaignDemand.actionPlan` → `activity`, route `/campanha/planos` → `/campanha/atividades` (create at `/campanha/atividades/nova`), sidebar entry "Atividades", and field labels realigned to the entity ("Tipo de atividade", "Origem da atividade", "Resultado da atividade") — enum **values** (`kind`/`status`/`origin`) are unchanged. Schema moved by a **hand-written data-preserving migration** (`20260725_213000_rename_action_plan_to_activity`): 4 tables, 3 enums, 2 columns, 39 indexes (4 pkeys included — renaming a pkey index renames its constraint), 14 FKs and 2 sequences, every statement guarded on the source object existing so environments converge either way, with a symmetric `down()`. Payload's generator would have emitted DROP+CREATE (data loss) and cannot see the hand-written partial index `action_plan_upcoming_start_at_idx`, so the object list came from `pg_indexes`/`pg_constraint`/`pg_type`/`pg_sequences` and the `.json` snapshot was written by transforming its predecessor — validated by `pnpm migrate:create __probe` reporting no schema changes. The same migration aligned the **8 fossil `%plaza%` index names** the Município remodel left behind (it renamed the `plaza_id` columns but not their indexes, so the database and the snapshot had been disagreeing since 2026-07-23). Guard: the `codebaseConventions.unit.spec.ts` "banned campaign terminology" describe is now table-driven and sweeps `src` + `tests` + `scripts` (migrations stay out — frozen history), banning the `actionPlan` compounds, the pt-BR copy and the old route, but **not** bare `plan`/`plano` (that would collide with the white-label subscription plans of Fase 2); allowlist covers the spec itself, `scripts/generate-remodel-municipalities-migration.mjs` and the historical comment in `campaignMigrationReconciliation.int.spec.ts`. Plano: [`docs/plans/renomear-plano-acao-para-atividade.md`](docs/plans/renomear-plano-acao-para-atividade.md).

**Recently resolved (2026-07-25):** **E16** Dossiê do município (pré-agenda, field request O6) — staff-only `dossie` tab on the municipality detail page (6th value in `municipalityDetailTabs`, same query-param pattern): `src/utilities/municipalityDossierData.ts` composes the existing loaders in one pass (TSE baseline + A11 rank via `municipalityElectionGeographyForSlug`, E8 goal account, pledges, leaderships sorted by a new `LeadershipRowViewModel.updatedAt` freshness field, updates feed, two scoped `actionPlan` reads with `overrideAccess: false`, and A8 demographics — the previously consumer-less `bahiaMunicipalityDemographics.ts` re-enters through the "Perfil" section, with an explicit whole-city caveat for Salvador zona municipalities). Section caps 8 lideranças / 5 sinais / 3 upcoming + 2 realizado plans, each with a "ver tudo" link to its tab. New staff-only `municipality.budgetNotes` textarea ("Emendas aportadas", G11 manual-first) via migration `20260725_022155_add_municipality_budget_notes` — its committed `.json` snapshot also heals the drizzle snapshot chain after the snapshot-less `campaign_goals` migration; strategy form/zod/action extended; the section renders only when filled. **Print view is CSS-only:** app chrome gets `print:hidden`, the `h-svh`/`overflow-hidden` shells get `print:h-auto print:overflow-visible` (otherwise only page 1 prints), and `styles.css` gains A4 print typography; the dossier cover is self-contained (name, TI, badges, "Gerado em") so the printed page keeps its identity. Int test mocks `loadMunicipalityElectoralBaseline` (its `unstable_cache` wrapper needs the Next runtime). Plano: [`docs/plans/dossie-municipio.md`](docs/plans/dossie-municipio.md).

**Recently resolved (2026-07-24):** **E8** Conta da cadeira (metas derivadas, potencial por município, cobertura) — committed TSE artifact extended to v2 (`pnpm build:election-aggregates` now writes `campoFederalVotesByYear`, `federalTallyByYear`, and 2022 `majoritarian2022` presidente/governador T1 per municipality, alongside the existing `votesByYear`/`validVotesByYear`; byte budget raised 400→700 KB in the unit test); `src/lib/campoParties.ts` (curated field-party siglas per election year, unit-tested against `electionPartySpectrum.ts`'s `esquerda` bucket — not a second party classifier); global `campaignGoals` (`src/globals/CampaignGoals.ts`, migration `20260724_180000_add_campaign_goals_global`, `stateGoal` default 150,000 + `margin`/`baseYear`/`note`, `read` = admin/staff, `update` = admin/`isCampaignUnrestricted`, **no** `afterChange` hook — `/campanha` is dynamic with auth so nothing caches it); pure derived utilities `src/utilities/municipalityPotential.ts` (projected valid votes, field ceiling, capture rate, intra-field share, 2022-only roll-off, per-scenario suggested goal + TI sanity check) and `src/utilities/goalCoverage.ts` — **locked semantics:** `meta = expectedVotes[scenario] ?? suggestedGoal[scenario]`, `comprometido = aggregate.effectiveByScenario[scenario]` (pledges only — the mesa's own expectation never substitutes for the pledge sum in the coverage denominator, unlike `resolveMunicipalityStaffVoteTotal`); orchestration in `src/utilities/municipalityGoalAccount.ts` (`cache()`-deduplicated across dashboard/list/detail). UI (Impeccable class B): "Cobertura da meta" row on the dashboard and the list overview `CampaignMetricStrip`, a new list column (renaming the old "Cobertura" column to "Assessoria" to remove ambiguity) via a shared `MunicipalityListGoalCoverageCell` (compact/default layouts), and a new "Conta da cadeira" card on the municipality detail page (fixed to the `central` scenario, replacing the "Votos estimados" block that used to live in `MunicipalityStrategyCard`). Unblocks roadmap items **E9/E10/E12/E13**. Plano: [`docs/plans/conta-da-cadeira.md`](docs/plans/conta-da-cadeira.md). **As-built correction (same day, during E9):** the suggested goal originally split the state goal proportionally to the field ceiling alone, which ignored the candidate's own vote and produced absurd targets (2,911 for Vitória da Conquista, which gave him 5,005 votes in 2022; 813 for Campo Formoso, which gave him 47). `decomposeStateGoal` was deleted in favour of `deriveSuggestedGoalsByScenario`, anchored on the municipality's own 2022 vote — pessimistic = base × (1 − `margin`), central = base, optimistic = base × (`stateGoal` ÷ Σ base), clamped at `max(central, optimistic)` — so `stateGoal` now defines the optimistic scenario and `margin` the pessimistic haircut (10% fallback). Descriptions only, **no migration**.

**Recently resolved (2026-07-24):** **E9** Fila de alocação — the municipality list became the allocation queue, with **no new route, no new column and no migration** (the column picker is B17 and is not shipped, so every new signal folds into an existing cell). Ordering: two new sort keys in `municipalityUi.ts` — `deficit` (**the new staff default**, descending) and `frescor` — both derived in memory in `applyDerivedMunicipalitySort` over the already-loaded bundle, fixed to the `central` scenario server-side (moving the scenario into the URL is the "Cenário junto aos filtros" fill-in). Freshness: `aggregatePledgesByMunicipality` now selects `declaredAt`/`estimatedAt` and exposes `lastPledgeAt`; `resolveMunicipalityLastSignalAt` (max of `municipality.lastUpdateAt` and `lastPledgeAt`) feeds both the comparator and the view model's `lastSignalAt`, so server ordering and rendered copy cannot drift; cold threshold `MUNICIPALITY_COLD_SIGNAL_DAYS` = 21. UI: "há N dias" in the existing "Última atualização" column (amber `text-estimate-pending-foreground`, deliberately not `destructive` — the priority and "sem responsável" badges already compete for red on the same row), a "sem responsável" badge when `priority === 'alta'` with zero advisors, the "coluna da vergonha" as the advisor-coverage metric's detail linking `?priority=alta&coverage=sem_assessor`, a scenario-named coverage tooltip, and the leftover "Praças" copy fixed to "Municípios". Cut and re-homed: votes at stake → **B13**, LQ/capture → **E10**, a dedicated deficit column → unnecessary (the E8 cell already shows % and signed deficit). Plano: [`docs/plans/fila-de-alocacao.md`](docs/plans/fila-de-alocacao.md).

**Recently resolved (2026-07-24):** **E18** Documentação dos conceitos de inteligência — staff-only route `/campanha/conceitos` (`isCampaignStaff`; `leader` redirected to `/campanha`) rendering `src/lib/campaignIntelligenceConcepts.ts`. The glossary is **curated content in code, not a Payload collection**: each entry (what it measures, the formula in plain text, a hand-written example, why it matters, where it appears) sits next to the formulas it documents (`municipalityPotential.ts` / `goalCoverage.ts`) and is reviewed in the same PR that changes them; a unit test guards anchor-safe unique IDs and content completeness. Seven E8 concepts in three groups — base do cálculo (válidos projetados, teto do campo), diagnóstico (captura, share intracampo, roll-off), meta e cobertura (meta/meta sugerida, cobertura da meta). Reading surface, not cards: one `article` per concept with hairline dividers, `max-w-prose` column, sticky index at `lg` only, `article:target` tint so anchor arrivals land oriented. Two discovery paths from `MunicipalityGoalAccountCard`: per-metric "Saiba mais" links inside the hover tooltips (`MetricExplanation` takes a `conceptID`) and a whole-page link in the title `CampaignInfoHint` **Popover** — the Popover is the keyboard path because Radix Tooltip content is not tabbable; for touch, `MunicipalityHoverTooltip` now treats its own content as "inside" in the `pointerdown` dismiss handler (the link used to unmount before the tap landed). Sidebar entry lives in `staffSecondaryNav` (`nav.ts`) rendered in its own `SidebarGroup` with `mt-auto` at the foot of the navigation — deliberately outside `staffNav` (the seven work destinations) and outside the mobile bottom bar, since it is reference material; `getCampaignSecondaryNav` returns nothing for `leader`. Fixed an E8 defect found while writing the docs: `formatElectionNumber` rendered a fractional suggested goal as "100,968" (read as a hundred thousand in pt-BR) — now `maximumFractionDigits: 0`. No migration, no collection, no server action; later slices of the intelligence program (E9/E10/B13/E11/E12/E13/E14) each append their section to the array. Plano: [`docs/plans/documentacao-conceitos-campanha.md`](docs/plans/documentacao-conceitos-campanha.md).

**Recently resolved (2026-07-24):** **B19** Gerenciar assessores — `/campanha/assessores` (lista + novo + detalhe) for coordinator/candidate only (`isCampaignUnrestricted`); create/edit `advisor` accounts, municipality portfolio (per-municipality auto-save + advisory lock), password-reset email (blocks `@planilha.invalid`); aligned `canUpdateCampaignUser` / phone field access / `canAssignMunicipalityAdvisors` / `assignMunicipalityAdvisorsRecord` to unrestricted; privileged email read in `advisorData` loaders after the route gate; `reloadUnrestrictedActor`. No migration. Plano: [`docs/plans/gerenciar-assessores.md`](docs/plans/gerenciar-assessores.md).

**Recently resolved (2026-07-23):** **A10** Cenários de estimativa (pessimista/média/otimista) — `votePledge.estimatedVotes` e `municipality.expectedVotes` viram groups (`pessimistic|central|optimistic`); migration `20260723_124200_add_vote_estimate_scenarios` (backfill scalar→`central`); agregação por cenário em `votePledgeData` com default `central`; mapa 2026 com `values2026ByScenario` + seletor local; lista/overview/dashboard com média + faixa secundária; liderança continua com um `declaredVotes` sem ver estimativas. Plano: [`docs/plans/cenarios-estimativa-votos.md`](docs/plans/cenarios-estimativa-votos.md). Desbloqueia **E8**.

## Posts & Tags (news / publications)

The public news/publications system is backed by two collections (both in the `Publicações` admin group) plus the helpers in `src/utilities/posts.ts`.

- **`post`** (`src/collections/Post.ts`) — fields: `title`, `slug` (unique, indexed, auto-slugified from `title` when left empty), `type` (select enum `noticia|campanha|artigo|evento`), `category` (required single relationship → `tag`), `tags` (`hasMany` relationship → `tag`), `subtitle`, `coverImage` (upload → `media`), `publishedDate`, `body` (richText). Has drafts/versions (`schedulePublish`, `maxPerDoc: 5`).
- **`tag`** (`src/collections/Tag.ts`) — fields: `name`, `slug` (unique, indexed, auto-slugified from `name`), and `hidden` (checkbox, admin label "Esconder", default `false`). Tags are the shared taxonomy for both `post.category` and `post.tags`.

**Tags are a taxonomy, not a person record.** The `Contact` convention above applies to _people_; `tag` is publication metadata (categories + a visibility control flag), so post/tag relations do not touch `Contact`. Don't fold taxonomy into `Contact` or vice-versa.

**Electoral visibility control (`hidden` + fail-closed `isPostVisible`).** Marking a tag `hidden` hides every post that references it — as `category` or in `tags` — with a single toggle. This exists so campaign / pre-candidacy content (tagged `eleitoral`) can be pulled from the public site during the electoral period. `isPostVisible(post)` (`src/utilities/posts.ts`) returns true only when the post is `published` AND none of its related tags (`category` + `tags`) is `hidden`. It **fails closed**: an unpopulated relation (a bare numeric id) is treated as hiding, so callers must fetch with `depth >= 1`. Every public read filters through `getVisiblePosts()`, which applies this predicate to the cached published list.

**URLs and Portuguese SEO values.** The canonical article path is `/[type]/[category]/[slug]` (e.g. `/noticia/saude/<slug>`), with `/[type]` and `/[type]/[category]` listing routes and the home "Últimas notícias" list. The `type` enum values (`noticia|campanha|artigo|evento`) and tag/category slugs (`saude`, `eleitoral`, …) are deliberately Portuguese for SEO and are **data, not identifiers** — never translate them (see the naming-conventions bullet above). The route folders are `[type]/[category]/[slug]` (English param keys); the article route redirects any stale/mismatched URL to the canonical path derived from the post's _current_ `type` + category slug. Article pages emit JSON-LD (`Article`) and Open Graph metadata.

**Caching (mixed ISR, `posts` tag).** Public reads go through the `unstable_cache` wrappers in `src/utilities/posts.ts` (`getCachedPublishedPosts`, `getCachedPostBySlug`), all tagged `posts`. The routes set `export const dynamicParams = true` and build `generateStaticParams` from `getVisiblePosts()`: known paths are statically generated, unknown ones render on demand, and everything stays cached until the `posts` tag is busted. `revalidatePostsListing()` (`src/utilities/documents.ts`) is `revalidateTag('posts')` (the listing tag is `` `${collection}s` `` → `posts`), so one call busts the home page, every listing route, and every article route at once.

**Self-revalidation on admin edits.** Both collections have an `afterChange` hook. `post` busts its own document tag + the `posts` listing on every publish/update (skipping only the initial draft that the admin create view generates during render). `tag` is broader: on change it re-reads every post referencing that tag (as `category` or in `tags`, passing `req` for transaction safety) and revalidates each one plus the listing — so flipping `hidden` is reflected on the site immediately.

**Seeding news content (`pnpm db:seed:posts`).** `scripts/seed-posts.mjs` (loaded via `scripts/seed-loader.mjs`) fetches ~39 articles live from jorgesolla.com.br (WordPress REST API, with an HTML-crawl fallback), imports them as `type: 'noticia'` published posts, converts the WP HTML body to Payload Lexical, and uploads cover images to Vercel Blob. The taxonomy (categories + the `eleitoral` control tag, and the per-slug classification) is hardcoded in the script; it reads/writes the `hidden` flag. It is **idempotent by slug** (existing posts are skipped; tags/media are reused by slug/filename) and reuses the same non-local `DATABASE_URL` guard as `pnpm dev` (override only with `ALLOW_REMOTE_DB=true`). The Vercel Blob store is shared across environments, so before uploading a cover it deletes any orphan blob left under the same deterministic `<slug>.<ext>` key, keeping the seed re-runnable.

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
- `REVALIDATE_SECRET` must be set in the Vercel **production** env (and in your local env if you want to test the endpoint). It is documented in `.env.example`.
- **Tag:** optional `?tag=` query or JSON body `{ "tag": "..." }` (query wins). Allowlist: `posts` (default), `global_privacy-policy`, `election-tse` (bust after re-running `pnpm db:seed:tse` so the cached elections-tab reads refresh). Unknown tag → `400`.
- **Responses:** `200 { revalidated: true, tag: '...' }` on success; `401` if the secret is missing/wrong; `500` if `REVALIDATE_SECRET` is not configured on the server.
- This POST is the required last step of the post-seed / direct-DB-change runbook.

## Campaign auth (`/campanha`)

The internal `/campanha` area is gated by its own authentication, deliberately kept **isolated from the Payload admin (`/admin`)** so a campaign session and an admin session can coexist in the same browser.

- **`campaignUser` collection** (`src/collections/CampaignUser.ts`) — a separate Payload auth collection with `name`, optional contact `phone`, and required `role`: `coordinator` ("Coordenador Geral"), `advisor` ("Assessor"), `candidate` ("Candidato"), or `leader` ("Liderança" — default and least privilege). Staff may sign in by email; leadership accounts use the normalized 11-digit phone as `username`. It is not `users`: `admin.user` remains `users`, so campaign users cannot log into `/admin`.
- **Isolated session cookie `campaign-token`.** The flow sets its own httpOnly cookie named `campaign-token` (constant `CAMPAIGN_TOKEN_COOKIE` in `src/utilities/campaignAuth.ts`), scoped to `path: '/campanha'`, `sameSite: 'lax'`, and `secure` only in production. It is deliberately NOT the default `payload-token` cookie — using a distinct name + path is what lets a campaign session and a Payload admin session live side by side without clobbering each other.
- **Session verification — `getCampaignUser()`** (`src/utilities/campaignAuth.ts`). Reads the `campaign-token` cookie, calls `payload.auth({ headers })`, accepts only `user.collection === 'campaignUser'`, then reloads that document by ID. The fresh read makes role downgrades effective immediately instead of trusting a stale JWT role.
- **Login/logout server actions** (`src/app/(campaign)/campanha/actions/auth.ts`). `loginCampaign` validates input with `campaignLoginSchema` (`src/lib/schemas/campaign-login.ts`), calls `payload.login({ collection: 'campaignUser' })`, and — because the Local API returns a token WITHOUT setting a cookie — sets the `campaign-token` cookie itself (using the collection's `auth.tokenExpiration` as `maxAge`) before redirecting to `/campanha`. `logoutCampaign` clears the cookie (`maxAge: 0`) and redirects to `/campanha/login`.
- **Route layout.** The route group's root layout `src/app/(campaign)/layout.tsx` renders the `<html>`/`<body>` with `data-theme="campaign"`. The public login lives at `src/app/(campaign)/campanha/login/` (`page.tsx` + client `LoginForm.tsx`). Everything gated sits in the `(app)` group, whose layout (`src/app/(campaign)/campanha/(app)/layout.tsx`) calls `getCampaignUser()` and `redirect('/campanha/login')` when there is no session — that layout is the barrier.
- **Migrations.** `20260716_010420_add_campaign_user` created the auth collection; the unpublished 2026-07-17 campaign chain was consolidated into `20260718_010733_consolidate_campaign_schema`, which adds role/username auth, contact phone, and the remaining final campaign schema.

## Campaign Municípios model (2026-07-23 remodel)

`/campanha` is organized around `municipality` ("Município") — the campaign's PREDEFINED operational territory. Deployed to production on 2026-07-23 (destructive remodel migrations applied via the Vercel build). Master plan: `docs/plans/remodelagem-municipios.md` (supersedes `docs/plans/remodelagem-pracas.md`).

- **Município definition:** 435 seeded rows — one per Bahia municipality (416), except Salvador (19 zone municipalities, ZE 1–19); Camaçari is a single whole municipality (ZE 170/171 aggregated). Canonical catalog: `src/lib/municipalityCatalog.ts` (`tests/fixtures/municipality-catalog.snapshot.json`). Seeded by migration `20260723_200000_remodel_municipalities` (+ reconcile `20260723_202000_reconcile_municipality_remodel`). Geography is admin-only; staff edit strategy fields and the coordinator assigns `advisors`.
- **Collections (admin group `Campanha`):** `municipality`, `leadership`, `votePledge`, `organization`, `stateDeputy` (dobradinhas), `campaignDemand`, `allocationDecision`, `municipalityUpdate`, `campaignInvite`, `supporter`, `activity`. **Global** (same admin group): `campaignGoals` (E8 "conta da cadeira" — `stateGoal` sets the optimistic suggested-goal scenario, `margin` the pessimistic haircut; `read` = admin/staff, `update` = admin/`isCampaignUnrestricted`; no `afterChange` hook — nothing caches it).
- **Roles:** `coordinator` ("Coordenador Geral") and `candidate` ("Candidato", unrestricted visibility via `isCampaignUnrestricted`) see/manage everything staff sees; `advisor` ("Assessor") is scoped to `municipality.advisors`; `leader` ("Liderança") is **lockdown** — home is the supporter contact tool only (`LeaderContactsPanel`, `source: lideranca`), reads only supporters they created (`createdBy`), no municipalities/leaderships/pledges/demands/plans/election data.
- **Vote pledge asymmetry:** staff declare `declaredVotes` and record `estimatedVotes` (pessimistic/central/optimistic); leaders never see estimates. Aggregates use `estimated[S] ?? declared`, default `central` (`src/utilities/votePledgeData.ts`).
- **Demandas:** staff-only create/read (`canCreateCampaignDemand`); optional `leadership` provenance selected by staff. Escalated decisions: coordinator **or** candidate.
- **Dobradinhas:** `stateDeputy` entity + `municipality.stateDeputies` / `leadership.stateDeputies` hasMany; UI at `/campanha/dobradinhas`.
- **Map:** staff dashboard (`/campanha`) loads `MunicipalityMapPanel`; `/campanha/municipios` is list/overview only.
- **URLs:** `/campanha/municipios[/slug]`, `/campanha/dobradinhas`, `/campanha/liderancas[/id]`, `/campanha/organizacoes[/slug]`, `/campanha/demandas[/slug]`, `/campanha/atividades[/slug]`, `/campanha/apoiadores`, `/campanha/assessores` (coordinator/candidate), `/campanha/conceitos` (staff glossary), `/campanha/perfil`.

## Campaign supporters (C2)

Nominal supporter registry backing the campaign's base of declared supporters (roadmap item C2; engineering ready and merged to `main` on 2026-07-18, production-blocked on the legal batch). One collection in admin group `Campanha`:

- **`supporter`** (`src/collections/Supporter.ts`) — join `Contact`↔campaign with **optional `municipality`**. Fields include `source` (`import_csv | manual | convite | evento | lideranca` for leader-created rows).
- **Consent by stable key.** `campaignConsent.ts` was generalized to `getConsentByKey` / `requireConsentByKey` (fail-closed). The two keys are `apoiador-cadastro` (declared support) and `apoiador-intencao-voto` (vote intention — highlighted, separate consent). The app fails closed if either key is missing — same pattern as `lideranca-autopreenchimento`.
- **Access.** `coordinator`/`candidate` see/manage all; `advisor` sees supporters of administered municipalities; `leader` may create supporters in linked municipalities and read only rows they created (`createdBy`); supporters without a municipality remain `coordinator`-only. Delete is admin-only.
- **Server actions** (`src/app/(campaign)/campanha/actions/supporter.ts`): `createSupporter`, `setSupporterVoteIntention`, `previewSupporterImport` / `confirmSupporterImport` (CSV, `coordinator`-only, transactional with `req: { transactionID }`, dedup by phone via `contactPhoneInvariant`), and `removeSupporterData` (deletes the `supporter`; anonymizes/clears `Contact` PII only if no other join — `leadership`/`signature`/`subscription`/other `supporter` — references it).
- **UI** `/campanha/apoiadores` — list with KPIs (total / "Certo + Tende" / "Indecisos"), filters (vote intention, territory), detail with LGPD consent block + vote-intention segmented control (disabled until consent) + minimal share kit (`wa.me` + copy text), and a 3-step CSV import wizard (Upload → Preview → Confirm). Phone is required in v1.
- **C6 scale layer (merged to `main` 2026-07-19).** CSV import up to 5000 rows now completes in one transaction: `confirmSupporterImportRecord` acquires all phone advisory locks, then `bulkInsertSupporterImport` (`src/utilities/supporterImportBulk.ts`) inserts contacts + supporters via `payload.db.drizzle` on the Payload transaction session (`getPostgresTransactionDatabase`) in 500-row chunks with `ON CONFLICT DO NOTHING` on `(contact_id, municipality_id)`. `Contact.enforceUniqueContactPhone` honors `context.skipContactPhoneInvariant` **fail-closed** (only inside an active `req.transactionID`), so the bulk path skips the per-row re-check while the single-create path is unchanged. Preview no longer round-trips the full `ok` set: `previewSupporterImportText` stages it in `supporterImportBatch` (`src/collections/SupporterImportBatch.ts`, admin-hidden, `coordinator`/admin only, migration `20260719_011015_add_supporter_import_batch`) and returns an HMAC-SHA256 single-use `importToken` (10-min TTL, actor-bound, `src/utilities/supporterImportToken.ts`); `confirmSupporterImportRecord` verifies the token and consumes the batch (delete after commit). The list KPI is a single `COUNT(*) FILTER` aggregate (`src/utilities/supporterListOverviewAggregate.ts`) mirroring `buildSupporterListWhere` + the access constraint, replacing 3× `payload.count`. Shared shells — `campaignListUrl.ts`, `CampaignListPagination`, `campaignFormFields.ts`, `mapCampaignFormActionError.ts` — replace the three per-list pagination components and the duplicated form-error ladders. Scale/DRY follow-ups from the `/simplify` pass are registered as **C8** (`docs/plans/escala-dry-pos-c6.md`).
- **Mandatory production blocker:** do not import real supporter data or capture vote intention until electoral counsel documents the LGPD art. 11 basis (vote intention is sensitive data), approves the versioned consent texts, and an admin creates `Consent.key = 'apoiador-cadastro'` and `Consent.key = 'apoiador-intencao-voto'`. The app intentionally fails closed when these keys are absent.

## Campaign activities (C3, renamed by C13)

Mobilization events / agenda backing the campaign's field operations (roadmap item C3; implemented and merged to `main` on 2026-07-18). **Renamed "Plano de Ação" → "Atividade" on 2026-07-25 (C13)**: the collection slug is `activity`, the route is `/campanha/atividades`, and the vocabulary guard in `tests/unit/codebaseConventions.unit.spec.ts` now fails the build on `actionPlan` / `plano de ação` / `/campanha/planos` anywhere in `src`, `tests` or `scripts` (migrations excluded — frozen history). One collection in admin group `Campanha`:

- **`activity`** (`src/collections/Activity.ts`) — a calendarizable action/event (caminhada, comício, etc.) anchored on ONE `municipality`, with task checklist, update feed and result record. Fields: `title`, canonical immutable `slug`, `kind` / `status` enums in pt-BR, `startAt` (required beyond `rascunho`), `municipality` (required) + free-text `locality`, `organizations` (hasMany — supporting orgs), `advisors` (staff responsible; ex-`coordinators`), `deputyPresent` (checkbox "Deputado presente"), `responsible` → `Contact`, `leadership` optional, `tasks`/`updates` arrays (derived fields server-side), and the action result: `resultSummary` + `resultMedia` (upload → `media`) + derived `resultRecordedBy/At` — queryable history for future activities in the same município. No `Consent` (internal staff data).
- **Access.** `coordinator` everything; `advisor` where listed in `advisors` OR the activity's `municipality` is administered (may create, auto-included); `leader` has no access (lockdown).
- **UI** `/campanha/atividades` — list with tabs Próximos (default) / Todos / Realizados / Rascunhos, filters (kind, municipality), cards with kind/status badge + date/time + município + "Resp:" + task progress + "Deputado presente"; detail with tabs Visão geral / Tarefas / Atualizações (`/campanha/atividades/[slug]`, create at `/campanha/atividades/nova`); result form appears for staff when the activity is `realizado`.

## Campaign map geometries (B2)

Static Bahia map foundation for future Leaflet surfaces (roadmap B2; UI is B3). No migration, collection, Consent, or server action — same static-data pattern as `bahiaTerritories` / `bahiaTseZones`.

- **Artifacts (committed):** `src/lib/geometries/bahia-municipalities.topo.json` (~132 KB; Topology object `municipalities`, 417 features, `properties: { codarea, name }`) and `src/lib/geometries/bahia-identity-territories.topo.json` (~15 KB; object `territories`, 27 features, `properties: { code, name }`). Soft size budget in tests: ≤ ~600 KB each.
- **Code table:** `src/lib/bahiaMunicipalityCodes.ts` — canonical municipality name → IBGE 7-digit `codarea`, plus `codeForMunicipality` / `municipalityForCode`. Fixture `tests/fixtures/bahia-municipality-codes.official.json` + int tests for bijection/coverage.
- **Runtime helpers:** `src/lib/bahiaGeometries.ts` — `getMunicipalityFeature` / `getTerritoryFeature`, typed topologies, feature arrays. TopoJSON→GeoJSON decode is LAZY (dynamic import via `loadMunicipalityGeometryModule`; B5 F1 done) — the default `/campanha` server graph never pays it.
- **Territory polygons:** dissolved from IBGE municipality meshes via `bahiaIdentityTerritoryRecords` (`topojson` `merge`), not the IDE Bahia shapefile (IDE remains provenance/validation reference only).
- **Rebuild:** `pnpm build:geometries` (`scripts/build-bahia-geometries.mjs`) downloads IBGE Malhas (qualidade intermediaria) + Localidades, reconciles names with `canonicalizeMunicipalityName`, simplifies/quantizes, emits the artifacts above. Cache under `data/geometries/` (gitignored; override with `GEOMETRIES_CACHE_DIR`). **Does not touch the database** — no `assertLocalDatabase` / no Neon risk. Not part of `pnpm build` or `pnpm dev`. Details: `docs/plans/mapa-bahia-geometrias.md`. Scale/DRY follow-ups from `/simplify`: `docs/plans/escala-dry-pos-b2.md` (B5).

## Election baseline data (TSE 2022)

Public TSE 2022 results back the electoral baseline (roadmap items A3 + A4). Three collections in admin group `Dados Eleitorais`: `electionTally` (per city×zone totals: eligible voters, turnout, valid/blank/null votes), `electionCandidateVote` (nominal votes per candidate×city×zone), and `electionCandidate` (candidate registry with a cross-year `identityKey` hash — no CPF or voter ID is ever persisted). Read access requires an authenticated `campaignUser` or `users` account (`canReadElectionData`); writes are Payload-admin-only, and the import runs via CLI with `overrideAccess: true`. Since the Município remodel, the consumers are `municipalityElectoralBaseline.ts` (per-municipality series/turnout), `municipalityCandidateComparison.ts` (multi-candidate table) and `municipalityMapData.ts` (map, incl. the diverging compare mode); ticket roles live in `BASELINE_TICKET_2022`. Seeds cover 2014/2018/2022 (E2 extended the original 2022-only A3 scope). Two caching layers sit on top (2026-07-23 hardening): the immutable Solla/valid-votes series per municipality ships as a committed artifact — `pnpm build:election-aggregates` → `src/lib/electionAggregates/bahia-federal-baseline.json`, loader `src/lib/bahiaElectionAggregates.ts`, snapshot-tested against `municipalityCatalog` — so the map/dashboard never query these collections for historical years; and the elections-tab loaders (`municipalityElectoralBaseline`, `municipalityCandidateComparison`, `electionCandidateOptions`) are wrapped in `unstable_cache` under the `election-tse` tag (bust via `POST /api/revalidate?tag=election-tse` after re-seeding).

`pnpm db:seed:tse` (`scripts/seed-tse-results.mjs`) downloads the TSE open-data zips (provenance URLs + SHA-256 in the script header), parses the Bahia scope, and imports via `payload.db.drizzle` in a transaction — idempotent by replace-per-scope `(year, office, turn)`, only `voteType: 'nominal'` rows in v1. It refuses a non-local `DATABASE_URL` (same guard family as the other seeds; override with `ALLOW_REMOTE_DB=true`) and caches downloads under `data/tse/` (gitignored). No revalidate step is needed: campaign pages are dynamic with auth, not ISR-cached.

### Local verification and deploy checklist

1. Confirm `DATABASE_URL` is `postgresql://teqo:teqo@localhost:5432/teqo` and `.env.test` points to `teqo_test`; never use Neon for development, tests, E2E, or local builds.
2. Run `pnpm db:start`, `pnpm migrate:status`, and `DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm migrate:status`; every migration must show `Ran: Yes`.
3. Run `pnpm generate:types`, `pnpm generate:importmap` when components changed, `pnpm exec tsc --noEmit`, `pnpm lint` (zero warnings — the script enforces `--max-warnings=0`), `pnpm format:check` (Prettier is the formatting authority; `pnpm format` fixes), `pnpm exec knip` (dead files/dependencies are CI-blocking; delete what your change orphaned), `pnpm check:cycles` (madge — zero circular imports), `pnpm test` (unit + int), `pnpm test:e2e` (or `pnpm test:all`), and `pnpm build` against the local database. Payload CLI scripts (`migrate`, `generate:*`, `payload`) and the build migrate step use `--conditions=react-server` so `server-only` modules load correctly outside Next.js.
   - Never run `knip --fix` blind: when knip's module graph is incomplete (it still cannot load `payload.config.ts` — ledgered as P3), `--fix` deletes exports that migrations/tests still reference. Verify each removal (e.g. `git grep -w <symbol>`) before deleting.
   - Run gate commands bare — never piped (`pnpm test | tail` swallows the exit code, and a real failure was masked exactly this way during Pass 2). Large outputs are captured by the terminal; read them from there.
4. Scan every edited runtime source file with Aikido and resolve new findings before handoff. Do not expand hardening work into unrelated pre-existing findings without an explicit scope change.
5. Review Vercel environment variables and migration SQL before deploy; `pnpm build` applies pending migrations to production automatically.
6. **Mandatory production blocker:** do not insert real leadership/support data or enable invites until electoral counsel documents the LGPD art. 11 basis, approves the specific versioned consent text, and an admin creates it with exactly `Consent.key = 'lideranca-autopreenchimento'`. The app intentionally fails closed when this key is absent.
7. **Remodel deploy (historical — applied to production 2026-07-23):** the destructive remodel chain (`20260721_020109_remodel_municipalities` → `20260723_200000_remodel_municipalities` + `20260723_202000_reconcile_municipality_remodel`) already ran in production via the Vercel build: campaign vertical reset, 435 municípios seeded, public-site data untouched. Treat any future destructive migration the same way — review its SQL before the first production build that includes it.

## Core Principles

1. **TypeScript-First**: Always use TypeScript with proper types from Payload
2. **Security-Critical**: Follow all security patterns, especially access control
3. **Type Generation**: Run `generate:types` script after schema changes
4. **Transaction Safety**: Always pass `req` to nested operations in hooks
5. **Access Control**: Understand Local API bypasses access control by default
6. **Access Control**: Ensure roles exist when modifiyng collection or globals with access controls

### Code Validation

- To validate typescript correctness after modifying code run `tsc --noEmit`
- Generate import maps after creating or modifying components.
- Any change to a collection/global/field schema requires a migration: `pnpm migrate:create <name>`, then `pnpm migrate` locally. Never rely on `push` (it is `false`). See the `payload-migrations` skill.

## Project Structure

Actual layout (campaign access control lives in `src/utilities/access/*` domain modules with `src/utilities/campaignAccess.ts` as the re-export surface; hooks are still written inline inside each collection/global file):

```
src/
├── app/
│   ├── (frontend)/          # Frontend routes + server actions (src/app/(frontend)/actions/*.ts)
│   ├── (payload)/           # Payload admin routes
│   └── (campaign)/          # Internal campaign-management area (auth barrier, see "Campaign auth")
├── collections/             # Users, CampaignUser, CampaignInvite, Municipality, Leadership, VotePledge, MunicipalityUpdate, Organization, StateDeputy, CampaignDemand, AllocationDecision, Supporter, SupporterImportBatch, Activity, ElectionTally, ElectionCandidateVote, ElectionCandidate, Media, Petition, Signature, Consent, Contact, Subscription, Post, Tag
├── globals/                 # Global configs (SiteSettings, HomePage, Metadata, PrivacyPolicy, CampaignGoals)
├── components/              # campaign/<domínio>/ (municipality, activity, supporter, …, shared, shell — Pass 2 W2), ui from shadcn
├── lib/                     # cities.ts, bahiaTerritories.ts, bahiaTseZones.ts, bahiaMunicipalityCodes.ts, bahiaGeometries.ts, geometries/*.topo.json, municipalityCatalog.ts, electionAggregates/ (committed TSE artifact) + bahiaElectionAggregates.ts, formData.ts, zod schemas (lib/schemas/*)
├── utilities/               # campaign*, access/* (per-domain RBAC; campaignAccess.ts re-exports), municipality*, posts, documents, globals, locks, etc.
└── payload.config.ts        # Main config
```

## Configuration

### Minimal Config Pattern

```typescript
import { buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URL,
  }),
})
```

## Collections

### Basic Collection

```typescript
import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'createdAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'content', type: 'richText' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
  ],
  timestamps: true,
}
```

### Auth Collection with RBAC

```typescript
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: ['admin', 'editor', 'user'],
      defaultValue: ['user'],
      required: true,
      saveToJWT: true, // Include in JWT for fast access checks
      access: {
        update: ({ req: { user } }) => user?.roles?.includes('admin'),
      },
    },
  ],
}
```

## Fields

### Common Patterns

```typescript
// Auto-generate slugs
import { slugField } from 'payload'
slugField({ fieldToUse: 'title' })

// Relationship with filtering
{
  name: 'category',
  type: 'relationship',
  relationTo: 'categories',
  filterOptions: { active: { equals: true } },
}

// Conditional field
{
  name: 'featuredImage',
  type: 'upload',
  relationTo: 'media',
  admin: {
    condition: (data) => data.featured === true,
  },
}

// Virtual field
{
  name: 'fullName',
  type: 'text',
  virtual: true,
  hooks: {
    afterRead: [({ siblingData }) => `${siblingData.firstName} ${siblingData.lastName}`],
  },
}
```

## CRITICAL SECURITY PATTERNS

### 1. Local API Access Control (MOST IMPORTANT)

```typescript
// ❌ SECURITY BUG: Access control bypassed
await payload.find({
  collection: 'posts',
  user: someUser, // Ignored! Operation runs with ADMIN privileges
})

// ✅ SECURE: Enforces user permissions
await payload.find({
  collection: 'posts',
  user: someUser,
  overrideAccess: false, // REQUIRED
})

// ✅ Administrative operation (intentional bypass)
await payload.find({
  collection: 'posts',
  // No user, overrideAccess defaults to true
})
```

**Rule**: When passing `user` to Local API, ALWAYS set `overrideAccess: false`

### 2. Transaction Safety in Hooks

```typescript
// ❌ DATA CORRUPTION RISK: Separate transaction
hooks: {
  afterChange: [
    async ({ doc, req }) => {
      await req.payload.create({
        collection: 'audit-log',
        data: { docId: doc.id },
        // Missing req - runs in separate transaction!
      })
    },
  ],
}

// ✅ ATOMIC: Same transaction
hooks: {
  afterChange: [
    async ({ doc, req }) => {
      await req.payload.create({
        collection: 'audit-log',
        data: { docId: doc.id },
        req, // Maintains atomicity
      })
    },
  ],
}
```

**Rule**: ALWAYS pass `req` to nested operations in hooks

### 3. Prevent Infinite Hook Loops

```typescript
// ❌ INFINITE LOOP
hooks: {
  afterChange: [
    async ({ doc, req }) => {
      await req.payload.update({
        collection: 'posts',
        id: doc.id,
        data: { views: doc.views + 1 },
        req,
      }) // Triggers afterChange again!
    },
  ],
}

// ✅ SAFE: Use context flag
hooks: {
  afterChange: [
    async ({ doc, req, context }) => {
      if (context.skipHooks) return

      await req.payload.update({
        collection: 'posts',
        id: doc.id,
        data: { views: doc.views + 1 },
        context: { skipHooks: true },
        req,
      })
    },
  ],
}
```

## Access Control

### Collection-Level Access

```typescript
import type { Access } from 'payload'

// Boolean return
const authenticated: Access = ({ req: { user } }) => Boolean(user)

// Query constraint (row-level security)
const ownPostsOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user?.roles?.includes('admin')) return true

  return {
    author: { equals: user.id },
  }
}

// Async access check
const projectMemberAccess: Access = async ({ req, id }) => {
  const { user, payload } = req

  if (!user) return false
  if (user.roles?.includes('admin')) return true

  const project = await payload.findByID({
    collection: 'projects',
    id: id as string,
    depth: 0,
  })

  return project.members?.includes(user.id)
}
```

### Field-Level Access

```typescript
// Field access ONLY returns boolean (no query constraints)
{
  name: 'salary',
  type: 'number',
  access: {
    read: ({ req: { user }, doc }) => {
      // Self can read own salary
      if (user?.id === doc?.id) return true
      // Admin can read all
      return user?.roles?.includes('admin')
    },
    update: ({ req: { user } }) => {
      // Only admins can update
      return user?.roles?.includes('admin')
    },
  },
}
```

### Common Access Patterns

```typescript
// Anyone
export const anyone: Access = () => true

// Authenticated only
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

// Admin only
export const adminOnly: Access = ({ req: { user } }) => {
  return user?.roles?.includes('admin')
}

// Admin or self
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (user?.roles?.includes('admin')) return true
  return { id: { equals: user?.id } }
}

// Published or authenticated
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}
```

## Hooks

### Common Hook Patterns

```typescript
import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  hooks: {
    // Before validation - format data
    beforeValidate: [
      async ({ data, operation }) => {
        if (operation === 'create') {
          data.slug = slugify(data.title)
        }
        return data
      },
    ],

    // Before save - business logic
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation === 'update' && data.status === 'published') {
          data.publishedAt = new Date()
        }
        return data
      },
    ],

    // After save - side effects
    afterChange: [
      async ({ doc, req, operation, previousDoc, context }) => {
        // Check context to prevent loops
        if (context.skipNotification) return

        if (operation === 'create') {
          await sendNotification(doc)
        }
        return doc
      },
    ],

    // After read - computed fields
    afterRead: [
      async ({ doc, req }) => {
        doc.viewCount = await getViewCount(doc.id)
        return doc
      },
    ],

    // Before delete - cascading deletes
    beforeDelete: [
      async ({ req, id }) => {
        await req.payload.delete({
          collection: 'comments',
          where: { post: { equals: id } },
          req, // Important for transaction
        })
      },
    ],
  },
}
```

## Queries

### Local API

```typescript
// Find with complex query
const posts = await payload.find({
  collection: 'posts',
  where: {
    and: [{ status: { equals: 'published' } }, { 'author.name': { contains: 'john' } }],
  },
  depth: 2, // Populate relationships
  limit: 10,
  sort: '-createdAt',
  select: {
    title: true,
    author: true,
  },
})

// Find by ID
const post = await payload.findByID({
  collection: 'posts',
  id: '123',
  depth: 2,
})

// Create
const newPost = await payload.create({
  collection: 'posts',
  data: {
    title: 'New Post',
    status: 'draft',
  },
})

// Update
await payload.update({
  collection: 'posts',
  id: '123',
  data: { status: 'published' },
})

// Delete
await payload.delete({
  collection: 'posts',
  id: '123',
})
```

### Query Operators

```typescript
// Equals
{ status: { equals: 'published' } }

// Not equals
{ status: { not_equals: 'draft' } }

// Greater than / less than
{ price: { greater_than: 100 } }
{ age: { less_than_equal: 65 } }

// Contains (case-insensitive)
{ title: { contains: 'payload' } }

// Like (all words present)
{ description: { like: 'cms headless' } }

// In array
{ category: { in: ['tech', 'news'] } }

// Exists
{ image: { exists: true } }

// Near (geospatial)
{ location: { near: [-122.4194, 37.7749, 10000] } }
```

### AND/OR Logic

```typescript
{
  or: [
    { status: { equals: 'published' } },
    { author: { equals: user.id } },
  ],
}

{
  and: [
    { status: { equals: 'published' } },
    { featured: { equals: true } },
  ],
}
```

## Getting Payload Instance

```typescript
// In API routes (Next.js)
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET() {
  const payload = await getPayload({ config })

  const posts = await payload.find({
    collection: 'posts',
  })

  return Response.json(posts)
}

// In Server Components
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function Page() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'posts' })

  return <div>{docs.map(post => <h1 key={post.id}>{post.title}</h1>)}</div>
}
```

## Components

The Admin Panel can be extensively customized using React Components. Custom Components can be Server Components (default) or Client Components.

### Defining Components

Components are defined using **file paths** (not direct imports) in your config:

**Component Path Rules:**

- Paths are relative to project root or `config.admin.importMap.baseDir`
- Named exports: use `#ExportName` suffix or `exportName` property
- Default exports: no suffix needed
- File extensions can be omitted

```typescript
import { buildConfig } from 'payload'

export default buildConfig({
  admin: {
    components: {
      // Logo and branding
      graphics: {
        Logo: '/components/Logo',
        Icon: '/components/Icon',
      },

      // Navigation
      Nav: '/components/CustomNav',
      beforeNavLinks: ['/components/CustomNavItem'],
      afterNavLinks: ['/components/NavFooter'],

      // Header
      header: ['/components/AnnouncementBanner'],
      actions: ['/components/ClearCache', '/components/Preview'],

      // Dashboard
      beforeDashboard: ['/components/WelcomeMessage'],
      afterDashboard: ['/components/Analytics'],

      // Auth
      beforeLogin: ['/components/SSOButtons'],
      logout: { Button: '/components/LogoutButton' },

      // Settings
      settingsMenu: ['/components/SettingsMenu'],

      // Views
      views: {
        dashboard: { Component: '/components/CustomDashboard' },
      },
    },
  },
})
```

**Component Path Rules:**

- Paths are relative to project root or `config.admin.importMap.baseDir`
- Named exports: use `#ExportName` suffix or `exportName` property
- Default exports: no suffix needed
- File extensions can be omitted

### Component Types

1. **Root Components** - Global Admin Panel (logo, nav, header)
2. **Collection Components** - Collection-specific (edit view, list view)
3. **Global Components** - Global document views
4. **Field Components** - Custom field UI and cells

### Component Types

1. **Root Components** - Global Admin Panel (logo, nav, header)
2. **Collection Components** - Collection-specific (edit view, list view)
3. **Global Components** - Global document views
4. **Field Components** - Custom field UI and cells

### Server vs Client Components

**All components are Server Components by default** (can use Local API directly):

```tsx
// Server Component (default)
import type { Payload } from 'payload'

async function MyServerComponent({ payload }: { payload: Payload }) {
  const posts = await payload.find({ collection: 'posts' })
  return <div>{posts.totalDocs} posts</div>
}

export default MyServerComponent
```

**Client Components** need the `'use client'` directive:

```tsx
'use client'
import { useState } from 'react'
import { useAuth } from '@payloadcms/ui'

export function MyClientComponent() {
  const [count, setCount] = useState(0)
  const { user } = useAuth()

  return (
    <button onClick={() => setCount(count + 1)}>
      {user?.email}: Clicked {count} times
    </button>
  )
}
```

### Using Hooks (Client Components Only)

```tsx
'use client'
import {
  useAuth, // Current user
  useConfig, // Payload config (client-safe)
  useDocumentInfo, // Document info (id, collection, etc.)
  useField, // Field value and setter
  useForm, // Form state
  useFormFields, // Multiple field values (optimized)
  useLocale, // Current locale
  useTranslation, // i18n translations
  usePayload, // Local API methods
} from '@payloadcms/ui'

export function MyComponent() {
  const { user } = useAuth()
  const { config } = useConfig()
  const { id, collection } = useDocumentInfo()
  const locale = useLocale()
  const { t } = useTranslation()

  return <div>Hello {user?.email}</div>
}
```

### Collection/Global Components

```typescript
export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    components: {
      // Edit view
      edit: {
        PreviewButton: '/components/PostPreview',
        SaveButton: '/components/CustomSave',
        SaveDraftButton: '/components/SaveDraft',
        PublishButton: '/components/Publish',
      },

      // List view
      list: {
        Header: '/components/ListHeader',
        beforeList: ['/components/BulkActions'],
        afterList: ['/components/ListFooter'],
      },
    },
  },
}
```

### Field Components

```typescript
{
  name: 'status',
  type: 'select',
  options: ['draft', 'published'],
  admin: {
    components: {
      // Edit view field
      Field: '/components/StatusField',
      // List view cell
      Cell: '/components/StatusCell',
      // Field label
      Label: '/components/StatusLabel',
      // Field description
      Description: '/components/StatusDescription',
      // Error message
      Error: '/components/StatusError',
    },
  },
}
```

**UI Field** (presentational only, no data):

```typescript
{
  name: 'refundButton',
  type: 'ui',
  admin: {
    components: {
      Field: '/components/RefundButton',
    },
  },
}
```

### Performance Best Practices

1. **Import correctly:**
   - Admin Panel: `import { Button } from '@payloadcms/ui'`
   - Frontend: `import { Button } from '@payloadcms/ui/elements/Button'`

2. **Optimize re-renders:**

   ```tsx
   // ❌ BAD: Re-renders on every form change
   const { fields } = useForm()

   // ✅ GOOD: Only re-renders when specific field changes
   const value = useFormFields(([fields]) => fields[path])
   ```

3. **Prefer Server Components** - Only use Client Components when you need:
   - State (useState, useReducer)
   - Effects (useEffect)
   - Event handlers (onClick, onChange)
   - Browser APIs (localStorage, window)

4. **Minimize serialized props** - Server Components serialize props sent to client

### Styling Components

```tsx
import './styles.scss'

export function MyComponent() {
  return <div className="my-component">Content</div>
}
```

```scss
// Use Payload's CSS variables
.my-component {
  background-color: var(--theme-elevation-500);
  color: var(--theme-text);
  padding: var(--base);
  border-radius: var(--border-radius-m);
}

// Import Payload's SCSS library
@import '~@payloadcms/ui/scss';

.my-component {
  @include mid-break {
    background-color: var(--theme-elevation-900);
  }
}
```

### Type Safety

```tsx
import type {
  TextFieldServerComponent,
  TextFieldClientComponent,
  TextFieldCellComponent,
  SelectFieldServerComponent,
  // ... etc
} from 'payload'

export const MyField: TextFieldClientComponent = (props) => {
  // Fully typed props
}
```

### Import Map

Payload auto-generates `app/(payload)/admin/importMap.js` to resolve component paths.

**Regenerate manually:**

```bash
payload generate:importmap
```

**Set custom location:**

```typescript
export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname, 'src'),
      importMapFile: path.resolve(dirname, 'app', 'custom-import-map.js'),
    },
  },
})
```

## Custom Endpoints

```typescript
import type { Endpoint } from 'payload'
import { APIError } from 'payload'

// Always check authentication
export const protectedEndpoint: Endpoint = {
  path: '/protected',
  method: 'get',
  handler: async (req) => {
    if (!req.user) {
      throw new APIError('Unauthorized', 401)
    }

    // Use req.payload for database operations
    const data = await req.payload.find({
      collection: 'posts',
      where: { author: { equals: req.user.id } },
    })

    return Response.json(data)
  },
}

// Route parameters
export const trackingEndpoint: Endpoint = {
  path: '/:id/tracking',
  method: 'get',
  handler: async (req) => {
    const { id } = req.routeParams

    const tracking = await getTrackingInfo(id)

    if (!tracking) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }

    return Response.json(tracking)
  },
}
```

## Drafts & Versions

```typescript
export const Pages: CollectionConfig = {
  slug: 'pages',
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
      validate: false, // Don't validate drafts
    },
    maxPerDoc: 100,
  },
  access: {
    read: ({ req: { user } }) => {
      // Public sees only published
      if (!user) return { _status: { equals: 'published' } }
      // Authenticated sees all
      return true
    },
  },
}

// Create draft
await payload.create({
  collection: 'pages',
  data: { title: 'Draft Page' },
  draft: true, // Skips required field validation
})

// Read with drafts
const page = await payload.findByID({
  collection: 'pages',
  id: '123',
  draft: true, // Returns draft if available
})
```

## Field Type Guards

```typescript
import {
  fieldAffectsData,
  fieldHasSubFields,
  fieldIsArrayType,
  fieldIsBlockType,
  fieldSupportsMany,
  fieldHasMaxDepth,
} from 'payload'

function processField(field: Field) {
  // Check if field stores data
  if (fieldAffectsData(field)) {
    console.log(field.name) // Safe to access
  }

  // Check if field has nested fields
  if (fieldHasSubFields(field)) {
    field.fields.forEach(processField) // Safe to access
  }

  // Check field type
  if (fieldIsArrayType(field)) {
    console.log(field.minRows, field.maxRows)
  }

  // Check capabilities
  if (fieldSupportsMany(field) && field.hasMany) {
    console.log('Multiple values supported')
  }
}
```

## Plugins

### Using Plugins

```typescript
import { seoPlugin } from '@payloadcms/plugin-seo'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'

export default buildConfig({
  plugins: [
    seoPlugin({
      collections: ['posts', 'pages'],
    }),
    redirectsPlugin({
      collections: ['pages'],
    }),
  ],
})
```

### Creating Plugins

```typescript
import type { Config, Plugin } from 'payload'

interface MyPluginConfig {
  collections?: string[]
  enabled?: boolean
}

export const myPlugin =
  (options: MyPluginConfig): Plugin =>
  (config: Config): Config => ({
    ...config,
    collections: config.collections?.map((collection) => {
      if (options.collections?.includes(collection.slug)) {
        return {
          ...collection,
          fields: [...collection.fields, { name: 'pluginField', type: 'text' }],
        }
      }
      return collection
    }),
  })
```

## Best Practices

### Security

1. Always set `overrideAccess: false` when passing `user` to Local API
2. Field-level access only returns boolean (no query constraints)
3. Default to restrictive access, gradually add permissions
4. Never trust client-provided data
5. Use `saveToJWT: true` for roles to avoid database lookups

### Performance

1. Index frequently queried fields
2. Use `select` to limit returned fields
3. Set `maxDepth` on relationships to prevent over-fetching
4. Use query constraints over async operations in access control
5. Cache expensive operations in `req.context`

### Data Integrity

1. Always pass `req` to nested operations in hooks
2. Use context flags to prevent infinite hook loops
3. Enable transactions for MongoDB (requires replica set) and Postgres
4. Use `beforeValidate` for data formatting
5. Use `beforeChange` for business logic

### Type Safety

1. Run `generate:types` after schema changes
2. Import types from generated `payload-types.ts`
3. Type your user object: `import type { User } from '@/payload-types'`
4. Use `as const` for field options
5. Use field type guards for runtime type checking

### Organization

1. Keep collections in separate files
2. Extract access control to `access/` directory
3. Extract hooks to `hooks/` directory
4. Use reusable field factories for common patterns
5. Document complex access control with comments

## Common Gotchas

1. **Local API Default**: Access control bypassed unless `overrideAccess: false`
2. **Transaction Safety**: Missing `req` in nested operations breaks atomicity
3. **Hook Loops**: Operations in hooks can trigger the same hooks
4. **Field Access**: Cannot use query constraints, only boolean
5. **Relationship Depth**: Default depth is 2, set to 0 for IDs only
6. **Draft Status**: `_status` field auto-injected when drafts enabled
7. **Type Generation**: Types not updated until `generate:types` runs
8. **MongoDB Transactions**: Require replica set configuration
9. **SQLite Transactions**: Disabled by default, enable with `transactionOptions: {}`
10. **Point Fields**: Not supported in SQLite

## Additional Context Files

For deeper exploration of specific topics, refer to the context files located in `.cursor/rules/`:

### Available Context Files

1. **`payload-overview.md`** - High-level architecture and core concepts
   - Payload structure and initialization
   - Configuration fundamentals
   - Database adapters overview

2. **`security-critical.md`** - Critical security patterns (⚠️ IMPORTANT)
   - Local API access control
   - Transaction safety in hooks
   - Preventing infinite hook loops

3. **`collections.md`** - Collection configurations
   - Basic collection patterns
   - Auth collections with RBAC
   - Upload collections
   - Drafts and versioning
   - Globals

4. **`fields.md`** - Field types and patterns
   - All field types with examples
   - Conditional fields
   - Virtual fields
   - Field validation
   - Common field patterns

5. **`field-type-guards.md`** - TypeScript field type utilities
   - Field type checking utilities
   - Safe type narrowing
   - Runtime field validation

6. **`access-control.md`** - Permission patterns
   - Collection-level access
   - Field-level access
   - Row-level security
   - RBAC patterns
   - Multi-tenant access control

7. **`access-control-advanced.md`** - Complex access patterns
   - Nested document access
   - Cross-collection permissions
   - Dynamic role hierarchies
   - Performance optimization

8. **`hooks.md`** - Lifecycle hooks
   - Collection hooks
   - Field hooks
   - Hook context patterns
   - Common hook recipes

9. **`queries.md`** - Database operations
   - Local API usage
   - Query operators
   - Complex queries with AND/OR
   - Performance optimization

10. **`endpoints.md`** - Custom API endpoints
    - REST endpoint patterns
    - Authentication in endpoints
    - Error handling
    - Route parameters

11. **`adapters.md`** - Database and storage adapters
    - MongoDB, PostgreSQL, SQLite patterns
    - Storage adapter usage (S3, Azure, GCS, etc.)
    - Custom adapter development

12. **`plugin-development.md`** - Creating plugins
    - Plugin architecture
    - Modifying configuration
    - Plugin hooks
    - Best practices

13. **`components.md`** - Custom Components
    - Component types (Root, Collection, Global, Field)
    - Server vs Client Components
    - Component paths and definition
    - Default and custom props
    - Using hooks
    - Performance best practices
    - Styling components

## Resources

- Docs: https://payloadcms.com/docs
- LLM Context: https://payloadcms.com/llms-full.txt
- GitHub: https://github.com/payloadcms/payload
- Examples: https://github.com/payloadcms/payload/tree/main/examples
- Templates: https://github.com/payloadcms/payload/tree/main/templates
