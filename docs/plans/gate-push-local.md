# Gate local DRY — gate:fast / gate:push + pre-push completo

Status: entregue (2026-07-30 — executado em sessão única, fora do fluxo agent:register, a pedido do humano)
Atualizado em: 2026-07-30
Issue: —
Priority: P2
Model: cursor-grok-4.5-high
Impeccable: A — N/A (sem superfície UI)
Appetite: ~0,5 dia eng; 2 scripts npm + 1 hook + docs
Responsável: —

## Dados → decisão → apresentação

Dados: N/A — chore de DX.

## Contexto

`.husky/pre-push` é uma linha: `pnpm lint && pnpm format:check && pnpm typecheck`. Mas o fast gate exigido por `.cursor/rules/engineering-standards.mdc` (desde 2026-07-30) e por `work-issue` Passo 4.3 é **lint + tsc + test:unit + format:check + check:cycles**. Resultado: agentes e humanos pusham verde no hook e quebram no CI por unit/cycles que nunca rodaram localmente. Não existe pre-commit hook.

Decisão de produto (2026-07-30, brief do lote CI): scripts DRY (`gate:fast`, `gate:push`), divisão pre-commit vs pre-push explícita, escape hatch documentado.

## Objetivos

- `.husky/pre-push` roda o fast gate completo via script npm único (DRY com a documentação).
- `package.json`: `gate:fast` (lint + typecheck + test:unit) e `gate:push` (gate:fast + format:check + check:cycles).
- Escape hatch documentado (`git push --no-verify`), com aviso de que CI repete tudo.
- Docs (`engineering-standards.mdc`, `AGENT-OPS.md`) citam os scripts, não a lista de comandos — uma fonte só.

## Decisões travadas

- **knip fora do pre-push.** O grafo do knip é incompleto (não carrega `payload.config.ts`, ledger P3) e é lento para um hook; CI já o roda como erro bloqueante. **Rejeitado:** knip no hook (custo por push + falsos positivos já fichados); knip no `gate:fast` documentado como obrigatório (mesma razão).
- **Sem pre-commit hook.** A divisão fica: nada no commit (commits intermediários de WIP são legítimos), tudo no push. **Rejeitado:** lint-staged no commit (adiciona toolchain e atrito sem pegar classe de erro que o push não pegue segundos depois).
- **Escape hatch = `--no-verify` nativo, documentado; sem variável mágica própria.** **Rejeitado:** `SKIP_GATE=1` (mais uma convenção para manter; `--no-verify` é o padrão git que todo agente/humano já conhece).
- **Hook chama `pnpm gate:push`, nunca inline de comandos.** Uma fonte de verdade editável em `package.json`. **Rejeitado:** manter a linha de shell no hook (foi o que causou o drift atual).

## Questões em aberto

- **`pnpm format` auto-fix no hook em vez de `format:check`?** **Opções:** A) check falha e o autor roda `pnpm format` | B) hook formata e aborta para re-add. **Recomendação:** A — hook que edita a worktree surpreende; o erro do check já diz o remédio.

## Abordagem proposta

Componentes:

- **`package.json`** — scripts `gate:fast` e `gate:push` (comandos bare encadeados com `&&`, nunca piped — invariante do repo).
- **`.husky/pre-push`** — `pnpm gate:push`.
- **`.cursor/rules/engineering-standards.mdc`** — item 3 do "After every change" passa a citar `pnpm gate:fast` / `pnpm gate:push`.
- **`docs/AGENT-OPS.md`** — linha do fast gate local atualizada para os scripts.
- **`.cursor/skills/work-issue/SKILL.md`** — Passo 4.3/6.1 cita `pnpm gate:push`.

Sem migration, sem código de app.

## Dependências

Nenhuma de outro plano (independente; pode rodar em paralelo com OPS3/OPS4). Conflito potencial de merge com OPS7 em `AGENT-OPS.md`/`engineering-standards.mdc` — serializar na fila ou aceitar rebase trivial.

## Não escopo

- Mudar o que o CI roda → OPS4/OPS5. Política "CI vermelho = seu problema" → OPS7.
- Husky v9 deprecations / migração de tooling de hooks.

## Rabbit holes

- **"Já que toco hooks, adiciono lint-staged/commitlint".** Toolchain nova para problema que não temos. **Mitigação:** decisão travada; commitlint só se 3 mensagens fora-do-padrão quebrarem automação (nenhuma hoje).

## Adiado com gatilho

Nenhum neste item.

## Referências

- `.husky/pre-push` (linha atual), `package.json` (scripts de gate existentes)
- `.cursor/rules/engineering-standards.mdc` — "Gate em duas velocidades"
- `docs/AGENT-OPS.md` — fast gate local; `.cursor/skills/work-issue/SKILL.md` — Passo 4.3
