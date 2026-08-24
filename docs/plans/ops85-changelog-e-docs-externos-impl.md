# Impl: OPS85 — Estratégia para eliminar conflitos de merge no changelog e reavaliar migração da documentação para fora do repo

Status: implementado
Atualizado em: 2026-08-24
Issue: #830
Intenção: docs/plans/ops85-changelog-e-docs-externos.md

## Leitura da intenção

- **Outcome:** zero conflito em arquivo de changelog; o guard de sync deixa de ser requisito de CI; a leitura "Recently resolved" permanece acessível com o **mesmo conteúdo**, por comando; a decisão de migrar docs para fora sai documentada com evidência (arquivamento explícito).
- **Anti-goals:** leitura preservada; sem cerimônia de merge por PR; ciclo claim→plano→PR intacto; sem segunda fonte de verdade; núcleo do `AGENTS.md` tocado só no apontamento mínimo.

## Descoberta do explorador (mudou o desenho da opção A)

`docs/changelog/` tem 65 arquivos (todos pós-OPS44, ≥2026-08-13), mas o agregado tinha **171 blocos "Recently resolved"** — ou seja, **106 entradas (2026-07-23 → 2026-08-13) existiam apenas no agregado**. Matar o agregado commitado sem preservá-las violaria o anti-goal "não perder a leitura estabelecida". Solução: **snapshot congelado** `docs/CHANGELOG-AGENTS-HISTORY.md` (D2), commitado 1× nesta entrega.

## Abordagem recomendada (Opção A — aprovada no gate)

O agregado deixa de ser commitado; `docs/changelog/` é o único registro versionado; a leitura é gerada sob demanda a partir do snapshot congelado + entradas; o guard de sync morre no CI/gate; o append-only vira additions-only por-arquivo + HISTORY congelado + agregado não-commitado.

**Rejeitadas:** **B** (merge driver git: desloca o custo para cada rebase, depende de config em toda máquina do pool; o incidente B183/C102 foi um merge "silencioso" que o driver não pega); **C** (status quo com serializes/rebase: é a evidência do humano provando que não funciona).

### Decisões de engenharia

- **D1 — destino do arquivo:** agregado **gitignored** no mesmo path (`git rm --cached`, working tree preservado). Remoção total do histórico (rewrite de 63 commits) rejeitada; congelar no lugar rejeitado (um agente poderia re-commitar e devolver a classe de conflito).
- **D2 — seed histórico:** `docs/CHANGELOG-AGENTS-HISTORY.md` = cópia integral do agregado atual + marcador de congelamento; o gerador usa `.blocks` como seed quando o arquivo local não existe. Fora de `docs/changelog/` (o `listChangelogEntries` é fail-closed para nomes fora do padrão).
- **D3 — comandos:** `changelog:build` (grava gitignored) + `changelog:read` (stdout, novo) + `changelog:check` (sanidade local opcional, fora de CI/gate). Uma flag no script existente, zero módulo novo.
- **D4 — mecanismo substituto do append-only:** (1) entradas por-arquivo additions-only (já existia); (2) HISTORY congelado zero-diff (só criação); (3) agregado proibido no diff — remoção única (status D) permitida só junto com a criação do HISTORY (a migração OPS85); (4) pós-condição do gerador: toda entrada parseada aparece no output. O multiset (`missingLines`) morre — a garantia de não-perda vira additions-only + pós-condição. Escape `changelog-rewrite:` permanece, CI-only, agora cobrindo correção do HISTORY.
- **D5 — docs externos:** **arquivados com evidência** — o conflito era do agregado (arquivo comum derivado), não das entradas por-arquivo; migrar 12+ skills criaria segunda fonte de verdade que os guards não enxergam. Alvo registrado se um dia for: Wiki.js. Nada instalado.

### Correção pós-revisão (self-hosting do guard)

O guard com `--name-status` detectou a migração como **rename** (`R099 docs/CHANGELOG-AGENTS-HISTORY.md`), o que falharia a regra "HISTORY congelado". Fix: `git diff --no-renames` no guard — a semântica é por path (deleção do agregado + criação do HISTORY são paths distintos), rename é ruído; o shape `A HISTORY + D agregado + A entrada` passa limpo, e diffs futuros ficam inequívocos.

## Componentes / mudanças

- `scripts/lib/changelog.mjs`: + `CHANGELOG_HISTORY`, + `CHANGELOG_HEADER` (cabeçalho estático novo usado no seed); `assertChangelogAppendOnly` reescrito (`{ changelogDiff, historyDiff, aggregateDiff }`); `missingLines` removido.
- `scripts/build-changelog.mjs`: leitura do agregado opcional (ausente → seed do HISTORY); `--stdout`; `--check` local (arquivo ausente → ok); pós-condição de não-perda.
- `scripts/check-changelog-append-only.mjs`: scope = agregado + HISTORY + dir; `--no-renames`; regras D4; escape intacto.
- `scripts/gate-ci.mjs`: remoção do run "aggregate sync" (fase 1 docs-guards).
- `.github/workflows/ci-pr.yml`: remoção do step "Aggregate is up to date".
- `package.json`: + `changelog:read`.
- `.gitignore`: + `/docs/CHANGELOG-AGENTS.md`.
- `docs/CHANGELOG-AGENTS-HISTORY.md` (novo, commitado): snapshot integral do agregado (212 blocos: 171 "Recently resolved" + Known Gaps + duplicatas históricas) + marcador de congelamento.
- Git index: `git rm --cached docs/CHANGELOG-AGENTS.md`.
- Contratos: `AGENTS.md`, `docs/AGENT-OPS.md` (item 4 + "Registries compartilhados" + seção "Decisões arquivadas"), `.agents/skills/work-issue/execution-pipeline.md`, `.github/pull_request_template.md`, `docs/roadmap.md`, `scripts/lib/agent-pool-prompt.mjs`, `.agents/rules/engineering-standards.mdc`, `.agents/rules/agent-pr-workflow.mdc`, `AGENTS-infra.md`.
- Testes: `tests/unit/changelog.unit.spec.ts` (assinatura nova + migração OPS85 + HISTORY congelado + agregado proibido; `missingLines` removido), `tests/unit/agentPoolPrompt.unit.spec.ts` (pin sem `changelog:build`).

## Fases executadas

1. Morte do agregado commitado + gerador sob demanda (lib + build + check + package.json + .gitignore).
2. HISTORY + `git rm --cached`; verificação em clone-fresco (213 blocos, órfãs pré-OPS44 preservadas).
3. Guard de sync fora de CI/gate (gate-ci.mjs, ci-pr.yml, AGENTS-infra.md).
4. Contratos (lista acima).
5. Testes + gates (`pnpm gate:fast` verde: 2440 testes; `--no-renames` fix).
6. Entrada `docs/changelog/2026-08-24-ops85.md` sem `changelog:build` antes do push — tracer bullet do fluxo novo.

## Riscos e mitigação

- **Perda das 106 entradas pré-OPS44:** seed HISTORY commitado + guard zero-diff + pós-condição do gerador + verificação em clone-fresco (fase 2). O HISTORY nunca é escrito pelo fluxo — a classe de conflito não volta por ele.
- **Alguém re-commita o agregado:** guard proíbe qualquer diff no path regenerável (exceto a migração única); PR vermelho com mensagem clara.
- **Clone-fresco sem arquivo em disco:** `changelog:read` (stdout) é o caminho canônico; `changelog:build` regenera.
- **Duplicação seed-vs-arquivos (65 blocos nos dois):** idempotência por texto exato do `buildChangelog` (verificado: 213 blocos, sem duplicatas).
- **Drift de contrato skills/tests/pool:** mesma entrega (fase 4+5); pin `agentPoolPrompt` quebra no CI se esquecido.
- **Escape mal usado:** semântica CI-only preservada; nada de bypass local novo.

## Aceite de engenharia

- Zero conflito de changelog (arquivo comum mutável sumiu do git); leitura "Recently resolved" com o mesmo conteúdo (seed + entradas); guard de sync fora de CI; decisão docs externos documentada (arquivada com evidência, alvo Wiki.js registrado).
- Nada commitado além da entrada por-arquivo; HISTORY é o único arquivo de changelog commitado e é congelado; escape CI-only preservado; `git rm --cached` sem rewrite de histórico.
- Testes: unit changelog (assinatura nova + migração), pin agentPoolPrompt; verificação manual em clone-fresco; `pnpm gate:fast` verde; guard append-only passa no próprio diff da migração.

## Self-score decision-quality

**5/5** — decisões caras com rejeitadas explícitas (A/B/C + D1-D5); cabe no appetite; rabbit holes nomeados; depth check (zero módulo novo, seed é dado não código); intenção satisfeita — a extensão (seed HISTORY) existe para cumprir o anti-goal de conteúdo íntegro.
