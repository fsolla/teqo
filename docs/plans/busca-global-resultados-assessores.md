# Busca global — resultados Assessores

Status: entregue (2026-07-29)
Atualizado em: 2026-07-29 — as-built: `searchHomeAdvisors` (`isUnrestrictedCampaignRole` → `[]` para assessor; word-start no nome; `municipalityIdsByAdvisorIds` exportado de `advisorData`); `HomeSearchAdvisorHit` + campo `advisors` no `POST /campanha/home-search`; `HomeSearchAdvisorGroup` + `HomeSearchHitRow` compartilhado; empty via `homeSearchHasAnyHits`; secundário = contagem de municípios (sem e-mail); sem migration.
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B50 — busca global)
Impeccable: B — grupo de hits no slot B47
Appetite: ~0,5 dia eng; loader + grupo; sem WA (B55)
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · `/campanha/assessores` (B19) · tema `campaign`.

Brief: CG/candidato acha assessor pelo nome; assessor **não** precisa ver o grupo inteiro se access negar — falhar fechado com a mesma regra de `isCampaignUnrestricted` da lista (se advisor não lê assessores, grupo sempre vazio / não registrado).

## Dados → decisão → apresentação

Dados: N/A (identificação). Lista simples.

## Contexto

Grupo “Assessores”. Clique → `/campanha/assessores/[id]`. WhatsApp = **B55**.

## Objetivos

- `searchHomeAdvisors(query, user)` respeitando access B19 (unrestricted only para a vertical de assessores — se o ator não pode listar, não montar provider).
- Título **“Assessores”**; oculto se vazio.
- Linha: nome; secundário discreto (e-mail mascarado ou contagem de municípios — barato).
- Sem migration.

## Decisões travadas

- **Mesmo access da lista de assessores.** **Rejeitado:** advisor buscando colegas (não é o modelo atual).
- **Detalhe existente.** **Rejeitado:** página nova.
- **i18n:** `HomeSearchAdvisorHit`; “Assessores”.

## Questões em aberto

- **Advisor vê o grupo?** **Opções:** A nunca | B só a si. **Recomendação:** A — consistente com nav. _(assumido)_

## Abordagem proposta

Loader espelhando `advisorData`; grupo UI como **child** do slot B47 + mesmo `POST` que B48 (não registry plugável).

## Dependências

- Dura: **B47**. Soft: B19 ✓; **B55** para WA.

## Não escopo

WA → **B55**. Outros grupos / grid → B48–B54.

## Rabbit holes

**Expor e-mail `@planilha.invalid`.** **Mitigação:** não mostrar e-mail inválido; preferir nome + N municípios.

## Já resolvido no simplify (2026-07-29 — não reabrir)

- Prop `leading` morta removida de `HomeSearchHitRow`.
- Campo de desempate do sort renomeado `votes2022` → `tieBreakDesc` em `homeSearchMunicipalityMatch.ts` (assessores usam `municipalityCount` como tie-break).
- `select: { name: true }` no scan de assessores (`role` já filtrado no `where`).
- Rebase com **B68**: `mode: suggest` intacto; assessores só no ramo `mode: search` (`Promise.all` com municípios).

## Adiado com gatilho

- **Orquestrador único do POST** (derivar contagem de municípios do `loadMunicipalityScope` já pago no ramo municípios, em vez de `municipalityIdsByAdvisorIds` extra). **Gatilho:** latência perceptível no Início **ou** antes de **B51+** se o mesmo POST continuar pesado.
- **Scan completo de `campaignUser` advisor** (`limit: 0`) + filtro word-start em memória. **Gatilho:** roster de assessores crescer além do tamanho confortável da planilha / considerar `pg_trgm` ou prefixo SQL.
- **`filterAndRankHomeSearchByName` / `HomeSearchResultGroup`.** **Gatilho:** 3º loader ou 3º grupo (B51+).
- **Carga duplicada município+pledge no POST** (herdada de B48; B50 só adiciona ramo paralelo). Ver [busca-global-resultados-municipios.md](busca-global-resultados-municipios.md) § Adiado.

## Referências

- [busca-global-inicio-input.md](busca-global-inicio-input.md) · `gerenciar-assessores.md` · `utilities/advisorData.ts` (`loadAdvisorListPageData` / `loadAdvisorDetail`) · `/campanha/assessores/[id]`
