# OH2 — `lib/campaignOps` contrato puro + merge + flag

Status: rascunho
Atualizado em: 2026-08-01
Issue: #163
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI)
Appetite: ~1 dia eng
Depends: OH1
Responsável: —

## Premissas

1. Tudo em `src/lib/campaignOps/` é client-safe (zero import de `utilities/` ou Payload por valor).
2. Merge puro é a única lógica complicada: nunca sobrescrever rows com mutação `pending`/`conflict` no outbox.

→ Corrija agora ou sigo com estas.

## Objetivos

- DTOs do snapshot + reducers de merge puros + `resolveOpsHybridEnabled()` + `OPS_MIRROR_SCHEMA_VERSION`.
- Pins unit: merge não esmaga `pending`; serialização de datas; parsing da flag.

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

Componentes (todos novos):

- **`src/lib/campaignOps/opsContract.ts`** — tipos: `OpsSnapshot { revisedAt: string; schemaVersion: number; municipalities: OpsMunicipality[]; leaderships: OpsLeadership[]; votePledges: OpsVotePledge[]; activities: OpsActivity[]; stateDeputies: OpsStateDeputy[]; organizations: OpsOrganization[]; demands: OpsDemand[]; municipalityUpdates: OpsMunicipalityUpdate[]; goals: OpsGoals | null }`. DTOs com **IDs entre collections** (nunca doc expandido).
- **`src/lib/campaignOps/opsMerge.ts`** — `mergeOpsSnapshot(local, incoming, outboxKeys)`: upsert por `(collection, id)`; se `id` está em `outboxKeys` (pending/conflict) → manter row local; senão substituir por `incoming`. Também `diffOpsIds(local, incoming)` para removals (v1: full replace fora do outbox).
- **`src/lib/campaignOps/opsHybridFlag.ts`** — `resolveOpsHybridEnabled(env = process.env): boolean` (`'1'`/`'true'`).
- **`src/lib/campaignOps/opsMirrorVersion.ts`** — `export const OPS_MIRROR_SCHEMA_VERSION = 1`.
- **`src/lib/campaignOps/opsSyncMeta.ts`** — tipos `OpsSyncStatus = 'idle' | 'syncing' | 'error'`, `OpsSyncState { status; lastSyncedAt: string | null; lastError?: string }`.

## Fases verificáveis

### Fase 1 — Tracer: contrato + merge + pins

- **Quota:** 1 do appetite
- **Entrega:** os 5 módulos + `tests/unit/campaignOps.unit.spec.ts`
- **Aceite:**
  - [ ] `mergeOpsSnapshot` mantém row local quando o id está no outbox (pending e conflict)
  - [ ] merge substitui rows fora do outbox e remove ausentes (full replace)
  - [ ] `OPS_MIRROR_SCHEMA_VERSION === 1` exportado
  - [ ] `resolveOpsHybridEnabled()` cobre `'1'`, `'true'`, `'0'`, ausente, outro valor
  - [ ] DTOs não têm campos `estimatedVotes` em tipos usados por views de líder (preparação lockdown — type-level)
- **Verify:** `pnpm gate:fast`
- **Files:** `src/lib/campaignOps/*.ts`, `tests/unit/campaignOps.unit.spec.ts`
- **Tamanho:** M

## Dependências

- OH1 (spec-mãe). Reusa tipos de domínio existentes só como referência de forma — sem import por valor.

## Não escopo

- Collections TanStack, persistence, provider — OH5. Endpoint — OH4.

## Rabbit holes

- **Importar `Municipality`/`VotePledge` de `payload-types`.** Arrasta tipos de server para client e acopla ao schema inteiro. **Mitigação:** DTOs próprios com os campos que as views usam.
- **Merge “inteligente” por campo.** Só por row — campo-a-campo inventa semântica sem produto. **Mitigação:** pin do comportamento simples.

## Referências

- [`src/lib/schemas/votePledge.ts`](src/lib/schemas/votePledge.ts) (forma de estimativas)
- AGENTS.md — `lib/` client-safe, direção de dependência
