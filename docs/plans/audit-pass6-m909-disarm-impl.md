# Impl: Guardrail P6-M909 — desarme determinístico do auto-merge da /testing-audit

Status: aprovado
Atualizado em: 2026-08-25
Issue: #909
Intenção: docs/plans/entrega-engenharia-p6.md
Appetite restante: 0,5 d

## Leitura da intenção

- **Outcome:** o desarme do auto-merge deixa de depender do agente lembrar a ordem — `scripts/testing-audit-disarm.mjs` chamado no passo que cria o PR (cria → desarma → verifica `null`, atômico) + fiação na skill /testing-audit.
- **O que NÃO negociar:** o safety-net (`agent-pr-ready-automerge.yml` → `github-pr-automerge.mjs`) é intocável. PR ready (nunca draft) segue contrato. Guarda classe 3.
- **O que reavaliar:** a Fase 5 atual da skill usa `gh pr merge --disable-auto`/`gh pr view` — scripts do repo falam REST/GraphQL com `GITHUB_TOKEN` (`github-api.mjs`, `issue.mjs`).

## Abordagem recomendada

**Opções:** A (só `--pr N` desarmar) | B (fallback draft manual) | C (criar+desarmar+verificar + `--draft-on-failure`)
**Recomendação:** C — script faz criar+desarmar (`--head/--title/--body-file`) ou desarmar PR existente (`--pr N`, para rearms pós-`synchronize`); falha de verificação converte a draft via GraphQL e sai 1. O fallback também não pode depender do agente.
**Rejeitadas:** A (dois comandos ≠ atômico); B (a mesma ordem humana que falhou).

### Componentes / mudanças

- **`scripts/lib/github-api.mjs`** (editar o dono): `getPullRequestAutoMergeStatus(number)` GraphQL (`autoMergeRequest`, `isDraft`, `mergeable`, `mergeStateStatus`) + `convertPullRequestToDraft(nodeId)` (mutation `convertPullRequestToDraft`). Reusa: `createPullRequest`, `ensureAutoMergeDisabled` (laço desarme→re-poll), `getPullRequest`, `dieWithLabel`.
- **`scripts/testing-audit-disarm.mjs`** (novo, plain Node): `GITHUB_TOKEN=<PAT> node … --head <b> --title <t> --body-file <r> [--draft-on-failure]` cria ready → desarma → verifica; `--pr <N>` para rearms. Pre-check de `GITHUB_TOKEN` → `dieWithLabel` exit 1 ANTES de qualquer chamada (nada armado = fail-closed por construção). Exit 0 só com `autoMergeRequest === null && !isDraft`; imprime o JSON de status para o relatório.
- **Convention pin:** spec de convenção existente exige que a SKILL.md Fase 5 referencie o script (mecanismo classe 3). Entrada na config knip se marcado morto (família P6-G: specs não contam como usage).
- **Migration:** sem migration. **Access/Consent:** N/A.

## Fases verificáveis

1. **Dono** — helpers GraphQL em `github-api.mjs` + pins em `tests/unit/githubApi.unit.spec.ts` (status lido; draft; idempotência via read-first). `pnpm gate:fast`.
2. **Script + pin de convenção** — `testing-audit-disarm.mjs` (parseArgs no shape de `github-pr.mjs`; importa `dieWithLabel`).
3. **Fiação + registro** — reescrever Fase 5 da skill (1 invocação no passo que cria o PR; `--pr N` após cada push; fallback = draft automático + registro no relatório); changelog `docs/changelog/2026-08-25-audit-pass6-m909.md`; linha em `docs/GUARDRAILS.md` Ativos (origem #909, classe 3). `pnpm gate:fast`; push via `pnpm push`.

## Rabbit holes / Não escopo

- NÃO tocar `agent-pr-ready-automerge.yml`/`github-pr-automerge.mjs`.
- NÃO deletar `github-pr.mjs` (é P6-G, outra entrega).
- NÃO migrar o `gh run rerun` da Fase 4; NÃO re-fiar a react-audit.

## Riscos e mitigação

- Mutation de desarme em PR não armado → `ensureAutoMergeDisabled` só muta quando armado (idempotente).
- Token ausente → die antes de criar. Falha pós-criação → `--draft-on-failure` converte a draft (veto estrutural do safety-net → nunca mergeia).

## Aceite de engenharia

- [x] Aceite da intenção coberto (desarme atômico no passo de criação)
- [x] Invariantes (edita o dono `github-api.mjs`, não cria twin)
- [x] Testes: pins `githubApi.unit.spec.ts` + pin de convenção da fiação na skill

Self-score decision-quality: 5/5
