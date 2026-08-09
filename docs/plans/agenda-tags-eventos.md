# Agenda: tags para agrupar e filtrar compromissos

Status: rascunho
Atualizado em: 2026-08-09
Issue: #506
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na superfície existente (sheet de criação + strip de filtros + evento do calendário da agenda)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-13/canvases/plan-c105-ui-draft.canvas.tsx
Appetite: ~1 dia eng; um outcome verificável — cada equipe agrupa os compromissos do jeito dela e a agenda filtra por tag
Responsável: —

## Intenção

Os compromissos da agenda são heterogêneos — caminhada, panfletagem, reunião, comício, gravação — e hoje só dá para agrupar por município e pelos filtros existentes. Queremos **tags livres** no compromisso (chips digitados pelo usuário, com sugestões das tags já usadas) e um **filtro por tag na agenda dentro da filter omnibox existente** (C94), para cada equipe organizar do jeito que achar melhor: o coordenador prepara o dia por tipo de atividade, o assessor filtra "só panfletagem" no território dele.

## Persona e fluxo

- **Persona / contexto:** coordenador e assessores de campo; cada um tem o próprio vocabulário de trabalho ("giro", "panfletagem", "reunião de rua").
- **Job principal:** agrupar os compromissos do próprio jeito e **ver a agenda filtrada por esse grupo** com um toque.
- **Fluxo desejado:**
  1. Cria um compromisso no sheet → digita tags no campo "Adicionar tags" (chips que entram ao teclar; sugestões das tags já usadas na campanha aparecem).
  2. Salva → o evento no calendário mostra um rótulo leve de tag.
  3. Na agenda, a **filter omnibox** (C94) ganha a tag como opção: escolheu a tag dentro da omnibox, ela vira chip no próprio campo da omnibox, combinando com os filtros atuais (município etc.) → a agenda mostra só os compromissos com aquela tag.
- **Anti-goals de produto:** tag **não** é pessoa (`Contact`) nem taxonomia editorial (coleção `Tag` dos posts é outra coisa — nada de relação com ela); **não** é lista curada obrigatória com admin; **não** vira o formulário completo (tarefas/organizações continuam no detalhe); liderança não acessa a agenda (inalterado).

### Esboço de fluxo (B)

```text
[sheet de criação] → "Adicionar tags" → chips: caminhada · panfletagem
  → salvar → evento com rótulo de tag no calendário
[agenda] → filter omnibox → escolhe a tag (ex.: caminhada) → chip na omnibox, combina com o resto
```

## Objetivo e aceite

- O sheet de criação ganha um campo de **tags** (chips adicionáveis/removíveis; texto livre; sugestões das tags já usadas na campanha; sem duplicatas).
- As tags do compromisso aparecem como **rótulo leve** no evento do calendário (ver questão em aberto).
- A agenda ganha **filtro por tag dentro da filter omnibox existente** (C94): a tag aparece como opção da omnibox; escolhida, vira chip no próprio campo da omnibox (mesmo padrão dos chips atuais de município etc.), com multisseleção, **combinando** com os demais filtros e persistindo no estado/URL como eles.
- Limites de produto: poucas tags por compromisso (recomendação: até 3) e texto curto (recomendação: ~24 caracteres) — ver questão em aberto.
- Sem regressão: criar com horário, remanejo por arrasto (C15), filtros atuais (C94) e "Mais detalhes" (C91) intactos.

## Dados (intenção)

- **Vou apresentar dados?** Não. `Dados: N/A` — filtro é estado de tela/URL, não apresentação de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/components/campaign/activity/ActivityInlineCreate.tsx` — campo de tags no sheet (chips; há precedente de chips em inputs na campanha).
  - `src/components/campaign/activity/ActivityAgendaFilters.tsx` (filter omnibox C94) — a tag entra como **opção da omnibox** (chips no campo, mesmo padrão dos filtros atuais); e `src/utilities/activityUi.ts` (estado/URL dos filtros da agenda).
  - `src/components/campaign/activity/ActivityAgenda.tsx` (`toEventInput`) — rótulo de tag no evento.
  - Fluxo completo de persistência: `src/app/(campaign)/campanha/actions/activity.ts`, `src/lib/schemas/activity.ts`, e o campo novo viaja no prefill do "Mais detalhes" (`buildActivityCreateHref`).
- **Precedente a olhar:** C94 (combobox de filtro da agenda), C91 (`agenda-criar-evento-inline.md` — sheet e "Mais detalhes"), chips de filtro em outras listas (`filtros-municipios-dobradinha-lideranca`), a distinção taxonomia `Tag` (posts) vs dados de campanha.
- **Risco de acoplamento:** a omnibox é chassis compartilhado das listas /campanha — a tag entra como **dimensão a mais da omnibox da agenda**, sem mudar o combobox das demais listas; o estado de filtro novo segue o padrão de URL existente para o "Mais detalhes"/compartilhamento continuarem coerentes.

## Dependências

- Suave: **C103** (mesma superfície — sheet da criação; prefira C103 primeiro). **C104** independente.

## Fora de escopo

- Taxonomia administrativa (lista de tags fixa, cores por tag, admin) → se pedirem, item futuro.
- Filtro de tags nas demais listas /campanha (só a agenda).
- Tags como critério do feed iCal/import (C92–C96 não mudam).
- Multi-dia, recorrência.

## Rabbit holes de produto

- **"Tags viram a taxonomia editorial (Tag dos posts)."** A coleção `Tag` do site é outra coisa (categorias de notícia + `hidden`). **Corte:** tags livres da agenda, sem relação com `Tag` nem admin.
- **"Sugestões viram lista obrigatória."** **Corte:** texto livre; as sugestões são só autocomplete das já usadas.
- **"Filtro de tag vira busca exclusiva."** **Corte:** a omnibox ganha a tag como **uma** dimensão a mais — município, deputado presente, busca de texto e os demais filtros continuam como estão; a tag é opção dentro da mesma omnibox, não uma nova barra.
- **"Tag precisa de identidade visual."** **Corte:** rótulo neutro e discreto; o filtro ativo já é o destaque.

## Questões em aberto (produto)

- **Texto livre ou lista curada?** **Opções:** A) livre com sugestões das tags já usadas | B) lista fixa definida pela equipe | C) híbrido (livre + mais usadas em destaque). **Recomendação: A** — o pedido é "agrupar como acharem melhor"; a curadoria nasce naturalmente pelas sugestões. _(assumido — validar)_
- **Onde o filtro de tag vive?** **Opções:** A) chips separados no strip | B) dentro da filter omnibox existente (C94), como opção + chip no campo | C) os dois. **Recomendação: B** — pedido explícito do usuário no gate: o filtro é parte da omnibox, não chips separados. _(decidido no gate)_
- **Tags aparecem no evento do calendário?** **Opções:** A) rótulo pequeno no card do evento | B) só na criação e nos filtros. **Recomendação: A** — reconhecimento visual leve; se poluir em visões densas (mês), cai para B. _(assumido — validar)_
- **Limites:** **Opções:** A) até 3 tags por compromisso, ~24 caracteres | B) sem limites. **Recomendação: A** — limite leve evita card poluído; ajustável depois. _(assumido — validar)_

## Referências

- GitHub Issue: — (a registrar)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-13/canvases/plan-c105-ui-draft.canvas.tsx`
- `src/components/campaign/activity/ActivityInlineCreate.tsx`, `ActivityAgendaFilters.tsx`, `ActivityAgenda.tsx` (`toEventInput`)
- Precedentes: `docs/plans/c94-agenda-combobox-header-acoes-rapidas.md`, `docs/plans/agenda-criar-evento-inline.md` (C91)
