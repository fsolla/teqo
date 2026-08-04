# Escala/DRY pós-B155 — padrão de escrita de célula: quick-edits via form action → rota JSON

Status: rascunho
Atualizado em: 2026-08-04
Issue: #368
Prioridade: P2
Item do roadmap: débito da entrega B155 (#359) — regra travada com o humano em 2026-08-04: **célula → rota, form → server action**
Model: composer-2.5
Impeccable: A — refactor de transporte; sem mudança de comportamento nem de UI
Appetite: ~0,5–1 dia eng; sem migration

## Problema

A regra decidida na entrega B155 é clara: **quick-edits de célula** (chips, toggles, auto-save,
mini-criar dentro de popover) usam **rota JSON via `campaignJsonMutationRoute`**; **forms
multi-campo** usam **server action** (`runCampaignFormAction`). O padrão rota é o dominante e o
**enforced** — `campaignJsonMutationRoute` impõe same-origin + safe-messages, e o teste
`codebaseConventions.unit.spec.ts` recusa `POST` nu — com 8+ endpoints sob `(app)/municipios` +
`liderancas/support-status`.

Restam **3 quick-edits de célula** que ainda passam por form action (as anomalias):

1. **Sinal na lista de municípios** — `MunicipalityListSignalControl` recebe
   `signalFormAction` = `createMunicipalityListSignalFormAction` (debounce/abort via
   `useCampaignCellAutosave`), mesma superfície que já tem advisors/leaderships/level/trend
   por rota.
2. **Coluna "Dobradinhas" de `/campanha/liderancas` (B31)** — `setLeadershipStateDeputyMembershipFormAction`.
3. **Coluna "Municípios" de `/campanha/liderancas` (B34)** — `setLeadershipMunicipalitiesMembershipFormAction`
   (delta por chip e batch território/ZE).

## Escopo

Migrar os 3 para o padrão rota, sem tocar comportamento:

- **F1 — sinal de municípios:** nova rota `POST /campanha/municipios/signal` (ou reusar o
  contrato do `political-trend`) via `campaignJsonMutationRoute`; o controle passa a chamar
  `postCampaignJson` mantendo debounce/abort; `createMunicipalityListSignalFormAction` vira
  wrapper interno ou é eliminada.
- **F2 — dobradinhas de liderança:** rota `POST /campanha/liderancas/state-deputies` (delta
  `{ leadershipId, stateDeputyId, assigned }`, allowlist do cap `LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE`).
- **F3 — municípios de liderança:** rota `POST /campanha/liderancas/municipalities` (delta
  `{ leadershipId, municipalityIds[], assigned }` — inclui o batch território/ZE; allowlist de
  floor/cap/scope).

Cada fase reusa as **actions record já existentes** (sem mudança de domínio): o trabalho é
transport (rota + allowlist) + o controle trocando `useActionState`/form action por
`postCampaignJson` com o mesmo estado otimista/debounce que já tem.

## Já resolvido no simplify (não reabrir)

- Reconcile scoped das wrappers B155 (sem bypass novo), toggle revalidando `/campanha/liderancas`,
  nome real do contato no chip otimista, validação cliente espelhando o schema, ids `useId`,
  refoco pós-form — todos aplicados na sessão B155.

## Explicitamente fora (deste lote)

- **O ladder de forms** (`runCampaignFormAction`/`mapCampaignFormActionError`) — a fronteira
  decidida mantém forms multi-campo em server action (wizards, cadastros, edição de ficha).
- **Query reversa de lideranças do bundle** fora do `Promise.all` (1 RTT serial no caminho
  crítico) — **defer com gatilho:** se a lista `/campanha/municipios` ficar lenta.
- **Slug lookup defensivo pós-commit no `createMunicipalityLeadership`** — descartado
  (edge extremo: admin excluindo município entre commit e read).
- **Teste int flaky isolado** (1 falha no gate de push, 2× re-run 571/571) — nota, sem registro;
  suspeita: contaminação do test DB por e2e paralelo no mesmo host.

## Fases verificáveis

1. **F1** — sinal de municípios (mesma superfície já no padrão; ROI mais alto).
2. **F2 + F3** — colunas de `/campanha/liderancas`.
3. **Gates** — `pnpm gate:fast`; e2e afetado (campaignMunicipalities, campaignLeaderships);
   `pnpm push`.

## Rabbit holes

- **Generalizar** os controles/providers de chips durante a migração — refactor de transporte
  apenas; os 2+2 controles seguem espelhos.
- **Mudar o contrato do sinal** (hoje debounce com flush no close) — preservar
  `useCampaignCellAutosave` behavior no novo transporte.
- **Fundir com UX** — nenhum achado de critique nesta superfície; manter o lote só-engenharia.

## Riscos e mitigação

- Controles de lideranças hoje acionam form actions com revalidate via server action — a rota
  precisa replicar o `revalidatePath` equivalente (as actions record reusadas já revalidam
  paths de detalhe; a lista onde o chip está NÃO é revalidada — contrato B34/B31).
- `codebaseConventions` (rota obrigatória via `campaignJsonMutationRoute`) e o prewarm do e2e
  (`setup.e2e.spec.ts`) ganham as rotas novas no mesmo PR.
