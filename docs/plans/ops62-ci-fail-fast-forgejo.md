---
id: OPS62
depends: []
serializes: ['.forgejo/workflows/ci-pr.yml', '.forgejo/workflows/ci.yml']
priority: P2
model: composer-2.5
---

# OPS62 — CI: cancelar jobs irmãos quando um job falha (fail-fast no Forgejo runner)

Status: rascunho
Atualizado em: 2026-08-18
Issue: #59
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng (inclui upgrade do Forgejo no homeserver + watchdog)
Responsável: —

## Intenção

O CI roda no nosso próprio runner (Forgejo + runner self-hosted, OPS50/OPS53). Hoje, quando um job falha, os irmãos continuam rodando até o fim — o run só "termina" quando o último job acaba, e o `checks` (gate) só decide no fim. No runner compartilhado isso ocupa a fila (atrasa checks de outros PRs) e o agente espera um veredito que já estava decidido no primeiro vermelho. Queremos fail-fast: **qualquer job** com falha (lint, format, e2e, o que for) → cancela o resto do run imediatamente, libera o runner e o agente recupera para consertar e tentar de novo.

**Decisão (gate 2026-08-18):** fazer o upgrade do Forgejo no homeserver para uma versão com a API de cancel de runs e entregar o fail-fast intra-run completo via watchdog — não ficar na mitigação parcial.

## Persona e fluxo

- **Persona / contexto:** agente (ou humano) com um PR aberto no CI; um job falhou (ex.: lint) e os demais seguem rodando.
- **Job principal:** saber o veredito e liberar o runner o quanto antes — sem pagar o tempo de jobs que não podem mais mudar o resultado.
- **Fluxo desejado:**
  1. Push → CI inicia os jobs do run (fase 1 em paralelo).
  2. Um job falha — **qualquer um** (lint, format, typecheck, unit, e2e, …).
  3. O run cancela todos os irmãos ainda em execução (intra-run fail-fast).
  4. `checks` fica vermelho sem esperar o fim dos demais; o agente conserta o job que falhou.
  5. Novo push já substitui o run anterior (comportamento nativo existente) e o ciclo repete.
- **Anti-goals de produto:**
  - Não perder diagnóstico: cancelar jobs não pode apagar logs do que já rodou (o conserto precisa deles).
  - Não mudar o que o CI verifica (mesmos jobs, mesma cascata fase 1→2, `checks` continua o gate).
  - Não criar gate/bypass novo — só o `--no-verify` documentado.

## Objetivo e aceite

- Um run de PR com **qualquer job vermelho** (lint, format, typecheck, knip, cycles, unit, int, build, e2e, docs-guards) cancela os irmãos em execução (fail-fast intra-run) — medido por: run com falha termina logo após o primeiro job vermelho, sem esperar o último job natural.
- A suíte verificada não muda: mesmos jobs, mesma cascata, `checks` como gate único.
- Logs dos jobs que já rodaram permanecem consultáveis após o cancelamento.
- O Forgejo do homeserver roda uma versão com a API de cancel de runs (`GET /actions/runs/{run}/jobs` + `POST /actions/runs/{run}/cancel`), sem regressão nos workflows existentes (OPS50 port, automerge, pool, deploy OPS53).

## Dados (intenção)

Dados: N/A — chore de DX/processo; sem métrica de produto. (Ganho: tempo de veredito e ocupação da fila do runner — medição fica a critério da execução.)

## Direção no codebase (hipótese)

- **Áreas prováveis:** infra do Forgejo no homeserver (upgrade de versão — domínio OPS50/OPS51; fora do repo, com runbook próprio); um watchdog (job ou script) que consulta status de **todos os jobs** do run e cancela o run via API na primeira falha — aplicável a ci-pr.yml e ci.yml; `.forgejo/workflows/ci-pr.yml` e `ci.yml` (matrix e2e hoje com `fail-fast: false` deliberado — OPS34; cascade fase 2 já pula por `needs` + `if`).
- **Precedente a olhar:** `docs/plans/ops50-ci-github-para-forgejo*.md` (decisão "Forgejo has no cancel-run plumbing; job timeouts cover that role" — este item a substitui), `docs/plans/ci-e2e-paralelizar-job*.md` (shards), `docs/plans/ops61-forgejo-contratos-merge-labels-e-branch-protection.md` (contrato de token: GITHUB_TOKEN 403 → PAT).
- **Risco de acoplamento:** cancelar via API exige token com permissão de escrita em actions — contrato de OPS61 diz que o token nativo 403 em API do Forgejo; provável PAT (`POOL_GITHUB_TOKEN` como precedente). Upgrade do Forgejo é infra de produção no homeserver: janela/risco, verificação dos workflows existentes após o upgrade (automerge, pool, deploy).

**Contexto verificado (evidência para o gate):**
- Forgejo deployado: `9.0.3+gitea-1.22.0` — sem API de cancel: `GET/POST /actions/runs/{run}/cancel` e `GET /actions/runs/{run}/jobs` dão 404; só existe `GET /actions/tasks` (status por job do run). A rota web `POST /actions/runs/{run}/cancel` existe mas exige sessão + CSRF (retorna "Invalid CSRF token") — inutilizável de job com token.
- Forgejo atual (code.forgejo.org) expõe `GET /actions/runs/{run_id}/jobs` + `POST /actions/runs/{run_id}/cancel` → watchdog viável **após upgrade**.
- Novo push/PR sync **já cancela o run anterior do mesmo workflow** (nativo; observado statuses `cancelled` nos tasks) — não cobre intra-run, mas elimina o desperdício do ciclo consertar→push.
- `concurrency:` não resolve: mesmo em Forgejo novo, a config não afeta jobs dentro do mesmo workflow (e cancelar run anterior já é nativo).
- Cascade fase 2 já funciona na prática (jobs `skipped` após falha de fase 1 — observado em runs reais).

## Dependências

- Nenhuma dura. Soft: contrato de token de OPS61 (PAT, não GITHUB_TOKEN) para o watchdog.

## Fora de escopo

- Mudar a suíte verificada (jobs/cascata/`checks`) → CI atual é o verificado e fica como está.
- Migrar o Forgejo de volta para o GitHub ou outra hospedagem (o upgrade é no homeserver atual).
- Mexer no deploy (OPS53) ou na política "Dono do PR, dono do CI".

## Rabbit holes de produto

- **"Instalo a action de fail-fast do GitHub".** Não roda no Forgejo (OPS50). **Corte:** watchdog com API nativa do Forgejo pós-upgrade.
- **"Aproveito o upgrade para mudar mais coisa no Forgejo".** Upgrade de produção já tem risco próprio. **Corte:** só a versão mínima necessária para a API de cancel + verificação dos workflows existentes.
- **"Cancelar tudo, até os logs".** Job cancelado sem log quebra o conserto. **Corte:** cancelamento preserva o que já rodou (padrão das fail-fast actions).
- **"Watchdog cancela só fase 2 / só e2e".** O pedido é fail-fast de **qualquer** job — lint vermelho também cancela o resto. **Corte:** o watchdog observa todos os jobs do run, sem filtro de fase.

## Questões em aberto (produto)

- **Fail-fast total (upgrade + watchdog) ou mitigação parcial sem infra?** **Decidido no gate (2026-08-18):** upgrade do Forgejo + watchdog — fail-fast intra-run completo, qualquer job. Mitigação parcial (e2e `fail-fast: true` + cascade) fica como fallback documentado, não como destino.
- **Perder os logs do shard 2 de e2e quando o run é cancelado?** **Decidido no gate:** aceitar — o spec que falhou é conhecido no report do shard 1 e o agente reroda localmente; o cancelamento preserva logs do que já rodou.

## Referências

- `.forgejo/workflows/ci-pr.yml` / `ci.yml` — alvo do fail-fast; cascade fase 2; comentário OPS50
- `docs/plans/ops50-ci-github-para-forgejo.md` / `-impl.md` — decisão "no cancel-run plumbing"
- `docs/plans/ci-e2e-paralelizar-job.md` — shards e `fail-fast: false` deliberado
- `docs/plans/ops61-forgejo-contratos-merge-labels-e-branch-protection.md` — contrato de token (GITHUB_TOKEN 403 → PAT `POOL_GITHUB_TOKEN`)
- `docs/AGENT-OPS.md` — política "Dono do PR, dono do CI"