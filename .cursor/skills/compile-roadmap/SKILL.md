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
| `rebase-on-main`             | Após simplify: fetch + rebase em main + conflitos     |
| `capture-review-debts`       | Triagear débitos de `/simplify` / critique            |
| `ship-to-main`               | Commit + push + merge main + apagar worktree          |
| `close-delivery`             | Orquestra rebase + debts (auto-confirm) + ship        |

**Escopo padrão:** só `docs/roadmap.md`. Planos em `docs/plans/` **não** são movidos nem apagados. Só atualize/arquive planos se o usuário pedir explicitamente.

**Qualidade de decisão (não é tour):** ao comprimir, aplique o filtro de [decision-quality.md](../roadmap-item/decision-quality.md) em escala de documento — enxuga **prosa**, não apaga locks caros nem gatilhos de defer. Inspired-product: Próximos em **problema/resultado**, não feature factory; compile **não** roda discovery nem reescreve o roadmap como OKRs.

Compile **não** reordena estratégia nem inventa datas de ship para IDs abertos. Âncoras TSE ficam (restrição externa real).

## Checklist

```
- [ ] 1. Ler fontes canônicas (roadmap + notebook + gaps)
- [ ] 2. Inventariar entregues vs abertos (com evidência + tipo de decisão)
- [ ] 3. Mostrar inventário + proposta de corte ao usuário e pedir confirmação
- [ ] 4. Reescrever docs/roadmap.md no template limpo (outcome em Próximos; gatilhos intactos)
- [ ] 5. Verificar links, mermaid, IDs, locks/gatilhos e self-score (≥4/5)
- [ ] 6. Entregar diff resumido + o que foi cortado
```

## Passo 1 — Ler as fontes canônicas

Leia **nesta ordem** (não edite antes de inventariar):

1. **`docs/roadmap.md` inteiro** — linha "Atualizado em", Onda 0, seções Ciclo/Trilha, grafo mermaid, tabelas por janela, Fill-ins, Cortes, Bloqueadores, Site, Admin, Fora de escopo, Fontes.
2. **`.cursor/rules/projects/nucleos-eleitorais.mdc`** (ou notebook do projeto ativo) — status operacional que pode estar à frente do roadmap.
3. **`AGENTS.md`** — só as seções Known Gaps / Recently resolved / checklist de campanha (para alinhar bloqueadores e não contradizer decisões travadas).
4. **Data de hoje** (contexto da sessão) vs âncoras do calendário — define a janela vigente no cabeçalho limpo.
5. **Planos** — só sob demanda: abra `docs/plans/<slug>.md` se o status no roadmap estiver ambíguo (ex.: "implementado" vs "registrado" vs "em branch") **ou** se precisar do **Appetite** / **Adiado com gatilho** / outcome do item aberto. Não leia todos os planos de uma vez.

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

Para cada ID, uma linha (coluna **Tipo** obrigatória — guia keep/compress/drop):

| ID  | Estado                         | Tipo           | Evidência (1 frase) | Plano linkado  | Ação no compile          |
| --- | ------------------------------ | -------------- | ------------------- | -------------- | ------------------------ |
| A4  | entregue                       | —              | mesclado 2026-07-18 | baseline-…     | comprimir em Já entregue |
| E4  | aberto                         | delivery_open  | janela 3            | mapa-proj…     | manter em Próximos       |
| C2  | entregue eng. / bloqueio prod. | expensive_lock | Onda 0 Consent      | cadastro-…     | 1 linha em Já + Onda 0   |
| C8  | aberto                         | defer_trigger  | gatilho: 3º bulk    | escala-dry-…   | manter + **gatilho**     |
| C5  | proposto                       | assumption     | validar c/ produto  | (ou sem plano) | Próximos + **A validar** |

**Tipos** (alinhados a `capture-review-debts` / `decision-quality.md`):

| Tipo               | Significado                                                          | No compile                                           |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| **expensive_lock** | Consent, access, unicidade, path crítico eleitoral, hold de produção | Nunca “cortar por densidade”; Onda 0 / não cortáveis |
| **delivery_open**  | Feature/débito pronto para entrega engenharia                        | Próximos com meia frase de **problema/resultado**    |
| **defer_trigger**  | Adiado com evidência de revisitação (DRY prematuro, etc.)            | Manter gatilho visível; não virar “depois” vago      |
| **assumption**     | _(proposto — validar)_, sem plano, sem evidence de discovery         | Faixa **A validar**; não inventar data de ship       |

**Não invente status.** Se roadmap e notebook divergirem, prefira o notebook + grep rápido no código só para desempate; reporte a divergência ao usuário.

**Checagem feature-factory (Inspired, 30s):** se a maioria dos abertos for só nome de feature sem problema/resultado, e vários forem `assumption`, anote no Passo 3 — o rewrite deve corrigir a prosa dos bullets, **não** expandir o escopo nem rodar discovery.

## Passo 3 — Confirmar antes de escrever

Mostre ao usuário (conciso):

1. Contagem: N entregues a comprimir / M abertos a manter / K bloqueios operacionais / A assumptions / D defers com gatilho.
2. O que **sai** do corpo detalhado (seções Ciclo 1/2/2+ verbosas, linhas de janela já ✓, design-refs só de itens feitos, prosa de migration IDs já aplicados, solution-spec de itens ✓).
3. O que **fica** (calendário, princípios/**locks caros**, Onda 0 pendente, grafo dos abertos, janelas só com pendentes, fill-ins abertos, cortes reescritos por tipo, bloqueadores, fora de escopo, faixa A validar se houver).
4. Anti-corte explícito: nenhum `expensive_lock` será movido para Cortes seguros só para enxugar.
5. Pergunta: "Posso reescrever `docs/roadmap.md` assim?"

**Pare aqui até confirmação**, salvo se o usuário já tiver dito explicitamente "compila/limpa agora" neste turno.

Opcional (só se pedido): marcar `Status: Done` no topo de planos entregues, ou mover para `docs/plans/archive/` — nunca como default desta skill.

## Passo 4 — Reescrever no template limpo

Substitua o arquivo inteiro (não faça um diff cirúrgico em 40 lugares — o risco de inconsistência é maior que um rewrite controlado). Preserve:

- IDs estáveis (`A5`, `C10`, `E4`, `O0+`, …)
- Links para planos ainda relevantes
- Datas de âncora do calendário TSE (restrição externa — **não** inventar datas de ship para IDs abertos)
- Decisões travadas **caras** e Fora de escopo (podem enxugar prosa, não o sentido)
- Gatilhos de `defer_trigger` / “Adiado com gatilho” dos planos abertos
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

[bullets curtos = locks caros de reverter + políticas vigentes;
sem repetir AGENTS inteiro; sem prosa de implementação]

## Onda 0 — caminho crítico para dados reais

[só o que AINDA falta: lote jurídico, smoke, onboarding, holds.
Não recontar migrations/features já em main — 1 frase "engenharia de
núcleos/C2/C3/… já em produção de código".
expensive_lock: nunca omitir hold de Consent / LGPD ainda aberto.]

## Já entregue (resumo)

Agrupar por trilha/ciclo em **1–3 linhas por grupo**, não por parágrafo de
implementation notes. Exemplo de densidade alvo:

- **Núcleos MVP + Ciclo 2** — auth/`campaignUser`, território A1/A2, baseline
  A3/A4, overview B1, share C1, PWA D1, geometrias B2.
- **Operação** — C2 (eng. pronta; prod. ↔ Onda 0), C3 agenda, C6–C9 escala.
- **Trilha E (parcial)** — E1+E3 metas/estratégia; E2 série/tendência; faltam E4…
- **Fill-ins** — visitados, reset senha/perfil, … (só os ✓)

Linkar o plano **só** se ainda for referência útil; não listar migration IDs
nem fases `/simplify` no resumo. Já entregue = output comprimido (ok).

## Próximos — Campanha (`/campanha`)

### Por trilha (só abertos)

- **A** — …
- **B** — …
- **C** — …
- **D** — …
- **E** — …
- **Débitos / fill-ins abertos** — …

Cada bullet: `ID — nome` + **meia frase de problema/resultado** (Inspired:
outcome > output) + link do plano. Sem changelog, sem solution-spec.
Se `defer_trigger`: incluir `· gatilho: <evidência>`.
Se `assumption`: marcar _(validar)_ — não inventar data.

### A validar (assumptions)

[Opcional — só se o inventário tiver `assumption`. Lista curta: ID + o que
falta validar. Impede que `suggest-next` trate como delivery pronto.
Não rodar discovery aqui — só surfacing.]

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

Não adicionar coluna de “deadline de feature” inventada — só âncoras TSE
no cabeçalho/calendário.

### Fill-ins abertos

Só itens sem ✓. Uma linha cada + link. Preferir problema/resultado.
`defer_trigger`: gatilho na mesma linha.

### Cortes seguros / não cortáveis

Reescrever a lista para citar **apenas IDs ainda abertos**. Remover
conselhos sobre fases já mescladas (ex.: "preferir C6 fases 1–2" se C6 ✓).

- **Não cortáveis** = `expensive_lock` + path crítico eleitoral / Onda 0 /
  base nominal / agenda se forem política vigente. Enxugar **nunca** move
  lock caro para Cortes seguros.
- **Cortes seguros** = `delivery_open` barato / polish / assumption sem
  evidence — com racional de uma linha. Não cortar o caro “para caber”.

## Bloqueadores atuais

[tabela atualizada; remover resolvidos; holds operacionais explícitos]

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
| Solution-spec / prosa de feature nos Próximos                              | Meia frase problema/resultado          |
| Gatilho perdido (“depois”, “backlog”)                                      | `gatilho: <evidência>` intacto         |
| "Itens consolidados/removidos" antigo (salvo se ainda explicar um ID vivo) | Fora de escopo atual                   |
| Prosa duplicada AGENTS/notebook                                            | Ponteiros para AGENTS/notebook         |
| Janelas cheias de "(entregue …)"                                           | Só pendentes na janela vigente+futuras |
| Locks caros “para enxugar”                                                 | Onda 0 / não cortáveis / princípios    |

**Densidade alvo:** o arquivo compilado deve caber com folga na leitura de uma sessão de priorização — tipicamente **bem menor** que a versão diário. Se após o rewrite ainda parecer um changelog, corte mais o "Já entregue" — **não** corte Onda 0 nem gatilhos.

**Smell Inspired (corrigir na prosa, não no escopo):**

| Se…                                         | Então…                                      |
| ------------------------------------------- | ------------------------------------------- |
| Próximos = só nomes de feature              | Reescrever bullets como problema/resultado  |
| Vários `assumption` misturados com delivery | Separar faixa **A validar**                 |
| Linguagem de compromisso com data inventada | Remover data; manter só âncora TSE / janela |

## Passo 5 — Verificar

Antes de declarar pronto:

- [ ] Todo ID **aberto** do inventário aparece em Próximos **ou** Bloqueadores **ou** Fill-ins **ou** A validar
- [ ] Nenhum ID entregue reaparece como tarefa a fazer (exceto bloqueio operacional explícito, ex. "C2 dados reais")
- [ ] Links `plans/…` dos itens abertos resolvem (grep / existência do arquivo)
- [ ] Mermaid parseia (sem nós órfãos óbvios; setas só entre IDs que existem no diagrama)
- [ ] Âncoras de calendário e "não cortáveis" ainda cobrem Onda 0 / base nominal / agenda se forem política vigente
- [ ] Nenhum `expensive_lock` foi movido para Cortes seguros ou omitido da Onda 0 por densidade
- [ ] Nenhum `defer_trigger` perdeu o **gatilho** (não virou “depois” vago)
- [ ] Bullets de Próximos legíveis como problema/resultado (não solution-spec)
- [ ] Skills irmãs continuam válidas: `suggest-next-roadmap-items` e `roadmap-item` devem conseguir operar no arquivo limpo

**Self-score (0–5, ≥4 para declarar pronto)** — 1 ponto cada:

1. Ainda é documento de **próximos**, não diário de entregas?
2. Locks caros (Onda 0 / não cortáveis / princípios) intactos?
3. Gatilhos de defer preservados?
4. Próximos em outcome/problema (não feature factory)?
5. Assumptions separados ou marcados _(validar)_?

Se &lt;4 → corrigir o arquivo antes do Passo 6. Se achar item **aberto sem plano**, não invente o plano — liste no resumo final e ofereça `roadmap-item`.

## Passo 6 — Entregar

Resposta ao usuário:

```markdown
## Roadmap compilado

- Arquivo: `docs/roadmap.md`
- Comprimidos: N itens → seção Já entregue
- Em foco: M abertos (janela vigente: …)
- Bloqueios operacionais: …
- Assumptions / a validar: …
- Defers com gatilho preservados: …
- Qualidade de compile: N/5

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
- Cortar `expensive_lock` / Onda 0 holds “para caber”
- Apagar gatilhos de defer ou inventar deadlines de feature
- Rodar discovery / opportunity assessment / reescrever o roadmap como OKRs (Inspired fica na **prosa** dos Próximos e na faixa A validar)

## Exemplo de compressão

**Antes (ruim no roadmap compilado):**

> **C6 Escala e DRY pós-C2 — implementado e mesclado em `main` (2026-07-19)** — import bulk drizzle, token HMAC + `supporterImportBatch`, KPI aggregate, shells… Duas passagens `/simplify`; débitos maiores → C8.

**Depois (resumo Já entregue):**

> **Operação / escala** — C2–C3 + C6–C9 em `main` (C2 prod. ↔ Onda 0). Débitos abertos: C10, C11.

**Próximos (forma boa vs feature factory):**

- Ruim: `C10 — shared drizzleBulk helper`
- Bom: `C10 — um só caminho bulk para imports sem N+1 · gatilho: 3º call site · [plano](…)`
