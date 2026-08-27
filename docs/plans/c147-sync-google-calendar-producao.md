# Google Calendar: sync configurado em produção não funciona (diagnóstico + fix)

Status: rascunho
Atualizado em: 2026-08-27
Issue: #932
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem UI nova; a pill/dialog de estado já existem)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável — com a integração configurada no Google e no Teqo, criar/editar uma atividade reflete no calendário em minutos e o estado do sync é honesto (nunca silenciosamente quebrado)
Responsável: —

## Intenção

"Eu configurei a integração do Google Calendar para a agenda da campanha em produção, mas ela não funciona — não está sincronizando. Descubra por que e conserte." A integração foi entregue (motor de reconciliação bidirecional, pill de estado, webhook), mas na prática a agenda oficial da campanha e o Google Calendar não estão conversando — e nada na interface diz por que. O problema não é "falta feature": é uma integração existente que falha em silêncio. Este item existe para (1) diagnosticar a causa em produção, (2) consertá-la e (3) garantir que, daqui em diante, uma falha de sync nunca passe despercebido — o estado mostrado na agenda precisa ser honesto, inclusive quando o canal de push do Google expira sem ninguém perceber.

## Persona e fluxo

- **Persona / contexto:** o coordenador (ou o próprio deputado) que mantém `/campanha/agenda` como fonte da agenda oficial; já configurou a service account no Google Cloud e o calendário no Teqo, e confia que "configurado" significa "funcionando".
- **Job principal:** criar/editar uma atividade no Teqo e vê-la aparecer no calendário do Google em minutos — ou, se não aparecer, saber imediatamente o motivo na própria agenda.
- **Fluxo desejado:** configura a integração uma vez → usa a agenda normalmente → quando algo quebra (credencial revogada, canal de push expirado, calendarId errado), a pill de estado diz o que aconteceu em vez de fingir que está tudo bem → o coordenador (ou o runbook) resolve sem depender de sorte ou de uma passada de sync que ninguém disparou.
- **Anti-goals de produto:** não virar um projeto de OAuth de usuário (troca de modelo de credencial), não redesenhar os modais de estado, não reconstruir o motor de sync que já existe e funciona em dev.

## Objetivo e aceite

- Com a integração configurada no Google e no Teqo, criar ou editar uma atividade em `/campanha/atividades` reflete no calendário do Google em minutos.
- O estado do sync exibido na agenda (pill + dialog existentes) é honesto: se o sync está quebrado, ele diz que está quebrado e por quê — nunca "sincronizado" quando não está, nunca silêncio.
- Se o canal de push do Google expirar e nenhuma passada de sync rodar para renová-lo, existe um caminho de renovação que não depende de sorte (hipótese a validar no diagnóstico).
- Guardrails: o Teqo permanece a fonte da verdade — uma falha do Google nunca corrompe nem bloqueia os dados de atividade no Teqo; a integração continua opcional e fail-closed (sem credencial → agenda funciona normal, estado "não configurado"); o lockdown de liderança e o modelo de municípios ficam intocados.

## Dados (intenção)

- **Vou apresentar dados?** Não — este item não cria superfície de dados nova; usa o estado já registrado no doc de sync (lastError, lastErrorAt, pushChannelError) como insumo do diagnóstico.
- **Decisões desbloqueadas:** coordenador/operador decide, ao ler o estado honesto, se o problema é configuração no Google, env no servidor ou canal de push — sem precisar abrir o banco.
- **Forma:** adiada ao plano de implementação — aqui só a restrição: o estado precisa ser legível por um humano não-técnico na UI existente.

## Dados da decisão (literais)

- `GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY` — base64 do JSON da service account GCP (conforme `.env.example:61–67: "cat key.json | base64 -w0"`; a service account precisa de permissão "make changes to events" no calendário da campanha). Em produção, o valor vive em `~/stack/teqo-1313.env` no homeserver.
- Comportamento fail-closed já travado: env ausente/malformada → credencial `null` → status derivado `not-configured` → agenda do Teqo segue funcionando sem espelho no Google; nenhum erro além da pill.
- O `calendarId` é configurado por admin no doc único da collection de sync (campo admin-only); um valor errado aqui é causa plausível de "configurado mas não sincroniza".

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/googleCalendarSync.ts` (motor de reconciliação), `src/utilities/googleCalendarClient.ts` (JWT via `jose`, timeout 15s/hop), `src/utilities/googleCalendarSyncHooks.ts` (hooks afterChange/afterDelete de `activity`, budget de 5s — C114-LOCK), `src/app/(campaign)/campanha/agenda/google-webhook/[secret]/route.ts` (push), `src/components/campaign/agenda/AgendaGoogleSyncChrome.tsx` + `GoogleCalendarSyncDialog.tsx` (estado exibido), `src/collections/GoogleCalendarSync.ts` (doc único, `calendarId`).
- **Hipóteses de causa-raiz a testar, em ordem de barato→caro:** env ausente no container de produção (fail-closed engoliu o problema); service account sem compartilhamento no calendário ou credencial revogada; `calendarId` errado; canal de push expirado (30 dias) sem passada que o renove; webhook inalcançável atrás do túnel Cloudflare (`getCampaignInviteBaseURL`/`NEXT_PUBLIC_SITE_URL`).
- **Precedente a olhar:** docs/plans/c114-google-calendar-push-agenda-oficial.md (+ -impl), c115 (bidirecional), c114-lock (budget de hooks), c122; Issues #635/#636 (closed).
- **Risco de acoplamento:** o budget de 5s dos hooks (C114-LOCK) existe para o write path nunca esperar o Google — o guardrail "falha não é silenciosa" deve vir de telemetria/estado, não de deixar o hook lento; não reconstruir o motor, não trocar o modelo de credencial (C149 é outro item).

## Dependências

- Nenhuma dura. C114/C115 (entregues, closed) são pré-condição de código — já estão em `main`/produção.

## Fora de escopo

- C149 — troca do modelo de credencial para OAuth de usuário (outro item; aqui a service account permanece).
- C148 — layout/redesign dos modais de estado (aqui só se garante que o conteúdo do estado é honesto).
- Reconstrução do motor de reconciliação bidirecional; introdução de cron/queue como infra nova (só se o diagnóstico provar ser a causa-raiz mínima).

## Rabbit holes de produto

- **"Já que vou tocar no sync, implemento OAuth com conta de usuário do Google."** Se alguém "só completar": reescreve o modelo de credencial inteiro, atrasa o fix de um bug P1. **Corte neste item:** service account permanece; troca é C149.
- **"Aproveito e redesenho a pill/dialog do sync."** Se alguém "só completar": projeto de UI para mascarar um problema de backend. **Corte neste item:** estado honesto no conteúdo; forma é C148.
- **"Diagnóstico virou auditoria do motor inteiro + suíte de e2e de sync."** Se alguém "só completar": semana de engenharia para um outcome de 1–2 dias. **Corte neste item:** diagnóstico orientado pelo checklist (env → credencial → calendarId → estado do doc/pushChannelError → canal de push → webhook), fix da causa-raiz e o guardrail de não-silêncio.

## Questões em aberto (produto)

- **O fix pode incluir operação no homeserver (p. ex. env faltando em `~/stack/teqo-1313.env`, reinício de container)?** **Opções:** A) sim, e o que for configuração vira linha no runbook; B) só código, operação fica com humano. **Recomendação:** A — se a causa-raiz for configuração, registrar o passo no runbook `docs/ops/teqo-1313-deploy.md` para não depender de memória. _(assumido — validar com produto)_
- **Quer telemetria mínima no log do servidor quando o hook de sync aborta (hoje é `logger.debug`/estado no doc, invisível no write path)?** **Opções:** A) log de erro estruturado no abort; B) manter só estado no doc. **Recomendação:** A — a falha silenciosa foi exatamente o sintoma relatado; log com nível de erro no abort é a mudança mínima que fecha a classe do problema.
- **A renovação do canal de push precisa de gatilho garantido (a cada passada vira "renova só se algo disparar passada")?** **Opções:** A) renovação atrelada a um gatilho que comprovadamente roda (a auto-retry no load da agenda, se diagnosticada como suficiente); B) infra mínima de cron. **Recomendação:** A — cron/queue só se o diagnóstico provar que nenhum gatilho existente roda com frequência suficiente; decidir depois do diagnóstico, não antes.

## Referências

- GitHub Issue: #— (a registrar via `pnpm agent:register`)
- `src/utilities/googleCalendarSync.ts`, `src/utilities/googleCalendarClient.ts`, `src/utilities/googleCalendarSyncHooks.ts`
- `src/collections/GoogleCalendarSync.ts`, `src/collections/Activity.ts`
- `src/app/(campaign)/campanha/agenda/google-webhook/[secret]/route.ts`
- `src/components/campaign/agenda/AgendaGoogleSyncChrome.tsx`, `GoogleCalendarSyncDialog.tsx`
- `.env.example:61–67` — literal e contrato fail-closed do env
- docs/plans/c114-google-calendar-push-agenda-oficial.md (+ -impl), docs/plans/c115-google-calendar-edicao-bidirecional.md (+ -impl), docs/plans/c114-lock-hooks-do-sync-do-google-calendar-seguram-impl.md
- `docs/ops/teqo-1313-deploy.md` — runbook do homeserver (destino das conclusões de configuração)
- `AGENTS.md` — produção = homeserver (`teqo_1313`), env em `~/stack/teqo-1313.env`, sem Vercel
