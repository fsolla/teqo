# OH5 — SyncProvider + persistence (OPFS→IDB) + poll + chrome

Status: rascunho
Atualizado em: 2026-08-01
Issue: #168
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — chrome de sync no shell `/campanha`
Appetite: ~2–3 dias eng
Depends: OH4
Responsável: —

## Premissas

1. Com `OPS_HYBRID` ausente, o provider é no-op (zero efeito no layout).
2. Persistence: OPFS/WA-SQLite primeiro; fallback IndexedDB com try/catch + feature-detect, decidido no boot e documentado em comentário.
3. Chrome discreto no shell: “Actualizado há Xm” / “A sincronizar…” / “Dados podem estar desatualizados”.

→ Corrija agora ou sigo com estas.

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

- **`src/components/campaign/opsSync/opsMirrorClient.ts`** (novo): boot/fallback da persistence, collections TanStack (`municipalitiesCollection`, `leadershipsCollection`, `votePledgesCollection`, …), `bootstrapOpsMirror()`, `syncOpsMirror()`, wipe por `OPS_MIRROR_SCHEMA_VERSION` mismatch.
  - **API TanStack (verificar antes de codar):** com `@tanstack/react-db@^0.1.95` + `@tanstack/browser-db-sqlite-persistence@^0.2.9`, confirmar no `node_modules`/docs da versão pinada os exports exactos (`createCollection`, `persistedCollectionOptions`, `createBrowserWASQLitePersistence`, coordinator). Se algum export não existir nesta versão, fallback documentado no PR: persistence manual em IndexedDB (hydrate/dump por collection) — **não** trocar de lib silenciosamente.
- **`src/components/campaign/opsSync/CampaignOpsSyncProvider.tsx`** (novo): efeito de bootstrap + poll + listeners; expõe `useOpsSyncState()` (`{ status, lastSyncedAt }`) e **`useOpsOffline()`** — definido aqui: `true` quando `navigator.onLine === false` **ou** o último `syncOpsMirror()` falhou (mantido no estado do provider; volta a `false` no próximo sync OK ou evento `online`).
- **`src/components/campaign/opsSync/OpsSyncStatusChrome.tsx`** (novo): texto de estado no shell (pt-BR), `role="status"`, sem banner intrusivo.
- **Layout `(app)`** (alterado): envolve children com o provider passando `enabled` resolvido no server.
- **Deps (setup):** `pnpm add @tanstack/react-db@^0.1.95 @tanstack/browser-db-sqlite-persistence@^0.2.9` (offline-transactions entra em OH6).

## Fases verificáveis

### Fase 1 — Tracer: provider no-op OFF + boot ON com 1 collection

- **Quota:** ~0,5
- **Entrega:** flag OFF = layout igual; ON = municipalities persistidas após GET.
- **Aceite:**
  - [ ] sem env: zero requests novos, zero render diff
  - [ ] com env: GET corre, merge escreve na collection, reload reidrata sem GET (cache quente)
  - [ ] leader com env: provider no-op (pin unit)
- **Verify:** `pnpm gate:fast` + `tests/unit/opsMirrorClient.unit.spec.ts`
- **Files:** `opsMirrorClient.ts`, provider, layout
- **Tamanho:** M

### Fase 2 — Todas collections + poll + chrome + fallback

- **Quota:** ~0,5
- **Entrega:** collections restantes; poll 3 min só foreground; re-sync focus/online; chrome; fallback IDB.
- **Aceite:**
  - [ ] poll dispara só com `visibilityState === 'visible'`
  - [ ] merge não esmaga keys marcadas (simulação de outbox keys)
  - [ ] falha de sync → chrome “Dados podem estar desatualizados”
  - [ ] boot com OPFS indisponível cai para IDB sem crash (mock)
  - [ ] `OPS_MIRROR_SCHEMA_VERSION` bumped → wipe + full re-sync
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
- TanStack DB overview + persistence (docs oficiais da versão em package.json — verificar na implementação)
- OH2 — merge/flag/version
