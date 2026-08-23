# Impl: OPS47 — agent-pool/SKILL.md aponta para plano com política pré-main obsoleta

Status: aprovado
Atualizado em: 2026-08-23
Issue: #735
Intenção: sem plano (body é spec — título)
Appetite restante: —

## Leitura da intenção

- **Outcome:** Alinhar `docs/plans/agent-pool-orchestrator.md` e os resíduos stage-era citados por `agent-pool/SKILL.md` à política main-based atual (PR `--base main` no GitHub, auto-merge nativo, flip `issue-done-on-main-merge.yml`, sem promote), de modo que a referência viva (SKILL.md:18) aponte para um plano factualmente correto — mantendo o frame histórico do pool dormente (OPS65).
- **O que NÃO negociar:** Frame histórico do pool dormente (L14-16 do SKILL.md e o tom "O que foi" do plano são legítimos — keep); docs-only, zero mudanças em `src/`/workflows/código do pool; não criar docs novos nem arquivar o plano inteiro; não tocar em `paradigma-agentes-paralelos.md` (órfão, fora de escopo); nunca editar `CHANGELOG-AGENTS.md` na mão (insert-only via `pnpm changelog:build`).
- **O que reavaliar:** Escopo dos resíduos — os comentários de label em `tests/unit/agentPoolState.unit.spec.ts:103` e `scripts/lib/agent-pool-state.mjs:131` são touch-ups opcionais (labels/comentários, não comportamento); decidir incluir ou deixar registrado como opcional. Conteúdo já corrente (SKILL.md L98 `--base main` + auto-merge, L100 promote dual OPS17/18, `startingRef` L425/467/484) fica intacto.

## Abordagem recomendada

**Opções consideradas:** A — editar o dono linha-a-linha; B — reescrever/arquivar o plano inteiro ou criar doc novo.
**Recomendação:** A — editar `docs/plans/agent-pool-orchestrator.md` linha-a-linha para a política main atual, preservando o frame histórico do pool dormente; corrigir o resíduo de SKILL.md:79.
**Rejeitadas:** B — violaria "edit the owner, don't twin" (AGENTS): o plano já é o dono do concern; reescrever do zero ou criar twin apagaria a história do paradigma e geraria dois donos.

### Componentes / mudanças

**1. `docs/plans/agent-pool-orchestrator.md`** (517 linhas) — edições por grupo:

- **L3** — "promote stage→main continua humano": trocar por nota de que o promote foi removido (2026-08-01) e o merge agora acontece direto em `main`.
- **L30 / L56 / L428** — "merge em `stage`" / "pull_request closed em stage": atualizar para merge em `main` / `pull_request` closed em `main`.
- **L39** — "`agent:promote` nunca é chamado": ajustar para "não existe mais (script removido 2026-08-01)".
- **L67 / L275 / L300 / L327 / L363 / L424** — "PR base stage" / "`gh pr create --base stage`" → `--base main` (reflete o vivo: `POOL_BASE_REF='main'` em `scripts/agent-pool.mjs:70` e prompt `--base main` em `scripts/lib/agent-pool-prompt.mjs:40-41`).
- **L73** — "merge em stage → `issue-done-on-stage-merge.yml` flip done" → nome do workflow vivo `.github/workflows/issue-done-on-main-merge.yml`.
- **L95 / L165 / L442** — job `migration-lock` → substituir por `countOpenSchemaPrs` (`scripts/lib/agent-pool-forgejo.mjs:83`), com nota da remoção do job (2026-08-12) e que a guarda sobrevive nesse limite de PRs de schema abertos.
- **L217 / L229** — referências a `.agents/skills/model-selection/SKILL.md` → `scripts/lib/agent-pool-models.mjs` (skill deletada; regras de modelo migraram para o módulo).
- **L29 / L52 / L122 / L132-144 / L242 / L270** — `.github/workflows/agent-pool.yml` / `gh workflow run agent-pool.yml` → marcar como workflow removido no OPS65 (pool dormente); manter a descrição como histórico "O que foi", não como instrução operacional viva.
- **L293 / L364** — "promote humano a main" / **L368** "`pnpm agent:promote`": reescrever como descrição histórica — promote deletado 2026-08-01, o fluxo atual é PR → `main` com auto-merge nativo (rebase) e flip pós-merge.
- **L425** — `startingRef: 'stage'` no spawn → `startingRef: POOL_BASE_REF` (= `'main'`, `scripts/agent-pool.mjs:254`); o mecanismo em L467/484 já é real com base `main` → não é política stale, só alinhar o valor citado.

**2. `.agents/skills/agent-pool/SKILL.md`** — fix do resíduo:

- **L79** — "Antes do promote, use dispatch na branch (`--ref`)": remover/reformular — não há promote nem dispatch (404), o fluxo é PR `--base main` + auto-merge nativo.
- Manter intacto o frame histórico (L5 Forgejo Actions, L14-16 dormência, L94 "workflow removido OPS65 — falha 404") e o que já está corrente (L98 `--base main` + auto-merge; L100 promote dual OPS17/18).

**3. Touch-ups opcionais (comentário/label, sem mudança de comportamento):**

- `tests/unit/agentPoolState.unit.spec.ts:103` — label "CI flipped on stage merge" → "on main merge".
- `scripts/lib/agent-pool-state.mjs:131` — comentário "merge in stage" → "merge in main".

**4. Changelog:**

- Criar `docs/changelog/2026-08-23-ops47.md` (uma linha longa, formato `**OPS47 — <title> (<date>):** <prose>`) e rodar `pnpm changelog:build` (nunca editar `CHANGELOG-AGENTS.md` na mão).

## Fases verificáveis

1. **Plano + SKILL.md** — aplicar as edições do grupo 1 e 2; validar tom histórico mantido e nenhum resíduo stage-era vivo.
2. **Changelog** — escrever `docs/changelog/2026-08-23-ops47.md` e rodar `pnpm changelog:build`.
3. **Gates** — docs-only → CI roda só os guards de docs; `pnpm changelog:check`; grep de saída (abaixo); push via `pnpm push`.

## Rabbit holes / Não escopo

- `docs/plans/paradigma-agentes-paralelos.md` — órfão/histórico, fora de escopo.
- CI workflows, `.github/workflows/*`, `scripts/agent-pool*.mjs` e demais código do pool — dormentes (OPS65), não tocar.
- `tests/unit/agentPoolState.unit.spec.ts` e `scripts/lib/agent-pool-state.mjs` — só o comentário do label se os touch-ups opcionais forem incluídos; nenhuma lógica muda.
- Não regenerar/não criar migração, não tocar em dados.

## Riscos e mitigação

- **Edição linha-a-linha pode apagar o tom histórico do plano** → mitigação: manter o frame "O que foi"/dormente em cada grupo editado (OPS65, OPS71/OPS76 como marcos), nunca reescrever parágrafos inteiros sem preservar a narrativa.
- **`CHANGELOG-AGENTS.md` é insert-only** → nunca editar na mão; única via é `pnpm changelog:build` (OPS44).
- **Resíduo stage esquecido em linha não mapeada** → mitigação: grep de saída como gate antes do push.
- **Referência cruzada quebrada ao renomear skill → módulo** → verificar que `scripts/lib/agent-pool-models.mjs` existe e citar o caminho real (sem inventar).

## Aceite de engenharia

- [ ] Aceite da intenção coberto (plano + SKILL.md alinhados à política main, frame dormente preservado)
- [ ] Invariantes AGENTS (docs-only, sem mudanças em `src/`/workflows; changelog via `changelog:build`; `CHANGELOG-AGENTS.md` intocado)
- [ ] Grep de saída: zero ocorrências vivas de `--base stage`, `issue-done-on-stage-merge`, `stage→main` (ou "merge em stage") em docs ativos — resíduos só como descrição histórica datada
- [ ] `pnpm changelog:check` verde; CI docs-guards verde; PR via `pnpm push`
