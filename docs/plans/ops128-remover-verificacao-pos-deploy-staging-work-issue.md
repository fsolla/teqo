# Remover a verificação pós-deploy em staging do fechamento do `work-issue`

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1188
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5 dia eng, só markdown (skills/docs); um outcome verificável
Responsável: —

## Intenção

O OPS121 pendurou um passo obrigatório no fim de todo `work-issue`: esperar (poll de 2–3 min, deadline ~60 min) o run do `deploy.yml` publicar em staging e então testar a funcionalidade no navegador. O pedido verbatim é tirar essa necessidade: _"Vamos tirar a necessidade de fazer o teste em staging após o /work-issue para não bloquear o fluxo de trabalho."_ Hoje o fechamento de toda entrega estaciona nessa espera, e o teste raramente compensa: o `verify` do deploy já roda a suíte full antes de publicar; o staging não valida WebAuthn/OAuth/Resend; não tem usuários de campanha semeados (#1121/#1120) nem dados sintéticos no acervo (#1118); e enquanto o `verify`/e2e estiver flaky em `main`, o staging nem publica (#1124). A conta de teste do OPS125 é `coordinator` (sem restrição de visibilidade) e o runbook registra que o `teqo_staging` é cópia da produção, com PII real (`docs/ops/teqo-1313-deploy.md:216-218`) — o passo obrigatório tem custo e risco, não só latência.

Esta entrega tira a **obrigação** do teste pós-deploy do fechamento: o merge/flip `done` volta a ser o fim. Testar depois do merge continua desejável — mas **sem bloquear** o fluxo, desenhado em item futuro próprio (fora deste lote).

## Persona e fluxo

- **Persona / contexto:** o humano que conduz o `/work-issue` e os agentes autônomos no worktree (pool dormente, mesmo contrato), no momento de fechar a entrega.
- **Job principal:** encerrar a entrega no merge/flip `done` sem esperar o deploy de staging.
- **Fluxo desejado:** gates → PR Ready → auto-merge → flip `done` → fim. Nenhum poll de run, nenhum login em staging, nenhuma justificativa de adiamento.
- **Anti-goals de produto:** não é "desistir de verificar para sempre" (a solução posterior vem em item próprio); não é apagar a infra de staging (conta/scripts do OPS125 ficam); não é mexer no `bug-fix` nem na aprovação de produção.

## Objetivo e aceite

- O fechamento do `work-issue` termina no merge/flip `done`; nenhuma espera/poll/teste em staging é exigido.
- `work-issue`, `agent-work-issue` e `execution-pipeline.md` não citam mais a §Verificação pós-deploy — e o pool não "defere" um passo que não existe.
- O passo pós-deploy manual de **produção** do `bug-fix` permanece intacto (dono separado).
- A infra de staging (conta OPS125, scripts, var de senha, runbook) permanece disponível e documentada para a solução futura — nenhum código é removido.
- Fronteiras intocadas: `deploy.yml` (incluindo `deploy-staging`/approval), homeserver, DB de produção e Consent/LGPD.
- Changelog OPS128 registrado; sem migration e sem UI.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de processo/skill; nenhuma superfície de dados.
- **Decisões desbloqueadas:** N/A (sem métrica); o efeito visível é o fechamento deixar de esperar staging.
- **Forma:** _adiada ao plano de implementação._

## Dados da decisão (literais)

- N/A — sem decisão de dados de produto; nenhum ID de modelo, env, tabela ou string de dados a fixar.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `.agents/skills/work-issue/execution-pipeline.md` — dono da mecânica: apagar a §"Verificação pós-deploy (staging)" (:139-236) e a coluna "Pós-deploy (staging)" da tabela `## Deltas por ator` (:238-243).
  - `.agents/skills/work-issue/SKILL.md` — item 8 do checklist (:86), `## Passo 8` (:186-197), `## Resumo final` (:199-201).
  - `.agents/skills/agent-work-issue/SKILL.md` — item 6 do checklist (:43) e o parágrafo de defer do Passo 6 (:102-104), que referencia a seção apagada.
  - `docs/ops/teqo-1313-deploy.md` §Staging — a infra OPS125 fica; ajustar só a justificativa do passo da conta (:195-215), que hoje promete um fluxo que deixa de existir.
  - `docs/changelog/2026-09-18-ops128.md` — entrada nova (formato do agregado; nunca commitar o agregado).
- **Precedente a olhar:** OPS121 (#1079, dono do passo — plano/registros **imutáveis**) e OPS125 (#1126, dono da credencial/scripts — ficam). `bug-fix/SKILL.md:117-120` é o dono separado do pós-deploy de produção (intocado).
- **Risco de acoplamento:** nenhuma referência órfã pode sobrar (o pool cita "§Verificação pós-deploy" no checklist e no Passo 6); `deploy.yml` e o approval humano de produção não entram no diff; os testes que leem as skills não pinam a seção removida (nada a atualizar neles).

## Dependências

- OPS121 (#1079, done/in-prod) — o passo que este item remove; plano imutável, citado só como referência.
- OPS125 (#1126, done/in-prod) — a conta/scripts que ficam como infra reutilizável.
- Nenhuma dura; não depende do item futuro de teste pós-merge.

## Fora de escopo

- **Solução de teste pós-merge sem bloquear o fluxo** — pedido do usuário para o futuro; **não registrar neste lote**. Herda o contexto de #1121/#1120 (staging sem usuários de campanha), #1118 (acervo sem dados sintéticos) e #1124 (verify/e2e flaky em `main`) — não reabrir nem editar essas Issues.
- Remover a infra OPS125 (`scripts/lib/staging-test-account.mjs`, `scripts/bootstrap-staging-test-account.mjs`, `pnpm campaign:staging:test-account`, var `STAGING_TEST_ACCOUNT_PASSWORD`).
- E2E automatizado contra staging (já decidido fora no OPS103) e verificação/aprovação de produção (segue 100% humana).
- Qualquer mudança em `deploy.yml`, no homeserver, no DB de produção ou em Consent/LGPD.

## Rabbit holes de produto

- **"Já que removeu, apaga a conta/scripts do OPS125".** Se alguém "só completar": destrói infra testada e guardada por guard fail-closed, que a solução futura vai querer. **Corte neste item:** infra intocada; só o fluxo deixa de exigi-la.
- **Deixar a mecânica no pipeline como "manual/opcional".** Se alguém "só completar": vira segunda fonte de verdade e promessa de um teste que o item futuro vai redesenhar. **Corte neste item:** a mecânica sai do dono; o conhecimento de staging fica no runbook.
- **Estender a remoção ao `bug-fix`/produção.** Se alguém "só completar": some a confirmação manual de prod (dono separado). **Corte neste item:** `bug-fix/SKILL.md:117-120` intocado.
- **"Não verificar nunca mais".** Se alguém "só completar": fecha a porta do teste pós-merge. **Corte neste item:** fora de escopo com destino nomeado (item futuro).

## Questões em aberto (produto)

- **D1 — O que exatamente sai?** **Opções:** A apagar o passo dos dois skills + a §Verificação pós-deploy do pipeline (mecânica sai do dono; staging fica no runbook) | B manter a mecânica no pipeline como opcional/manual e só tirar a obrigação | C manter o poll, mas fire-and-forget. **Recomendação:** A — o pedido é "tirar a necessidade"; B deixa mecânica sem dono e promete o que o item futuro vai redesenhar; C não remove a espera de fato nem dá dono ao resultado. _(assumido — validar com produto)_
- **D2 — O destino da credencial/conta OPS125 e dos scripts?** **Opções:** A intocados (infra reutilizável pela solução futura) | B remover. **Recomendação:** A — zero custo parado, evita trabalho destrutivo e preserva a solução futura; só o fluxo deixa de exigi-los. _(assumido — validar com produto)_
- **D3 — Fronteira com o `bug-fix`?** **Opções:** A manter separados e cruzados | B unificar. **Recomendação:** A — o pós-deploy do `bug-fix` é de **produção**, manual, com dono próprio; a remoção daqui não o toca, e o ponteiro cruzado desatualizado (`execution-pipeline.md:149-151` citando `bug-fix/SKILL.md:106-109`) desaparece com a seção — não perpetuar o número errado. _(assumido — validar com produto)_
- **D4 — O que o fechamento passa a declarar?** **Opções:** A merge/flip `done` é o fim, sem promessa nem "diferido" | B manter registro de "não verificado em staging". **Recomendação:** A — sem passo não há defer; o pool para de referenciar seção inexistente. _(assumido — validar com produto)_
- **Prioridade: P2 ou P1?** **Recomendação:** **P2** — desbloqueia todo fechamento, mas é processo interno, docs-only e sem incidente em produção, alinhado a OPS121/OPS125 (ambos P2); P1 só se o gate julgar o ~60 min/entrega um gargalo diário. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1188
- Design UI (gate): N/A
- `.agents/skills/work-issue/execution-pipeline.md` (§Verificação pós-deploy a remover; §Deltas por ator), `.agents/skills/work-issue/SKILL.md:86,186-201`, `.agents/skills/agent-work-issue/SKILL.md:43,102-104`
- `.agents/skills/bug-fix/SKILL.md:117-120` (pós-deploy manual de produção — intocado); `.github/workflows/deploy.yml:210-241` (job `deploy-staging` — não tocar)
- `docs/ops/teqo-1313-deploy.md:146-151` (var de senha), `:195-215` (bootstrap/conta OPS125), `:216-227` (cópia da produção + limites do staging)
- `docs/changelog/2026-09-16-ops121.md` e `docs/changelog/2026-09-17-ops125.md` (histórico imutável); planos OPS121/OPS125 (imutáveis)
- Issues abertas herdadas pelo item futuro: #1121, #1120, #1118, #1124
