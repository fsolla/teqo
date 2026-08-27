# C150 — Agenda: calendário principal escolhido pelo candidato/coordenador + inscrição de staff no Google

Status: rascunho
Atualizado em: 2026-08-27
Issue: #935
Priority: P2
Model: composer-2.5
Depends: #934 (C149)
Impeccable: B — encaixe na agenda
Rascunho UI: docs/plans/c150-calendario-principal-e-inscricao-staff-ui-draft.html
Appetite: ~1,5–2 dias eng; um outcome verificável — o candidato/coordenador escolhe o calendário principal da campanha na própria agenda (create/edit espelham nele) e um staff adiciona a agenda ao Google dele com um clique
Responsável: —

## Intenção

Dois pedidos fundidos sobre o espelho Google Calendar entregue por C114/C115. Hoje, escolher QUAL calendário Google espelha a agenda exige o admin do Payload — mas quem decide o calendário oficial da campanha é o candidato/coordenador. E inscrever a agenda no Google pessoal de cada staff ainda é manual: copiar o link e configurar "Por URL" à mão — o próprio pedido reconhece que o caminho certo é um botão que leva ao Google já preparado. Na agenda do Teqo: o núcleo escolhe o calendário principal entre os da conta Google conectada (C149) e o staff adiciona a agenda ao Google dele com um clique.

## Persona e fluxo

- **Persona / contexto:** candidato/coordenador na mesa decidindo a agenda oficial; assessores e comunicação em campo, vivendo no Google Calendar do celular; líder de campo nunca toca nisso.
- **Job principal:** "escolho qual calendário da nossa conta Google é a agenda oficial — e a agenda da campanha aparece no meu Google Calendar sem eu configurar nada à mão".
- **Fluxo desejado:**
  1. Na agenda (`/campanha/agenda`), o candidato/coordenador abre a configuração do Google e vê os calendários da conta conectada.
  2. Escolhe um como calendário principal e confirma; criar/editar atividades passam a espelhar nele.
  3. Um staff (coordenador/assessor/candidato) clica "Adicionar ao meu Google Calendar": o Google abre com o calendário oficial pré-configurado — sem copiar link nem "Por URL".
  4. Para recorte filtrado (município/tags), o caminho continua o feed ICS atual: copiar link + instrução — nada muda de comportamento.
- **Anti-goals de produto:** não escrever no calendário PESSOAL de cada staff (decisão C114); não criar N calendários espelhados — o calendário principal é UM; não refazer o feed ICS nem o motor de sync; sem import de eventos do Google além do que C115 já faz; leader lockdown intocado.

### Esboço de fluxo (B)

```text
[agenda /campanha/agenda] → "Calendário principal" (candidato/coordenador)
→ lista os calendários da conta Google conectada (C149) → escolhe → confirma
→ espelho re-concilia no calendário escolhido; create/edit espelham nele

[mesma agenda, staff] → "Adicionar ao meu Google Calendar" → um clique
→ Google abre com o calendário oficial pré-configurado → agenda no Google pessoal
```

### Rascunho UI (B)

- Rascunho UI (gate): `docs/plans/c150-calendario-principal-e-inscricao-staff-ui-draft.html`

## Objetivo e aceite

- Na própria agenda, o candidato/coordenador lista os calendários da conta Google conectada e escolhe o calendário principal — configurar o espelho deixa de exigir o admin do Payload.
- Criar/editar atividades espelham no calendário escolhido — o motor C114/C115 não muda de modelo; trocar o calendário re-concilia o espelho sem eventos órfãos/duplicados visíveis ao staff.
- Um staff adiciona a agenda ao Google pessoal com um clique — sem copiar link nem configurar "Por URL" à mão; o recorte filtrado segue no fluxo atual do feed ICS (link + instrução).
- Guardrails: leader não vê nem usa nenhuma das duas ações; Teqo continua SoT; o calendário principal é UM; falha do Google não derruba a agenda do Teqo (estado do sync continua visível); o admin do Payload continua como escape hatch da configuração.

## Dados (intenção)

- **Vou apresentar dados?** Não — o espelho é saída (mesma posição do C114); nenhuma leitura nova no Teqo.
- **Decisões desbloqueadas:** candidato/coordenador escolhe o calendário principal da campanha (ator + escolha, hoje exclusiva do admin do Payload); staff opta por inscrever a agenda no Google pessoal dele (ator + escolha, hoje manual).
- **Forma:** _adiada ao plano de implementação_ — a apresentação do evento no Google já é decisão do C114.

## Dados da decisão (literais)

- Padrão do link one-click do calendário oficial: `https://calendar.google.com/calendar/r?cid=<calendarId URL-encoded>` — confiável para calendar IDs de calendários Google reais (caso do calendário oficial da campanha). O builder atual compõe o `cid` com a URL webcal pública do calendário — reconciliar com este literal na implementação.
- Para o recorte ICS, quando um one-click for tentado: `cid` com `webcal://<url-do-feed>` — INFIEL/instável para feeds ICS externos ("Unable to add calendar", eventos não populam); fallback obrigatório = copiar link + instrução "Do URL" (fluxo atual). Assumido v1: NÃO tentar — só link + instrução.
- Rótulos de placeholder do rascunho UI: "Calendário da campanha" (oficial) e "Meu calendário" (pessoal genérico da conta conectada).

## Direção no codebase (hipótese)

- **Áreas prováveis:** chrome da agenda em `src/components/campaign/activity/` (`AgendaGoogleSyncChrome.tsx`, `GoogleCalendarSyncDialog.tsx`, `CalendarFeedDialog.tsx`), ações em `src/app/(campaign)/campanha/actions/googleCalendarSync.ts`, papel em `src/utilities/access/googleCalendarSync.ts` (hoje `canSetGoogleCalendarSyncConfigField = isPayloadAdmin` — é isso que o produto quer abrir ao candidato/coordenador), links em `src/lib/googleCalendarLink.ts`.
- **Precedente a olhar:** plans C114/C115 (espelho e bidirecional — motor não muda de modelo), C16/C113 (feed ICS); trocar `calendarId` já dispara re-conciliação automática (config hook D7; snapshot pino por calendarId; canal push re-criado por calendário) — o delta é a troca de dono da escolha, não a mecânica.
- **Risco de acoplamento:** abrir a escolha a candidato/coordenador muda uma permissão de configuração hoje admin-only (a intenção do produto é exatamente essa); leader lockdown intocado; o admin do Payload permanece funcionando.

## Dependências

- **Dura:** C149 — o seletor nasce da conexão OAuth (listar os calendários da conta conectada).
- Suaves: C114/C115 (motor do espelho, em produção), C16/C92/C98/C113 (feed ICS e link de import).

## Fora de escopo

- Escrever no calendário pessoal de cada staff via OAuth individual → anti-goal reafirmado da decisão C114.
- N calendários espelhados (um por filtro/papel) → recorte continua no feed ICS (C16/C113).
- Refazer o feed ICS, o motor de sync ou o import bidirecional do C115.
- One-click universal para feeds ICS externos → infiável (pesquisa); o recorte mantém link + instrução.
- Escolher calendário principal por assessor → decisão de núcleo; assessor só inscreve.

## Rabbit holes de produto

- **"Um calendário principal por filtro/papel."** Se alguém "só completar": N espelhos divergentes e permissões por calendário. **Corte neste item:** um calendário principal, escolhido pelo núcleo; recorte continua no feed ICS.
- **"One-click para todo tipo de agenda (incl. ICS)."** Se alguém "só completar": botão que falha com "Unable to add calendar" e gera suporte. **Corte:** one-click só para o calendário oficial (Google real); recorte mantém copiar link + instrução.
- **"Sincronizar todo o histórico ao trocar de calendário."** **Corte:** o motor atual governa a janela; a troca re-usa a re-conciliação existente, sem backfill novo.

## Questões em aberto (produto)

- **O botão one-click do recorte filtrado (ICS) vale em v1?** **Opções:** A) sim, como tentativa com fallback claro | B) não — só o calendário oficial em v1, recorte segue link+instrução. **Recomendação:** B — o padrão cid é infiel para ICS e a falha custa confiança. _(assumido — validar no gate)_
- **A escolha do calendário principal substitui completamente a config no admin do Payload?** **Opções:** A) substitui na UI da agenda; admin fica como escape hatch | B) mantém as duas como superfícies de primeira classe. **Recomendação:** A — uma só casa para a decisão; admin permanece para operação/contingência. _(assumido — validar)_
- **Assessor pode escolher o calendário principal?** **Opções:** A) só candidato/coordenador | B) também assessor. **Recomendação:** A — decisão de núcleo sobre a agenda oficial; assessor apenas inscreve a agenda no Google dele.

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c150-calendario-principal-e-inscricao-staff-ui-draft.html`
- Plans C114 (`c114-google-calendar-push-agenda-oficial.md`), C115 (`c115-google-calendar-edicao-bidirecional.md`), C16 (`sync-teqo-google-calendar.md`), C113 (`c113-feed-ical-agenda-nao-atualiza.md`)
- Arquivos para abrir primeiro: `src/lib/googleCalendarLink.ts`, `src/components/campaign/activity/AgendaGoogleSyncChrome.tsx`, `src/components/campaign/activity/GoogleCalendarSyncDialog.tsx`, `src/components/campaign/activity/CalendarFeedDialog.tsx`, `src/utilities/access/googleCalendarSync.ts`, `src/collections/GoogleCalendarSync.ts`, `src/utilities/activityUi.ts`
- `AGENTS-campaign.md` — convenção de papéis/lockdown tocada pelo item
