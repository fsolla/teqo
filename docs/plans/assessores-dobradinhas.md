# B156 — Assessores por dobradinha

Status: blocked (Issue: #360)
Atualizado em: 2026-08-04
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B156**)
Impeccable: C — coluna nova na lista + seção nova no detalhe (superfície existente)
Appetite: ~0,75 dia eng; migration de campo + coluna + seção detalhe
Model: `composer-2.5`
Responsável: —

## Dados → decisão → apresentação

Dados: N/A (atribuição categórica de pessoas, sem KPI ou métrica).

## Contexto

Nas sessões de planejamento de campanha, a coordenação designa assessores para
gerir cada dobradinha — um assessor fica responsável por cuidar do
relacionamento com o deputado estadual parceiro: garantir que receba material
(adesivos, santinhos), manter contato e alinhar a atuação nos municípios onde
a dobradinha está presente.

Hoje essa designação existe só fora do sistema. Não há campo no modelo de
`StateDeputy` para registrar quais assessores respondem por qual dobradinha.

**O que já existe:**

- `StateDeputy` (dobradinha): `name`, `slug`, `party`, `notes`, `createdBy`
- `Municipality.advisors`: padrão estabelecido de atribuição de assessores
  (hasMany → `campaignUser`, validated com `eligibleCampaignStaffWhere`,
  access `canManageCampaignStaffField` para unrestricted)
- Lista `/campanha/dobradinhas` com colunas Nome, Partido, Municípios, Lideranças
- Detalhe `/campanha/dobradinhas/[slug]` com seções Municípios e Lideranças
- Access de `StateDeputy`: staff lê, unrestricted (+admin) cria/edita,
  admin-only delete

**Por que não é um problema de produto conhecido antes:** a campanha está
entrando na fase de operação concreta das dobradinhas (distribuir material,
coordenar agendas). Sem o vínculo no sistema, a coordenação pergunta
"quem está com a dobradinha X?" e a resposta está na cabeça das pessoas.

## Objetivos

- Adicionar campo `advisors` hasMany → `campaignUser` em `StateDeputy`
- Access de leitura: staff vê; escrita: unrestricted (coordinator + candidate)
  atribui — mesmo padrão de `Municipality.advisors`
- Validation: assessores designados devem ser staff elegível
  (`eligibleCampaignStaffWhere`) — mesmo padrão de `validateMunicipalityAdvisors`
- Coluna "Assessores" na lista `/campanha/dobradinhas` — chips com nome,
  link para `/campanha/assessores/[id]`, toggle add/remove com busca inline
  (mesmo componente `MunicipalityPortfolioCell` generalizado, ou um
  `AdvisorRelationCell` se o padrão divergir)
- Seção "Assessores" no detalhe `/campanha/dobradinhas/[slug]` — lista de
  nomes linkados com badge de contagem, paralela às seções Municípios e
  Lideranças
- Loader `loadStateDeputyDetail` e view model `StateDeputyRowViewModel`
  incluem advisors
- Migration nova (campo de relacionamento)

## Decisões travadas

- **Campo no `StateDeputy`, não em superfície separada.** A relação é
  intrínseca à dobradinha — não precisa de collection de join nem de UI
  genérica de "atribuições". **Rejeitado:** tabela de join `StateDeputyAssignment`
  (overengineered para um relacionamento 1:N simples); gerenciar do lado do
  assessor (outro job, útil mas separado: "que dobradinhas este assessor gere?").
- **Access = mesmo padrão de `Municipality.advisors`.** Unrestricted atribui;
  staff lê. **Rejeitado:** só coordinator (candidate ficaria cego); leader vê
  (leader é lockdown — não vê dobradinhas de forma alguma).
- **Coluna na lista, não só no detalhe.** O job "quem cobre qual dobradinha?"
  é comparativo entre linhas — pede tabela. **Rejeitado:** só no detalhe (obriga
  abrir N fichas para responder a pergunta); tabela pivô assessor×dobradinha
  (outra tela, outro appetite — bom, mas separado).
- **Sem alterar `Municipality.advisors` ou a página de assessores.** Este item
  modela dobradinha→assessores; o inverso (assessor→dobradinhas) é natural como
  follow-up mas não neste appetite.

## Questões em aberto

- **Coluna "Assessores" na lista usa qual padrão de chip?**
  **Opções:** A) mesmo `MunicipalityPortfolioCell` generalizado (chips de
  nome + X para remover + busca inline com toggle) — padrão que já serve
  municípios e lideranças na mesma lista | B) `LeadershipStateDeputyRelationCell`
  adaptado (chips sem o drawer de busca, edição só no detalhe).
  **Recomendação:** **A** — o job principal é "editar onde se vê", e o
  componente de municípios na mesma página já prova que funciona com
  advisors. O custo de generalizar é baixo (passar `collection`/`labelField`
  como parâmetro) e o ganho de UX é alto.
- **No detalhe, a edição dos assessores é inline (chips com busca) ou
  link "gerencie na lista"?** **Recomendação:** chips com busca inline
  (mesmo padrão da lista) — "edit where you see".
- **Exibir assessores da dobradinha na busca global do Início
  (B52 já cobre `searchHomeStateDeputies`)?** **Recomendação:** **não
  neste appetite** — B52 retorna hits de dobradinha por nome; assessores
  associados entram como card de contexto se/quando o desenho de resultado
  evoluir (follow-up).
- **Ordenação/filtro por assessor na lista de dobradinhas?**
  **Recomendação:** **não neste appetite** — coluna de exibição resolve o job
  imediato; filtro/ordenação é follow-up natural se a lista crescer (hoje
  tem ~dezenas de dobradinhas).

## Não escopo

- Página de assessor mostrando "suas dobradinhas" (inverso da relação)
- Filtro por assessor na lista de dobradinhas
- Ordenação por assessor
- Ações rápidas de dobradinha no contexto do assessor
- Alterar `Municipality.advisors` ou a página `/campanha/assessores`
- Consent novo (staff interno gerenciando staff — sem LGPD adicional)
- Notificações quando um assessor é designado/removido
- Sincronizar a designação com eventos de campanha ou distribuição de material

## Rabbit holes

- **Generalizar `MunicipalityPortfolioCell` para qualquer relação.**
  O componente hoje aceita `ownerId`, `municipalityIds`, `municipalityIndex`,
  `commitAction` — fortemente tipado para municípios. Generalizar para
  qualquer `{ id, label, href }` com action genérica é um refactor que
  toca 3+ call sites (lideranças, dobradinhas, assessores).
  **Mitigação:** começar com uma cópia especializada
  `AdvisorPortfolioCell` (só o que muda é a fonte de busca:
  `campaignUser` com `eligibleCampaignStaffWhere` em vez do portfolio index).
  Se a duplicação doer, extrair depois (padrão "second use extracts").
- **Edição de assessores direto na lista versus só no detalhe.**
  Se a coluna for read-only com link para detalhe, o appetite cai pela
  metade mas o job "comparar e editar" fica pior. **Mitigação:** começar
  com edição inline; se o componente de busca de staff for complexo demais,
  fallback para só exibição + link no detalhe.

## Adiado com gatilho

- **Filtro/ordenação por assessor na lista.** Revisitar quando: a lista
  de dobradinhas passar de ~40 itens e a rolagem visual para achar "as
  minhas" virar atrito medido.
- **Busca global retornando assessores como contexto da dobradinha.**
  Revisitar quando: o card de resultado de busca de dobradinha for
  redesenhado com metadados expandidos.

## Dependências

- Nenhuma dura. Reusa `eligibleCampaignStaffWhere`, `canManageCampaignStaffField`,
  `canReadCampaignStaffField`, e o padrão de `Municipality.advisors`.
- Sem dependência de B19 (assessores) — o campo `campaignUser` já existe.

## Canvas UI

Canvas de rascunho UI/UX pendente (sem `skill canvas` disponível nesta
sessão). O executor deve criar o canvas no gate de implementação.

Resumo textual da superfície:

**Lista `/campanha/dobradinhas`:**

- Nova coluna "Assessores" entre "Municípios" e "Lideranças" (ou após
  "Lideranças" se fizer mais sentido de leitura)
- Célula: chips com nome do assessor (ex. "Maria Silva ✕"), link para
  `/campanha/assessores/[id]`, toggle de adição via busca inline de
  `campaignUser` (`eligibleCampaignStaffWhere`)
- Comportamento: passar o mouse revela ✕ para remover; busca no canto
  da célula (input que filtra staff elegível)
- Vazio: "—" (sem estado especial)

**Detalhe `/campanha/dobradinhas/[slug]`:**

- Nova `<section>` entre "Lideranças associadas" e "Editar dobradinha"
  (ou como terceiro card no grid 2-col, se couber)
- Cabeçalho: ícone `UserCog` + "Assessores responsáveis" + `<Badge>` com contagem
- Lista de chips: nome linkado para `/campanha/assessores/[id]`
- Adição: input de busca inline que filtra staff elegível e sugere nomes
- Vazio: "Nenhum assessor designado. Atribua pela lista de dobradinhas."

## Referências

- `src/collections/StateDeputy.ts` — coleção atual (sem `advisors`)
- `src/collections/Municipality.ts` — padrão `advisors` (L298–308) + validação
- `src/utilities/access/stateDeputies.ts` — access atual
- `src/utilities/access/shared.ts` — `eligibleCampaignStaffWhere`
- `src/utilities/stateDeputyData.ts` — loaders da lista e detalhe
- `src/app/(campaign)/campanha/(app)/dobradinhas/page.tsx` — lista
- `src/app/(campaign)/campanha/(app)/dobradinhas/[slug]/page.tsx` — detalhe
- `docs/plans/gerenciar-assessores.md` — B19, padrão de gestão de assessores
- `src/components/campaign/shared/MunicipalityPortfolioCell.tsx` — padrão de
  chip-cell com busca inline (referência para o componente de advisors)
