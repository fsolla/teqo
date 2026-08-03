# Criar assessor inline no popover da lista de municípios

Status: rascunho
Atualizado em: 2026-08-03 (gate: decisões de produto travadas)
Issue: #352
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe no popover existente de Assessores em `/campanha/municipios`
Canvas UI: /Users/francisco.solla/.cursor/projects/teqo/canvases/plan-b154-ui-draft.canvas.tsx
Appetite: ~0,5 dia eng; uma nova opção no Command do popover + endpoint de criação mínima
Responsável: —

## Intenção

Numa reunião de planejamento de campanha, o coordenador está percorrendo a lista de municípios em `/campanha/municipios`, atribuindo assessores. Alguém na sala é designado para um município, mas essa pessoa **ainda não tem conta** no Teqo. Hoje, o coordenador precisa: (1) sair da lista, (2) navegar para `/campanha/assessores`, (3) criar a conta com nome/e-mail/senha, (4) voltar para a lista, (5) reencontrar o município e atribuir. Isso quebra o fluxo da reunião — a lista é o ponto de decisão, e a ferramenta força um desvio.

**Criar o assessor no ato, sem sair da lista**, com o mínimo de informação — só o nome. O resto (e-mail, senha, celular) pode ser completado depois em `/campanha/assessores/[id]`.

## Persona e fluxo

- **Persona / contexto:** coordenador (ou candidato) em reunião de planejamento, no desktop ou tablet, percorrendo a lista de municípios e atribuindo responsáveis.
- **Job principal:** designar um assessor recém-nomeado a um município **sem interromper o fluxo da lista**.
- **Fluxo desejado:**
  1. Abre o popover "Atribuir assessores" num município (igual hoje).
  2. Digita o nome da pessoa no campo de busca.
  3. Se o nome não casa com nenhum assessor existente, o primeiro item da lista é **"Criar assessor '[nome digitado]'"** com ícone de `+` (ou `UserPlus`).
  4. Clica/Enter nessa opção → o assessor é criado (nome + papel `advisor`, mais nada) e **automaticamente atribuído** ao município atual.
  5. O chip aparece na lista de atribuídos, o campo de busca é limpo, e o coordenador continua — sem popover fechado, sem navegação.
- **Anti-goals de produto:**
  - **Não** é um formulário completo de criação de conta (sem celular, senha ou foto; o e-mail stub `<slug>@criado.invalid` é gerado automaticamente, igual ao padrão `@planilha.invalid` do seed E4R — a conta não faz login até um coordenador trocar as credenciais em `/campanha/assessores/[id]`).
  - **Não** permite editar o perfil do assessor recém-criado inline.
  - **Não** resolve duplicatas — se o coordenador digitar "Maria" e já existir uma "Maria Silva", o nome exato não casa e a opção de criar aparece; a correção é manual (remover + buscar de novo ou editar em `/campanha/assessores`).
  - **Não** oferece criação para outros papéis — sempre `advisor`.
  - **Não** está disponível para o assessor (que já não vê o popover de atribuição; a lista de elegíveis é `eligibleCampaignStaffWhere`).

### Esboço de fluxo

```text
[Coordenador na lista de municípios]
  → abre popover "Atribuir assessores" no município X
  → digita "Carlos" no Command
  → nenhum assessor existente casa com "Carlos"
  → lista mostra: "+ Criar assessor 'Carlos'"
  → clica/Enter
  → chip "Carlos" aparece entre os atribuídos
  → campo de busca limpo, foco mantido
  → coordenador continua a reunião
```

## Objetivo e aceite

- Coordenador cria um `campaignUser` com papel `advisor` e o nome digitado, **sem sair do popover** da lista de municípios.
- O assessor recém-criado é **automaticamente atribuído** ao município onde o popover foi aberto.
- O chip do novo assessor aparece imediatamente (estado otimista), sem recarregar a lista inteira.
- Se a criação falhar (ex.: nome duplicado, erro de rede), o coordenador vê uma mensagem de erro no próprio popover (reusa o `Alert` já existente).
- O assessor criado **não** consegue fazer login até que um coordenador cadastre e-mail/senha em `/campanha/assessores/[id]` — mesmo comportamento dos placeholders `@planilha.invalid` do seed E4R.
- `leader` não é afetado (já não vê o popover de assessores).

## Dados (intenção)

- **Vou apresentar dados?** Não. `Dados: N/A` — o item é affordance de **escrita** sobre `municipality.advisors` via criação de `campaignUser`; não introduz métrica, série, ranking ou mapa novo.
- **Decisões desbloqueadas:** coordenador decide quem assessora cada município **no momento da reunião**, sem fila administrativa de "criar conta antes de atribuir".

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/components/campaign/municipality/MunicipalityListAdvisorsControl.tsx` — o popover de atribuição (B27 ✓). Mudança: o bloco `filteredOptions.length === 0` ganha uma alternativa; se `query` não-vazio, renderiza um `CommandItem` de criação antes do "Nenhum resultado".
  - `src/app/(campaign)/campanha/(app)/municipios/advisors/route.ts` — endpoint `POST /campanha/municipios/advisors` (B27 ✓). Será **estendido** com campo opcional `name` no body: quando presente, cria o `campaignUser` (nome + `role: 'advisor'` + e-mail stub `<slug>@criado.invalid` no padrão E4R, sem senha — o Payload exige `email` para criar auth collection) e atribui ao município na mesma transação; quando ausente, comporta-se como hoje (toggle).
  - `src/app/(campaign)/campanha/actions/municipality.ts` — `setMunicipalityAdvisorMembershipRecord` (B27 ✓). A criação usaria `payload.create({ collection: 'campaignUser', data: { name, role: 'advisor' } })` + o mesmo lock e transação do assign.
  - `src/utilities/municipality/municipalityViewModels.ts` — `getEligibleAdvisorOptions` (referência); a lista de opções existentes já é carregada e alimenta o filtro.
- **Precedente a olhar:**
  - B27 `combobox-assessores-lista-municipios.md` — o popover e endpoint atuais, com delta otimista, chips, `Command`, `Alert` de erro.
  - B19 `gerenciar-assessores.md` — criação de conta `advisor` em `/campanha/assessores`.
- **Risco de acoplamento:** o endpoint `POST /campanha/municipios/advisors` é sobrecarregado com campo `name` opcional — o toggle existente (sem `name`) não muda de comportamento. O `MunicipalityListAdvisorsControl` toca estado otimista (`requestSeqRef`, `latestConfirmedRef`) — o novo fluxo deve seguir o mesmo padrão ou a célula pode dessincronizar. **O `advisorLookup` local (memo) deve incluir o assessor recém-criado** para que ele apareça como opção selecionável em edições seguintes no mesmo carregamento de página, sem esperar o reload RSC.

## Dependências

- **Nenhuma dura.** Reusa B27 (popover + endpoint), B19 (criação de `campaignUser`), `eligibleCampaignStaffWhere` (escopo de assessores elegíveis).
- **Suaves:** `nextAdvisorIdsAfterMembership` em `src/lib/municipalityAdvisorMembership.ts` — se a criação inline também validar o teto de 10, reusa; senão, a validação fica no hook `validateMunicipalityAdvisors`.

## Fora de escopo

- Preencher e-mail, celular ou senha do assessor inline → `/campanha/assessores/[id]`.
- Criar com papel diferente de `advisor` → `/campanha/assessores`.
- Editar ou renomear o assessor criado no popover → `/campanha/assessores/[id]`.
- Evitar duplicatas por similaridade (ex.: "Maria" vs "Maria Silva") — fora do appetite; o coordenador é responsável por verificar.
- Sincronizar a **faceta** do filtro `?advisor=` sem recarregar — o assessor novo **não** aparece no filtro do header imediatamente (reconcilia na próxima navegação, mesmo contrato de B24/B27).

## Rabbit holes de produto

- **"Criar assessor já com e-mail".** Se alguém "só completar" o campo de nome com um formulário de e-mail, o popover vira um cadastro de conta e o appetite explode. **Corte neste item:** só nome; credenciais ficam para `/campanha/assessores/[id]`.
- **"E se o nome já existe?"** Criar um assessor com nome idêntico a um existente não quebra nada — `campaignUser.name` não é unique. Mas a busca por nome pode criar confusão. **Corte neste item:** não implementar dedup por similaridade; o "Criar" só aparece quando o texto digitado não casa com **nenhum** nome existente (`matchesAtWordStart`).

## Decisões de produto (travadas no gate 2026-08-03)

- **Endpoint:** sobrecarregar `POST /campanha/municipios/advisors` com campo opcional `name`. Quando presente, cria `campaignUser` com e-mail stub (padrão E4R: `<slug-do-nome>@criado.invalid`) + `role: 'advisor'` e atribui ao município na mesma transação. Quando ausente, toggle normal.
- **Faceta do filtro `?advisor=`:** não atualiza imediatamente — reconcilia na próxima navegação (contrato B24/B27).
- **Lookup local:** o `advisorLookup` (memo do `MunicipalityListAdvisorsControl`) inclui o assessor recém-criado para que ele apareça como opção em edições seguintes **no mesmo carregamento de página**, sem esperar reload RSC.

## Questões em aberto (produto)

_Nenhuma — decididas no gate._

## Referências

- GitHub Issue #352
- Canvas UI (gate): `/Users/francisco.solla/.cursor/projects/teqo/canvases/plan-b81-ui-draft.canvas.tsx`
- `src/components/campaign/municipality/MunicipalityListAdvisorsControl.tsx` — popover de atribuição de assessores (B27 ✓)
- `src/app/(campaign)/campanha/(app)/municipios/advisors/route.ts` — endpoint atual de toggle (B27 ✓)
- `src/utilities/municipality/municipalityViewModels.ts` — `getEligibleAdvisorOptions`, `EligibleAdvisorOption`
- `docs/plans/combobox-assessores-lista-municipios.md` — plano do B27
- `docs/plans/gerenciar-assessores.md` — plano do B19 (criação de assessores)
