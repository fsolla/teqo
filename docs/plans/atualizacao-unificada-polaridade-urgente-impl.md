# C87 — Impl: Atualização unificada (texto + polaridade + urgente)

**Status:** plano em elaboração · **Intenção:** `docs/plans/atualizacao-unificada-polaridade-urgente.md` (Issue #396)
**Appetite:** ~1–1,5 dia-eng · **Decisões de gate assinadas no plano**

## 1. Resumo

Eliminar a taxa de `kind` (semanal/urgente/nota/sinal) e o `signalType` tipado do
registro de atualização do município, substituindo por um **único formulário**: texto
livre (`body`) + polaridade (`polarity`: boa/neutra/ruim, obrigatória) + toggle Urgente
(`urgent`). O modelo unificado inclui um toggle extra `adversarySignal` que alimenta o
nível 1 do E11 (alerta de adversário).

**Fora de escopo (mesmo que o nome mude):** Tendência política do município (wizard
`change-trend` — B64, imutável); C88 (thread/responsável/resolvido).

---

## 2. Decisões assumidas (do intent — validar no gate)

| #   | Pergunta                           | Decisão                                                                                 | Justificativa                                                                                                                        |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | E11 adversary trigger?             | **Opção B**: toggle `adversarySignal: boolean` no próprio registro                      | Mais simples que 5 tipos; a coordenação quer fila de risco confirmada — mesmo custo cognitivo que um campo a mais vs. manter 5 tipos |
| D2  | Polaridade obrigatória?            | **Sim** (default implícito Neutra não oferecida — força o gesto)                        | Intent: "A — força o gesto de classificar sem custo real"                                                                            |
| D3  | Registros antigos?                 | **Opção A**: backfill `polarity='neutra'`, concatena worked+failed+needs → body         | Sem badge "legado"; feed único                                                                                                       |
| D4  | Renomear wizard `register-signal`? | **Sim** → `register-update` / `registrar-atualizacao`                                   | Elimina "sinal" do vocabulário de UI; risco acoplamento documentado no intent                                                        |
| D5  | Frescor / "último sinal"?          | Mantém lógica (`resolveMunicipalityLastSignalAt` já considera qualquer update + pledge) | Nenhum código de frescor filtra por `kind='sinal'` — confirmação abaixo                                                              |

### Confirmação de D5 — frescor não filtra por `kind='sinal'`

`resolveMunicipalityLastSignalAt(lastUpdateAt, lastPledgeAt)` em
`municipalitySignal.ts:14` recebe `lastUpdateAt` de `municipality.lastUpdateAt` (qualquer
update), **não** filtra por `kind`. Confirmação cruzada:

- `municipalityTriggers.ts:333` — `lastSignalAt = resolveMunicipalityLastSignalAt(municipality.lastUpdateAt ?? null, ...)`
- `municipalityV2StatusData.ts:55` — idem
- `municipalityViewModels.ts:126` — idem

Apenas **um** ponto filtra por `kind='sinal'` para frescor-adjacente: `municipalityV2StatusData.ts:22`
`loadLatestSignal` (query explícita `kind: 'sinal'`). → **substituir por `loadLatestUpdate`**
sem filtro de kind, retorna o mais recente de qualquer update.

---

## 3. Mudança de dados (modelo)

### Campos removidos do `MunicipalityUpdate`

- `kind` (enum)
- `signalType` (enum, opcional)
- `worked` (text)
- `failed` (text)
- `needs` (text)

### Campos adicionados

- `polarity` — `enum` (`boa` / `neutra` / `ruim`), **obrigatório**
- `urgent` — `boolean`, default `false`
- `adversarySignal` — `boolean`, default `false` (para E11)
- `body` — `text` (5000 chars), **obrigatório** (substitui worked/failed/needs)

### Campos mantidos inalterados

- `municipality` (relação)
- `author` (relação)
- `activeVolunteers`, `newSupports` (inteiros opcionais)
- `createdAt`, `updatedAt`, `lastUpdateAt` (derivado)

### Labels de polaridade

```ts
municipalityUpdatePolarityLabels = {
  boa: 'Boa',
  neutra: 'Neutra',
  ruim: 'Ruim',
}
```

---

## 4. Migração de dados (migration)

Transformar registros existentes — `municipalityUpdate` migration `@payloadcms/db-postgres`:

```sql
-- 1. Adicionar colunas (feito pelo migrate:create do schema)
ALTER TABLE municipality_updates ADD COLUMN polarity TEXT;
ALTER TABLE municipality_updates ADD COLUMN urgent BOOLEAN DEFAULT FALSE;
ALTER TABLE municipality_updates ADD COLUMN adversary_signal BOOLEAN DEFAULT FALSE;

-- 2. Backfill de dados (data migration dentro da migration)
-- urgente
UPDATE municipality_updates SET urgent = TRUE WHERE kind = 'urgente';

-- sinal + adversary types
UPDATE municipality_updates
  SET adversary_signal = TRUE
  WHERE kind = 'sinal'
  AND signal_type IN ('invasao', 'visita_adversario', 'proposta_broker');

-- body: sinal/nota mantém body; semanal concatena worked||failed||needs
UPDATE municipality_updates
  SET body = COALESCE(worked, '') || ' | ' || COALESCE(failed, '') || ' | ' || COALESCE(needs, '')
  WHERE kind = 'semanal';

-- polaridade (padrão neutra; não há backfill semântico fino)
UPDATE municipality_updates SET polarity = 'neutra' WHERE polarity IS NULL;

-- 3. Tornar NOT NULL
ALTER TABLE municipality_updates ALTER COLUMN polarity SET NOT NULL;

-- 4. (Opcional) remover colunas antigas — manter dropped columns para segurança
-- (Payload migration pode omitir drop para rollback safety)
```

**Arquivo:** `src/migrations/<timestamp>_unify_municipality_update.ts`

---

## 5. Implementação — fases

### Fase 1: Schema + coleção (dados)

**`src/lib/schemas/municipalityUpdate.ts`**

- Remover: `municipalityUpdateKinds`, `municipalityUpdateKindLabels`, `municipalitySignalTypes`,
  `municipalitySignalTypeLabels`, `municipalitySignalTypeDescriptions`, `parseMunicipalitySignalType`,
  tipo `MunicipalityUpdateKind`, tipo `MunicipalitySignalType`
- Adicionar: `municipalityUpdatePolarities = ['boa', 'neutra', 'ruim']`, `MunicipalityUpdatePolarity`,
  `municipalityUpdatePolarityLabels`, `parseMunicipalityUpdatePolarity`
- Reescrever `municipalityUpdateCreateSchema`: `polarity` (required enum), `urgent` (boolean default false),
  `adversarySignal` (boolean default false), `body` (required text 5000), `activeVolunteers`,
  `newSupports`, `municipality`. Remover kind/signalType/worked/failed/needs.

**`src/collections/MunicipalityUpdate.ts`**

- Remover fields: `kind`, `signalType`, `worked`, `failed`, `needs`
- Adicionar fields: `polarity` (select, required), `urgent` (checkbox), `adversarySignal` (checkbox, admin-only)
- `beforeValidate` hook: validar que quando `urgent === true` → nada extra (urgent é independente); polaridade required
- `lastUpdateAt` derivado: mantém (qualquer update conta como "sinal")

### Fase 2: Server actions

**`src/app/(campaign)/campanha/actions/municipalityUpdate.ts`**

- Reescrever `createMunicipalityUpdate`: zod parse do novo schema, `payload.create` com `polarity`, `urgent`, `adversarySignal`, `body`

**`src/app/(campaign)/campanha/(app)/municipios/[slug]/updateFormActions.ts`**

- Atualizar `createMunicipalityUpdateFormAction`: parse `polarity` (required), `urgent` (checkbox), `adversarySignal` (staff only), `body` (required). Remover parse de `kind`, `signalType`, `worked/failed/needs`

**`src/app/(campaign)/campanha/(app)/municipios/municipalityStaffFormActions.ts`**

- Substituir `createMunicipalityListSignalFormAction` → `createMunicipalityListUpdateFormAction` (ou unificar)
- Parse do novo schema

### Fase 3: Wizard + navegação (rename `register-signal` → `register-update`)

**`src/lib/campaignActionRoutes.ts`**

- `CampaignWizardActionId`: `'register-signal'` → `'register-update'`
- `CAMPAIGN_WIZARD_ACTION_SLUGS`: `'register-signal': 'registrar-sinal'` → `'register-update': 'registrar-atualizacao'`
- Remover `WIZARD_SIGNAL_TYPE_QUERY_KEY`, `WIZARD_SIGNAL_BODY_QUERY_KEY` (não usados no modelo unificado)
- Remover `wizardSignalHref`, `resolveWizardSignalTypeParam` (substituídos por wizardActionHref padrão)

**`src/lib/wizardActionChain.ts`**

- `WIZARD_CHAIN_AFTER`: `'register-signal'` → `'register-update'` (4 entradas)
- `wizardHrefForChainStep`: remover case `register-signal` (usa `wizardActionHref` padrão)
- `wizardPrincipalStepHref`: idem

**`src/lib/wizardSignalUi.ts`**

- **Arquivo inteiro reescrito como `wizardUpdateUi.ts`** (ou rename):
- Remover `WIZARD_SIGNAL_TYPE_STEP_TITLE`, `WIZARD_SIGNAL_BODY_STEP_TITLE_PREFIX`, `WIZARD_SIGNAL_SAVE_LABEL`,
  `WIZARD_SIGNAL_SAVED_MESSAGE`, `shouldShowWizardSignalSkip`, `resolveWizardSignalSkip`
- Estes conceitos desaparecem: não há mais step de "tipo de sinal", nem skip de sinal.
- O wizard `register-update` passa a ser: select município → formulário único (texto + polaridade + urgente)

**`src/lib/campaignHomeActions.ts`**

- `CampaignHomeActionId`: `'register-signal'` → `'register-update'`
- Action: label `'Registrar atualização'` (era `'Registrar sinal'`), description
  `'Anotar o que aconteceu no município — com polaridade e se é urgente.'`, icon `Megaphone` mantido
- `wizardFlowTitleForActionId`: `'register-signal'` → `'register-update'`

**`src/lib/politicalTrendWizardUi.ts`**

- `resolvePoliticalTrendNotePrefillSource`: remover branch `entryAction === 'register-signal'` +
  `signalType`/`signalBody`. O `register-update` não mais alimenta prefill de tendência com texto de sinal.
  (Se ainda quiser prefill, pode passar `signalBody` como `notePrefill` direto — mas simplifica: remover o ramo)

**`src/lib/campaignWizardCopy.ts`**

- Verificar se tem copy específico de "sinal" — atualizar para "atualização"

### Fase 4: Quick actions (registries que referenciam `register-signal`)

Estes arquivos enumeram `register-signal` em `DETAIL_WIZARD_ACTION_IDS`, `LEADERSHIP_DETAIL_WIZARD_IDS`, etc.:

- `src/lib/campaignQuickActionLeadership.ts:22` — `'register-signal'` → `'register-update'`
- `src/lib/activityQuickActions.ts:20` — idem
- `src/lib/campaignQuickActionDemands.ts:17` — idem

### Fase 5: View Models (server-side)

**`src/utilities/municipality/municipalityUpdatePageData.ts`**

- `MunicipalityUpdateViewModel`: remover `kind`, `signalType`, `worked`, `failed`, `needs`;
  adicionar `polarity: MunicipalityUpdatePolarity`, `urgent: boolean`, `adversarySignal: boolean`
- `MunicipalityUpdateFeedState`: remover `kind?` — feed mostra tudo (sem filtro por tipo)
- `parseMunicipalityUpdateFeedParams`: remover `updateKind`; manter `updatePage`
- `loadMunicipalityUpdatesFeed`: remover filtro `kind`; select `polarity`, `urgent`, `adversarySignal`
- `loadMunicipalityUpdatesPreview`: idem (chama feed sem kind)

**`src/utilities/municipality/municipalityV2StatusView.ts`**

- `MunicipalityV2StatusViewModel`: remover `lastSignalType`, `lastSignalBody`; adicionar
  `lastUpdatePolarity: MunicipalityUpdatePolarity | null`, `lastUpdateBody: string | null`
- `MunicipalityV2StatusNotes`: remover `signalType`, `signalBody`; adicionar `updatePolarity`, `updateBody`
- `MunicipalityV2SignalSelectState` → `MunicipalityV2UpdateState` (valor = polarity)
- `resolveMunicipalityV2SignalSelectState` → `resolveMunicipalityV2UpdateState(input: { polarity, lastSignalAt })`
  — agora o "select" mostra polarity, não tipo de sinal
- `buildMunicipalityV2StatusAggregate`: atualizar para usar polarity/body

**`src/utilities/municipality/municipalityV2StatusData.ts`**

- `loadLatestSignal` → `loadLatestUpdate`: query `municipalityUpdate` sem kind filter, sorted
  `-createdAt`, retorna `{ polarity, body }`
- `loadMunicipalityV2StatusData`: atualizar chamada

**`src/utilities/municipality/municipalityViewModels.ts`**

- Verificar uso de `lastSignalType`/`lastSignalBody` no `MunicipalityListViewModel` (line 80:
  `lastSignalAt`) — confirma que `lastSignalAt` continua (nome genérico), mas
  `lastSignalType` específico deve virar `lastUpdatePolarity` se exposto

**`src/utilities/municipality/municipalityPageData.ts`**

- Verificar se `lastUpdateAt` é populado (confirmação: é campo derivado da coleção, não precisa de mudança)

### Fase 6: Gatilhos (municipalityTriggers.ts)

**`src/utilities/municipality/municipalityTriggers.ts`**

- Remover `ADVERSARY_SIGNAL_TYPES` array (linha 108)
- Query E11 (linha 224): `{ kind: { equals: 'sinal' }, signalType: { in: ADVERSARY_SIGNAL_TYPES } }`
  → `{ adversarySignal: { equals: true } }`
- O resto (`adversarySignalMunicipalityIDs`, `hasAdversarySignal` no input) continua igual

### Fase 7: UI components

**`src/components/campaign/municipality/MunicipalityUpdateForm.tsx`**

- Reescrever: remover kind selector; renderizar sempre `body` (textarea, required),
  `polarity` (radio buttons Boa/Neutra/Ruim, required), `urgent` (checkbox),
  `adversarySignal` (checkbox, staff only)
- Remover importação de `municipalityUpdateKinds`, `municipalitySignalTypes`, etc.

**`src/components/campaign/municipality/MunicipalitySignalFields.tsx`**

- **Arquivo reescrito como `MunicipalityUpdateFields.tsx`**:
  - `body` textarea (required)
  - `polarity` radio buttons (Boa/Neutra/Ruim)
  - `urgent` checkbox
  - `adversarySignal` checkbox (staff only)
  - Remover signalType select + descriptions

**Componentes que referenciam `MunicipalitySignalFields`:**

- `MunicipalityListSignalControl.tsx` → **rename para `MunicipalityListUpdateControl.tsx`**
  - Import: `MunicipalitySignalFields` → `MunicipalityUpdateFields`
  - Label: "Registrar sinal" → "Registrar atualização"
  - Trigger text: "Registrar sinal em {name}" → "Registrar atualização em {name}"

**`src/components/campaign/municipality/MunicipalityUpdateFeed.tsx`**

- Remover `kindVariant` (semanal/urgente/nota/sinal badge mapping)
- Badge: `polarity` (cor: boa=green, neutra=gray, ruim=orange)
- `urgent` → badge ou prefixo "Urgente"
- Render: sempre mostra `body` (remover branching `kind === 'semanal'`)
- Remover `signalType` badge

**`src/components/campaign/municipality/MunicipalityV2StatusStrip.tsx`**

- Status strip: substituir signal type select por polarity badge + body do último update
- O "select" do strip vira: mostrar polarity do último update, ou botão "Registrar atualização"

**`src/components/campaign/municipality/MunicipalityListRowReadouts.tsx`**

- Se faz referência a `lastSignal` label → "Última atualização"

**`src/components/campaign/municipality/MunicipalityListMobileCards.tsx`**

- "Último sinal" → "Última atualização"

**`src/components/campaign/municipality/MunicipalityList.tsx`**

- Se usa `MunicipalityListSignalControl` → renomear referência
- Coluna `lastSignal` → `lastUpdate` ou manter `lastSignal` com label "Última atualização"

**`src/components/campaign/municipality/WizardSignalTypeStep.tsx`** → **DELETE** (não existe mais step de tipo)
**`src/components/campaign/municipality/WizardSignalBodyStep.tsx`** → reescrever como `WizardUpdateBodyStep.tsx`
(único step: texto + polaridade + urgente)

### Fase 8: Labels / cópias / URLs

**`src/utilities/municipality/municipalityLabels.ts`**

- `MunicipalityListColumnId`: `'lastSignal'` → `'lastUpdate'` (ou manter `lastSignal` com label
  "Última atualização" — verificar uso do id em query params)
- `municipalityColumnDescriptions['lastSignal']` → "Última atualização registrada (staff ou liderança)."
- Sort key `lastSignal` → `lastUpdate` (verificar `municipalityListUrl.ts` — o sort key é `lastUpdateAt`, já está separado do column id)

**`src/lib/municipalitySignalTypeMeta.ts`**

- **DELETE** (metadata por tipo de sinal) — não usado no modelo unificado.
  Verificar referências: `municipalitySignalTypeMeta` / `municipalitySignalTypeMetaByType`

### Fase 9: Notificações

**`src/utilities/notification/notificationEvents.ts`**

- Verificar uso de `municipalityUpdateKindLabels` — remover referência a kind.
  Substituir por `municipalityUpdatePolarityLabels` se a notificação menciona polaridade.

### Fase 10: Migração + geração de tipos

```bash
pnpm migrate:create unify_municipality_update
pnpm migrate          # local
pnpm generate:types   # payload-types
```

---

## 6. Arquivos de teste a atualizar (mapeamento)

| Arquivo                                                      | Mudança                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `tests/unit/campaignActionRoutes.unit.spec.ts`               | `register-signal` → `register-update`, slug `registrar-atualizacao` |
| `tests/unit/wizardActionChain.unit.spec.ts`                  | idem; remove `register-signal` do chain                             |
| `tests/unit/wizardSignalUi.unit.spec.ts`                     | **DELETE** → novo `wizardUpdateUi.unit.spec.ts`                     |
| `tests/unit/politicalTrendWizardUi.unit.spec.ts`             | remove prefill de signal; `register-update` no chain                |
| `tests/unit/campaignQuickAction.unit.spec.ts`                | `register-signal` → `register-update`, slug                         |
| `tests/unit/campaignHomeActions.unit.spec.ts`                | `register-signal` → `register-update`, label                        |
| `tests/unit/campaignMunicipalityQuickActions.unit.spec.ts`   | `register-signal` → `register-update`                               |
| `tests/unit/campaignMunicipalityV2QuickActions.unit.spec.ts` | idem                                                                |
| `tests/unit/campaignQuickActionLeadership.unit.spec.ts`      | `register-signal` → `register-update`                               |
| `tests/unit/campaignWizardCopy.unit.spec.ts`                 | slug `registrar-sinal` → `registrar-atualizacao`                    |
| `tests/int/campaignMunicipalityUpdate.int.spec.ts`           | schema: `kind`/`signalType` → `polarity`/`urgent`/`adversarySignal` |
| `tests/unit/municipalityV2StatusView.unit.spec.ts`           | `signalType` → `polarity`                                           |
| `tests/e2e/campaignHomeActions.e2e.spec.ts`                  | `register-signal` → `register-update`, slug                         |

### Novos testes a adicionar

- Unit: `wizardUpdateUi.unit.spec.ts` (skip logic simplificado — não há mais tipo de sinal)
- Unit: schema `municipalityUpdatePularity` parse
- Int: create/update flow with polarity + urgent
- Int: E11 adversarySignal trigger (polarity ruim + urgent não dispara — só adversarySignal)

---

## 7. Inventário completo de referências a `register-signal` / `sinal`

```
SOURCE FILES:
src/lib/campaignActionRoutes.ts        — id, slug, wizardSignalHref, query key constants
src/lib/wizardActionChain.ts           — WIZARD_CHAIN_AFTER x4, wizardHrefForChainStep, wizardPrincipalStepHref
src/lib/wizardSignalUi.ts              — TODO type step title, skip, saved msg (todo: substituir)
src/lib/campaignHomeActions.ts         — id, label "Registrar sinal", description
src/lib/politicalTrendWizardUi.ts      — resolveWizardTrendSkip, buildPoliticalTrendNotePrefill(sinal)
src/lib/campaignQuickActionLeadership.ts — register-signal in LEADERSHIP_DETAIL_WIZARD_IDS
src/lib/activityQuickActions.ts        — register-signal in WIZARD_ACTION_IDS
src/lib/campaignQuickActionDemands.ts  — register-signal in DETAIL_WIZARD_ACTION_IDS
src/components/campaign/municipality/MunicipalityUpdateForm.tsx — kind=signal conditional
src/components/campaign/municipality/MunicipalitySignalFields.tsx — signalType select
src/components/campaign/municipality/MunicipalityListSignalControl.tsx — "Registrar sinal"
src/components/campaign/municipality/WizardSignalTypeStep.tsx — step de tipo
src/components/campaign/municipality/WizardSignalBodyStep.tsx — step de corpo
src/lib/municipalitySignalTypeMeta.ts — metadata por tipo (DELETE)

TEST FILES:
tests/unit/campaignActionRoutes.unit.spec.ts
tests/unit/wizardActionChain.unit.spec.ts
tests/unit/wizardSignalUi.unit.spec.ts (DELETE)
tests/unit/politicalTrendWizardUi.unit.spec.ts
tests/unit/campaignQuickAction.unit.spec.ts
tests/unit/campaignHomeActions.unit.spec.ts
tests/unit/campaignMunicipalityQuickActions.unit.spec.ts
tests/unit/campaignMunicipalityV2QuickActions.unit.spec.ts
tests/unit/campaignQuickActionLeadership.unit.spec.ts
tests/unit/campaignWizardCopy.unit.spec.ts
tests/int/campaignMunicipalityUpdate.int.spec.ts (schema assertions)
tests/unit/municipalityV2StatusView.unit.spec.ts
tests/e2e/campaignHomeActions.e2e.spec.ts
```

---

## 8. Riscos & mitigações

| Risco                                                                         | Mitigação                                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Renomear wizard action ID quebra deep links `/campanha/acoes/registrar-sinal` | Documentar redirect legacy slug → `registrar-atualizacao` em route handler (Next redirect)                 |
| E11 perde alertas de adversário históricos                                    | Migration backfill: `signalType IN (invasao, visita_adversario, proposta_broker)` → `adversarySignal=true` |
| Status strip v2 usava signal type select para abrir wizard — UX perdida       | O botão "Registrar atualização" no strip abre o wizard unificado; polarity badge é read-only               |
| `polarity` em payload-types gera tipos estendidos                             | `pnpm generate:types` após migrate + build                                                                 |
| Notificações mencionam `municipalityUpdateKindLabels`                         | Grep + atualizar para polarity label                                                                       |

---

## 9. Verificação (checklist de saída)

- [ ] `pnpm migrate:status` — migration aplicada localmente
- [ ] `pnpm generate:types` — tipos atualizados
- [ ] `pnpm exec tsc --noEmit` — sem erros de tipo
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm format:check`
- [ ] `pnpm exec knip` — sem arquivos órfãos (WizardSignalTypeStep, municipalitySignalTypeMeta, etc.)
- [ ] `pnpm check:cycles`
- [ ] `pnpm test` — unit + int passando
- [ ] `pnpm test:e2e`
- [ ] `pnpm build` (local DB)

---

## 10. Decisões pendentes no gate

1. **Renomear wizard `register-signal` → `register-update`?** (D4) — Sim, mas valida no gate.
2. **`adversarySignal` como campo explícito (Opção B)?** (D1) — Sim, assume B.
3. **Remover colunas `kind`/`signalType`/`worked`/`failed`/`needs` da migration?** — Recomendado: não dropar (rollback safety); Payload ignora columns não mapeados.
4. **Texto do botão no home: "Registrar atualização" ou "Anotar o quê houve"?** — "Registrar atualização" (menor troca de copy, alinhado com label da coleção em admin).
5. **Coluna `lastSignal` no list — manter id ou renomear para `lastUpdate`?** — Manter id `lastSignal` (é um sort key interno; o label UI vira "Última atualização"). Evita quebrar query params existentes.
