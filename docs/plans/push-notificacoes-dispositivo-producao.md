# D6 — Push no dispositivo funcionando de ponta a ponta (notificações nativas em produção)

Status: registrado
Atualizado em: 2026-08-09
Issue: #521
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: A — N/A sem superfície UI nova (a tela de opt-in já existe; entrega é verificação/config)
Canvas UI: N/A — sem UI
Appetite: ~1 dia eng + passos humanos (envs de produção / consentimento) — verificação ponta a ponta com device real
Responsável: —

## Intenção

D2 entregou push + sino em código, mas na prática o device do usuário não recebe notificação: só o mecanismo interno ao app (sino) funciona. Eventos da campanha devem disparar também o banner nativo do sistema (a notificação padrão do device), inclusive com o app fechado.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor que ativou (ou quer ativar) avisos push no perfil; liderança em campo.
- **Job principal:** ser avisado no device quando algo importante acontece na campanha, sem precisar abrir o app.
- **Fluxo desejado:** ativa "Avisos push" em `/campanha/perfil` (consentimento LGPD) → evento da campanha (novo update de município, novo apoiador, atividade que precisa de atenção, convite aceito) → banner nativo no device → toque abre a tela do evento dentro do `/campanha`.
- **Anti-goals de produto:** não reescrever a mecânica de push existente; não criar canal novo (WhatsApp continua fora — D3–D5 `wontfix`); push continua exclusivo da vertical `/campanha` (decisão travada do D2).

## Objetivo e aceite

- Com as VAPID keys configuradas em produção e o consentimento `campanha-notificacoes-push` publicado no admin, um dispositivo real optado recebe o banner nativo para cada tipo de evento que hoje gera notificação in-app — e o toque no banner abre a tela correta do evento.
- O diagnóstico da cadeia fecha com evidência para cada elo: envs de produção (VAPID + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`), consentimento publicado no admin, inscrição push registrada por device, entrega confirmada pela plataforma de push, banner exibido no OS. Bloqueio encontrado → corrigido ou escalado com dono nomeado (env → Vercel; consentimento → assessoria jurídica via lote Onda 0).
- Limitação documentada no produto: iOS só recebe push com o PWA instalado na tela inicial (a UI do perfil já comunica) — não é defeito a corrigir aqui.

## Dados (intenção)

Dados: N/A — verificação de entrega ponta a ponta; nenhuma métrica nova de produto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** cadeia já implementada em `src/utilities/notification/` (`createCampaignNotification.ts`, `sendCampaignPush.ts` — web-push/VAPID, `notificationEvents.ts` — eventos que geram notificação); service worker em `src/utilities/campaignPwa.ts` (handlers push + notificationclick); opt-in em `src/components/campaign/auth/CampaignPushNotificationsCard.tsx` (`/campanha/perfil`); chave de consentimento em `src/lib/campaignConsentKeys.ts`.
- **Config de produção:** Vercel envs `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (documentadas no `.env.example`); consentimento criado por admin (texto já existe no lote Onda 0 em `src/lib/onda0ConsentTexts.ts`).
- **Risco de acoplamento:** fail-closed de consentimento (nunca quebrar — sem consentimento publicado, a ativação continua bloqueada); assimetria de papéis na notificação por destinatário.

## Dependências

- D2 (entregue, imutável). Nenhuma dura nova.

## Fora de escopo

- WhatsApp Business API / bridges (D3–D5, `wontfix`).
- Agrupamento/dedupe de notificações e expurgo (questões em aberto do D2 — item próprio se quiser).
- Convite/nudge de ativação de push dentro do sino (ver questão em aberto).

## Rabbit holes de produto

- **Depurar código que já está correto.** Se alguém "só completar" sem checar config primeiro, perde tempo reescrevendo a cadeia. **Corte:** fechar o diagnóstico elo a elo (envs → consentimento → inscrição → entrega); só tocar código com evidência de defeito.
- **Querer "consertar" iOS Safari sem PWA instalado.** Limitação de plataforma. **Corte:** comunicar e seguir; validar entrega no Android.
- **Push para o site público.** Decisão travada do D2: push só em `/campanha`. **Corte:** manter.

## Questões em aberto (produto)

- **Staff que não optou merece um convite para ativar push (nudge no sino)?** **Opções:** A) não — só o card do perfil | B) convite discreto na primeira abertura do sino | C) banner amplo. **Recomendação:** B, mas como item separado — não inflar esta verificação. _(decisão do gate)_
- **Onde validar a entrega em device real?** **Opções:** A) Android Chrome obrigatório; iOS (PWA instalado) opcional nesta entrega | B) ambos obrigatórios. **Recomendação:** A — o Android valida a cadeia inteira; o iOS exige aparelho + instalação e a limitação já é conhecida.

## Referências

- D2 — `docs/plans/notifications.md` (Issue #29, entregue; imutável)
- `AGENTS.md` — Consent fail-closed; lote jurídico Onda 0; D3–D5 `wontfix`
- Canvas UI (gate): N/A
