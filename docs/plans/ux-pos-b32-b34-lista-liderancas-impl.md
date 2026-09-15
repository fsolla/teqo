# UX pós-B32/B34 — chip oculto pelo clamp e key warning do head (débito da entrega #1036)

Status: pronto
Atualizado em: 2026-09-15
Issue: (registrada via agent:register — blocked até este plano em main)
Priority: P3
Impeccable: B — encaixe em lista existente, sem fluxo novo
Rascunho UI: N/A — ajuste de medição + fix de key, sem tela nova
Appetite: ~0,5 dia eng (duas fases curtas)
Responsável: —

## Origem

Débito capturado na entrega da Issue #1036 (B32/B34 — flake dos testes de lideranças sob 4 workers). Durante o diagnóstico, dois achados de UI/test-infra ficaram **fora do escopo** daquela Issue (spec-only) e entram aqui por triage do `capture-review-debts`.

## F1 — `RelationChipCell` pode esconder TODOS os chips atrás de "Ver mais…" (score 3)

**Evidência (2026-09-15):** snapshot de falha do e2e `campaignLeaderships.e2e.spec.ts` (B34) com a célula de municípios exibindo **apenas** "Ver mais…" e o status "Municípios salvos." — os chips não estavam no DOM. Reproduzido sob carga de 4 workers e determinístico por conteúdo (nomes de município que o allocator entregou ao run).

**Mecanismo (medido no código):** o clamp de 3 linhas (`RelationChipCell.tsx:459-528`) desconta no `trailingWidth` o toggle + a largura mínima do input de busca (`min-w-32`, ~128px). Com **dois** chips, o loop `while (fitting > 0 && fitting < chipElements.length)` pode derrubar `fitting` a **0** quando o primeiro chip não cabe ao lado do espaço reservado — e `visibleChips` vira uma fatia vazia. A célula fica opaca: nenhum vínculo visível, só o toggle.

**Direção:** piso de 1 chip enquanto `chips.length > 0` (o último chip sempre visível, a 3ª linha passa a rolar/clipar em vez de sumir) + pin unitário da medição pura (extrair o cálculo de `fitting`/`trailingWidth` para função testável, se ainda não for). Se a geometria não permitir o piso sem quebrar a reserva do input, a alternativa é o toggle virar chip "+N" (o prop `overflowToggleLabel` já existe) — decidir no shape.

**Rabbit holes:** não redesenhar o clamp nem o shell da célula; não tocar nas 4 listas consumidoras (`liderancas`, `pessoas`, `municipios`, `dobradinhas`) além do comportamento compartilhado; o e2e do B34 já contorna com `expandCollapsedChips()` — a Issue é sobre o comportamento de UI, não sobre o teste.

## F2 — Warning React "unique key" em `CampaignSortableHead` (score 3)

**Evidência:** `e2eFailureGuard` falha todo e2e de `/campanha/liderancas` no dev server local com `console.error: Each child in a list should have a unique "key" prop. Check the render method of 'CampaignSortableHead'. It was passed a child from 'LeadershipSortableHead'.` Em produção/CI o warning não existe (React remove), mas o e2e local em dev mode fica vermelho e mascara flakes reais (foi por isso que a validação da #1036 exigiu `E2E_PROD=1`).

**Direção:** achar a lista sem key no caminho `LeadershipSortableHead` → `CampaignSortableHead` (provavelmente um array em `children`/`filter`/`wrapSortControl`) e corrigir a key. É fix de 1 linha + o e2e local em dev volta a ser confiável sem workaround.

**Rabbit holes:** não refatorar os heads; não silenciar o guard (a regra de `console.error` é intencional).

## Já resolvido no simplify/diagnóstico (não reabrir)

- Waiter de POST twin → `expectPostResponse(..., { throwOnNonOk: true })` no owner (`campaignE2EFixtures.ts`).
- `toHaveCount(1)` → poll documentado; comentários enganosos corrigidos; changelog da entrega criado.
- Contorno no e2e B34 (`expandCollapsedChips`) — o débito é o comportamento de UI, não o teste.

## Explicitamente fora

- Contrato do allocator de municípios / purge-on-claim (defer com gatilho na #1036: a próxima ocorrência do 400 imprime `POST <rota> → <status>: <body>`; se apontar colisão cross-run, vira `kind:defect` P2 com piso 4).
- Flakes vizinhos da cast sob 4 workers (`campaignMunicipalities:1567`/`:659`, `campaignContacts:28`/`:171`) — absorvidos pela Issue #882 (dona da família).
- Reescrita dos specs B32/B34 ou de outras superfícies da cast.

## Referências

- Issue #1036 · `docs/plans/b32-b34-liderancas-estabilidade-verify-impl.md` (diagnóstico com a evidência)
- `src/components/campaign/shared/RelationChipCell.tsx:459-528` (medição do clamp), `:788-815` (toggle)
- `src/components/campaign/shared/CampaignSortableHead.tsx`, `src/components/campaign/leadership/LeadershipSortableHead.tsx`
- `tests/e2e/fixtures/e2eTest.ts:75-95` (guard de `console.error`)

## Decision quality

Score 4/5 — evidência direta (snapshot + leitura do código), appetite curto, fases independentes e rabbit holes cortados; a única incerteza é a geometria do piso de 1 chip, resolvida no shape da F1.
