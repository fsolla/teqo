# C114 — Google Calendar: agenda da campanha espelhada com notificação (push Teqo → Google)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #635
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — encaixe na agenda (junto do "link de import" atual)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-33/canvases/plan-c114-ui-draft.canvas.tsx
Appetite: ~2 dias eng; um outcome verificável — a equipe vê a agenda da campanha no Google Calendar com atualização automática em minutos

## Intenção

O "link de import" (C16) entrega um espelho que o Google re-busca em cadência própria (horas de atraso, sem notificação — o defeito C113 é só a ponta). Isso não sustenta a agenda *oficial* da campanha: a equipe e o candidato vivem no Google Calendar do celular. Com a API oficial do Google, o Teqo pode **escrever** os compromissos num calendário compartilhado da campanha: criar/remarcar/cancelar em Teqo aparece nos calendários de quem segue em minutos, e o Google cuida dos avisos — conforme as configurações de notificação de cada pessoa que segue, exatamente o que o pedido assume ("if their personal calendar is set to notify"). O Teqo continua a fonte da verdade.

## Persona e fluxo

- **Persona / contexto:** coordenação quer a agenda oficial da campanha; assessores e comunicação vivem no Google Calendar; candidato precisa ver os compromissos no celular sem entrar no Teqo.
- **Job principal:** "a agenda da campanha vive no meu Google Calendar e acompanha o Teqo — sem eu entrar no Teqo".
- **Fluxo desejado:** coordenador ativa a "Agenda da Campanha" no Google (uma vez, na agenda do Teqo) → a equipe adiciona o calendário pelo link (um clique) → criar/remarcar/cancelar em Teqo reflete no Google em minutos → quem segue recebe aviso conforme as próprias configurações de notificação; núcleo (candidato/coordenação) pode receber aviso garantido como participante.
- **Anti-goals de produto:** não é bidirecional (Google não volta — é C115); não substitui o link de import iCal (fica para quem não usa Google e para recortes filtrados); não é obrigar OAuth por pessoa (o modelo é calendário compartilhado, não escrever no calendário pessoal de cada um); Teqo continua SoT.

**Por que não OAuth por pessoa (decisão de produto, não tecnicismo):** escrever no calendário pessoal de cada staff via OAuth individual não gera notificação (o Google não avisa eventos no próprio calendário — aviso vem de ser participante), cria N cópias divergentes (remarcou um, o resto fica velho — o oposto de agenda oficial), custa N consentimentos/tokens/revogações (app não-verificado do Google expira token em dias) e quebra o RBAC do Teqo (o Google não conhece escopo por município nem leader lockdown; num calendário compartilhado, o access do Teqo vale). OAuth por pessoa só teria valor futuro na direção de *leitura* (ver agenda pessoal p/ conflito de horário) — item separado.

### Esboço de fluxo (B)

```text
[agenda /campanha/agenda] → ativar "Agenda da Campanha" (configuração única)
→ link de adição para a equipe → criar/editar/cancelar em Teqo
→ push via API do Google (minutos) → calendário de quem segue atualiza + aviso conforme configs
```

## Objetivo e aceite

- Com um comando em `/campanha/agenda`, a campanha ativa um calendário Google compartilhado ("Agenda da Campanha") e o Teqo passa a receber o link público de adição para distribuir à equipe (Google assina direto; Apple/Outlook assinam a URL iCal que o Google expõe do mesmo calendário — atualização na cadência do cliente, sem notificação nativa).
- Compromissos criados/editados/cancelados em Teqo refletem no calendário Google em minutos (push via API oficial, não cadência de re-busca do assinante).
- Quem segue o calendário recebe notificação conforme as configurações de notificação do próprio Google; pessoas-chave podem ser participantes dos eventos (aviso garantido) — decisão em aberto abaixo.
- Teqo continua SoT e funciona sem Google: credencial inválida ou API fora não corrompe o Teqo — a UI mostra o estado do sync (sincronizado / pausado / não configurado) e re-tenta sem ação manual.
- A "Agenda da Campanha" espelha as atividades do escopo do staff (todas); o link de import iCal continua servindo recortes filtrados e não-Google.
- Sem PII desnecessária no evento (título, município, horário, local; sem lista de lideranças).
- Leader lockdown intocado (leader não vê nem ativa a integração).

## Dados (intenção)

- **Vou apresentar dados?** Não — a agenda é exportada para o calendário Google; a "forma" do evento é a do Google Calendar, decisão de apresentação do Google.
- **Decisões desbloqueadas:** nenhuma decisão de leitura no Teqo (o espelho é saída).
- **Forma:** *adiada* — aqui só a restrição de produto "sem PII além do necessário no evento".

## Direção no codebase (hipótese)

- **Áreas prováveis:** agenda `/campanha/agenda` (superfície de ativação/estado), ações de servidor em `src/app/(campaign)/campanha/actions/`, utilitário de integração perto de `src/utilities/calendarFeed.ts` (precedente do feed), envs de credencial Google no Vercel (precedente `REVALIDATE_SECRET`/Blob).
- **Precedente a olhar:** plans C16/C92/C93/C96/C98/C113 (link de import e feed iCal); collection `calendarFeed` como precedente de recurso de sync com credencial revogável.
- **Risco de acoplamento:** credenciais de conta Google da campanha em produção (service account) — segredo bem guardado, sem vazar em log; falha da API não pode derrubar a agenda do Teqo; nenhum dado pessoal duplicado no Google.

## Dependências

- Nenhuma dura. Suaves: C113 (frescor do iCal) é independente — o push cobre consumidores Google; o iCal segue para o resto e para recortes.

## Fora de escopo

- Bidirecional (edição no Google volta para o Teqo) → **C115**.
- OAuth por pessoa (cada staff autoriza o Teqo a escrever no calendário pessoal dele): anti-goal explícito — o modelo é calendário compartilhado.
- Um calendário por filtro/recorte: o link de import iCal já cobre; a Agenda da Campanha é o espelho cheio.
- Migração de eventos de outras fontes (agendas antigas) para o Google.
- Notificação intra-TeQo (sino) — já existe; este item não mexe.

## Rabbit holes de produto

- **"Um calendário por assessor/município."** Se alguém "só completar": explodir em N calendários e permissões. **Corte neste item:** um calendário oficial compartilhado; recortes seguem no iCal.
- **"Sincronizar todo o histórico."** **Corte:** janela de eventos (passado próximo + futuro), como o feed já faz.
- **"Notificação garantida para todo mundo."** **Corte:** quem segue recebe conforme as próprias configurações (é o que o pedido assume); garantia só para o núcleo (participantes), se a mesa quiser.

## Questões em aberto (produto)

- **Quem é o dono da conta do calendário?** **Opções:** A) conta Google da campanha (Gmail/Workspace existente): o calendário nasce nela e o Teqo escreve com credencial de service account autorizada naquele calendário | B) o service account cria o calendário (dono = service account; transferência de dono depois é difícil). **Recomendação:** **A** — o Google recomenda não usar service account como dono; a campanha provavelmente já tem conta própria. _(assumido — validar: existe conta Google da campanha? qual?)_
- **Notificação da equipe: só seguir o calendário ou também participar?** **Opções:** A) todo mundo segue o calendário (aviso conforme configurações de cada um) | B) núcleo (candidato/coordenação) entra como participante dos eventos (aviso garantido por e-mail/app; evento também aparece no calendário pessoal dele). **Recomendação:** **B para o núcleo, A para o resto** — a agenda oficial merece aviso garantido para quem decide. _(assumido — validar)_
- **O que vai no evento do Google?** **Opções:** A) título, município, horário, local, tags | B) só título + horário. **Recomendação:** **A**, sem lista de lideranças e sem telefones. _(assumido — validar)_
- **Onde fica o estado do sync na UI?** **Recomendação:** pill no header da agenda ("Google: sincronizado/pausado") + aviso claro ao ativar sem credenciais configuradas. _(assumido — validar)_
- **Visibilidade do calendário compartilhado?** **Opções:** A) público no link (qualquer um com o link vê; o link é a credencial, como o secret do feed iCal atual) | B) só pessoas convidadas individualmente (exige conta Google de cada um — quem usa Apple sem conta Google não assina). **Recomendação:** **A** — a equipe é mista (Google + Apple); o link público cobre os dois e o conteúdo já é o da agenda oficial (sem PII, por guardrail). Quem quiser mais restrição compartilha o link internamente. _(assumido — validar)_

## Decisões travadas (gate)

- Modelo = calendário compartilhado da campanha com escrita via API oficial (não OAuth por pessoa, não iCal).
- Direção única Teqo → Google neste item; Teqo permanece SoT.
- A Agenda da Campanha é o espelho cheio do escopo do staff; recortes ficam no iCal.

## Referências

- GitHub Issue [#635](https://github.com/fsolla/teqo/issues/635)
- Canvas UI (gate): [plan-c114-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-33/canvases/plan-c114-ui-draft.canvas.tsx)
- Plans C16 (`sync-teqo-google-calendar.md`), C113 (`c113-feed-ical-agenda-nao-atualiza.md`), C92/C93/C96/C98
- `src/utilities/calendarFeed.ts`, `src/collections/CalendarFeed.ts`, `src/components/campaign/activity/CalendarFeedDialog.tsx`
