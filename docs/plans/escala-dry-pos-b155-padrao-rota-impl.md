# Impl: Escala/DRY pós-B155 — padrão de escrita de célula: quick-edits via form action → rota JSON

Status: rascunho
Atualizado em: 2026-08-24
Issue: #368
Intenção: docs/plans/escala-dry-pos-b155-padrao-rota.md
Appetite restante: herdado (~0,5–1 dia eng; sem migration)

## Leitura da intenção

- **Outcome:** As anomalias de quick-edit de célula ainda via form action migram para o padrão `campaignJsonMutationRoute` + `postCampaignJson` (mesmo transporte das 8+ rotas irmãs), reusando as actions record sem mudança de domínio, transporte apenas (Impeccable A), sem migration.
- **O que NÃO negociar:** `campaignJsonMutationRoute` é obrigatório (o sweep de `codebaseConventions.unit.spec.ts` recusa POST nu); as actions record existentes são reusadas sem mudança de acesso/revalidação; o contrato de revalidação B34/B31 é preservado (a lista `/campanha/liderancas` onde o chip está NÃO é revalidada — `leadership.ts:630-639`); copy pt-BR, identificadores em inglês.
- **O que reavaliar** (estado do main em 2026-08-24, 798 commits depois da intenção):
  - **F1 está MORTA — fora do lote, registrar como "já resolvido no simplify/fora".** O commit C87 (`212a1f24`, 2026-08-07, "atualização unificada (texto + polaridade + urgente)") removeu `MunicipalityListSignalControl` e `createMunicipalityListSignalFormAction` (grep em `src/`: zero ocorrências de ambos) e os substituiu pelo form multi-campo unificado `MunicipalityListUpdateControl` (`src/components/campaign/municipality/MunicipalityListUpdateControl.tsx` — `useActionState` + `startTransition` explícito em `:60`/`:90`, **sem** `useCampaignCellAutosave`) com `createMunicipalityListUpdateFormAction` (`municipalityStaffFormActions.ts:103`, wired em `municipios/page.tsx:193` como `signalFormAction`). Per a regra travada B155 (form multi-campo → server action), essa superfície CORRETAMENTE permanece em server action. Nada a migrar. `municipio/[slug]/v2/formActions.ts:3-9` já é shim de `createMunicipalityListUpdateFormAction` — nenhum símbolo morto restante. Atualizar o plano de intenção: as fases 1 e 3 (F1 + menção ao sinal em `politica de rotas`) saem; restam F2 + F3.
  - **F2 e F3 continuam vivas exatamente como escopadas** (ver "Abordagem recomendada"). A página de lideranças agora é lista virtualizada (B161, `CampaignListResults`) — as células passam por `leadershipColumns` em `liderancas/page.tsx`; os call sites dos chips continuam `:232-243` (Municípios) e `:257-270` (Dobradinhas).
  - **`useCampaignCellFailureChannel` não é necessário neste lote:** o contrato confirmado (`src/components/campaign/shared/useCampaignCellFailureChannel.ts:19` — `{ errorMessage, setErrorMessage, reportFailure, noteOpenChange }`) serve controles de lista auto-save (F1 morto). Nos F2/F3 o feedback já vive na shared cell (`RelationChipCell`/`RelationOptionCell` — Alert inline + toast de undo C128), que consome o retorno `CampaignFormActionState` do `commitAction`/`membershipAction`. O shim só traduz o transporte.
  - **Schemas já exportados:** `leadershipStateDeputyMembershipSchema` (`src/lib/schemas/leadership.ts:148`) e `leadershipMunicipalitiesMembershipSchema` (`:164`, com `.min(1).max(MAX_LEADERSHIP_MUNICIPALITIES)` + dedupe) são exatamente os bodies JSON das rotas F2/F3 — reusar, não colar.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph F2["F2 — Dobradinhas (coluna de /campanha/liderancas)"]
    C2[LeadershipStateDeputyRelationCell] -->|membershipAction = shim route-backed| S2[shim 'use client' LeadershipStateDeputiesColumnCell]
    S2 -->|postCampaignJson| R2[POST /campanha/liderancas/state-deputies]
    R2 -->|campaignJsonMutationRoute + leadershipStateDeputyMembershipSchema| A2[setLeadershipStateDeputyMembership]
  end
  subgraph F3["F3 — Municípios (coluna de /campanha/liderancas)"]
    C3[MunicipalityPortfolioCell] -->|commitAction = shim route-backed| S3[shim 'use client' LeadershipMunicipalitiesColumnCell]
    S3 -->|postCampaignJson| R3[POST /campanha/liderancas/municipalities]
    R3 -->|campaignJsonMutationRoute + leadershipMunicipalitiesMembershipSchema| A3[setLeadershipMunicipalitiesMembership]
  end
  A2 -->|revalidateLeadershipStateDeputyPaths<br/>lista NÃO revalidada| RV2
  A3 -->|revalidateLeadershipMunicipalityPaths<br/>lista NÃO revalidada \(B34/B31\)| RV3
```

**Opções consideradas:** A (refatorar as shared cells para transporte rota interno) | B (wrappers de coluna `'use client'` no call site da página, com shim route-backed de mesma assinatura) | C (prop `transport: 'form' | 'route'` nas shared cells) | D (shim solto sem wrapper, passado direto da página)

**Recomendação:** **B** — porque a página de lideranças é server component (não pode carregar `postCampaignJson`/hooks clientes), as shared cells têm múltiplos consumidores (dobradinhas B36/B37, assessores B156, pessoas C128) que não entram no lote, e `RelationChipCell` chama `commitAction({}, formData)` como função async regular dentro de `startTransition` (`RelationChipCell.tsx:555-558`) — qualquer função com a assinatura `(state: CampaignFormActionState, formData: FormData) => Promise<CampaignFormActionState>` funciona, sem `useActionState`. O wrapper `'use client'` encapsula o shim e repassa as props da página para a shared cell intocada. É exatamente a arquitetura da tentativa anterior (branch `origin/agent/368-padrao-rota-celula`, `e494fdca` — wrappers `LeadershipMunicipalitiesColumnCell`/`LeadershipStateDeputiesColumnCell` em `src/components/campaign/leadership/`), validada e reutilizada, menos o F1.

**Rejeitadas:**

- **A:** refatorar `RelationChipCell`/`RelationOptionCell` para `postCampaignJson` interno → quebra ou exige refatorar os consumidores fora do lote (dobradinhas, assessores, pessoas) e viola "transporte apenas".
- **C:** prop de transporte nas shared cells → os dois modos coexistem para 2 call sites; o destino é toda célula em rota — não faz sentido manter o modo form.
- **D:** passar o shim como import direto na página → página é server component; funções clientes não podem ser definidas/carregadas lá. O wrapper é o envelope mínimo que torna o shim legal.

### Componentes / mudanças

- **`POST /campanha/liderancas/state-deputies/route.ts`** (novo, `src/app/(campaign)/campanha/(app)/liderancas/state-deputies/route.ts`): `export const POST = campaignJsonMutationRoute(` (literal exigido pelo sweep) com `bodySchema = leadershipStateDeputyMembershipSchema` (reuso direto de `src/lib/schemas/leadership.ts:148`), `safeMessages: [...leadershipStaffEditSafeMessages, LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE]`, `genericMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.'` (cópia da form action). Handler: `await setLeadershipStateDeputyMembership(body)` → `NextResponse.json({ status: 'success', message: 'Dobradinhas atualizadas.' })`. `types.ts` colado: `LeadershipStateDeputiesToggleResponse = { status: 'success'; message: string } | { status: 'error'; message: string }` (padrão `liderancas/support-status/types.ts`). `export const dynamic = 'force-dynamic'` (padrão das irmãs).
- **`POST /campanha/liderancas/municipalities/route.ts`** (novo, `.../liderancas/municipalities/route.ts`): `bodySchema = leadershipMunicipalitiesMembershipSchema` (o cap já é o ceiling do schema; o floor de 1 é a action record contra o array resultante), `safeMessages: [...leadershipStaffEditSafeMessages, LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE, LEADERSHIP_MUNICIPALITY_CAP_MESSAGE, LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE]`, `genericMessage: 'Não foi possível atualizar os municípios. Tente novamente.'`. Handler: `await setLeadershipMunicipalitiesMembership(body)` → `{ status: 'success', message: 'Municípios atualizados.' }`. `types.ts` + `force-dynamic` iguais. **Nota de body:** a shared cell envia `ownerId` no FormData; o shim converte para `leadershipId` no JSON (a action record exige `leadershipId`).
- **`LeadershipStateDeputiesColumnCell`** (novo, `src/components/campaign/leadership/LeadershipStateDeputiesColumnCell.tsx`, `'use client'`): wrapper que recebe as props da página, monta com `useCallback` o shim `(state, formData) => Promise<CampaignFormActionState>` — lê `leadershipId`/`stateDeputyId`/`assigned` do FormData (parse idêntico ao de `liderancas/formActions.ts:92-95`, hoje `requiredRelationshipFormValue`/`requiredFormBoolean`) e chama `postCampaignJson('/campanha/liderancas/state-deputies', { leadershipId, stateDeputyId, assigned })`; `ok` → `{ status: 'success', message: payload.message }`; senão → `{ message: payload.message }` (sem `status` — o caminho de erro da shared cell reverter o otimismo). Renderiza `LeadershipStateDeputyRelationCell` com `membershipAction={shim}` e o restante das props repassadas.
- **`LeadershipMunicipalitiesColumnCell`** (novo, `src/components/campaign/leadership/LeadershipMunicipalitiesColumnCell.tsx`, `'use client'`): idem para `MunicipalityPortfolioCell` com `commitAction={shim}`; o shim lê `ownerId` (campo que a cell envia — `MunicipalityPortfolioCell.tsx:190`), `municipalityIds` repetidos e `assigned`, e chama `postCampaignJson('/campanha/liderancas/municipalities', { leadershipId: ownerId, municipalityIds, assigned })`.
- **`liderancas/page.tsx`** (editado): troca `MunicipalityPortfolioCell` (`:232-243`) por `LeadershipMunicipalitiesColumnCell` (remove a prop `commitAction`) e `LeadershipStateDeputyRelationCell` (`:257-270`) por `LeadershipStateDeputiesColumnCell` (remove `membershipAction`); remove os imports de `./formActions` (`:83-84`). O restante (filter head, drawerTitle, min/max, options) permanece.
- **`liderancas/formActions.ts`** (editado): remove `setLeadershipStateDeputyMembershipFormAction` (`:86-101`) e `setLeadershipMunicipalitiesFormAction` (`:109-124`). `updateLeadershipContactFormAction` (B153, `:42-83`) PERMANECE — fora do lote (ver decisão de espelhos). Limpar imports órfãos (`requiredFormBoolean`, `repeatedRelationshipFormValues`, `LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE`, floor/cap/scope) e reenxugar o `safeMessages` local para o de B153.
- **`tests/e2e/setup.e2e.spec.ts`** (editado): adicionar `'/campanha/liderancas/state-deputies'` e `'/campanha/liderancas/municipalities'` ao prewarm de POSTs (`:73-93`).
- **`tests/e2e/campaignLeaderships.e2e.spec.ts`** (editado): `:102` — `expectPostResponse(page, '/campanha/liderancas')` → `expectPostResponse(page, '/campanha/liderancas/municipalities')`; atualizar o comentário acima (não há mais server action POSTando na URL da página para chips — o POST agora é a rota JSON).
- **`tests/e2e/campaignMunicipalities.e2e.spec.ts`**: **sem mudança** — verificado: `:319` (B157) e `:470-522` (B176) cobrem a coluna "Dobradinhas" da página de MUNICÍPIOS (`setMunicipalityStateDeputiesFormAction`/`createMunicipalityStateDeputyFormAction`, wired em `municipios/page.tsx:190-191`) — superfície fora do lote, segue em form action.
- **`tests/unit/campaignCellEditOverlay.unit.spec.ts`**: **sem mudança obrigatória** — importa `MunicipalityPortfolioCell` (shared, intocada); as células de liderança não estão nos `overlayCases`. Conferir na fase 2 se vale adicionar os wrappers (opcional, sem pressão de teste).
- **`tests/unit/codebaseConventions.unit.spec.ts`**: sem mudança — sweep automático (`:227-244`); as rotas novas nascem com o literal `export const POST = campaignJsonMutationRoute(`.
- **Migration:** nenhuma. **Access / Consent:** sem mudança — `getCampaignActionContext` (`src/utilities/campaignActionContext.ts:88`) lê a sessão via cookie e lança `CAMPAIGN_AUTH_REQUIRED_MESSAGE`/`CAMPAIGN_SESSION_EXPIRED_MESSAGE`, que o wrapper mapeia para 401 (`campaignJsonMutationRoute.ts:55-73`); as actions record já usam `overrideAccess: false`. A rota não duplica lógica de access além do que o wrapper exige (same-origin 403 + safe-messages). **UI:** Impeccable A — transporte apenas; nenhuma shape/craft/critique.

### Dados → forma

Não se aplica (refactor de transporte; a apresentação dos chips/undo/toast é das shared cells e não muda).

## Decisões de engenharia

### F1: registrar como já resolvido

**Situação:** A intenção cataloga 3 anomalias; o main só tem 2. C87 (`212a1f24`) trocou o sinal por form multi-campo unificado, e a regra B155 manda form multi-campo para server action — a superfície atual está CORRETA.

**Decisão:** F1 entra na seção "Já resolvido no simplify (não reabrir)" do plano de intenção — zero trabalho neste lote. A seção de fases da intenção ("F1 primeiro — ROI mais alto") é reescrita para F2+F3.

**Rejeitadas:** migrar `createMunicipalityListUpdateFormAction` para rota mesmo assim (violaria a regra travada B155 — form multi-campo, submit explícito, campos interdependentes); reabrir o quick-edit de sinal como célula auto-save (C87 foi deliberação de produto fechada).

### Shim route-backed vs refatoração interna da shared cell

**Opções:** A (wrappers de coluna `'use client'` com shim `(state, formData) => Promise<CampaignFormActionState>` chamando `postCampaignJson`) | B (refatorar `RelationChipCell`/`RelationOptionCell` para rota interno) | C (prop `transport`)

**Recomendação:** A — o contrato de chamada das shared cells já é uma função async regular (`RelationChipCell.tsx:555-558`), o wrapper é o envelope mínimo que legaliza um shim client-side numa página server, e as shared cells (multi-consumidor) ficam intocadas — o mesmo desenho da tentativa anterior, reaproveitado integralmente para F2/F3.

**Rejeitadas:** B porque exige tocar consumidores fora do lote (dobradinhas, assessores, pessoas) e muda transporte onde o lote não migra; C porque mantém dois transportes vivos nas cells para 2 call sites — o destino é rota para tudo.

### Rotas reusam os schemas exportados vs colar schema local

**Opções:** A (reusar `leadershipStateDeputyMembershipSchema`/`leadershipMunicipalitiesMembershipSchema` de `src/lib/schemas/leadership.ts`) | B (colar `z.strictObject({...})` com `positiveRelationshipId` no route.ts, padrão das rotas irmãs mais antigas)

**Recomendação:** A — os dois schemas são exatamente os bodies JSON (o de municípios já tem `.min(1).max(30)` + dedupe, e o cap como ceiling do próprio schema, comentado em `schemas/leadership.ts:166-171`); o precedente próximo é `political-trend/route.ts:16-18`, que reusa `municipalityPoliticalTrendSchema`. Colar duplicaria a validação em dois lugares.

**Rejeitadas:** B porque cria dois schemas com a mesma forma em módulos vizinhos — DRY violado sem volatilidade que justifique.

### Destino das quick-edits espelho (fora deste lote — decidir e registrar)

**Situação:** `setLeadershipStateDeputyMembershipFormAction` em `dobradinhas/formActions.ts:129-144` (B36, coluna "Lideranças" de `/campanha/dobradinhas`, wired em `dobradinhas/page.tsx:266` — mesma action record do F2), `setStateDeputyMunicipalitiesFormAction` (B37, `dobradinhas/formActions.ts:170-174`), `setStateDeputyAdvisorMembershipFormAction` (B156, `dobradinhas/formActions.ts:147-162`), `updateStateDeputyPartyFormAction` (B163), `updateStateDeputyBallotNameFormAction` (C129, `dobradinhas/formActions.ts:115-126`), `updateLeadershipContactFormAction` (B153, `liderancas/formActions.ts:42-83`).

**Decisão:**

- **B36 / B37 / B156 → defer com gatilho** (não entram no lote para respeitar o appetite ~0,5–1 dia): gatilho = próximo lote de células em `/campanha/dobradinhas` — as rotas F2/F3 nascem prontas para os dois lados (mesma action record, mesmo body) e B156 tem a allowlist pronta (`LEADERSHIP_ADVISORS_CAP_MESSAGE`/`LEADERSHIP_ADVISORS_UNRESTRICTED_MESSAGE`, `schemas/leadership.ts:41-44`).
- **B153 / B163 / C129 → defer com gatilho** de um lote dedicado a **inline-edits por campo** (`CampaignInlineEditableCell`, `liderancas/page.tsx:197`): não são chips/toggles de relação — o popover de edição de campo único tem outro contrato de chamada e precisa de tratamento próprio (rota por campo + cell editando via `postCampaignJson`). Fora deste lote, NÃO descartado permanentemente.
- **Rejeitada:** "fora de escopo permanente" para qualquer um deles — a regra B155 (célula → rota) não distingue chip de inline-edit; descartar criaria um padrão duplo sem evidência de produto. O que fica permanente fora é o ladder de forms (`runCampaignFormAction` para forms multi-campo — B155), não essas células.

### Revalidação após mutation

**Situação:** `setLeadershipStateDeputyMembership` (`leadership.ts:615-627`) revalida `revalidateLeadershipStateDeputyPaths` (`:508`); `setLeadershipMunicipalitiesMembership` (`:759-773`) revalida `revalidateLeadershipMunicipalityPaths` (`:640-648`), com a lista `/campanha/liderancas` deliberadamente excluída (`:630-639` — contrato B34/B31).

**Decisão:** as rotas herdam isso automaticamente ao chamar as actions record — zero linhas de revalidação nas rotas, zero mudança de contrato. Adicionar a lista ao revalidate seria mudança de comportamento, não de transporte (mesma posição da tentativa anterior).

## Fases verificáveis

### Fase 1 — Tracer: as 2 rotas + specs

1. Criar `liderancas/state-deputies/route.ts` + `types.ts` e `liderancas/municipalities/route.ts` + `types.ts` (schema reusado, safe-messages, `force-dynamic`).
2. Adicionar as 2 rotas ao prewarm POST de `tests/e2e/setup.e2e.spec.ts:73-93`.
3. `campaignLeaderships.e2e.spec.ts:102` → `expectPostResponse(page, '/campanha/liderancas/municipalities')`.
4. Verificar a rota no navegador (`pnpm dev` + sessão de campanha): POST `{ leadershipId, stateDeputyId, assigned: false }` e `{ leadershipId, municipalityIds: [..], assigned: true }` respondem `{ status: 'success', ... }`; body malformado → 400 com `genericMessage`; sem sessão → 401.
5. Rodar o spec e2e de lideranças.

### Fase 2 — Shims e remoção das form actions

1. Criar `LeadershipStateDeputiesColumnCell` e `LeadershipMunicipalitiesColumnCell` em `src/components/campaign/leadership/` (shims route-backed com a mesma assinatura; parse do FormData copiado de `liderancas/formActions.ts`).
2. Trocar os call sites em `liderancas/page.tsx:232-243` e `:257-270`; remover imports de `./formActions`.
3. Remover as 2 form actions de `liderancas/formActions.ts`; limpar imports órfãos.
4. `pnpm exec knip` (exports órfãos), `tsc --noEmit`, conferir `tests/unit/campaignCellEditOverlay.unit.spec.ts` (sem mudança esperada).

### Fase 3 — Gates

1. `pnpm gate:fast` (cascade: lint/format/typecheck/knip/cycles/unit/int).
2. e2e afetados: `campaignLeaderships` (B32/B34) e `campaignMunicipalities` (regressão B157/B176 — devem passar intocados).
3. `pnpm check:cycles`; `pnpm push` + PR + auto-merge.

## Rabbit holes / Não escopo (engenharia)

- **Generalizar shared cells / fundir espelhos** durante a migração — os 2+2 controles seguem espelhos; refactor de transporte apenas.
- **Migrar B36/B37/B156/B163/C129/B153** — defer com gatilho registrado acima; não entram nas fases.
- **`MunicipalityListUpdateControl` / `createMunicipalityListUpdateFormAction` (ex-F1)** — form multi-campo; fica em server action por regra B155.
- **Coluna "Dobradinhas" da página de municípios** (`setMunicipalityStateDeputiesFormAction`, `municipios/page.tsx:190-191`) — espelho de relação, mas outra superfície; não tocada.
- **Mudar o contrato de revalidação B34/B31** (adicionar `/campanha/liderancas` ao revalidate) — comportamento, não transporte.
- **`useCampaignCellFailureChannel` nos shims** — o feedback já é da shared cell; canal duplo seria camada sem volatilidade.
- **Fundir com UX / copy** — Impeccable A; nenhum achado de critique pendente nesta superfície.

## Riscos e mitigação

- **Shim diverge do contrato do FormData da shared cell:** `MunicipalityPortfolioCell` envia `ownerId` + `municipalityIds` repetidos + `assigned` (`MunicipalityPortfolioCell.tsx:187-199`); `LeadershipStateDeputyRelationCell` envia `leadershipId` + `stateDeputyId` + `assigned` (`:98-113`). **Mitigação:** o shim copia o parse das form actions atuais (`liderancas/formActions.ts:92-95` e `:115-118` — a fonte da verdade do formato), com `Number()` nos ids e `assigned` string→boolean; o e2e B34 (rota apontada) cobre o fluxo feliz e o undo C128 re-chama o shim pelo mesmo caminho.
- **Erro fora de 200 (auth 401 / malformed 400 / safe-message 400):** `postCampaignJson` retorna `{ ok, payload }` (`campaignJsonRequest.ts:12-26`) — o shim propaga `payload.message`; `ok` separado do status porque há rotas que respondem 409 com body real. **Mitigação:** o shim só olha `ok` + `payload.message`, nunca o status.
- **Página server component:** shim não pode viver em `liderancas/page.tsx`. **Mitigação:** wrappers `'use client'` (opção B) — o motivo estrutural da escolha.
- **Sweep `codebaseConventions` recusa POST nu:** as rotas devem exportar o literal `export const POST = campaignJsonMutationRoute(` (`codebaseConventions.unit.spec.ts:227-244`). **Mitigação:** nascer no padrão, como as irmãs.
- **Knip/imports órfãos após remover as form actions:** `requiredFormBoolean`, `repeatedRelationshipFormValues` e as constantes floor/cap/scope perdem uso em `liderancas/formActions.ts`. **Mitigação:** limpar no mesmo commit; `pnpm exec knip` na fase 2.
- **`safeMessages` errados nas rotas:** mensagens de erro das actions record são match por EXACT string (`campaignJsonMutationRoute.ts:51-74`) — allowlist faltando colapsa em `genericMessage`. **Mitigação:** espelhar a lista da form action atual (que já era a allowlist do `runCampaignFormAction`), sem `LEADERSHIP_INVALID_CONTACT_MESSAGE`/`INVALID_FIELD_MESSAGE` (só pertencem ao B153).
- **e2e flakiness da migração:** o B34 hoje espera POST na URL da página (`campaignLeaderships.e2e.spec.ts:102`) — se não migrar junto com o código, o teste fica pendurado até timeout. **Mitigação:** spec migrado na mesma fase do código (fase 1 antecipa a rota, fase 2 o call site — rodar o spec nas duas).
- **B161 (lista virtualizada):** wrappers são componentes clientes comuns — compatíveis com `CampaignListResults`; nada de portal/scroll novo.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto — F2+F3 migrados para rota; F1 registrado como já resolvido no simplify/fora (C87)
- [ ] Invariantes AGENTS/engineering-standards — `campaignJsonMutationRoute` obrigatório; actions record reusadas com `overrideAccess: false` e transação; contrato de revalidação B34/B31 preservado; copy pt-BR, identificadores em inglês
- [ ] Testes de domínio previstos — e2e B34 apontando para `/campanha/liderancas/municipalities`; prewarm com as 2 rotas novas; regressão B157/B176 intocada
- [ ] `codebaseConventions` — zero offenders no sweep automático
- [ ] `knip` — zero exports órfãos; `pnpm check:cycles` — zero ciclos
- [ ] Sem migration, sem mudança de acesso/consent, sem mudança de UI (Impeccable A)

## Self-score decision-quality

**5/5** — (1) decisões caras têm rejeitadas (shim vs refatorar cells vs prop transport; rotas reusam schema vs colam; destino dos espelhos decidido com alternativa rejeitada); (2) cabe no appetite herdado (~0,5–1 dia: 2 rotas + 2 wrappers + 2 remoções + 2 specs — a tentativa anterior provou o tamanho); (3) rabbit holes nomeados (espelhos, ex-F1, coluna de municípios, revalidação, canal de falha duplo); (4) depth check: reusa `campaignJsonMutationRoute`, `postCampaignJson`, actions record, schemas exportados, `leadershipStaffEditSafeMessages`, shared cells, prewarm existente — nenhum módulo novo além dos wrappers mínimos; (5) intenção satisfeita: transporte apenas, sem reescrever o outcome — com a divergência F1 explicitamente reconciliada no plano de intenção.
