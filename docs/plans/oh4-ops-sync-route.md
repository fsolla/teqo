# OH4 — Route `GET /campanha/api/ops-sync` FULL + scoped + int access

Status: done
Atualizado em: 2026-08-01
Issue: #166
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: A — N/A (endpoint server)
Appetite: ~1,5–2 dias eng
Depends: OH3
Responsável: —

## Freshness audit (2026-08-01)

- OH3 `#165` `done`/`in-prod`; truncamento = `OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY` (**50**) em [`src/lib/campaignOps/opsSnapshotPolicy.ts`](../../src/lib/campaignOps/opsSnapshotPolicy.ts).
- DTOs OH2 vivem em [`src/lib/campaignOps/`](../../src/lib/campaignOps/) (client-safe) — o builder é `server-only` em `src/utilities/campaignOps/` (não misturar).
- Escopo advisor: `overrideAccess: false` + access modules (já usam `resolveActorScopedRead`); não re-spellar where no builder.
- Exceção `depth: 1` só em `leadership` (DTO embute `OpsLeadershipContact`); demais collections `depth: 0`.
- Benchmark OH3 ([`scripts/benchmark-ops-snapshot.mjs`](../../scripts/benchmark-ops-snapshot.mjs)) é a referência de selects/mappers — extrair a lógica canônica para o builder.

## Premissas

1. Full-only: sem `?since=`, sem delta, sem gzip obrigatório (decisão de compressão fica para OH11 se o benchmark mandar).
2. Truncamento de `municipality_update` usa o número travado em OH3 (`50`/município).
3. Leader recebe 403 (sem mirror de ops).

→ Confirmadas.

## Objetivos

- `buildOpsSnapshot(payload, actor)` (`server-only`) monta o snapshot scoped pelo actor com `overrideAccess: false` em todas as queries.
- `GET /campanha/api/ops-sync` autentica com `getCampaignUser()`, devolve JSON `no-store`, 403 para leader.
- Pins int: coordinator vê tudo; advisor só a carteira; candidate vê tudo; leader 403.

## Dados → decisão → apresentação

Dados: N/A — endpoint de dados; o consumo é o mirror (OH5).

## Abordagem proposta

```mermaid
flowchart LR
  GET[GET /campanha/api/ops-sync] --> Auth[getCampaignUser]
  Auth -->|sem sessão| R401[401]
  Auth -->|leader| R403[403]
  Auth --> Builder[buildOpsSnapshot]
  Builder -->|overrideAccess: false| DB[(Payload)]
  Builder --> JSON[Response.json no-store]
```

Componentes:

- **`src/utilities/campaignOps/buildOpsSnapshot.ts`** (novo, `import 'server-only'`): queries em paralelo (`Promise.all`) com `user: actor`, `overrideAccess: false`, `select` mínimo dos DTOs OH2. Escopo via access modules — **não** re-spellar RBAC. Truncamento via `truncateMunicipalityUpdates` (lib). Devolve `OpsSnapshot` com `revisedAt` e `schemaVersion`.
- **`src/app/(campaign)/campanha/api/ops-sync/route.ts`** (novo): `GET()` — auth, staff check, `Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })`.
- **Defense in depth:** o `select` de `vote_pledge` **nunca** inclui `estimatedVotes` quando o actor não for staff.

## Fases verificáveis

### Fase 1 — Tracer: builder + route com 1 collection (municipalities)

- **Quota:** ~0,4
- **Entrega:** route devolve `{ revisedAt, schemaVersion, municipalities }` scoped.
- **Aceite:**
  - [x] 401 sem sessão; 403 leader; 200 coordinator/advisor/candidate
  - [x] advisor recebe só municípios da carteira (pin int com fixtures)
- **Verify:** `pnpm gate:fast` + `tests/int/campaignOpsSync.int.spec.ts`
- **Files:** builder, route, spec int
- **Tamanho:** M

### Fase 2 — Collections restantes + truncamento

- **Quota:** ~0,6
- **Entrega:** snapshot completo conforme OH2 + updates truncadas (N de OH3).
- **Aceite:**
  - [x] todas as collections presentes com select mínimo (sem `estimatedVotes` para non-staff — defense in depth)
  - [x] `municipality_update` limitado a N/município (pin int)
  - [x] shape bate com `OpsSnapshot` (type-level no teste)
- **Verify:** `pnpm gate:fast` + spec int completa
- **Files:** builder, spec int
- **Tamanho:** M

## Dependências

- OH2 (DTOs), OH3 (truncamento). Reusa [`src/utilities/campaignAuth.ts`](src/utilities/campaignAuth.ts) (`getCampaignUser`) e access confirmado: `resolveActorScopedRead` / `advisorMunicipalityScopeWhere` ([`src/utilities/access/shared.ts`](src/utilities/access/shared.ts)).

## Não escopo

- Delta/`since`; compressão; cache; sync client (OH5).

## Rabbit holes

- **`depth: 1` “para facilitar joins”.** Explode tamanho e vaza shape para o client. **Mitigação:** IDs + `depth: 0`; joins no client (OH5/OH12). Exceção documentada: `leadership` depth:1 só para `OpsLeadershipContact`.
- **Bypass de access “porque é endpoint interno”.** Invariante do repo. **Mitigação:** pin int de advisor/leader.

## Débitos pós-simplify (resolvido em OH4+ #186)

- ~~Benchmark OH3 ainda duplica mappers/`toIso` — apontar `scripts/benchmark-ops-snapshot.mjs` a `buildOpsSnapshot` quando o timing por-collection deixar de precisar do pipeline paralelo (gatilho: OH11 sizing / drift).~~ Resolvido: benchmark consome `buildOpsSnapshot` com `onSectionLoaded` para relatório por-collection.

## Referências

- [`src/utilities/campaignAuth.ts`](src/utilities/campaignAuth.ts)
- [`src/utilities/access/`](src/utilities/access/)
- [`src/utilities/municipality/campaignMunicipalityScope.ts`](src/utilities/municipality/campaignMunicipalityScope.ts)
- OH2 — contrato `OpsSnapshot`
