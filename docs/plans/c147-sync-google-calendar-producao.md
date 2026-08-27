# Google Calendar: sync configurado em produção não funciona (diagnóstico + fix)

Status: rascunho
Atualizado em: 2026-08-27
Issue: #932
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem UI nova; a pill/dialog de estado já existem)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável — com a integração configurada no Google e no Teqo, criar/editar uma atividade reflete no calendário em minutos e o estado do sync é honesto (nunca silenciosamente quebrado)

## Intenção

"Eu configurei a integração do Google Calendar para a agenda da campanha em produção, mas ela não funciona — não está sincronizando. Descubra por que e conserte."

## Objetivo e aceite

- Com a integração configurada no Google e no Teqo, criar ou editar uma atividade em /campanha/atividades reflete no calendário do Google em minutos.
- O estado do sync exibido na agenda (pill + dialog existentes) é honesto: se o sync está quebrado, ele diz que está quebrado e por quê — nunca "sincronizado" quando não está, nunca silêncio.
- Se o canal de push do Google expirar e nenhuma passada de sync rodar para renová-lo, existe um caminho de renovação que não depende de sorte.
- Guardrails: o Teqo permanece a fonte da verdade — uma falha do Google nunca corrompe nem bloqueia os dados de atividade no Teqo; a integração continua opcional e fail-closed.

## Direção no codebase (hipótese)

- Áreas prováveis: src/utilities/googleCalendarSync.ts, src/utilities/googleCalendarClient.ts, src/utilities/googleCalendarSyncHooks.ts, src/app/(campaign)/campanha/agenda/google-webhook/[secret]/route.ts, src/components/campaign/agenda/AgendaGoogleSyncChrome.tsx + GoogleCalendarSyncDialog.tsx, src/collections/GoogleCalendarSync.ts.
- Hipóteses de causa-raiz a testar: env ausente no container de produção; service account sem compartilhamento no calendário ou credencial revogada; calendarId errado; canal de push expirado (30 dias) sem passada que o renove; webhook inalcançável atrás do túnel Cloudflare.
