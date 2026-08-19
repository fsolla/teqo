---
id: OPS71
depends: []
serializes:
  [
    '.github/workflows/',
    '.forgejo/workflows/',
    'docs/AGENT-OPS.md',
    '.agents/skills/work-issue/',
    '.agents/rules/agent-pr-workflow.mdc',
  ]
priority: P1
model: cursor-grok-4.5-high
---

# CI/PR do Forgejo Actions de volta para o GitHub Actions — tracker de Issues permanece no Forgejo

Status: rascunho
Atualizado em: 2026-08-19
Issue: #97
Priority: P1
Model: cursor-grok-4.5-high
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~2–3 dias eng; um outcome verificável (CI verde no GitHub, tracker vivo no Forgejo, deploy preservado)
Responsável: —

## Intenção

O Forgejo Runner roda na workstation (Ryzen 7 7800X3D) e **está pedindo muito
da máquina**: a suíte inteira (build + int + e2e) roda localmente a cada PR e
na janela de main, disputando CPU com o dev server, o Docker local, o browser
e os worktrees paralelos. O OPS65 já tentou mitigar (janela de 30 min + matar
o pool), mas o custo por PR continua pesado — e ele cresce com o número de PRs
abertos, que é exatamente o que queremos aumentar.

A decisão: **migrar o CI de volta para o GitHub Actions** (runners hosted,
custo zero na workstation, um runner por PR — PRs avançam em paralelo de
verdade). **O tracker de Issues permanece no Forgejo local** (`git.solla.dev`,
já público via Cloudflare — confirmado HTTP 200 hoje): o CI no GitHub fala com
o tracker por API (`FORGEJO_API_TOKEN` + `FORGEJO_API_URL`), como os scripts
locais já fazem. Não é voltar ao mundo pré-OPS50 — é um novo meio-termo
deliberado: **código/PR/CI no GitHub, Issues/labels no Forgejo**.

Mantemos a **estrutura de verificações** construída nos OPS61/OPS62/OPS64
(job único `checks` sequencial, guards no início, skips de escopo via
`ci-scope.mjs`, rollup `CI (PR) / checks` como gate de merge) — o que muda é o
host onde ela roda. E a política de e2e muda junto (ver OPS72: e2e local
apenas para os testes afetados, não full no CI de PR). **O deploy deixa de ser
automático** (OPS53/OPS65 viram histórico): vira uma **action manual
(`workflow_dispatch`)** que roda **todas as verificações full** antes de
publicar — ver "Questões em aberto" (questão 1) e o fluxo abaixo.

## Persona e fluxo

- **Persona / contexto:** o dono da máquina (dev/coordenador do repo) rodando
  dev local, worktrees e múltiplos PRs; os agentes (humanos e pool) que abrem
  PRs e acompanham o CI até o merge; o coordenador que dispara o deploy quando
  decide publicar.
- **Job principal:** cada PR custa ~0 da workstation; o CI roda no GitHub em
  paralelo para todos os PRs; o merge continua automático e seguro; publicar
  em produção é uma ação manual com verificação full.
- **Fluxo desejado:**
  1. Agente claima Issue no Forgejo (igual hoje — tracker intocado).
  2. Worktree/branch local; `pnpm push` para o **GitHub**; PR aberto no
     **GitHub** (Ready, base `main`, `Closes #N`).
  3. GitHub Actions roda o job único `checks` (mesma cascata de hoje, com e2e
     apenas nas áreas afetadas — OPS72) e posta o status no PR.
  4. Merge automático quando o rollup `CI (PR) / checks` fica verde
     (auto-merge nativo ou safety net equivalente).
  5. Pós-merge: Issue flipada para `done`/`in-prod` no **Forgejo** (workflow
     GitHub Actions → API do Forgejo); `Related #N` promove `blocked` →
     `ready` no Forgejo.
  6. Deploy **manual** (workflow_dispatch): rodar verificações full → o job
     `deploy` executa `scripts/deploy-homeserver.sh` no homeserver (runner
     self-hosted lá, ou via SSH da workstation como fallback — questão 1).
- **Anti-goals de produto:** NÃO migrar o tracker (Issues/labels/claims ficam
  no Forgejo); NÃO re-introduzir jobs paralelos com matrix no CI (a estrutura
  de job único do OPS62 vale no GitHub também); NÃO tocar em schema/migrations
  de produto; NÃO re-publicar Vercel ou qualquer segundo deploy; deploy NÃO
  volta a ser automático a cada merge.

## Objetivo e aceite

- O CI de PR (`ci-pr.yml`) roda no GitHub Actions com a **mesma cascata de
  verificações** de hoje (guards → lint → format → typecheck → knip → cycles →
  unit → int → build → e2e **selected/afetado**, com skips de escopo), como
  **um job único `checks`**.
- O **deploy** vira uma action **manual** (`workflow_dispatch` no GitHub
  Actions) com **dois jobs no mesmo workflow**: `verify` (hosted
  `ubuntu-latest`, suíte **full** incl. e2e full) → `deploy`
  (`needs: [verify]`, `runs-on: [self-hosted, homeserver]` — runner do GitHub
  no homeserver executa `scripts/deploy-homeserver.sh` localmente, sem SSH).
  O hosted nunca toca o homeserver; o self-hosted não conta minutos hosted.
  Sem verificador de main (`ci.yml`) — só o pre-deploy roda full
  (decisão do usuário, gate 2026-08-19).
- O rollup `CI (PR) / checks` continua sendo o required check de `main` e o
  gate do merge automático (agora no GitHub).
- PRs são abertas no GitHub; agentes acompanham o CI até o merge em `main`
  (skills atualizadas — work-issue/agent-work-issue/execution-pipeline,
  AGENT-OPS, agent-pr-workflow).
- As Issues **não migram**: labels, claims, `pnpm issue`/`agent:*` continuam
  falando com o Forgejo; flips pós-merge funcionam via API (verificado: o
  Forgejo é alcançável publicamente).
- A workstation não roda mais a suíte de CI; o Forgejo runner é desligado.
- Deploy manual com verificação full preservado (ver questão 1).
- Um repo GitHub sincronizado (histórico atual de `main` presente — hoje o
  repo GitHub está parado em 2026-08-13).

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** nenhuma KPI nova. (O "custo da workstation" é
  observável pela própria máquina; não precisa de métrica nova.)

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `.github/workflows/` (novo): `ci-pr.yml` (job único `checks`, e2e
    selected — OPS72), `deploy.yml` (**`workflow_dispatch` manual, dois jobs:
    `verify` hosted full → `deploy` `runs-on: [self-hosted, homeserver]`**),
    `agent-pr-ready-automerge.yml` (safety net), `issue-done-on-main-merge.yml`,
    `plan-issue-ready-on-main-merge.yml`, `archive-cursor-agent.yml`. Sem
    `ci.yml` (verificador de main eliminado — decisão do gate).
  - `scripts/`: adaptar `forgejo-pr-automerge.mjs` (ou substituir por
    auto-merge nativo do GitHub / API `merge_when_checks_succeed`),
    `forgejo-issue-transition.mjs` e `agent-promote-related-on-merge.mjs`
    (leem o PR — agora do GitHub — e flipam no Forgejo),
    `forgejo-dispatch.mjs` → `gh workflow run` (ou API GitHub), novos helpers
    GitHub (`scripts/lib/`); `configure-branch-protection.mjs` → proteção no
    GitHub.
  - `scripts/deploy-homeserver.sh` — revisar o modo de invocação (runner no
    homeserver: sem `ssh`, execução local; via workstation: SSH mantido) e o
    `TEQO_REPO_URL` (hoje `localhost:3000` do Forgejo no homeserver — com o
    código no GitHub, apontar para o GitHub ou manter o espelho local).
  - `.agents/skills/**`, `.agents/rules/agent-pr-workflow.mdc`,
    `docs/AGENT-OPS.md`, `AGENTS.md` — o paradigma de PR passa a apontar para
    o GitHub (PR/CI), tracker Forgejo.
- **Precedente a olhar:** `docs/plans/ops50-ci-github-para-forgejo.md` (o
  espelho inverso — o que foi migrado para o Forgejo e como), `ops62`,
  `ops65`, `ops61` (branch protection/contratos de merge), `docs/ops/teqo-1313-deploy.md`,
  e o projeto **`infra-solla`** (ver "Nota para o executor").
- **Risco de acoplamento:** o deploy (OPS53) hoje depende do runner local da
  workstation (SSH para o homeserver) e o build de produção **não pode sair do
  homeserver** (migrate no banco de prod antes do build — OPS66, estático na
  rede do compose, registry local `localhost:5000`). O GitHub hosted não
  alcança nada disso — por isso o job `deploy` roda no runner self-hosted do
  homeserver (decisão do gate). O `ci-classify-production.mjs` (gate OPS65)
  morre com o deploy manual (sem janela automática) — pode ser removido ou
  reutilizado no dispatch como check informativo de "produção mudou desde o
  último deploy".

## Nota para o executor — projeto `infra-solla`

Para detalhes do homeserver (stack, registry, tunel, runner, rede, `ssh
homeserver` via tailnet), **leia o projeto `infra-solla`** (fora deste repo):
`STATE.md` e `plano-infra-final.md` §"Arquitetura de deploy". É a fonte usada
pelo OPS53 para corrigir a premissa de onde rodava o runner, e é onde o
passo manual "instalar o runner self-hosted do GitHub no homeserver" deve ser
registrado/anotado. Não invente topologia: confirme lá (homeserver 8c/16GB,
laptop; `~/stack/docker-compose.yml`; registry `localhost:5000` com htpasswd;
cloudflared; `ssh homeserver` pela tailnet) antes de decidir como o runner
self-hosted se instala e como o `deploy.yml` o alcança.

## Dependências

- OPS72 (e2e local afetado + CI de PR sem e2e full) — **serializa com este
  item** (ambos tocam `ci-pr.yml` e a skill work-issue); OPS72 declara
  `depends: [OPS71]` para rodar depois e evitar rebase cruzado. Decisão de
  gate: CI de PR mantém e2e **selected** (afetado) — confirmado.
- #85 (OPS70, gate skipped no schedule do Forgejo) — **absorvida**: com o
  deploy manual, o gate de schedule deixa de existir; fechar como superada
  quando este item mergear.
- #87 (OPS70, guard de importMap) — independente, permanece na fila; o
  executor dela deve mirar os workflows novos do GitHub.
- #72 (S3-FOLLOWUP, e2e local `--no-deps` colide no seedTestUser) — não é
  duplicada; o OPS72 (e2e local afetado) cita a limitação existente.

## Fora de escopo

- Migrar Issues/labels do Forgejo (anti-goal explícito).
- Mudar a estrutura de verificações (job único, guards, skips) — preservada.
- Alterar o `e2e-affected`/`ci-scope` em si — mecânica já existe; só muda
  onde/quando roda (OPS72).
- Repositório do Forgejo: continua como tracker; se virar mirror read-only de
  main ou parar de receber push — decisão do impl, mas nunca fecha o tracker.
- Upgrade do Forgejo no homeserver (decisão de infra separada).

## Rabbit holes de produto

- **Re-engenharia do deploy.** O job `deploy` dependia do runner local; sem
  decisão, o "preservar deploy" vira um projeto de infra. **Corte neste item:**
  uma das opções da questão 1, fechada no gate, sem inventar terceiro caminho.
- **Reescrever o contrato de merge.** Auto-merge do GitHub é nativo, mas o
  wait-por-checks/rollup do OPS64 foi calibrado para o Forgejo; portar
  errado = merge com CI vermelho. **Corte:** usar o mecanismo nativo do GitHub
  (o rollup `CI (PR) / checks` vira o required check lá) e pin unit-testado no
  script, sem reimplementar semáforos novos.
- **"Já que estamos no GitHub, migra as Issues também".** O usuário foi
  explícito: tracker fica no Forgejo. **Corte:** qualquer proposta de migrar
  o tracker é rejeitada neste item.

## Questões em aberto (produto)

- **Como fica o deploy?** **Decisão do usuário (gate 2026-08-19):** deploy
  **manual** via `workflow_dispatch` no GitHub Actions — não é mais automático
  a cada merge. O job de deploy roda **todas as verificações full** antes de
  publicar. **Formato (confirmado):** **dois jobs no mesmo `deploy.yml`** —
  `verify` no hosted `ubuntu-latest` (suíte full) e `deploy` com
  `needs: [verify]` rodando em **runner self-hosted do GitHub no homeserver**
  (conecta outbound ao GitHub — funciona atrás do Cloudflare tunnel; o job
  executa `scripts/deploy-homeserver.sh` localmente, sem SSH; não conta
  minutos hosted). O build de produção **não pode rodar fora do homeserver**
  (migrate pré-build no banco de prod — OPS66, estático na rede do compose,
  registry local `localhost:5000`) — por isso o hosted só verifica e o
  self-hosted só build/deploy. Fallbacks registrados (não escolhidos): runner
  na workstation via SSH (B) ou runbook manual no homeserver (C).
- **E o ci.yml (verificador de main)?** **Decidido (gate 2026-08-19):**
  **eliminar** — fica só o pre-deploy (`verify` do dispatch manual) como
  verificação full. Motivo: custo mínimo de Actions; o deploy é deliberado e
  roda full na hora; se um dia o merge em main quiser rede de regressão, o
  `ci.yml` volta com 1 linha de trigger (sem deploy).
- **Fatiamento do lote?** **Opções:** A) OPS71 (este, CI+PR+merge+deploy) e
  OPS72 (e2e local afetado) separados com `depends`; B) um único item com tudo.
  **Recomendação:** A — cada um tem outcome verificável sozinho e o OPS72
  (skill work-issue + ci-pr sem e2e full) é pequeno. _(assumido — validar)_
- **Repo GitHub defasado.** Hoje parado em 2026-08-13 (pré-OPS50). **Opções:**
  A) re-sincronizar via push do estado local (histórico é ancestral comum —
  fast-forward limpo); B) import novo (histórico duplicado/PRs antigas órfãs).
  **Recomendação:** A. _(assumido — validar)_

## Referências

- GitHub Issue: #97 (OPS71)
- Rascunho UI (gate): N/A
- `.forgejo/workflows/` (a remover após cutover), `docs/plans/ops50-ci-github-para-forgejo.md`,
  `docs/plans/ops62-ci-fail-fast-forgejo.md`, `docs/plans/ops65-ci-main-janela-30min-e-matar-pool.md`,
  `docs/plans/ops61-forgejo-contratos-merge-labels-e-branch-protection.md`,
  `scripts/forgejo-pr-automerge.mjs`, `scripts/forgejo-issue-transition.mjs`,
  `scripts/forgejo-dispatch.mjs`, `scripts/configure-branch-protection.mjs`,
  `scripts/ci-classify-production.mjs`, `docs/ops/teqo-1313-deploy.md`
