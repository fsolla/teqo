# Generalizar editor e display das colunas de relação na lista de municípios

Status: ready
Atualizado em: 2026-08-04
Issue: #374
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe em `MunicipalityList` (`/campanha/municipios`); colunas já existentes (Assessores, Lideranças, Dobradinhas); sem rota nova
Canvas UI: N/A — consistência visual sobre padrões já em produção; o "antes" e "depois" são variações mínimas do mesmo elemento
Appetite: ~0,75 dia eng; extração de 2 componentes compartilhados + swap nos 3 call sites; sem migration, sem endpoint novo, sem collection
Responsável: —

## Intenção

Hoje, na lista de municípios (`/campanha/municipios`), três colunas fazem a mesma coisa — editar relações N:N inline — mas cada uma implementa do seu jeito:

| Coluna          | Editor (popover)                                                                                                | Display (view-only)                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Assessores**  | `MunicipalityListAdvisorsControl` — `CampaignCellEditOverlay` + Command + chips + criar inline                  | `MunicipalityAdvisorAvatarStack` — círculos com iniciais + tooltip                |
| **Lideranças**  | `MunicipalityListLeadershipsControl` — `CampaignCellEditOverlay` + Command + chips + criar inline (name+phone)  | ❌ _não tem_ — os chips de texto servem de trigger e display ao mesmo tempo       |
| **Dobradinhas** | `MunicipalityStateDeputyRelationCell` sobre `RelationChipCell` — máquina de interação diferente dos outros dois | `StateDeputyAvatarStack` — círculos com iniciais (filtradas de partido) + tooltip |

O código duplicado já está doendo: `MunicipalityListAdvisorsControl` (431 linhas) e `MunicipalityListLeadershipsControl` (530 linhas) são irmãs estruturais — mesma máquina de estado (otimista, sequência de request, pendingCountRef, toggle, criar inline), mesmo Command+combobox, mesmo `CampaignCellEditOverlay`. A dobradinha usa um container diferente (`RelationChipCell` em trigger mode) que replica a mesma experiência com outra API.

E no display, o avatar stack de assessores e o de dobradinhas são o mesmo componente escrito duas vezes, enquanto lideranças nem display tem — o trigger com Badges de texto serve de readout e de affordance de edição ao mesmo tempo.

**O pedido é alinhar**: um editor compartilhado para as três colunas, e um display (avatar stack) compartilhado para as três.

## Persona e fluxo

- **Persona / contexto:** Staff da campanha (coordenação, assessores) percorrendo a lista de municípios no desktop, editando vínculos inline. O fluxo já existe e funciona — a entrega não muda comportamento, só alinha implementação.
- **Job principal:** Editar (ou só ver) assessores, lideranças e dobradinhas de um município com a mesma affordance, sem surpresa de coluna para coluna.
- **Fluxo desejado:** Igual ao atual. A diferença é interna: o coordenador não percebe que a coluna de Dobradinhas usa um container diferente da de Assessores — porque depois desta entrega, não usa mais.
- **Anti-goals de produto:**
  - Não é uma quarta coluna nem um editor genérico de "qualquer relação" exposto ao usuário.
  - Não é redesign do popover — o visual e a interação (Command, chips, criar inline) ficam iguais.
  - Não mexe em endpoint, schema, migration, Consent, nem access control.

## Objetivo e aceite

- As três colunas (Assessores, Lideranças, Dobradinhas) usam **o mesmo componente de popover de edição**, extraído das implementações atuais de assessores e lideranças.
- As três colunas usam **o mesmo componente de display** (avatar stack) para o estado fechado/view-only, extraído das implementações atuais de assessores e dobradinhas.
- Nenhuma regressão de comportamento: criar inline, remover chip, busca com acento, estado otimista, tratamento de erro e mensagens de toast continuam iguais por coluna.
- O contrato de props de `MunicipalityList` não muda (as colunas continuam recebendo `advisorOptions`, `leadershipOptions`, `stateDeputyOptions`, etc.).
- A coluna de dobradinhas deixa de usar `RelationChipCell` e passa a usar o popover compartilhado — a migração é interna, sem quebra de API pública.
- `MunicipalityListLeadershipsControl` ganha um display view-only (avatar stack), mesmo que hoje a coluna só seja visível para staff que edita — a peça existe e o contrato fica completo.

## Dados (intenção)

Dados: N/A — refactor de UI sem métrica, série, ranking ou consulta nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - Novo componente shared: `src/components/campaign/shared/MunicipalityRelationEditor.tsx` — extrai a máquina de estado (otimista, sequência, pendingCountRef, toggle, inline create) de `MunicipalityListAdvisorsControl` + `MunicipalityListLeadershipsControl`, parametrizada por: endpoint, opções, labels/copy, build da trigger, e forma de criar inline (só nome vs. nome+telefone vs. nome+partido).
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
