# Plano curto: E2E-FLAKE-CAST-ROTATIVA — flakes reprodutíveis da família campaign pós-OPS83

Status: rascunho · Issue: (registrada via agent:register) · Débito capturado na entrega #767 (2026-08-24)

## Problema

O e2e full (deploy `verify`) e runs locais encontram uma cast rotativa de flakes na família `campaign`: no rerun do #767, 5 testes falharam consistentemente em **main limpo** (não relacionados àquela entrega) e 5 irmãos flakearam 1×:

**Reprodutíveis em main limpo:**

- `campaignPeople.e2e.spec.ts:180` (C131) — `campaignPeople.e2e.spec.ts:212`: opção `Todas as zonas` do aggregate Salvador não aparece (stream/aggregate).
- `campaignMunicipalities.e2e.spec.ts:387` (B176) — filtro por Dobradinha/Liderança/Partido no omnibox; tocado 2× pelo OPS83 (#824) e ainda vermelho.
- `campaignColumnPicker.e2e.spec.ts:146` (B197) — assessor ganha o picker com e-mail oculto.
- `campaignConcepts.e2e.spec.ts:15` — staff chega na página de conceitos via tooltip/popover.
- `campaignActivity.e2e.spec.ts:51` — cria compromisso com demandas vinculadas pelo overlay.

**Flakes 1× (passaram no rerun):** `campaignHomeActions:435`, `campaignHomePixel:78`, `campaignMunicipalities:650`, `campaignNearestMunicipality:178`, `campaignPeopleHttp:88/115`.

## Já resolvido — não reabrir

- C142 / `campaignMunicipalities:115` (`locator.check` timeouts) — curado pelo #808 (`e2e-full-flake-c142mun`, 21/21 no battle-test).
- Discrepância do `cleanupTestUser`/shadow `adminHeaders` — curada pela própria #767.

## Abordagem

Linha spec-only (padrão provado pela casa de flakes): settle/poll com `waitForStreamSettled`/`expect.poll`/`expectPostResponse`, reuso do owner existente. Sem migration, sem mudança de app.

Fases por ROI:

1. B176 `campaignMunicipalities:387` (pista mais quente — 2× tocado pelo OPS83 e ainda vermelho)
2. C131 `campaignPeople:180` (aggregate/stream)
3. `campaignConcepts:15`
4. `campaignActivity:51`
5. B197 `campaignColumnPicker:146`
6. Re-rodar família + aceite de 2 runs limpos

## Explicitamente fora

- `seedTestUser` fora do lock (create-if-missing idempotente) — gatilho: usuário de teste ganhar credenciais não-constantes → virar fixture de projeto (anotado no `e2e-admin-login-lock-impl.md`).
- #763 (C113) e #790 (OPS46-S3) — pais/superfícies distintos.

## Riscos

- Cast rotativa pode girar entre o plano e a execução — fase 6 (re-run da família) é o aceite.
- Cada fase é independente; a cast não bloqueia entregas individuais (PR roda blast radius, full fica no verify manual).
