---
id: OPS72
depends: [OPS71]
serializes: ['ci-pr.yml', '.agents/skills/work-issue/']
priority: P1
model: composer-2.5
---

# E2E local apenas para os testes afetados — CI de PR sem e2e full

Status: rascunho
Atualizado em: 2026-08-19
Issue: #98
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável (skill work-issue exige e2e afetado local; CI de PR não roda e2e full)
Responsável: —

## Intenção

O e2e é a etapa mais cara do CI de PR (build `.next-e2e` + playwright +
suíte inteira). Com o CI voltando para o GitHub Actions (OPS71), o custo por
PR deixa de ser a CPU da workstation — mas o tempo de veredito por PR continua
importando: e2e full é a maior fatia do job único `checks` (OPS62), e a
política de hoje (OPS59: "e2e roda UMA vez, no CI; local opcional") significa
que cada PR paga a suíte e2e inteira, inclusive specs em superfícies que o PR
não tocou.

Queremos: **e2e no CI de PR apenas para os testes afetados** (novos testes
criados + specs da mesma superfície trabalhada — a mecânica `e2e selected` já
existe via `ci-scope.mjs`/manifest do OPS59), e o **restante da cobertura e2e
roda localmente** — também apenas nos afetados — como passo do fluxo do agente
antes do PR (atualizar a skill `work-issue` para exigir isso). O e2e **full**
fica para o **deploy manual** (workflow_dispatch do OPS71) e para o verificador
de main — como rede de segurança antes de publicar — sem nunca rodar full por
PR.

**Decisão do gate (2026-08-19):** o CI de PR **continua rodando o e2e das
áreas afetadas** (modo `selected`) — confirmado pelo usuário; o e2e local
afetado é o passo da skill; o full fica no deploy/verificador de main.

## Persona e fluxo

- **Persona / contexto:** o agente (humano no worktree ou worker do pool) que
  implementa uma Issue e abre o PR; o dono da máquina que não quer o CI
  ocupando o runner por 40+ min por PR.
- **Job principal:** saber que os testes novos/afetados do seu PR passam,
  com custo mínimo de CI e feedback local rápido.
- **Fluxo desejado:**
  1. Agente implementa; roda os gates locais de sempre (`pnpm gate:push`).
  2. **Novo passo obrigatório:** roda `pnpm test:e2e:affected` (ou o modo
     selecionado equivalente) — cobre os novos testes criados + specs da
     mesma superfície trabalhada.
  3. CI de PR roda a cascata **sem e2e full**: apenas o conjunto afetado
     (modo `selected` — já suportado pelo classifier; decisão do gate).
  4. Deploy manual (OPS71) e verificador de main rodam e2e **full** antes de
     publicar — a rede de segurança final inegociável.
- **Anti-goals de produto:** NÃO remover o e2e do deploy/verificador de main;
  NÃO deixar o agente pular o e2e local sem justificativa; NÃO reintroduzir
  "e2e é só no CI" (OPS59 era isso e custa caro por PR).

## Objetivo e aceite

- Skill `work-issue` (e `execution-pipeline.md`, `agent-work-issue` onde
  aplicável) passam a exigir, antes do `pnpm push`/PR: **e2e local afetado**
  (`pnpm test:e2e:affected`), com o critério "novos testes + mesma superfície"
  documentado.
- CI de PR: e2e roda em modo `selected` (manifest afetado) — nunca `full`. O
  classificador de escopo (`ci-scope.mjs`) é a fonte da decisão.
- Deploy manual e verificador de main: e2e **full** preservado (rede de
  segurança pré-deploy/pré-publicação).
- A skill `work-issue` documenta a limitação da #72 (e2e local com `--no-deps`
  - projetos paralelos colide no `seedTestUser` — usar `--workers=1` ou a
    cadeia padrão de projetos).
- Gate local (`pnpm gate:push`) intocado — e2e continua fora do pre-push; o
  e2e local é passo **explícito do fluxo da skill**, não do hook.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** o agente decide o conjunto afetado com base no
  diff da superfície — critério documentado na skill, não métrica nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `.agents/skills/work-issue/SKILL.md` e `execution-pipeline.md` — novo
    passo "e2e local afetado" antes do push; delta para `agent-work-issue`
    quando fizer sentido.
  - `.forgejo/workflows/ci-pr.yml` → (OPS71) `.github/workflows/ci-pr.yml` —
    etapa e2e apenas `selected`; remover `full` do modo PR.
  - `.github/workflows/ci.yml` (verificador de main) e `deploy.yml` (dispatch
    manual) — e2e `full` preservado neles.
  - `docs/AGENT-OPS.md`, `AGENTS.md` (política "e2e = CI" do OPS59 vira
    "e2e afetado = local + CI selected; full = deploy/verificador de main").
- **Precedente a olhar:** `docs/plans/ops59-gate-local-sem-e2e.md` (política
  atual), `ci-scope.mjs` (modos `full/selected/none`), `e2e-affected-manifest.mjs`,
  `docs/plans/ops62-ci-fail-fast-forgejo.md`.
- **Risco de acoplamento:** toca a mesma superfície do OPS71 (workflows + a
  skill work-issue é citada pelo fluxo de PR) — por isso `depends: [OPS71]` e
  serialização explícita (OPS71 serializa `ci-pr.yml` e `work-issue`).

## Dependências

- OPS71 (CI no GitHub) — este item edita o `ci-pr.yml` novo e a skill que o
  OPS71 já aponta para o GitHub; `depends: [OPS71]`.
- #72 (S3-FOLLOWUP) — citada como limitação documentada; não é duplicada nem
  absorvida (fica na fila).

## Fora de escopo

- Mudar a mecânica do classifier/manifest (`ci-scope.mjs`,
  `e2e-affected-manifest.mjs`) — funciona; só muda onde/em que modo roda.
- Implementar o fix da #72.
- Remover o e2e do deploy manual / verificador de main.

## Rabbit holes de produto

- **"Se é afetado, nem precisa do CI e2e".** O CI selected é a rede de
  segurança quando o agente erra o critério (esqueceu um spec da mesma
  superfície) — e é o que o usuário pediu para manter. **Corte:** CI selected
  permanece; local é complementar, não substituto.
- **"Full só no deploy cria gap de regressão".** Aceito e deliberado: o full
  gateia a publicação (deploy manual) e o verificador de main; PRs afetados
  cobrem a superfície do diff. **Corte:** não reintroduzir full por PR.

## Questões em aberto (produto)

- **CI de PR: e2e selected ou nenhum e2e?** **Decidido no gate (2026-08-19):**
  e2e **selected** (manifest afetado) no CI de PR — o usuário confirmou
  ("O CI PR deve continuar fazendo o e2e das áreas afetadas").
- **O e2e local afetado vale também para o pool (`agent-work-issue`)?**
  **Opções:** A) sim, mesmo passo obrigatório; B) pool roda só o CI selected
  (workers Cloud sem worktree local com browsers instalados).
  **Recomendação:** A quando o worktree local tiver browser; senão B com
  justificativa registrada. _(assumido — validar)_

## Referências

- GitHub Issue: #98 (OPS72)
- Rascunho UI (gate): N/A
- `.agents/skills/work-issue/SKILL.md`, `.agents/skills/work-issue/execution-pipeline.md`,
  `scripts/ci-scope.mjs`, `scripts/lib/e2e-affected-manifest.mjs`,
  `docs/plans/ops59-gate-local-sem-e2e.md`, `docs/plans/ops62-ci-fail-fast-forgejo.md`
