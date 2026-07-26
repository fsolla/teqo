---
name: suggest-next-roadmap-items
description: >-
  Lê docs/roadmap.md (e planos/notebook/calendário necessários), filtra o que
  já foi entregue e o que ainda está bloqueado por dependência, e indica o
  próximo item a implementar no Teqo mais o lote que pode correr em paralelo
  com ele. Usar quando o usuário perguntar "o que fazer agora", "próximo item
  do roadmap", "o que priorizar", "sugere o próximo", "what's next", "qual
  item implementar", "o que dá para tocar em paralelo", ou pedir
  recomendações de priorização a partir do roadmap.
---

# Sugerir próximos itens do roadmap

Esta skill **só recomenda** — não implementa, não edita o roadmap e não cria planos. O deliverable é **uma recomendação principal + um lote paralelo**: os outros itens que podem ser tocados ao mesmo tempo, cada um em sua própria branch/worktree, sem brigar com o principal nem entre si. Não são alternativas ao principal; são trabalho simultâneo. Depois disso, o fluxo natural é `implement-roadmap-item` por ID (um por sessão/worktree), ou `roadmap-item` se a sugestão revelar um gap de registro.

**Divisão com as skills irmãs:**

| Skill                        | Papel                                                  |
| ---------------------------- | ------------------------------------------------------ |
| `compile-roadmap`            | Enxugar roadmap: resumir feito, destacar abertos       |
| `suggest-next-roadmap-items` | **Escolher o próximo + o lote paralelo** entre o que o roadmap já lista |
| `roadmap-item`               | Registrar ideia nova / criar plano                     |
| `implement-roadmap-item`     | Auditar plano + implementar o ID escolhido             |
| `rebase-on-main`             | Após simplify: fetch + rebase em main + conflitos      |
| `capture-review-debts`       | Triagear débitos de `/simplify` / critique             |
| `ship-to-main`               | Commit + push + merge main + apagar worktree           |
| `close-delivery`             | Orquestra rebase + debts (auto-confirm) + ship         |

## Checklist

```
- [ ] 1. Ler docs/roadmap.md inteiro + notebook do projeto
- [ ] 2. Extrair pool de itens ainda abertos (sem ✓ / sem "entregue")
- [ ] 3. Verificar dependências duras e bloqueios externos
- [ ] 4. Pontuar candidatos (calendário × valor × prontidão × risco)
- [ ] 5. Ler planos só dos top candidatos (progressive disclosure)
- [ ] 6. Checar colisões e montar o lote paralelo
- [ ] 7. Entregar principal + lote paralelo + próximo passo; parar
```

## Passo 1 — Ler as fontes canônicas

Leia **nesta ordem** (não pule o roadmap):

1. **`docs/roadmap.md` inteiro** — âncoras do calendário, Onda 0, grafo mermaid, tabelas por janela, **tabela do programa "Inteligência de campanha"** (E8–E15/B13/C12 — tem colunas próprias Plano/Classe/Appetite/Janela/Depende de), Fill-ins, Cortes seguros / não cortáveis, Bloqueadores, Fora de escopo.
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

Inclua também os itens da tabela de programa (hoje: "Inteligência de campanha") — são itens de trilha normais para fins de pool; a coluna "Depende de" deles é a fonte de dependências duras, e o embasamento de valor (OMTM, anti-metas) está sumarizado no notebook e em `docs/research/` — **não** releia o relatório de discovery para ranquear.

## Passo 3 — Filtrar por prontidão

Para cada aberto, classifique:

| Estado                | Critério                                                                                       | Ação na shortlist                                            |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Pronto**            | Todas as dependências **duras** (setas `-->` / coluna "Depende de") entregues                  | Candidato normal                                             |
| **Quase**             | Só falta dependência **suave** (`-.->`)                                                        | Candidato; note o que degrada se seguir sem a suave          |
| **Bloqueado duro**    | Dependência dura aberta                                                                        | Fora da shortlist; cite o predecessor a fazer antes          |
| **Bloqueado externo** | Jurídico (Onda 0), TSE após 15/08, resultado TSE 2026 (E15, pós-eleição), validação de produto | Fora da shortlist de código; mencione em "Bloqueios"         |
| **Cortável agora**    | Está em "Cortes seguros" **e** o prazo da janela aperta                                        | Só sugerir se for quick win barato ou se o usuário pedir DRY |

Dependência "deploy remodelagem" (ou outro ato operacional com código já pronto) conta como **Quase**, não bloqueado duro: a engenharia pode começar em local; só a ativação em produção espera o deploy — note isso na shortlist.

Confirme no notebook/código só quando o roadmap e o notebook **divergirem** (ex.: roadmap sem ✓ mas notebook diz entregue). Não faça auditoria profunda de código aqui — isso é `implement-roadmap-item`.

## Passo 4 — Pontuar e ranquear

Atribua a cada **Pronto** / **Quase** uma nota 1–5 (soma ponderada mental; não precisa ser fórmula rígida). Âncoras Teqo:

| Peso  | Critério                      | Preferir                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alto  | **Calendário**                | Serve a janela vigente (hoje → próxima âncora). Janela 1–2: produção, base nominal, agenda, fundação de dados. Janela 3: inteligência, mapa, engajamento. Janela 4: só o que falta p/ dia D + estabilização; nada de migration arriscada perto de ~20/09.                                                                                                                                                              |
| Alto  | **Caminho crítico**           | Onda 0 / não cortáveis > operação de campo > inteligência > plataforma/engajamento > fill-in DRY. **Atenção:** o núcleo do programa de inteligência (E8/E9/C12) está em "não cortáveis" — conta como caminho crítico, não como "inteligência" genérica; e **C12 é perecível** (cada semana de campanha sem registro é história irrecuperável para o backtest E15 — o atraso dele tem custo que não se recupera depois) |
| Médio | **Paralelismo / desbloqueio** | Item que desbloqueia vários outros (ex.: A7 antes de A5/B3/E\*) ou fecha um lote (E4 após E1–E3)                                                                                                                                                                                                                                                                                                                       |
| Médio | **Prontidão do plano**        | Tem `docs/plans/<slug>.md` acionável > só design-ref > sem plano (C5)                                                                                                                                                                                                                                                                                                                                                  |
| Médio | **Custo vs valor**            | Quick win de campo / insight barato pode furar fila; cadeia `escala-dry-pos-*` só se a superfície já dói (volume, lista lenta) ou se for Fase 1 de alto ROI citada em "Cortes seguros"                                                                                                                                                                                                                                 |
| Baixo | **Risco**                     | Migration + Consent novo = mais caro; item só utility/seed = mais barato                                                                                                                                                                                                                                                                                                                                               |

**Regras de desempate (travadas):**

1. Não sugerir como #1 um fill-in DRY se houver feature **Pronta** da janela vigente que desbloqueie operação (ex. atuais: E8, C12, E9; B8 F2; D2).
2. Preferir **uma fatia** de um programa (um ID: E8, C12, …) a "fazer o programa de inteligência inteiro" — diga qual plano (`docs/plans/<slug>.md`), e respeite a ordem do grafo (E8 antes de E9/E10/E12; C12 antes de E11/E14/E15).
3. Se várias cadeias DRY competem (C10, C11, E6, E7, A7, B5, O0+, …), escolha no máximo **1–2** no total (principal + lote), priorizando as Fases que o próprio roadmap marca como "mais valiosas" em Cortes seguros.
4. Itens _(proposto — validar com produto)_ (ex.: C5) só entram se o usuário pedir exploração de produto; senão liste em "Depois / validar".
5. Trabalho externo (lote jurídico) **nunca** substitui um candidato de engenharia — reporte em seção própria.
6. O #1 é o de maior valor/urgência de calendário, **nunca** o "mais isolado". Isolamento decide quem entra no lote paralelo (Passo 6), não quem é o principal.

## Passo 5 — Aprofundar só o top

Pegue os **4–6** melhores do Passo 4 (o #1 mais os pré-candidatos ao lote). Para cada um:

1. Abra o plano linkado (`docs/plans/...`) — leia cabeçalho, Status, Dependências, Não escopo, e o tamanho das fases (1 parágrafo basta). Para itens do programa de inteligência, a tabela do programa já traz classe Impeccable/appetite/depende-de — só abra o plano do candidato final.
2. Se houver design-ref na tabela do roadmap, cite o nome do par em `docs/design-refs/latest/` (não precisa abrir o HTML).
3. Classifique superficialmente Impeccable A/B/C/D (mesma tabela de `implement-roadmap-item`) — uma letra + meia frase.

Se dois candidatos forem quase equivalentes, prefira o de menor risco de migration / o que o calendário pune mais se atrasar.

## Passo 6 — Checar colisões e montar o lote paralelo

Premissa: cada item roda na **sua própria branch/worktree** e fecha com `close-delivery` (rebase em `main` antes do merge). Logo, paralelizável não é "cabe no mesmo dia" — é "os dois podem viver em worktrees separadas e reencontrar `main` sem conflito que exija reescrita".

Um candidato entra no lote quando passa **nos três testes**:

1. **Independência** — não depende (nem suave) do principal nem de outro item do lote, e o principal não depende dele. Dependência suave em ambos os sentidos → fora do lote, vira "depois de X".
2. **Superfície disjunta** — não disputa nenhuma superfície serializadora com o principal nem com outro item já no lote (tabela abaixo).
3. **Fechamento independente** — pode ser mesclado sozinho e entregar valor sem esperar o irmão (nada de "só faz sentido junto").

**Superfícies serializadoras do Teqo (no máximo 1 item por lote em cada linha):**

| Superfície                                                                                    | Por que serializa                                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/migrations/` (SQL + `.json` snapshot + `index.ts`) e o `src/payload-types.ts` que a segue | A cadeia de snapshots é linear: dois itens com migration não se resolvem por merge textual, um tem que refazer |
| Artefato TSE (`src/lib/electionAggregates/`, `build:election-aggregates`, orçamento de bytes)  | Arquivo gerado grande + teste de tamanho; dois geradores em paralelo colidem inteiros                          |
| Seams do sistema de listas (`CampaignTable`, `campaignListUrl`, shells de `campaign/shared`)   | Quem **altera** a seam serializa; quem só **consome** pode ir junto                                            |
| Um mesmo loader/rota de domínio (ex.: `municipalityPageData.ts` + colunas da lista)            | Precedente real: E9/E10/B13 empilharam no mesmo arquivo                                                        |
| Mesma collection/global no schema (mesmo sem migration nova)                                   | Access, zod, view models e form mudam juntos                                                                   |

**Não** serializam (append trivial, resolve no rebase): `docs/roadmap.md`, `docs/plans/`, `campaignIntelligenceConcepts.ts` (E18), `nav.ts`, novos arquivos em domínios distintos. Só avise a ordem de merge.

Monte assim: fixe o principal, percorra os pré-candidatos do Passo 5 em ordem de score e inclua os que passam nos três testes. **Lote de 2–4 itens** (3–5 no total com o principal). Se um candidato falha só pelo teste 2 contra o principal, liste-o como "serializar depois de \<ID\>" em vez de descartar. Prefira lotes de trilhas distintas (campo × dados × site público) — menos atrito de rebase e menos troca de contexto.

Se **nada** for paralelizável, diga isso explicitamente e nomeie o que destrava paralelismo (normalmente: o principal ser o único com migration).

## Passo 7 — Entregar e parar

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

## Em paralelo com ele (2–4)

Cada um em sua própria worktree; nenhum depende do principal nem dos outros.

| #   | ID  | Por que agora | Por que não colide | Plano |
| --- | --- | ------------- | ------------------ | ----- |
| 2   | …   | …             | …                  | …     |

- Migration no lote: só \<ID\> (os demais são sem schema) — ou "nenhum".
- Serializar depois: \<ID\> — colide com \<ID\> em \<superfície\>.
- Ordem de merge sugerida: … (só se importar)

## Deixados de fora (amostra)

- **Bloqueados:** ID — falta X
- **Cortáveis / depois:** ID — racional curto
- **Validar com produto:** …

Quer que eu rode `implement-roadmap-item` em algum destes?
```

**Proibido neste fluxo:**

- Implementar código, abrir PR, ou marcar item como entregue
- Editar `docs/roadmap.md` / `docs/plans/` (se achar inconsistência material, **reporte** e ofereça `roadmap-item` / correção via `implement-roadmap-item` Passo 7)
- Inventar IDs ou itens que não estão no roadmap — inclusive para encher o lote paralelo
- Mais de 5 itens no total (principal + lote)
- Apresentar o lote como "alternativas ao principal" ou como um plano de execução sequencial
- Colocar no lote item que colide em superfície serializadora (Passo 6) — ele vai para "serializar depois"
- Auditoria afirmação-a-afirmação do plano (isso é `implement-roadmap-item`)

Se o usuário já disser "faz o X" / "implementa o segundo", pare esta skill e invoque `implement-roadmap-item` no ID escolhido (um por sessão/worktree).
