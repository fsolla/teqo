# Escala/DRY pós-B155 — padrão de escrita de célula: quick-edits via form action → rota JSON

Status: rascunho
Atualizado em: 2026-08-24 (escopo revisado — F1 resolvida por C87; B36 entra)
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

Restam quick-edits de célula que ainda passam por form action (as anomalias):

1. ~~**Sinal na lista de municípios** — ~~ **RESOLVIDO por C87 (2026-08-07):** o quick-edit de sinal
   (`MunicipalityListSignalControl`/`createMunicipalityListSignalFormAction`) foi substituído pelo
   form multi-campo unificado `MunicipalityListUpdateControl` (body/polaridade/urgente) — per a
   regra B155, form multi-campo permanece em server action. Nada a migrar.
2. **Coluna "Dobradinhas" de `/campanha/liderancas` (B31)** — `setLeadershipStateDeputyMembershipFormAction`
   (mesma action record também na coluna "Lideranças" de `/campanha/dobradinhas`, B36 — a rota F2
   serve os dois lados).
3. **Coluna "Municípios" de `/campanha/liderancas` (B34)** — `setLeadershipMunicipalitiesMembershipFormAction`
   (delta por chip e batch território/ZE).

**Deferido (fora deste lote):** colunas de `/campanha/dobradinhas` B37 (Municípios,
`setStateDeputyMunicipalitiesBatch`) e B156 (Assessores), inline-edits por campo B153 (contatos de
liderança), B163 (partido) e C129 (nome de legenda) — mesmas células-espelho em outros domínios;
gatilho registrado no `*-impl.md`.

## Escopo

Migrar as anomalias vivas para o padrão rota, sem tocar comportamento:

- **F1 — ~~sinal de municípios~~** **não existe mais** — C87 substituiu o quick-edit por form
  multi-campo (fica em server action por regra B155). Registrado como "já resolvido", não reabrir.
- **F2 — dobradinhas de liderança:** rota `POST /campanha/liderancas/state-deputies` (delta
  `{ leadershipId, stateDeputyId, assigned }`, allowlist do cap `LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE`),
  servindo os chips de `/campanha/liderancas` (B31) e `/campanha/dobradinhas` (B36).
- **F3 — municípios de liderança:** rota `POST /campanha/liderancas/municipalities` (delta
  `{ leadershipId, municipalityIds[], assigned }` — inclui o batch território/ZE; allowlist de
  floor/cap/scope).

Cada fase reusa as **actions record já existentes** (sem mudança de domínio): o trabalho é
transport (rota + allowlist) + o call site trocando a form action por um shim cliente
`postCampaignJson` com o mesmo estado otimista que as shared cells já têm.

## Já resolvido no simplify (não reabrir)

- **F1 (sinal na lista de municípios)** — resolvido por C87 (2026-08-07): o quick-edit virou form
  multi-campo `MunicipalityListUpdateControl`; per a regra B155 essa superfície permanece em
  server action (`createMunicipalityListUpdateFormAction`). Nada a migrar, não reabrir.
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

1. **F2 + F3** — colunas de `/campanha/liderancas` (+ B36 em `/campanha/dobradinhas`, mesma rota).
2. **Gates** — `pnpm gate:fast`; e2e afetado (campaignLeaderships, campaignMunicipalities);
   `pnpm push`.

## Rabbit holes

- **Generalizar** os controles/providers de chips durante a migração — refactor de transporte
  apenas; os controles espelho (dobradinhas B37/B156, inline-edits B153/B163/C129) seguem
  em form action até o lote próprio.
- **Mudar o contrato do sinal** — não se aplica mais (F1 morta por C87); sem debounce/autosave
  novo no lote.
- **Fundir com UX** — nenhum achado de critique nesta superfície; manter o lote só-engenharia.

## Riscos e mitigação

- A rota reusa as actions record (que já revalidam paths de detalhe; a lista onde o chip está
  NÃO é revalidada — contrato B34/B31) — o revalidate vem das actions, zero linhas na rota;
  adicionar a lista seria mudança de comportamento, não de transporte.
- `codebaseConventions` (rota obrigatória via `campaignJsonMutationRoute`) e o prewarm do e2e
  (`setup.e2e.spec.ts`) ganham as rotas novas no mesmo PR; o e2e B34 troca o filtro de POST da
  URL da página para a rota nova.
