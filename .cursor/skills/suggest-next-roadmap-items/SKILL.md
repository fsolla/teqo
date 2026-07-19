---
name: suggest-next-roadmap-items
description: >-
  Lê docs/roadmap.md (e planos/notebook/calendário necessários), filtra o que
  já foi entregue e o que ainda está bloqueado por dependência, e sugere 3–5
  itens candidatos a serem o próximo a implementar no Teqo. Usar quando o
  usuário perguntar "o que fazer agora", "próximo item do roadmap", "o que
  priorizar", "sugere o próximo", "what's next", "qual item implementar", ou
  pedir recomendações de priorização a partir do roadmap.
---

# Sugerir próximos itens do roadmap

Esta skill **só recomenda** — não implementa, não edita o roadmap e não cria planos. O deliverable é uma shortlist ranqueada com racional, para o usuário escolher. Depois disso, o fluxo natural é `implement-roadmap-item` no ID escolhido (ou `roadmap-item` se a sugestão revelar um gap de registro).

**Divisão com as skills irmãs:**

| Skill                        | Papel                                                  |
| ---------------------------- | ------------------------------------------------------ |
| `compile-roadmap`            | Enxugar roadmap: resumir feito, destacar abertos       |
| `suggest-next-roadmap-items` | **Escolher candidatos** entre o que o roadmap já lista |
| `roadmap-item`               | Registrar ideia nova / criar plano                     |
| `implement-roadmap-item`     | Auditar plano + implementar o ID escolhido             |
| `capture-review-debts`       | Triagear débitos de `/simplify` / critique             |

## Checklist

```
- [ ] 1. Ler docs/roadmap.md inteiro + notebook do projeto
- [ ] 2. Extrair pool de itens ainda abertos (sem ✓ / sem "entregue")
- [ ] 3. Verificar dependências duras e bloqueios externos
- [ ] 4. Pontuar candidatos (calendário × valor × prontidão × risco)
- [ ] 5. Ler planos só dos top candidatos (progressive disclosure)
- [ ] 6. Entregar shortlist 3–5 + próximo passo; parar
```

## Passo 1 — Ler as fontes canônicas

Leia **nesta ordem** (não pule o roadmap):

1. **`docs/roadmap.md` inteiro** — âncoras do calendário, Onda 0, grafo mermaid, tabelas por janela, Fill-ins, Cortes seguros / não cortáveis, Bloqueadores, Fora de escopo.
2. **`.cursor/rules/projects/nucleos-eleitorais.mdc`** (ou notebook do projeto ativo) — status operacional posterior à linha "Atualizado em" do roadmap.
3. **Data de hoje** (contexto da sessão) vs âncoras do calendário eleitoral — define a janela vigente (1–4).
4. **Contexto da conversa** — se o usuário já pediu foco (ex.: "só mapa", "só DRY", "nada de fill-in"), aplique como filtro explícito.

**Não** leia todos os `docs/plans/*.md` de uma vez. Planos entram só no Passo 5, para os candidatos que sobrarem no top.

## Passo 2 — Montar o pool de abertos

Um item está **aberto** se **não** estiver marcado entregue. Sinais de entregue (qualquer um basta):

- `✓` no nó do grafo mermaid
- "(entregue YYYY-MM-DD)" / "implementado e mesclado" / "engenharia pronta e mesclada" na tabela ou seção Ciclo
- Fill-in com ✓ explícito

Exclua do pool:

- Seção **Fora de escopo** e **Itens consolidados/removidos**
- Itens cuja engenharia já está em `main` e só falta ativação externa (ex.: C2 produção = lote jurídico) — marque-os como **bloqueio operacional**, não como candidato de implementação de código
- Itens em hold explícito (ex.: E5 "futuro"; C5 "proposto — validar com produto" só entra se o usuário pedir features de produto)

Inclua Fill-ins e débitos `escala-dry-pos-*` / `*+` — eles competem na shortlist, mas com peso menor que features de caminho crítico (Passo 4).

## Passo 3 — Filtrar por prontidão

Para cada aberto, classifique:

| Estado                | Critério                                                                      | Ação na shortlist                                            |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Pronto**            | Todas as dependências **duras** (setas `-->` / coluna "Depende de") entregues | Candidato normal                                             |
| **Quase**             | Só falta dependência **suave** (`-.->`)                                       | Candidato; note o que degrada se seguir sem a suave          |
| **Bloqueado duro**    | Dependência dura aberta                                                       | Fora da shortlist; cite o predecessor a fazer antes          |
| **Bloqueado externo** | Jurídico (Onda 0), TSE após 15/08, validação de produto                       | Fora da shortlist de código; mencione em "Bloqueios"         |
| **Cortável agora**    | Está em "Cortes seguros" **e** o prazo da janela aperta                       | Só sugerir se for quick win barato ou se o usuário pedir DRY |

Confirme no notebook/código só quando o roadmap e o notebook **divergirem** (ex.: roadmap sem ✓ mas notebook diz entregue). Não faça auditoria profunda de código aqui — isso é `implement-roadmap-item`.

## Passo 4 — Pontuar e ranquear

Atribua a cada **Pronto** / **Quase** uma nota 1–5 (soma ponderada mental; não precisa ser fórmula rígida). Âncoras Teqo:

| Peso  | Critério                      | Preferir                                                                                                                                                                                                                                                  |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alto  | **Calendário**                | Serve a janela vigente (hoje → próxima âncora). Janela 1–2: produção, base nominal, agenda, fundação de dados. Janela 3: inteligência, mapa, engajamento. Janela 4: só o que falta p/ dia D + estabilização; nada de migration arriscada perto de ~20/09. |
| Alto  | **Caminho crítico**           | Onda 0 / não cortáveis > operação de campo > inteligência > plataforma/engajamento > fill-in DRY                                                                                                                                                          |
| Médio | **Paralelismo / desbloqueio** | Item que desbloqueia vários outros (ex.: A7 antes de A5/B3/E\*) ou fecha um lote (E4 após E1–E3)                                                                                                                                                          |
| Médio | **Prontidão do plano**        | Tem `docs/plans/<slug>.md` acionável > só design-ref > sem plano (C5)                                                                                                                                                                                     |
| Médio | **Custo vs valor**            | Quick win de campo / insight barato pode furar fila; cadeia `escala-dry-pos-*` só se a superfície já dói (volume, lista lenta) ou se for Fase 1 de alto ROI citada em "Cortes seguros"                                                                    |
| Baixo | **Risco**                     | Migration + Consent novo = mais caro; item só utility/seed = mais barato                                                                                                                                                                                  |

**Regras de desempate (travadas):**

1. Não sugerir como #1 um fill-in DRY se houver feature **Pronta** da janela vigente que desbloqueie operação (ex.: E4, A5 fatia, B3, A8, C4).
2. Preferir **uma fatia** de A5 (um insight) a "fazer A5 inteiro" — diga qual sub-plano.
3. Se várias cadeias DRY competem (C10, C11, E6, E7, A7, B5, O0+, …), escolha no máximo **1–2** na shortlist, priorizando as Fases que o próprio roadmap marca como "mais valiosas" em Cortes seguros.
4. Itens _(proposto — validar com produto)_ (ex.: C5) só entram se o usuário pedir exploração de produto; senão liste em "Depois / validar".
5. Trabalho externo (lote jurídico) **nunca** substitui um candidato de engenharia — reporte em seção própria.

## Passo 5 — Aprofundar só o top

Pegue os **3–5** melhores do Passo 4. Para cada um:

1. Abra o plano linkado (`docs/plans/...`) — leia cabeçalho, Status, Dependências, Não escopo, e o tamanho das fases (1 parágrafo basta).
2. Se houver design-ref na tabela do roadmap, cite o nome do par em `docs/design-refs/latest/` (não precisa abrir o HTML).
3. Classifique superficialmente Impeccable A/B/C/D (mesma tabela de `implement-roadmap-item`) — uma letra + meia frase.

Se dois candidatos forem quase equivalentes, prefira o de menor risco de migration / o que o calendário pune mais se atrasar.

## Passo 6 — Entregar e parar

Formato obrigatório da resposta (conciso; sem reescrever o roadmap):

```markdown
## Contexto

- Janela vigente: N (âncora → data)
- Bloqueios externos: …
- Foco do usuário (se houver): …

## Recomendação principal

**ID — Nome** — uma frase do porquê agora.

- Plano: `docs/plans/…`
- Dependências: ok / suave pendente: …
- Impeccable: A|B|C|D
- Próximo passo: skill `implement-roadmap-item` neste ID

## Alternativas (2–4)

| #   | ID  | Por que agora | Por que não #1 | Plano |
| --- | --- | ------------- | -------------- | ----- |
| 2   | …   | …             | …              | …     |

## Deixados de fora (amostra)

- **Bloqueados:** ID — falta X
- **Cortáveis / depois:** ID — racional curto
- **Validar com produto:** …

Quer que eu rode `implement-roadmap-item` em algum destes?
```

**Proibido neste fluxo:**

- Implementar código, abrir PR, ou marcar item como entregue
- Editar `docs/roadmap.md` / `docs/plans/` (se achar inconsistência material, **reporte** e ofereça `roadmap-item` / correção via `implement-roadmap-item` Passo 7)
- Inventar IDs ou itens que não estão no roadmap
- Shortlist > 5 candidatos "principais" (alternativas contam no total 3–5)
- Auditoria afirmação-a-afirmação do plano (isso é `implement-roadmap-item`)

Se o usuário já disser "faz o X" / "implementa o segundo", pare esta skill e invoque `implement-roadmap-item` no ID escolhido.
