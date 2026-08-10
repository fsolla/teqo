# Worktrees provisionam os bancos e2e sem o seed mínimo — e2e diverge da CI

Status: rascunho
Atualizado em: 2026-08-10
Issue: #584
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem UI; infra de provisionamento de testes)
Canvas UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

`pnpm worktree next/plan` cria bancos `teqo_wt<slot>` / `teqo_wt<slot>_test` **só com migrations** (documentado em AGENTS.md e `scripts/worktree.mjs`). A CI roda `pnpm migrate && pnpm db:seed:minimal` antes do e2e. Resultado: o e2e em worktree testa **dados diferentes** dos que a CI testa — e o e2e local de um worktree fica vermelho em `main` verde, ensinando agentes a ignorar a suíte (o padrão exato que o ledger TECH-DEBT row 19 chama de "masks real failures in the delivery gate").

Reproduzido nesta sessão (worktree `plan-issue-23`, banco fresco só-migrations):

- `campaignMunicipalities` "FAB overlay polish — overlay labels readable and search focus hides action strip" — 2/2 falhas: o POST `/campanha/home-search` (`mode: suggest`) responde `success/resultKind:suggest` com **0 municípios**, e a região `Sugestões` nunca renderiza. Causa: `rankHomeSearchSuggestMunicipalities` para coordenador/candidato filtra `priority === 'alta'`, e o catálogo migrado nasce 435×`normal` (medido no banco: `normal|435`, zero `alta`). O `db:seed:minimal` é quem pina `salvador-ze-1` e `camacari` como `alta` — por isso a CI passa (48/48×3 em 2026-07-31) e o worktree falha.
- `campaignSavedFilters` "saves the current recorte…" — 1/1 falha: o recorte `?priority=alta` (416 municípios esperados, "deep enough that `?page=2` is a real page") nasce **vazio** sem os pins do seed → o nome sugerido do recorte vem vazio e o fluxo quebra na linha 49.

## Persona e fluxo

- **Persona / contexto:** agente ou humano rodando `pnpm test:e2e` num worktree provisionado — o ambiente padrão de entrega em paralelo.
- **Job principal:** rodar o e2e local e confiar no resultado como espelho da CI.
- **Fluxo desejado:** `worktree next` (ou `plan`) → bancos prontos com o mesmo conteúdo sintético da CI → `pnpm test:e2e` verde no que é verde na CI → vermelho só no que é vermelho de verdade.
- **Anti-goals de produto:** não alterar nenhum spec para "aceitar dados ausentes" enquanto o provisionamento é o defeito; não rodar seed contra banco não-local.

## Objetivo e aceite

- Um worktree recém-provisionado (`next` **e** `plan`) roda `pnpm test:e2e` (suíte afetada) com o mesmo resultado esperado da CI para os specs dependentes de dados do seed (`campaignMunicipalities` FAB suggest, `campaignSavedFilters`, e os demais que tocam `priority`/`expectedVotes`/`campaignGoals`).
- A CI continua sendo a fonte canônica: nada do que este item faz muda o que a CI executa.
- O seed mínimo roda idempotente (upsert) e protegido pelo guard de banco local; re-provisionamento não duplica nem corrompe.
- Guard de regressão: se o manifest do seed mínimo perder os pins que specs e2e dependem, algo falha (teste de convenção ou o próprio e2e) — decidir no plano de implementação, sem enfraquecer specs.

## Dados (intenção)

- **Vou apresentar dados?** Não — infra de provisionamento; o "dado" é a paridade de estados entre ambientes.
- **Decisões desbloqueadas:** agente decide "e2e local verde/vermelho é confiável" sem re-checar contra a CI.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/worktree.mjs` (provisionamento — `runMigrate`/criação dos bancos), `scripts/seed-minimal.mjs` + `scripts/lib/seed-minimal-manifest.mjs` (fonte do conteúdo sintético), `tests/e2e/setup.e2e.spec.ts` (onde a paridade de expectativas já vive).
- **Precedente a olhar:** AGENTS.md "Per-worktree environments" (2026-08-08) documenta o contrato atual; `tests/unit/seedMinimalManifest.unit.spec.ts` pina o manifest; guard `assertLocalDatabase` é o portão de segurança existente.
- **Risco de acoplamento:** o seed é idempotente e local-only; nunca apontar para Neon; specs e2e **não** são tocados neste item (a menos que um spec prove depender de dado que nem a CI garante — aí é outro item).

## Dependências

- Nenhuma.

## Fora de escopo

- Estado vazio do search/suggest no produto (coordenador sem municípios priorizados vê região em branco) → item próprio (OPS29).
- Flakes de compile-frio do dev server (`:78`/`:518` da lista de municípios) → item próprio (OPS30).
- Flakes já registrados: #562 (agenda mobile CI, em progresso), #553 (campaignSuggestions/testDatabaseLease), #573 (unit `municipalitiesWithoutUpdateTool`).

## Rabbit holes de produto

- **"Corrigir o teste em vez do provisionamento."** Se alguém ajustar `campaignSavedFilters`/FAB para tolerar lista vazia: o worktree volta a mascarar diferenças de dados e o próximo spec que depender de seed quebra sem aviso. **Corte neste item:** a paridade de provisionamento é o contrato; spec muda só com evidência de que nem a CI garante o dado.
- **"Rodar o seed em todo banco do sistema."** O escopo é o provisionamento de worktrees; o `teqo`/`teqo_test` compartilhados e a CI já têm seus fluxos.

## Questões em aberto (produto)

- **O seed mínimo deve rodar também no `teqo`/`teqo_test` compartilhados no fallback sem Docker?** **Opções:** A) sim, por paridade total | B) não, deixa o fluxo manual atual. **Recomendação:** A — o fallback Cursor Cloud é o ambiente mais provável de pegar banco cru; o seed é idempotente. _(assumido — validar com produto/ops)_
- **Onde entra o guard de paridade (spec pina que o seed existe)?** **Opções:** A) no manifest unit (estende o pin existente) | B) no setup e2e (falha cedo com mensagem clara) | C) nenhum, a CI pega. **Recomendação:** B — o setup já é o lugar onde o e2e declara suas precondições de dados; mensagem clara em vez de spec vermelho confuso.

## Referências

- Evidência da sessão: banco `teqo_wt959_test` com `priority: normal|435` (zero `alta`, zero contatos) vs `scripts/lib/seed-minimal-manifest.mjs` pins `salvador-ze-1`/`camacari` `alta`; trace de rede do POST `/campanha/home-search` respondendo `municipalities: []` com `scopeMunicipalities: 435`.
- `AGENTS.md` — "Per-worktree environments (`pnpm worktree next`, 2026-08-08)" (contrato atual: migrations only).
- `docs/TECH-DEBT.md` row 19 — flake fichado "masks real failures in the delivery gate".
