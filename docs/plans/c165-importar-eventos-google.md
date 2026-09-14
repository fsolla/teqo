# Agenda: importar automaticamente eventos do Google como atividades (sem município, a partir de 16/08/2026)

Status: rascunho
Atualizado em: 2026-09-14
Issue: #1010
Priority: P2
Model: cursor-grok-4.5-high
Depends: C164
Impeccable: B — encaixe na lista de atividades, no overlay existente e na agenda
Rascunho UI: docs/plans/c165-importar-eventos-google-ui-draft.html
Appetite: ~3–4 dias eng; um outcome verificável — evento criado no Google após o início da campanha vira atividade no Teqo sozinho, e a coordenação atribui o município quando quiser
Responsável: —

## Intenção

A agenda da imprensa vive no Google Calendar, mas o Teqo só enxerga dela o que já nasceu no Teqo: o espelho (C114/C115) empurra atividades para o Google e aceita edições de eventos que o próprio Teqo criou — eventos estrangeiros são ignorados de propósito hoje. Daí o pedido do dono: "o que crio no Google não está aparecendo no Teqo". Este item reabre o corte do C115 (criação pelo Google fora de v1; "sem município não entra") para os eventos da conta conectada com início a partir do começo legal da campanha: eles entram como atividade sozinhos, nascem sem município — coisa que o precedente `supporter` já provou ser possível — e a coordenação tria quando quiser.

## Persona e fluxo

- **Persona / contexto:** assessoria de imprensa criando compromissos no Google Calendar, muitas vezes pelo celular; coordenação/candidato na mesa fazendo a triagem do que chegou.
- **Job principal:** "o que eu crio no Google aparece no Teqo sozinho; eu só atribuo o município depois".
- **Fluxo desejado:** a assessoria cria o evento no calendário da imprensa → em minutos ele aparece em `/campanha/atividades` como atividade confirmada, com badge "Do Google" e "Sem município" → a coordenação abre o overlay e escolhe o município (opcional, pode ficar sem) → a partir daí a atividade segue as regras normais (advisor da carteira vê) → editar/remarcar/cancelar no Google reflete; excluir no Google cancela a atividade.
- **Anti-goals de produto:** não virar sincronizador universal (convidados, descrição, RSVP, Meet); não criar segundo cadastro nem segunda fila de triagem; não abrir acesso novo à liderança; não apagar/alterar evento estrangeiro; não virar um painel de administração do sync.

### Esboço de fluxo (B)

```text
[assessoria cria no Google Calendar] — início ≥ 16/08/2026
→ motor Google (C164) detecta e importa → atividade `confirmado`, sem município
→ lista/agenda mostram o card com "Do Google" + "Sem município"
→ coordenação triagem: overlay → escolhe o município quando quiser
→ advisor da carteira passa a ver; edições/cancelamento no Google seguem refletindo
```

### Rascunho UI (B)

- Rascunho UI (gate): `docs/plans/c165-importar-eventos-google-ui-draft.html`

## Objetivo e aceite

- Evento criado no Google (conta da imprensa já conectada) com início a partir de 16/08/2026 vira atividade no Teqo sozinho, com a imediatez Google→Teqo do C164 — sem ninguém copiar dado.
- O overlay passa a permitir criar/editar atividade sem município; sem município só coordenação/candidato veem; ao atribuir, a atividade entra nas regras normais (advisor por carteira/responsável).
- Vínculo estável e idempotente: re-sync não duplica; editar no Teqo atualiza o MESMO evento do Google — nunca nasce um segundo evento `teqo…`.
- Editar/cancelar no Google reflete na atividade (mesma regra de relógio do C115); excluir no Google cancela a atividade.
- Nada anterior a 16/08/2026 entra (sem backfill); evento estrangeiro nunca é apagado/alterado pelo Teqo; leader lockdown intocado; sem Consent novo; o Teqo segue inteiro se o Google cair.

## Dados (intenção)

- **Vou apresentar dados?** Não — superfície operacional (lista, agenda, overlay); sem leitura agregada nova.
- **Decisões desbloqueadas:** coordenação decide o município de um compromisso importado (triagem), o que muda quem o vê; nenhuma métrica.
- **Forma:** adiada ao plano de implementação.

## Dados da decisão (literais)

- Corte: início do evento (instante na América/Bahia) ≥ `2026-08-16`; reusar `CALENDAR_PHASE_ANCHORS.consolidationStart` (`src/lib/visitPlannerAnchors.ts:22-29`) — não duplicar o literal nem criar outro corte. Anterior fica fora para sempre.
- Horizonte de varredura: a mesma janela que o espelho já usa (90 dias para trás / 365 para a frente), com o piso do corte; evento fora da janela não é importado nem espelhado na v1.
- Importado nasce `status: confirmado`, título original do Google **sem** o prefixo `[Município] ` (com espaço final; o prefixo é só de evento `teqo…` espelhado).
- Atividade sem município é permitida; visível/editável só por `coordinator`/`candidate` (precedente `supporter`); com município, regras normais.
- Vínculo atividade↔evento Google é system-write (invisível aos user paths): garante idempotência e que editar no Teqo atualiza O MESMO evento.
- Google edita/cancela → atividade (relógio do C115); Google exclui → atividade cancelada.
- `location` do evento → `locality`; descrição ignorada na v1 (texto vive no Google).
- Recorrência: `singleEvents=true` expande; cada ocorrência vira atividade própria.
- Sem `Consent` novo (dado interno de staff); leader lockdown intocado; Teqo fonte da verdade; evento estrangeiro nunca apagado/alterado pelo Teqo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/Activity.ts` + `src/lib/schemas/activity.ts` (município opcional), `src/utilities/activityFormData.ts`, `src/utilities/access/activities.ts`, motor `src/utilities/googleCalendarSync.ts` (+ `googleCalendarEventMapping.ts`/`googleCalendarReverseEdit.ts`), `src/components/campaign/activity/ActivityOverlay.tsx`, ação em `src/app/(campaign)/campanha/actions/activity.ts`, omnibox `src/utilities/activityOmnibox.ts` + `ActivityFilters.tsx`.
- **Precedente a olhar:** `supporter` com município opcional (`src/utilities/access/supporters.ts:18-41,43-66`; mensagem própria em `src/lib/schemas/supporter.ts:18-19`) e o C115 (relógio/conflito).
- **Risco de acoplamento:** o vínculo com evento estrangeiro precisa nascer (hoje só o id `teqo…` codifica vínculo; não há `googleEventId` em Activity) — schema/migration é decisão do plano de implementação. Pontos que hoje assumem município: ação de rascunhos de demanda (`actions/activity.ts:293-294` dereferencia `.municipality.id`), `CampaignDemand.ts:242-279` ("Município da demanda inválido"), `activityRelationOptions.ts:21-28`; overlay exige município em `ActivityOverlay.tsx:195-205,375-389,459`. Dossiê/filtros por município não mostrarem sem-município é aceitável (a triagem é na lista).
- **Testes que pinam município obrigatório (mudam com o item):** `tests/int/campaignActivity.int.spec.ts:48-55,99-106`, `tests/unit/activityOverlay.unit.spec.tsx:245-258`, `tests/e2e/campaignActivity.e2e.spec.ts:88`.

## Dependências

- **Dura: C164** — mesmo motor Google e a imediatez Google→Teqo; sem ela o "sozinho" fica capenga.
- Suaves: C114 (espelho), C115 (bidirecional/relógio; este item reabre o corte de criação), C149/C150 (conta e calendário principal conectados).

## Fora de escopo

- Eventos anteriores a 16/08/2026: sem backfill retroativo.
- Descrição, convidados/RSVP, lembretes, Meet e demais metadados do Google não viram campo do Teqo na v1.
- Tela dedicada de triagem/fila de aprovação: a triagem é inline (lista + overlay).
- Importar de calendários secundários/inscritos além do principal conectado.
- Qualquer mudança no leader lockdown ou no feed iCal público.

## Rabbit holes de produto

- **Bidirecional total ("já que está lá, sincroniza convidados/descrição/cor").** Se alguém "só completar": a agenda vira espelho integral da API do Google. **Corte:** só vínculo + título/horário/local/cancelamento (relógio C115); descrição fica no Google.
- **Backfill do calendário histórico.** Se alguém "só completar": anos de eventos pessoais/institucionais viram atividade. **Corte:** só início ≥ 16/08/2026, daqui pra frente.
- **Fila de aprovação com tela nova.** Se alguém "só completar": segundo fluxo de triagem, notificações e estados. **Corte:** lista + filtro "Sem município" + overlay existente.
- **Apagar/alterar o evento estrangeiro para "limpar" o Teqo.** Se alguém "só completar": Teqo escrevendo em evento que não criou. **Corte:** exclusão/edição no Teqo nunca toca evento estrangeiro — no máximo cancela a atividade.

## Questões em aberto (produto)

- **Quem vê e edita atividade sem município?** **Opções:** A) só coordenação/candidato (precedente `supporter`) | B) + assessores (sem carteira para casar; precisaria de claim) | C) todo staff lê, só coordenação edita. **Recomendação: A.** _(assumido — validar)_
- **Descrição do evento: importar ou ignorar na v1?** **Opções:** A) ignorar (texto vive no Google) | B) guardar em campo livre/atualização | C) concatenar no `locality`. **Recomendação: A.** _(assumido — validar)_
- **Cancelar no Teqo remove o evento no Google?** **Opções:** A) sim, cancela o MESMO evento (consistente com "Teqo fonte da verdade") | B) só marca a atividade cancelada e deixa o evento | C) perguntar a cada cancelamento. **Recomendação: A.**
- **Eventos pessoais futuros do calendário da imprensa (aniversário, médico) viram atividade?** **Opções:** A) aceitar e triar (cancelar/descartar na lista) | B) exigir calendário dedicado da campanha | C) allowlist por palavra-chave. **Recomendação: A** — o corte de 16/08 limita o volume e um importado a mais custa pouco; B depende de mudança de hábito externa.
- **Evento importado que ganha município passa a levar `[Município] ` no título do Google?** **Opções:** A) não — mantém o título original (o vínculo system-write basta) | B) sim, vira o padrão dos `teqo…` (confunde quem criou no Google). **Recomendação: A.**

## Referências

- GitHub Issue [#1010](https://github.com/fsolla/teqo/issues/1010)
- Rascunho UI (gate): `docs/plans/c165-importar-eventos-google-ui-draft.html`
- `docs/plans/c115-google-calendar-edicao-bidirecional.md:21,65` (corte reaberto), C114, C149, C150
- `src/lib/visitPlannerAnchors.ts:22-29` (corte canônico), `src/utilities/googleCalendarSync.ts`, `src/utilities/access/supporters.ts`, `AGENTS-campaign.md` ("Campaign activities", "Campaign supporters", "Campaign Municípios model")
