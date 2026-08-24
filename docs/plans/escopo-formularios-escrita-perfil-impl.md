# Impl: Escala pós-C141 — options write-scoped para formulários de escrita

Status: em execução
Atualizado em: 2026-08-24
Issue: #769
Intenção: docs/plans/escopo-formularios-escrita-perfil.md
Appetite restante: ~0,5–1 dia eng (herdado)

## Leitura da intenção

- **Outcome:** os pickers de município dos formulários de ESCRITA oferecem apenas municípios do escopo de escrita do ator (`getWritableMunicipalityIds`): irrestrito/tudo → todos; carteira → carteira; somente_leitura → `[]` (não abre o form é C142; aqui só não oferecer nada). Superfícies: atividade (create/update + giro), demanda (create), apoiador (novo), liderança (create/edit), organização (create/edit).
- **O que NÃO negociar:** read surfaces intocadas (listas, filtros, agenda, dossier, mapa) — `loadMunicipalityOptions` continua read-scoped para elas; nenhuma mudança de enforcement (C141 já fail-closed: `activity.ts:128-131,213-216`, `assertMunicipalitiesWithinScope` `leadership.ts:65-80`, ficha `assertPersonContactWritable`, access de demands/supporters/organizations); sem migration; sem mudar semântica de `getWritableMunicipalityIds`/`getAdvisorMunicipalityIds`.
- **O que reavaliar:** o giro não usa `loadMunicipalityOptions` (usa `loadVisitPlannerRegions`/`loadVisitCandidates`, read-scoped) e as células chip (`MunicipalityPortfolioCell`/`PeopleMunicipalityCell`) recebem `addableIds` de `getAdvisorMunicipalityIds` (READ). Ambos são superfícies de escrita e entram — com o menor delta possível e guardas para não regredir leitura.

## Abordagem recomendada

```mermaid
flowchart TD
    A[Write-form page / giro / chip list] --> B{superfície}
    B -->|forms create/edit| C[loadWritableMunicipalityOptions]
    B -->|giro composer| D[loadVisitPlannerRegions / loadVisitCandidates + writeScope]
    B -->|chip addableIds| E[getWritableMunicipalityIds]
    C --> F[getWritableMunicipalityIds]
    F -->|null irrestrito/tudo| G[find all, sort name]
    F -->|[] somente_leitura| H[return [] / skip fetch]
    F -->|carteira ids| I[find where id in ids, sort name]
    E --> J[guards de edição: canEditAny / length]
    D --> K[default read: unchanged; writeScope: id in ids no where]
```

**Opções (loader):** A) `scope: 'read'|'write'` param no `loadMunicipalityOptions` | B) irmã `loadWritableMunicipalityOptions` em `campaignRelationOptions.ts` | C) filtragem client-side da lista read
**Recomendação: B** — call sites read ficam literalmente intocados (sem chance de widening acidental por param default), nome espelha `getWritableMunicipalityIds`, grepável; call sites de escrita trocam o import. Verificado: variante read ordena `sort: 'name'`, `select: {name:true}`, `overrideAccess:false` (`campaignRelationOptions.ts:15-26`); `municipality.id` é `number` (Payload numeric id; `getAdvisorMunicipalityIds` já filtra `relationshipId` → `number[]`).
**Alternativas rejeitadas:** A porque todo call site read passaria a carregar o param e a intenção diz "read surfaces NÃO tocar" — B torna o contrato read imutável por construção; C rejeitada porque vaza o catálogo completo para o client e viola o espírito fail-closed.

**Opções (giro):** 1) write-scope nos loaders via param opcional | 2) fora do escopo, deixar o guard batch C141 como enforcement
**Recomendação: 1** — o composer É um write-composer (stops viram `activity` drafts; `createTourDraftsFormAction` → `activity.ts:213-216`). Verificado: `loadVisitPlannerRegions` monta as TIs contando municípios da leitura read-scoped (`visitPlannerData.ts:123-146`) e `loadVisitCandidates` monta o bundle (peers de encaixe, sugestão, agregados) a partir do fetch read-scoped (`:155-279`). Para visão-tudo+edita-carteira, hoje o composer oferece os 435 e o servidor rejeita no batch. Filtrar na página rejeitado: a sugestão e os `stopPeersByRegion` seriam computados sobre o escopo read e depois descartados — a conta de "encaixe em giro" ficaria errada. Escopar o **fetch** dentro do loader faz todo o pipeline derivado (aggregates, peers, sugestão) sair consistente. Param `writeScope?: boolean` (default `false` → read) nos dois loaders; `loadMunicipalityVisitEligibility` (card do dossier, read) fica com o default e não muda.
**Alternativa rejeitada: 2** — a intenção lista "giro" explicitamente como superfície; o custo é um param opcional + um `id: { in }` no where (ou early-return de bundle vazio `{ phase, groups: [] }`).

**Opções (chips `addableIds`):** 1) trocar `getAdvisorMunicipalityIds` → `getWritableMunicipalityIds` nas páginas de lista | 2) fora do escopo
**Recomendação: 1 parcial** — células chip são controles de escrita (add/remove de vínculos com commit fail-closed). Verificado nos três call sites:

- `liderancas/page.tsx:373,434`: swap limpo — a expressão `canEditAny && administeredIds ? { addableMunicipalityIds: new Set(...) }` já omite o prop quando `canEditAny=false` (somente_leitura), então `[]` é inalcançável; carteira = mesmo conjunto de hoje; edita-tudo (`null`) → prop omitido → todos (o servidor já aceita; paridade com coordinator). Único uso da variável é :434.
- `dobradinhas/page.tsx:323,356`: swap com guarda `writableIds && writableIds.length > 0 ? new Set(writableIds) : undefined` — sem o length-check, `[]` (somente_leitura) é truthy → `Set([])` → todas as chips somem, regressão de leitura (hoje visível = carteira).
- `pessoas/page.tsx:544,553`: **fora do escopo** — `buildPeopleEditability` (`:145-168`) não tem branch "null = tudo": para edita-tudo, `administered=null` → `inCarteira` sempre false → edição por linha quebra (hoje `Set(carteira)` deixa linhas da carteira editáveis). O conserto é C142-shaped (branch 'tudo' no helper). Os commits da ficha continuam fail-closed (`assertPersonContactWritable`). Anotar follow-up.
- Delta de leitura do swap em dobradinhas: somente visão-tudo+somente_leitura passa a exibir chips fora da carteira (hoje `Set(carteira)` os esconde — quirk pré-existente que contraria C141 "visão tudo vê tudo"). Direção correta, aceito e anotado.
  **Rejeitada: 2** — o under-offer persiste para edita-tudo (picker mais estreito que o contrato do servidor); o custo do swap com guarda é ~6 linhas.

### Componentes / mudanças

| Símbolo | Arquivo                                                                                                                                                       | Responsabilidade                                                                                                                                                                                                                                                                             | Reusa                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ✚       | `src/utilities/campaignRelationOptions.ts`                                                                                                                    | `loadWritableMunicipalityOptions(payload, user)`: resolve `getWritableMunicipalityIds`; `null` → delega a `loadMunicipalityOptions` (query idêntica); `[]` → `[]` sem fetch; ids → `find({ where: { id: { in: ids } }, sort: 'name', select: { name: true }, overrideAccess: false, user })` | `getWritableMunicipalityIds` (via `campaignAccess`, import já existente no módulo — sem ciclo novo) |
| ✎       | `src/app/(campaign)/campanha/(app)/atividades/page.tsx:60`                                                                                                    | **split obrigatório**: `municipalityOptions` (read) fica para `ActivityFilters` (:89-93); novo `loadWritableMunicipalityOptions` alimenta `ActivityCreateOverlayHost` (:79-84)                                                                                                               | ambos loaders no mesmo `Promise.all`                                                                |
| ✎       | `.../atividades/[slug]/page.tsx:100`                                                                                                                          | `ActivityEditOverlayHost` passa a receber write-scoped (detail não tem filtro — troca direta)                                                                                                                                                                                                | —                                                                                                   |
| ✎       | `src/utilities/visit/visitPlannerData.ts:123-279`                                                                                                             | `writeScope?: boolean` em `loadVisitPlannerRegions` e `loadVisitCandidates`: quando true, resolve writable e (a) `[]` → early `[]` / `{ phase, groups: [] }`, (b) ids → `{ id: { in: ids } }` no where (regions) / `and` com o where de região (candidates); `null` → inalterado             | `getWritableMunicipalityIds`                                                                        |
| ✎       | `.../atividades/giros/page.tsx:90-93`                                                                                                                         | passa `{ writeScope: true }` nos dois loaders                                                                                                                                                                                                                                                | —                                                                                                   |
| ✎       | `demandas/nova/page.tsx:33`, `organizacoes/nova/page.tsx:22`, `organizacoes/[slug]/page.tsx:51`, `liderancas/nova/page.tsx:32`, `liderancas/[id]/page.tsx:66` | trocam import/call para o loader write-scoped (forms de create/edit)                                                                                                                                                                                                                         | —                                                                                                   |
| ✎       | `src/utilities/supporter/supporterPageData.ts:162`                                                                                                            | `loadSupporterCreatePageData` usa write-scoped; **:115 (`loadSupportersPageData` → filtros) permanece read**                                                                                                                                                                                 | —                                                                                                   |
| ✎       | `liderancas/page.tsx:373,434`, `dobradinhas/page.tsx:323,356`                                                                                                 | `addableIds` de `getWritableMunicipalityIds` (com guardas descritas acima)                                                                                                                                                                                                                   | —                                                                                                   |
| ✓       | `pessoas/page.tsx`, `agenda/page.tsx:55`, `supporterPageData.ts:115`, `atividades/page.tsx` filtros, dossier                                                  | intocados                                                                                                                                                                                                                                                                                    | —                                                                                                   |

Migration: sem migration. Access/Consent: sem mudança (enforcement C141 intacto). UI: nenhum componente muda (options são prop-drilled; `RelationMultiSelect`/overlays idênticos).

## Fases verificáveis (tracer first)

1. **Tracer/server — loader + atividade + giro (onde o servidor ACEITA o mismatch)** — `loadWritableMunicipalityOptions`; split em `atividades/page.tsx`; troca no `[slug]`; `writeScope` no visit planner + giros page. Tester int: para advisor visão-tudo+edita-carteira, picker de atividade e candidatos/regiões de giro refletem o eixo (contêm só a carteira); para edita-tudo, todos; para somente_leitura, `[]`; `loadMunicipalityVisitEligibility`/read loaders inalterados para visão-tudo.
2. **Demanda/apoiador/liderança/organização (UX — servidor já rejeita)** — troca nos 6 forms + chips (liderancas/dobradinhas). Tester int: `loadSupporterCreatePageData` e demais page-data utilitárias retornam options write-scoped; chips via loader direto.
3. **Gates** — `pnpm gate:fast` (tsc, lint 0 warnings, format:check, knip, cycles, test) + `pnpm build`; `pnpm push`; flips da issue via `pnpm issue`.

## Rabbit holes / Não escopo (engenharia)

- Mudar enforcement C141 (nenhum): servidor já fail-closed em todas as superfícies.
- Read surfaces: listas, filtros (atividade, agenda, apoiadores), dossier/eligibility card, mapa — intocados.
- C142 presentation: ocultar/redirecionar forms para somente_leitura (gate `'writable'`), branch 'tudo' no `buildPeopleEditability` de pessoas, mensagens do empty state do giro ("sai da sua carteira" para perfis leitura é impreciso — C142 ajusta).
- Filtragem client-side (vaza catálogo) e rota-optimizer/adjacência para giro.
- Sem migration, sem schema, sem componentes novos, sem E2E novo (C142 é dono de presença; e2e HTTP existente cobre botões).

## Riscos e mitigação

- **Regressão de filtros read** ao dividir `atividades/page.tsx`: mitigado pela divisão explícita + pins int (read loader continua retornando tudo para visão-tudo).
- **Armadilha de truthiness de `[]`** nos chips: `Set([])` esconde TODAS as chips (leitura some). Mitigado: liderancas mantém guarda `canEditAny &&`; dobradinhas ganha length-check. Pessoas fica fora por quebrar `buildPeopleEditability`.
- **Usuário stale** (visibility/editing): `requireCampaignPageActor` → `getCampaignUser` faz `findByID` por request (`campaignAuth.ts:97-101`) — usuário é fresco; `getWritableMunicipalityIds` documenta exigência.
- **Vazamento de escopo no giro**: `loadMunicipalityVisitEligibility` compartilha `loadVisitCandidates` — default read mantém o card do dossier; pin int explícito.
- **Registro editável com município fora do writable** (criado por ator de escopo maior): chip visível no record mas não re-oferecido pelo picker após remoção — fail-safe (servidor rejeita), C142-adjacente; sem ação nesta entrega.
- **Ciclo de imports**: `campaignRelationOptions.ts` já importa de `campaignAccess` (linha 8); visit planner importa `getWritableMunicipalityIds` de `campaignAccess` — sem novo top-level module (`src/utilities` pinnado), knip satisfeito.

## Aceite de engenharia (checkboxes)

- [x] `loadWritableMunicipalityOptions` em `campaignRelationOptions.ts` (null→delega; []→[] sem fetch; ids→`id: { in }`, `sort: 'name'`)
- [x] `atividades/page.tsx`: overlay create write-scoped; **filtros continuam read**
- [x] `atividades/[slug]/page.tsx`: overlay edit write-scoped
- [x] Giro: `writeScope` em `loadVisitPlannerRegions`/`loadVisitCandidates`; giros page passa true; dossier read intacto
- [x] `demandas/nova`, `organizacoes/nova`, `organizacoes/[slug]`, `liderancas/nova`, `liderancas/[id]`: forms write-scoped
- [x] `loadSupporterCreatePageData` write-scoped; `loadSupportersPageData` read intacto
- [x] Chips: `liderancas` (swap com `canEditAny &&`), `dobradinhas` (swap com length-guard); `pessoas` fora (anotado como C142-shaped)
- [x] Int pins em `campaignAdvisorPermission.int.spec.ts`: matriz do loader (carteira/tudo/leitura/coordinator), giro scoped vs read, page-data de supporter reflete o eixo; unit: sem mudança (loader é Payload-coupled → int); E2E: não novo
- [x] Gates: `tsc --noEmit`, `pnpm lint` 0 warnings, `pnpm format:check`, knip (pré-existente no worktree — falha igual no base limpo), `pnpm check:cycles`, `pnpm test` (unit 2465 + int 833), `pnpm build`; e2e da superfície afetada 6/6
- [ ] Changelog: entrada curta em `docs/changelog/2026-08-24-c144.md`; push + flips da issue

**Self-score (decision-quality): 5/5** — opções (loader irmã vs param; giro writeScope no fetch; chips parcial com guardas) decididas contra o código real verificado (sort/select da variante read, tipos de id, guardas `canEditAny`/length e ausência de branch "null=tudo" em `buildPeopleEditability`, frescor do user por página), com rejeitadas justificadas e sem regressão de read surface.
