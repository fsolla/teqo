---
name: capture-review-debts
description: Use when the user asks to register leftover /simplify or /impeccable findings as trackable GitHub Issues, harvest session review debts, triage post-simplify or post-critique follow-ups, or says "registra os débitos", "o que ficou do simplify", "coloca como issue o que o critique apontou", "harvest debts".
---

# Capturar débitos de /simplify e /impeccable em Issues

Após um ciclo de entrega, `/simplify` e `/impeccable` deixam achados **maiores que o cleanup da sessão**. Esta skill **triageia** esses achados a partir do contexto da sessão, decide o que vira Issue rastreável (e o que não), **mescla** o que for do mesmo lote, e só então registra via **`pnpm agent:register`** (lotes `kind:chore|defect`, com plano curto em `docs/plans/` quando score ≥3) ou **`pnpm agent:file-miss`** (`kind:agent-miss`, défice comportamental do fluxo de agentes). Não implementa código.

**Regra inviolável — nunca editar Issue `in-progress`.** Nem para absorver um débito do mesmo pai: registra como **Issue nova** com `depends: [<id-do-pai>]` no frontmatter — assim ela destrava sozinha na fila quando o pai flipar `done` — ou defer com gatilho. Editar a Issue que um agente está executando é esquecimento/conflito garantido.

**Qualidade de decisão:** [decision-quality.md](../work-issue/decision-quality.md) — caro vs barato, defer+gatilho, depth/YAGNI. Score sozinho não basta: classifique o **tipo de decisão** na triage. Sem tour de fases.

## Checklist

```
- [ ] 1. Colher candidatos da sessão (simplify + impeccable)
- [ ] 2. Deduplicar contra código, Issues (`pnpm issue all`) e planos
- [ ] 3. Pontuar importância e classificar destino
- [ ] 4. Mesclar relacionados (mesmo lote / mesma superfície)
- [ ] 5. Apresentar tabela de triage e obter confirmação
- [ ] 6. Registrar só o aprovado (agent:register / agent:file-miss; plano curto quando score ≥3)
```

## Passo 1 — Colher candidatos

Fontes (nesta ordem; não invente achados que não apareceram):

1. **Mensagens da sessão atual** — resumos finais de `/simplify` ("skipped", "recommend", "larger than cleanup"), P0–P3 de `/impeccable critique`, notas de polish não feitos.
2. **Snapshots** — `.impeccable/critique/*.md` do alvo da sessão (mais recente por superfície).
3. **Diff local** — só para verificar se um achado já foi aplicado; não para minerar débitos novos.
4. **Transcripts** — só se a sessão atual for curta demais e o usuário apontar um chat anterior.

Para cada candidato, registre uma linha bruta:

| Campo       | Conteúdo                                            |
| ----------- | --------------------------------------------------- |
| `id`        | S1, S2… (simplify) / I1, I2… (impeccable)           |
| `origem`    | simplify quality\|perf\|reuse **ou** critique P0–P3 |
| `resumo`    | uma frase                                           |
| `evidência` | quote curto / path / heurística                     |
| `já_feito?` | sim se o diff/código já resolve                     |

**Ignore na colheita:** elogios, sugestões hipotéticas sem achado, itens que o próprio simplify marcou como "fixed".

## Passo 2 — Deduplicar

Contra o repositório **antes** de pontuar:

| Check                                                  | Ação se verdadeiro                                              |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| Já no diff / código da sessão                          | → balde **já_resolvido** (não reabrir)                          |
| Já em `docs/plans/*.md` ou numa Issue (grep + `pnpm issue all`) | → **absorver** no plano existente ou **descartar** como coberto |
| Pré-existente em `main`, fora do escopo da entrega     | → **descartar** deste lote (bug separado só se o usuário pedir) |
| Intentional em `DESIGN.md` / decisão travada           | → **descartar** (ex.: field-mode mobile documentado)            |

## Passo 3 — Pontuar e decidir destino

Para cada candidato restante, atribua **importância** (1–5) com estes âncoras Teqo:

| Score | Quando                                                                                      |
| ----- | ------------------------------------------------------------------------------------------- |
| 5     | Bloqueia feature dependente, hot path em produção, P0/P1 critique aberto, risco access/LGPD |
| 4     | Perf/DRY com ≥3 call sites ou custo herdado por A5/B3/E4/lista de núcleos                   |
| 3     | UX P2 acionável (Alex/Casey/Lia), DRY claro 2 call sites, a11y outline                      |
| 2     | Higiene/naming, polish cosmético, P3 critique                                               |
| 1     | Preferência de estilo, rename de pureza, micro-otimização sem evidência                     |

**Bump caro de reverter:** access/LGPD/schema/unicidade/hot path → piso de score **4–5**, mesmo que o simplify tenha rotulado como “nice cleanup”.

**Tipo de decisão** (obrigatório — uma coluna na triage):

| Tipo               | Exemplos                                  | Destino típico                                                                                                           |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **expensive_lock** | access, Consent, uniqueness, write skew   | registrar / absorver (nunca descartar por score baixo artificial)                                                        |
| **cheap_polish**   | copy, motion, rename, P3                  | descartar ou já_resolvido                                                                                                |
| **defer_trigger**  | DRY &lt;3 call sites, abstração prematura | **não registrar** como epic — anotar gatilho (`quando 3º bulk path`, `quando B3`) no plano-pai ou em Explicitamente fora |

**Destino** (escolha exatamente um):

| Destino          | Critério                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| **registrar**    | Score ≥3 **e** não coberto **e** tipo ≠ defer_trigger puro; cabe num plano próprio ou lote mesclado                   |
| **absorver**     | Score ≥3 mas é fase natural de um plano/`escala-dry-pos-*`/UX já existente                                            |
| **descartar**    | Score ≤2 **ou** rename de pureza **ou** "nice to have" sem dono **ou** skip explícito do simplify **ou** cheap_polish |
| **defer**        | Tipo defer_trigger: não cria ID novo; registra gatilho no plano-pai / Explicitamente fora                             |
| **já_resolvido** | Feito no cleanup da sessão                                                                                            |

Preferir **defer+gatilho** a **registrar** para DRY prematuro — alinha a YAGNI / deep modules e aos precedentes `escala-dry-pos-*`.

**Separação de tipos (não misturar num único plano):**

- **Engenharia / escala / DRY** → família `escala-dry-pos-<slug>.md`, IDs tipo `A7`, `C11`, `FD+`, `RS+`, `O0+` (fill-in ou próximo ID da trilha).
- **UX / produto pós-critique** → plano tipo `*-ux-pos-critique.md` ou fases num FD2 existente (`Impeccable: B|C|D` no registro via `plan-issue`).
- Nunca fundir N+1 SQL com "glossário de engajado" no mesmo item (precedente FD+ ≠ FD2).
- Nunca fundir **expensive_lock** com **cheap_polish** no mesmo lote sem fases ordenadas (lock primeiro).

**Impeccable no registro:** a classificação A–D de `plan-issue` vale — débitos só-backend são **A**; UX pós-critique são **B** (encaixe) ou **C** se fluxo novo.

## Passo 4 — Mesclar

Dentro do **mesmo tipo** (engenharia **ou** UX):

- Mesclar se compartilham **superfície** (mesma rota/loader/shell) **ou** **pai** (mesma Issue que acabou de ser entregue).
- Um plano, várias **fases** ordenadas por ROI (expensive_lock / perf/access antes de DRY cosmético; P2 produto antes de P3 motion).
- Declarar **appetite** do lote (ex. `~1 dia eng fill-in`) para a Issue não virar epic sem teto.
- Não mesclar across pais não relacionados (débito do C3 com débito do reset de senha → dois itens).
- Se sobrar um único achado score ≥3, ainda assim um plano curto é melhor que Issue órfã sem plano.

Alvo de merge: **1 plano engenharia + no máximo 1 plano UX** por sessão de entrega, salvo pais distintos.

## Passo 5 — Tabela de triage + confirmação

Mostre ao usuário **antes** de editar docs:

```markdown
| ID  | Resumo        | Origem           | Score | Tipo decisão    | Destino        | Lote mesclado    |
| --- | ------------- | ---------------- | ----- | --------------- | -------------- | ---------------- |
| S1  | …             | simplify/perf    | 4     | expensive_lock  | registrar      | Escala pós-X F1  |
| S2  | shared helper | simplify/reuse   | 3     | defer_trigger   | defer          | gatilho: 3º path |
| I2  | …             | critique P2      | 3     | cheap_polish→P2 | absorver → FD2 | —                |
| S3  | rename pureza | simplify/quality | 2     | cheap_polish    | descartar      | —                |
```

Inclua baldes **já_resolvido**, **descartar** e **defer** com uma linha de racional/gatilho cada (transparência > silêncio).

**Pare e confirme** — exceto em **modo autônomo** (`work-issue` pós-plano /
`agent-work-issue` / pool): aí aplique a seção Modo autônomo abaixo e pule o
AskQuestion. Só avance ao Passo 6 com aprovação explícita (humano) ou com as
regras do modo autônomo. Sem isso = não cria Issue nem toca `docs/plans/`.

## Passo 6 — Registrar via `agent:register` / `agent:file-miss`

Para cada lote com destino **registrar** ou **absorver**:

1. Lotes de engenharia/UX: `pnpm agent:register -- --id <ID> --title "<título>" --prio <P> --kind chore --plan docs/plans/<slug>.md` — **um lote mesclado, não um item por achado micro**. Inclua appetite e rabbit holes do lote no plano curto. Com `--plan`, a Issue nasce `blocked` (OPS17) até o plano estar em `main` e `pnpm agent:ready -- --issue <N>` (no fechamento da sessão após o merge, ou via OPS18).
2. Défice comportamental do fluxo de agentes (algo que o agente errou e a convenção não pegou): `pnpm agent:file-miss` (`kind:agent-miss`) — alimenta o harvest do `engineering-audit`.
3. Se **absorver** num plano existente: edite o plano (nova fase/seção) — mesmo precedente "Gap vs 2022". **Se a Issue dona do plano estiver `in-progress`, NÃO a edite** — registra como Issue nova com `--depends <id-do-pai>` (destrava sozinha quando o pai flipar `done`).
4. Se **defer**: anote o gatilho no plano-pai (Adiado com gatilho / Explicitamente fora) ou na mensagem de triage confirmada — não crie Issue só por isso.
5. No plano, seções obrigatórias além do template:
   - **Já resolvido no simplify/critique (não reabrir)**
   - **Explicitamente fora** (skips dos revisores + descartes + defers com gatilho deste triage)
6. Self-score de decisão ≥4/5 antes de gravar; classe Impeccable A–D conforme o lote (só-backend = A; UX pós-critique = B/C).

Não implemente as fases aqui. Execução é via `work-issue` / `agent-work-issue`, só se o usuário (ou o pipeline autônomo) seguir.

**Próximo no fluxo de entrega:** após a triage (confirmada ou modo autônomo), o fechamento segue o Passo 6 de `agent-work-issue` / `work-issue` (`pnpm push` → PR no GitHub `--base main` com `Closes #N` → auto-merge nativo → CI).

## Modo autônomo (`work-issue` pós-plano / `agent-work-issue` / pool)

Quando não há humano no gate (Passo 5):

1. Faça colheita, dedup, score e tipo como de costume.
2. **`work-issue`** (humano presente só no plano): decida o destino pela
   triage completa (Passos 3–4) — registre o que a triage manda (score ≥3
   registrar, expensive_lock com piso 4–5), absorva em plano existente,
   defira com gatilho ou descarte o resto — **sem abrir AskQuestion**.
3. **Pool (`agent-work-issue`):** registre só itens `expensive_lock` com
   score ≥4 (Issue nova + `depends` no pai se preciso; plano curto se
   score ≥3 eng).
4. Todo o resto → **defer** (gatilho no `*-impl.md` / Explicitamente fora)
   ou **descartar** — não abra AskQuestion.
5. Resuma no comentário/fechamento o que registrou vs deferiu vs descartou.

## Anti-padrões (baseline)

| Desculpa                                 | Realidade                                                             |
| ---------------------------------------- | --------------------------------------------------------------------- |
| "Virou um item por achado"               | Mesclar no lote; backlog poluído é pior que débito omitido de score 2 |
| "Registro ad hoc, é só um bullet" | Sempre `agent:register` com frontmatter completo (id/depends/priority/model) |
| "Rename PascalCase / pureza merece ID"   | Score ≤2 → descartar, a menos que desbloqueie reuso real já pedido    |
| "Junto DRY e UX num FD+"                 | Quebra o precedente FD+/FD2; tipos separados                          |
| "DRY com 1 call site vira escala-dry"    | defer_trigger + gatilho; não registrar epic YAGNI                     |
| "Não li o plano existente"               | Grep primeiro; absorver > duplicar                                    |
| "Registro sem perguntar"                 | Passo 5 é gate (humano-gated); em modo autônomo o agente decide e registra    |
| "Corto access/LGPD do lote por tempo"    | expensive_lock nunca é cortável por appetite                          |

## Resumo ao usuário

1. Contagem: colhidos / já_resolvidos / descartados / deferidos / absorvidos / a registrar
2. Tabela de triage (final pós-confirmação), com coluna tipo de decisão
3. IDs/slugs criados ou planos estendidos (links) + appetite dos lotes
4. O que ficou de fora de propósito (e por quê / gatilho)
