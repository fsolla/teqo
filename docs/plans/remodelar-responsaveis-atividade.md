# Remodelar responsáveis da Atividade — campo único polimórfico multi-valor

Status: rascunho
Atualizado em: 2026-08-08
Issue: #426
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: B — muda o card "Pessoas e organizações" do form completo + detalhe (campos somem/somam)
Appetite: ~1–1,5 dia eng; um outcome verificável — um compromisso pode ter vários responsáveis de papéis distintos
Responsável: —

## Intenção

Hoje um compromisso tem **três campos separados**: `responsible` (um Contact avulso), `advisors` (assessores/campaignUser, vários) e `leadership` (uma liderança). Na mesa, o coordenador pensa em **“quem é responsável por este compromisso”** — e isso pode ser o candidato, um assessor, uma liderança ou uma dobradinha, **um ou vários ao mesmo tempo**. Três campos forçam a mesa a decidir arbitrariamente onde cada pessoa entra, e o candidato/coordenador não tem onde entrar (não são Contact nem cabem em assessor/liderança). Unificar num **campo único `responsible`, polimórfico (staff `campaignUser` nas funções assessor/candidato/coordenador, `leadership`, `stateDeputy`) e de múltiplos valores**, removendo `advisors` e `leadership`.

## Persona e fluxo

- **Persona / contexto:** coordenador (ou assessor com acesso) montando eventos na agenda ou no form completo; precisa registrar quem conduz, sem enquadrar pessoas erradas.
- **Job principal:** indicar **um ou mais responsáveis** de qualquer papel da campanha num único seletor.
- **Fluxo desejado:** form completo (ou o overlay da criação rápida na agenda) → seletor "Responsáveis" → escolhe vários (candidato, assessor, liderança, dobradinha) → salvar → detalhe mostra todos com seus tipos.
- **Anti-goals de produto:** não é segundo cadastro de pessoa (só escolhe entidades existentes); não é "responsável por município" já coberto por outra entidade; não introduz papel novo nem altera quem pode entrar.

### Esboço de fluxo (B)

```text
[form completo de atividade] → "Responsáveis" → busca por nome → marca 1+ de
  qualquer papel (candidato/assessor/liderança/dobradinha) → salvar → detalhe lista
```

## Objetivo e aceite

- A Atividade passa a ter **um campo `responsible`** que aceita **vários** valores e pode referenciar **pessoas de qualquer papel**: assessor, candidato ou coordenador (staff `campaignUser`), liderança (`leadership`), dobradinha (`stateDeputy`).
- Os campos `advisors` e `leadership` **saem do modelo e da UI** (form completo, detalhe, agenda); a informação que morava neles migra para `responsible`.
- Assessor continua podendo **ver/editar** os compromissos em que está listado como responsável (mesmo direito que `advisors` lhe dava, agora via `responsible`).
- Acesso de criação/edição segue as regras atuais (staff cria; assessor edita o que administra + o que lhe é imputado).
- `responsible` opcional no form completo (como hoje); obrigatório só título/município.
- Não cadastra entidade nova no seletor (sem padrão B154 aqui).

## Dados (intenção)

- **Vou apresentar dados?** Não. `Dados: N/A` — remodel de escrita/relacionamento; não introduz métrica, série, ranking nem mapa.
- **Decisões desbloqueadas:** coordenador define quem conduz o compromisso **sem enquadrar papel em campo errado**, com múltiplos responsáveis quando fizer sentido.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/collections/Activity.ts` — campo `responsible` passa a relationship **polimórfica e hasMany** (`relationTo` staff/leadership/stateDeputy); remove `advisors` e `leadership`; hooks `validateActivityAdvisors`, `deriveActivityFields` (auto-inclusão de assessor), `validateDeputyPresentTimeGate` re-expressos sobre `responsible`.
  - `src/utilities/access/activities.ts` — `canReadActivity` usa `advisors contains id` como escopo do assessor; passa a usar `responsible` (player id) + escopo de município.
  - `src/utilities/activityViewModels.ts`, `src/utilities/activityFormData.ts`, `src/app/(campaign)/campanha/actions/activity.ts` — tipos de input/view e parse do formulário acompanham a mudança.
  - `src/components/campaign/activity/ActivityForm.tsx` — card "Pessoas e organizações": um seletor multi-polimórfico `Responsáveis`; some o grupo de assessores e o combobox de liderança.
  - `src/app/(campaign)/campanha/(app)/atividades/[slug]/ActivityOverviewTab.tsx` — detalhe lista os responsáveis com tipo.
  - Busca: agregar opções de `leadership` + `stateDeputy` + staff `campaignUser` (precedentes: `searchActivityLeadershipOptions`, `loadStateDeputyOptions`, `searchActivityContactOptions`).
- **Precedente a olhar:** `criar-assessor-inline-popover` (B154), `remodelar-atividades-para-agenda` (C14), e2e `campaignActivity.e2e.spec.ts`.
- **Risco de acoplamento:** mudança de **schema** (migration) + **access** do assessor + **form completo** + **detalhe** + **e2e** — item serializado, sem paralelismo de agents; é pré-requisito do item "criar evento inline na agenda" (que consome o novo seletor).

## Dependências

- **Nenhuma dura** para si. Desbloqueia o item "Criar evento inline na agenda" (que depende deste).
- Chess com qualquer outra change que toque `Activity`/migrations (serialização).

## Fora de escopo

- Criar entidade nova no seletor (B154 fica para outro item, se o produto pedir).
- Mudar o acesso/regras do `deputyPresent` time gate (só re-expressar em `responsible`).
- Tarefas (`tasks[].responsible`) mantêm o próprio `responsible` de Contact — não coberto aqui.
- Rewrite do form completo além do card "Pessoas e organizações".

## Rabbit holes de produto

- **“Vira segundo cadastro de pessoa.”** Se a busca não achar, a tentação é criar inline (B154). **Corte:** só escolher entre existentes; sem criação no seletor.
- **“Polimorfismo é problema só de schema; produto já decidiu.”** Sim — produto decidiu (C). Este plano só garante que o **acesso do assessor** não quebre e que o **detalhe** mostre tipos.
- **“Vários de tudo.”** Multi-valor não significa "misturar assessores de outros municípios fora do escopo". **Corte:** a escolha respeta o escopo de leitura do ator (não busca quem o ator não pode ver).

## Questões em aberto (produto)

- **Exibição no detalhe/card da agenda:** **Opções:** A) lista "N resp do tipo X" colapsada com tooltip | B) chips individuais por responsável | C) contar só "Resp: N". **Recomendação: B** — chips com tipo, mesmo padrão do card de hoje ("Resp: nome") mas agora pode ser vários. _(assumido — validar)_
- **Ordem/relação com `tasks[].responsible`:** campo de tarefa (Contact) fica como está? **Recomendação: sim** — tarefa tem responsável próprio de execução; não acoplar. _(assumido — validar)_

## Decisões travadas (gate 2026-08-08)

- **(C)** Campo `responsible` **polimórfico multi-valor**: staff `campaignUser` (roles assessor/candidato/coordenador), `leadership`, `stateDeputy`.
- **Remover** `advisors` e `leadership` do modelo/form/detalhe; informação migra para `responsible`.
- Acesso do assessor via `responsible` (mantém o direito que `advisors` dava).

## Referências

- GitHub Issue: [#426](https://github.com/fsolla/teqo/issues/426)
- `src/collections/Activity.ts`, `src/utilities/access/activities.ts`, `src/components/campaign/activity/ActivityForm.tsx`
- Deps: item "Criar evento inline na agenda" ([#428](https://github.com/fsolla/teqo/issues/428), C91) consome este seletor.
