# Impl: OPS119++ — blast radius de scripts/: risk map das libs restantes + static scope

Status: em execução
Atualizado em: 2026-09-16
Gate: aprovado pelo humano (superset unit+int, 42 paths — confirmado 2026-09-16)
Issue: #1077
Intencao: docs/plans/escala-dry-pos-scripts-blast-radius.md
Appetite restante: herdado (~1h eng) - F1 ~35min + F2 ~15min + gates ~10min, sem corte
Impeccable: A - N/A (CLI/CI, sem superficie de produto) - no designer dispatch

## Leitura da intencao

- **Outcome:** fechar a classe S6 remanescente da OPS119+ (#1071) para o resto de
  `scripts/`. F1: qualquer modulo `scripts/**` alcancavel por um spec (transitivo)
  deve ser high-risk, fail-closed - um diff so-lib nao pode mais classificar
  `classifyTestScope` como `none` e deixar de rodar a unit que cobre o modulo
  (ex.: `scripts/lib/worktree-env.mjs`, pinada por `tests/unit/worktree.unit.spec.ts:16`
  e importada por `scripts/lib/auto-unblock.mjs:10`, hoje classifica `none`). F2:
  `isCodePath` (`scripts/lib/test-affected-core.mjs:134`) deve cobrir `scripts/`
  para que `classifyStaticScope` devolva `code` e destrave typecheck/knip/cycles
  num diff so-scripts.
- **O que NAO negociar:** risco e integridade de guard (blast radius fail-closed),
  nao refactor; Impeccable A (CLI/CI); appetite ~1h; sem migration, sem
  schema/Consent/access, sem URL publica/API, sem UI; a alternativa rejeitada na
  intencao-mae (prefixo `scripts/lib/` inteiro em `HIGH_RISK_EXACT`) nao pode
  voltar. Pins so chamam `.has()` - `HIGH_RISK_EXACT` continua sendo um `Set`
  exportado; nenhum pin afirma que um path de `scripts/` NAO e high-risk.
- **O que reavaliar:** (1) "invariante derivado" NAO pode derivar em tempo de
  import - `test-affected-core.mjs` e documentado puro (`:2-6`: "No git, no fs,
  no process"), entao a lista segue literal e o que "deriva" e um **teste de
  invariante fail-closed** que anda o grafo de imports dos specs e exige o
  fechamento contido em `HIGH_RISK_EXACT`; (2) "spec unit" literal (41 paths) vs
  todas as arvores de spec (`tests/unit` + `tests/int`, 42 paths - so acrescenta
  `scripts/cityReportSnapshot.mjs`, importado por `tests/int/cityReportSnapshot.int.spec.ts:16`);
  (3) "append direto" vs grupo nomeado nao-exportado (`SCRIPTS_SPEC_PINNED`) -
  o grupo documenta o bloco e evita knip dead-export.

## Abordagem recomendada

```mermaid
flowchart LR
  spec[specs tests/unit + tests/int] -->|walker fs+regex| graph[grafo de imports]
  graph -->|closure restrita a scripts/**| closure[scripts reachable]
  closure -->|assert subset| HRE[HIGH_RISK_EXACT]
  HRE --> classifyTestScope
  classifyTestScope -->|full| full[unit+int full / e2e curated]
  isCodePath -->|startsWith scripts/| classifyStaticScope
  classifyStaticScope -->|code| static[typecheck+knip+cycles]
  pin1[testAffected.unit.spec] -->|classify full| isCodePath
  pin2[ciSkipInvariants.unit.spec] -->|invariante do grafo| closure
```

**Opcoes consideradas:** A | B | C
**Recomendacao:** A - manter `HIGH_RISK_EXACT` literal e adicionar um **teste de
invariante fail-closed** (`tests/unit/ciSkipInvariants.unit.spec.ts`) que anda o
grafo de imports dos specs via `fs`+regex (test-only), calcula o fechamento
transitivo restrito a `scripts/**` e afere `closure subset HIGH_RISK_EXACT`,
falhando com a lista de faltantes. Porque `test-affected-core.mjs` e puro por
contrato (nao pode ler o repo em tempo de import), o "invariante derivado" so
existe como teste; o teste **e** o que mata a classe na raiz - uma lib nova
pinada por spec sem entrada no mapa quebra o invariante no PR que a adiciona, em
vez de abrir o buraco em silencio. Escopo: **superset** de todas as arvores de
spec (42, inclui `scripts/cityReportSnapshot.mjs` do int), divergencia deliberada
do "spec unit" literal da intencao (41) - mesmo walker, +1 entrada, fecha a mesma
classe S6 tambem para int; confirmar no gate.
**Rejeitadas:** (B) estender o allowlist literal apenas com os arquivos
conhecidos **sem** o teste de invariante - e literalmente a opcao rejeitada na
intencao-mae: reabre o buraco a cada lib nova; (C) prefixo `scripts/lib/`
inteiro - engole as ~40 libs `scripts/lib/*.mjs` sem harness e forca `full` em
diffs triviais, rejeitado na intencao; (D) modulo de dados gerado/commitado com o
closure - mesma indirecao extra, mesmo teste de sincronia necessario, sem ganho
sobre a lista literal + invariante.

### Decisoes de engenharia

- **Forma do invariante: derivacao em import vs teste fail-closed.** Opcoes: A)
  teste que anda o grafo e afere subset; B) exportar o closure do modulo puro; C)
  manter literal sem teste. Recomendacao: A - e a unica forma compativel com o
  contrato "pure, no fs" do dono (`test-affected-core.mjs:2-6`); o custo de CI e
  zero (roda na suite unit normal). Rejeitadas: B porque o modulo puro nao pode
  ler o repo e um valor derivado de dado externo exigiria injecao/codigo gerado
  (opcao D acima); C porque repete a opcao B da intencao (reabre o buraco).
- **Escopo do walker: so unit vs unit+int.** Opcoes: A) so `tests/unit` (41,
  palavra literal da intencao); B) todas as arvores (`tests/unit` + `tests/int`,
  42). Recomendacao: A superset B - o espec importador `tests/int/cityReportSnapshot.int.spec.ts:16`
  adiciona exatamente um path (`scripts/cityReportSnapshot.mjs`); mesmo walker,
  fecha a mesma classe para int. Rejeitadas: A sozinho deixaria um modulo
  int-pinado de fora por fidelidade literal ao texto, sem ganho de seguranca;
  divergencia registrada para o gate.
- **Shape da lista: append direto vs grupo nomeado nao-exportado.** Opcoes: A)
  acrescentar os 33 paths soltos no fim de `HIGH_RISK_EXACT`; B) criar
  `const SCRIPTS_SPEC_PINNED = [ ... ]` **nao exportado**, documentando o bloco, e
  espalhar (`...SCRIPTS_SPEC_PINNED`) dentro do `new Set([...])`. Recomendacao: B
  - o bloco de ~40 scripts fica legivel/documentado como "modulos scripts/
    pinados por spec" e nao vira export novo (evita dead-export do knip). O grupo
    **nao** e exportado; o que os pins consomem continua sendo `HIGH_RISK_EXACT`.
    Rejeitadas: A reduz a legibilidade do mapa mas e funcionalmente identica; nao
    ha razao para carregar 42 entradas soltas. Gatilho de revisao: se um pin
    precisar do subconjunto puro, exportar com pin proprio.
- **F2: `path.startsWith('scripts/')` vs lista exata de scripts.** Opcoes: A)
  prefixo `scripts/` em `isCodePath`; B) enumerar os scripts relevantes.
  Recomendacao: A - `isCodePath` ja opera por prefixo/categoria (`src/`, `tests/`,
  `eslint*`, `knip*`); todo `.mjs` de `scripts/` e codigo de ferramenta e afeta
  typecheck/knip/cycles, entao a categoria e a granularidade certa. Rejeitadas: B
  por manutencao (nova lib so-scripts voltaria a ficar de fora) e por contrariar
  o padrao do predicado; `classifyBuildScope` fica intocado (`isBuildPath` nao
  inclui `scripts/`).
- **Divergencia unit vs unit+int.** Registrada acima; decisao do gate, nao do
  agente. Se o gate exigir fidelidade literal, cai-se para o subconjunto de 41
  removendo 1 path do grupo - reversao barata e mecanica.

### Componentes / mudancas

- **`HIGH_RISK_EXACT` / `SCRIPTS_SPEC_PINNED`** (`scripts/lib/test-affected-core.mjs:25-56`):
  novo `const SCRIPTS_SPEC_PINNED` nao-exportado com os modulos `scripts/**`
  alcancaveis por specs (8 ja cobertos + 33 faltantes + `cityReportSnapshot.mjs`);
  espalhado no `new Set([...])`. Os 33 faltantes (`scripts/lib/...` salvo
  indicacao): `agent-forgejo.mjs`, `agent-plan-lifecycle.mjs`,
  `agent-pool-cursor.mjs`, `agent-pool-eligibility.mjs`, `agent-pool-models.mjs`,
  `agent-pool-prompt.mjs`, `agent-pool-state.mjs`, `ansi.mjs`, `auto-unblock.mjs`,
  `camaraSpeeches.mjs`, `changelog.mjs`, `cityReportBlocks.mjs`,
  `cityReportDatabase.mjs`, `cityReportFormat.mjs`, `cityReportRender.mjs`,
  `cityReportResearch.mjs`, `cityReportTerritory.mjs`, `conflictMarkers.mjs`,
  `db-start.mjs`, `deploy-trigger.mjs`, `github-api.mjs`,
  `github-branch-protection.mjs`, `github-pr-flow.mjs`, `imageFill.mjs`,
  `imageResize.mjs`, `issues-panel.mjs`, `markdown-ansi.mjs`,
  `playwright-e2e-args.mjs`, `portalTransparenciaEmendas.mjs`,
  `sollaCeuciSalvadorMetrics.mjs`, `testing-audit-metrics-core.mjs`,
  `worktree-env.mjs`, `wpArticles.mjs`; mais `scripts/cityReportSnapshot.mjs` (int).
  Nao-reachable confirmados e deixados fora: `scripts/lib/agent-pool-forgejo.mjs`,
  `camaraFetch.mjs`, `topology.mjs`.
- **`isCodePath`** (`scripts/lib/test-affected-core.mjs:134-143`): acrescentar
  `if (path.startsWith('scripts/')) return true`; `classifyStaticScope` passa a
  devolver `code` para diff so-scripts. `classifyBuildScope`/`isBuildPath`
  intocados.
- **Pins:** `tests/unit/testAffected.unit.spec.ts` (loop `:22-35` + caso
  `classifyStaticScope`), `tests/unit/ciSkipInvariants.unit.spec.ts` (novo `it`
  do invariante do grafo + pin comportamental de `classifyTestScope` para
  `scripts/lib/worktree-env.mjs`, e pin de `isCodePath('scripts/...')`).
- **Changelog:** `docs/changelog/2026-09-16-ops119plusplus.md` (follow-up nomeado
  pela entrada `2026-09-16-ops119plus.md`).
- **Migration:** sem migration.
- **Access / Consent:** n/a.
- **UI:** Impeccable A - N/A; no designer dispatch.

### Dados -> forma (se aplicavel)

N/A - sem superficie de produto; o "dado" e a lista de paths, cuja forma
(grupo nomeado nao-exportado + `Set` exportado) foi decidida acima.

## Fases verificaveis

1. **F1 - risk map (~35min).** Introduzir `SCRIPTS_SPEC_PINNED` em
   `scripts/lib/test-affected-core.mjs` com os 42 paths (41 + `cityReportSnapshot.mjs`),
   espalhar em `HIGH_RISK_EXACT`; novo `it` em
   `tests/unit/ciSkipInvariants.unit.spec.ts` que anda `tests/unit/**` + `tests/int/**`,
   extrai imports estaticos relativos (`from './x.mjs'`/`from '../...'`), calcula o
   fechamento transitivo restrito a `scripts/**` e afere
   `closure.filter(p => !HIGH_RISK_EXACT.has(p))` vazio (falha listando os
   faltantes); acrescentar o mesmo caso comportamental
   `classifyTestScope([{ path: 'scripts/lib/worktree-env.mjs', status: 'M' }]).mode === 'full'`.
   Verificacao: invariante verde com o mapa novo; e removendo mentalmente uma
   entrada o teste falha (provado no PR). `pnpm test:unit` verde.
2. **F2 - static scope (~15min).** Extender `isCodePath` com
   `path.startsWith('scripts/')`; pins `isCodePath('scripts/lib/cli.mjs') === true` e
   `classifyStaticScope([{ path: 'scripts/lib/cli.mjs', status: 'M' }]).mode === 'code'`
   em `ciSkipInvariants`/`testAffected`. Verificacao: `pnpm test:unit` verde;
   `classifyBuildScope` segue `none` num diff so-scripts (pin de nao-regressao se
   barato).
3. **Gates (~10min).** `pnpm gate:fast` (lint + typecheck + unit); `pnpm push`.
   Sem migration e sem e2e novo (Impeccable A, sem superficie de produto).

## Rabbit holes / Nao escopo (engenharia)

- Prefixo `scripts/lib/` inteiro em `HIGH_RISK_EXACT`: rejeitado na intencao
  (engoliria libs sem harness e forca `full` em diffs triviais). O que entra e
  exatamente o fechamento alcancavel por specs, nao o diretorio.
- Invariante de existencia em disco repo-wide sobre toda a lista
  `HIGH_RISK_EXACT`/`HIGH_RISK_PREFIXES`: named follow-up da OPS119+, fora do
  appetite; aqui so o invariante de cobertura do grafo.
- Walker com parsing real de AST/aliases/dynamic import: regex de `import`
  estaticos e suficiente para o contrato (specs importam libs relativas); se um
  dia houver alias/dynamic import, o invariante falha fail-closed (nao ve a
  aresta -> ainda pode sub-reportar; ver Riscos).
- Tocar `classifyBuildScope`/`isBuildPath` para `scripts/`: fora - `build_mode`
  segue `none`, nao e o achado.
- Guard `isMain` em scripts, S1/S2/S3, prefill upstream, UI/Consent/access:
  fora, conforme a intencao.

## Riscos e mitigacao

- **Walker sub-reporta (falso verde).** Regex que perde uma aresta de import
  (alias, dynamic import, re-export) encurta o closure. Mitigacao: o `it` inclui
  um **self-check** que assere arestas conhecidas, **direta**
  (`scripts/lib/worktree-env.mjs`) e **transitiva** (`scripts/lib/cityReportTerritory.mjs`
  so alcancavel via outro modulo `scripts/`); a travessia segue toda aresta
  relativa (nao so as que caem em `scripts/`), entao um import via
  `tests/helpers`/`src/` tambem entra. Se um alias aparecer, o self-check quebra
  primeiro.
- **Custo de CI sobe em diff so-scripts.** Adicionar ao mapa faz um diff
  so-`scripts/` rodar **unit+int full** e e2e **`curated`** (6 specs congeladas,
  OPS86); `build_mode` segue `none` (`isBuildPath` nao inclui `scripts/`).
  Precedente: OPS119+ ja aceitou isso para as 3 libs de launch. Mitigacao:
  esperado e desejado (fail-closed); registrar no changelog; nao ampliar alem do
  fechamento alcancavel por specs.
- **`HIGH_RISK_EXACT` estoura/degrada leitura.** ~42 entradas + grupo nomeado.
  Mitigacao: `SCRIPTS_SPEC_PINNED` documentado e **exportado** (consumido pelo
  invariante; knip limpo), com o overlap de 8 paths explicado no doc do grupo.
- **Entrada high-risk morta por rename.** Mitigacao: o invariante e de
  **igualdade** — o half `stale` (`SCRIPTS_SPEC_PINNED` fora do closure) falha
  numa entrada que nao e mais alcancavel. Existencia em disco repo-wide sobre
  todo o `HIGH_RISK_EXACT` segue debito diferido (abaixo).

## Debitos diferidos (triagem /simplify)

Triagem autonoma dos achados dos 2 revisores; nenhum vira Issue nova (nenhum
`expensive_lock` score >=4 — a integridade do guard ja e fail-closed).

- **A (score 2, cheap_polish) — `STATIC_IMPORT_RE` sem boundary**: casa
  `from './x.mjs'` em comentario/string. Direcao fail-closed (so adiciona
  pin/aresta inexistente), nunca falso verde. Gatilho: primeira falha do
  invariante por import relativo comentado/em string.
- **D (score 3, defer_trigger) — closure cobre unit+int, nao e2e**: um
  setup/spec e2e que importe um modulo `scripts/**` fora do mapa nao seria
  pinado (hoje o unico, `seed-minimal-manifest.mjs`, ja e high-risk). Gatilho:
  primeiro import de `scripts/**` por um spec/setup e2e fora do mapa.
- **E (score 3, defer_trigger) — existencia em disco repo-wide** sobre todo o
  `HIGH_RISK_EXACT`/`HIGH_RISK_PREFIXES` (alem do grupo scripts, que o `stale`
  ja cobre). Ja nomeado na intencao-mae. Gatilho: primeira entrada high-risk
  morta fora do grupo scripts.
- **B/C descartados**: overlap de 8 paths com o literal (intencional — o grupo e
  o mapa exato da igualdade) e custo de CI maior em diff so-scripts (aceito,
  fail-closed, precedente OPS119+).

## Aceite de engenharia

- [x] Aceite de produto da intencao coberto: diff so-`scripts/lib/<lib>` pinada
      por spec classifica `full` (F1) e diff so-scripts classifica `code` em
      `classifyStaticScope` (F2).
- [x] Invariantes AGENTS/engineering-standards: identificadores em ingles, prosa
      pt-BR; nenhuma migration; nenhum access/Consent/UI/URL publica tocado;
      `HIGH_RISK_EXACT` segue `Set` exportado.
- [x] Testes de dominio previstos: `tests/unit/testAffected.unit.spec.ts` e
      `tests/unit/ciSkipInvariants.unit.spec.ts` - todos unit, sem harness novo.
- [x] `pnpm gate:fast` verde; `pnpm push` no fluxo normal de PR.

## Self-score decision-quality

1. Decisoes caras tem rejeitadas? **5/5** - forma do invariante, escopo
   unit-vs-unit+int, shape da lista e F2 prefixo-vs-lista registraram
   Opcoes/Recomendacao/Rejeitadas; as rejeitadas herdadas da intencao-mae
   (prefixo `scripts/lib/`) ficam explicitas.
2. Cabe no appetite (~1h)? **5/5** - F1 ~35min (grupo + invariante + 2 pins),
   F2 ~15min (1 predicado + pins), gates ~10min; sem migration, sem e2e novo,
   sem UI.
3. Rabbit holes nomeados? **5/5** - prefixo `scripts/lib/` inteiro, existencia
   repo-wide, AST/dynamic import, `classifyBuildScope`, S1/S2/S3, guard
   `isMain`, UI/Consent.
4. Depth check reusa shells/helpers? **4/5** - reusa `HIGH_RISK_EXACT`,
   `isCodePath`/`classifyStaticScope` e os specs donos que ja importam o modulo;
   nao cria modulo paralelo nem derived-data commitado; o walker e local ao
   spec-to-be que ja tem `fs`.
5. Intencao (aceite de produto) intacta? **5/5** - a engenharia nao reescreveu o
   outcome; o invariante fail-closed e a unica forma compativel com o contrato
   pure do dono e cobre superset com divergencia registrada.

**Score: 24/25 - aprovado; gate confirmou o superset unit+int (42 paths) em
2026-09-16.**
