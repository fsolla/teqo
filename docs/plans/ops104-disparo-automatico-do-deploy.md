# OPS104 — Disparo automático do deploy pós-merge (staging automático, produção com review)

Status: rascunho
Atualizado em: 2026-09-14
Issue: #980
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~1 dia eng — um outcome verificável
Responsável: —

## Intenção

> _"lets improve our CI pipeline to autimatically initiate the deploy action, which will run verify and deploy staging automatically btu wait review for production deploy, every time that:_
> _- A PR merges to main and there's no deploy action already running. So it should automatically fire a deploy action from main's head._
> _- A deploy action has juust finished the staging deploy step and there's newer commits to main (head was updated). So it should automatically fire a new deploy run from main new head."_

Hoje publicar é ato manual (OPS71/OPS102): mergear em `main` não dispara nada, e se ninguém lembrar do dispatch o site fica no SHA antigo enquanto o merge parece entregue. O pedido tira o trabalho braçal mantendo os gates: o merge em `main` passa a ser o gatilho, o staging se mantém atualizado sozinho, e produção continua esperando o reviewer humano. A OPS102 escreveu "não voltar a ser deploy automático" como anti-goal; esta entrega supersede esse anti-goal com evidência de produto nova — automatiza-se o **início do run**, nunca a **aprovação de produção** nem o atalho do `verify`. Prioridade **P2** (recomendação no gate): é mudança de ops/CI, sem incidente em produção ou bloqueio de produto; o ganho é o pipeline se manter sozinho.

## Persona e fluxo

- **Persona / contexto:** o operador do deploy — hoje depende de lembrar do dispatch manual a cada merge; e quem mergeia (humanos e agentes) não vê que o site não foi publicado.
- **Job principal:** todo merge em `main` virar staging atualizado sem intervenção, e o humano decidir com calma quando promover a produção.
- **Fluxo desejado:** merge em `main` → run do deploy nasce sozinho no head → `verify` full → staging publica automático → se `main` andou no meio, um novo run nasce no head novo → o humano aprova o environment `production` do run que quiser → produção publica.
- **Anti-goals de produto:** nunca auto-aprovar/auto-publicar produção; nunca atalhar o `verify` full; nunca um segundo pipeline/script gêmeo; nunca tocar `ci-pr.yml`, o `verify` ou os guards de banco local; nunca reintroduzir o stale-run guard.

### Esboço de fluxo

```text
[merge em main] ── deploy ativo? ── sim → nada nasce (o run ativo decide)
                      │ não
                      ▼
   run nasce no head de main → verify full → deploy-staging (automático)
                      │  └─ main andou? → run novo nasce no head novo
                      ▼
   produção aguarda reviewer → aprovado → deploy-production = publicado
```

## Objetivo e aceite

- Merge em `main` sem deploy ativo → run do deploy nasce sozinho no SHA do head de `main`; ninguém precisa lembrar do dispatch (que segue disponível como escape manual).
- Merge durante verify/staging → ao terminar o staging, um run novo nasce no head novo de `main`; staging não fica velho em silêncio.
- Merge enquanto produção aguarda review → um run novo nasce no head (o pendente aguardando aprovação não bloqueia); os dois ficam pendentes e o humano aprova qual promover — produção continua só com aprovação humana.
- Verde falso não existe: nada publica sem `verify` full verde; run vermelho = humano resolve (sem retry/auto-heal).

## Sobreposição com trabalho entregue

- OPS102 (removeu o stale-run guard) e OPS103 (staging + aprovações separadas) permanecem válidos: esta entrega muda **quem inicia o run**, não o fluxo dentro do `deploy.yml` (`verify` → staging → review → produção, script, flock e "already deployed" intocados); o que nunca volta é o publish sem reviewer.

## Dados (intenção)

- **Vou apresentar dados?** Não — N/A: sem superfície de dados para usuário; a evidência são os logs do Actions (run que nasce sozinho, ordem dos jobs, approval pendente).
- **Decisões desbloqueadas:** operador decide qual run promover a produção; ninguém decide "quando lembrar de disparar".
- **Forma:** N/A — nada a apresentar.

## Dados da decisão (literais)

- ID reservado **OPS104**; kind **chore**; sem UI (Impeccable A).
- Trigger 1: `push` na branch `main` no próprio `.github/workflows/deploy.yml`, mantendo `workflow_dispatch` (sem workflow gêmeo); dispatch/ref `main`; guard de "deploy ativo" pula o run.
- Run "ativo" (decidido no gate 2026-09-14): só `queued` + `in_progress` contam como ativo no guard do trigger 1; run `waiting` (aguardando review de produção) **não** bloqueia — um merge nessa janela dispara run novo e os dois ficam pendentes, cabendo ao humano aprovar qual promover.
- Trigger 2: job hosted após `deploy-staging` (fora do grupo `deploy-homeserver`) compara o head de `main` com o SHA do run e re-dispatcha `deploy.yml` se houver commit novo; nunca no runner self-hosted.
- Permissões: novos jobs com `actions: read` (listar runs) e `actions: write` (dispatch); `contents: read` mantido; **nenhum secret novo** (o `GITHUB_TOKEN` nativo dispatcha — `workflow_dispatch` é a exceção documentada da anti-recursão).
- Environments intocados: `staging` sem reviewer; `production` com required reviewer (`fsolla`) — config do repo, não do YAML; `concurrency: deploy-homeserver` intocado (`cancel-in-progress: false`, `queue: max`) e só os jobs de deploy entram nele.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/deploy.yml` (trigger + job de preflight + job de requeue) e `tests/unit/ciSkipInvariants.unit.spec.ts` (o pin l.111–122 troca "sem `push:`" por "push em `main` + guard de run ativo + `workflow_dispatch` mantido"; l.124–150 segue additive-safe); docs vivos a realinhar: `docs/ops/teqo-1313-deploy.md` (l.3–8, l.12, l.225), `docs/AGENT-OPS.md` (l.3, l.19, l.82, l.111), `AGENTS-infra.md`, `AGENTS.md` (l.15), `README.md` (l.12, l.17), `.agents/rules/agent-pr-workflow.mdc` (l.64), `scripts/issue-transition-on-merge.mjs` (l.74).
- **Precedente a olhar:** `issue-done-on-main-merge.yml` (evento + recuperação manual), `agent-pr-ready-automerge.yml` (nota de anti-recursão do token), `scripts/lib/github-api.mjs` (`workflowDispatch`), `scripts/deploy-homeserver.sh` (idempotência "already deployed" — re-dispatch do mesmo SHA sai verde sem rebuild).
- **Risco de acoplamento:** o fluxo verify→staging→review→produção, o script e o flock não mudam; self-hosted continua exclusivo dos jobs de deploy; nenhum run automático alcança o homeserver sem `verify` verde; `tests/unit/deployScript.unit.spec.ts` não muda.

## Dependências

- Nenhuma.

## Fora de escopo

- Auto-approve do environment `production` e qualquer forma de deploy automático do publish (destino: nunca) — só o início do run é automático.
- Retry/auto-heal de `verify` vermelho e cancelamento automático de runs antigos (decidido no gate: ambos pendentes; nada publica sem merge novo ou dispatch).
- Mexer em `ci-pr.yml`, no job `verify`, nos guards de banco local, em secrets ou na proteção de branch.

## Rabbit holes de produto

- **"Já que automatiza o start, automatiza o approve."** Atalho no `production` destrói o único gate que valida o SHA em produção. **Corte:** produção só publica com reviewer; approve automático não existe neste item.
- **"Se o verify falhar, tenta de novo."** Auto-retry mascara regressão e pode publicar SHA que não passou. **Corte:** vermelho = nada publica; o escape é merge novo ou dispatch manual.
- **"Um dispatcher separado é mais limpo."** Workflow gêmeo cria drift e um lugar a mais onde o run "ativo" escapa do guard. **Corte:** o dono é o `deploy.yml`; no máximo um job hosted de requeue dentro dele.

## Questões em aberto (produto)

- **Run parado no review de produção conta como "ativo"?** **Decidido no gate (2026-09-14): B** — só `queued`/`in_progress` contam; `waiting` não bloqueia, um merge na janela dispara run novo (dois pendentes, humano aprova qual promover).
- **Run novo nasce enquanto um antigo aguarda review: e o antigo?** **Decidido no gate (2026-09-14): A** — ambos ficam pendentes, o operador aprova o mais novo e ignora/cancela o antigo; nenhuma automação destrutiva; o risco fora-de-ordem fica no runbook (OPS102 já o aceitou documentado).
- **Onde mora o trigger 1?** **Decidido no gate (2026-09-14): A** — `push` no próprio `deploy.yml` + job de preflight que pula se já há deploy ativo; um dono só; o pin unitário passa a testar o guard em vez de proibir o `push`.
- **Onde mora o trigger 2?** **Decidido no gate (2026-09-14): A** — job hosted de requeue após `deploy-staging` (lê head de `main` vs SHA do run); imediato e barato; o job **não** entra no `deploy-homeserver` (um job aguardando approval não pode bloquear o requeue).
- **Guardrail de falha:** **Decidido no gate (2026-09-14): A** — sem retry/auto-heal: `verify` vermelho = nada publica até merge novo ou dispatch manual.

## Referências

- GitHub Issue #— (a registrar via `pnpm agent:register`)
- `docs/plans/ops102-deploy-manual-sem-stale-guard.md` — anti-goal superseded; `docs/plans/ops103-staging-homeserver.md` — fluxo atual (verify único, aprovações separadas)
- `.github/workflows/deploy.yml` — trigger (l.44–47), jobs e concurrency (l.161–212)
- `tests/unit/ciSkipInvariants.unit.spec.ts` — pins do manual-only (l.111–122) e do chain (l.124–150); `tests/unit/deployScript.unit.spec.ts` — script (não muda)
- `docs/ops/teqo-1313-deploy.md` — "Gatilho e fluxo" (l.10–51) e "Falhas conhecidas" (l.225, coluna de gatilho de revisita)
- `docs/AGENT-OPS.md`, `AGENTS-infra.md`, `AGENTS.md`, `README.md`, `.agents/rules/agent-pr-workflow.mdc`, `scripts/issue-transition-on-merge.mjs` — citações do deploy manual a realinhar
