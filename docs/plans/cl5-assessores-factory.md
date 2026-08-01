# CL5 — Assessores: pré-work `CampaignTable` + URL canónico, depois factory

Status: em execução
Atualizado em: 2026-08-01
Issue: #160
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — mesma superfície `/campanha/assessores`, tabela reescrita no sistema da casa
Appetite: ~2–3 dias eng
Depends: CL3 (done / in-prod — #157)
Responsável: —

## Freshness audit (2026-08-01)

- CL3 (#157) `done`/`in-prod`; `OpsListPage`/`OpsListView` + flag `LIST_UNIFIED` existem; registry já tem slug `assessores` com `columnListId: null`, `sortModel: 'fixed'`, `canonicalRedirect: false`.
- Paths citados existem (`AdvisorsTable`, `advisorData.ts`, `leadershipListUrl.ts` como padrão). Pasta `utilities/advisor/` ainda não existe — criar `advisorListUrl.ts` lá.
- **Correção:** registry alvo `sortModel` permanece `'fixed'` (sort server sempre `name`; fases não adicionam sort por URL). Só `columnListId: 'assessores'` + `canonicalRedirect: true`. O SSOT `lista-unificada` que dizia `fixed → url` estava à frente do appetite.
- **Param `criar=1`:** quick-create (B87) — `resolveAdvisorListUrl` deve preservá-lo no canónico (senão o redirect mata o draft).
- Fase 3 “`status: 'v1'`”: registry actual não tem campo `status` — paridade = page delega a `OpsListPage` com `resolveListUnifiedEnabled()` (padrão CL3/municípios).

## Premissas

1. Hoje `AdvisorsTable` usa `ui/Table` cru (fora de `CampaignTable`) e o parse de URL não tem canonical redirect.
2. O toggle “Editar nome e contato” permanece (produto não pediu mudança).
3. Gate `unrestricted` (coordinator/candidate) mantido.

→ Premissas confirmadas; sigo.

## Objetivos

- **CL5a (pré-work):** `AdvisorsTable` reescrito como colunas `CampaignTable`; `resolveAdvisorListUrl` com canonical redirect; `assessores` registado em `CampaignListId` para seletor de colunas.
- **CL5b:** slug `assessores` na factory com flag ON, paridade.

## Dados → decisão → apresentação

Dados: N/A.

## Decisões travadas

- **Reescrever a tabela antes de migrar.** Migrar por cima do `ui/Table` cru cria factory mentirosa (sem colunas como dado, sem picker, sem pending boundary). **Rejeitado:** adaptar a factory para aceitar tabela fora do sistema; deixar assessores fora da v1 (pedido explícito inclui).
- **Canonical redirect agora.** É o domínio que menos saved-filter/parsers existentes arrisca (não tem saved filters). **Rejeitado:** manter parse solto (inconsistência com os outros migrados).
- **Manter o toggle Editar.** **Rejeitado:** converter para edit-where-you-see neste projeto (escopo de produto, não arquitetura).

## Abordagem proposta

Componentes:

- **`src/utilities/advisor/advisorListUrl.ts`** (novo): `resolveAdvisorListUrl(rawParams)` seguindo o padrão de `resolveLeadershipListUrl` (parse → canonicalize → redirect se difere). Reusar helpers de [`src/utilities/campaignListUrl.ts`](src/utilities/campaignListUrl.ts).
- **`src/components/campaign/advisor/AdvisorsTable.tsx`** (reescrito): colunas como dado sobre `CampaignTable`. Inventário das colunas/células actuais (lido 2026-08-01) e para onde cada uma vai:

  | Hoje (ui/Table cru)                                                                                   | Na reescrita                                                                                |
  | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
  | Nome (read) / `AdvisorDebouncedTextCell` (edição)                                                     | coluna `name` (`label: 'Nome'`, mandatory) — read/edit conforme toggle                      |
  | Email (`CampaignCopyableCell`, placeholder planilha escondido)                                        | coluna `email`                                                                              |
  | Telefone (formatado + `wa.me` icon)                                                                   | coluna `phone`                                                                              |
  | Carteira de municípios (`MunicipalityPortfolioCell` com `municipalityIndex` + `municipalitiesAction`) | coluna `municipalities` — mesma célula B34, só remontada como dado                          |
  | Reset de senha (`AdvisorPasswordResetButton`)                                                         | coluna `actions`                                                                            |
  | Linha draft (`createAction`, `autoCreateDraft`, inputs nome/email/telefone + chips)                   | linha extra no corpo — mesma lógica, dentro do novo componente                              |
  | Toggle “Editar nome e contato” (`editing` state)                                                      | permanece no topo da tabela (fora das colunas — controla read vs edit das células de texto) |
  | `CampaignListEmptyState` / `CampaignListSheetProvider`                                                | empty slot + provider envolvendo a tabela                                                   |

- **Registry:** actualizar `assessores` (`sortModel: 'fixed'`, `canonicalRedirect: true`, `columnListId: 'assessores'`).
- **Column visibility:** registar `'assessores'` em `CAMPAIGN_LIST_IDS` ([`src/lib/campaignColumnVisibility.ts`](src/lib/campaignColumnVisibility.ts)); colunas novas nascem visíveis (regra: só ocultas persistidas).

## Fases verificáveis

### Fase 1 — Tracer: `CampaignTable` renderizando as mesmas linhas

- **Quota:** ~0,5
- **Entrega:** reescrita da tabela sem mexer em URL; paridade visual desktop/mobile.
- **Aceite:**
  - [x] mesmas linhas/colunas/ações visíveis
  - [x] seletor de colunas funciona com cookie próprio
- **Verify:** `pnpm gate:fast` + e2e assessores
- **Files:** `AdvisorsTable.tsx`, `src/lib/campaignColumnVisibility.ts`, page assessores
- **Tamanho:** M

### Fase 2 — URL canónico

- **Quota:** ~0,3
- **Entrega:** `resolveAdvisorListUrl` + redirect na page; pins unit do parser.
- **Aceite:**
  - [x] params lixo redirecionam para a forma canónica
  - [x] sort/filtros sobrevivem ao redirect
- **Verify:** `pnpm gate:fast` + pin unit `advisorListUrl`
- **Files:** `advisorListUrl.ts`, `tests/unit/advisorListUrl.unit.spec.ts`, page
- **Tamanho:** M

### Fase 3 — Factory (CL5b)

- **Quota:** ~0,2
- **Entrega:** page delega a `OpsListPage` com `LIST_UNIFIED` (registry sem campo `status`).
- **Aceite:** paridade com flag ON/OFF
- **Verify:** `pnpm gate:fast` + pin unit `opsListPage`
- **Files:** registry (`columnListId`/`canonicalRedirect`), page
- **Tamanho:** S

### Checkpoint

Diff visual da tabela nova aprovado por produto (o toggle Editar fica igual).

## Dependências

- CL3 (factory). Reusa `loadAdvisorListPageData` ([`src/utilities/advisor/advisorData.ts`](src/utilities/advisor/advisorData.ts)).

## Não escopo

- Mudar edit model; saved filters para assessores; mudar gate.

## Rabbit holes

- **“Só embrulhar” `AdvisorsTable` na factory sem reescrever.** Se alguém “só adaptar”: picker/pending/colunas ficam inconsistentes. **Mitigação:** CL5a bloqueia CL5b.
- **Extractor genérico de chips de portfolio.** B34 já cobre (`MunicipalityPortfolioCell`) — reusar, não inventar terceira.

## Referências

- [`src/components/campaign/advisor/AdvisorsTable.tsx`](src/components/campaign/advisor/AdvisorsTable.tsx)
- [`src/app/(campaign)/campanha/(app)/assessores/page.tsx`](<src/app/(campaign)/campanha/(app)/assessores/page.tsx>)
- [`src/utilities/leadership/leadershipListUrl.ts`](src/utilities/leadership/leadershipListUrl.ts) (padrão de resolve+redirect)
- [`src/components/campaign/shared/MunicipalityPortfolioCell.tsx`](src/components/campaign/shared/MunicipalityPortfolioCell.tsx)
