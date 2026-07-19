# Escala e DRY pós-C8 (apoiadores / filtros / forms)

Status: implementado (Fases 1–4, 2026-07-19)
Atualizado em: 2026-07-19
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha C, item C9)
Responsável: —

## Contexto

O C8 ([escala-dry-pos-c6.md](escala-dry-pos-c6.md)) entregou a segunda camada de escala/DRY do cadastro nominal: locks advisory em um round-trip, bulk import com `.returning()` e leituras drizzle na txn, overview sem `COUNT(*)` redundante, migration `pg_trgm` em `contact`, helper `drizzleBulk.ts`, variante `getCoordinatorNucleusIds`, e migração da maioria dos `formActions` para `mapCampaignFormActionError` + `campaignFormFields`. Duas passagens `/simplify` (pré- e pós-rebase em `main` com C7) aplicaram limpezas adicionais (`select: { id: true }` via `DynamicFind`, prefetch de núcleos do coordenador para o overview, chunk de `IN` no import, `drizzleResultRows` no `campaignInviteRepository`, `errorProps` no `CampaignInviteForm`, `safeMessages` opcional no mapper).

Os revisores (quality / reuse / performance) marcaram como **importantes e maiores que cleanup** os follow-ups abaixo. Sem registro, a lista de apoiadores pode divergir entre Payload e SQL agregado, o coordenador paga 2–3 lookups idênticos por navegação, e o DRY de forms fica incompleto na borda da vertical.

1. **Filtros de apoiadores duplicados.** `buildSupporterListWhere` (`src/utilities/supporterUi.ts`, Payload `Where`) e `buildAggregateSql` (`src/utilities/supporterListOverviewAggregate.ts`, SQL cru) reimplementam a mesma semântica (telefone normalizado, `q`, `voteIntention`, `city`, `nucleus`). O C8 derivou `total` da lista, mas os dois caminhos ainda podem divergir em qualquer mudança futura.
2. **`contactSearchQuery` não wireado no aggregate.** C7 entregou `isContactSearchQueryReady` / `CONTACT_SEARCH_MIN_LENGTH` em `src/lib/contactSearchQuery.ts` (mín. 2 chars) para comboboxes; o aggregate SQL do overview ainda aplica `ILIKE '%q%'` para `q` de 1 caractere — desperdiça o `pg_trgm` do C8.
3. **Lookup de núcleos do coordenador repetido na página de apoiadores.** `getCoordinatorNucleusIds` roda no prefetch do overview, mas `loadSupporterListPageData` e `loadAccessibleNucleusOptions` disparam access separado (`getAccessibleNucleusIds` → mesma query) sem `req.context` compartilhado em RSC — até 3× por navegação para `coordenador`.
4. **`apoiadores/[id]/formActions.ts` fora do mapper compartilhado.** C8 migrou ~8 `formActions`, mas o detalhe do apoiador mantém ladder inline com contrato de erro diferente (`message` em validação Zod, não `fieldErrors`) — drift e risco de regressão se migrado sem desenho.
5. **Componentes de form com `fieldError` local.** `NucleusForm`, `ActionPlanForm`, `NucleusTerritoryFields`, `VoteEstimateDialog`, `ActionPlanUpdateForm`, etc. ainda usam `errorFor` ou `fieldErrors?.[0]` em vez de `campaignFormFields.ts` — fora do escopo mínimo do C8 Fase 4 (só `NucleusUpdateForm` + `CampaignInviteForm`).

**Explicitamente fora (revisores pediram skip no simplify):** remover o waterfall lista→overview (tradeoff intencional para `totalDocs` correto); unificar lista+aggregate numa query só (só se latency reclamar); migrar `collectLockParams` do teste de locks; widen de `PostgresTransactionDatabase` (follow-up de plataforma, coberto parcialmente por `assertDrizzleColumns`).

## Objetivos

- Um único núcleo de intenção de filtro de apoiadores alimenta Payload (`Where`) e SQL agregado — sem drift entre KPIs e lista.
- Busca `q` no overview (e, se ainda faltar, na lista Payload) respeita `contactSearchQuery` (mín. 2 chars ou dígitos suficientes), alinhado ao C7.
- Página `/campanha/apoiadores` resolve escopo de núcleos do coordenador **uma vez** por render e repassa para list/overview/options.
- Forms restantes da campanha usam `mapCampaignFormActionError` / `fieldError` / `errorProps` sem quebrar contratos de UI existentes.
- Guardrails: sem novo `Consent`; sem migration salvo se unificar filtros exigir índice novo (improvável); `overrideAccess: false` com `user`; locks advisory xact-level inalterados.

## Decisões travadas

- **Um item C9, quatro fases ordenadas.** Mesmo racional do C6/C7/C8: um ID de roadmap, PRs por fase. Ordem: filtros (correção) → `contactSearchQuery` + loader da página → forms restantes (detalhe + componentes).
- **Dependência dura de C8 (merge).** O código otimizado é o do C8; não reabre decisões de v1 do C6 (token HMAC, `supporterImportBatch`, `skipContactPhoneInvariant`).
- **Dependência suave de C7** para `contactSearchQuery` — já em `main`; C9 só wireia nos paths de apoiadores que ainda ignoram o guard.
- **Cortável se a base nominal permanecer pequena.** Fases 1–2 só rendem com volume real ou coordenadores ativos; Fases 3–4 (DRY de forms) são baratas e reduzem drift — manter se houver folga.
- **`apoiadores/[id]/formActions`:** migrar só com `resolveBoundaryMessage` / branch pré-mapper que preserve `message` onde a UI espera texto global (não field error).
- **i18n e naming** (AGENTS.md): identificadores em inglês (`buildSupporterListFilterConditions`, `loadSupportersPageData`), strings visíveis em pt-BR.

## Questões em aberto

- **Filtro unificado: AST neutro vs helper de termos de busca?** **Resolvido (2026-07-19):** módulo `supporterListFilters.ts` com `buildSupporterSearchTerms` + adaptadores `toPayloadWhere` / `toAggregateSqlConditions` — sem AST completo; access SQL permanece no aggregate.
- **Memo de núcleos: `React.cache(getCoordinatorNucleusIds)` vs `loadSupportersPageData`?** **Resolvido (2026-07-19):** loader único `loadSupportersPageData` retorna `{ result, state, redirectHref, nucleusOptions, overview, coordinatorNucleusIds }`; `loadAccessibleNucleusOptions` aceita `coordinatorNucleusIds` pré-resolvidos para coordenador.
- **Migrar componentes de form fora do diff do C8?** **Resolvido (2026-07-19):** Fase 4 migrou os 8 componentes listados para `fieldError` de `campaignFormFields.ts`.

## Abordagem proposta

```mermaid
flowchart TD
    C8["C8 apoiadores ✓"] --> F1
    F1["Fase 1 — Filtro unificado<br/>supporterListFilters"]
    F1 --> F2["Fase 2 — contactSearchQuery + loader página<br/>loadSupportersPageData"]
    F2 --> F3["Fase 3 — formActions detalhe apoiador<br/>message-only mapper"]
    F3 --> F4["Fase 4 — fieldError nos componentes restantes"]

    C7["C7 contactSearchQuery ✓"] -.-> F2
```

### Fase 1 — Núcleo de filtros de apoiadores ✓

- `src/utilities/supporterListFilters.ts`: `buildSupporterSearchTerms`, `toPayloadWhere`, `toAggregateSqlConditions`.
- `buildSupporterListWhere` e `buildAggregateSql` delegam ao módulo compartilhado.
- Testes: `tests/int/supporterListFilters.int.spec.ts` + paridade lista/overview em `campaignSupporter.int.spec.ts`.

### Fase 2 — `contactSearchQuery` + loader da página ✓

- Filtros ignoram `q` quando `!isContactSearchQueryReady(q)`.
- `loadSupportersPageData` em `supporterPageData.ts`; `apoiadores/page.tsx` usa loader único.
- Int: 1× `getCoordinatorNucleusIds` por render de coordenador.

### Fase 3 — `apoiadores/[id]/formActions.ts` ✓

- `mapCampaignFormActionError` + `toMessageOnlyState` preservando contrato `message` da UI.

### Fase 4 — Componentes de form restantes ✓

- `fieldError` em: `NucleusForm`, `ActionPlanForm`, `NucleusTerritoryFields`, `NucleusTerritoryAndZonesFields`, `VoteEstimateDialog`, `ActionPlanUpdateForm`, `LeadershipPrimaryContactAction`, `NucleusIntelligenceDialog`.

**Migration:** nenhuma. Sem Consent novo.

## Dependências

- **Dura:** C8 Escala e DRY pós-C6 (merge) — código em `supporterListOverviewAggregate.ts`, `supporterPageData.ts`, `supporterUi.ts`, `campaignFormActionError.ts`.
- **Suave:** C7 `contactSearchQuery` — já em `main`; Fase 2 wireia.
- Reusa: `src/lib/contactSearchQuery.ts`, `getCoordinatorNucleusIds`, `campaignFormFields.ts`, padrão `loadSupporterListPageData`, plano C8 [escala-dry-pos-c6.md](escala-dry-pos-c6.md).

## Não escopo

- Reabrir C6/C8 (import bulk, token HMAC, `pg_trgm` migration, locks batch).
- Unificar lista+overview numa única query SQL (só se medição de latency justificar).
- Widen `PostgresTransactionDatabase` — follow-up de plataforma (assertion runtime do C8 cobre drift de colunas no bulk).
- Helpers FormData/URL de território do actionPlan — C7 Fase 3 / [escala-dry-pos-c3.md](escala-dry-pos-c3.md).
- GOTV / dia D — C5.

## Referências

- `docs/roadmap.md` — Trilha C, item C9; sequência Janela 2
- [escala-dry-pos-c6.md](escala-dry-pos-c6.md) — C8 entregue; precedente do formato
- [escala-dry-pos-c3.md](escala-dry-pos-c3.md) — `contactSearchQuery` (C7)
- [escala-dry-pos-c2.md](escala-dry-pos-c2.md) — cadastro nominal C2/C6
- `src/utilities/supporterListFilters.ts` — núcleo de filtros unificado
- `src/utilities/supporterUi.ts` — `buildSupporterListWhere`
- `src/utilities/supporterListOverviewAggregate.ts` — aggregate SQL + `resolveAccessConstraint`
- `src/app/(campaign)/campanha/(app)/apoiadores/page.tsx` — `loadSupportersPageData`
- `src/lib/contactSearchQuery.ts` — `isContactSearchQueryReady`
- `src/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions.ts` — mapper compartilhado
- `src/utilities/campaignFormFields.ts` — `fieldError`, `errorProps`
- AGENTS.md — `Contact`, `overrideAccess: false`, naming inglês

## Revisão (2026-07-19)

Implementação das Fases 1–4 conforme plano de implementação C9: `supporterListFilters.ts`, `loadSupportersPageData`, `contactSearchQuery` nos filtros, `formActions` do detalhe no mapper, `fieldError` nos 8 componentes restantes. Testes unit + int adicionados. Roadmap atualizado (C8 mesclado, C9 entregue).

## Simplify (2026-07-19)

Passagem `/simplify` sobre o diff do C9 aplicou limpezas pontuais: `normalizeContactSearchQuery` em `buildSupporterSearchTerms`, paralelismo no loader, spy de teste corrigido, KPI aggregate isolado por `searchTag`, `aria-describedby` com `hasError` no `LeadershipPrimaryContactAction`. Validado com testes int + scan Aikido.

Os débitos que os revisores marcaram como importantes e maiores que cleanup foram registrados como item **C10** — [escala-dry-pos-c9.md](escala-dry-pos-c9.md):

1. **Lista ainda re-dispara access** — `payload.find` com `overrideAccess: false` chama `getAccessibleNucleusIds` → segunda ida a `getCoordinatorNucleusIds` na mesma renderização.
2. **Dois round-trips de `electoralNucleus`** — `getCoordinatorNucleusIds` (só IDs) + `loadAccessibleNucleusOptions` (name/slug) no mesmo escopo.
3. **`errorProps` não migrado** — forms grandes ainda repetem wiring manual de `aria-*` apesar de `fieldError`.
4. **Prefetch não estende à página de criação** — `loadSupporterCreatePageData` pode repetir o padrão.

**Explicitamente fora (tradeoffs aceitos no C9/simplify):** AST neutro único Payload↔SQL; waterfall lista→overview; unificar lista+aggregate; remover alias `errorFor`; hoist de `toMessageOnlyState`.
