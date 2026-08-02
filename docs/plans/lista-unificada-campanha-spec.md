# Lista unificada `/campanha` — spec-mãe e critérios

Status: travado (freshness audit 2026-08-01 — premissas confirmadas no repo)
Atualizado em: 2026-08-01
Issue: #155
Priority: P1
Model: cursor-grok-4.5-high
Impeccable: B — superfícies de lista existentes, comportamento preservado
Appetite: ~1 dia eng (só docs + decisões)
Responsável: —

## Premissas

1. Factory = prólogo de página + render com slots; não unifica where/sort/paginação.
2. `atividades` fica fora da factory (cards + tabs próprios) — **não** entra em `opsListDomains`.
3. `assessores` e `territorios` precisam de pré-work antes de migrar (CL5a / CL6a).
4. Saved filters só municípios; allowlist `CampaignListId` para seletor de colunas.
5. Flag `LIST_UNIFIED` via env (`resolveListUnifiedEnabled` em CL2); URLs públicas intactas.

## Objetivos

- Documento-mãe que trava: slugs do registry v1, resolução de conflitos por domínio, boundaries, critérios de aceite do projecto.
- Engenheiro júnior lê este doc + o plano da sua issue e executa sem reunião.

## Contexto

Inventário as-built (2026-08-01) mostra **9 listas** staff/entity sob `(app)`: 8 candidatas à factory + `atividades` (cards, excluída). Há 3 níveis de contrato URL, sort divergente (`url` / `fixed` / `memory`), territórios sem paginação real, assessores fora de `CampaignTable`, saved filters só municípios. Sem travar estas decisões, a factory vira “unificação mentirosa”.

Predecessor entregue: Pass 2 W1 ([`sistema-listas-campanha.md`](sistema-listas-campanha.md), 2026-07-25) — `CampaignTable` + shells + parsers por domínio. Este projecto **não** reinventa essa espinha: compõe prólogo + render unificados por cima dela.

## Decisões travadas

- **Factory de prólogo + render, não de data path.** Loaders por domínio decidem where/sort/paginação (municípios já paginam no server; territórios ganham paginação real em CL6a). **Rejeitado:** query unificada cross-domínio.
- **Registry em `src/lib/opsListRegistry/` client-safe.** Só metadados; consumido por views client no projecto OH12. **Rejeitado:** só utilities / duplo registry.
- **Atividades fora de `opsListDomains`.** Cards são exceção documentada (Pass 2 D5); `getOpsListDomain('atividades')` → `null`. **Rejeitado:** forçar tabela; **rejeitado:** meta `status: 'excluded'` dentro do registry.
- **URLs públicas preservadas.** Unificação interna; `/campanha/<slug>` genérica fora. **Rejeitado:** `/campanha/listas/<slug>`.
- **Conflitos resolvidos por domínio** (tabela abaixo), não global. **Rejeitado:** “um sort model / um redirect para todos”.

## Escopo travado (8 + 1 excluída) — SSOT

Tabela canónica dos metadados v1. Planos filhos (**CL2+**) citam esta secção — **não** reescrevem as células. Ordem estável = **por `routePath`** (não alfabética). `gate` = valor as-built de `requireCampaignPageActor` (ou alvo documentado).

| slug           | routePath                | gate           | columnListId         | savedFilters | sortModel                | canonicalRedirect                        |
| -------------- | ------------------------ | -------------- | -------------------- | ------------ | ------------------------ | ---------------------------------------- |
| `municipios`   | `/campanha/municipios`   | `noLeader`     | `municipios`         | `true`       | `url`                    | `true`                                   |
| `liderancas`   | `/campanha/liderancas`   | `staff`        | `liderancas`         | `false`      | `url`                    | `true`                                   |
| `dobradinhas`  | `/campanha/dobradinhas`  | `staff`        | `dobradinhas`        | `false`      | `url`                    | `true`                                   |
| `demandas`     | `/campanha/demandas`     | `staff`        | `demandas`           | `false`      | `fixed` (`-createdAt`)   | `true` (CL8)                             |
| `assessores`   | `/campanha/assessores`   | `unrestricted` | `'assessores'` (CL5) | `false`      | `fixed` (sort `name`)    | `true` (CL5)                             |
| `territorios`  | `/campanha/territorios`  | `noLeader`     | `territorios`        | `false`      | `memory` → `url` em CL6a | `true` (sem `page` → com `page` em CL6a) |
| `apoiadores`   | `/campanha/apoiadores`   | `staff` †      | `apoiadores`         | `false`      | `url`                    | `true`                                   |
| `organizacoes` | `/campanha/organizacoes` | `staff`        | `organizacoes`       | `false`      | `fixed` (`name`)         | `true` (CL8)                             |

† `apoiadores` hoje: `requireCampaignPageActor()` sem gate + `canAccessSupporterArea` (= staff). Registry pina `staff` como alvo da factory.

`atividades` **não** entra em `opsListDomains` — cards + tabs (`ActivityList` / `ActivityCard`); rota intocada. Documentar a razão no comentário do registry (Pass 2 D5).

`CampaignListId` (`CAMPAIGN_LIST_IDS`): `municipios`, `liderancas`, `dobradinhas`, `organizacoes`, `demandas`, `apoiadores`, `territorios`, `assessores` (CL5).

Campos de implementação (CL2), fora desta tabela: `layout: 'table'`, tipagem `OpsListDomainMeta` — sem `status: 'excluded'`.

## Resolução de conflitos por domínio

| Conflito                                                        | Resolução travada                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Canonical redirect ausente (assessores, demandas, organizações) | Assessores: `resolveAdvisorListUrl` (CL5). Demandas/organizações: `resolveDemandListUrl` / `resolveOrganizationListUrl` (CL8). |
| Sort divergente (URL vs fixo vs memória)                        | Não unificar. Registry declara `sortModel: 'url' \| 'fixed' \| 'memory'`.                                                      |
| Territórios sem paginação real                                  | CL6a obrigatório: paginação server 25 + sort no loader antes de migrar.                                                        |
| Assessores fora de `CampaignTable`                              | CL5a obrigatório: reescrever em `CampaignTable` + URL canónico.                                                                |
| Seletor de colunas (allowlist fixa)                             | Registry mapeia slug → `columnListId`; pré-work adiciona `assessores` à allowlist se usar picker.                              |
| Saved filters (só municípios)                                   | Registry declara `savedFilters: boolean`; slot só para municípios; **não** generalizar B18.                                    |
| Edit model divergente                                           | Não unificar; células/editores ficam nas colunas do domínio.                                                                   |
| Toolbar heterogénea                                             | Factory expõe `toolbarSlot` por domínio.                                                                                       |
| Gate de papel diferente                                         | Registry declara `gate`; factory resolve actor e delega ao predicado existente.                                                |
| Atividades cards                                                | Fora de `opsListDomains`; rota intocada.                                                                                       |

## Inventário as-built (2026-08-01)

Estado **hoje** (não o contrato-alvo). Para sortModel / canonicalRedirect / columnListId alvo, ver § Escopo.

| Rota                     | Layout    | URL hoje                                                      | Paginação hoje                            | Tabela hoje                             |
| ------------------------ | --------- | ------------------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| `/campanha/municipios`   | table     | `resolveMunicipalityListUrl` (canonical)                      | server                                    | `CampaignTable` + picker                |
| `/campanha/liderancas`   | table     | `resolveLeadershipListUrl`                                    | server                                    | `CampaignTable`                         |
| `/campanha/dobradinhas`  | table     | `resolveStateDeputyListUrl`                                   | server                                    | `CampaignTable`                         |
| `/campanha/demandas`     | table     | `parseDemandListParams` (sem resolve canónico)                | server                                    | `CampaignTable`                         |
| `/campanha/assessores`   | table     | `resolveAdvisorListUrl` (CL5)                                 | server                                    | `AdvisorsTable` → `CampaignTable` (CL5) |
| `/campanha/territorios`  | table     | `resolveTerritoryListUrl` (sem `page`); sort/filter in-memory | **fake** (`page=1`/`totalPages=1`) — CL6a | `CampaignTable`                         |
| `/campanha/apoiadores`   | table     | resolve via `supporterUi`                                     | server                                    | `CampaignTable`                         |
| `/campanha/organizacoes` | table     | `parseOrganizationListParams` (sem resolve canónico)          | server                                    | `CampaignTable`                         |
| `/campanha/atividades`   | **cards** | `resolveActivityListUrl`                                      | server                                    | `ActivityList` — **excluída**           |

## Boundaries Teqo

- **Always:** reusar `CampaignTable`, shells de lista, loaders por domínio; queries com `user` + `overrideAccess: false`; registry só metadados em `lib/` (sem importar loaders/parsers por valor).
- **Ask first:** mudar URL pública; mexer em saved filters storage; dependency nova; alterar allowlist de colunas.
- **Never:** normalizar params entre domínios (B18); reescrever parsers “para ficar bonito”; forçar atividades para tabela; cadastro paralelo a Contact; rota genérica `/campanha/listas/<slug>`.

## Critérios de aceite do projecto

1. Sem `LIST_UNIFIED`: e2e existentes idênticas a `main`.
2. Com `LIST_UNIFIED=1`: cada lista migrada renderiza pela `OpsListPage` com paridade funcional/visível.
3. URLs canónicas e saved filters municípios funcionam igual.
4. `pnpm gate:fast` + e2e das listas verdes.
5. Registry falha o build se faltar slug v1 ou coluna sem `label`.

## Index de planos filhos

Números GitHub (#156–#162) **não** seguem a ordem de execução (CL5=#160, CL6=#159). Ordem de trabalho: **CL1 → CL2 → CL3** (tracer municípios); depois **CL4 / CL5 / CL6 / CL7** em paralelo sobre CL3; **CL8** fecha contrato.

| ID  | Issue | Plano                                                                              | Depends                    | Appetite |
| --- | ----- | ---------------------------------------------------------------------------------- | -------------------------- | -------- |
| CL2 | #156  | [`cl2-ops-list-registry.md`](cl2-ops-list-registry.md)                             | CL1                        | ~0,5–1d  |
| CL3 | #157  | [`cl3-ops-list-page-municipios.md`](cl3-ops-list-page-municipios.md)               | CL2                        | ~2d      |
| CL4 | #158  | [`cl4-liderancas-dobradinhas-demandas.md`](cl4-liderancas-dobradinhas-demandas.md) | CL3                        | ~1,5–2d  |
| CL5 | #160  | [`cl5-assessores-factory.md`](cl5-assessores-factory.md)                           | CL3 (+ CL5a bloqueia CL5b) | ~2–3d    |
| CL6 | #159  | [`cl6-territorios-factory.md`](cl6-territorios-factory.md)                         | CL3 (+ CL6a bloqueia CL6b) | ~2d      |
| CL7 | #161  | [`cl7-apoiadores-organizacoes.md`](cl7-apoiadores-organizacoes.md)                 | CL3                        | ~1–1,5d  |
| CL8 | #162  | [`cl8-contrato-cleanup.md`](cl8-contrato-cleanup.md)                               | CL4–CL7                    | ~1d      |

## Dependência entre projectos

- **Dura (OH ← CL):** OH8 depende de **CL3**; OH12 depende de **CL8** (registry estável) — ver [`ops-hibrido-rsc-local-spec.md`](ops-hibrido-rsc-local-spec.md) e [`oh12-ops-list-local.md`](oh12-ops-list-local.md).
- **Paralelas OK:** OH1–OH7 com CL1–CL3.
- **Este doc (CL1)** não muda código de produto — só trava decisões para CL2+.

## Não escopo / rabbit holes

- **Não escopo desta Issue:** implementar registry, factory, migrar rotas, pré-work assessores/territórios — vivem em CL2–CL8.
- **Não generalizar B18** (saved filters) para outros domínios “já que há registry”.
- **Não importar loaders no registry** — `lib/` deixaria de ser client-safe e abriria ciclos.
- **Não forçar `atividades` “só o meta”** — factory sem suporte a cards.
- **Não inventar `/campanha/listas/<slug>`** — URLs públicas intactas.

## Mapa de ficheiros (as-built → alvo)

| Domínio                | Parser / URL hoje                                                 | Loader / page data                                                | UI                                                                |
| ---------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| municípios             | `utilities/municipality/municipalityListUrl.ts`                   | `municipality*Data`                                               | `components/campaign/municipality/`                               |
| lideranças             | `utilities/leadership/leadershipListUrl.ts`                       | `leadership*Data`                                                 | `components/campaign/leadership/`                                 |
| dobradinhas            | `utilities/stateDeputyListUrl.ts`                                 | state-deputy loaders                                              | `components/campaign/stateDeputy/`                                |
| demandas               | `utilities/campaignDemandData.ts` (`parseDemandListParams`)       | idem                                                              | `components/campaign/demand/`                                     |
| assessores             | `utilities/advisor/advisorListUrl.ts`                             | `loadAdvisorListPageData`                                         | `components/campaign/advisor/AdvisorsTable.tsx` (`CampaignTable`) |
| territórios            | `utilities/territory/territoryListUrl.ts`                         | `loadTerritoryOverview.ts` + `territoryOverview.ts` (filter/sort) | `components/campaign/territory/`                                  |
| apoiadores             | `utilities/supporter/supporterUi.ts`                              | `supporter/*Data`                                                 | `components/campaign/supporter/`                                  |
| organizações           | `utilities/organizationData.ts` (`parseOrganizationListParams`)   | idem                                                              | `components/campaign/organization/`                               |
| atividades             | `utilities/activityUi.ts`                                         | `activityPageData`                                                | `ActivityList` (excluída)                                         |
| comum                  | `utilities/campaignListUrl.ts`, `lib/campaignColumnVisibility.ts` | —                                                                 | `shared/CampaignTable.tsx` + shells                               |
| registry (novo em CL2) | —                                                                 | —                                                                 | `src/lib/opsListRegistry/`                                        |

## Referências

- [`src/components/campaign/shared/CampaignTable.tsx`](../../src/components/campaign/shared/CampaignTable.tsx)
- [`src/utilities/campaignListUrl.ts`](../../src/utilities/campaignListUrl.ts)
- [`src/lib/campaignColumnVisibility.ts`](../../src/lib/campaignColumnVisibility.ts)
- [`src/utilities/campaignPageActor.ts`](../../src/utilities/campaignPageActor.ts) — gates `staff` / `noLeader` / `unrestricted`
- Parsers: paths na tabela “Mapa de ficheiros” acima
- Predecessor: [`sistema-listas-campanha.md`](sistema-listas-campanha.md)
- Projecto dependente: [`ops-hibrido-rsc-local-spec.md`](ops-hibrido-rsc-local-spec.md) · [`oh12-ops-list-local.md`](oh12-ops-list-local.md)
- CL2 (primeira implementação): [`cl2-ops-list-registry.md`](cl2-ops-list-registry.md)
