# CL4 — Migrar lideranças, dobradinhas, demandas para a factory

Status: rascunho
Atualizado em: 2026-08-01
Issue: #158
Priority: P1
Model: composer-2.5
Impeccable: B — mesmas superfícies, render novo atrás de flag
Appetite: ~1,5–2 dias eng
Depends: CL3
Responsável: —

## Premissas

1. Padrão provado em municípios (CL3) — estas três são tabelas `CampaignTable` com URL canónico (lideranças, dobradinhas) ou parse estável (demandas, `canonicalRedirect: false`).
2. Demandas mantém sort fixo `-createdAt` e **não** ganha redirect canónico nesta issue.

→ Corrija agora ou sigo com estas.

## Objetivos

- `liderancas`, `dobradinhas`, `demandas` no registry com `status: 'v1'`; rotas delegam à `OpsListPage` com flag ON, paridade total.
- Cada migração mantém gate actual (`noLeader`/`staff`), colunas, chips/portfolio, sheet providers.

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

Por domínio, o mesmo movimento de CL3:

1. Adicionar meta no registry (`sortModel`: `'url'` lideranças/dobradinhas, `'fixed'` demandas; `canonicalRedirect`: `true`/`true`/`false`).
2. `page.tsx` da rota: flag OFF → JSX actual; ON → mesma sequência (gate, payload, URL resolve, loader, `readCampaignColumnVisibility`) montando `OpsListView`.
3. Peças de domínio (`LeadershipFilters`, `StateDeputyFilters`, chips `MunicipalityPortfolioCell`, `CampaignListSheetProvider`, `LeadershipListSupportStatusControl`) entram como slots/colunas — **sem reescrita**.

## Fases verificáveis

### Fase 1 — Lideranças

- **Quota:** ~0,4
- **Aceite:**
  - [ ] `/campanha/liderancas` com flag ON: mesma tabela, filtros, chips de municípios/dobradinha, sheet
  - [ ] URL canónica e sort por URL iguais
- **Verify:** `pnpm gate:fast` + e2e lideranças
- **Files:** registry, `liderancas/page.tsx`
- **Tamanho:** M

### Fase 2 — Dobradinhas

- **Quota:** ~0,3
- **Aceite:** paridade em `/campanha/dobradinhas` (chips, sheet, sort)
- **Verify:** `pnpm gate:fast` + e2e dobradinhas
- **Files:** registry, `dobradinhas/page.tsx`
- **Tamanho:** M

### Fase 3 — Demandas

- **Quota:** ~0,3
- **Entrega:** meta com `canonicalRedirect: false`, `sortModel: 'fixed'`; page delega mantendo `CampaignFilterChips` de status.
- **Aceite:** paridade; query string não canónica **continua aceite** (comportamento actual, sem redirect novo)
- **Verify:** `pnpm gate:fast` + e2e demandas
- **Files:** registry, `demandas/page.tsx`
- **Tamanho:** M

## Dependências

- CL3 (factory provada). Reusa loaders `leadershipData.ts`, `stateDeputyData.ts`, `campaignDemandData.ts`.

## Não escopo

- Canonical redirect para demandas (CL8 decide). Generalizar saved filters. Mudar edit models.

## Rabbit holes

- **“Uniformizar” chips/portfolio para um slot genérico.** Células de relação são de domínio (B34). **Mitigação:** colunas passadas como dado, como hoje.
- **Dar redirect canónico a demandas de brinde.** Muda comportamento de URL = regressão B18-like. **Mitigação:** flag `canonicalRedirect: false` + nota.

## Referências

- [`src/app/(campaign)/campanha/(app)/liderancas/page.tsx`](<src/app/(campaign)/campanha/(app)/liderancas/page.tsx>)
- [`src/app/(campaign)/campanha/(app)/dobradinhas/page.tsx`](<src/app/(campaign)/campanha/(app)/dobradinhas/page.tsx>)
- [`src/app/(campaign)/campanha/(app)/demandas/page.tsx`](<src/app/(campaign)/campanha/(app)/demandas/page.tsx>)
- [`src/utilities/leadership/leadershipListUrl.ts`](src/utilities/leadership/leadershipListUrl.ts), [`src/utilities/stateDeputy/stateDeputyListUrl.ts`](src/utilities/stateDeputy/stateDeputyListUrl.ts)
