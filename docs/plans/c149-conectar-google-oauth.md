# C149 — Google Calendar: botão Conectar Google (OAuth) substitui a configuração manual de service account

Status: rascunho
Atualizado em: 2026-08-27
Issue: #934
Priority: P2
Model: composer-2.5
Depends: #932 (C147)
Impeccable: B — encaixe na agenda (configuração do sync)
Rascunho UI: docs/plans/c149-conectar-google-oauth-ui-draft.html
Appetite: ~2 dias eng; um outcome verificável — o candidato/coordenador conecta a conta Google do calendário da campanha clicando um botão (consent do Google), sem criar service account nem colar JSON
Responsável: —

## Intenção

Ativar o espelho Google Calendar (C114) hoje exige cerimônia de engenharia: criar service account no GCP, baixar JSON, base64, colar em env, compartilhar o calendário com o e-mail da conta de serviço. O dono do produto: _"This manual configuration of the service account plus calendar isn't ideal — isn't there a way to expose a button that allows the candidate to sync a calendar to it?"_ O registro C114 recusou OAuth **por pessoa** (N staff escrevendo no calendário pessoal de cada um). O pedido atual é diferente: **uma** concessão OAuth em que candidato/coordenador autoriza o Teqo a gerenciar **o calendário da campanha** — variante não coberta pelo registro, vinda como nova evidência do dono. Configuração vira um clique.

## Persona e fluxo

- **Persona / contexto:** candidato ou coordenador geral, no computador (mesa), configurando o espelho da agenda uma única vez — e voltando só quando algo quebra.
- **Job principal:** "conecto a conta Google do calendário da campanha ao Teqo sem ajuda de engenharia".
- **Fluxo desejado:** na configuração do sync da agenda → clica "Conectar com o Google" → tela de consent do Google (escolhe a conta da campanha) → volta ao Teqo com estado "conectado" → o sync passa a usar essa conexão; se o token quebrar um dia, o estado mostra "erro" com caminho de reconexão (clicar de novo).
- **Anti-goals de produto:** não é OAuth por pessoa (C114 continua valendo — UMA concessão, calendário da campanha); não é migração obrigatória (service account segue funcionando como fallback); não mexe na seleção de qual calendário (C150) nem no motor de reconciliação; leader não vê nem conecta (lockdown).

### Esboço de fluxo (B)

```text
[/campanha/agenda — configuração do sync] → "Conectar com o Google" → consent Google (conta da campanha)
→ callback de volta ao Teqo → estado "conectado" → sync usa a conexão (service account vira fallback)
```

### Rascunho UI (gate)

- Rascunho UI (gate): `docs/plans/c149-conectar-google-oauth-ui-draft.html` — cenas: não configurado (botão), conectado, erro de token com reconexão, mobile.

## Objetivo e aceite

- O candidato/coordenador conecta a conta Google do calendário da campanha clicando um botão (consent do Google) — sem criar service account, sem colar JSON, sem tocar em GCP.
- Estado da conexão visível e honesto: conectado | erro | não configurado; erro de token mostra caminho de reconexão em um clique.
- Falha de token/Google não corrompe dados: Teqo continua SoT; o espelho degrada para "erro", nada é apagado nem duplicado.
- Funciona atrás do túnel Cloudflare: o callback OAuth usa a URL pública correta (nada de localhost vazando no redirect).
- Guardrails: o token nunca aparece em log; armazenamento fail-closed (sem conexão → sem sync, sem crash); desconectar revoga o acesso no Teqo e orienta revogar no Google; leader lockdown intocado.

## Dados (intenção)

- **Vou apresentar dados?** Não — a conexão é infraestrutura do espelho (saída); nenhuma leitura nova de dados no Teqo. O `calendarList` (escopo readonly) alimenta apenas a escolha de calendário do C150.
- **Decisões desbloqueadas:** candidato/coordenador decide (uma vez) qual conta Google autoriza; diante de "erro", o mesmo ator decide reconectar ou desconectar.
- **Forma:** _adiada ao plano de implementação_ — aqui só as restrições: estado ternário, nunca exibir o token, sem inventar estados intermediários.

## Dados da decisão (literais)

- Escopos OAuth mínimos: `https://www.googleapis.com/auth/calendar.events` + `https://www.googleapis.com/auth/calendar.calendarlist.readonly` (o segundo basta para listar calendários no C150 — sem escopo além do necessário).
- Estados da conexão (UI + registro): `conectado | erro | não configurado` — exatamente esses três.
- Env de credencial que vira fallback (não renomear nem remover nesta entrega): `GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY`.
- Restrição dura de produto: o token DEVE sobreviver sem re-consentimento semanal (o caminho técnico — app unverified vs verificação Google — fica em aberto, ver Questões).

## Direção no codebase (hipótese)

- **Áreas prováveis:** configuração do sync na agenda `/campanha/agenda` (botão/estado), rotas de callback OAuth em `src/app/(campaign)/campanha/…`, utilitários Google perto de `googleCalendarSync.ts`/`googleCalendarClient.ts`, armazenamento da conexão na collection `googleCalendarSync` (onde `calendarId` já vive).
- **Precedente a olhar:** plano C114 (decisão "não OAuth por pessoa"); par `readGoogleServiceAccountCredentials`/`googleCalendarClient` (REST hand-rolled com `jose`, sem lib Google hoje); WebAuthn de campaignUser (precedente de cerimônia de credencial com rota fora de `(app)`).
- **Risco de acoplamento:** o token é credencial da conta Google da campanha — nunca logar, fail-closed, desconectar revoga; leader lockdown; C147 merged antes (o sync funcionando/diagnosticado) para não brigar no mesmo client.

## Dependências

- **Dura: C147** — o sync precisa estar funcionando/diagnosticado antes de trocar o modelo de credencial (também evita conflito de arquivos no client).

## Fora de escopo

- Escolha/listagem de qual calendário conectar → **C150** (aqui só entrega a conexão e o estado).
- Migração/remoção obrigatória da service account (fica como fallback; aposentar é entrega futura).
- OAuth por pessoa (anti-goal C114, reafirmado) e leitura de agenda pessoal para conflito de horário (item separado, se um dia existir).
- Motor de reconciliação do sync (janela, locks, hooks C114/C122) — intocado.

## Rabbit holes de produto

- **"Verificação completa do app no Google."** Se alguém "só completar": auditoria, casework, semanas de fila — para uso interno. **Corte neste item:** caminho unverified (uso interno, <100 usuários) com aviso no consent; verificação só se o produto um dia precisar.
- **"Desconectar + limpar tudo + migrar quem usa service account."** **Corte:** desconectar = revogar no Teqo + orientação de revogar no Google; ninguém é obrigado a migrar nesta entrega.
- **"Seletor de calendário dentro do botão."** Se alguém "só completar": puxa o C150 para dentro. **Corte:** a conexão autoriza; escolher o calendário é o item seguinte.

## Questões em aberto (produto)

- **Manter a service account como fallback depois que o OAuth existir?** **Opções:** A) sim, como caminho técnico até o OAuth estar comprovado em produção | B) aposentar na mesma entrega. **Recomendação:** **A** — aposentar é entrega separada. _(assumido — validar com produto)_
- **Quem pode conectar/desconectar?** **Opções:** A) candidato + coordenador | B) só candidato | C) também advisor. **Recomendação:** **A** — é a credencial da campanha inteira; advisor não autoriza credencial global, leader lockdown. _(assumido — validar)_
- **App unverified ou verificação Google?** **Opções:** A) unverified (aviso no consent, token não expira em ~7 dias) | B) verificação completa (sem aviso, custo de auditoria). **Recomendação:** **A** — uso interno, <100 usuários; a restrição dura é o token sobreviver sem re-consentimento semanal. _(trade-off do aviso é a decisão de produto)_

## Referências

- Rascunho UI (gate): `docs/plans/c149-conectar-google-oauth-ui-draft.html`
- Plan C114 (`c114-google-calendar-push-agenda-oficial.md` — decisão "não OAuth por pessoa"); C147 (dependência dura); C150 (seleção de calendário, fora daqui)
- `src/utilities/googleCalendarSync.ts`, `src/utilities/googleCalendarClient.ts`, collection `googleCalendarSync` (`calendarId`)
- `AGENTS-campaign.md` — leader lockdown / papéis de `/campanha`
