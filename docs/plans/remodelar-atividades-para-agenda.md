# C14 — Remodelar atividades para a agenda (calendário)

Status: blocked (plano ainda não em main)
Atualizado em: 2026-08-06
Issue: #389
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: C — simplifica o formulário/detalhe de atividade e o vocabulário da vertical (pré-requisito da UI de calendário)
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-jr8x/canvases/plan-c14-ui-draft.canvas.tsx`
Appetite: ~1,5–2 dias eng; um outcome verificável — criar/editar atividade no modelo enxuto, pronto para calendário
Responsável: —

## Intenção

A equipe vive em Google Calendar; em Teqo a atividade ainda é um formulário operacional denso (tipo fixo `kind`, rascunho/planejado, origem, prazo, vários relacionamentos). Isso atrasa a adoção e força o “ligar pro candidato pra mexer no calendário”. Antes de colocar FullCalendar na tela, o modelo precisa **parecer compromisso de agenda**: tempo + lugar + quem participa + **`tags`** (ex-`kind`) — sem taxonomia rígida que a mesa não usa.

## Persona e fluxo

- **Persona / contexto:** coordenador ou assessor montando a semana sob pressão; celular ou mesa; não quer “cadastrar plano de ação”.
- **Job principal:** registrar ou ajustar um compromisso (com ou sem presença do deputado) em poucos campos, no vocabulário de calendário.
- **Fluxo desejado:** abre criar/editar → título, início/fim, município, flag “deputado presente”, tags livres, omnibox de associados (assessor / liderança / organização) → salva como `confirmado`; status só o ciclo útil (confirmado / realizado / cancelado).
- **Anti-goals de produto:** segundo cadastro de pessoa; enum rígido de tipo; campos de inteligência que a mesa não preenche; sync Google nesta fatia.

### Esboço de fluxo (C)

```text
[criar/editar] → tempo + município + tags + associados (omnibox)
               → (opcional) deputado presente
               → salvo como compromisso na agenda
```

## Objetivo e aceite

- Removidos do modelo/fluxo de produto: `origin`, `deadline`, status `rascunho`/`planejado`.
- No modelo, o campo **`kind` passa a se chamar `tags`**: deixa de ser enum fixo de tipo; vira tags livres (a mesa classifica e filtra como quiser — comício, imprensa, etc.).
- Status enxuto: `confirmado | realizado | cancelado`; compromisso novo nasce `confirmado` com `startAt` obrigatório.
- Associados (assessor, liderança, organização) numa **única** omnibox (multi-seleção mista).
- Continua: um município por atividade; staff-only (leader lockdown); `deputyPresent` acionável.
- **Remarcar / editar horário de compromisso com `deputyPresent`:** só **coordenador** e **candidato** nesta leva (assessor cria/edita o resto no seu escopo; mais papéis depois).
- Lista/detalhe/actions da vertical continuam usáveis após o remodel (C15 traz o calendário).
- Critério de campo: marcar compromisso novo em tempo comparable a um evento no Google Calendar (~menos de um minuto nos essenciais).

## Dados (intenção)

- **Vou apresentar dados?** Não — remodel de cadastro/fluxo.
- **Decisões desbloqueadas:** N/A nesta fatia (desbloqueia filtros/tags na C15/C16).
- **Forma:** adiada.

## Direção no codebase (hipótese)

- **Áreas prováveis:** vertical de atividades (forms, filtros), `src/components/campaign/activity/`, `src/lib/schemas/activity.ts`, actions, access (`deputyPresent` write gate), consumidores de `origin`/`kind`/`deadline` (E13, dossiê, triggers) — `kind` → `tags`; `origin`/`deadline` saem.
- **Precedente a olhar:** C3/C13; C12 (`origin` — **aceite explícito de remover** para simplificar); B138 omnibox; padrões de tag/filtro em outras verticais.
- **Risco de acoplamento:** leader lockdown; não inventar pessoa fora de `Contact`/relações; E13 e filtros que liam `kind` passam a `tags`.

## Dependências

- Nenhuma dura. Soft: C3/C13/C12/E13 entregues (este item **simplifica** inclusive cortando `origin` do C12).

## Fora de escopo

- FullCalendar / `/campanha/agenda` → **C15**.
- Sync / link de import → **C16**.
- Recorrência; novos papéis além de coordenador/candidato para presença do deputado.
- Redesign do compositor de giros (só não quebrar sem destino).

## Rabbit holes de produto

- **“Unificar atividade e giro.”** **Corte:** C14 só enxuga o átomo.
- **“Omnibox busca município/demanda/mídia.”** **Corte:** só associados; município campo próprio.
- **“Taxonomia oficial de tags.”** **Corte:** campo se chama `tags`; valores livres; a mesa inventa; filtro é o valor.
- **“Manter origin ‘só um pouco’.”** **Corte:** removido — produto pediu simplificar.

## Questões em aberto (produto)

- **Tags: livres digitáveis vs catálogo sugerido?** **Opções:** A) só livres | B) livres + sugestões das já usadas | C) catálogo admin fechado. **Recomendação:** **B** (livre + autocomplete do que já existe) — filtro sem burocracia. _(assumido — validar na implementação)_
- **Campo `responsible` (Contact) e tarefas/feed/resultado?** **Opções:** A) manter no detalhe | B) absorver na omnibox. **Recomendação:** **A**. _(assumido — validar)_
- **Dados históricos de `kind`/`origin`?** **Opções:** A) descartar | B) migrar valor antigo de `kind` para `tags`. **Recomendação:** **B** quando houver valor legível; `origin` some. _(assumido — executor decide o barato seguro)_

## Decisões travadas (gate)

- Remover `origin` (aceite: série J-B/C12 deixa de existir nesta dimensão).
- No modelo: renomear **`kind` → `tags`** (tags livres para filtro, não enum de tipo).
- Remarcar presença do deputado: só coordenador e candidato (por enquanto).
- Status: `confirmado | realizado | cancelado`; sem rascunho/planejado; sem `deadline` no compromisso.

## Referências

- GitHub Issue [#389](https://github.com/fsolla/teqo/issues/389)
- Canvas UI (gate): [`plan-c14-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-jr8x/canvases/plan-c14-ui-draft.canvas.tsx)
- `docs/plans/eventos-agenda-mobilizacao.md` (C3), `renomear-plano-acao-para-atividade.md` (C13), `registro-fundacao.md` (C12), `planejador-de-giros.md` (E13)
- `src/collections/Activity.ts`, `src/lib/schemas/activity.ts`, `src/components/campaign/activity/`
