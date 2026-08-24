# Sweep pós-cutover OPS76: textos vivos ainda apontam o tracker ao Forgejo

Status: rascunho
Atualizado em: 2026-08-24
Issue: registrada via `agent:register` (OPS91)
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A
Appetite: ~0,5 dia, só edição de texto/prosa
Responsável: —

## Intenção

O cutover GitHub (OPS71 + OPS76, 2026-08) tornou o GitHub o host único (Actions + tracker de Issues); o Forgejo ficou congelado e seu tracker inativo. O OPS76 atualizou AGENTS.md/AGENT-OPS e o OPS71 Fase 2 removeu os arquivos Forgejo-era, mas uma varredura de superfícies vivas (feita na sessão OPS89, #836) provou que vários textos vivos ainda instruem leitura/escrita no tracker do Forgejo — um agente novo que siga essas instruções erra o host.

## Evidência (grep da sessão OPS89)

- `.agents/rules/agent-pr-workflow.mdc:8` — "The ISSUE TRACKER stays on the Forgejo — GitHub is only the Actions host" (regra alwaysApply com a realidade invertida).
- `.agents/skills/work-issue/execution-pipeline.md:69,75-76` — diz que o flip pós-merge escreve "no Forgejo" via `FORGEJO_API_TOKEN`; o real (`scripts/issue-transition-on-merge.mjs`, OPS76) escreve na API do GitHub com `GITHUB_TOKEN`.
- `.agents/skills/project-status/SKILL.md:25` — "leia a Issue via API do Forgejo".
- `.agents/skills/engineering-audit/SKILL.md:69` — "leitura da Issue via API do Forgejo/MCP".
- `.agents/skills/plan-issue/SKILL.md:23` — "Nada no Forgejo antes do gate" (shorthand do tracker).
- `docs/roadmap.md:5` — ponteiro canônico de Issues para `git.solla.dev/fsolla/teqo/issues`.

## Objetivo e aceite

- Todos os textos vivos acima apontam para o GitHub (`github.com/fsolla/teqo/issues`) como tracker único.
- Nenhuma instrução viva manda usar `FORGEJO_API_TOKEN`/API do Forgejo para o fluxo atual.
- Menções históricas corretas permanecem intactas (ver Fora de escopo).

## Direção no codebase

Edição de prosa apenas — sem código, sem testes novos. Cada arquivo é dono da própria frase; corrigir in place.

## Fora de escopo / Explicitamente fora

- Rename de pureza `scripts/lib/agent-forgejo.mjs` (+~15 imports com nome "Forgejo") — score 1, churn alto, zero ganho funcional.
- Menções históricas CORRETAS: runbook de rollback (`docs/ops/teqo-1313-deploy.md`), backup mirror OPS76-FOLLOWUP, marcações "legado/removido/congelado" em AGENT-OPS/AGENT-pr-workflow (:60,:85), skill `agent-pool` dormente.
- Docs congelados (`docs/plans/*`, `docs/changelog/*`, `docs/CHANGELOG-AGENTS.md`).

## Rabbit holes

- Não reescrever histórico de decisões (OPS50/OPS64/OPS71 citados como história ficam).
- Não tocar nos scripts que já falam GitHub (`github-api.mjs`, `issue-transition-on-merge.mjs`) — já corretos.

## Já resolvido no simplify/critique (não reabrir)

- `worktree-next-issue/SKILL.md` ("a skill lê o resto do Forgejo" → GitHub) — corrigido na sessão OPS89 (#836), linha tocada pela entrega.

## Riscos

- Baixo: mudanças são prosa; gates de lint/format cobrem os `.md` versionados.
