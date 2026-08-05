# Generalizar editor e display das colunas de relação na lista de municípios

Status: ready
Atualizado em: 2026-08-05
Issue: #374
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe em `MunicipalityList` (`/campanha/municipios`); colunas já existentes (Assessores, Lideranças, Dobradinhas); sem rota nova; a UI de Dobradinhas e Lideranças muda para igualar a de Assessores, mas os padrões visuais já estão em produção
Canvas UI: N/A — os padrões visuais de referência já existem em produção na coluna de Assessores (popover `CampaignCellEditOverlay` + Command + chips + criar inline; avatar stack `-space-x-2` com iniciais + tooltip); esta entrega replica esses mesmos padrões nas colunas de Dobradinhas e Lideranças, sem criar design novo
Appetite: ~0,75 dia eng; extração de 2 componentes compartilhados + swap nos 3 call sites; sem migration, sem endpoint novo, sem collection
Responsável: —

## Intenção

Hoje, na lista de municípios (`/campanha/municipios`), três colunas fazem a mesma coisa — editar relações N:N inline — mas cada uma tem UI diferente. O usuário vê inconsistência:

| Coluna          | Editor (popover)                                                                                             | Display (view-only)                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Assessores**  | `CampaignCellEditOverlay` + Command + chips + criar inline                                                   | Avatar stack (círculos com iniciais, `-space-x-2`, tooltip com nomes) — **referência** |
| **Lideranças**  | `CampaignCellEditOverlay` + Command + chips + criar inline                                                   | ❌ _não tem_ — os chips de texto de edição fazem as vezes de display; visual diferente |
| **Dobradinhas** | `RelationChipCell` — máquina de interação visualmente diferente (outro container, outra affordance de busca) | Avatar stack (igual ao de assessores, mas implementação separada)                      |

O código duplicado é sintoma do desalinhamento: `MunicipalityListAdvisorsControl` (431 linhas) e `MunicipalityListLeadershipsControl` (530 linhas) são irmãs estruturais — mesma máquina de estado, mesmo Command, mesmo overlay. A dobradinha usa um container completamente diferente (`RelationChipCell`) que entrega uma experiência de edição distinta da que o usuário encontra nas outras duas colunas. E no display, o avatar stack de assessores e o de dobradinhas são o mesmo componente escrito duas vezes, enquanto lideranças sequer tem display próprio.

**O pedido é alinhar a UI**: as três colunas devem parecer e funcionar iguais para o usuário. A coluna de **Assessores** é a referência — as outras duas mudam para igualá-la.

- **Dobradinhas muda de editor:** larga `RelationChipCell` e adota o mesmo `CampaignCellEditOverlay` + Command + chips + criar inline de Assessores/Lideranças.
- **Lideranças muda de display:** ganha o avatar stack (círculos com iniciais + tooltip) que Assessores e Dobradinhas já usam, em vez de usar os chips de edição como único readout.

## Persona e fluxo

- **Persona / contexto:** Staff da campanha (coordenação, assessores) percorrendo a lista de municípios no desktop, editando vínculos inline.
- **Job principal:** Editar (ou só ver) assessores, lideranças e dobradinhas de um município com a **mesma UI** nas três colunas. Hoje cada coluna tem uma aparência e interação diferente — o usuário reaprende a cada coluna.
- **Fluxo desejado:** O usuário clica no gatilho de qualquer uma das três colunas e encontra o mesmo popover (`CampaignCellEditOverlay` com Command de busca + chips removíveis + criar inline). Fechado, vê o mesmo display de avatar stack com tooltip. A experiência é idêntica de coluna para coluna — a única diferença é o domínio (assessor, liderança, dobradinha) e o texto dos labels.
- **Mudanças visíveis para o usuário:**
  - **Dobradinhas:** o editor popover muda — deixa de ser o container `RelationChipCell` e passa a ser o mesmo `CampaignCellEditOverlay` + Command + chips que Assessores e Lideranças usam. O display (avatar stack) já está alinhado e não muda.
  - **Lideranças:** o display fechado muda — deixa de ser só os chips de texto do editor e ganha o avatar stack com círculos de iniciais + tooltip, igual a Assessores e Dobradinhas. O editor popover já está alinhado e não muda.
  - **Assessores:** não muda — é a referência que as outras duas colunas passam a seguir.
- **Anti-goals de produto:**
  - Não é uma quarta coluna nem um editor genérico de "qualquer relação" exposto ao usuário.
  - Não é redesign do popover — o visual de referência (Assessores) é mantido; as outras duas colunas são trazidas até ele.
  - Não mexe em endpoint, schema, migration, Consent, nem access control.

## Objetivo e aceite

**Alinhamento de UI (visível para o usuário):**

- A coluna de **Dobradinhas** tem o mesmo popover de edição que Assessores e Lideranças: `CampaignCellEditOverlay` + Command de busca + chips removíveis + criar inline. O usuário vê a mesma UI ao editar qualquer uma das três.
- A coluna de **Lideranças** tem o mesmo display fechado que Assessores e Dobradinhas: avatar stack com círculos de iniciais (`-space-x-2`, máx. 3) + tooltip com nomes. O usuário vê a mesma UI nas três colunas fechadas.
- A coluna de **Assessores** é a referência — sua UI não muda; as outras duas são trazidas até ela.

**Alinhamento de código (interno):**

- As três colunas usam **o mesmo componente de popover de edição**, extraído das implementações atuais de assessores e lideranças.
- As três colunas usam **o mesmo componente de display** (avatar stack), extraído das implementações atuais de assessores e dobradinhas.
- Nenhuma regressão funcional por coluna: criar inline (só nome; o telefone da liderança pode ser adicionado depois na ficha), remover chip, busca com acento, estado otimista, tratamento de erro e mensagens de toast continuam funcionando.
- O contrato de props de `MunicipalityList` não muda.
- A coluna de dobradinhas deixa de usar `RelationChipCell` e passa a usar o popover compartilhado.
- `MunicipalityListLeadershipsControl` ganha display view-only (avatar stack), mesmo que hoje a coluna só seja visível para staff que edita — a peça existe e o contrato fica completo.

## Dados (intenção)

Dados: N/A — refactor de UI sem métrica, série, ranking ou consulta nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - Novo componente shared: `src/components/campaign/shared/MunicipalityRelationEditor.tsx` — extrai a máquina de estado (otimista, sequência, pendingCountRef, toggle, inline create) de `MunicipalityListAdvisorsControl` + `MunicipalityListLeadershipsControl`, parametrizada por: endpoint, opções, labels/copy, build da trigger. O criar inline é sempre só nome (o telefone da liderança, se necessário, é adicionado depois na ficha).
  - Novo componente shared: `src/components/campaign/shared/MunicipalityRelationAvatarStack.tsx` — unifica `MunicipalityAdvisorAvatarStack` (73 linhas) e `StateDeputyAvatarStack` (~15 linhas dentro de `MunicipalityStateDeputyRelationCell`), parametrizada por: função de iniciais, tooltip, empty state.
  - `MunicipalityListAdvisorsControl.tsx` → wrapper fino sobre `MunicipalityRelationEditor`.
  - `MunicipalityListLeadershipsControl.tsx` → wrapper fino sobre `MunicipalityRelationEditor` + ganha display view-only com `MunicipalityRelationAvatarStack`.
  - `MunicipalityStateDeputyRelationCell.tsx` → deixa de usar `RelationChipCell` e vira wrapper fino sobre `MunicipalityRelationEditor`.
  - `MunicipalityList.tsx` — as factories de coluna trocam os call sites.
- **Precedente a olhar:** `RelationChipCell.tsx` — a extração que o B37 fez para `MunicipalityPortfolioCell` + `LeadershipStateDeputyRelationCell` prova que o padrão de "wrapper fino por domínio + máquina de interação compartilhada" funciona e reduz código. A diferença aqui é que a máquina de interação é o popover (`CampaignCellEditOverlay` + Command), não o editor inline.
- **Risco de acoplamento:** a coluna de dobradinhas em `/campanha/liderancas` (`LeadershipStateDeputyRelationCell`) também usa `RelationChipCell` — esta entrega **não** a migra (escopo é só a lista de municípios). O `RelationChipCell` continua existindo para os call sites de lideranças e dobradinhas que o usam como editor inline (não popover).

## Dependências

- Nenhuma — as três colunas já existem e funcionam. Este item só extrai o que já está duplicado.

## Fora de escopo

- Migrar `LeadershipStateDeputyRelationCell` (coluna de dobradinhas em `/campanha/liderancas`) para o novo editor — essa célula usa `RelationChipCell` como editor inline (não popover), padrão diferente.
- Migrar `MunicipalityPortfolioCell` (coluna de municípios em `/campanha/liderancas` e `/campanha/dobradinhas`) — também é editor inline, não popover.
- Unificar os endpoints JSON de advisors/leaderships/dobradinhas — cada coluna segue com seu endpoint dedicado, o editor só recebe a URL por prop.
- Criar um display view-only para a coluna de dobradinhas quando o ator não é `isCampaignUnrestricted` — hoje a coluna nem renderiza nesse caso, e mudar isso é decisão de produto separada.

## Rabbit holes de produto

- **"Já que vamos generalizar, por que não unificar leaderships de `/campanha/liderancas` também?"** — porque o editor de `/campanha/liderancas` é inline (na linha da tabela), não popover. São duas máquinas de interação diferentes (`RelationChipCell` vs. `CampaignCellEditOverlay`). Unificar as duas exigiria redesign de interação — escopo de outro item. **Corte:** o editor popover cobre só os call sites que já são popover hoje.
- **"Já que o display vai existir, por que não mostrar a coluna de dobradinhas para assessores em modo view-only?"** — seria uma decisão de produto (visibilidade), não de engenharia. Hoje a coluna é `isCampaignUnrestricted`-only por intenção. **Corte:** o display existe e funciona, mas cada coluna decide se monta ele ou o editor conforme seu access control atual.

## Questões em aberto (produto)

- **A coluna de Lideranças deve ganhar display view-only para assessores que não podem editar?** Hoje todo staff edita (`MunicipalityListLeadershipsControl` sempre montado), então o display não tem call site real — mas a peça fica pronta. Se um dia o access control restringir, o display já existe. **Recomendação:** criar o display com o contrato completo, mesmo sem call site imediato — custo zero e evita reabrir depois. _(assumido)_

## Referências

- `src/components/campaign/municipality/MunicipalityListAdvisorsControl.tsx` — editor de assessores (431 linhas)
- `src/components/campaign/municipality/MunicipalityListLeadershipsControl.tsx` — editor de lideranças (530 linhas)
- `src/components/campaign/shared/MunicipalityStateDeputyRelationCell.tsx` — editor de dobradinhas (281 linhas, sobre `RelationChipCell`)
- `src/components/campaign/municipality/MunicipalityAdvisorAvatarStack.tsx` — display de assessores (73 linhas)
- `src/components/campaign/shared/RelationChipCell.tsx` — máquina de interação compartilhada (813 linhas, precedente de extração)
- `src/components/campaign/municipality/MunicipalityList.tsx` — factory de colunas, call sites dos três editores
- `src/components/campaign/shared/CampaignCellEditOverlay.tsx` — container Popover/Drawer usado pelos editores atuais
