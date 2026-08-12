# Impl: C115 — Google Calendar: edição pela agenda pessoal volta para Teqo (bidirecional)

Status: aprovado
Atualizado em: 2026-08-11
Issue: #636
Intenção: docs/plans/c115-google-calendar-edicao-bidirecional.md
Appetite restante: ~2–2,5 dias eng (herdado; corte explícito: criação no Google fora de v1; apenas título/horário/cancelamento voltam)

## Leitura da intenção

- **Outcome:** candidato (e autorizados) edita/remarca/cancela um compromisso da Agenda da Campanha no Google Calendar e a mudança volta para o Teqo — a atividade é atualizada, o registro fica auditável e o espelho propaga para quem segue (mecanismo do C114).
- **O que NÃO negociar:** sem criação de eventos pelo Google em v1; conflito = regra automática (mais recente vence) com registro, nunca tela; acessos do Teqo valem para o que vem do Google (leader lockdown intocado); Teqo permanece SoT do domínio — o Google é superfície de edição (horário/título/cancelamento) e o Teqo reescreve o evento a partir do próprio estado; Teqo funciona sem Google.
- **O que reavaliar:** a intenção aponta "webhook do Google + sync incremental" — confirmado, com duas correções de engenharia: (1) a notificação do Google NÃO diz qual evento mudou ("bare ping", doc oficial) — o "sync incremental" da intenção vira uma passada completa de reconciliação (o motor C114 já lista a janela inteira; não há custo marginal relevante); (2) o canal de push exige renovação periódica e **não há cron no Hobby** — renovação lazy em cada trigger do motor (aceite "se renova sozinho" = sem ação manual, com a limitação de silêncio de 30 dias documentada). A intenção assume "edição mais recente vence" — o forward do C114 hoje sobrescreve QUALQUER diferença de conteúdo; o motor precisa virar bidirecional com regra de relógio, senão o forward clobbera a edição do Google (contradição com o aceite).

## Abordagem recomendada

```mermaid
flowchart LR
  G[Google Calendar<br/>usuário edita/remarca/cancela] -->|notificação push| W[webhook público<br/>campanha/agenda/google-webhook/[secret]]
  W -->|valida X-Goog-* + token<br/>200 imediato| R[passada bidirecional<br/>googleCalendarSync.ts]
  A[trigger local:<br/>hook activity / view agenda /<br/>Sincronizar agora] --> R
  R --> D[diff por id determinístico + relógio:<br/>Google mais novo → aplica no Teqo<br/>Teqo mais novo → re-asserta no Google<br/>status cancelled → cancela atividade]
  D --> T[(atividade atualizada<br/>+ registro no updates feed)]
  D --> C[ensurePushChannel<br/>watch/renova/stop — best-effort]
  C --> S[(estado do canal<br/>googleCalendarSync)]
```

**Opções consideradas:** D1–D8 abaixo.
**Recomendação:** um **motor único bidirecional** (regra de relógio decide a direção por evento), **webhook público com validação fail-closed** (URL secret + `X-Goog-Channel-ID` + `X-Goog-Resource-ID` + `X-Goog-Channel-Token`, comparação constant-time), **canal de push lazy** (ensure em toda passada; TTL 30 dias; renovação = watch com UUID novo + `channels.stop` do antigo), **cancelamento detectado por `showDeleted=true`** (status `cancelled` = usuário cancelou → cancela a atividade) **+ snapshot `lastSeenEventIds`** (remoção permanente ≠ nunca criado), **registro no `updates` feed** da atividade com prefixo "Google Calendar:" (sem schema novo de updates).

### Decisões de engenharia

**D1 — Detecção Google → Teqo.**
Opções: A) **push channel** (`events.watch`, webhook `web_hook`) + passada completa ao receber | B) polling com cron | C) `syncToken` incremental.
Recomendação: **A** — latência de segundos (aceite "minutos"), sem cron no Hobby; a notificação é um ping sem payload ("nothing about the change itself", doc oficial), então o handler roda a mesma passada completa do motor — que já lista a janela inteira (D3 C114), sem custo marginal real (centenas de eventos).
Rejeitadas: B (sem cron no Hobby; cadência de horas não entrega o aceite); C (syncToken expira em ~30d, adiciona estado e não economiza nada — a passada já é full-list; o ping → passada completa é o fluxo documentado do Google).

**D2 — Um motor bidirecional (não dois caminhos).**
Opções: A) **regra de relógio dentro do `runSyncPass` atual**: para cada evento nosso, conteúdo difere? → quem é mais novo aplica (Google → update na atividade; Teqo → update no evento) | B) passada reversa separada rodando antes do forward | C) só forward + reverter edições do Google no próximo ciclo.
Recomendação: **A** — um único caminho de código (uma superfície de teste), e é o único jeito de a regra "mais recente vence" valer em TODOS os triggers: sem A, o forward (disparado por qualquer escrita no Teqo) sobrescreveria a edição do Google antes de ela ser aplicada. "Edit the owner": o dono da reconciliação é o motor C114 — estende, não cria irmão.
Rejeitadas: B (duas passadas = chamadas duplicadas + orquestração; a decisão de direção É o relógio, um único diff resolve); C (viola o aceite — a edição do Google seria revertida na passada seguinte).

**D3 — Regra de conflito (relógio).**
Opções: A) **vence o mais novo**: `remote.updated > activity.updatedAt + tolerância (2s)` → aplica edição do Google; senão Teqo re-asserta (forward) | B) Teqo sempre vence | C) pausa o evento.
Recomendação: **A** — decisão travada da intenção; content-compare roda ANTES do relógio (passadas convergem sem tocar em nada, D3 C114); a tolerância de 2s absorve skew NTP entre Google e o banco (ambos NTP); quando NOSSA escrita gera notificação, conteúdo é igual → no-op (sem loop). O relógio só decide quando há diferença real de conteúdo.
Rejeitadas: B (trai o sentido de "editar pelo Google"); C (vira a tela de conflito cortada na intenção).

**D4 — Cancelamento pelo Google.**
Opções: A) **`showDeleted=true` no list + snapshot `lastSeenEventIds`**: evento `status: 'cancelled'` (lixeira do Google) com atividade `confirmado` → cancela a atividade; evento sumiu por completo com id no snapshot da passada anterior → usuário removeu permanentemente → cancela; id fora do snapshot → nunca criado (calendário novo) → cria | B) todo "sumiu" = cancelar | C) todo "sumiu" = recriar.
Recomendação: **A** — a lixeira é o sinal direto de cancelamento (o UI padrão do Google trashes, não remove); a remoção permanente só se distingue de "nunca criado" com o snapshot (a passada anterior viu o id). Snapshot = JSONB `lastSeenEventIds` na collection de sync (estado transitório de reconciliação, NÃO duplicação do mapeamento — o id determinístico D2/C114 continua sendo a identidade). Só grava em passada BEM-SUCEDIDA: um create que falhou não entra no snapshot → próxima passada cria (não cancela). Cancelação só quando `activity.status === 'confirmado'` (compromissos vivos): `realizado` é histórico protegido (no-op; o evento trashed fica invisível na lixeira do usuário). Após cancelar, o forward da passada seguinte apaga o trashed permanentemente (convergência; o C114 já exclui eventos de atividades não vivas).
Rejeitadas: B (quebraria a primeira sincronização: calendário novo → todas as atividades seriam canceladas); C (ressuscita remoção deliberada do usuário e é a semântica atual do C114 que o C115 precisa substituir).

**D5 — Canal de push: criação e renovação lazy (sem cron).**
Opções: A) **ensure na passada do motor**: sem canal → `events.watch` (UUID novo, `token` = segredo da URL, TTL 30 dias via `params.ttl`); expira em <48h → watch com **UUID novo** (doc oficial: "you must use a unique value for the id property of the new channel") + `channels.stop` do antigo; falha → `pushChannelError` (state), **nunca** `paused` | B) cron de renovação | C) renovar com o mesmo id.
Recomendação: **A** — todo trigger existente do C114 (hook de activity, view da agenda, "Sincronizar agora", config-change) vira também renovador; TTL máximo (~30d, limite interno do Google) minimiza renovações; a falha do canal NUNCA pausa o sync (o reverso continua funcionando pelos triggers locais — toda passada é bidirecional, o canal só dá imediatismo). Address = `getCampaignInviteBaseURL()` + `/campanha/agenda/google-webhook/<secret>` — **C98 lesson**: `NEXT_PUBLIC_SITE_URL` obrigatória em prod (sem ela, ensure falha com `pushChannelError` legível, não quebra nada).
Rejeitadas: B (sem cron no Hobby); C (doc oficial exige id único por canal; re-watch com mesmo id tem comportamento indefinido).
Limitação documentada no runbook: com 30 dias de silêncio total (nenhuma escrita no Teqo, nenhuma view, nenhuma notificação) o canal expira e o reverso passa a depender do próximo trigger local — dentro do "renova sozinho" (nunca ação manual), com a lacuna de silêncio declarada.

**D6 — Webhook público (superfície nova, fail-closed).**
Opções: A) **rota `POST /campanha/agenda/google-webhook/[secret]/route.ts` fora de `(app)`** (precedente `agenda/ical/[secret]`): segredo na URL (≥32 chars) + `X-Goog-Channel-ID` == `pushChannelId` + `X-Goog-Resource-ID` == `pushChannelResourceId` + `X-Goog-Channel-Token` == token — todas comparações constant-time; falha → 404 (precedente iCal: não revela existência) | B) assinatura de corpo | C) rodar a passada em background pós-response.
Recomendação: **A** — 200 imediato após validação; passada inline (`export const maxDuration = 60` — Hobby permite até 60s; uma passada típica é 1 list + N updates, segundos); erros da passada NÃO viram não-200 (o Google re-tentaria e replicaria trabalho; o auto-retry local já cobre); `X-Goog-Resource-State: sync` (notificação de criação de canal) → ignora (passada já roda nos triggers). `not_exists` (recurso apagado) → estado de erro no sync ("calendário não existe mais").
Rejeitadas: B (o corpo do push do Calendar é vazio por contrato — a autenticidade É o token + ids, que o Google documenta para isso); C (serverless congela após o response; trabalho perdido + Google re-tenta — pior que inline).

**D7 — Estado do canal e snapshot (collection `googleCalendarSync` + migration).**
Opções: A) **campos novos na collection existente** (system-write via `canSetGoogleCalendarSyncSystemField`): `pushChannelId`, `pushChannelResourceId`, `pushChannelExpiresAt`, `pushChannelSecret`, `pushChannelError` + `lastSeenEventIds` (json) | B) collection separada de canais | C) tudo em env.
Recomendação: **A** — "edit the owner": a collection É o recurso de sync (C114 D5); estado do canal vive junto do estado do sync; `pushChannelSecret` segue o precedente `calendarFeed.secretSlug` (credencial de link em DB, não em env — env exigiria redeploy para rotacionar); o config hook (`shouldSyncConfigChange`) só olha `calendarId`/`disabledAt` → escritas de estado nunca re-disparam (guard existente, sem loop). `calendarId` trocado → canal antigo é stopado na ensure seguinte e o snapshot é re-derivado por passada (o novo calendário lista vazio → cria tudo de novo — D7 C114 preservado).
Rejeitadas: B (mais uma collection/access para um estado de 5 campos); C (calendarId/channel rotacionariam por redeploy).

**D8 — Registro da edição ("com registro").**
Opções: A) **entrada no `updates` feed da atividade** com body prefixado `Google Calendar: …` e `author: null`; o card mostra "Google Calendar" como autor quando o body tem o prefixo (fallback do `ActivityUpdateFeed`, mudança contida) | B) log no `googleCalendarSync` | C) notification do Teqo.
Recomendação: **A** — o registro é visível no contexto da atividade (a equipe vê "remarcada de X para Y pelo Google Calendar" na aba Atualizações), sem schema novo (o array `updates` e a derivação do `deriveActivityFields` já existem; `author: null` passa pelo passthrough); a notificação Teqo fica de fora (o aceite manda "mesmo mecanismo do C114" = aviso do próprio Google aos seguidores).
Rejeitadas: B (invisível para a equipe no contexto do compromisso); C (novo tipo de notification para um caso que o feed já conta).

**D9 — Campos reversos editáveis (v1).**
Opções: A) **título + horário**: `summary` → `title` (strip de `[<nome do município>] ` apenas quando o prefixo bate com o município da atividade — desfazemos só a nossa própria prefixação; resto vira título inteiro); `start`/`end` do evento → `startAt`/`endAt`/`allDay` (presença de `date` vs `dateTime` decide all-day; converte com `activityAllDay`); somente atividades `status: 'confirmado'` | B) incluir location/description | C) permitir em qualquer status.
Recomendação: **A** — o aceite lista data/hora/título/cancelamento; locality/description/location/tags são campos do Teqo (a regra estrutural da intenção: Google é espelho para o resto — o forward re-asserta). `confirmado`-only protege `realizado` (histórico) e `cancelado` (Teqo SoT). A validação local (`validateActivitySchedule`) roda na aplicação: valor remoto malformado → o update falha → o Teqo mantém o estado e o forward re-asserta (fail-safe embutido).
Rejeitadas: B (descrição é rica em campos do Teqo; parse de volta = fragile e fora do aceite); C (editar realizado via Google corrompe histórico; cancelado no Teqo já é gerenciado).

### Componentes / mudanças

- **`src/lib/googleCalendarReverseEdit.ts`** (novo, puro, unit-testável): `googleTitleFromSummary(summary, municipalityName)` (strip condicional do prefixo), `googleScheduleToActivityFields(event)` → `{ startAt, endAt, allDay }` ou `null` (malformado), `buildGoogleReverseUpdateBody(kind, antes→depois)` (pt-BR, prefixo `Google Calendar: `), `GOOGLE_REVERSE_EDIT_BODY_PREFIX` (compartilhado com o feed UI), `googleEditIsNewer(remoteUpdated, activityUpdatedAt, toleranceMs)` (regra do relógio pura).
- **`src/lib/googleCalendarEventMapping.ts`** (editar): `GoogleRemoteEvent` ganha `status?: string` e `updated?: string` (o list passa a devolver lixeira).
- **`src/utilities/googleCalendarClient.ts`** (editar): `listEvents` passa `showDeleted: true` (sem mudança de assinatura — o stub não é afetado); novos métodos `watchEvents(calendarId, { id, address, token, ttlSeconds })` → `{ id, resourceId, expiration }` e `stopChannel(id, resourceId)` (`POST /channels/stop`); `GoogleCalendarClient` (e stub de teste) crescem junto.
- **`src/utilities/googleCalendarSync.ts`** (editar — dono do motor): `runSyncPass` vira **bidirecional** (D2/D3/D4): por evento nosso — `status cancelled` → cancela atividade (`confirmado`); conteúdo difere → relógio decide (reverse via `payload.update` com `updates` + body prefixado, `overrideAccess: true` — sem usuário, precedente dos hooks; ou forward `updateEvent`); conteúdo igual → no-op; atividade querida sem evento → snapshot decide (cria vs cancela); snapshot `lastSeenEventIds` gravado no fim de cada passada bem-sucedida; `ensureGoogleCalendarPushChannel(payload, config, client)` (D5) chamado no início (best-effort; falha → `pushChannelError`, nunca `paused`); estados `not_exists` → `lastError` explicativo. `deriveGoogleCalendarSyncStatus` ganha a leitura do canal só para a UI (não muda a matriz — canal nunca pausa).
- **`src/collections/GoogleCalendarSync.ts`** (editar): campos novos D7 (system-write, `admin.readOnly`); `pushChannelExpiresAt` aparece nos defaultColumns.
- **Migration:** `migrate:create add_google_calendar_push_channel` (6 colunas: 4 text + 1 date + 1 json).
- **Rota pública** `src/app/(campaign)/campanha/agenda/google-webhook/[secret]/route.ts` (novo): `POST` (e `GET` → 404) fora de `(app)`, precedente `agenda/ical/[secret]`; validação D6; `export const dynamic = 'force-dynamic'`, `maxDuration = 60`; responde 200 e roda a passada; `not_exists` → estado de erro.
- **`src/components/campaign/activity/ActivityUpdateFeed.tsx`** (editar): fallback de autor — body com prefixo → "Google Calendar"; senão mantém "Autor removido".
- **`src/components/campaign/activity/GoogleCalendarSyncDialog.tsx`** (editar, Impeccable B — shape→craft→critique→polish): quando `synced`, seção "Edições pelo Google" com copy (candidato/autores editam no Google e volta para o Teqo) + estado do canal (ativa até <data> quando o canal existe; mensagem de `pushChannelError` quando presente). Nada novo de ação — o toggle/retry existentes cobrem.
- **Server actions** (sem mudança): `runGoogleCalendarSyncNow` e a view da agenda já chamam o motor — agora bidirecional, o mesmo caminho traz o reverso.
- **`docs/CHANGELOG-AGENTS.md`** (editar): UMA entrada curta C115.
- **Access / Consent:** sem chave de Consent (dados internos da campanha, precedente C114); sem PII nova; o webhook é fail-closed (nunca processa sem canal/token válidos); a escrita reversa respeita os guards de hook do Activity (o guard de leader não se aplica — sem `req.user`); `overrideAccess` apenas onde o C114 já usa (engine), nunca em paths de usuário.

### Dados → forma (se aplicável)

N/A — não há apresentação de dados nova no Teqo; o único dado novo visível é o registro no `updates` feed (forma já existente) e o estado do canal no dialog (linha de texto derivada, sem forma nova).

## Fases verificáveis

1. **Tracer / schema+server** (dia 1): migration + collection fields + `generate:types`; client (`showDeleted`, `watchEvents`, `stopChannel`, `status`/`updated` no tipo); `googleCalendarReverseEdit` + unit tests; motor bidirecional + ensure de canal + int tests com stub (edição do Google mais nova → aplica; Teqo mais nova → re-asserta; `cancelled` → cancela; remoção permanente via snapshot → cancela; calendário novo → cria tudo; create falhou → cria na próxima, não cancela; canal: cria/renova/stop/falha não pausa; loop de re-entrada: passada após reverse é no-op); rota webhook + validação (unit: headers falsos → 404; token errado → 404); `migrate` local + `migrate:status`.
2. **UI** (dia 1–2): dialog (seção reverso + estado do canal), fallback do feed; e2e: webhook com segredo inválido → 404 (determinístico, sem Google), dialog mostra a seção quando sincronizado; Impeccable shape→craft.
3. **Gates** (dia 2): `pnpm gate:fast`; `pnpm format:check`; `pnpm exec knip`; `pnpm check:cycles`; `pnpm test` (unit+int); `pnpm test:e2e`; `pnpm build`; Aikido nos arquivos novos; `pnpm push` com CI green.

## Rabbit holes / Não escopo (engenharia)

- **Verificação de domínio do callback no Google Cloud** — se o Google exigir (alguns serviços pedem domínio verificado no console), é ops one-time (pt.jorgesolla.com.br); não bloqueia o código (falha → `pushChannelError` legível).
- **`syncToken` incremental** — D1; a passada full-list já cobre.
- **Participantes/attendees** — corte herdado do C114 (P1).
- **Criação pelo Google** — anti-goal da intenção (sem município não entra).
- **Recorrências/todos-os-dias complexos** — mapa de campos do espelho (C114), fora do aceite.
- **Notificação Teqo (sino) para edições reversas** — o feed é o registro; aviso aos seguidores é do Google.
- **Editar locality/description/location pelo Google** — D9; o forward re-asserta.
- **Lock distribuído da passada** — corridas convergem por conteúdo (herdado D3 C114); canal duplicado em renovação = notificações duplicadas, idempotentes.

## Riscos e mitigação

- **Semântica do push/`showDeleted` desconhecida na prática** — verificar no doc oficial durante o impl (source-driven-development); os int tests com stub travam NOSSO contrato, não o do Google.
- **Loop de re-entrada** (reverse aplica → hook roda passada) — conteúdo igual após aplicar → no-op; termina na segunda passada; verificado em int test.
- **Skew de relógio** Google × banco — tolerância 2s (D3); ambos NTP.
- **Canal morto sem trigger (30d de silêncio)** — limitação documentada no runbook; todo trigger local renova; a falha fica visível no dialog (`pushChannelError`/expiração).
- **maxDuration no webhook** — passada típica em segundos; `maxDuration = 60`; em pico o Google re-tenta (não-200) e o auto-retry local cobre.
- **Valores remotos malformados** — `validateActivitySchedule` rejeita → Teqo mantém estado e re-asserta (fail-safe).
- **Ressurreição por restore do Google** — usuário restaura evento cancelado → atividade já cancelada no Teqo → forward apaga de novo (Teqo SoT, documentado).
- **E2E com Google real** — webhook e2e só cobre fail-closed sem canal (404); motor testado em int com stub (precedente C114).

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: edição de título/horário e cancelamento feitos no Google refletem na atividade do Teqo (com registro no feed) e o espelho propaga; criação não existe em v1; conflito = relógio, sem tela; leader lockdown intocado (sem superfície e sem escrita reversa para líder — `confirmado`-only, engine sem usuário); Teqo funciona sem Google (canal é best-effort; falha → estado, nunca quebra escrita).
- [ ] Regra de conflito documentada e testada: mais recente vence com tolerância; Teqo re-asserta campos estruturais; cancelamento só para `confirmado`.
- [ ] Webhook fail-closed: rota pública valida secret + channel id + resource id + token em tempo constante; sem canal configurado → 404; nunca processa corpo não validado.
- [ ] Invariantes AGENTS/engineering-standards: identificadores em inglês, copy pt-BR; escrita multi-coleção onde houver usa transação (aqui a escrita reversa é 1 doc — sem transação necessária, sem `req.transactionID`); sem PII nova no Google; segredo de URL em DB segue precedente `calendarFeed`; migration commitada; sem migration retroativa.
- [ ] Testes de domínio previstos: unit (reverse edit mapping, relógio, prefixo do summary, validação do webhook), int (motor bidirecional com stub: todas as direções de D3/D4/D5 + re-entrada + snapshot), e2e (webhook 404 fail-closed, dialog).
- [ ] Self-score decision-quality: 5/5 (decisões caras com rejeitadas; cabe no appetite; rabbit holes nomeados; depth check reusa motor C114, client, collection, ical route, `activityAllDay`, shells do dialog; intenção preservada).

## Decisões em aberto (produto — para o gate humano)

- Nenhuma nova: as questões abertas da intenção (B: candidato + coordenador editam; A: mais recente vence; A: estrutural não propaga) foram assumidas na própria intenção. Confirmação do gate = impl segue com elas.

## Referências

- Intenção: `docs/plans/c115-google-calendar-edicao-bidirecional.md` (gate de produto)
- Base obrigatória: impl C114 `docs/plans/c114-google-calendar-push-agenda-oficial-impl.md` (D1–D7 herdados) + código em `src/utilities/googleCalendarSync.ts` (494 linhas), `googleCalendarClient.ts`, `googleCalendarSyncHooks.ts`, `src/collections/GoogleCalendarSync.ts`
- Precedentes: `src/app/(campaign)/campanha/agenda/ical/[secret]/route.ts` (rota pública com segredo), `src/lib/activityAllDay.ts` (conversões all-day), `src/utilities/campaignInviteOrigin.ts` (`getCampaignInviteBaseURL` — C98), `src/collections/Activity.ts` (guards + updates), `ActivityUpdateFeed.tsx`/`GoogleCalendarSyncDialog.tsx`
- Docs oficiais consultados: [Events: watch](https://developers.google.com/workspace/calendar/api/v3/reference/events/watch), [Push notifications](https://developers.google.com/workspace/calendar/api/guides/push) (headers, token, renovação com id único, TTL default 604800s)
- Testes existentes: `tests/int/googleCalendarSync.int.spec.ts`, `tests/unit/googleCalendarSync*.spec.ts`, `tests/e2e/campaignAgendaGoogleSync.e2e.spec.ts`
