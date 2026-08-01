# Lista unificada `/campanha` — spec-mãe e critérios

Status: rascunho
Atualizado em: 2026-08-01
Issue: #155
Priority: P1
Model: cursor-grok-4.5-high
Impeccable: B — superfícies de lista existentes, comportamento preservado
Appetite: ~1 dia eng (só docs + decisões)
Responsável: —

## Premissas

1. Factory = prólogo de página + render com slots; não unifica where/sort/paginação.
2. `atividades` fica fora da factory (cards + tabs próprios).
3. `assessores` e `territorios` precisam de pré-work antes de migrar.
4. Saved filters só municípios; allowlist `CampaignListId` para seletor de colunas.
5. `LIST_UNIFIED` é compile-time env; URLs públicas intactas.

→ Corrija agora ou sigo com estas.

## Objetivos

- Documento-mãe que trava: slugs do registry v1, resolução de conflitos por domínio, boundaries, critérios de aceite do projecto.
- Engenheiro júnior lê este doc + o plano da sua issue e executa sem reunião.

## Dados → decisão → apresentação

Dados: N/A — spec de arquitetura.

## Contexto

Inventário lido em 2026-08-01 mostra 9 listas com 3 níveis de contrato URL, sort divergente, territórios sem paginação real, assessores fora de `CampaignTable`, saved filters só municípios. Sem travar estas decisões, a factory vira “unificação mentirosa”.

## Decisões travadas

- **Factory de prólogo + render, não de data path.** Loaders por domínio decidem where/sort/paginação. **Rejeitado:** query unificada (quebra municípios in-memory e territórios).
- **Registry em `src/lib/opsListRegistry/` client-safe.** Consumido por views client no projecto OH12. **Rejeitado:** só utilities / duplo registry.
- **Atividades `status: 'excluded'`.** Cards são exceção documentada (Pass 2 D5). **Rejeitado:** forçar tabela.
- **URLs públicas preservadas.** Unificação interna; `/campanha/<slug>` genérica fora. **Rejeitado:** `/campanha/listas/<slug>`.
- **Conflitos resolvidos por domínio** (tabela abaixo), não global. **Rejeitado:** “um sort model / um redirect para todos”.

## Resolução de conflitos por domínio

| Conflito                                                        | Resolução travada                                                                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| Canonical redirect ausente (assessores, demandas, organizações) | Assessores: criar `resolveAdvisorListUrl` no pré-work. Demandas/organizações: manter parse actual na v1 (`canonicalRedirect: false` no registry); migrar redirect só se CL8 medir custo < 0,5d/domínio. |
| Sort divergente (URL vs fixo vs memória)                        | Não unificar. Registry declara `sortModel: 'url'                                                                                                                                                        | 'fixed' | 'memory'`. |
| Territórios sem paginação real                                  | CL6a obrigatório: paginação server 25 + sort no loader antes de migrar.                                                                                                                                 |
| Assessores fora de `CampaignTable`                              | CL5a obrigatório: reescrever em `CampaignTable` + URL canónico.                                                                                                                                         |
| Seletor de colunas (allowlist fixa)                             | Registry mapeia slug → `columnListId`; pré-work adiciona `assessores` à allowlist se usar picker.                                                                                                       |
| Saved filters (só municípios)                                   | Registry declara `savedFilters: boolean`; slot só para municípios; não generalizar B18.                                                                                                                 |
| Edit model divergente                                           | Não unificar; células/editores ficam nas colunas do domínio.                                                                                                                                            |
| Toolbar heterogénea                                             | Factory expõe `toolbarSlot` por domínio.                                                                                                                                                                |
| Gate de papel diferente                                         | Registry declara `gate`; factory resolve actor e delega ao predicado existente.                                                                                                                         |
| Atividades cards                                                | `status: 'excluded'` com razão; rota intocada.                                                                                                                                                          |

## Boundaries Teqo

- **Always:** reusar `CampaignTable`, shells de lista, loaders por domínio; queries com `user` + `overrideAccess: false`.
- **Ask first:** mudar URL pública; mexer em saved filters storage; dependency nova; alterar allowlist de colunas.
- **Never:** normalizar params entre domínios (B18); reescrever parsers “para ficar bonito”; forçar atividades para tabela; cadastro paralelo a Contact.

## Critérios de aceite do projecto

1. Sem `LIST_UNIFIED`: e2e existentes idênticas a `main`.
2. Com `LIST_UNIFIED=1`: cada lista migrada renderiza pela `OpsListPage` com paridade funcional/visível.
3. URLs canónicas e saved filters municípios funcionam igual.
4. `pnpm gate:fast` + e2e das listas verdes.
5. Registry falha o build se faltar slug v1 ou coluna sem `label`.

## Referências

- [`src/components/campaign/shared/CampaignTable.tsx`](src/components/campaign/shared/CampaignTable.tsx)
- [`src/utilities/campaignListUrl.ts`](src/utilities/campaignListUrl.ts)
- Parsers por domínio: `municipalityListUrl.ts`, `leadershipListUrl.ts`, `stateDeputyListUrl.ts`, `supporterUi.ts`, `territoryListUrl.ts`, `activityUi.ts`
- [`src/lib/campaignColumnVisibility.ts`](src/lib/campaignColumnVisibility.ts)
- Plano dependente: Ops RSC Local Hybrid (OH12 consome este registry)
