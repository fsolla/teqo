# E2E: flake do `getByLabel('Atividade relacionada')` (strict mode) sob carga

Status: rascunho
Atualizado em: 2026-08-11
Issue: #619 (D11) colheu; registro D12
Priority: P3
Kind: defect
Depends: [] — pré-existente em main, não nasce do D11

## O sintoma

`tests/e2e/campaignRegisterDemand.e2e.spec.ts:38` — `expect(page.getByLabel(CAMPAIGN_DEMAND_ACTIVITY_LABEL)).toBeVisible()` (label `Atividade relacionada`) falha com **strict mode violation: resolved to 2 elements**, ambos botões com `aria-label="Atividade relacionada: Nenhuma atividade"` (o trigger do `AsyncSearchCombobox`).

## Caracterização (colhida no D11, 2026-08-11)

- **Falha em runs completos, passa isolado:** 3/4 runs completos do set (dev e prod/E2E_PROD=1) falharam; o teste isolado passa sempre (dev e prod).
- **Pré-existente:** `git stash` no worktree do D11 (código 100% main) reproduziu a falha **idêntica** no mesmo teste — inclusive o mesmo diretório de error-context. Não é regressão do D11.
- **Ambiente:** máquina do pool com carga alta (compiles dev de 6–27s; asserts com budget 10s). O erro aparece como violação de strict mode em `getByLabel`, que é substring-match: casam o trigger button (aria-label `Atividade relacionada: …`) e um segundo nó.
- **Snapshot pós-falha:** o form renderizado mostra um único trigger e o conteúdo do `CommandDialog` (título + descrição) montado no DOM com o dialog fechado — o segundo match é transitório/estado de reconciliação, não duas instâncias estáveis do componente.

## Hipóteses a investigar (sem implementação aqui)

1. `AsyncSearchCombobox` renderiza `CommandDialog` com conteúdo sempre montado: `CommandInput` tem `aria-label={label}` (o label exato, sem sufixo) — candidato natural a segundo match quando visível à a11y tree (possível `forceMount`/transição do Radix/cmdk).
2. Mesmo nó resolvido duas vezes por caminhos de label distintos (aria-label + associação via `<label>`/`aria-labelledby`) — validar com `page.getByLabel(...).evaluateAll(n => n.length)` num state aberto vs fechado.
3. Timing: o match duplicado existe durante a transição de abertura/fechamento do dialog ou numa re-render em rajada (2 workers + navegação pesada) — por isso só aparece em runs completos.

## Direções de fix (escolher na execução)

- **Spec:** `getByLabel` → `getByRole('button', { name: /Atividade relacionada:/ })` (o trigger) ou `.first()`; ou `getByLabel(CAMPAIGN_DEMAND_ACTIVITY_LABEL, { exact: false })` com alvo inequívoco.
- **Componente:** remover redundância de labels (ex.: `aria-label` do `CommandInput` só quando aberto; ou `aria-hidden` do dialog fechado).
- Não alterar copy visível nem o comportamento da combobox.

## Aceite

- [ ] `campaignRegisterDemand` verde em run completo (reprodução ×3) e isolado
- [ ] Sem mudança de DOM/labels no estado fechado que afete outros specs (grep `getByLabel` em e2e)
