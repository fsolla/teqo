---
name: compile-roadmap
description: >-
  Lê docs/roadmap.md e fontes relacionadas, classifica o que já foi entregue,
  comprime o histórico em um resumo curto e reescreve o roadmap focando nos
  próximos passos (janelas, grafo, fill-ins, bloqueadores). Usar quando o
  usuário pedir para "compilar o roadmap", "limpar o roadmap", "atualizar
  roadmap para próximos passos", "consolidar entregas no roadmap", "enxugar
  docs/roadmap.md", ou quando o arquivo estiver inchado com ciclos já
  mesclados em main.
---

# Compilar e limpar o roadmap

Esta skill **reescreve** `docs/roadmap.md` para voltar a ser um documento de **próximos passos**, não um diário de entregas. O histórico detalhado permanece nos planos (`docs/plans/`) e no notebook do projeto — o roadmap só aponta o que ainda importa operar.

**Não implementa código.** Não cria itens novos (isso é `roadmap-item`). Não escolhe o próximo a implementar (isso é `suggest-next-roadmap-items`).

**Divisão com as skills irmãs:**

| Skill                        | Papel                                                 |
| ---------------------------- | ----------------------------------------------------- |
| `compile-roadmap`            | **Enxugar** o roadmap: resumir feito, destacar aberto |
| `suggest-next-roadmap-items` | Escolher candidatos entre o que o roadmap já lista    |
| `roadmap-item`               | Registrar ideia nova / criar plano                    |
| `implement-roadmap-item`     | Auditar plano + implementar o ID escolhido            |
| `capture-review-debts`       | Triagear débitos de `/simplify` / critique            |

**Escopo padrão:** só `docs/roadmap.md`. Planos em `docs/plans/` **não** são movidos nem apagados. Só atualize/arquive planos se o usuário pedir explicitamente.

## Checklist

```
- [ ] 1. Ler fontes canônicas (roadmap + notebook + gaps)
- [ ] 2. Inventariar entregues vs abertos (com evidência)
- [ ] 3. Mostrar inventário + proposta de corte ao usuário e pedir confirmação
- [ ] 4. Reescrever docs/roadmap.md no template limpo
- [ ] 5. Verificar links, mermaid, IDs e consistência cruzada
- [ ] 6. Entregar diff resumido + o que foi cortado
```

## Passo 1 — Ler as fontes canônicas

Leia **nesta ordem** (não edite antes de inventariar):

1. **`docs/roadmap.md` inteiro** — linha "Atualizado em", Onda 0, seções Ciclo/Trilha, grafo mermaid, tabelas por janela, Fill-ins, Cortes, Bloqueadores, Site, Admin, Fora de escopo, Fontes.
2. **`.cursor/rules/projects/nucleos-eleitorais.mdc`** (ou notebook do projeto ativo) — status operacional que pode estar à frente do roadmap.
3. **`AGENTS.md`** — só as seções Known Gaps / Recently resolved / checklist de campanha (para alinhar bloqueadores e não contradizer decisões travadas).
4. **Data de hoje** (contexto da sessão) vs âncoras do calendário — define a janela vigente no cabeçalho limpo.
5. **Planos** — só sob demanda: abra `docs/plans/<slug>.md` se o status no roadmap estiver ambíguo (ex.: "implementado" vs "registrado" vs "em branch"). Não leia todos os planos de uma vez.

Fontes **fora do repo** (`plano-arquitetura-campanha-2026.md`, Cowork) só se o inventário precisar resolver um conflito; cite e não invente.

## Passo 2 — Inventariar entregues vs abertos

Monte duas listas. Sinais de **entregue** (qualquer um basta):

- `✓` no nó mermaid
- "(entregue …)" / "implementado e mesclado" / "engenharia pronta e mesclada" / "MVP entregue"
- Notebook ou AGENTS "Recently resolved" alinhado ao mesmo ID

Sinais de **ainda aberto** (manter em destaque):

- Sem marca de entrega
- "registrado" / "proposto" / "futuro" / "validar com produto"
- Engenharia em `main` mas **produção bloqueada** (ex.: C2 dados reais ↔ Onda 0) — trate como **bloqueio operacional**, não como feature a implementar de novo
- Débitos `escala-dry-pos-*` / `*+` sem ✓
- Fill-ins sem ✓
- Itens do site/admin/white-label ainda listados como próximos

Para cada ID, uma linha:

| ID  | Estado                         | Evidência (1 frase) | Plano linkado | Ação no compile          |
| --- | ------------------------------ | ------------------- | ------------- | ------------------------ |
| A4  | entregue                       | mesclado 2026-07-18 | baseline-…    | comprimir em Já entregue |
| E4  | aberto                         | janela 3            | mapa-proj…    | manter em Próximos       |
| C2  | entregue eng. / bloqueio prod. | Onda 0 Consent      | cadastro-…    | 1 linha em Já + Onda 0   |

**Não invente status.** Se roadmap e notebook divergirem, prefira o notebook + grep rápido no código só para desempate; reporte a divergência ao usuário.

## Passo 3 — Confirmar antes de escrever

Mostre ao usuário (conciso):

1. Contagem: N entregues a comprimir / M abertos a manter / K bloqueios operacionais.
2. O que **sai** do corpo detalhado (seções Ciclo 1/2/2+ verbosas, linhas de janela já ✓, design-refs só de itens feitos, prosa de migration IDs já aplicados).
3. O que **fica** (calendário, princípios, Onda 0 pendente, grafo dos abertos, janelas só com pendentes, fill-ins abertos, cortes ainda relevantes, bloqueadores, fora de escopo).
4. Pergunta: "Posso reescrever `docs/roadmap.md` assim?"

**Pare aqui até confirmação**, salvo se o usuário já tiver dito explicitamente "compila/limpa agora" neste turno.

Opcional (só se pedido): marcar `Status: Done` no topo de planos entregues, ou mover para `docs/plans/archive/` — nunca como default desta skill.

## Passo 4 — Reescrever no template limpo

Substitua o arquivo inteiro (não faça um diff cirúrgico em 40 lugares — o risco de inconsistência é maior que um rewrite controlado). Preserve:

- IDs estáveis (`A5`, `C10`, `E4`, `O0+`, …)
- Links para planos ainda relevantes
- Datas de âncora do calendário TSE
- Decisões travadas e Fora de escopo (podem enxugar prosa, não o sentido)
- Tabela de bloqueadores atualizada

Use **este esqueleto** (adicione/remova subseções só se o inventário exigir):

```markdown
# Roadmap — Teqo

Atualizado em: YYYY-MM-DD (janela N vigente; foco: …; último compile)

Registro canônico dos **próximos** planos e débitos. Histórico de entregas:
resumo abaixo + planos em [`docs/plans/`](plans/) + notebook
[`.cursor/rules/projects/nucleos-eleitorais.mdc`](../.cursor/rules/projects/nucleos-eleitorais.mdc).

## Âncoras do calendário eleitoral 2026 (Res. TSE 23.760/2026)

[tabela de datas — manter; enxugar coluna Consequência se redundante]

## Princípios e decisões travadas

[bullets curtos; sem repetir AGENTS inteiro]

## Onda 0 — caminho crítico para dados reais

[só o que AINDA falta: lote jurídico, smoke, onboarding, holds.
Não recontar migrations/features já em main — 1 frase "engenharia de
núcleos/C2/C3/… já em produção de código".]

## Já entregue (resumo)

Agrupar por trilha/ciclo em **1–3 linhas por grupo**, não por parágrafo de
implementation notes. Exemplo de densidade alvo:

- **Núcleos MVP + Ciclo 2** — auth/`campaignUser`, território A1/A2, baseline
  A3/A4, overview B1, share C1, PWA D1, geometrias B2.
- **Operação** — C2 (eng. pronta; prod. ↔ Onda 0), C3 agenda, C6–C9 escala.
- **Trilha E (parcial)** — E1+E3 metas/estratégia; E2 série/tendência; faltam E4…
- **Fill-ins** — visitados, reset senha/perfil, … (só os ✓)

Linkar o plano **só** se ainda for referência útil; não listar migration IDs
nem fases `/simplify` no resumo.

## Próximos — Campanha (`/campanha`)

### Por trilha (só abertos)

- **A** — A5, A6, A7, A8, …
- **B** — B3, B4, B5, …
- **C** — C4, C5, C10, C11, …
- **D** — D2, …
- **E** — E4, E5, E6, E7, …
- **Débitos / fill-ins abertos** — O0+, VR+, RS+, FD+, FD2, …

Cada bullet: `ID — nome` + meia frase + link do plano. Sem changelog.

### Referências de design (só itens abertos com ref)

[tabela Item | Design | Plano — remover linhas de itens já entregues]

### Grafo de dependências (abertos + predecessores mínimos)

Mermaid: incluir nós **abertos** e só os entregues que ainda são
dependência dura/suave citada. Marcar entregues com `✓` no label se
precisarem aparecer. Remover subgraphs inteiros se todos os nós estão ✓
e nenhum aberto depende deles.

### Sequência por janela (só pendentes)

Tabelas Janela 1–4: **apagar linhas já entregues**. Renumerar "Ordem"
como sequência contínua dos pendentes (ou manter números históricos só
se o usuário pedir continuidade — default = renumerar limpo).

Colunas: Ordem | Item | Plano | Depende de | Paralelizável com.

### Fill-ins abertos

Só itens sem ✓. Uma linha cada + link.

### Cortes seguros / não cortáveis

Reescrever a lista para citar **apenas IDs ainda abertos**. Remover
conselhos sobre fases já mescladas (ex.: "preferir C6 fases 1–2" se C6 ✓).

## Bloqueadores atuais

[tabela atualizada; remover resolvidos]

## Site público / Admin / White-label / Fora de escopo / Fontes

[manter seções; Site: separar Já entregue (1 linha) vs Próximos]
```

**Regras de corte (obrigatórias):**

| Cortar do roadmap compilado                                                | Manter                                 |
| -------------------------------------------------------------------------- | -------------------------------------- |
| Seções "Ciclo 1/2/2+" com notas de implementação                           | Resumo "Já entregue"                   |
| Linha "Atualizado em" enciclopédica                                        | 1 linha: data + janela + foco          |
| Migration IDs / nomes de fases `/simplify` no corpo                        | Links para planos abertos              |
| Design-refs de itens ✓                                                     | Design-refs de abertos                 |
| "Itens consolidados/removidos" antigo (salvo se ainda explicar um ID vivo) | Fora de escopo atual                   |
| Prosa duplicada AGENTS/notebook                                            | Ponteiros para AGENTS/notebook         |
| Janelas cheias de "(entregue …)"                                           | Só pendentes na janela vigente+futuras |

**Densidade alvo:** o arquivo compilado deve caber com folga na leitura de uma sessão de priorização — tipicamente **bem menor** que a versão diário. Se após o rewrite ainda parecer um changelog, corte mais o "Já entregue".

## Passo 5 — Verificar

Antes de declarar pronto:

- [ ] Todo ID **aberto** do inventário aparece em Próximos **ou** Bloqueadores **ou** Fill-ins
- [ ] Nenhum ID entregue reaparece como tarefa a fazer (exceto bloqueio operacional explícito, ex. "C2 dados reais")
- [ ] Links `plans/…` dos itens abertos resolvem (grep / existência do arquivo)
- [ ] Mermaid parseia (sem nós órfãos óbvios; setas só entre IDs que existem no diagrama)
- [ ] Âncoras de calendário e "não cortáveis" ainda cobrem Onda 0 / base nominal / agenda se forem política vigente
- [ ] Skills irmãs continuam válidas: `suggest-next-roadmap-items` e `roadmap-item` devem conseguir operar no arquivo limpo

Se achar item **aberto sem plano**, não invente o plano — liste no resumo final e ofereça `roadmap-item`.

## Passo 6 — Entregar

Resposta ao usuário:

```markdown
## Roadmap compilado

- Arquivo: `docs/roadmap.md`
- Comprimidos: N itens → seção Já entregue
- Em foco: M abertos (janela vigente: …)
- Bloqueios operacionais: …

## Principais cortes

- …

## Próximo passo sugerido

Rodar `suggest-next-roadmap-items` na versão limpa?
```

**Proibido neste fluxo:**

- Implementar código, abrir PR, ou marcar entregas que não estavam evidenciadas
- Apagar ou mover `docs/plans/*` sem pedido explícito
- Inventar IDs / reabrir itens "Fora de escopo"
- Expandir o roadmap com ideias novas (use `roadmap-item`)
- Deixar a linha "Atualizado em" como parágrafo de changelog de novo

## Exemplo de compressão

**Antes (ruim no roadmap compilado):**

> **C6 Escala e DRY pós-C2 — implementado e mesclado em `main` (2026-07-19)** — import bulk drizzle, token HMAC + `supporterImportBatch`, KPI aggregate, shells… Duas passagens `/simplify`; débitos maiores → C8.

**Depois (resumo):**

> **Operação / escala** — C2–C3 + C6–C9 em `main` (C2 prod. ↔ Onda 0). Débitos abertos: C10, C11.
