# OPS46 — Infra de teste e2e: e2e local quebrado (next/cache) + allocator de município com wrap

Status: rascunho
Atualizado em: 2026-08-13
Issue: #? (a criar via agent:register)
Intenção: débitos do OPS45 (capture-review-debts autônomo)

## Fase 1 — e2e local não coleta: `Cannot find module 'next/cache'` (máquina do humano)

**Sintoma:** `pnpm exec playwright test --list` falha em todo spec — `Error: Cannot
find module '<repo>/node_modules/next/cache' imported from src/utilities/documents.ts`.
Reproduz no worktree OPS45, no main repo (`/home/fsolla/Code/teqo`) e sob Node
v20.20.2 / v24.14.0 / v24.18.0 — pré-existente ao OPS45 (não é do diff).

**Mecanismo medido:** `import { revalidateTag } from 'next/cache'` (ESM, subpath
sem extensão) falha no resolver ESM nativo do Node — `next/package.json` NÃO tem
`exports`, então `next/cache` (arquivo `cache.js`) não resolve em ESM puro
(`node --input-type=module -e "import('next/cache')"` → ERR_MODULE_NOT_FOUND;
`import('next/cache.js')` → OK). O carregamento do graph do fixture e2e
(`src/payload.config.ts` → `documents.ts`) passa por esse import; o transpiler
do Playwright não reescreve bare specifier sem exports. CI passa (mesma versão
de next/playwright) — investigar o que difere no ambiente CI.

**Ações prováveis:** descobrir o deltas CI vs máquina (versão de node do runner,
flags de resolução, `NODE_OPTIONS`, corepack) e/ou tornar o import resolvível
(registrar alias `next/cache` → `next/cache.js` no carregador do Playwright,
ou mover `revalidateTag` para um shim com subpath com exports). Evidência de
referência: reproduzir em docker com node 24 latest (mesmo do CI) para isolar.

**Rabbit holes:** não é o OPS45; não mexer nos fixtures; não é npm registry.

## Fase 2 — Allocator de município com wrap de módulo: colisão de claim deleta linhas vivas

**Sintoma latente:** `nextval % municipalityCatalog.length` (435) na sequência
persistente compartilhada `campaign_fixture_municipality_alloc` (int + e2e).
A sequência nunca é resetada; após 435 claims no MESMO banco (DBs persistentes
de worktree acumulam — o problema do OPS45), dois runs concorrentes podem
receber o MESMO índice e cada um purga as linhas vivas do outro (o purge-on-claim
— int desde OPS19/D10 F1, e2e desde OPS45 — transforma a colisão em corrupção).

**Ações prováveis:** registry de claims com geração (`index, generation`,
UNIQUE em index, `ON CONFLICT` retry) ou fail-loud no wrap; medir primeiro a
contagem real de claims por run completo (int + e2e) para dimensionar.

**Rabbit holes:** não alterar o contrato de nomes/URLs; não tocar no
`testMunicipalityAllocatorConventions.unit.spec.ts` sem migrar os guards.

## Já resolvido no OPS45 (não reabrir)

- stateDeputy no ref-check de fichas órfãs + teste da forma compartilhada
  (supporter+dobradinha) — `purgeMunicipalityResidue` não crasha mais.
- `stateDeputies: []` gated no resíduo (sem write por claim limpo).
- `loadAllPeopleRows` com loop auto-curável + dedupe por contactID.

## Explicitamente fora (deste lote)

- **Contas staff residuais** ('Coordenadora C128-<uuid>') — sem âncora de
  município e sem padrão seguro (emails `@example.com` coincidem com runs
  vivos); absorvidas pela paginação do peopleList. Gatilho: se voltar a
  quebrar um spec global, reavaliar sweep por created_at + ausência de joins.
- **`activity.tasks[].responsible` fora do ref-check** — FK SET NULL,
  silencioso e auto-curável; shape improvável (atividade residual em município
  não claimado referenciando ficha purgada). Gatilho: 2ª referência a Contact
  fora do check.
- **personName letteriza o runID** (invisível ao discoverMarkedRoots) —
  latente até um spec alimentar personName via action real (sem proxy).
  Gatilho: o 1º uso de personName fora do `createContact`.
- **Import do módulo vitest no fixture e2e** — funciona hoje (hooks inertes
  fora do runner); gatilho: vitest mudar o entry / quebrar o import.

## Aceite de engenharia

- [ ] Fase 1: `pnpm exec playwright test --list` coleta na máquina do humano
- [ ] Fase 2: sem colisão de claim após N wraps (teste de stress ou fail-loud)
- [ ] Guards: `testMunicipalityAllocatorConventions` verde após a mudança
