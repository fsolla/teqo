# OPS106 — Falha do verify dispara agente autônomo de desbloqueio (single-flight)

Status: rascunho
Atualizado em: 2026-09-14
Issue: #995
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng para a fatia mínima (disparo + single-flight + guardrails, sem dashboard)
Responsável: —

## Intenção

Hoje, quando o job `verify` do deploy fica vermelho, o deploy simplesmente para: nada chega a staging nem a produção, e o desbloqueio depende de alguém notar e rodar uma sessão manual de bug-fix. Isso já custou sessões manuais (postmortems 2026-09-12/13) e deixa a entrega refém de alguém estar disponível. Quero que a própria falha dispare um agente autônomo que diagnostica, corrige e abre PR — o mesmo tipo de agente que eu ligo na mão com `pnpm worktree fix` —, com a garantia de que nunca existam dois desses ao mesmo tempo e de que falhas repetidas enquanto um já roda não multipliquem agentes. A pergunta que quero responder no gate: isso roda no homeserver ou é pesado demais para a máquina?

## Persona e fluxo

- **Persona / contexto:** eu (mantenedor), de qualquer lugar; o deploy está bloqueado e não quero descobrir isso horas depois.
- **Job principal:** garantir que uma falha do `verify` vire correção em andamento sozinha, sem EU iniciar a sessão.
- **Fluxo desejado:** `verify` falha → em minutos vejo um registro visível (Issue/PR) linkando o run vermelho e um único agente trabalhando → o agente corrige, prova verde e abre PR → o PR segue o gate normal de CI/auto-merge. Se já existe agente ativo, a nova falha NÃO dispara outro.
- **Anti-goals de produto:** virar esteira de auto-heal de qualquer job; aprovar produção sozinho; ressuscitar o pool de agentes morto no OPS65; atender falha de PR-CI (só o `verify` do deploy interessa).

## Objetivo e aceite

- Uma falha do job `verify` do deploy resulta em um agente de desbloqueio em execução sem intervenção humana, com registro visível linkando o run vermelho.
- Em nenhum momento existem dois agentes de desbloqueio ativos; falhas repetidas com agente ativo não disparam novos agentes (não enfileiram).
- O agente tem o mesmo contexto de um `worktree fix`: opencode, skill `/bug-fix`, worktree do repo, banco de teste local, MCPs e AGENTS.
- Guardrails duros: nunca toca banco/env de produção ou staging; se o alvo de banco não for local `*_test`/`teqo_wt*`, falha fechado; nunca auto-aprova produção; tentativas/tempo limitados (sem loop infinito); todo passo rastreável até o run vermelho.
- Nenhum auto-retry do deploy é introduzido (anti-goal do OPS104 permanece).

## Dados (intenção)

- **Vou apresentar dados?** Não — infraestrutura, sem métrica de produto.
- **Decisões desbloqueadas:** N/A — não há decisão de negócio; é encanamento operacional.
- **Forma:** N/A — sem superfície de dados neste item.

## Dados da decisão (literais)

- Gatilho: falha do job `verify` de `.github/workflows/deploy.yml` (só ele).
- O agente roda no homeserver (runner self-hosted); no máximo 1 agente de desbloqueio ativo (single-flight); falha com agente ativo não enfileira.
- Registro visível do disparo (Issue/PR linkando o run vermelho) é o token do single-flight.
- Entrega: PR Ready com auto-merge nativo — mesmo contrato do `worktree fix`.
- Contexto do agente = `worktree fix`: opencode + `/bug-fix` + worktree + banco local `*_test`/`teqo_wt*` + MCPs/AGENTS; modelo default `deepseek/deepseek-flash` com preset sobrescrevível.
- Guardrail de banco: alvo tem que ser local `*_test`/`teqo_wt*`; caso contrário fail-closed. Nunca `teqo_1313`/`teqo_staging`.
- Sem auto-retry do deploy; sem auto-approve de production.
- N/A — nomes de workflow/estrutura de lock/rotas ficam para o plano de implementação.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/deploy.yml` (job `verify` como fonte do gatilho), `scripts/` (família `worktree`/`deploy`), `docs/ops/teqo-1313-deploy.md`.
- **Precedente a olhar:** `flock` do `scripts/deploy-homeserver.sh` (single-flight), `pnpm worktree fix` (`scripts/worktree.mjs` → `scripts/lib/worktree.mjs`), dispatch pós-merge do OPS104.
- **Risco de acoplamento:** os guards de banco atuais checam host e passariam por um proxy de prod em `127.0.0.1:5433`; rodar no homeserver aproxima o agente de segredos e bancos de prod/staging — o fail-closed de banco não pode depender só do host.

## Dependências

- Nenhuma dura. Suaves: #882 (flakes de e2e em main) e #849 (guard de DB) podem amplificar falso positivo do gatilho e afrouxar o guardrail, mas não bloqueiam.
- Anteriores relevantes: OPS104 (deploy automático pós-merge) e OPS65 (pool morto — precedente do que não fazer).

## Fora de escopo

- Auto-retry/auto-heal de `preflight`, staging, produção ou `requeue`; auto-approve de production.
- Ressurreição do pool de agentes (OPS65) ou de tick agendado.
- Falhas de PR-CI e flake de main (seguem em #882/#906/#849/#923).
- Dashboard/painel de agentes e telemetria de causa.

## Rabbit holes de produto

- **"Já que dispara, deixa tentar até passar".** Vira loop de correção automática e queima o disjuntor do deploy. **Corte neste item:** uma tentativa por run vermelha, sem re-disparo automático do deploy.
- **"Agente resolve qualquer job vermelho".** Vira auto-heal geral, incluindo produção. **Corte neste item:** só `verify`.
- **"Painel de observabilidade dos agentes".** Dashboard de vaidade. **Corte neste item:** registro visível linkando o run basta.

## Questões em aberto (produto)

- **Onde o agente roda?** **Decidido no gate (2026-09-14): A** — job no runner self-hosted do homeserver, com guardrails fail-closed; disponibilidade é o ponto de desbloquear o deploy, e o runner já vive na máquina dos deploys. Custo conhecido: máquina 8c/16GB apertada (um agente por vez, sem paralelismo) e opencode autenticado + banco de teste local precisam existir lá.
- **Escopo do gatilho?** **Decidido no gate (2026-09-14): A** — só falha do job `verify`; um agente por run/commit vermelho; falha com agente ativo **não enfileira** (skip).
- **Autonomia/merge?** **Decidido no gate (2026-09-14): A** — mesmo contrato do `worktree fix` (PR Ready + auto-merge nativo quando o required check fica verde); a correção chega em main pelo gate normal.
- **Visibilidade/single-flight?** **Decidido no gate (2026-09-14): A** — registro visível (Issue/PR do disparo linkando o run vermelho); o estado aberto é o token do single-flight e o humano enxerga o agente trabalhando.
- **Ferramental/contexto?** **Decidido no gate (2026-09-14): A** — idêntico ao `worktree fix` (opencode + `/bug-fix` + worktree + DB de teste + MCPs; default `deepseek/deepseek-flash` com override por preset), para que "funciona no fix" seja o mesmo "funciona no desbloqueio".

## Referências

- GitHub Issue #995
- `.github/workflows/deploy.yml` — jobs e gatilho; `docs/ops/teqo-1313-deploy.md` (runbook, homeserver, proxies de DB)
- `scripts/worktree.mjs`, `scripts/lib/worktree.mjs` (`pnpm worktree fix`), `scripts/deploy-homeserver.sh` (flock), `.agents/skills/bug-fix/`
- `docs/plans/ops65-ci-main-janela-30min-e-matar-pool.md` (por que o pool morreu), `docs/AGENT-OPS.md`
