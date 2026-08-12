# Redesenhar o fluxo de registros/compartilhados para menos conflitos

Status: rascunho
Atualizado em: 2026-08-11
Issue: #713
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI; mudanças de processo/CI)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; mudanças de processo + guard de CI, sem tocar em UI
Responsável: —

## Intenção

Agentes paralelos resolvem conflitos de merge e re-rodam CI de PR repetidamente, muitas vezes por **arquivos que nada têm a ver com o trabalho da Issue** — o exemplo canônico é `docs/CHANGELOG-AGENTS.md` (63 commits em 300, 3+ clobbers com perda de conteúdo em ~2 semanas). O levantamento de evidência (feito no planejamento) mostra que a contenção tem padrões: (1) changelog — **toda** entrega é obrigada a prepend no mesmo arquivo, no mesmo anchor; (2) registries append-only de área; (3) docs vivos (AGENTS.md, skills, worktree.sh). O redesenho ataca a **causa** de cada classe: escrever em arquivo próprio quando o registro é por-entrega, guard de CI para o padrão de clobber, rebase no merge, e `serializes` explícito para os registries que continuam compartilhados.

## Persona e fluxo

- **Persona / contexto:** agente em worktree paralelo; auto-merge de PR em main.
- **Job principal:** a entrega passa sem conflito mecânico em arquivos alheios ao trabalho, e nada é **perdido silenciosamente** num merge.
- **Fluxo desejado:** registrar a entrega num arquivo próprio (imune a conflito) → agregação gera o changelog legível → CI barra remoção de linhas existentes (o padrão de clobber) → merge por rebase (o conflito aparece para o autor, que conhece o diff) → registro e trabalho não se tocam.
- **Anti-goals de produto:** não virar gerenciador de merge (cerimônia por PR); não mudar o paradigma de worktrees/PRs; não perder a legibilidade do histórico "Recently resolved"; não tocar `docs/plans/*` (já é o padrão que funciona — arquivo por Issue); **não commitar artefato de mapa** (`docs/conflict-map.md`) — o levantamento é contexto de planejamento, não produto.

## Objetivo e aceite

- **Onde a entrada do changelog mora** deixa de ser o arquivo único: cada entrega grava em arquivo próprio; a leitura "Recently resolved" continua agregada por script.
- Guard no CI (ci-pr) que **bloqueia remoção de linhas existentes** do `docs/CHANGELOG-AGENTS.md` agregado (append-only), com escape documentado para restaurações legítimas (padrão D8).
- Guard que barra **marcadores de conflito** (`<<<<<<<`) em qualquer diff que toque `docs/` (extensão do guardrail OPS41 para todo doc).
- Merge das PRs via **rebase** (`gh pr merge --auto --rebase`) — conflito resolvido pelo autor; sem merge-commit com resolução silenciosa contra snapshot antigo.
- Issues que tocam registries compartilhados (guard de vocabulário, tools do Sollinha, fixtures e2e) declaram `serializes` — visível no claim via a tabela de evidência abaixo.
- Medição: nas 2 semanas seguintes, contagem de merges/rebase com resolução de conflito em arquivos de docs vs baseline (changelog clobberado 3× em ~2 semanas; merges `merge: main into … (CHANGELOG …)` recorrentes).

## Evidência — mapa de contenção (últimos 300 commits)

| Arquivo                                                     | Commits/300 | Classe                                            | Por que é quente             | Rastro de incidentes                                                                                                                                                                     |
| ----------------------------------------------------------- | ----------- | ------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/CHANGELOG-AGENTS.md`                                  | **63**      | C1 — Processo (prepend obrigatório, anchor único) | Toda entrega escreve no topo | OPS38 (#629: 120 entradas perdidas; correção re-clobberada no #649), D8 (#557: B183/C102), `fab834fc` "re-added after second rebase conflict", merges `merge: main into … (CHANGELOG …)` |
| `AGENTS.md`                                                 | 12          | C3 — Doc vivo (OPS)                               | Bullets compartilhados       | OPS41 (#689: marcadores de conflito commitados) — guardrail anti-reincidência já criado                                                                                                  |
| `tests/unit/codebaseConventions.unit.spec.ts`               | 9           | C2 — Registry append-only                         | Guard de vocabulário         | —                                                                                                                                                                                        |
| `src/migrations/index.ts`                                   | 8           | C4 — Serializado por política                     | migration-lock (≤1 PR)       | — (política cobre)                                                                                                                                                                       |
| `tests/e2e/fixtures/campaignE2EFixtures.ts`                 | 7           | C2 — Registry e2e                                 | Fixture compartilhada        | —                                                                                                                                                                                        |
| `src/utilities/ai/systemPrompt.ts`                          | 7           | C3 — Doc vivo (IA)                                | Prompt do Sollinha           | —                                                                                                                                                                                        |
| `src/payload-types.ts`                                      | 6           | C4 — Serializado                                  | Gerado; migration-lock       | — (política cobre)                                                                                                                                                                       |
| `package.json` / `pnpm-lock.yaml`                           | 6+2         | C5 — Infra                                        | Deps                         | — (raro, blast alto)                                                                                                                                                                     |
| `.agents/shell/worktree.sh`, `.opencode/commands/*`, skills | 5–6         | C3 — Doc vivo (OPS)                               | Ferramenta worktree          | —                                                                                                                                                                                        |
| `src/utilities/ai/tools/index.ts`                           | 5           | C2 — Registry append-only                         | Tools do Sollinha            | —                                                                                                                                                                                        |

**Leitura:** conflito em `docs/plans/*` ≈ zero (arquivo por Issue — o padrão que funciona). Contenção = (entregas obrigadas a tocar o arquivo) × (mesmo anchor de edição). O pior dano não é o atrito — é o **clobber silencioso** (merge-commit contra snapshot antigo faz entradas sumirem do main).

## Dados (intenção)

Dados: N/A — métrica de processo (conflitos resolvidos e re-runs de CI), registrada na própria entrada de entrega.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/ci-pr.yml` (job/check de guard append-only + marcadores), `scripts/lib/` (helper de diff se necessário, unit-testado), `docs/CHANGELOG-AGENTS.md` + `docs/changelog/` (formato novo por entrega), `docs/AGENT-OPS.md` (documentar o fluxo novo, o rebase e o `serializes`), frontmatter `serializes` nas Issues futuras.
- **Precedente a olhar:** OPS41 (`agents-md-sem-marcadores-conflito` — guardrail de marcadores no AGENTS.md), D8 (`restaurar-entradas-changelog-b183-c102` — processo manual de revisão de diff), `ci-proibir-closes-plans-only` (guard via CI), skill `rebase-on-main` (rebase antes do merge já é prática nas impls).
- **Risco de acoplamento:** mudar o formato do changelog toca `AGENTS.md` (seção "Histórico de entregas" aponta o arquivo) — mudança de uma linha, mas o commit dela precisa respeitar o guard novo (e o guardrail OPS41).

## Decisões do gate (2026-08-11 — confirmadas pelo humano)

1. **Formato do changelog: A** — arquivo próprio por entrega (`docs/changelog/<data>-<id>.md`) + script agregando o changelog único legível. Raiz do clobber (anchor único) eliminada.
2. **Merge das PRs: A** — `gh pr merge --auto --rebase`; o conflito aparece para o autor da PR, que conhece o diff.
3. **Guards de CI: A** — entram neste item: append-only do changelog agregado (bloqueia remoção de linhas existentes; escape documentado no padrão D8) + proibição de marcadores `<<<<<<<` em diffs que tocam `docs/`.
4. **Mapa não vira artefato commitado** — a tabela de evidência acima vive no plano (e no corpo da Issue); nada de `docs/conflict-map.md`.

## Dependências

- Nenhuma dura. Soft: OPS41 (guardrail de marcadores — estender o padrão), D8 (padrão de restauração legítima).

## Fora de escopo

- Migrar entradas históricas do changelog (o histórico fica como está — append-only vale daqui para frente).
- Mudar `docs/plans/*` (arquivo por Issue já é o padrão imune a conflito).
- Qualquer mudança de UI.
- Commitar o mapa de contenção como artefato (decisão do gate).

## Rabbit holes de produto

- **Ferramenta de merge sofisticada.** Se alguém "só completar": lock por arquivo, fila de escrita, script de resolução automática. **Corte:** cada entrega escreve em arquivo próprio + guard barato no CI — a complexidade resolve no formato, não no merge.
- **Congelar o changelog.** Se alguém "só completar": parar de registrar entregas. **Corte:** o registro continua, muda só onde a linha mora e quem agrega.
- **Serializar tudo.** Se alguém "só completar": `serializes` em toda Issue e fila vira gargalo. **Corte:** só registries C2, e só quando a Issue de fato toca.

## Questões em aberto (produto)

- **O agregado "Recently resolved" é necessário na forma atual?** **Opções:** A) sim — script gera `docs/CHANGELOG-AGENTS.md` ordenado por data | B) a pasta cronológica por si só é o registro; o arquivo único morre. **Recomendação:** **A** — quem lê o histórico (agentes, humano) já tem o arquivo como referência; matar a forma quebra leitura estabelecida. _(assumido — validar na execução se o custo do script valer a pena)_

## Referências

- Incidentes: OPS38 (Issue #629), D8 (Issue #557), OPS41 (Issue #689); commits `fab834fc` (B184 "re-added after second rebase conflict"), merges `merge: main into … (CHANGELOG …)`.
- `docs/AGENT-OPS.md` (paradigma atual: claim → PR → auto-merge → main → deploy gated; comandos), skill `rebase-on-main`, `.agents/skills/plan-issue/SKILL.md` (frontmatter `serializes`).
