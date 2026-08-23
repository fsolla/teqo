# OPS46 — Infra de teste e2e: e2e local não coleta (next/cache) + allocator de município com wrap

Status: implementado
Atualizado em: 2026-08-23
Issue: #733
Impl plan do plano de intenção: `docs/plans/ops46-infra-teste-e2e-local-allocator.md`

## Fase 1 — e2e local não coleta (`Cannot find module 'next/cache'`)

### Causa raiz (medida)

- `next@15.4.11` não declara `exports` no package.json → ESM nativo do Node
  **nunca** resolve o subpath `next/cache` (o arquivo existe como `cache.js`,
  mas ESM não tenta extensões — `ERR_MODULE_NOT_FOUND` com "Did you mean to
  import next/cache.js?").
- `server-only` (0.0.1) resolve `index.js` (que lança) sem a condição de
  export `react-server` (`--conditions=react-server`).
- `pnpm test:e2e` carrega ambas as correções via
  `NODE_OPTIONS="--no-deprecation --conditions=react-server --import=tsx/esm"`
  — por isso o CI passa: o CI nunca roda `playwright` bare, sempre via script.
  Qualquer invocação bare (extensão VS Code, `pnpm exec playwright test
--list`, runs ad-hoc) quebra na coleta.
- CI vs máquina: sem delta — o CI usa o mesmo comando com os mesmos flags;
  a hipótese do plano ("investigar o que difere no ambiente CI") se resolveu
  em "nada difere — o CI só roda pelo script".

### Abordagem implementada (aprovada no GATE)

Fix no nível do runner, zero mudança em código de produção:

1. `tests/helpers/e2eEsmResolve.mjs` — hook de resolução ESM com 2 rewrites:
   - `next/cache` → `next/cache.js` (entry oficial, TS mapeia para `cache.d.ts`);
   - injeta `react-server` nas `conditions` de resolução (equivalente exato do
     flag `--conditions=react-server`, aplicado em runtime via `nextResolve`).
2. `tests/helpers/e2eEsmLoader.mjs` — entry `--import` que registra a hook
   (o padrão do tsx: `--import` só funciona se o módulo chamar `module.register`).
3. `playwright.config.ts` — quando `NODE_OPTIONS` **não** tem
   `--conditions=react-server` (invocação bare): `register()` a hook no
   processo main (a coleta do `--list` acontece aqui, pós-load do config) e
   propaga `--import=<loader>` via `NODE_OPTIONS` para os workers (herdam o
   env no spawn). Com os flags presentes (script), nada muda.

### Opções rejeitadas

- `next/cache` → `next/cache.js` na fonte (~40 arquivos): toca código de
  produção para um problema de infra de teste e não resolve `server-only`
  (o comando bare continuaria quebrando); não idiomático.
- Patch do `next` via pnpm `patchedDependencies` adicionando `exports`:
  exports parcial quebra qualquer subpath não listado; frágil por versão.
- `--import`/flags no script apenas + documentar: não satisfaz o aceite
  (`pnpm exec playwright test --list` coleta na máquina do humano).

### Verificação Fase 1

- `pnpm exec playwright test --list` (bare, sem flags): **198 testes em 41
  arquivos** (antes: `Total: 0 tests in 0 files`).
- Run real bare `--project=admin`: **5 passed** (workers com a hook).
- Run real bare `--project=campaign` `campaignHomeActions`: **18 passed**.
- `pnpm test:e2e --list` (script, flags): inalterado, 198.

## Fase 2 — allocator de município com wrap destrutivo

### Medição (plano: "medir primeiro")

- Claims por ciclo completo num DB persistente: **~505** (432
  `getMunicipality()` no int + 73 `claimMunicipality()` no e2e) > 435 do
  catálogo → o wrap acontece em **todo** ciclo de suíte completa. Bug agudo
  (não teórico): após o wrap, dois runs concorrentes podem receber o mesmo
  índice e o purge-on-claim de cada um apaga as linhas vivas do outro.

### Abordagem implementada

Registry de claims em módulo compartilhado vitest-free
`tests/helpers/campaignMunicipalityAllocator.ts` (mesma convenção do
`campaignResidue.ts` — importável pelo processo Playwright do e2e):

- Tabela `campaign_fixture_municipality_claims` (`index` PK, `run_id` text,
  `claimed_at` timestamptz default now()) criada lazy com a sequence
  (`CREATE IF NOT EXISTS`, corrida 23505 tolerada).
- `claimMunicipalityIndex(payload, catalogSize, runID)`: `nextval` → índice →
  `INSERT ON CONFLICT ("index") DO NOTHING RETURNING`; conflito = run vivo
  segura o slot → pula; claim **stale** (TTL 2h, run crashado) → rouba e
  retenta; tudo ocupado por claims vivos → erro claro ("exhausted") em vez
  de colisão silenciosa.
- `releaseMunicipalityClaims(payload, runID)`: `DELETE WHERE run_id` — chamado
  no `cleanup()` de ambos os fixtures (int `CampaignFixtures.cleanup`,
  e2e `CampaignE2EOwnership.cleanup`), só quando o fixture claimou
  (Set `claimedMunicipalityIndexes` — cleanup sem claims não toca a tabela).
- O fixture int perdeu o allocator inline (`nextAllocatedMunicipalityIndex`
  - a sequence própria); o e2e idem (CREATE SEQUENCE + nextval inline).

### Guards e testes

- Guard estático novo no `testMunicipalityAllocatorConventions.unit.spec.ts`:
  proíbe `nextval(`/`campaign_fixture_municipality_alloc` em `tests/int`,
  `tests/e2e` e `tests/helpers` fora do módulo do allocator — todo claim passa
  pelo registry.
- Spec int comportamental `tests/int/campaignMunicipalityAllocator.int.spec.ts`
  (catalogSize sintético, robusto a concorrência da suíte paralela):
  1. exclusividade viva através de múltiplos wraps (âncora segura 1 slot por
     120 claims de runs efêmeros > 3 wraps do espaço de 40);
  2. exaustão (erro claro) + recuperação após release;
  3. steal de claim stale (envelhecida 3h);
  4. release libera slots para reuso.

### Verificação Fase 2

- Spec do allocator: 4/4 verdes, estável em re-runs.
- Suíte int completa: **92 arquivos / 819 testes, todos verdes** (o fixture
  refatorado claima ~432 municípios sob 8 workers paralelos).
- Tabela de claims **zerada** ao final da suíte (release funcionando).
- e2e campaign (`campaignHomeActions`, wizard com claims reais): 18/18, claims
  zeradas após o run.

## Riscos e notas

- A hook depende de `module.register` (estável desde Node 20.6); só ativa em
  invocações bare — o path do script (`pnpm test:e2e`) fica intocado e é o
  fallback se algo mudar.
- TTL 2h > duração de qualquer run vivo; claim crashado bloqueia slots até o
  TTL (erro de exaustão menciona o prazo).
- Um run vivo não pode claimar mais de `catalogSize` slots (a própria
  exclusividade exaure) — correto por design; fixtures reais liberam por
  teste.
- Durante a entrega, o `--list` bare regenerou o `importMap.js` sem envs
  `S3_*` (classe OPS69/OPS70 #87, já documentada) — restaurado com
  `generate:importmap` + envs dummy.

## Aceite

- [x] Fase 1: `pnpm exec playwright test --list` coleta na máquina do humano
- [x] Fase 2: sem colisão de claim após N wraps (stress test com wraps reais)
- [x] Guards: `testMunicipalityAllocatorConventions` verde após a mudança
