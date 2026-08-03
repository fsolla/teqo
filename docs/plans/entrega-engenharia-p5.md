# Pass 5 — Auditoria de engenharia e remediação P1

## Contexto e manchetes

- **Executado em 2026-08-03, modo autônomo (Cursor Cloud)** da skill `engineering-audit`: precheck solitário verde (pool **desligado**), varredura completa com foco no delta desde o Pass 4 (2026-07-31), **0** `kind:agent-miss` abertas, **1 P1** remediado na mesma sessão em PR próprio. Artefatos = Ready + auto-merge (contrato `agent-pr-workflow`).
- **Âncora de delta:** Pass 4. **627 arquivos** / **520 commits** — quick-actions, wizard/omnibox, e2e municipalities, home actions, shell v2 de município (B147), OPS17/18.
- **Baseline verde:** `tsc` 0, `lint` 0 warnings, `knip` 0 findings (ruído conhecido `payload.config.ts`), madge 0 ciclos (**859** arquivos, +85 desde Pass 4).
- **Manchetes (medidas):**
  - **0 P0** — lockdown de globals do Pass 4 segurou; collections com `access`; consent fail-closed.
  - **1 P1** — `createCampaignNotification` agenda push com `queueMicrotask` sob `req.transactionID`; microtask corre **antes** do `commitTransaction` de `withPayloadTransaction` → push pode sair para linha ainda não commitada / depois revertida.
  - **Fila de misses vazia** — nenhuma guarda nova de miss; GUARDRAILS.md verificado vivo.
  - **Ondas P4-A…P4-L ainda abertas** (re-medidas) — o Pass 5 **não** as reabre com IDs novos; cita e atualiza contagens no ledger.
  - **Delta novo:** dispatcher `/acoes/[slug]` (296 LOC), dual-switch de href do wizard, lista de action ids de staff ×3, prólogos metadata+page, `campaignFormFields` em `utilities` no client, dodges de guarda.

## Protocolo de delta de comportamento

Inalterado do Pass 3/4: consolidação pode mudar saídas pequenas listadas por item; pins atualizados deliberadamente; URL B18 / schema / Consent fora de alcance sem item nomeado.

## Onda já executada na sessão (P1)

| PR     | Conteúdo                                                                 | Guarda (classe)                                                                 |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| P5-P1  | After-commit registry em `withPayloadTransaction` + schedule de push; `sendCampaignPushForNotification` soft-fail se a row sumiu | pin unit do registry (5); convenção: push de notificação nunca via `queueMicrotask` sob txn (3) |

## Ondas do plano (P2→P3, ordenadas por risco × churn do delta)

### Onda 1 — Carry-forward Pass 4 ainda aberto (não re-planejar do zero)

Executar na ordem do [`entrega-engenharia-p4.md`](entrega-engenharia-p4.md). Contagens Pass 5:

| Item | Medição 2026-08-03 |
| ---- | ------------------ |
| P4-A homeSearch | `utilities/homeSearch` **837** LOC; `limit: 0` ×5 |
| P4-B groups | 6 × `HomeSearch*Group` |
| P4-C notificationEvents | 254 LOC; `findByID`×7 |
| P4-D write path | mark-all `limit: 200` + `Promise.all`; subscribe sempre `create`; unsubscribe bypass delete |
| P4-E wizard drawers | Signal/Trend/Leadership info chrome; Signal/Trend skip trailing ×2 |
| P4-F labels | `MunicipalityListMobileCards` value-import de `municipalityListUrl` |
| P4-G | provider no chrome staff; `RelationChipCell` **841** LOC + `aria-live` incondicional |
| P4-H…L | ratchet bypass, `canReadCampaignUsers`, auth double-read, fixtures, chips-dev flake |

### Onda 2 — Consolidação do delta (quick-actions / wizard / rotas)

#### P5-A Dispatcher tipado de href de wizard/ação

- **Meta:** um `wizardHrefForAction(action, ctx)` (options object); `wizardActionChain` deixa de ter dois `switch` espelhados; enxugar exports de `campaignActionRoutes` (252 LOC / **31** exports).
- **Conhecimento duplicado:** mapa ação→href do wizard/chain.
- **Guarda:** pins `campaignActionRoutes.unit` + `wizardActionChain.unit` (5); tipo esgota o union de ações (1).
- **Esforço:** M · **Sev:** P2

#### P5-B `STAFF_DETAIL_WIZARD_ACTION_IDS` single-source

- **Meta:** a lista idêntica em `activityQuickActions` / `campaignQuickActionLeadership` / `campaignQuickActionDemands` vira constante + helper de prefill de município.
- **Guarda:** unit do registry (5).
- **Esforço:** S · **Sev:** P2

#### P5-C `/acoes/[slug]` → loader + branches finas

- **Meta:** `page.tsx` (296 LOC) perde auth/payload/URL assembly para `utilities`/view-model; a page só compõe.
- **Guarda:** convenção de prólogo de página (3) — mesmo espírito P3-I.
- **Esforço:** M · **Sev:** P2

#### P5-D Prólogo metadata+page sem double-load

- **Meta:** helper tipado `requireCampaignDetailPage(slug)` (ou cache React já existente) para org/dobradinha/demanda detail — hoje `generateMetadata` e page repetem o ator+load.
- **Guarda:** pin de convenção ou `cache()` obrigatório no loader (3/1).
- **Esforço:** S · **Sev:** P2

### Onda 3 — Fronteiras e guardas

#### P5-E `campaignFormFields` → `lib/` (ou contrato client-safe)

- **Meta:** Login/ForgotPassword importam runtime de `utilities/campaignFormFields` — helper puro deve viver em `lib/`.
- **Guarda:** ESLint ou convention: client em `(campaign)` não value-importa `@/utilities/**` fora allowlist (2/3).
- **Esforço:** S · **Sev:** P2

#### P5-F Labels de coluna fora de `municipalityListUrl` (= P4-F, priorizar)

- Já no plano P4; Pass 5 só reafirma: churn mobile+omnibox sobe a prioridade.

#### P5-G Endurecimento de dodges de guarda (mapa)

| Dodge | Guarda atual | Endurecimento |
| ----- | ------------ | ------------- |
| `!!user` / bloco `return Boolean(user)` / helper em subdir de globals | `globalAccessConventions` | banir predicados "truthy user" genéricos + sweep recursivo |
| `user,` shorthand / alias de método Local API | `localApiOverrideAccessConventions` | cobrir shorthand e `payload.db` paths críticos |
| `function die(` local em scripts | `scriptCliConventions` | banir die local rotulado; exigir `dieWithLabel` |
| `payload.find`+slug fixo+mutate; `URLSearchParams` municipio | allocator conventions | cobrir find-by-slug+mutate; encoding |
| wrapper `goto` / settle em comentário | e2e navigation | tokens de settle só em statements |

- **Esforço:** M · **Sev:** P2 (classe segurança nos dois primeiros)

### Onda 4 — Escala / a11y / debug (carry + delta)

#### P5-H homeSearch bounded query (= P4-A elevado em prioridade)

- Mesma meta P4-A; Pass 5 confirma custo: route dispara 6 loaders por keystroke com `limit: 0`.
- **Sev permanece P2** (não P1): sem gate vermelho nem vazamento de ACL; é harm de escala medido.

#### P5-I `RelationChipCell` live-region + tamanho (= P4-G)

- Trigger Pass 4 ainda válido; **841** LOC.

#### P5-J Flake chips-dev `campaignLeaderships` (= P4-L)

- Continua: debug com evidência, não retry.

#### P5-K Fixtures `createSupporter` → `touchedMunicipalities`

- Uma linha no helper; pin de cleanup (P3).

#### P5-L `assessores/novo` + `deriveDecisionAuthor`

- P3: redirect usa `requireCampaignPageActor` (ou exceção documentada na guarda P3-I); stamp via `campaignAuditFields`.

## Defer + gatilho (sem ID novo de entrega)

| Item | Gatilho |
| ---- | ------- |
| `/campanha/municipio/[slug]/v2` vs `/municipios/[slug]` | cutover B147 filhos / remoção do v1 |
| `suggestionCatalog` 646 LOC | 9º pattern ou 2º consumer do evaluator |
| `MunicipalityMapPanel` / `BahiaMap` | próxima feature que toque orquestração+camada |
| `municipalityListUrl`/`Omnibox` puros em `utilities` | 3º adapter omnibox novo no mês **ou** P4-F labels move |
| Omnibox `q:` chip helpers | 3º search-only adapter além dos atuais |

## Look-alikes rejeitados

- Profile/password `overrideAccess: true` com `id: user.id` da sessão — padrão trusted-server, não IDOR.
- QuickActions host/overlay/FAB — evolução do Drawer antigo, não gêmeo.
- `searchOnlyListOmnibox` — adapter degenerado legítimo; só o mecânico `q:` é conhecimento compartilhado.
- HomeSearch `*GroupHasHits` — predicados finos demais para abstrair sozinhos.

## Mapa de guardas

### Novas nesta sessão

| Guarda | Classe | Origem |
| ------ | ------ | ------ |
| Push de notificação só após commit (registry) + soft-fail row ausente | 3 + 5 | P5-P1 |

### Existentes reafirmadas / a endurecer (P5-G)

Ver tabela da onda 3. Miss fila: vazia.

### Judgment-only

| Item | Convenção |
| ---- | --------- |
| Parallel municipality v2 shell | PRODUCT/B147; cutover apaga o desvio |
| Map god components | trigger já no ledger Pass 4 |
| Navegação e2e in-shell vs goto | TESTING.md (já declarado judgment-only no Pass 4) |

## Regras de execução

- Uma consolidação por entrega; gate completo bare (`tsc`, lint, format, knip, cycles, test, build) + Aikido onde MCP existir.
- Commit de estrutura ≠ commit de comportamento; teste vermelho no meio = revert.
- Migrations congeladas; guarda na **mesma** entrega do fix.
- Nada vive só no chat — leftovers → `capture-review-debts`.
