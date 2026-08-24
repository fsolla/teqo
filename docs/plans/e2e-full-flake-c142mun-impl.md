# Impl: E2E full do deploy verify — endurecer FAB C142 e checkbox de advisor sob 4 workers

Status: rascunho
Atualizado em: 2026-08-23
Issue: #808
Intenção: body da Issue #808 (spec; sem `Plano:` link)
Appetite restante: herdado

## Leitura da intenção

- **Outcome:** o job `deploy.yml → verify` (suíte e2e **full**, `PLAYWRIGHT_WORKERS=4`, prod build) deixa de falhar consistentemente nas 3 asserts — `campaignPermissionProfile.e2e.spec.ts:85` e `:101` (FAB/controles de escrita presentes) e `campaignMunicipalities.e2e.spec.ts:115` (checkbox de advisor) — desbloqueando o deploy (parado desde 2026-08-20).
- **O que NÃO negociar:** não reduzir workers do full (o battle-test do prod-mode é 4 workers); não tocar a lógica de access C142 (o escopo de escrita está correto); não mexer em DB de prod.
- **O que reavaliar:** a hipótese da intenção de "falso-negativo de perfil/portfolio no seed" e "colisão do seq/runSuffix de advisor com o ledger de município (allocator OPS46)". **Medida em produção (sonda SSR):** para advisor `tudo` E `carteira`, o FAB `[data-slot="campaign-quick-actions-fab"]` está presente e visível no HTML de SSR de `/campanha/municipios` (count 1, visible true). Logo **não há** false-negative de perfil: a resolução `advisorEditingScope(visibility, editing)` e o `shouldMountQuickActionsFab` entregam o chrome certo. A falha é de **timing/render sob carga** — latência do shell cliente (FAB vive no `CampaignAppScrollChrome`, componente `'use client'` streamed — C106 `S:`), não de dados.

## Abordagem recomendada

\```mermaid
flowchart LR
A[Spec C142: goto + networkidle] --> B{Settle shell dinâmico}
B -- não --> C[espera determinística: campaignPageChrome + FAB com budget explícito]
A2[municipalities:115: goto editar] --> B2{Settle + opção advisor rendrizada}
B2 -- não --> C2[check() com retry/toPass em cima do label pressionado]
\```

**Opções consideradas:**

- **A — Hardening só de spec (e2e):** aguardar o shell streamado assentar antes de assertar o FAB (padrão `S:` do C106 usado no mesmo arquivo e em `campaignUpdatesMobile`) + presença do FAB com orçamento explícito; em `:115`, envolver o `check()` de advisor em retry/toPass com rótulo scoped ao container. Sem mudança de produto.
- **B — Mudar produto para tornar o FAB não-streamed (renderizar no shell pai / remover `use client` do host):** mexe em código de UI de podução, corre risco de regressão do chrome, e não é o ponto: o produto está correto.
- **C — Aumentar `timeout` global do Playwright / expect:** mascararia todos os testes, é a abordagem que a própria suíte evita (budgets por assert, não globais).

**Recomendação: A** — porque o produto entrega o controle certo (provado por sonda SSR) e o bug é o spec assumir que `networkidle` == "chrome presente". O repo já tem o idioma exato para isso (o settle `document.querySelectorAll('div[id^="S:"]').length === 0` do C106, `ensureWideMunicipalityList`, `toPass` retry) — usar o owner, não inventar.
**Rejeitadas:** B (risco de produto sem ganho), C (máscara global).

### Componentes / mudanças

- **`tests/e2e/campaignPermissionProfile.e2e.spec.ts`** (`:85`, `:101`): antes de `expect(FAB).toBeVisible()`, aguardar o shell streamado assentar — o mesmo `page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0)` já usado nos irmãos de `campaignMunicipalities`, e usar `toBeVisible({ timeout })` com orçamento explícito (o `expect` global é 10s; sob carga o chunk do FAB pode passar disso). Manter as asserts `somente_leitura` (presença-ausente) intactas — elas passam por natureza.
- **`tests/e2e/campaignMunicipalities.e2e.spec.ts`** (`:115`): `page.getByLabel(...).check()` vira retry determinístico — esperar o `S:` settle após o `goto` do `/editar` e, se o label ainda não estiver pronto, `toPass` que re-tenta o `check()` com budget (o mesmo padrão B13/B17 que o arquivo já usa nos drawers/overlays). O label `Assessor <uuid>-1` vem de `getEligibleAdvisorOptions` (staff query) — não do allocator: a hipótese "colisão com ledger" fica descartada pela sonda (o FAB e as opções SSR-renderizam).
- **Sem migration / access / consent / UI de produto.**
- **Dados → forma:** nada a mudar no produto; apenas a forma de espera das asserts.

## Fases verificáveis

1. **Tracer / spec-only** (~0,25d): aplicar o settle `S:` + budgets explícitos nas 3 asserts; rodar as 2 specs isoladas (dev/prod) para não regressar.
2. **Battle-test**: `E2E_PROD=1 PLAYWRIGHT_WORKERS=4` nas 2 specs com `--repeat-each=3` + uma corrida da família `campaign*` para induzir carga (a falha só manifesta sob contenção — CI runner mais lento).
3. **Gates**: `pnpm gate:fast`; ci-scope; `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Não trocar o allocator OPS46 nem o `campaignMunicipalityAllocator` (a sonda descarta a colisão de índice como causa do FAB/checkbox).
- Não reduzir workers do full.
- Não endurecer os 5–10 specs flaky secundários listados na Issue (campaignActivity, agenda feed, newsletter, etc.) — fora do bloqueio; registrar débito.

## Riscos e mitigação

- **Hardening vira máscara de regressão real** → o settle `S:` é o mesmo usado pelos irmãos e apenas raciocina "chrome commitou"; se o FAB sumir por bug de access, o `toBeVisible` honesto continua falhando (a presença é o que se asserta).
- **`toPass` no `:115` mascara checkbox que nunca renderiza** → orçamento explícito e timeout por tentativa; se nenhuma tentativa renderiza, o retry esgota e falha de verdade.
- **Falha não reproduzir local** (workstation rápida) → confiar na sonda SSR + no padrão já consolidado do próprio arquivo, e validar o sinal de settle (não só aumentar orçamento).

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (deploy verify deixa de falhar nas 3 asserts)
- [ ] Invariantes AGENTS/engineering-standards (só spec e2e; sem tocar access/transação/Consent)
- [ ] Testes de domínio previstos: os specs endurecidos + battle-test 4 workers
