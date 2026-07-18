---
name: implement-roadmap-item
description: Recebe o código (ex. A4, C2, D2) ou a descrição de um item do docs/roadmap.md do Teqo, revisa o estado do item no roadmap, analisa-o criticamente contra o estado atual do repositório, revisa o plano detalhado linkado em docs/plans/ e produz um plano de implementação acionável. Usar quando o usuário pedir para implementar, planejar ou revisar um item do roadmap — "vamos fazer o A4", "planeja a implementação de", "revisa o plano do item X", "o que falta para o C2" — ou fornecer um ID de trilha do roadmap.
---

# Revisar item do roadmap e criar plano de implementação

Esta skill transforma um item do `docs/roadmap.md` em um plano de implementação confiável. O ponto central: **o plano em `docs/plans/` foi escrito no passado e o repositório andou desde então** — a skill existe para auditar o plano contra o código real antes de qualquer implementação, não para reescrevê-lo cegamente nem para segui-lo cegamente.

## Checklist do fluxo

```
- [ ] 1. Localizar o item no roadmap e capturar seu estado completo
- [ ] 2. Verificar o estado real das dependências (roadmap E código)
- [ ] 3. Ler o plano detalhado linkado + fontes satélites
- [ ] 4. Auditar o plano contra o repositório, afirmação por afirmação
- [ ] 5. Fechar as questões em aberto com evidência ou recomendação
- [ ] 6. Escrever o plano de implementação em fases verificáveis
- [ ] 7. Atualizar docs/plans/ e roadmap se a auditoria achou divergência
```

## Passo 1 — Localizar o item e capturar seu estado

Leia `docs/roadmap.md` **inteiro** (nunca só a linha do item). Resolva o input do usuário:

- **ID de trilha** (`A4`, `C2`...): procure na subgraph do grafo mermaid e nas tabelas de janela.
- **Descrição solta**: faça a correspondência por termos nas trilhas, Fill-ins, Bloqueadores, Site público e Admin Payload. Se houver mais de um candidato plausível, pergunte antes de prosseguir; item errado = plano inteiro errado.

Capture do roadmap, explicitamente:

| Dado                        | Onde está                                                                         |
| --------------------------- | --------------------------------------------------------------------------------- |
| Trilha, janela e ordem      | Tabelas "Sequência de execução por janela"                                        |
| Dependências duras e suaves | Grafo mermaid (cheias `-->` vs tracejadas `-.->`) + coluna "Depende de"           |
| Já entregue?                | Marca `✓` no grafo e nota "(entregue YYYY-MM-DD)" na tabela                       |
| Cortável ou não cortável    | Parágrafo "Cortes seguros"                                                        |
| Bloqueio externo            | Onda 0 (lote jurídico/Consent) e tabela "Bloqueadores atuais"                     |
| Design                      | Tabela "Referências de design" → par `.png`/`.html` em `docs/design-refs/latest/` |
| Link do plano               | Coluna "Plano" da tabela de janela                                                |

**Curto-circuitos:** item marcado `✓` entregue → reporte isso e pare (a menos que o usuário esteja pedindo revisão do que foi entregue). Item na seção "Fora de escopo" ou "Itens consolidados/removidos" → aponte onde foi absorvido/vetado e o racional; não crie plano.

## Passo 2 — Verificar o estado real das dependências

Não confie só na marca `✓` do roadmap — confirme no código:

- Dependência entregue por migration → o arquivo existe em `src/migrations/` e está no `index.ts`.
- Dependência entregue por collection/campo → existe em `src/collections/` e em `src/payload-types.ts`.
- Dependência entregue por utility/componente → existe em `src/utilities/` / `src/components/campaign/` com a assinatura que o plano assume.

Desfechos:

- **Dependência dura não entregue** → implementar agora está fora de ordem. Reporte e proponha: (a) implementar a dependência primeiro (aponte o plano dela), ou (b) corte de escopo explícito que remova a dependência — nunca ignore silenciosamente.
- **Dependência suave não entregue** → siga, mas registre no plano de implementação o que degrada e quando revisitar.
- **Bloqueio jurídico (Onda 0)** → a engenharia NÃO espera o jurídico (padrão do projeto: o app falha fechado sem a chave de `Consent`); só a ativação em produção espera. Deixe isso explícito no plano.

## Passo 3 — Ler o plano detalhado e as fontes satélites

Leia, nesta ordem:

1. **`docs/plans/<slug>.md`** linkado no item — inteiro. Anote a data de "Atualizado em" e o "Status": a distância entre essa data e o presente calibra o quanto desconfiar no Passo 4.
2. **`.cursor/rules/projects/nucleos-eleitorais.mdc`** (ou o notebook do projeto correspondente) — decisões e status posteriores ao plano costumam estar aqui.
3. **Design ref** (se a tabela do roadmap apontar uma): o `.html`/`.png` em `docs/design-refs/latest/`. A estrutura/UX vale; a paleta NÃO — usar tokens do tema `data-theme='campaign'` (`src/app/(frontend)/styles.css`) e componentes shadcn de `src/components/ui`.
4. **AGENTS.md** — seções relevantes ao domínio do item (Campaign auth, Posts & Tags, migrations, convenções de naming).
5. **Planos vizinhos** citados nas seções "Dependências" e "Não escopo" — para saber onde o escopo deste item termina e o dos outros começa.

Item sem plano detalhado (ex.: só design, como C5; ou fill-in "sem plano detalhado ainda"): primeiro crie o plano seguindo a skill `roadmap-item` (template em `.cursor/skills/roadmap-item/plan-template.md`), depois continue esta skill a partir do Passo 4.

## Passo 4 — Auditar o plano contra o repositório

Este é o passo que separa uma revisão competente de um "li o plano, parece bom". Para **cada afirmação verificável** do plano, cheque o código:

- **Caminhos de arquivo citados** existem? (Glob/Read). Arquivo renomeado/movido é a defasagem mais comum.
- **Utilities e componentes "a reusar"** ainda têm a assinatura/comportamento que o plano assume? Leia a assinatura real, não o nome.
- **Premissas de schema** batem com `src/payload-types.ts` e com as migrations em `src/migrations/`? (Ex.: plano escrito quando `cities` era escalar, hoje é array.)
- **Decisões travadas** foram supersedidas? Confronte com a seção "Itens consolidados/removidos" do roadmap, a nota do "Atualizado em" (linha 3 do roadmap) e o notebook do projeto. Precedente real: A2 foi redesenhado de auto-preenchimento forçado para chips opt-in — um plano antigo descreveria o comportamento errado.
- **Já existe implementação parcial?** Grep pelos identificadores que o plano propõe (nomes de collection, componente, action, rota). Se parte já existe, o plano de implementação parte dela, não do zero.
- **Não escopo ainda é válido?** Itens delegados a outros planos podem já ter sido entregues lá (o que muda o que este item pode assumir como disponível).

Classifique cada achado em três baldes e reporte-os ao usuário:

1. **Confirmado** — plano bate com o código; segue como está.
2. **Defasado** — fato objetivo mudou (caminho, assinatura, schema); corrija no plano (Passo 7) e ajuste a abordagem.
3. **Conflitante** — decisão de produto/arquitetura diverge (plano diz X, roadmap/notebook posterior diz Y). Adote a fonte mais recente, registre a substituição, e sinalize ao usuário se a divergência for material.

## Passo 5 — Fechar as questões em aberto

Para cada item de "Questões em aberto" do plano:

- **Resolvível por evidência** (o código, o roadmap ou o notebook já responderam) → resolva e registre a resposta com fonte.
- **Decisão de produto pendente** → carregue a **Recomendação** do plano para o plano de implementação como decisão default, marcada _(assumido — validar com produto)_. Nunca deixe pergunta sem posição, e nunca bloqueie o plano inteiro numa pergunta que tem default razoável.

## Passo 6 — Escrever o plano de implementação

O deliverable é um plano de execução em **fases pequenas e verificáveis**, em ordem de dependência (schema → server → UI → polish é o padrão usual aqui). Para cada fase:

- **O que muda**: arquivos concretos (caminho real, criar vs editar), com uma linha do porquê.
- **Migration** (se houver mudança de schema): nome proposto para `pnpm migrate:create <nome>`, o que adiciona, se tem backfill. Seguir a skill `payload-migrations`; `push` é `false` sempre.
- **Como verificar a fase**: teste, tela, ou query específica — fase sem critério de verificação não é fase.

Guardrails que TODO plano de implementação deste repo inclui (cheque um a um contra o item):

- Pessoa = join com `Contact`; nunca cadastro paralelo.
- Opt-in/PII → `Consent` por chave estável, falhando fechado; texto novo entra no lote jurídico da Onda 0, nunca em rodada separada.
- Local API com `user` → `overrideAccess: false`; escrita multi-collection → transação com `req: { transactionID }`; hooks propagam `req`.
- Collection nova → `admin.group` consistente + hook de revalidação se backing de página pública.
- Identificadores em inglês; strings visíveis em pt-BR; valores de slug/enum em português são dados, não se traduzem.
- Verificação final = checklist do AGENTS.md: `pnpm generate:types`, `generate:importmap` (se componentes), `tsc --noEmit`, `lint`, `test`, `test:e2e`, `build` contra o banco local, scan Aikido dos arquivos editados.

Termine o plano com: dependências assumidas (e o que foi verificado no Passo 2), decisões assumidas _(validar com produto)_, e o que fica explicitamente de fora (com o plano/item para onde vai).

## Passo 7 — Atualizar a documentação se houve divergência

Se o Passo 4 achou itens **defasados** ou **conflitantes**:

- Atualize `docs/plans/<slug>.md`: corrija as seções afetadas, atualize "Atualizado em" e registre a revisão em uma linha (o quê + por quê + data), no padrão das revisões existentes.
- Se a divergência tocar dependências/janela/escopo do item, atualize também o `docs/roadmap.md` nos pontos de consistência (grafo, tabela de janela, "Atualizado em") — a consistência tripla tabela = grafo = seção "Dependências" do plano é obrigatória (ver Passo 6–7 da skill `roadmap-item`).
- Divergência pequena e puramente factual (caminho renomeado): corrija direto. Divergência de decisão de produto: corrija adotando a fonte mais recente e destaque a mudança no resumo ao usuário.

## Resumo final ao usuário

Feche reportando, nesta ordem: (1) item e estado no roadmap (janela, dependências, bloqueios); (2) veredito da auditoria — o que confirmou, o que estava defasado, o que conflitava; (3) o plano de implementação em fases; (4) decisões assumidas que merecem validação de produto.
