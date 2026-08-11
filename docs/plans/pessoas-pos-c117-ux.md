# Pessoas pós-C117 — descoberta de ordenação no mobile e facet de ausência completo

Status: registrado (blocked até plano em main)
Atualizado em: 2026-08-11
Issue: #681
Priority: P3
Model: composer-2.5
Impeccable: B — encaixe no omnibox de `/campanha/pessoas`; sem rota nova
Appetite: ~0,5–1 dia eng; dois fixes de UX no mesmo recorte
Responsável: —

## Intenção

Dois achados P2 do /simplify da entrega C117 (#656), mesma superfície (omnibox de pessoas):

1. **Descoberta de ordenação no mobile (S12).** No mobile os headers sortáveis não existem (cards), e o grupo "Ordenação" só aparece digitando keyword; ao digitar o genérico "ordenar", o cap de 8 por grupo (`campaignListOmnibox.ts`) corta em `Nome/Contato/Assessora/Lidera`, escondendo `Aliada em`, `Assessorado` e `Base` — o usuário mobile não descobre que pode ordenar por essas colunas.
2. **Facet de ausência "completo" (S14).** Marcar a 3ª ausência zera o facet inteiro (contrato B18 "selecionar todos = todas" = ausente): a consulta "quem está sem *algum* dado" (fichas incompletas) é inexpressível — o terceiro clique faz os três chips sumirem no meio da interação.

## Fases (ordem de ROI)

1. **Facet de ausência completo** — decidir e implementar uma forma de "qualquer ausência" (ex.: 4º valor `qualquer_ausencia` no enum, OU toggle de tri-state) sem quebrar a canonicalização B18; o filtro casa `sem_assessor OR sem_base OR sem_contato`. Testar a interação "marcar os três" e a nova consulta.
2. **Descoberta de ordenação no mobile** — revisar cap/ordem/emptyQueryVisible do grupo "Ordenação" (ex.: 7 seeds de direção primária visíveis com query vazia no mobile, ou busca por coluna no desktop) para que todas as 7 chaves sejam alcançáveis por keyword e visíveis na tela mobile.

## Já resolvido no simplify (não reabrir)

- Perf do sort (Map pré-computado de contagem de assessorado).
- Hardening de e2e/unit apontado pelos revisores (indexOfRow, `dir`-sem-`sort`, doc de call sites).

## Explicitamente fora (skips + descartes + defers com gatilho)

- **S2 — comparador nulls-last duplicado** (`peopleData.sortPeopleRows` × `municipalityPageData.sortByNullableValue`): defer com gatilho — extrair helper compartilhado quando houver um 3º sort in-memory.
- **S3 — hook `useCampaignSortHeadState`** (5º wrapper re-derivando a regra de flip): defer com gatilho — refactor de headers quando houver o 6º wrapper ou um pass de headers.
- **S4 — labels de coluna duplicadas** (sort record × column config): descartado, precedente territórios.
- **S6 — tiebreak A–Z mesmo em desc**: decisão travada (precedente B15), unit-pinned.
- **S9/S10 — regex sem escape no e2e e fallback morto do chip**: descartados (precedente no próprio arquivo/espelho de territórios).
- **S11 — staff aparece em "Sem assessor"**: semântica da coluna Assessorado (staff nunca tem assessorado); unit-pinned; info para a mesa.
- **S13 — "Sem contato" = só telefone**: decisão travada no gate C117 (coluna Contato = telefone desde B197).
