---
name: capture-review-debts
description: Use when the user asks to register leftover /simplify or /impeccable findings on the Teqo roadmap, harvest session review debts, triage post-simplify or post-critique follow-ups, or says "registra os débitos", "o que ficou do simplify", "coloca no roadmap o que o critique apontou", "harvest debts".
---

# Capturar débitos de /simplify e /impeccable no roadmap

Após um ciclo de entrega, `/simplify` e `/impeccable` deixam achados **maiores que o cleanup da sessão**. Esta skill **triageia** esses achados a partir do contexto da sessão, decide o que vira roadmap (e o que não), **mescla** o que for do mesmo lote, e só então registra via **`roadmap-item`**. Não implementa código.

**REQUIRED SUB-SKILL:** Use `roadmap-item` para qualquer inclusão/absorção no `docs/roadmap.md` + `docs/plans/`. Nunca edite roadmap/planos ad hoc neste fluxo.

Precedente canônico: um plano `escala-dry-pos-*` (engenharia pós-simplify) e/ou um plano UX pós-critique (ex.: FD+ vs FD2) — tipos **separados**, fases internas mescladas.

## Checklist

```
- [ ] 1. Colher candidatos da sessão (simplify + impeccable)
- [ ] 2. Deduplicar contra código, roadmap e planos
- [ ] 3. Pontuar importância e classificar destino
- [ ] 4. Mesclar relacionados (mesmo lote / mesma superfície)
- [ ] 5. Apresentar tabela de triage e obter confirmação
- [ ] 6. Registrar só o aprovado via roadmap-item (1 invocação por item/plano)
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
| Já em `docs/plans/*.md` ou roadmap (grep termos/paths) | → **absorver** no plano existente ou **descartar** como coberto |
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

**Destino** (escolha exatamente um):

| Destino          | Critério                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **registrar**    | Score ≥3 **e** não coberto; cabe num plano próprio ou lote mesclado                                                            |
| **absorver**     | Score ≥3 mas é fase natural de um plano/`escala-dry-pos-*`/UX já existente                                                     |
| **descartar**    | Score ≤2 **ou** rename de pureza **ou** "nice to have" sem dono de produto **ou** revisores do simplify pediram skip explícito |
| **já_resolvido** | Feito no cleanup da sessão                                                                                                     |

**Separação de tipos (não misturar num único plano):**

- **Engenharia / escala / DRY** → família `escala-dry-pos-<slug>.md`, IDs tipo `A7`, `C11`, `FD+`, `RS+`, `O0+` (fill-in ou próximo ID da trilha).
- **UX / produto pós-critique** → plano tipo `*-ux-pos-critique.md` ou fases num FD2 existente (`Impeccable: B|C|D` no `roadmap-item`).
- Nunca fundir N+1 SQL com "glossário de engajado" no mesmo item (precedente FD+ ≠ FD2).

**Impeccable no registro:** ao chamar `roadmap-item`, a classificação A–D dele vale — débitos só-backend são **A**; UX pós-critique são **B** (encaixe) ou **C** se fluxo novo.

## Passo 4 — Mesclar

Dentro do **mesmo tipo** (engenharia **ou** UX):

- Mesclar se compartilham **superfície** (mesma rota/loader/shell) **ou** **pai** (mesmo item do roadmap que acabou de ser entregue).
- Um plano, várias **fases** ordenadas por ROI (perf/access antes de DRY cosmético; P2 produto antes de P3 motion).
- Não mesclar across pais não relacionados (débito do C3 com débito do reset de senha → dois itens).
- Se sobrar um único achado score ≥3, ainda assim um plano curto é melhor que linha órfã no roadmap sem plano.

Alvo de merge: **1 plano engenharia + no máximo 1 plano UX** por sessão de entrega, salvo pais distintos.

## Passo 5 — Tabela de triage + confirmação

Mostre ao usuário **antes** de editar docs:

```markdown
| ID  | Resumo        | Origem           | Score | Destino        | Lote mesclado   |
| --- | ------------- | ---------------- | ----- | -------------- | --------------- |
| S1  | …             | simplify/perf    | 4     | registrar      | Escala pós-X F1 |
| I2  | …             | critique P2      | 3     | absorver → FD2 | —               |
| S3  | rename pureza | simplify/quality | 2     | descartar      | —               |
```

Inclua baldes **já_resolvido** e **descartar** com uma linha de racional cada (transparência > silêncio).

**Pare e confirme.** Só avance ao Passo 6 com aprovação explícita (ou ajuste pedido). Sem confirmação = não toca `docs/roadmap.md` / `docs/plans/`.

## Passo 6 — Registrar via `roadmap-item`

Para cada lote com destino **registrar** ou **absorver**:

1. Invoque **`roadmap-item`** com o escopo do lote (não um item por achado micro).
2. Se **absorver**: peça à skill para editar o plano existente (nova fase/seção), não criar ID paralelo — mesmo precedente "Gap vs 2022".
3. Se **registrar**: slug `escala-dry-pos-<pai>` ou `<surface>-ux-pos-critique`; posicione como fill-in (paralelo) salvo dependência dura de trilha.
4. No plano, seções obrigatórias além do template:
   - **Já resolvido no simplify/critique (não reabrir)**
   - **Explicitamente fora** (skips dos revisores + descartes deste triage)
5. Classe Impeccable A–D conforme `roadmap-item` Passo 4.

Não implemente as fases aqui. Apontar `implement-roadmap-item` só se o usuário pedir em seguida.

## Anti-padrões (baseline)

| Desculpa                                 | Realidade                                                             |
| ---------------------------------------- | --------------------------------------------------------------------- |
| "Virou um item por achado"               | Mesclar no lote; roadmap poluído é pior que débito omitido de score 2 |
| "Edito o roadmap na mão, é só um bullet" | Sempre `roadmap-item` (grafo, janela, plano, cortes)                  |
| "Rename PascalCase / pureza merece ID"   | Score ≤2 → descartar, a menos que desbloqueie reuso real já pedido    |
| "Junto DRY e UX num FD+"                 | Quebra o precedente FD+/FD2; tipos separados                          |
| "Não li o plano existente"               | Grep primeiro; absorver > duplicar                                    |
| "Registro sem perguntar"                 | Passo 5 é gate; docs de produto não são scratchpad                    |

## Resumo ao usuário

1. Contagem: colhidos / já_resolvidos / descartados / absorvidos / a registrar
2. Tabela de triage (final pós-confirmação)
3. IDs/slugs criados ou planos estendidos (links)
4. O que ficou de fora de propósito (e por quê)
