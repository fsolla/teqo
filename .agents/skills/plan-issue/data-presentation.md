# Dados → decisão (intenção) → forma (implementação)

Quando um item **produz, agrega ou exibe** números, séries, rankings, mapas ou KPIs. Kernel Teqo: `PRODUCT.md` §5 + `docs/research/` — disputa de DF é relativa/local, não % estadual absoluto.

| Fase | Skill | O que decide |
| ---- | ----- | ------------ |
| Intenção | `plan-issue` | Vou apresentar dados? Quais **decisões de ator** isso desbloqueia? Restrições de produto. |
| Implementação | `work-issue` / `agent-work-issue` | Forma concreta (número+contexto / lista / série / mapa / chart) + rejeitadas técnicas. |

Se o item **não** apresenta dados: `Dados: N/A` no plano de intenção e pule o resto.

## Na intenção (`plan-issue`)

Ordem fixa:

```text
1. Vou apresentar dados?
2. Quais decisões serão tomadas a partir destes dados?
```

### 1. Vou apresentar dados?

| Resposta | Ação |
| -------- | ---- |
| **Não** | `Dados: N/A` |
| **Sim, derivado / API só** | Registrar quem consome; UI no dono |
| **Sim, superfície neste item** | Preencher decisões desbloqueadas + restrições |

Profile rápido (opcional): tipo / granularidade / absoluto vs relativo.

### 2. Decisões desbloqueadas

Formato **ator + escolha**. Sem decisão nomeável → vaidade; corte.

**Não** escolha chart/mapa/KPI aqui. Registre só anti-goals de produto (ex.: sem gauge SaaS, sem % estadual absoluto).

## Na implementação (`*-impl.md`)

Responda a pergunta 3 com Opções + Recomendação + rejeitadas, alinhado a [decision-quality.md](../work-issue/decision-quality.md) e ao research Teqo. Preferir a forma mais pobre que ainda desbloqueia a decisão.
