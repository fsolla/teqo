# C108 — Sino de notificações: ler ao abrir + painel limpo + modal centrado no desktop

Status: registrado
Atualizado em: 2026-08-09
Issue: #522
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: C — encaixe no painel do sino (shell do `/campanha`, mobile + desktop)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-17/canvases/plan-c108-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um encaixe no painel existente, sem superfície nova
Responsável: —

## Intenção

O staff abre o sino de notificações e precisa de um clique extra ("Marcar todas como lidas") para algo que deveria resolver na abertura — e depois ainda de "Fechar". O painel carrega título, contador e botões que não ajudam a decisão; no desktop ele é um sheet ancorado na base, quando o esperado é um modal central que some ao clicar fora.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor/liderança em `/campanha` — mesa (desktop) ou campo (mobile), abrindo o sino para ver o que aconteceu.
- **Job principal:** ver os avisos e voltar ao trabalho; abrir já deixa tudo lido, sem interação extra.
- **Fluxo desejado:** toca no sino → painel abre (desktop: modal central com X no canto superior direito; mobile: sheet de base) → lista carrega e marca tudo como lido no ato (badge do sino zera) → toca num item e vai para a tela, ou fecha por X / clique fora / swipe.
- **Anti-goals de produto:** não criar leitura individual/por item; não virar central de notificações com configurações e histórico; não mexer nos gatilhos de abertura (slot do header).

### Esboço de fluxo (C)

```text
[Abrir o sino]
  → desktop: modal centralizado com X no canto superior direito; fora = fecha
  → mobile: bottom sheet de base; swipe/backdrop fecha
  → lista carrega e marca tudo como lido no ato (badge zera, sem clique)
  → [item?] → navega para a tela do evento e fecha o painel
  → [fechar] → X / clique fora / swipe (sem botão "Fechar")
```

## Objetivo e aceite

- Abrir o painel marca todas as notificações do usuário como lidas automaticamente — o badge do sino zera sem nenhuma ação (o "Marcar todas como lidas" deixa de existir como botão).
- O painel não exibe título "Notificações" nem botão "Fechar", em nenhum tamanho de tela.
- No desktop o painel abre como modal centralizado, com X de fechar no canto superior direito e clique-fora fechando — usando o componente shadcn já existente no repo (precedente do par responsivo Dialog/Drawer em C94).
- No mobile continua bottom sheet; o destaque visual de "não lida" na lista deixa de fazer sentido (nada é não lido depois da abertura) e pode sair.
- Guardrail: leader lockdown intacto — notificações continuam por destinatário (`recipient` = campaignUser); nenhuma mudança de acesso, consentimento ou schema.

## Dados (intenção)

Dados: N/A — contagem já existe (badge e `read_at`); nenhuma métrica nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/CampaignNotificationBell.tsx` (painel atual: Drawer + footer com botões); ação já existente `markAllCampaignNotificationsRead` em `src/app/(campaign)/campanha/actions/notifications.ts` — passa a ser disparada na abertura; `src/components/ui/dialog.tsx` (X de fechar já existe) + `src/components/ui/Drawer.tsx`.
- **Precedente a olhar:** par responsivo Dialog/Drawer do `CalendarFeedDialog` (C94) e o padrão "sheet sem título" dos itens mobile recentes (C106/C107).
- **Risco de acoplamento:** shell do `/campanha` (headers desktop/mobile) — o gatilho do sino é slot existente; não trocar o contrato.

## Dependências

- Nenhuma dura. C106/C107 (superfícies diferentes) são independentes.

## Fora de escopo

- Leitura individual/por item ou "deixar X como não lida" — decisão de não fazer (anti-goal).
- Push para o device: D6.
- Central de notificações (histórico, expurgo, preferências) — não existe hoje; não inventar aqui.

## Rabbit holes de produto

- **Marcar no fechar em vez de no abrir.** Se alguém "só completar" com marcação ao fechar, o badge não zera na abertura — o usuário pediu explicitamente o contrário. **Corte:** marcar na abertura, ponto.
- **Personalizar a lista.** Agrupar, filtrar, "não perturbe" vira outra superfície. **Corte:** apenas remover título/contador/botões e trocar o invólucro no desktop.

## Questões em aberto (produto)

- **A linha "X não lidas / Tudo em dia" do header some junto com o título?** **Opções:** A) remover — a contagem vive no badge do sino | B) manter. **Recomendação:** A — com a marcação automática ela vira sempre "Tudo em dia", sem função. _(assumido — validar)_
- **Destaque visual de não lidas na lista:** após a marcação automática nunca aparece. **Opções:** A) remover | B) manter. **Recomendação:** A. _(assumido — validar)_

## Referências

- D2 — `docs/plans/notifications.md` (Issue #29, entregue; imutável — este item refina o sino dela, não edita o plano)
- Canvas UI (gate): plan-c108-ui-draft.canvas.tsx
- C94 — `docs/CHANGELOG-AGENTS.md` (2026-08-09): precedente Dialog/Drawer responsivo
- `AGENTS.md` — shell do `/campanha` e leader lockdown
