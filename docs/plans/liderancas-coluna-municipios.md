# Coluna de lideranças na tabela de municípios

Status: rascunho
Atualizado em: 2026-08-04
Issue: #359
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe em `MunicipalityList` (`/campanha/municipios`), coluna nova ao lado de Assessores; sem rota nova de UI
Canvas UI: N/A — sem UI (o canvas da skill `canvas` não está disponível; a intenção visual é um espelho da coluna "Assessores" já existente — chips + Popover + Command, mesma máquina de interação)
Appetite: ~0,5–1 dia eng; uma coluna editável na tabela de municípios
Responsável: —

## Intenção

Hoje, na tabela de municípios (`/campanha/municipios`), a equipe de campanha vê e edita os assessores designados inline (coluna "Assessores"). Mas as **lideranças** vinculadas a cada município só são visíveis entrando na ficha individual da liderança — não há uma coluna que mostre "quais lideranças atuam neste município" na lista. Isso obriga a navegar para a lista de lideranças (`/campanha/liderancas`) ou abrir o detalhe do município para cruzar essa informação.

O pedido é espelhar a coluna "Assessores" com uma coluna "Lideranças": mesma affordance de edição inline (chips + typeahead + criar inline), mesma máquina de interação, mesma visibilidade por papel.

## Persona e fluxo

- **Persona / contexto:** Staff da campanha (coordenação, assessores) na mesa de operações, navegando a lista de municípios para decidir alocação, priorização e próximos passos.
- **Job principal:** Ver e editar quais lideranças estão vinculadas a cada município — diretamente na lista, sem sair da tabela.
- **Fluxo desejado:**
  1. Staff abre `/campanha/municipios` e vê a coluna "Lideranças" ao lado de "Assessores".
  2. Cada célula mostra chips com os nomes das lideranças vinculadas ao município (ou "Nenhuma" se vazio).
  3. Staff clica na célula → abre Popover com typeahead (busca por nome do contato) + lista de chips removíveis.
  4. Staff digita para buscar uma liderança existente → seleciona → chip aparece otimista (antes do servidor confirmar).
  5. Se a liderança não existe ainda, staff pode **criar inline** (abre mini-form com nome do contato + telefone; cria no servidor como nova `leadership` vinculada a este município; erro faz rollback).
  6. Staff remove um chip → ele some otimista. Se o servidor falhar, volta + toast de erro.
  7. Lideranças adicionadas/removidas inline são refletidas imediatamente na lista (sem recarregar a página).
- **Anti-goals de produto:**
  - Não é um formulário multi-campo de edição de liderança (status, exclusividade, organizações, dobradinhas) — isso continua na ficha `/campanha/liderancas/[id]`.
  - Não é uma segunda lista de lideranças embutida na tabela de municípios — é uma coluna de vínculo rápido, igual a de assessores.
  - Líder (papel `leader`) não vê esta coluna — lockdown permanece.

### Esboço de fluxo

```text
Lista de municípios (staff)
  │
  ├─ Coluna "Lideranças"
  │    ├─ Célula fechada: chips com nome da liderança (ou "Nenhuma")
  │    └─ Célula aberta (Popover):
  │         ├─ Typeahead (Command): busca por nome do contato
  │         ├─ Chips removíveis: cada liderança vinculada
  │         └─ "Criar liderança" inline (se não encontrada na busca)
  │              └─ Mini-form: nome + telefone → cria → vincula
  │
  └─ Mutação otimista + rollback em erro (mesmo padrão de assessores)
```

## Objetivo e aceite

- Coluna "Lideranças" aparece na tabela de municípios para staff (coordenação + assessores), ao lado ou próxima da coluna "Assessores".
- Célula mostra chips com o nome do contato de cada liderança vinculada ao município. Município sem lideranças mostra "Nenhuma" (ou badge equivalente ao `MissingAdvisorBadge` quando prioritário).
- Staff pode adicionar/remover lideranças inline: typeahead busca por nome do contato (via `contact.name`), seleção otimista, rollback em erro de rede/servidor.
- Staff pode criar uma nova liderança inline vinculada ao município atual, sem sair da tabela.
- Assessor só vê e edita lideranças dos municípios que administra (mesmo escopo de `canReadLeadership` + filtro `advisors`).
- Coordenação e candidato veem e editam todas.
- Líder (`leader`) não vê a coluna (lockdown).
- **Guardrails:** sem migration fora do padrão, sem collection nova, sem alterar o schema de `leadership`; `Consent` permanece fail-closed para lideranças novas criadas inline (mesmo comportamento de criar liderança pelo form completo).

## Dados (intenção)

- **Vou apresentar dados?** Não — coluna qualitativa de vínculo. Sem métrica, contagem, série ou ranking.
- **Decisões desbloqueadas:** Staff decide "quem está conosco neste município" diretamente na lista, sem abrir ficha externa.
- **Forma:** *adiada ao plano de implementação* — chips com nome do contato, igual a assessores.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/collections/Municipality.ts` — novo field `leadership` (relationship → `leadership`, `hasMany`), mirror de `advisors` (linhas 298–310)
  - `src/components/campaign/municipality/MunicipalityList.tsx` — nova coluna `leaderships` na definição de `municipalityListColumns`
  - `src/components/campaign/municipality/MunicipalityListLeadershipsControl.tsx` — novo componente (espelho de `MunicipalityListAdvisorsControl.tsx`)
  - `src/app/(campaign)/campanha/(app)/municipios/leaderships/route.ts` + `types.ts` — endpoint JSON de mutação (espelho de `advisors/`)
  - `src/utilities/municipality/municipalityViewModels.ts` — estender `MunicipalityListViewModel` com `leadershipIDs` e `LeadershipSummary`
  - `src/utilities/access/municipalities.ts` — funções de access (espelho de `canAssignMunicipalityAdvisors` / `canManageMunicipalityAdvisors`)
  - `src/utilities/access/leaderships.ts` — já existe `canReadLeadership`; verificar se precisa de `canManageLeadershipMembership`
- **Precedente a olhar:**
  - `MunicipalityListAdvisorsControl.tsx` — a máquina completa de interação (chips + Popover + Command + delta otimista + undo + aria-live)
  - `src/app/(campaign)/campanha/(app)/municipios/advisors/route.ts` — contrato do endpoint JSON
  - B154 (`docs/plans/criar-assessor-inline-municipio.md` se existir) — criar inline no popover
  - `src/utilities/municipality/municipalityViewModels.ts` — `EligibleAdvisorOption`, `MunicipalityAdvisorSummary` como padrão para `EligibleLeadershipOption`, `MunicipalityLeadershipSummary`
  - `RelationChipCell` genérico (`src/components/campaign/shared/RelationChipCell.tsx`) — se já cobre o caso de relação many-to-many com typeahead + undo, o controle de lideranças pode ser um wrapper fino em vez de duplicar a máquina
- **Risco de acoplamento:**
  - Leader lockdown: `isCampaignStaff` / `isCoordinator` já controlam a visibilidade da coluna de assessores; a de lideranças deve usar o mesmo gate.
  - Relação bidirecional: `leadership.municipalities` e `municipality.leaderships` precisam manter consistência — adicionar uma liderança ao município deve ser visível na lista de lideranças também.
  - Migração: o novo field `leadership` no `Municipality` precisa de uma migration; se houver lideranças já vinculadas (via `leadership.municipalities`), a migration de reconciliação deve popular `municipality.leaderships` a partir dos dados existentes para não quebrar a relação reversa.

## Dependências

- Nenhuma (item auto-contido)

## Fora de escopo

- Editar campos da liderança (status, exclusividade, organizações, dobradinhas) inline — isso continua na ficha `/campanha/liderancas/[id]`.
- Coluna de lideranças em outras listas (dobradinhas, organizações) — só a tabela de municípios neste item.
- Criar contato (`Contact`) inline — criar uma liderança inline exige um `Contact` existente ou a criação de um novo `Contact` no mesmo fluxo (a decidir na implementação; se o mini-form inline criar `Contact` + `Leadership` em transação, é aceitável e segue o padrão de criar assessor do B154).

## Rabbit holes de produto

- **Sincronia bidirecional `leadership.municipalities` ↔ `municipality.leaderships`.** Se alguém "só adicionar o campo no Payload", as duas pontas da relação divergem (editar a liderança via `/liderancas/[id]` não atualiza `municipality.leaderships`, e vice-versa). **Corte neste item:** definir UMA ponta canônica de escrita (provável: `municipality.leaderships` como source of truth, com hook que sincroniza `leadership.municipalities`; ou manter `leadership.municipalities` como canônica e a coluna do município ser só leitura/atalho). A decisão é de implementação, mas o plano de intenção registra o risco.
- **Performance com muitas lideranças.** Um município pode ter dezenas de lideranças; carregar todos os nomes para todas as 435 linhas da tabela pode ser pesado. **Corte neste item:** seguir o mesmo padrão de assessores (batch de names por ID, carregado uma vez no server component). Se for lento, paginar ou virtualizar — mas não neste item.

## Questões em aberto (produto)

- ~~A coluna substitui ou complementa a seção de lideranças no detalhe do município (B152)?~~ **Resolvido:** A — a coluna é atalho de edição rápida; o detalhe do município continua mostrando lideranças com mais informação.
- ~~Criar liderança inline exige criar `Contact` junto?~~ **Resolvido:** B — mini-form cria `Contact` + `Leadership` no mesmo passo (igual B154).
- ~~A coluna deve aparecer antes ou depois de "Assessores"?~~ **Resolvido:** depois de "Assessores".
- ~~Sincronia bidirecional `leadership.municipalities` ↔ `municipality.leaderships`?~~ **Resolvido:** relação verdadeiramente bidirecional — editar a coluna do município atualiza `leadership.municipalities` também.

## Referências

- `src/collections/Municipality.ts` — field `advisors` (L298–310): padrão a espelhar
- `src/components/campaign/municipality/MunicipalityListAdvisorsControl.tsx` — máquina de interação completa
- `src/app/(campaign)/campanha/(app)/municipios/advisors/route.ts` — contrato do endpoint JSON
- `src/components/campaign/shared/RelationChipCell.tsx` — se aplicável como wrapper genérico
- `src/collections/Leadership.ts` — coleção de lideranças, field `municipalities` (relação reversa)
- `AGENTS.md` — "Campaign Municípios model", "Campaign auth" (lockdown de líder)
