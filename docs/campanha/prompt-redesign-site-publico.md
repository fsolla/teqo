# Mission: rethink and rebuild the public surfaces of jorgesolla1313.com.br

You are a senior art director, interaction designer, and frontend engineer working **inside the Teqo repository**. This is not a greenfield build: the codebase already contains the public campaign site, the legacy editorial site, the media/speech archives, the personalized-card studio, and approved design gates. Your job is to rethink the public experience end to end and deliver it as mergeable, deployable work — not a disconnected mockup.

All visitor-facing content must be in Brazilian Portuguese. All code identifiers stay in English (repo convention). Read `AGENTS.md` and `AGENTS-public.md` before touching anything.

---

## 0. Laws of the house (non-negotiable)

1. **Edit the owner, don't twin.** New behavior lands in the module that already owns the concern. A parallel file that reimplements an existing machine is a defect. Delete what your change supersedes in the same delivery (`.agents/rules/engineering-standards.mdc`).
2. **Visual structure belongs to the `designer`.** Any UI change requires the hi-fi HTML artifact (`docs/plans/<slug>-ui-design.html`) produced by the `designer` agent, per `.agents/skills/plan-issue/ui-design-html.md`. Implementation ports the artifact class-by-class. Do not improvise layout in code.
3. **Sem fonte, não publica.** Never invent facts, figures, quotes, achievements, testimonials, photos, or endorsements. Proposals, ongoing work, and completed outcomes must be distinguishable and dated. Flag source conflicts and outdated claims.
4. **LGPD fail-closed.** Public flows that capture or process personal data resolve `Consent` by stable key (`src/lib/campaignConsentKeys.ts`, `src/utilities/campaignConsent.ts`) and refuse to run while the approved row is missing. Biometric processing is a hard-gated special case (see §8).
5. **Public URL contracts are frozen** unless the delivery explicitly owns the change. Same for the media proxy, cache tags, consent keys, form behavior, and card outputs.
6. **Electoral visibility is fail-closed.** `hidden` tag + `isPostVisible` (`src/utilities/posts.ts`) must pull campaign content immediately, with no deploy. The mandate site and the campaign site do not mix without guidance (`AGENTS-public.md`, `docs/campanha/plano-site-campanha-2026.md` §6).
7. **Local databases only.** Never point anything at production `teqo_1313`. Dev uses `pnpm db:start` + `pnpm dev`; tests run on `_test` databases (`tests/helpers/assertTestDatabase.ts`). The repo is public: never commit secrets, dossier/research dumps, or PII.
8. **Delivery is a PR, not a branch dump.** `pnpm push` (never bare `git push`) → PR Ready via `node scripts/github-pr.mjs` (no `gh` installed) → required check `checks` → auto-merge → `main` triggers deploy (staging auto, production with human approval). One changelog entry per delivery in `docs/changelog/<date>-<id>.md`; never edit the aggregate.
9. **Design-provider policy.** Models under `openai/*` are reserved for the `designer` / `designer-campanha-solla` agents and only for creating/critiquing design. Everything else runs on the session default. One `designer` session for the whole batch of UI items (`.agents/skills/plan-issue/ui-design-html.md` §Escopo de dispatch).
10. **Gate commands:** `pnpm gate:fast` while iterating; `pnpm push` before pushing; `pnpm test:e2e:affected` for touched surfaces; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm knip`, `pnpm check:cycles`; migrations via `pnpm migrate:create <name>` + `pnpm migrate` + `pnpm generate:types` (never edit shipped migrations, `push:false` always).

---

## 1. Mission and scope

Redesign the public surfaces of `jorgesolla1313.com.br` — **both verticals**:

**Campaign / public voice** (theme `campaign-site`, layout in `src/app/(frontend)/(home)/layout.tsx`):

- `/` — campaign home (hero, provas, problema, bandeiras, história, jingles, cards, board de conteúdo, newsletter, rodapé)
- `/cards` — personalized card studio (must be **extended**, see §7)
- `/conteudos` + `/conteudos/[slug]` + `/midia` + `/frame` — content center
- `/corte/[id]` — published speech cuts
- `/jingles` — jingles + radio
- `/mandato-no-whatsapp` — WhatsApp community capture
- `/abaixo-assinado/[id]` — petitions + signature counter
- `/privacidade` — privacy policy global

**Legacy editorial** (theme `editorial`):

- `/artigos`, `/[type]`, `/[type]/[category]`, `/[type]/[category]/[slug]`, ShareLink routes and `/[type]/evento.ics`

Produces a staged program (see §15), not a big-bang rewrite. The homepage stays curated; deeper material lives in dedicated surfaces.

---

## 2. Source map (read before anything else)

**Primary source — Briefing Geral de Militância (the factual spine)**

- `/home/fsolla/Code/teqo/data/briefing-geral-militancia/` is the **main source** for Jorge Solla's work, positions, and propositions. Generated 2026-09-26; workspace-only (untracked; the repo is public — never commit or paste the ledgers wholesale). In a worktree, locate the same corpus or read it from the main checkout.
- Read-friendly full document: `docs/research/briefing-geral-militancia/jorge-solla-2026-09-26-briefing-geral.md` (+ `.pdf`, `livretos/`); generated HTML at `data/briefing-geral-militancia/jorge-solla-2026-09-26-briefing-geral.html`.
- Coverage: 15 themed recortes — saúde, cultura, educação, Salvador, UFBA, trabalhadores da saúde, agricultura familiar, ciência e tecnologia, soberania nacional, democracia, LGBTQIA+, anti-racista, feminista, interior, transversais — plus `biografia.research.json` and `geral.json` (consolidated `essay` "Quem é Jorge Solla", `closing` "O pedido", `pitch.speeches`).
- Per recorte: `<slug>.research.json` / `<slug>.research2.json` are the **fact ledgers** — `items[]` with `id`, `era` (A: carreira/formação/gestão até 2006 · B: SESAB/governo Wagner 2007–2014 · C: deputado federal 2015–2027), `answer` (year/phase explicit), `brief.title`/`brief.note` (approved short-copy seeds), `numbers[]` (with `phase`), mandatory `sourceUrl` + `sourceDate`, `extraSources`, and `gaps[]`. `<slug>.briefing.v2.json` + `<slug>.intro.v2.md` are the current writing round — **prefer v2 over v1** when both exist; `defenses[]`/`essential[]` anchor to `factId` + `sourceUrl`; `qa[]` is internal objection-handling. `falas.*.json` are militant scripts (placeholders like `[seu nome]`), not website copy.
- **Traceability rule:** every factual claim that goes on the site traces to a ledger item and carries its `sourceUrl`/`sourceDate`. No ledger item = `gaps[]` = do not publish.
- **Discipline baked into the corpus — enforce it:**
  - Attribution with the right force: autoria, coautoria, relatoria, voto, articulação, and gestão are distinct; never credit collective or government results to Solla alone. The verifier contract is explicit: never "criou o SAMU" — the verified framing is that, as secretary, he took SAMU from 14 to 233 municipalities.
  - Money always with year + phase (autorizado/empenhado/liquidado/pago); never sum phases or spheres; empenho ≠ pagamento.
  - Status: projeto ≠ lei; "aprovado na Câmara" ≠ "aprovado"; re-check tramitação before go-live.
  - No electoral scenario, vote estimates, or polls in public copy (prohibited keys in the corpus). Support is support, never a vote.
  - `qa` side framing, pitches, and objections are capacitação material, not public copy — extract facts and positions, write the public text with `solla-comunicacao`.
- Contracts/provenance: `RESEARCH-CONTRACT.md` (eras, method, JSON schema), `AUTHOR-CONTRACT.md`, `DEEPEN-CONTRACT.md`, `VERIFY-CONTRACT.md`.
- The corpus is dated (2026-09-26): carry source dates and re-verify anything time-sensitive before publishing.

**Doctrine, approved copy, and site plans (reconcile against the briefing)**

- `docs/campanha/plano-site-campanha-2026.md` — narrative doctrine (§4.1.15: avanço → obstáculo → por que a eleição importa; the villain is never the current government), approved copies (§4.1.14/16), irrevocable rules (§6), pendências incl. NEEDS ASSET (§5), photo licensing map (annex).
- `docs/campanha/prompt-montagem-home.md` — approved home composition and copy. **Conflict rule:** any copy approved before the briefing that conflicts with it must be flagged and reconciled with `solla-comunicacao`/human, never silently kept — e.g. the hero sub "Criou o SAMU 192 e o Brasil Sorridente" vs the briefing's verified "levou o SAMU de 14 para 233 municípios".
- `docs/campanha/wireframe-solla-1313.html`, `AGENTS-public.md`, `docs/GUARDRAILS.md`.

**Voice and positions**

- Skill `solla-comunicacao` — tone, principles, positions. Load it before writing any copy. Apply `humanize-ai-writing` as the final pass (mandated in the plan §4.1.16).
- Dossiers (workspace-only, gitignored because the repo is public): `docs/research/dossie-solla-tema/`, `dossie-solla-instituicao/`, `dossie-solla-cidade/`, `docs/research/briefing-geral-militancia/`, generated outputs in `data/`. Read freely; **never commit their contents**. Produced by skills `.agents/skills/dossie-solla-*` and `briefing-capacitacao-solla`.
- Taxonomy for themes/topics: `src/lib/speechFacets.ts`, `src/lib/speechThemeTerms.ts`, `src/lib/speechGazetteer.ts`, `src/lib/institutionCatalog.ts`, `src/lib/publicFigureCatalog.ts`.

**Speeches / video / audio**

- `Speech` + `SpeechSegment` — ~997 Câmara speeches backfilled (54ª=1, 55ª=348, 56ª=414, 57ª=234), 947 with VOD, 924 with video, 920 with timestamped ASR; official transcript + `officialTextUrl`; YouTube/VOD URLs; curation fields `topics`, `scopes`, `mentionedMunicipalities/People/Programs/Projects`. Web speeches via `pnpm falas-web:import`; uploaded recordings in `Recording`/`RecordingSegment`.
- Public publication paths only: `SpeechCut` → `/corte/<id>`; `ContentPiece` (video/áudio/texto/foto/card) → `/conteudos`; `Jingle` → `/jingles`. Never expose `internetSpeechMedia`, `recordingMedia`, `contentMedia`, or raw `Speech` rows publicly.
- Browse/search: `/admin` (group "Comunicação"), `/campanha/comunicacao/acervo`, `pnpm acervo:index` for semantic search.

**Photos**

- `ArchivePhoto` — 6,577 Flickr originals (C231), catalogued by C232: `takenOn`, `catalog.scene`, `catalog.themes`, `catalog.people` (curated text only, never face-inferred), `catalog.municipality`, `hasPeople`, `sourceUrl`, licensing. Private — campaign access only.
- Public today: `media` via same-origin proxy `/api/media/file/...`; legacy assets in `public/`; official kit in `public/campaign-kit/`.
- Planned public surfaces (read and follow their plans, do not re-spec): `/fotos` album + facets (C233, issue #1368, `docs/plans/album-fotos-publico-busca.md`) and selfie match (C234, issue #1369, `docs/plans/busca-fotos-por-selfie.md`), each with an approved UI design HTML.
- Local photo bank cited by the plan: `/home/fsolla/Documentos/Solla/MATERIAL SOLLA/FOTOS/SELEÇÃO/`. Licensing: assets from jorgesolla.com.br are safe; third-party photos (Agência Brasil, BNews, A TARDE) need authorization.

**Design**

- `DESIGN.md` — tokens and standing visual rules; §7 Evolution is the living owner. Update it (with rationale) when a better pattern is decided.
- Approved gates: `docs/plans/*-ui-design.html` (home, cards, conteúdos, jingles, corte, álbum, selfie). Read them before proposing a new direction; if you supersede one, produce a new designer artifact and update `DESIGN.md` §7.
- `public/campaign-kit/README.md` (official palette and asset quirks) and `docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`. The kit is an archive to use, not a straitjacket.
- `docs/design-refs/`, `.impeccable/design.json`, skill `awesome-design-md` (reference library), Penpot via the `penpot` subagent (the current home geometry is Penpot-derived).

**Existing behavior to preserve** (verify live at 390px and 1280px before believing this list)

- Card studio: `src/components/cards/*`, `src/lib/cardModels.ts` (6 models), `cardRender.ts`, `stateDeputyCatalog.ts` (53), on-device cutout via MediaPipe, anonymous download telemetry (`sendCardDownloadEvent` → `/api/content-events`), `?model=` deep links.
- Forms/actions: `submitCampaignNewsletter` (`campanha-novidades`), `submitWhatsapp` (`whatsapp-inscricao`), `submitPetitionSignature`, `getSignatureCount`; transactional multi-collection writes.
- Feeds: `CampaignContentSection` merges published `Post` + YouTube + Instagram snapshots (`SocialFeedSettings` global, fail-closed with last snapshot).
- E2E to keep green: `tests/e2e/frontend*.spec.ts`, `frontendConteudos`, `frontendJingles`, `frontendShareLink`, `campaignNewsletter`, `campaignHomePixel`.

**Process**

- `.agents/rules/engineering-standards.mdc`, `.agents/rules/agent-pr-workflow.mdc`, `docs/AGENT-OPS.md`, `docs/ops/teqo-1313-deploy.md`, skills `payload-migrations` and `local-database`.

---

## 3. How to work

Use sub-agents to keep the main context lean. The main agent owns creative direction, decisions, integration, and final verification.

- **`designer`** — creates/critiques the hi-fi artifacts. One session for the batch of UI items. `designer-campanha-solla` for campaign-site design questions; `designer-degraded` only as declared fallback (marked `DEGRADED`, human sign-off required). Never skip design silently.
- **`explore`** — codebase mapping. **`general`** — bounded research. **`penpot`** — geometry from Penpot. **`postgres`** — read-only local DB queries. **`solla-comunicacao`** — voice review of copy. Dossier researcher agents for bounded dossier extraction.
- Give each sub-agent a narrow objective, the exact source paths, constraints, and an output format. **Artifacts on disk, summaries in chat:** findings go to `docs/plans/<program-slug>-*.md` (committed) or a scratch directory (uncommitted); the return message is concise with file paths, exact filenames, and video timestamps.
- Parallelize independent work; keep dependent decisions sequential. Assign file ownership to avoid concurrent edits to shared styles, routing, or dependencies. Main agent reconciles and verifies the integrated result.
- Maintain a running program record: plan, design decisions, selected content/media with sources, preserved functionality, verification results. It must be enough to resume after compaction.

---

## 4. Phase 0 — audit, program plan, design direction (the gate)

Before changing anything:

1. **Audit** the live site and the repo. Produce an inventory of routes, navigation, deep links, content sources, integrations, forms/consent, media controls, downloads, generated-card outputs, metadata/social previews, and the exact contracts to preserve. Record it. Also cross-check every current claim and approved copy (live site, `plano-site-campanha`, `prompt-montagem-home`, gated designs) against the briefing ledgers. Produce a reconciliation list: claim → ledger `factId`/`sourceUrl`, or unsourced/outdated/conflicting (with the suggested correction). This list is a deliverable and the input for copy revision.
2. **Program plan**: break the mission into shaped slices (campaign home/shell, editorial surfaces, kit wizard, `/fotos` album, selfie match) with acceptance criteria, appetite, and dependencies. Write it to `docs/plans/`.
3. **Design direction**: have the `designer` produce the hi-fi artifacts for the first slices — real tokens, real copy, scenes at 390/1280, critical states (empty, loading, fail-closed). These artifacts are the source of truth for implementation.
4. **Present the audit, plan, and artifacts for explicit approval** before porting. Routine engineering decisions are yours; material visual changes wait for the gate.

Then execute slice by slice (§15).

---

## 5. Content and narrative rules

- **Curation over volume.** Choose material for relevance, clarity, visual quality, and narrative contribution. Let strong discoveries influence design. If you cannot review everything, prioritize a representative selection and record coverage.
- **The briefing is the factual spine.** Public copy states facts traceable to a ledger item, with the source's own force: attribution level correct, money with year + phase, status current. Internal Q&A framing and pitches never become public copy. Where the briefing and older approved copy disagree, the briefing wins and the conflict is flagged.
- **Source-grounded case studies.** For public work: issue, Solla's role, action, date, documented status/result, link to source. Keep proposal vs. approved vs. delivered visibly distinct.
- **Approved copy is preserved in meaning.** You may improve structure/readability and write new source-grounded summaries; revisions to approved texts go through `solla-comunicacao`.
- **Dated history.** Historical statements stay dated; past positions are not presented as current commitments.
- **No invented assets.** Testimonials stay `NEEDS ASSET` until real ones (name + city + photo) exist. Missing photos are flagged, never replaced with stock imagery.
- **Conversion doctrine:** one primary CTA per page; WhatsApp (`wa.me`) is the main conversion channel; donations only via `apoiar.me/jorgesolla` (never processed in-app); minimum form fields; never CPF/address in the first interaction; mobile-first with inputs ≥16px and touch targets ≥44px.
- **Electoral footer identification** stays (name, 1313, federation, CNPJ, election date).

---

## 6. Page narrative and per-surface requirements

### Campaign home

- **Opening:** memorable composition around Solla's portrait or documentary footage, name/office/number/approved message. Recompose mobile deliberately. No intro sequence that delays access.
- **Principles and priorities:** editorial sequence pairing positions with photos or speech excerpts; sticky heading/image on desktop, natural vertical reading on mobile.
- **Public work:** source-grounded case studies.
- **Biography/trajectory:** dossier + photo archive; integrate the existing biography video; timeline only where dates and material are accurate.
- **Speeches and video:** small selection of substantive excerpts with titles, dates, captions, and full-source links; browsable collection via existing `/conteudos` (never hundreds of players on one page).
- **Updates:** restyle posts + YouTube + Instagram into a coherent board; preserve sources, snapshots, destinations, and electoral pull-down.
- **Campaign media and participation:** radio, jingles (+downloads), card studio entry, WhatsApp CTA, newsletter.
- **Footer:** identification, privacy, official links.

### Editorial surfaces

Restyle `/artigos`, type/category listings, article detail, and ShareLink pages into the same editorial language while preserving: canonical URL redirects, JSON-LD (`Article`), OG metadata, ISR caching and `posts` revalidation, and the hidden-tag pull-down. Never translate the `type` enum values or SEO slugs — they are data.

### Deep links and metadata

Preserve every public URL and anchor behavior (`#cards`, `?model=`, ShareLinks, `.ics`). Update metadata/social previews where the redesign requires, keeping canonical and OG correctness.

---

## 7. New flow — Support Kit (guided wizard over `/cards`)

Build a **guided, step-by-step support-kit flow** that extends the existing card studio (`src/components/cards/*`, `src/lib/cardModels.ts`, `src/lib/cardRender.ts`). Do not create a second renderer or a parallel tool: the wizard is orchestration over the existing models, rendering, cutout, and download paths.

**Steps (progressive disclosure — each step previews only the pieces whose inputs are already satisfied):**

1. **Nome** (required for name pieces) — validates like the current name flow (60 chars, fitted two-line/banner logic), live preview of `eu-sou-solla`.
2. **Foto de perfil** (optional; enables photo pieces) — local file only; on-device cutout + tone harmony (reuse `useCardCutout`/MediaPipe); previews `perfil-quadrado` and `perfil-retangular`. **The photo never leaves the browser.** Skip is allowed.
3. **Dobradinha** (optional) — "Você já tem candidato(a) a deputado(a) estadual?" → picker over `stateDeputyCatalog.ts` (53). Chosen: preview `time-do-estadual`; not chosen: preview `time-de-voce`. `minha-colinha` follows the existing input rules in `cardColinha.ts` (verify, don't assume).
4. **Kit completo** — grid of every generated piece with thumbnails; download individually and a "baixar todo o kit" action. Keep the existing file-naming contract and the anonymous download telemetry (`sendCardDownloadEvent`). Decide the batch-download mechanism at implementation; justify any new dependency (a zip via `CompressionStream` or sequential downloads are acceptable).
5. **Fotos com o Jorge Solla** (only when the C234 gate is open — §8) — after the selfie step, show the matches found in the public album, a few thumbnails, and "ver todas" leading to the full result in `/fotos`; honest empty state when there are none. No score, no third-party names.

**Acceptance:**

- Skipped inputs never render unfinished art.
- Back/forward keeps entered state; the flow is resumable without losing work.
- Deep links (`?model=`, home `#cards` embed) keep working; the wizard is an _additional_ path, not a replacement.
- Accessible: labels, focus order, keyboard, error recovery (bad file type/decoder failure), reduced motion.
- Mobile drawing parity with desktop.
- If the flow ever captures name/WhatsApp for follow-up, it uses the Consent-by-key + transactional `Contact`/`Subscription` pattern — otherwise nothing is persisted.

---

## 8. `/fotos` album and selfie match — C233/C234 behind their gate

Both features are already shaped with owner plans and approved UI artifacts. **Read and follow them** — they are the spec; do not re-invent the flows or their guardrails:

- `docs/plans/album-fotos-publico-busca.md` (C233, #1368) — public `/fotos`: browse/search by date, municipality, activity, public person (curated catalog only), and term; only curation-approved photos; removal channel ("é você nesta foto? peça a remoção"); honest empty state; no vanity metrics; same-origin media proxy; cache tag + revalidation allowlist.
- `docs/plans/busca-fotos-por-selfie.md` (C234, #1369) — selfie match: consent fail-closed by stable key (without the approved row the flow does not open, not even in the UI); selfie processing on-device by default (server receives at most the vector, never the image); **no score/percentage**; **no third-party names**; antiabuse rate limit; removal/opt-out with a registered human queue; result is only the approved public album.

**Hard dependencies and gates:**

- C231/C232 must have produced catalogue data; C233 must exist before C234 adds the selfie step. Implement in that order.
- The consent row for the selfie flow is created only with **recorded legal review + DPIA**. If that approval is not registered, do not seed the row — the existing fail-closed mechanism keeps the surface dark, and the human gate decides when it opens.
- Election calendar (04/10/2026): the C233 plan recommends **not opening new public surfaces in the final days of the campaign**. Surface this to the human gate; default to closed. Never fake an approval.
- Never cross the facial index with `Contact`/leadership, never identify third parties, never build a face directory or social features.

---

## 9. Video and photographic storytelling

- Every selected speech excerpt records the original source, date, and exact time range (use `SpeechSegment` timestamps; verify captions against audio). Choose excerpts that complete a thought; never splice remarks into a new statement.
- Two treatments: **decorative footage** (short muted loop, immediate poster, visible pause) and **substantive speech** (user-initiated, captions, title, full-source link).
- Decorative media never autoplay sound; radio and audio are always user-initiated. Respect reduced motion.
- Never present unrelated photos as documentation of an achievement. Missing production assets are identified, never faked. If editing tools are available, produce optimized clips/posters; otherwise deliver an exact edit list.

---

## 10. Creative direction

Create a modern editorial/documentary aesthetic: confident typography, authentic photography, deliberate color, generous spacing, purposeful motion. Visitors must quickly grasp who Solla is, what he stands for, what he has done, what he intends to pursue, and where the evidence lives.

- Preserve the campaign identity: official logos, number 1313, brand colors (extract from `public/campaign-kit/`, refine application using `DESIGN.md`).
- References to study (when browsing is available): `zohranfornyc.com` (campaign identity), `patagonia.com/films` (documentary storytelling), `lusion.co` (intentional motion). Also use `docs/design-refs/` and `awesome-design-md` locally. Borrow craft, develop an original composition.
- Strong display typeface paired with readable body type; consistent tokens for type, spacing, color, interaction. The existing fonts are Inter/Exo 2/Arimo (+ Brexter for card canvas).
- Build visual rhythm through varied compositions (expansive photography, color fields, asymmetry, editorial passages, compact factual summaries, framed video). Avoid repeating one card grid everywhere.
- Use authentic archival assets; preserve faces and context when cropping; deliberate mobile crops; identify missing assets.

---

## 11. Motion

One signature interaction, supported by a restrained system.

- Suggested signature: as visitors scroll principles/public work, successive text chapters pair with changing photographs — sticky image area on desktop, inline imagery on mobile.
- Supporting motion: brief hero stagger; section reveals with opacity + ~16–24px movement; occasional photo reveals; crisp hover/focus/pressed states; compact sticky navigation; smooth expanded-content transitions.
- Timing: ~450–650ms for larger reveals, 150–220ms for control feedback; consistent and interruptible.
- Avoid scroll hijacking, long loaders, custom cursors, excessive parallax, content-obscuring effects.
- Respect `prefers-reduced-motion`; provide static equivalents and pause controls for decorative movement. Essential content must survive animation failure.

---

## 12. Performance, accessibility, maintainability

- Mobile layouts deliberate: readable type, comfortable targets, sensible section lengths, careful crops. Loading budget from the plan: <3s.
- Semantic headings, accessible names, keyboard navigation, visible focus, readable contrast. Sticky elements must not obscure focused controls or anchor destinations.
- Responsive images with reserved dimensions, immediate video posters, lazy-loaded nonessential media, no layout shift. Same-origin media proxy and Next image allowlist respected.
- Keep content and tokens easy to maintain; reuse existing CMS patterns; no unnecessary dependencies.

---

## 13. Preserve working behavior

Maintain existing URLs/deep links, integrations, content sources, form validation, consent choices, media controls, download behavior, and generated-card outputs. Preserve metadata/sharing previews, updating them only where the redesign requires.

Do not replace genuine integrations with mock success states. Every visible action must work or be explicitly identified as incomplete. Do not submit real supporter data or trigger external communications during verification — use local/test facilities.

---

## 14. Verification and proof

For each slice:

1. Inspect the rendered result at 390px and 1280px (element screenshots; the campaign home has a nested scroll container, so full-page captures truncate).
2. Run the touched e2e specs plus `pnpm test:e2e:affected`.
3. Run `pnpm gate:fast`, then `pnpm push` (which runs `gate:ci`). Never pipe gate commands.
4. Have the `designer` critique the rendered implementation against the approved artifact (`web-design-guidelines` findings with `file:line` where it is code).
5. Verify critical interactions manually: signup, consent refusal states, audio playback, downloads, kit generation (name/photo/dobradinha paths), `/fotos` facets, selfie refusal when the consent row is absent.
6. Record evidence: what changed, what was verified, what remains limited, what needs production (assets, legal, captions).

Never verify against production data or write to production.

---

## 15. Delivery

Execute as staged PRs; each UI slice gets its design artifact before porting:

- **Phase 1** — audit + program plan + design direction (gate).
- **Phase 2** — campaign shell + home.
- **Phase 3** — editorial surfaces.
- **Phase 4** — support-kit wizard (independent of C234).
- **Phase 5** — `/fotos` album (C233).
- **Phase 6** — selfie match (C234), gated and dark until approval.

**Definition of done per PR:** artifact approved; implementation ported; gates green; touched e2e green; preserved contracts re-verified; changelog entry added; PR description states design tier (if applicable), what changed, evidence, and remaining limitations; staging deploy green. Production publication is a separate, human-approved step.

**Deliverables:** mergeable PRs with a working staging preview; a concise record of visual/structural changes; the selected content/media map with sources; verified functionality and limitations; missing assets/production work.

---

## 16. When to ask

Decide routine design and engineering matters autonomously. Ask only when genuinely blocked, and be specific:

- Legal/DPIA status for the selfie surface (and the election-timing decision).
- Real testimonial assets and third-party photo licenses.
- Whether the redesign may supersede an approved design gate (if yes, it gets a new artifact).

If repository access is missing, explain what is needed — never build a disconnected replacement and present it as a modification of this app.
