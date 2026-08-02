---
name: plan-issue
description: >-
  Transforma ideias humanas em Issues GitHub + planos de intenção em
  docs/plans/ (persona, fluxo, objetivo, direção suave no código — sem
  decisões duras de engenharia). Se o item muda UI, apresenta no gate um
  Cursor canvas com rascunho visual UI/UX. Divide o pedido nas menores
  tarefas que ainda fazem sentido. Use quando o usuário pedir /plan-issue,
  planejar features, fatiar um pedido em Issues, ou registrar trabalho novo
  na fila.
disable-model-invocation: true
---

# Planejar Issues (intenção, não engenharia)

Esta skill transforma ideias soltas em: (1) um **plano de intenção** em `docs/plans/<slug>.md` por item, e (2) uma **GitHub Issue rastreável** (`pnpm agent:register`, frontmatter `id/depends/serializes/priority/model`). GitHub Issues são a fonte canônica de spec/status/deps/prio/modelo — `docs/roadmap.md` é legado congelado e **nunca** é editado aqui.

## Ciclo de vida (obrigatório)

```text
rascunho local (Issue: —)
  → GATE (Passo 5) + confirmação explícita do lote
  → register com --plan → Issue NÃO claimável (blocked; script enforça)
  → commit + PR dos planos (Related #N, nunca Closes)
  → merge em main
  → promote blocked→ready (`pnpm agent:ready` + Action OPS18 — dual, idempotente)
  → fila / pool
```

**Regras duras:**

1. **Nada no GitHub antes do gate.** Antes da confirmação explícita do Passo 5: proibido `pnpm agent:register`, `gh issue create`, `gh pr create` / push de PR de planos. Planos locais (`Issue: —`) ok.
2. **Confirmação = OK ao overview do lote** (ex. “confirma”, “pode registrar”). “Ok” ambíguo no meio da edição **não** dispara o Passo 6.
3. **Register com `--plan` não nasce `ready`.** O script aplica `blocked` automaticamente quando `--plan` está presente (`--blocked` explícito ainda vale para chores sem plano). Sem `--plan` (chore body-only / `file-miss`), pode nascer `ready`.
4. **Promote só depois do plano em `main`.** Nunca flipar para `ready` com o PR ainda aberto — isso recria a race de claim. Caminhos: (A) `pnpm agent:ready -- --issue N` no fim do Passo 6 após merge; (B) Action determinística no merge que lê `Related #N` (OPS18). Ambos idempotentes.
5. **Planos de Issues `in-progress` / `done` / `in-prod` são imutáveis.** Não editar `docs/plans/<slug>.md` nem o body de intenção dessas Issues. Refino → **plano + Issue novos** (sucessor; `depends` no pai se fizer sentido). Enquanto a Issue ainda é só `blocked`/`ready` (sem claim), editar o mesmo plano ainda é barato.

**Canvas UI (obrigatório se muda UI):** itens com superfície Impeccable **B / C / D** (ou qualquer mudança do que o usuário vê/toca) devem ter um **Cursor canvas** de rascunho UI/UX no gate — ver [ui-draft-canvas.md](ui-draft-canvas.md). Classe A / sem UI → sem canvas.

## Divisão com as skills de execução

| Skill | Papel |
| ----- | ----- |
| **`plan-issue` (esta)** | Intenção humana: o quê / para quem / por quê / outcome. Direção suave no codebase. **Proibido** travar schema, signatures, migrations, abstrações ou “Abordagem” de engenharia. |
| **`work-issue`** | Humano supervisiona: claim → plano de **implementação** (Plan mode) → **pausa** para confirmação → executa. |
| **`agent-work-issue`** | Pool / autonomia: Issue já claimada → plano de implementação → executa sem pausa → `/simplify` → `capture-review-debts` → PR Ready + auto-merge. |

Aqui **não** se implementa código de produto, **não** se escreve plano de implementação, **não** se roda Impeccable craft/critique/polish. O canvas de rascunho UI/UX é artefato do **gate de intenção**, não entrega de app.

**Shaping (não tour):** aplique [shaping.md](shaping.md) em silêncio — appetite, fatia mínima útil, rabbit holes de produto, self-score ≥4 antes de gravar.

**Dados (intenção):** se o item envolve números/KPIs/mapas, aplique [data-presentation.md](data-presentation.md) só até “quem decide o quê com este dado”. A **forma** (chart/mapa/KPI) fica para o plano de implementação.

## Checklist

```
- [ ] 1. Parse do lote + dedup (intra-lote, Issues existentes, docs/plans, roadmap legacy)
- [ ] 2. Reserva de IDs de uma vez por trilha (roadmap legacy + issuesById())
- [ ] 3. Por item (ordem topológica): classificar → fatiar → explorar só o suficiente → intenção completa
- [ ] 4. Sugestão de modelo × effort via model-selection (uma linha por item)
- [ ] 5. GATE: overview do lote + canvas UI/UX (se muda UI) + esboços de fluxo → confirmar/iterar (PARAR aqui até o humano confirmar; sem Issue/PR)
- [ ] 6. Registro: `agent:register` (`--plan` → `blocked`) → PR `Related #N` → merge → `pnpm agent:ready`
```

## Passo 1 — Parse e dedup

1. **Separe os itens.** Entrada pode ser 1 ideia ou N. Se ambíguo, assuma a leitura mais provável e liste — a confirmação vai no gate.
2. **Fatia mínima útil.** Prefira várias Issues pequenas a um epic. Cada item deve caber num appetite curto e entregar um outcome verificável sozinho. Mesclar só quando separar criaria trabalho inútil (mesmo fluxo, mesma persona, mesma superfície sem valor incremental).
3. **Dedup intra-lote:** mesclar | absorver (fase de plano existente, sem ID novo) | manter separados com `depends`.
4. **Dedup contra o existente:** `gh issue list --state all` + `issuesById()` + grep em `docs/plans/*.md` e `docs/roadmap.md` (legado).
   - Já coberto / entregue → apontar e não criar.
   - Issue **`in-progress` / `done` / `in-prod`:** **não** editar o plano dela — se a intenção mudou, item **sucessor** (plano + Issue novos).
   - Issue só `blocked` / `ready` (ainda não claimada): pode editar o plano existente (fase de plano) sem ID novo.
   - Novo → seguir.

## Passo 2 — Reserva de IDs

Último ID por trilha (A/B/C/D/E) via roadmap legacy + `issuesById()`; distribua **antes** de escrever planos. Fora de trilha: prefixos `O0+`, `FD+`, `RS+`, `OPS+` ou trilha temática mais próxima.

## Passo 3 — Por item: intenção completa

Ordem topológica (dependente cita ID do dependido). Por item:

1. **Tipo**

| Tipo | Destino |
| ---- | ------- |
| Feature `/campanha` ou site com escopo próprio | `kind:feature` + plano de intenção |
| Chore / débito pequeno | `kind:chore` + plano curto (ou body se trivial) |
| Défice do fluxo de agentes | `pnpm agent:file-miss` (`kind:agent-miss`) — não aqui |
| Bloqueio externo (jurídico/LGPD) | `blocked` + `needs:consent`/`needs:migration`; texto no lote jurídico existente |
| Decisão de NÃO fazer | Comentário/doc, não Issue |

2. **Explorar o código o mínimo** — só para apontar **direção** (rotas/pastas/domínios prováveis) e evitar duplicar algo já entregue. Não inventar signatures, collections novas como decisão travada, nem diagramas de componentes.
3. **Superfície UI (A–D)** como dica para quem for executar — não semear brief Impeccable completo. Classe **B/C/D** (ou qualquer mudança de UI): criar **Cursor canvas** de rascunho UI/UX ([ui-draft-canvas.md](ui-draft-canvas.md) + skill `canvas`) **antes do gate**; ASCII no plano fica opcional. Classe **A** / sem UI: sem canvas.
4. **Dados (intenção)** ou `Dados: N/A`.
5. **Posicionamento:** `P0..P3`, `depends`, appetite, janela eleitoral se relevante, `serializes` se tocar recurso compartilhado (ex. migrations) — sem detalhar a migration.
6. **Plano de intenção** em `docs/plans/<slug>.md` via [intention-template.md](intention-template.md), com campo **Canvas UI** preenchido (path do `.canvas.tsx` ou `N/A`). Self-score ≥4/5 ([shaping.md](shaping.md)).

### O que é proibido no plano de intenção

- Decisões de schema / collection / unicidade / Consent key concreta como “travadas”
- Assinaturas de funções, nomes de arquivos novos obrigatórios, mermaid de arquitetura de solução
- “Abordagem proposta” com componentes e migration nomeada
- Fases de implementação verificáveis com quota de engenharia
- Forçar o executor a uma única forma técnica

### O que é obrigatório

- Intenção do humano (problema/oportunidade)
- Persona(s) e fluxo desejado (job / outcome)
- Critérios de aceite em linguagem de produto
- Appetite e fora de escopo (produto)
- **Direção provável no codebase** (pastas/rotas/domínios — hipotética, revisável)
- Questões em aberto com **Opções + Recomendação de produto** (não de engenharia)
- **Se muda UI:** canvas de rascunho UI/UX no gate ([ui-draft-canvas.md](ui-draft-canvas.md)) + link no plano

## Passo 4 — Modelo × effort

Skill `model-selection`. Registre no cabeçalho (`Model:`) e no gate.

- Default: `composer-2.5`
- Grok com effort explícito quando discovery/multi-domínio / falha cara de **produto**
- Não crie par `{id}-plan` / `{id}-exec` por default — o plano de implementação nasce em `work-issue` / `agent-work-issue`. Reserve bipartição só para blast radius extremo (refactor repo-wide) se o humano pedir.

## Passo 5 — GATE

Antes de criar Issues **ou** abrir PR de planos:

- Overview: ID, título, prio, depends, appetite, modelo, link do plano local
- **Para cada item que muda UI:** link markdown absoluto do canvas `plan-<id>-ui-draft.canvas.tsx` (abrir ao lado do chat) — este é o rascunho visual a validar
- Esboço textual de fluxo só se ajudar; não substitui o canvas quando há UI
- Perguntas acumuladas numa rodada, recomendação de produto primeiro

**Pare e espere.** Itere (incluindo o canvas, se houver UI) até confirmação explícita do lote (não basta um “ok” solto durante a edição). Só então Passo 6.

## Passo 6 — Registro (não claimável até plano em `main`)

Ordem obrigatória (OPS17):

1. **Register** (com `--model`; com `--plan` o script nasce `blocked` — não precisa `--blocked` extra):

```bash
pnpm agent:register -- --id <ID> --title "<título>" --prio <P0..P3> \
  --depends <A,B> --kind <feature|chore|...> --plan docs/plans/<slug>.md \
  --model <slug>
```

Sem `--plan`: nasce `ready` (use `--blocked` só se quiser não-claimável sem plano).

2. Atualize `Issue: #N` (e status) no plano local.
3. Commit + **`pnpm push`** + PR **Ready** `--base main` com **`Related #N`** (nunca `Closes #N` em PR só de `docs/plans/` — `plans-only-closes`).
4. Auto-merge (`gh pr merge --auto --merge`); espere o merge em `main`.
5. **Promote** com o script (idempotente se já `ready`; só Issues `blocked` + link `docs/plans/`, sem gates humanos `needs:*` nem `in-progress`/`done`/`in-prod`):

```bash
pnpm agent:ready -- --issue <N[,N…]>
```

A Action de merge (OPS18) é safety net se este passo falhar — não pule o promote do agente no caminho feliz.

**NÃO faz:** editar `docs/roadmap.md`; implementar código; claim; escrever `*-impl.md`; editar plano de Issue `in-progress`/`done`/`in-prod`; marcar `ready` antes do plano em `main`; registrar/abrir PR antes do gate.

## Resumo final

Tabela do lote + mesclados/absorvidos/descartados + decisões de produto assumidas _(validar)_ + o que o gate decidiu + Issues `#N` + PRs de plano.
