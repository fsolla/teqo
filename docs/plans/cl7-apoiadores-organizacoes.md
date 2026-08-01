# CL7 — Migrar apoiadores e organizações para a factory

Status: entregue
Atualizado em: 2026-08-01
Issue: #161
Priority: P1
Model: composer-2.5
Impeccable: B — mesmas superfícies, render novo atrás de flag
Appetite: ~1–1,5 dias eng
Depends: CL3
Responsável: —

## Premissas

1. Apoiadores já está em `CampaignTable` com `resolveSupporterListUrl` — migração directa.
2. Organizações usa `CampaignTable` inline + parse sem redirect canónico — entra com `canonicalRedirect: false` (decisão CL8 para redirect).
3. Nenhum gate muda: apoiadores tem path staff+leader com view por papel (leitura), organizações staff.

→ Corrija agora ou sigo com estas.

## Objetivos

- `apoiadores` e `organizacoes` no registry com `status: 'v1'`; rotas delegam à `OpsListPage` com flag ON, paridade total (KPIs/overview de apoiadores incluído como slot).

## Dados → decisão → apresentação

Dados: N/A — overview de apoiadores é a mesma agregação actual, só reposicionada como slot da view.

## Abordagem proposta

- **Registry:** `apoiadores` (`sortModel: 'url'`, `canonicalRedirect: true`); `organizacoes` (`sortModel: 'fixed'`, `canonicalRedirect: false`).
- **Apoiadores:** page delega; `SupporterList`/`SupporterFilters` entram como peças; overview KPI (total / “Certo + Tende” / “Indecisos”) como `overview` slot da `OpsListView` (mesma agregação `supporterListOverviewAggregate`).
- **Organizações:** page delega; `CampaignSearchForm` com `filterParams` preservando `kind` continua como toolbar slot; query não canónica **continua aceite**.

## Fases verificáveis

### Fase 1 — Apoiadores

- **Quota:** ~0,5
- **Aceite:**
  - [ ] paridade: KPIs, filtros (intenção de voto, território), paginação, search debounce
  - [ ] leader continua vendo só os seus (access path intacto)
- **Verify:** `pnpm gate:fast` + e2e apoiadores + int access
- **Files:** registry, `apoiadores/page.tsx`
- **Tamanho:** M

### Fase 2 — Organizações

- **Quota:** ~0,5
- **Aceite:** paridade; `kind` preservado na toolbar; sem redirect novo
- **Verify:** `pnpm gate:fast` + e2e organizações
- **Files:** registry, `organizacoes/page.tsx`
- **Tamanho:** M

## Dependências

- CL3 (factory). Reusa `loadSupportersPageData`, `loadOrganizationListPageData`, `supporterListOverviewAggregate`.

## Não escopo

- Canonical redirect para organizações (CL8 decide). Import CSV. LGPD/consent (fora do render de lista).

## Rabbit holes

- **“Melhorar” KPIs de apoiadores aproveitando o slot.** Mesma agregação, mesmo layout — qualquer KPI novo é outra issue.
- **Tocar no access path de apoiadores “para simplificar”.** Access por papel é invariante — não tocar.

## Referências

- [`src/app/(campaign)/campanha/(app)/apoiadores/page.tsx`](<src/app/(campaign)/campanha/(app)/apoiadores/page.tsx>)
- [`src/components/campaign/supporter/SupporterList.tsx`](src/components/campaign/supporter/SupporterList.tsx)
- [`src/utilities/supporter/supporterPageData.ts`](src/utilities/supporter/supporterPageData.ts)
- [`src/app/(campaign)/campanha/(app)/organizacoes/page.tsx`](<src/app/(campaign)/campanha/(app)/organizacoes/page.tsx>)
