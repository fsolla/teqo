# Escala/DRY: chrome comum dos passos finais do wizard (pós-B195)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #597 (D11)
Priority: P2
Kind: chore
Depends: #591 (B195)
Appetite: ~0,5–1 dia eng

## O débito (colhido no /simplify do B195)

O passo final dos wizards de `/campanha/acoes` duplica o mesmo chrome:

1. **Submit bar + pendência** — `aria-busy`/`data-pending` no form, bloco de botão com `Spinner` + "Salvando…", `aria-live` sr-only de pendência: idênticos em `WizardRegisterDemandStep`, `WizardUpdateBodyStep`, `WizardTrendNoteStep` e `WizardExpectedVotesStep`.
2. **Campos do cadastro de demanda** — Tipo (NativeSelect), Atividade (`AsyncSearchCombobox`) e campo único de texto: copy-paste entre `WizardRegisterDemandStep` e `DemandForm` (diferem só no prefixo de `id` e no seletor de município, necessário só no `/demandas/nova`).

Extração proposta: `WizardStepFormChrome` (form + pending chrome + submit bar como props `pendingAnnouncement`/`ctaLabel`) e um componente de campos de demanda parametrizado por prefixo de id + `showMunicipality`. Copy já vive em `schemas/campaignDemand.ts` (B195) — o lote não mexe em copy.

## Appetite e rabbit holes

- Tocar os 3 steps legados exige rodar o e2e de `campaignHomeActions` + `campaignWizardChrome` (regressão de foco/a11y: `contentFocus`, aria-live, label do botão).
- Rabbit hole: "extrair o shell inteiro" (cada step tem corpo próprio — NÃO unificar os corpos); não renomear arquivos de steps (histórico de PRs); não mexer em copy nem em comportamento (toast/push/retorno intactos).

## Já resolvido no simplify do B195 (não reabrir)

- Constantes de copy compartilhadas (`CAMPAIGN_DEMAND_*` em `lib/schemas/campaignDemand.ts`), parser único `parseCampaignDemandCreateFormData`, limite central `CAMPAIGN_DEMAND_BODY_MAX_LENGTH`, `htmlFor` órfãos removidos, CTA único `CAMPAIGN_DEMAND_SUBMIT_LABEL`, bug do `useCampaignFormSuccessToast` corrigido no hook.

## Explicitamente fora (defers do triage do B195)

- Fail-closed de `campaignDemandUniqueSlug` sem teste (gatilho: próxima mudança no hook).
- Copy "Informe um título com letras ou números." num form sem campo de título (decisão de produto; gatilho: feedback em campo).
- Casa de copy inconsistente (`WIZARD_UPDATE_*` em `wizardUpdateUi.ts` vs `WIZARD_DEMAND_*` em `campaignWizardCopy.ts`) — cosmético.
- `canLeaderEdit` morto em `campaignDemandData.ts` (pré-existente).
- Update de demanda com descrição inalterada ainda grava (documentado em teste).
