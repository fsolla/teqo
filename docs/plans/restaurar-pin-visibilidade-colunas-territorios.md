# Restaurar pin de visibilidade CSS das colunas de rede em Territórios

Status: rascunho
Atualizado em: 2026-08-10
Issue: #606 (depende de #600)
Priority: P3
Model: composer-2.5
Impeccable: A — N/A (infra de testes; sem UI nova)
Canvas UI: N/A — sem UI
Appetite: ~0,25 dia eng; um outcome verificável
Responsável: —

## Intenção

A migração OPS35 de `campaignTerritories` para o modo HTTP sem browser removeu o spec de browser de 2200px que asserava a **visibilidade CSS real** das colunas de rede (Assessor / Liderança / Dobradinha) na tabela de Territórios — as rungs `@min-[Nrem]/territory-list:table-cell` dependem de container queries, e o pin HTTP atual só cobre **presença no HTML + classes de rung**, não o efeito visual. O aceite da intenção OPS35 ("nada é removido sem equivalente em outro lugar"; "viewports continuam em browser") deixa esse buraco: uma regressão de CSS (Tailwind/container queries/styles.css) passaria verde.

## Objetivo e aceite

- Um spec de browser **mínimo** (só este comportamento) pina que, a 2200px, os columnheaders de rede de `/campanha/territorios` estão **visíveis** e o restante do contrato (sortables) permanece visível — e que continua verde no job e2e existente.
- Nada além disso: não re-migra a família, não duplica asserções do `campaignTerritoriesHttp` (presença/rungs continuam lá), não mexe em CSS.

## Direção no codebase (hipótese)

- Spec novo mínimo `tests/e2e/campaignTerritoriesColumns.e2e.spec.ts` (browser, projeto `campaign` — mesmo padrão das famílias browser atuais, login via `campaign.login`).
- Assert com `getByRole('columnheader', ...)` visível em viewport 2200px (o corpo exato do spec antigo `campaignTerritories.e2e.spec.ts` — `git show` do spec deletado, teste 3).
- Manifesto `e2e-affected`: rota `territorios` → specs `['campaignTerritoriesHttp', 'campaignTerritoriesColumns']`.

## Dependências

- Nenhuma dura. Nasce `blocked` (OPS17) até o plano estar em `main`; destrava quando #600 flipar `done`.

## Fora de escopo

- Re-migrar famílias; tocar o spec HTTP; qualquer mudança de CSS/UI.

## Rabbit holes de produto

- **"Aproveitar e pinar as rungs de todas as listas"** — escopo explode; só Territórios (a família que perdeu o pin).

## Questões em aberto (produto)

- Nenhuma — comportamento já foi aceito pelo spec deletado (B175); isto é restaurar cobertura, não decidir produto.
