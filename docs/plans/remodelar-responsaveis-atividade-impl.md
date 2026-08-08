# Impl: C90 — Remodelar responsáveis da Atividade — campo único polimórfico multi-valor

Status: em execução
Atualizado em: 2026-08-08
Issue: #426
Intenção: docs/plans/remodelar-responsaveis-atividade.md
Appetite restante: herdado (~1–1,5 dia eng). Sem cortes no appetite — a mudança é serializada (schema→server→UI→gates) e não cria entidade nova.

## Leitura da intenção

- **Outcome:** uma Atividade tem UM campo `responsible` polimórfico multi-valor (staff `campaignUser` nas funções assessor/candidato/coordenador, `leadership`, `stateDeputy`); `advisors` e `leadership` saem do modelo e da UI; a informação migra para `responsible`; o assessor mantém ver/editar quando está listado como responsável (mesmo direito que `advisors` dava).
- **O que NÃO negociar:** campo único (não 3 campos); sem segundo cadastro de pessoa (seletor só escolhe existentes); sem papel novo; assessor continua vendo/curando o compromisso em que está listado; `responsible` opcional (obrigatório só título/município); `tasks[].responsible` (Contact) NÃO muda.
- **O que reavaliar (engenharia):**
  1. A leg do assessor em `canReadActivity` hoje é `advisors: { contains: user.id }`. Campo polimórfico hasMany **não aceita** `contains` escalar (o query-builder do adapter não suporta where por id escalar em relação polimórfica hasMany — só a notação-objeto `{ relationTo, value }` com `equals`). → decisão de acesso abaixo.
  2. A busca `q` da lista usa `'responsible.name'`, impossível de manter em polimórfico → vira título-only (perda pequena, sinalizada no gate).
  3. `notifyActivityNeedsAttention` usava `doc.advisors` → passa a filtrar entradas `campaignUser` de `responsible`.
  4. O `responsible` antigo é um **Contact** — Contact não é tipo válido no novo union. O valor antigo não tem destino; decisão de dados no gate.

## Abordagem recomendada

```mermaid
flowchart LR
  A[Activity.ts: responsible polimórfico hasMany<br/>relationTo campaignUser|leadership|stateDeputy<br/>remove advisors + leadership] --> B[validateActivityResponsibles hook<br/>+ auto-include assessor no create]
  B --> C[access/activities.ts: leg assessor =<br/>responsible equals {relationTo campaignUser, value me}]
  C --> D[lib/schemas + activityFormData: responsiblesJson<br/>bounded, shape {relationTo, value}]
  D --> E[action searchActivityResponsibleOptions 3 catálogos<br/>+ ResponsibleMultiSelect novo componente]
  E --> F[ActivityForm/OverviewTab/ActivityCard/viewModels<br/>chips tipados]
  A --> G[migration: activity_rels +leadership_id+statedeputy_id<br/>drop activity.responsible_id/leadership_id<br/>migra advisors→responsible, leadership→responsible]
```

**Opções consideradas:** A) campo polimórfico puro (payload `relationTo: [...]`, `hasMany`) como a intenção manda | B) campo polimórfico + coluna derivada escondida `assignedStaffIds` para o acesso do assessor | C) manter sessões separadas e só juntar na UI.
**Recomendação: A** — é o modelo de domínio da intenção, sem twin de dados; o acesso por notação-objeto `equals {relationTo,value}` resolve o escopo do assessor dentro do próprio campo (provado por teste int que roda a query real).
**Rejeitadas:** B porque duplica o dado do `responsible` num campo derivado (viola "edit the owner, don't twin" e drift não é barato); C porque não atende o aceite de produto (campo único).

### Decisões de engenharia (forma obrigatória)

**D1 — Leg do assessor no read/update:**

- Opções: A) `{ responsible: { equals: { relationTo: 'campaignUser', value: id } } }` (notação-objeto; o único operador aceito pelo adapter em polimórfico é `equals`) | B) `{ responsible: { contains: id } }` escalar | C) consulta dupla (município scope + lookup pós-fetch).
- Recomendação: A — expressivo, suportado (verificado no fonte do `@payloadcms/drizzle`, `sanitizeQueryValue`/`getTableColumnFromPath`), PROVADO por teste int que roda `payload.find` como o assessor.
- Rejeitadas: B — o query-builder não tem caminho para id escalar em relação polimórfica hasMany (cairia em recursão sem tabela resolvida); C — fere a semântica de `Access` que precisa devolver `Where`.

**D2 — Edição do `responsible` (field access):**

- Opções: A) staff pode gravar o campo (mesmo esboço do `advisors` que era coordinator-only some) | B) manter gate coordinator-only | C) só hook de validate.
- Recomendação: A — o produto diz "staff cria; assessor edita o que administra + o que lhe é imputado" sem gate de coordenador; o row access (`canUpdateActivity`) já restringe o assessor ao escopo. `canCreateActivityAdvisors`/`canManageActivityAdvisors` saem; entra `canSetActivityResponsible` = staff.
- Rejeitadas: B pois `advisors` coordinator-only era uma UI conveniente do Admin, não um requisito; o assessor precisa conseguir atribuir/editar responsáveis no que administra. C sozinho não protege o Admin.

**D3 — Busca `q` da lista de Atividades:**

- Opções: A) título-only | B) manter `responsible.name` (quebra em polimórfico) | C) resolver nomes pós-fetch.
- Recomendação: A (título-only) — a query aninhada `responsible.name` em polimórfico não é suportada; pós-fetch é caro e proporcional a nada. **Sinalizado no gate** (mudança visível: buscar por nome de responsável na lista deixa de casar).
- Rejeitadas: B (runtime error), C (overhead injustificável).

**D4 — Dados antigos na migração:**

- Opções: A) `advisors`→`responsible` (campaignUser), `leadership`→`responsible` (leadership), Contact antigo em `responsible_id` **descartado** (sem tipo válido no union, sem destino confiável) | B) tentar mapear Contact antigo para campaignUser/leadership por heurística | C) manter Contact como 4º tipo.
- Recomendação: A — fiel à intenção (o union é staff/leadership/dobradinha); Contact é exatamente o campo que o produto quer eliminar (o "Contact avulso"). **Decisão de dados confirmada no gate** antes de executar.
- Rejeitadas: B (heurística especulativa, risco de atribuir responsável errado); C (viola o aceite — Contact não é papel da campanha).

**D5 — Componente do seletor:**

- Opções: A) novo `ResponsibleMultiSelect` (chips + Command dialog + busca polimórfica agrupada por tipo) | B) estender `AsyncSearchCombobox` para multi+polimórfico | C) três seletores.
- Recomendação: A — o picker polimórfico multi-tipo (resultado tipado, chip tipado) é uma forma nova que nenhum primitivo expressa; `AsyncSearchCombobox` é single-value e usado em vários lugares (município/liderança); mudá-lo arrisca os outros call sites. Colocado em `campaign/shared/` para o C91 o reusar no overlay da agenda.
- Rejeitadas: B (twin-arriscado num primitivo compartilhado), C (anti-aceite).

### Componentes / mudanças

- **`Activity.ts`** (`src/collections/Activity.ts`): `responsible` → relationship polimórfico hasMany `relationTo: ['campaignUser', 'leadership', 'stateDeputy']`, `hasMany: true`, `index: true`, `filterOptions` por collection (`campaignUser`: `eligibleCampaignStaffWhere`), `admin.label` "Responsáveis". Remove `advisors` e `leadership`. Hook `validateActivityAdvisors` → `validateActivityResponsibles` (valida entradas: staff elegível p/ `campaignUser`, existência p/ `leadership`/`stateDeputy`, cap). `deriveActivityFields`: auto-include `[{relationTo:'campaignUser', value: user.id}]` no create do assessor; `activityStaffFieldSnapshot` re-expresso sobre `responsible`.
- **`src/utilities/access/activities.ts`**: `canReadActivity`/`canUpdateActivity` leg assessor = `{ or: [{ responsible: { equals: { relationTo: 'campaignUser', value: id } } }, advisorMunicipalityScopeWhere('municipality', ids)] }`. Remove `canCreateActivityAdvisors`/`canManageActivityAdvisors`; adiciona `canSetActivityResponsible` (staff). Re-export em `campaignAccess.ts`.
- **`src/lib/schemas/activity.ts`**: `responsible: z.array(activityResponsibleSchema).max(20).optional()` (shape `{ relationTo: enum, value: positiveRelationshipId }`); remove `advisors`/`leadership` (create/update). `tasks[].responsible` intacto.
- **`src/utilities/activityFormData.ts`**: parseia `responsiblesJson` (bounded JSON, precedente `tagsJson`), replace de `advisors`/`leadership`/`responsible`.
- **`src/app/(campaign)/campanha/actions/activity.ts`**: create/update recebem `responsible` polimórfico; update sempre envia o array (limpar = `[]`); ajusta comentário de stripping de null (endAt/responsible mantêm null-anulável? → `responsible` agora é array, muda o strip).
- **`src/utilities/activityViewModels.ts`**: `ActivityFormViewModel` → `responsibles: Array<{ relationTo, id, name, typeLabel }>`; `ActivityDetailViewModel` → `responsibles` (chips tipados) no lugar de `advisors`+`responsibleName`; `ActivityListViewModel` → `responsibles` + resumo p/ card. Selects ajustados (depth 1 para popular).
- **Search actions** (`src/app/(campaign)/campanha/(app)/atividades/contactSearchActions.ts` + `src/utilities/activityLeadershipOptions.ts`): novo `searchActivityResponsibleOptions(query)` (server action) que busca os 3 catálogos em paralelo com `overrideAccess: false` (escopo de leitura do ator), agrupando por tipo com rótulo; mantém filtro `supportStatus: 'engajado'` p/ leadership (comportamento atual — sinalizado). `searchActivityContactOptions` permanece (tarefas). Remove `searchActivityLeadershipOptionsAction` se ficar órfão (knip).
- **`src/components/campaign/shared/ResponsibleMultiSelect.tsx`** (novo, client): chips removíveis (padrão `RelationMultiSelect`) + trigger + `Command` dialog com grupos por tipo; submete `responsiblesJson`.
- **`src/components/campaign/activity/ActivityForm.tsx`**: card "Pessoas e organizações" → campos "Responsáveis" (novo seletor) + "Organizações apoiadoras"; some grupo de assessores e combobox de liderança; `searchContacts` permanece p/ tarefas; props `advisorOptions`/`canManageAdvisors`/`searchLeaderships` saem; entra `searchResponsibles`.
- **`nova`/`editar` pages**: drop `advisorOptions`/`canManageAdvisors`; passam `searchResponsibles`.
- **`ActivityOverviewTab.tsx`**: "Equipe e organizações" → "Responsáveis" (lista de chips tipados); remove linha "Responsável" do card Detalhes.
- **`ActivityCard.tsx`**: "Resp: X" → chips de responsáveis (até 2 + "+N") com tipo.
- **`src/utilities/notification/notificationEvents.ts`**: `notifyActivityNeedsAttention` recipients = entradas `campaignUser` de `responsible` (filtra `relationTo`).
- **`src/utilities/activityUi.ts`**: `buildActivityListWhere` — `q` vira título-only (remove `'responsible.name'`).
- **Migration:** `pnpm migrate:create remodel_activity_responsible` → schema diff (activity_rels +leadership_id/state_deputy_id; activity −responsible_id/−leadership_id com índices/FKs) + data step: `UPDATE activity_rels SET path='responsible' WHERE path='advisors'`; `INSERT … leadership_id` dos antigos `activity.leadership_id`; reorder por parent; dropar `responsible_id` antiga. Decisão D4 no gate.

### Dados → forma

Não aplica (intenção `Dados: N/A`). O "chips tipados por responsável" é a resposta à questão em aberto da intenção (recomendação B) — sem métrica/série/mapa.

## Fases verificáveis

1. **Tracer/schema+server:** Migration + `Activity.ts` + access + schemas/parse + actions + notificação. Rodar `pnpm migrate:create`, `pnpm migrate`, `generate:types`. Atualizar int spec (inclui teste real do Where do assessor via `payload.find` e teste de auto-include + teste de responsable protegendo contra staff não-elegível).
2. **UI:** `ResponsibleMultiSelect` + form + overview + card + list search. Impeccable B (shape→craft→critique); shells/Command existentes; tokens `data-theme='campaign'`.
3. **Gates:** `pnpm gate:fast` na iteração; entrega com `pnpm push`. `knip` (remover órfãos de access/leader options); `formatação`; `check:cycles`.

## Rabbit holes / Não escopo (engenharia)

- **"Twin" de campo derivado para acesso** — rejeitado (D1 usa notação-objeto, sem coluna extra).
- Consulta de `responsible` por nome em listas/filtros — título-only; não construir busca nome polimórfica (defer com gatilho: "voltar busca por responsável quando o produto pedir").
- Estender `AsyncSearchCombobox`/`RelationMultiSelect` para multi-polimórfico — novo componente, não mutação de primitivo compartilhado.
- Admin UI do `responsible`: `filterOptions` por collection só para conveniência do `/admin`; sem UI custom.
- Sem mudança em `tasks[].responsible`, `resultRecordedBy`, `createdBy`, `updates[].author`, do giro, e2e existente de agenda (não toca responsáveis).

## Riscos e mitigação

- **Notação-objeto `equals` em hasMany polimórfico não casar como esperado** → mitigação: teste int cria atividade com assessor em `responsible` e roda `payload.find`/`canReadActivity` como esse assessor; se falhar, implantar D1-B/CD como fallback no mesmo esforço.
- **Esquema de dados polimórfico em produção** (joins `_rels`, ordens) → migração idempotente por `path`/`parent`, NOTICE de rows afetadas, revisão do SQL antes do deploy (padrão remodel já aplicado em prod).
- **Perda do `responsible` (Contact) antigo** → decisão explícita no gate (D4) antes de executar.
- **Campo `responsible` com `same name` após mudança de tipo** no diff (era column, vira rels) → conferir o SQL gerado e ajustar manualmente se o diff dropar/criar errado.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (campo único polimórfico multi-valor; `advisors`/`leadership` fora; assessor mantém direito via `responsible`)
- [ ] Invariantes AGENTS/engineering-standards (transações, access `overrideAccess:false` onde actor, sem novo cadastro, sem Consent novo, identificadores inglês/copy pt-BR)
- [ ] Testes de domínio: int spec (acesso assessor por `responsible` provado via query real; auto-include; validação de staff; data migration verificada em `teqo_test`)

## Já resolvido no simplify (não reabrir)

- Parser polimórfico `{relationTo, value}` centralizado em `parseActivityResponsibleEntries` (`lib/schemas/activity.ts`) — Activity.ts, notificationEvents e viewModels consomem o mesmo.
- Seleção do `ResponsibleMultiSelect` inicial-only (bug de wipe no create após erro de submit).
- Existência de `leadership`/`stateDeputy` validada como verdade admin (com `// bypass:` justificado) — assessor responsável re-salva lista intacta mesmo com liderança fora do portfólio (int test cobre).
- a11y do seletor (`aria-invalid`/`aria-describedby` + `FieldError` com id); gate morto `atCapacity && selected.length > 0` colapsado.

## Adiado com gatilho (não registrar epic agora)

- **S1 — extrair `useDebouncedAsyncSearch(query, isReady, search)`** do efeito clonado entre `AsyncSearchCombobox` e `ResponsibleMultiSelect` (debounce 250ms + requestId + loading/failed). **Gatilho:** terceiro consumidor de busca assíncrona client, ou refactor do próprio `AsyncSearchCombobox`.
- **S2 — unificar nome-fallback de responsável não-populado** (`Responsável #id` / `Equipe #N` / `Liderança #N`). **Gatilho:** se algum fluxo depender do rótulo exato.
- **S3 — UX em capacidade máxima** (trigger disabled; remoção só via chips). **Gatilho:** feedback da mesa.

## Explicitamente fora (skips dos revisores + descartes deste triage)

- Estender `AsyncSearchCombobox`/`RelationMultiSelect` para multi-polimórfico (novo componente é a forma certa).
- Busca por nome de responsável na lista (`q`) — título-only aceito no gate (consulta aninhada em relação polimórfica não é suportada).
- `tasks[].responsible` (Contact), resultado, giro, agenda — intactos.

Self-score decision-quality: 5/5 (decisões caras com rejeitadas; cabe no appetite; rabbit holes nomeados; reusa loaders/Command/shells; intenção preservada).
