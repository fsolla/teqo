---
name: plan-issue
description: Registra uma ou VÁRIAS ideias/features/débitos do Teqo como GitHub Issues rastreáveis — classifica, explora o código, produz plano completo em docs/plans/<slug>.md por item (premissas, critérios de aceite, fases verticais, tracer bullet), sugere modelo × effort (model-selection) e passa por um GATE de confirmação (overview + wireframes ASCII + premissas) antes de criar qualquer Issue via `pnpm agent:register`. Usar quando o usuário pedir para adicionar/registrar algo ("adiciona ao roadmap", "registra essa ideia", "cria um plano para", "planeja a issue", "registra tudo isso"), em lote ou avulso.
---

# Planejar e registrar Issues (1..N ideias)

Esta skill transforma ideias soltas em: (1) um **plano completo** em `docs/plans/<slug>.md` por item, e (2) uma **GitHub Issue rastreável** por item (`pnpm agent:register`, frontmatter `id/depends/serializes/priority/model`). **GitHub Issues são a fonte canônica** de spec/status/deps/prio/modelo — `docs/roadmap.md` é legado congelado e **nunca** é editado aqui.

**Gate de confirmação (obrigatório):** nenhuma Issue é criada no GitHub antes do usuário aprovar o overview do lote (Passo 5). Planos locais podem ser rascunhados antes; Issues, não.

**Divisão com `work-issue`:** aqui se classifica a superfície UI (A–D), semeia âncoras de design, escreve o plano (spec + fatias). **Não** se implementa código nem se roda Impeccable craft/critique/polish — isso pertence a `work-issue` (incremental + TDD + gates).

**Mapa das skills de planejamento:** o que absorver vs. rotear — [skills-map.md](skills-map.md). Princípios em silêncio; sem tour.

**Qualidade de decisão (não é tour):** aplique [decision-quality.md](decision-quality.md) em silêncio — filtro caro vs barato, Opções+Recomendação+rejeitadas, appetite, rabbit holes, depth check, fatias verticais, doubt em decisão cara, self-score ≥4 antes de gravar.

**Dados → decisão → apresentação:** se o item produz, agrega ou exibe números/séries/mapas/KPIs, aplique [data-presentation.md](data-presentation.md) em silêncio antes de travar a Abordagem. Se não há superfície de dados, `Dados: N/A` no plano.

## Checklist do fluxo

```
- [ ] 1. Parse do lote + dedup (intra-lote, Issues existentes, docs/plans, roadmap legacy)
- [ ] 1b. Clareza: ideia vaga → idea-refine leve / perguntar; senão premissas explícitas
- [ ] 2. Reserva de IDs de uma vez por trilha (roadmap legacy + issuesById())
- [ ] 3. Por item (ordem topológica): classificar → explorar código → Impeccable A–D → dados
      → decisões (doubt se caro) → fases verticais + tracer → posicionamento → plano completo
- [ ] 4. Sugestão de modelo × effort via model-selection (uma linha por item)
- [ ] 5. GATE: overview do lote + premissas + wireframes ASCII (B/C/D) → confirmar/iterar
- [ ] 6. Registro: pnpm agent:register (com --model) por item + commit dos planos
```

## Passo 1 — Parse do lote e dedup

1. **Separe os itens.** A entrada pode vir como 1 ideia ou N (lista, parágrafo, notas). Se a separação for ambígua, assuma a leitura mais provável e liste como você entendeu — a confirmação vai junto do gate.
2. **Deduplique dentro do lote.** Desfechos: **mesclar** (um item, plano único), **absorver** (vira fase de plano existente, sem ID novo), ou **manter separados** com dependência explícita.
3. **Deduplique contra o que já existe:** `gh issue list --state all` (frontmatter `id` via `issuesById()` em `scripts/lib/agent-github.mjs`), grep em `docs/plans/*.md` e em `docs/roadmap.md` (legado). Três desfechos por item: **já coberto** → aponte a Issue/plano existente e não crie nada; **é fase de plano existente** → adicione ao plano existente; **realmente novo** → siga.

## Passo 1b — Clareza e premissas (antes de reservar ID / escrever plano)

Inspirado em `idea-refine` + `spec-driven-development` + `using-agent-skills` (“Surface Assumptions”) — **leve**, sem sessão divergente completa.

1. **Ideia ainda vaga?** (não dá para escrever Objetivos testáveis, persona, ou 1 fatia vertical). Desfechos:
   - **Roteiar** para `idea-refine` / `interview-me` se o usuário quiser explorar; ou
   - **Uma rodada** de 3–5 sharpening questions (quem, sucesso, constraints, o que já tentou, por quê agora) + recomendação; **não** avance ao Passo 2 até haver um HMW / problema em uma frase e um MVP óbvio.
2. **Premissas explícitas.** Antes de redigir o plano, liste o que está assumindo (produto, schema, papel, escopo). Formato no plano e no gate:

   ```text
   PREMISSAS:
   1. …
   2. …
   → Corrija agora ou sigo com estas.
   ```

   Não preencha ambiguidade em silêncio. Assunções que forem default de produto ficam marcadas _(assumido — validar com produto)_ nas Questões em aberto.
3. **Pedido vago → critérios de sucesso.** Reframe (“deixar o dashboard mais rápido”) em condições testáveis antes da Abordagem. Se não der para medir/verificar → ainda está vago (voltar ao item 1).

## Passo 2 — Reserva de IDs

Levante o último ID usado por trilha (A/B/C/D/E) olhando o roadmap legacy + `issuesById()` e distribua sequencialmente para os itens do lote **antes de escrever qualquer plano** (ex.: trilha B em `B78` → os dois itens de B viram `B79`, `B80`). IDs fora de trilha (chore/ops) seguem o prefixo do seu domínio conforme precedentes (`O0+`, `FD+`, `RS+`) ou a trilha temática mais próxima.

## Passo 3 — Por item: do tipo ao plano completo

Ordem topológica intra-lote (o plano do dependente cita o ID do dependido, que já existe). Por item:

1. **Classificar o tipo:**

| Tipo | Destino |
| ---- | ------- |
| Feature de `/campanha` ou site público com escopo próprio | Issue `kind:feature` com plano |
| Tarefa pequena / chore / débito de engenharia | Issue `kind:chore` + plano curto (ou body direto se trivial) |
| Défice comportamental do fluxo de agentes | `pnpm agent:file-miss` (`kind:agent-miss`), não aqui |
| Bloqueio externo (jurídico/LGPD) | Issue `blocked` + label `needs:consent`/`needs:migration`; texto novo entra no lote jurídico existente, nunca rodada separada |
| Evidência de usuário ainda inexistente (discovery) | `blocked` / defer+gatilho — não inventar feature; ver `continuous-discovery` só se o usuário pedir discovery |
| Decisão de NÃO fazer | Comentário/doc, não Issue |

2. **Explorar o código** (depth check): onde a feature se pluga, o que reusar de `src/utilities/*`, `src/components/campaign/*`, `src/lib/*`; schema novo → migration (caro de reverter → Decisão travada com rejeitadas); pessoa → join com `Contact`; opt-in/PII → `Consent` por chave estável falhando fechado. Precedente análogo em `docs/plans/` dita o nível de detalhe. Cite **caminhos reais** (context-engineering: plano legível sem dump do repo).
3. **Classificar superfície UI (A–D)** e semear âncoras: `PRODUCT.md`/`DESIGN.md`, design-ref em `docs/design-refs/latest/` se houver, shells existentes. Classe C exige **brief compacto** (persona, job, estratégia de cor, anti-goals) no plano. Proibido: rodar craft/critique/polish aqui.
4. **Dados → decisão → apresentação** ([data-presentation.md](data-presentation.md)) ou `Dados: N/A`.
5. **Decisões caras + doubt (quando couber):** para cada decisão caro-de-reverter (schema, access, Consent, URL imutável, multi-collection), use a forma Opções+Recomendação+rejeitadas. Se a decisão for **não trivial** no sentido de [decision-quality.md](decision-quality.md) § Doubt, faça um ciclo curto CLAIM → adversarial self-check (ou `Task` fresh-context) **antes** de gravar como Decisão travada. Não doubt em rename/copy.
   - **Continuação de UI/layout:** Issue nova para tracking é OK. **Proibido** travar "Item novo, não reabrir Bxx / Issues fechadas" como desculpa para só patchar localmente e deixar CSS compensatório intacto. Se o sintoma já teve 1+ tickets no mesmo eixo (padding, bleed, snap), a Decisão travada deve dizer **quem possui o inset/altura** e autorizar reescrever o código das Issues anteriores. "Não reabrir Issue fechada" = bookkeeping do GitHub, não cerca de código.
6. **Posicionamento:** prioridade `P0..P3` (jurídico/caminho crítico > base de dados > operação de campo > inteligência > plataforma), `depends` (IDs duros), appetite, janela do calendário eleitoral quando relevante, `serializes` quando toca recurso compartilhado (ex.: migrations).
7. **Fatiar em fases verticais** ([decision-quality.md](decision-quality.md) § Fatias): não “toda a DB → toda a API → toda a UI”. Cada fase = caminho fino ponta a ponta (ou o pedaço mínimo que deixa o sistema verde), com **aceite**, **verify** (`pnpm gate:fast` / pin unit|int / check manual), arquivos prováveis, tamanho S/M. **Fase 1 = tracer bullet** (schema mínimo → uma action → uma superfície, ou o menor path que prova a aposta). High-risk / incerteza primeiro. Se a fatia seria L/XL (≫5 arquivos ou >1 sessão focada) → mais fases **ou** Issue bipartida `{id}-plan` / `{id}-exec`.
8. **Boundaries Teqo** no plano (sempre, compacto): o que esta entrega **Always** / **Ask first** / **Never** — ver template. Defaults do repo (overrideAccess, transação, Consent fail-closed, sem Neon) entram em Always/Never sem inventário genérico.
9. **Source-driven (flag, não fetch):** se a Abordagem depende de API de framework (Payload Local API, Next App Router, WebAuthn), anote na fase: “na implementação, verificar docs oficiais da versão em `package.json`” — o fetch é de `work-issue` / `source-driven-development`.
10. **Plano completo** em `docs/plans/<slug>.md` seguindo [plan-template.md](plan-template.md) à risca — cabeçalho, Premissas, Objetivos como aceite, Decisões, Fases verificáveis (quota do appetite), Dados, wireframe ASCII se B/C/D com layout, guardrails, rabbit holes, adiados. Self-score ≥4/5 antes de gravar.

## Passo 4 — Sugestão de modelo × effort

Aplique a skill `model-selection` (tabela canônica) por item e registre a sugestão no cabeçalho do plano (`Model:`) e no resumo do gate. Caminho feliz único:

- `composer-2.5` — default (features, chores simples, fixes localizados, docs leves)
- `cursor-grok-4.5-low` | `cursor-grok-4.5-medium` | `cursor-grok-4.5-high` — Grok com **effort explícito** (ver model-selection: Low = mecânico com julgamento; Medium = discovery/análise; High = multi-domínio / falha cara)
- `kimi-k3-low` — **só** fase de execução de issues bipartidas (refactor / simplify / migration+RBAC de blast radius alto)

**Issues muito complexas:** registre **duas** Issues encadeadas — `{id}-plan` (`model: cursor-grok-4.5-high`, entregável = plano + critérios de aceite) e `{id}`/`{id}-exec` (`model: kimi-k3-low`, `depends: [{id}-plan]`). O valor vai ao frontmatter `model:` — propriedade da Issue, verificada (não recalculada) por `work-issue`.

## Passo 5 — GATE de confirmação (obrigatório)

Apresente no chat, **antes de criar qualquer Issue**:

- **Overview do lote** — uma linha por plano: ID, título, prio, depends, appetite, modelo sugerido, link do plano local.
- **Premissas** por item (ou bloco compartilhado do lote) — “corrija agora ou sigo”.
- **Wireframes ASCII** das superfícies B/C/D (copiados dos planos).
- **Fases em uma linha** (F1 tracer → …) quando o item tiver >1 fase.
- Perguntas acumuladas (se houver) em uma única rodada, recomendação primeiro.

O usuário confirma ou pede modificações; itere até confirmar. **Só depois** avance ao Passo 6. Planos em `docs/plans/` podem ser rascunhados antes do gate (arquivos locais isolados); ajuste-os conforme a resposta.

## Passo 6 — Registro

Por item confirmado:

```bash
pnpm agent:register -- --id <ID> --title "<título>" --prio <P0..P3> \
  --depends <A,B> --kind <feature|chore|...> --plan docs/plans/<slug>.md \
  --model <slug> [--blocked] [--labels extra]
```

A Issue nasce `ready` (ou `blocked`) com frontmatter `id/depends/serializes/priority/model` + spec + link do plano. Atualize o cabeçalho do plano (`Issue: #N`). Commit dos planos (commits lógicos por item ou por lote).

**PR só de plano (`docs/plans/` exclusivamente):** nunca use `Closes #N` / `Fixes` / `Resolves` no body — use `Related #N`. O CI (`plans-only-closes`) bloqueia keywords de fechamento; a implementação fecha a Issue em outro PR (`work-issue`).

**NÃO faz:** editar `docs/roadmap.md` (legado congelado), implementar código, claim (`pnpm agent:claim` é de `work-issue`), abrir jornada `design-code-architecture`, gravar `tasks/plan.md` / `tasks/todo.md` (artefato Teqo = `docs/plans/<slug>.md`).

## Resumo final

Tabela do lote (ID, título, prio, depends, appetite, modelo, Issue #N, plano) + em prosa: mesclados/absorvidos/descartados por duplicidade, premissas que o gate confirmou ou corrigiu, decisões assumidas _(validar com produto)_, e o que o gate decidiu.
