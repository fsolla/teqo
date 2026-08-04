# Coluna de dobradinhas na lista de municípios (+ criação inline)

Status: rascunho
Atualizado em: 2026-08-04
Issue: #362
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe no popover existente de Dobradinhas em `/campanha/municipios`
Canvas UI: /Users/francisco.solla/.cursor/projects/teqo/canvases/plan-b157-ui-draft.canvas.tsx
Appetite: ~1 dia eng; uma coluna nova na tabela + popover com combobox + criação inline de StateDeputy
Responsável: —

## Intenção

O coordenador e o candidato planejam a campanha **percorrendo a lista de municípios** — é o ponto de decisão da mesa. Depois de ver assessores atribuídos e tendência política, a próxima pergunta natural é: **"este município já tem dobradinha? Com quem?"**.

Hoje, para responder isso, é preciso sair da lista, ir para `/campanha/dobradinhas`, filtrar, e voltar. E se a dobradinha ainda **não existe** no sistema — porque o deputado estadual acabou de ser anunciado na reunião — o coordenador precisa ir ao Payload admin (`/admin`) ou ao menu de dobradinhas para criá-la antes de poder vinculá-la. Isso interrompe o fluxo da reunião.

A coluna de **Assessores** (B27 + B154) já provou que o caminho certo é **ver e editar sem sair da lista**. Este item replica esse padrão para dobradinhas:

- **Ver** as dobradinhas de cada município como chips com nome + partido, linkados para a ficha `/campanha/dobradinhas/<slug>`.
- **Adicionar/remover** dobradinhas via popover com combobox (busca por nome/partido, chip com × para remover, auto-save por delta).
- **Criar dobradinha nova no ato**, sem sair do popover — só nome (+ partido opcional), igual ao B154 fez para assessores.

## Persona e fluxo

- **Persona / contexto:** coordenador (ou candidato) em reunião de planejamento, percorrendo `/campanha/municipios` no desktop/tablet, verificando o estado de cada município e preenchendo o que falta.
- **Job principal:** ver e gerenciar as dobradinhas (deputados estaduais) vinculadas a um município, **sem interromper o fluxo da lista**, incluindo criar uma dobradinha nova se ela ainda não existir no sistema.
- **Fluxo desejado:**
  1. Na lista de municípios, o coordenador vê uma coluna **"Dobradinhas"** (entre Assessores e Tendência), com chips mostrando nome + partido (ex.: "Fulaninho (PT)"), cada um linkando para `/campanha/dobradinhas/<slug>`.
  2. Clica em um chip ou na área vazia da célula → abre popover com:
     - Lista de chips das dobradinhas já atribuídas (removíveis via ×).
     - Campo de busca (Command) para adicionar dobradinhas existentes, filtrando por nome e partido.
     - Se a busca não casa com nenhuma dobradinha existente: **primeiro item = "+ Criar dobradinha '[texto digitado]'"**.
  3. Seleciona uma existente → chip adicionado, gravação automática.
  4. Remove via × no chip → gravação automática.
  5. Escolhe "Criar dobradinha" → a dobradinha é criada com o nome digitado (+ partido se informado entre parênteses ou em campo auxiliar) e **automaticamente atribuída** ao município.
  6. Fecha o popover e continua — sem navegação, sem reload da página.
- **Anti-goals de produto:**
  - **Não** é um formulário completo de StateDeputy com notas, histórico e lista de municípios/lideranças vinculadas → `/campanha/dobradinhas/<slug>`.
  - **Não** permite editar nome ou partido de uma dobradinha existente inline (nome é imutável, partido se edita na ficha).
  - **Não** resolve duplicatas por similaridade ("Fulano" vs "Fulano de Tal") — o coordenador verifica.
  - **Não** oferece filtro por dobradinha no header da lista neste item (gatilho para o B29).
  - **Não** está disponível para assessores ou líderes — só coordenador/candidato (`isCampaignUnrestricted`), mesmo escopo do popover de assessores.

### Esboço de fluxo

```text
[Coordenador na lista de municípios]
  → vê coluna "Dobradinhas" com chips ou "—" (vazio)
  → clica na célula → popover abre
  → vê chips das dobradinhas atuais (removíveis) + campo "Buscar dobradinha…"
  → digita "Fulano"
  → resultados: "Fulaninho (PT)" ✓, "Fulana (PSB)" ✓
  → OU: se não casa com nenhuma → "+ Criar dobradinha 'Fulano'"
  → escolhe existente: chip adicionado, grava, busca limpa
  → escolhe criar: dobradinha criada + atribuída, chip aparece
  → remove via ×: chip some, grava
  → fecha popover, continua a reunião
```

## Objetivo e aceite

- Na lista `/campanha/municipios` (staff view), existe uma coluna **"Dobradinhas"** entre "Assessores" e "Tendência", visível apenas para coordenador/candidato.
- A coluna mostra chips com nome + partido da dobradinha (ex.: "Fulaninho (PT)"), cada um linkando para `/campanha/dobradinhas/<slug>`. Célula vazia mostra "—".
- Clicar na célula abre um popover com combobox que permite buscar, adicionar e remover dobradinhas do município — mesmo padrão de interação do popover de assessores (B27).
- Cada adição/remoção grava automaticamente (auto-save por delta), com estado otimista e rollback + toast em caso de erro.
- Se a busca não casa com nenhuma dobradinha existente, o primeiro item é **"+ Criar dobradinha '[texto]'"** — mesmo padrão do B154.
- Ao criar, o StateDeputy é criado com `name` = texto digitado, `party` = opcional (extraído de um campo auxiliar ou sintaxe `Nome (PARTIDO)`), e automaticamente vinculado ao município atual.
- O assessor (`advisor` role) **não vê** esta coluna — municípios na carteira já são visíveis, mas o popover de escrita é restrito a `isCampaignUnrestricted` (acesso que o assessor não tem).
- O líder (`leader` role) **não vê** esta coluna — líder nem acessa `/campanha/municipios`.
- `StateDeputy.name` é unique — se o nome digitado já existir, o endpoint retorna erro e a UI mostra o toast.

## Dados (intenção)

- **Vou apresentar dados?** Não. `Dados: N/A` — o item é affordance de **escrita** sobre `municipality.stateDeputies` via criação/consulta de `StateDeputy`; não introduz métrica, série, ranking ou mapa novo.
- **Decisões desbloqueadas:** coordenador decide quais dobradinhas operam em cada município **no momento da reunião**, sem sair da lista nem ir ao admin para criar o deputado.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/utilities/municipality/municipalityViewModels.ts` — `MunicipalityListViewModel` ganha `stateDeputyIDs: number[]`; `municipalityListSelect` ganha `stateDeputies: true`.
  - `src/utilities/municipality/municipalityPageData.ts` — `loadMunicipalityListPageBundle` carrega os summaries de state deputies (mesmo padrão de `advisorSummaries` na `page.tsx`).
  - `src/app/(campaign)/campanha/(app)/municipios/page.tsx` — carrega `loadStateDeputyOptions` (catálogo) e `loadStateDeputySummaries` (nomes dos atribuídos), passa para o componente de lista.
  - `src/components/campaign/municipality/MunicipalityList.tsx` — nova coluna `stateDeputies` no array `municipalityListColumns` (staff view, após `advisors`).
  - `src/components/campaign/municipality/MunicipalityListStateDeputiesControl.tsx` (novo) — ilha cliente com chips + Popover + Command + criação inline, espelhando `MunicipalityListAdvisorsControl`.
  - `src/app/(campaign)/campanha/(app)/municipios/state-deputies/route.ts` (novo) — endpoint `POST` para toggle de membership + criação inline de StateDeputy (campo opcional `name` + `party`).
  - `src/app/(campaign)/campanha/actions/municipality.ts` — nova action `setMunicipalityStateDeputyMembershipRecord` com transação, lock e access check.
  - `src/lib/schemas/municipality.ts` — schema zod para o input do endpoint.
  - `src/utilities/municipality/municipalityLabels.ts` — `MunicipalityListColumnId` ganha `'stateDeputies'`; `municipalityColumnLabels` e `municipalityColumnDescriptions` ganham entradas.
- **Precedente a olhar:**
  - B154 (`criar-assessor-inline-popover-municipios.md`) — criação inline de campaignUser no popover; mesmo padrão de endpoint sobrecarregado com `name`.
  - B27 (`combobox-assessores-lista-municipios.md`) — popover de assessores com combobox, chips, auto-save, estado otimista.
  - B31 (`dobradinhas-lista-liderancas.md`) — coluna de dobradinhas na lista de lideranças; chips com nome + partido, `loadStateDeputySummaries`.
  - `src/collections/StateDeputy.ts` — a collection já existe com `name` (unique), `slug`, `party`, `notes`.
  - `src/utilities/stateDeputyData.ts` — `loadStateDeputySummaries`, `StateDeputySummary`.
- **Risco de acoplamento:**
  - A mutation de `municipality.stateDeputies` deve respeitar o access control existente (`canManageCampaignStaffField` — restrito a `isCampaignUnrestricted`). O assessor **não** pode escrever nessa relação.
  - O `MunicipalityListViewModel` já é consumido por vários componentes — adicionar `stateDeputyIDs` não quebra consumidores existentes (campo novo, opcional para leitura).
  - A criação de StateDeputy inline usa `payload.create` com `overrideAccess: true` (ou `canCreateStateDeputy` verifica `isCampaignUnrestricted`) — precisa validar se o ator tem permissão.

## Dependências

- **Nenhuma dura.** Reusa B27 (padrão de popover), B154 (criação inline), B31 (chips de dobradinha), `StateDeputy` collection (já existe), `loadStateDeputySummaries` (já existe).
- **Suave:** se o B29 (filtro de dobradinha no header) quiser usar a nova coluna como gatilho, a faceta `stateDeputyIDs` nos filter facets será necessária — mas é escopo do B29, não deste item.

## Fora de escopo

- Filtro por dobradinha no header da lista → B29 (já registrado como gatilho).
- Ordenação da lista por dobradinha (sort key `stateDeputies`) → item futuro se houver decisão de produto.
- Editar nome ou partido da dobradinha inline → `/campanha/dobradinhas/<slug>`.
- Criar dobradinha com `notes` inline → `/campanha/dobradinhas/<slug>`.
- Coluna visível para assessor → restrito a `isCampaignUnrestricted`; assessor lê `municipality.stateDeputies` na ficha do município (`MunicipalityStrategyCard`), não na lista.
- Evitar duplicatas por similaridade (ex.: "Fulano" vs "Fulano de Tal") — `StateDeputy.name` é unique, mas similaridade não é detectada.
- Sincronizar a faceta do filtro `?stateDeputy=` sem recarregar — mesmo contrato de B24/B27 (reconcilia na próxima navegação).

## Rabbit holes de produto

- **"Criar dobradinha já com partido, notas e lista de municípios".** Se alguém "só completar" o formulário de criação, o popover vira um cadastro completo de StateDeputy e o appetite explode. **Corte neste item:** só nome + partido (opcional); o resto fica para `/campanha/dobradinhas/<slug>`.
- **"E se o nome já existe?"** `StateDeputy.name` é unique — o endpoint retorna erro e a UI mostra toast. Mas "Fulano" vs "Fulano de Tal" não são detectados como duplicata. **Corte neste item:** sem dedup por similaridade; o coordenador verifica.
- **"Coluna para assessor também".** O assessor vê seus municípios na lista, mas não pode escrever em `stateDeputies` (campo restrito a `isCampaignUnrestricted`). Mostrar a coluna como read-only para assessor dobra o escopo (precisa de `cellTooltip`, variant sem popover, etc.). **Corte neste item:** coluna só para `isCampaignUnrestricted`.

## Questões em aberto (produto)

- **Party inline: como o coordenador informa o partido?** **Opções:** A) campo auxiliar no popover (input "Partido" abaixo da busca, preenchido antes de clicar "Criar") | B) sintaxe `Nome (PARTIDO)` no campo de busca — "Fulano (PT)" cria nome="Fulano", party="PT" | C) sem partido na criação inline, sempre null. **Recomendação:** **B** — mesma sintaxe que a busca já suporta (filtro por partido entre parênteses), natural para a mesa que fala "Fulano do PT", e não adiciona um campo extra no popover. O parser extrai `(PARTIDO)` do fim da string; se não houver parênteses, party fica `null`. _(assumido — validar com produto)_
- **Posição da coluna: entre Assessores e Tendência?** **Opções:** A) após Assessores (grupo "rede" — assessor + dobradinha + tendência) | B) após Votação 2022/Classe (grupo "diagnóstico") | C) após Meta (final, grupo "conta"). **Recomendação:** **A** — assessor e dobradinha são as duas relações de "quem" no município (quem cuida + quem dobra), ficam juntas, e a dobradinha é uma pergunta que surge naturalmente depois de ver o assessor. _(assumido — validar com produto)_
- **Chips com partido ou só nome?** **Opções:** A) só nome na célula, partido no tooltip/busca | B) nome + partido sempre ("Fulano (PT)"). **Recomendação:** **B** — mesmo padrão do B31 (lideranças); a coluna "Dobradinhas" é mais estreita que "Assessores" (menos chips por linha), e o partido é a informação que desambigua dobradinhas de mesmo primeiro nome.

## Referências

- GitHub Issue #352 (B154 — criar assessor inline)
- GitHub Issue #56 (A6 — dobradinhas potenciais)
- `docs/plans/criar-assessor-inline-popover-municipios.md` — plano do B154 (precedente direto)
- `docs/plans/combobox-assessores-lista-municipios.md` — plano do B27 (popover de assessores)
- `docs/plans/dobradinhas-lista-liderancas.md` — plano do B31 (coluna de dobradinhas em lideranças)
- `src/components/campaign/municipality/MunicipalityListAdvisorsControl.tsx` — popover de assessores (precedente de implementação)
- `src/collections/StateDeputy.ts` — collection StateDeputy (name unique, slug, party)
- `src/utilities/stateDeputyData.ts` — `loadStateDeputySummaries`, `StateDeputySummary`
- `src/utilities/municipality/municipalityViewModels.ts` — `MunicipalityListViewModel`, `municipalityListSelect`
- `src/utilities/municipality/municipalityPageData.ts` — `loadMunicipalityListPageBundle`
- `src/app/(campaign)/campanha/(app)/municipios/page.tsx` — página da lista
- `src/app/(campaign)/campanha/(app)/municipios/advisors/route.ts` — endpoint de advisors (precedente)
