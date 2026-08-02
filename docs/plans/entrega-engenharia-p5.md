# Pass 5 — Auditoria de engenharia (offline/hybrid) + remediação P0/P1 + provenance das misses

## Contexto e manchetes

- **Executado em 2026-08-02, modo autônomo (Cursor Cloud)** da skill `engineering-audit`: precheck solitário verde (pool **desligado**), varredura completa com âncora de delta no Pass 4 (2026-07-31), remediações P0/P1 e fechamento das misses remapeadas na mesma sessão, cada um em PR próprio com gate completo. PR dos artefatos = Ready + auto-merge.
- **Âncora de delta:** Pass 4. Em ~2 dias o paradigma tocou **573 arquivos / 442 commits** — OH11–OH14 (mirror + outbox + CAS + OfflineBoundary), CL9 (lista unificada sempre ligada), quick actions, B57 snapshots, 89 módulos novos em `src/`.
- **Baseline verde:** `tsc` 0, `lint` 0 warnings, `knip` 0 findings (ruído `payload.config.ts`, ledger P3), madge 0 ciclos (**858 arquivos**, +84). Unit **173 / 1 383**; e2e **20 specs / 61 cases**.
- **Manchetes (todas medidas):**
  - **1 P0:** wipe de logout de outbox/mirror depende de singletons em memória — após reload frio a persistência sobrevive.
  - **2 P1s remediados:** activity hybrid perde campos / não limpa relações; CAS check-then-write sem lock.
  - **1 P1 ledgerado (workstream):** push `queueMicrotask` antes do commit da transação.
  - **B57 “advisor vê Δ statewide” rejeitado como P0** — opção A do plano (`delta-7-dias-estimativa-inicio.md`).
  - **4 misses remapeadas** (#48←#52, #49←#53, #50←#54, #54←#73) + OPS2 #41: guards já vivos; provenance + endurecimento + `Closes`.
  - **Pass 4 carry-forward verificado:** A–E, G, H, D abertos; **F fechado** (boundary); twin LeadershipStateDeputy já B37.

## Protocolo de delta de comportamento

Consolidação pode mudar saídas pequenas desde que **cada delta seja listado**; pins atualizados deliberadamente; URL B18 / schema / Consent fora de alcance sem item nomeado.

## Ondas já executadas na sessão (P0/P1 + misses)

| Entrega | Conteúdo                                                                 | Guarda (classe)                                                                                 |
| ------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| P5-P0   | Logout sempre abre adapters e limpa IDB/OPFS mesmo com singleton null    | pin unit: cold-reload wipe; logout segue em `finally`/allSettled (5)                            |
| P5-P1a  | Activity hybrid: campos offline-unsupported desabilitados; null em clear | pin unit/int do payload híbrido (1 + 5)                                                         |
| P5-P1b  | CAS sob `pg_advisory_xact_lock` do doc + re-read                         | pin int concorrente 2 writers (5)                                                               |
| P5-M\*  | GUARDRAILS.md números públicos; endurecer dodges; fechar misses + OPS2   | guards existentes endurecidos (3); `Closes #48, closes #49, closes #50, closes #54, closes #41` |

## Ondas do plano (P2, ordenadas por risco × churn)

### Onda 1 — Superfície offline (delta dominante)

#### P5-A Runtime único de outbox

- **Meta:** núcleo tipado (init / collapse / replay / conflict / clear) + 3 wrappers de domínio.
- **Evidência:** `opsMunicipalityOutbox.ts` 711 + `opsDomainOutbox.ts` 652 + `opsEstimateOutbox.ts` 208 ≈ **1 854 LOC**; `outboxMutationRow` ×3; clear logout ×3.
- **Conhecimento duplicado:** “persistir, colapsar, reenviar, marcar conflito e limpar mutação offline”.
- **Guarda:** pin por descriptor de mutação + clear logout cold (5); convenção banindo terceiro executor copy-paste (3).
- **Effort:** L.

#### P5-B Hook `useOpsOutboxConflict`

- **Meta:** pending → refresh → toast “Manter o meu” / “Usar o novo” numa máquina.
- **Evidência:** ~300 linhas ×7 (`PledgeEstimateForm`, `DeclareVotesForm`, `MunicipalityListAdvisorsControl`, `DemandWorkflowCard`, `LeadershipListSupportStatusControl`, `LeadershipInternalForm`, `ActivityForm`).
- **Conhecimento:** “traduzir lifecycle de uma row do outbox em UI de conflito”.
- **Guarda:** pin pending→synced / retry / discard (5).
- **Effort:** M.

#### P5-C `OpsListLocal` → shell tipado + variante município

- **Evidência:** 686 linhas; 5 tabelas; 4 entidades repetem mirror→parse→filter→footer.
- **Conhecimento:** “lista degradada read-only a partir do mirror com URL canônica”.
- **Guarda:** judgment-only no split (6) + pins de URL/empty (5).
- **Effort:** M.

#### P5-D Snapshot ops: parser runtime + budget

- **Evidência:** `parseOpsSnapshot` é cast (0 callers prod); mirror client valida 3 facts rasos; snapshot ~4 MiB JSON / ~2 MiB gzip (âncora, não teto); poll 3 min; `buildOpsSnapshot` 547 linhas com `municipalityUpdate` unbounded then truncate.
- **Guarda:** pin corrupt/version mismatch (5); CI budget (4).
- **Effort:** M.

#### P5-E Push transacional (P1 remanescente)

- **Meta:** outbox/job disparado **após** commit; nunca `queueMicrotask` dentro da transação do domínio.
- **Evidência:** `createCampaignNotification.ts:20-40` + `sendCampaignPush.ts:39-66`; 3 hooks (supporter/activity/municipalityUpdate).
- **Guarda:** int commit/rollback com Web Push mockado (5).
- **Effort:** M.

### Onda 2 — Carry-forward Pass 4 (ainda aberto) + lib do delta

#### P5-F (=P4-A/B/C/D) homeSearch runner + grupos + notification names/writes

- Status verificado 2026-08-02: twins 88/100 linhas; 6 grupos; 7 `findByID`; mark-all sem transação / subscribe sem zod / unsubscribe com bypass. Executar o plano P4 original; não reescrever.
- **Guarda:** as do P4.

#### P5-G (=P4-E/G) WizardInfoDrawer + HomeSearchProvider estreito + aria-live lazy

- Drawer ×3 e skip-trailing ×2 ainda no código; provider ainda envolve actions/summary; `RelationChipCell` ~50 regiões polite.
- **Guarda:** as do P4.

#### P5-H Wizard action IDs single-source + href options object

- **Evidência:** lista de 5 IDs ×3 módulos; `wizardSignalHref`/`wizardTrendHref` com 5–6 posicionais e **7** calls com `undefined` (gatilho Pass 4 **disparou**).
- **Guarda:** tipo (1) + snapshot de href (5).
- **Effort:** S/M.

#### P5-I `src/lib` sem React/Lucide

- **Evidência:** 9 módulos lib importam `react` ou `lucide-react` (~739 linhas / 23 kB).
- **Guarda:** ESLint ban na zona `src/lib` (2).
- **Effort:** M.

### Onda 3 — Endurecimento de guardas + REST B57

#### P5-J Ratchet de bypass (P4-H) + Local API AST + safeMessages forms

- Header-comment dodge ainda vivo; shorthand `user,` invisível; `const safeMessages =` foge da guarda.
- **Guarda:** endurecer specs (3).
- **Effort:** M.

#### P5-K Snapshot vote-summary REST → unrestricted (+ keep Δ via loader bypass)

- **Não é P0** (B57 opção A). Opcional: collection `read` só unrestricted/admin; advisor continua a receber Δ via utility com `overrideAccess` justificado — sem enumerar absolutos em `/api/*`.
- **Guarda:** int role matrix (5).
- **Effort:** S.

#### P5-L Affected-E2E fail-closed para `src/lib/campaignOps`

- **Evidência:** 53/72 `src/lib` do delta sem match no manifesto → `mode: none`.
- **Guarda:** convenção + manifesto (3).
- **Effort:** S.

## Mapa de guardas

### Novas / endurecidas nesta sessão

| Guarda                                      | Classe | Origem                 |
| ------------------------------------------- | ------ | ---------------------- |
| Logout wipe persistence-independent         | 5      | P0                     |
| Hybrid activity payload contract            | 1 + 5  | P1a                    |
| CAS sob advisory lock + pin concorrente     | 5      | P1b                    |
| Provenance GUARDRAILS → issues públicos     | 6→3    | harvest remap          |
| sharedSheetHost / e2eNav / allocator harden | 3      | misses #48/#49/#50/#54 |

### Resíduo judgment-only

- Split de `OpsListLocal` / `WizardLeadershipStep` / `RelationChipCell` — gatilho de produto.
- B57 opção A (Δ statewide p/ assessor) — decisão de produto travada; não relitigar sem evidência nova.
- AdvisorsTable edit mode — ledger pré-Pass 4, edit-in-place.

### Defer + gatilho (Pass 5)

| Par                               | Medida                        | Gatilho                           |
| --------------------------------- | ----------------------------- | --------------------------------- |
| Outbox runtime ×3                 | 1 854 LOC                     | 4ª família de mutação offline     |
| `buildOpsSnapshot` pure mappers   | ~206 LOC pure in utilities    | mudança de schema do snapshot     |
| `vercel-production-alias.mjs` 740 | 10 fetch adapters             | 2º consumidor do protocolo Vercel |
| Online/offline list policy twins  | demand filter/sort duplicated | 3º domínio com lista local        |

## Look-alikes rejeitados

- Ops snapshot mappers × page view models — contratos de redação diferentes.
- Leader-safe pledge view × staff estimate DTO — assimetria de segurança.
- Strict server FormData × optimistic client parsers — trust boundary distinta (nomear política, não unificar às cegas).
- B57 statewide Δ × “advisor vê só carteira” — produto escolheu A.

## Regras de execução

- Uma consolidação por entrega; gate bare completo + Aikido quando disponível.
- Estrutura ≠ comportamento no mesmo commit; vermelho no meio = revert.
- Frozen: URL B18, schema, Consent fail-closed.
- Guarda na mesma entrega do fix; misses fecham com `Closes #N` (keyword por número).
