# OH5 — SyncProvider + persistence (OPFS→IDB) + poll + chrome

Status: entregue (PR)
Atualizado em: 2026-08-01
Issue: #168
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — chrome de sync no shell `/campanha`
Appetite: ~2–3 dias eng
Depends: OH4 (done / in-prod — #166)
Responsável: —

## Freshness audit (2026-08-01)

- OH4 (#166) `done`+`in-prod`; `GET /campanha/api/ops-sync` existe; layout `(app)` intacto.
- OH2 libs prontas: `mergeOpsSnapshot`, `OPS_MIRROR_SCHEMA_VERSION`, `resolveOpsHybridEnabled`, `OpsSyncState`.
- OH6 já pinou `@tanstack/db@0.6.17` + outbox em `opsSync/` (`localOnlyCollectionOptions`).
- **Persistence (decisão de implementação):** exports de `@tanstack/browser-db-sqlite-persistence@0.2.9` existem, mas o modelo OH4 é full-snapshot merge (não sync row-a-row). Fit: dump/hydrate do `OpsSnapshot` via **OPFS file** (`navigator.storage.getDirectory`) → **IndexedDB** fallback; collections TanStack ficam `localOnly` (mesmo padrão OH6). Pacote wa-sqlite **não** entra (build scripts ignorados pelo pnpm approve-builds; knip). Documentado no PR — é o fallback previsto no plano, não troca silenciosa de lib.
- Chrome: slot no header desktop + mobile top bar; strings pt-BR.
- Leader no-op: `enabled = OPS_HYBRID && isStaffCampaignRole(role)` no layout.

## Premissas

1. Com `OPS_HYBRID` ausente, o provider é no-op (zero efeito no layout).
2. Persistence: OPFS file primeiro; fallback IndexedDB com try/catch + feature-detect, decidido no boot e documentado em comentário.
3. Chrome discreto no shell: “Actualizado há Xm” / “A sincronizar…” / “Dados podem estar desatualizados”.

→ Corrija agora ou siga com estas.

## Objetivos

- `CampaignOpsSyncProvider` montado no layout `(app)`: bootstrap do mirror (hydrate persistence → sync full), poll 3 min em foreground, re-sync em `visibilitychange`/`online`.
- Merge via `mergeOpsSnapshot` (não esmaga outbox).
- Chrome de status no shell, só com flag ON.
- Leader: provider no-op (defense in depth além do 403 do endpoint).

## Dados → decisão → apresentação

Dados: N/A — chrome mostra estado, não KPI.

## Abordagem proposta

```mermaid
flowchart TB
  Layout[(app) layout] --> SP[CampaignOpsSyncProvider]
  SP --> Boot[bootstrapOpsMirror]
  Boot --> Hydrate[persistence hydrate]
  Boot --> GET[GET ops-sync]
  GET --> Merge[mergeOpsSnapshot]
  Merge --> IDB[(TanStack DB + persistence)]
  SP --> Poll[3min foreground + focus/online]
  SP --> Chrome[OpsSyncStatusChrome]
```

Componentes:

- **`src/components/campaign/opsSync/opsMirrorPersistence.ts`** (novo): OPFS file → IDB store do snapshot + meta (`schemaVersion`, `lastSyncedAt`); `openOpsMirrorStore()`.
- **`src/components/campaign/opsSync/opsMirrorClient.ts`** (novo): collections TanStack `localOnly` (`municipalitiesCollection`, …), `bootstrapOpsMirror()`, `syncOpsMirror()`, wipe por `OPS_MIRROR_SCHEMA_VERSION` mismatch; outbox keys via estimate outbox pending/conflict.
- **`src/components/campaign/opsSync/CampaignOpsSyncProvider.tsx`** (novo): efeito de bootstrap + poll + listeners; expõe `useOpsSyncState()` (`{ status, lastSyncedAt }`) e **`useOpsOffline()`** — `true` quando `navigator.onLine === false` **ou** o último `syncOpsMirror()` falhou (volta a `false` no próximo sync OK ou evento `online`).
- **`src/components/campaign/opsSync/OpsSyncStatusChrome.tsx`** (novo): texto de estado no shell (pt-BR), `role="status"`, sem banner intrusivo.
- **Layout `(app)`** (alterado): envolve children com o provider passando `enabled` resolvido no server.
- **Deps:** reusa `@tanstack/db` já pinado por OH6 (sem novos pacotes de persistence).

## Fases verificáveis

### Fase 1 — Tracer: provider no-op OFF + boot ON com 1 collection

- **Quota:** ~0,5
- **Entrega:** flag OFF = layout igual; ON = municipalities persistidas após GET.
- **Aceite:**
  - [x] sem env: zero requests novos, zero render diff
  - [x] com env: GET corre, merge escreve na collection, reload reidrata sem GET (cache quente)
  - [x] leader com env: provider no-op (pin unit)
- **Verify:** `pnpm gate:fast` + `tests/unit/opsMirrorClient.unit.spec.ts`
- **Files:** `opsMirrorClient.ts`, provider, layout
- **Tamanho:** M

### Fase 2 — Todas collections + poll + chrome + fallback

- **Quota:** ~0,5
- **Entrega:** collections restantes; poll 3 min só foreground; re-sync focus/online; chrome; fallback IDB.
- **Aceite:**
  - [x] poll dispara só com `visibilityState === 'visible'`
  - [x] merge não esmaga keys marcadas (simulação de outbox keys)
  - [x] falha de sync → chrome “Dados podem estar desatualizados”
  - [x] boot com OPFS indisponível cai para IDB sem crash (mock)
  - [x] `OPS_MIRROR_SCHEMA_VERSION` bumped → wipe + full re-sync
- **Verify:** `pnpm gate:fast` + spec unit alargada
- **Files:** provider, chrome, `opsMirrorClient.ts`
- **Tamanho:** M

### Checkpoint

Boot testado manualmente em iPhone real (Safari) — checklist no PR.

## Dependências

- OH4 (endpoint). Reusa `mergeOpsSnapshot` (OH2) e layout [`campanha/(app)/layout.tsx`](<src/app/(campaign)/campanha/(app)/layout.tsx>).

## Não escopo

- Outbox de writes (OH6). OfflineBoundary/Local views (OH9+). SW static (OH11).

## Rabbit holes

- **Import estático de views Local no provider global.** Incha o bundle de todas as rotas. **Mitigação:** views Local entram só nas rotas (OH9/OH12); provider só sync.
- **Poll em background “para manter quente”.** Gasta bateria/rede no carro. **Mitigação:** só foreground.

## Referências

- [`src/app/(campaign)/campanha/(app)/layout.tsx`](<src/app/(campaign)/campanha/(app)/layout.tsx>)
- OH2 — merge/flag/version; OH6 — `@tanstack/db` localOnly + outbox
