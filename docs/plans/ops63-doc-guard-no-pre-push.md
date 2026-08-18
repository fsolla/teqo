---
id: OPS63
depends: []
serializes: ['scripts/gate-ci.mjs']
priority: P2
model: composer-2.5
---

# OPS63 — Doc-guard também no pre-push (changelog append-only, agregado e marcadores de conflito)

Status: rascunho
Atualizado em: 2026-08-18
Issue: #60
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável (push local roda os checks de docs)
Responsável: —

## Intenção

O CI tem o job `docs-guards` (OPS44): changelog é append-only, o agregado está sincronizado com `docs/changelog/` e nenhum marcador de conflito entrou em markdown. São verificações rápidas (diff de git, sem banco), mas só rodam no CI — um push com changelog quebrado descobre o problema lá, cicla o run e ocupa a fila do runner. No pre-push, a mesma verificação custa segundos e não chega a subir.

## Persona e fluxo

- **Persona / contexto:** agente (ou humano) fechando uma entrega que escreve `docs/changelog/<data>-<id>.md` e roda `pnpm changelog:build` antes do push (OPS44).
- **Job principal:** saber **antes do push** que o changelog respeita append-only, o agregado está up to date e nenhum marcador de conflito entrou em markdown.
- **Fluxo desejado:**
  1. Entrega pronta com entrada de changelog.
  2. `pnpm push` (ou `git push` via `.husky/pre-push`) roda o gate local.
  3. Os checks de docs rodam em segundos, junto da cascata existente.
  4. Falha → mensagem acionável antes do push; correção no mesmo passo.
  5. Push limpo não cicla o CI à toa.
- **Anti-goals de produto:**
  - Não criar bypass novo (o escape `changelog-rewrite:` continua sendo contrato do body do PR no CI).
  - Não rodar `plans-only-closes` localmente (depende do body do PR — sem sentido pré-push).
  - Não duplicar lógica: reusar os scripts de guard existentes (default `origin/main` já funciona local).

## Objetivo e aceite

- `pnpm gate:push` (via `pnpm push` **e** `.husky/pre-push`) roda os três checks de docs: changelog append-only, agregado up to date (`--check`) e sem marcadores de conflito em markdown — junto da cascata atual.
- Falha bloqueia o push com a mesma mensagem acionável do CI.
- O CI não muda: o job `docs-guards` continua dono do escape `changelog-rewrite:` (body do PR).

## Dados (intenção)

Dados: N/A — chore de DX/processo; sem métrica de produto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/gate-ci.mjs` (espelho local do ci-pr.yml — hoje omite `docs-guards` e `plans-only-closes`; adicionar a etapa de docs chamando os scripts existentes). Reuso direto de `scripts/check-changelog-append-only.mjs`, `scripts/build-changelog.mjs --check` e `scripts/check-docs-conflict-markers.mjs`. `.husky/pre-push` e `scripts/git-push.mjs` seguem delegando a `gate:ci` (sem mudança). `.forgejo/workflows/ci-pr.yml` intocado.
- **Precedente a olhar:** `docs/plans/gate-push-local.md` (origem do gate), `docs/plans/gate-push-sem-e2e.md` (OPS59 — também edita gate-ci.mjs), contrato OPS44 em `docs/AGENT-OPS.md`.
- **Risco de acoplamento:** mesmo arquivo que OPS59 edita (`scripts/gate-ci.mjs`) — mudança aditiva (OPS59 remove o bloco e2e; este item adiciona a etapa de docs), sem conflito conceitual; rebase obrigatório. `check-changelog-append-only.mjs` local não honra o escape (sem body de PR) — restaurações legítimas (padrão D8) falham no pre-push; bypass documentado necessário (ver questão em aberto).

## Dependências

- Nenhuma dura. Serializa com OPS59 (Issue #46) em `scripts/gate-ci.mjs` — ordem suave, não lock.

## Fora de escopo

- `plans-only-closes` (contrato de body de PR — CI-only por design).
- Mudar o que o CI roda (job `docs-guards` e escape `changelog-rewrite:` permanecem como estão).
- Criar flag de bypass local para o guard.

## Rabbit holes de produto

- **"Aproveito e rodo o plans-only-closes também".** A regra decide sobre o body do PR; pré-push não tem PR. **Corte:** só os três checks de diff.
- **"Local também honra o changelog-rewrite".** Criaria bypass local para uma regra que existe como contrato de PR/CI. **Corte:** falha local com mensagem clara + bypass existente (`git push --no-verify` direto) para o caso raro.

## Questões em aberto (produto)

- **O que fazer com restauração legítima (D8) no pre-push, já que o escape `changelog-rewrite:` só existe no body do PR?** **Decidido no gate (2026-08-18):** A — falha local com mensagem indicando o bypass documentado (`git push --no-verify` direto, já existente); o guard local é honesto e o CI continua sendo a via do escape.

## Referências

- `scripts/gate-ci.mjs` — o espelho local a editar (omite `docs-guards` hoje)
- `.forgejo/workflows/ci-pr.yml` — job `docs-guards` (linhas 369–386) e `plans-only-closes`
- `scripts/check-changelog-append-only.mjs`, `scripts/build-changelog.mjs --check`, `scripts/check-docs-conflict-markers.mjs` — guards reutilizáveis (default `origin/main`)
- `docs/plans/gate-push-local.md` — origem do gate; `docs/plans/gate-push-sem-e2e.md` — OPS59, mesmo arquivo
- `docs/AGENT-OPS.md` — contrato OPS44 (append-only, escape `changelog-rewrite:`)