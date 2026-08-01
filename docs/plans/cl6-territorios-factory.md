# CL6 — Territórios: paginação real + sort server, depois factory

Status: rascunho
Atualizado em: 2026-08-01
Issue: #159
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — mesma superfície `/campanha/territorios`, paginação/sort passam a ser reais
Appetite: ~2 dias eng
Depends: CL3
Responsável: —

## Premissas

1. Hoje `territorios` carrega tudo e filtra/ordena **em memória** na page; o footer de paginação é cosmético (`page=1`, `totalPages=1`).
2. O parser `resolveTerritoryListUrl` não tem `page` — terá de ganhar (contrato interno da rota, não URL pública nova para utilizadores).
3. São 27 territórios — paginação é arquitetura para o padrão da factory, não necessidade de escala.

→ Corrija agora ou sigo com estas.

## Objetivos

- **CL6a (pré-work):** paginação server (padrão 25) + sort executado no loader (`loadTerritoryOverview` ou wrapper), removendo o stub cosmético; `resolveTerritoryListUrl` aceita `page`.
- **CL6b:** slug `territorios` na factory com flag ON, paridade.

## Dados → decisão → apresentação

Dados: N/A — mesma tabela de territórios; nenhum KPI novo.

## Decisões travadas

- **Sort/paginação no server antes de migrar.** Factory não aceita “footer falso”. **Rejeitado:** manter tudo em memória e adaptar a factory para paginação fake (passa a mentira para a arquitetura nova); excluir territórios da v1 (pedido explícito inclui).
- **`page` no parser da rota.** **Rejeitado:** paginação fora da URL (perde deep-link e diverge das outras listas).
- **Manter `TerritoryList`/`TerritoryFilters` como peças de domínio.** **Rejeitado:** reescrever colunas neste projeto.

## Abordagem proposta

Componentes:

- **`src/utilities/territory/territoryListUrl.ts`** (alterado): aceitar `page` (inteiro ≥1) com canonicalização igual às outras listas.
- **`src/utilities/territory/territoryOverview.ts`** (alterado): `sortTerritoryRows`/`filterTerritoryRows` passam a ser aplicados pelo loader; page slice devolvido com `totalDocs`/`totalPages` reais.
- **`src/app/(campaign)/campanha/(app)/territorios/page.tsx`** (alterado): usa o loader paginado; footer recebe valores reais; flag ON delega à factory.
- **Registry:** `territorios` (`sortModel: 'url'`, `canonicalRedirect: true`, `columnListId: 'territorios'`).

## Fases verificáveis

### Fase 1 — Tracer: paginação real no loader

- **Quota:** ~0,5
- **Entrega:** loader pagina/ordena; page renderiza slice; footer real.
- **Aceite:**
  - [ ] `?page=2` muda as linhas visíveis
  - [ ] sort por URL ordena no loader (não no client)
  - [ ] `totalPages` calculado do total real
- **Verify:** `pnpm gate:fast` + pin int do loader + e2e territórios
- **Files:** `territoryOverview.ts`, `territoryListUrl.ts`, page
- **Tamanho:** M

### Fase 2 — Factory (CL6b)

- **Quota:** ~0,5
- **Entrega:** registry `status: 'v1'`; page delega com flag ON.
- **Aceite:** paridade com flag ON/OFF (inclui paginação real em ambos)
- **Verify:** `pnpm gate:fast` + e2e territórios com env
- **Files:** registry, page
- **Tamanho:** S

## Dependências

- CL3 (factory). Reusa `loadTerritoryOverview` ([`src/utilities/territory/territoryOverview.ts`](src/utilities/territory/territoryOverview.ts)) e `TerritoryList`.

## Não escopo

- Mudar filtros/colunas; saved filters; agrupamento novo.

## Rabbit holes

- **“Só passar o stub” para a factory.** Se alguém “só adaptar”: footer mentiroso entra na arquitetura nova. **Mitigação:** CL6a bloqueia CL6b.
- **Paginar em memória “porque são só 27”.** Diverge do padrão e quebra o contrato da factory. **Mitigação:** paginação server como as outras.

## Referências

- [`src/utilities/territory/territoryListUrl.ts`](src/utilities/territory/territoryListUrl.ts)
- [`src/utilities/territory/territoryOverview.ts`](src/utilities/territory/territoryOverview.ts)
- [`src/components/campaign/territory/TerritoryList.tsx`](src/components/campaign/territory/TerritoryList.tsx)
- [`src/app/(campaign)/campanha/(app)/territorios/page.tsx`](<src/app/(campaign)/campanha/(app)/territorios/page.tsx>)
