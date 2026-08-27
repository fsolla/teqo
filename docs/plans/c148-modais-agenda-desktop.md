# Agenda: modais usáveis no desktop (criação de atividade, sync e feed)

Status: rascunho
Atualizado em: 2026-08-27
Issue: #933
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe nos modais da agenda
Rascunho UI: docs/plans/c148-modais-agenda-desktop-ui-draft.html
Appetite: ~0,5–1 dia eng; um outcome verificável — no desktop, os três modais da agenda abrem com largura/padding coerentes, conteúdo inteiro acessível (scroll quando precisa) e o par data/hora não empilha
Responsável: —

## Intenção

Dois pedidos fundidos sobre `/campanha/atividades` no desktop. No modal de criação de atividade: "o layout no desktop está esquisito — bordas gigantes, modal desnecessariamente estreito, e o seletor de data/hora fica um em cima do outro". No modal de sincronização Google: "o modal é estreito demais e o conteúdo passa do topo e da base da tela, sem rolagem para ver o resto". É a mesma dor — modais da agenda que não respeitam a janela do desktop — e o modal de feed ICS carrega o mesmo defeito latente do sync. Correção de encaixe, não redesign.

## Persona e fluxo

- **Persona / contexto:** assessor (ou coordenador) na mesa, no desktop, montando a agenda da semana e sincronizando o Google Calendar; tarefa operacional curta e repetida.
- **Job principal:** criar/editar uma atividade e configurar a sincronização sem lutar contra o modal.
- **Fluxo desejado:**
  1. Abre "Nova atividade" → modal abre com largura generosa e paddings contidos (nada de "bordas gigantes").
  2. Em Início/Término, os dois campos ficam lado a lado, cada um com data e hora na mesma linha.
  3. Se o conteúdo excede a altura da janela, o corpo rola internamente — os botões de ação ficam sempre visíveis no rodapé.
  4. Abre o modal de sync Google → a lista de opções rola no corpo, footer fixo.
  5. Abre o modal de feed ICS → mesmo comportamento de corpo rolável.
  6. No mobile, nada muda (folha com rolagem de hoje).
- **Anti-goals de produto:** redesign de formulário/campos, mudança de lógica (validação/salvamento) dos modais, padronização de outros modais do app, feature nova.

### Esboço de fluxo (B/C/D)

```text
[/campanha/atividades] → [Nova atividade · modal desktop] → preencher → Início/Término lado a lado → [Salvar]
                       → [Sync Google · modal] → corpo com rolagem + footer fixo → [Sincronizar]
                       → [Feed ICS · modal]  → corpo com rolagem + footer fixo → [Copiar link]
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/c148-modais-agenda-desktop-ui-draft.html` — cena 1 (criação em desktop ~1280px), cena 2 (sync Google com corpo rolável e footer fixo; feed ICS segue o mesmo padrão), cena 3 (a mesma criação em ~390px, mobile inalterado).

## Objetivo e aceite

- No desktop, os TRÊS modais da agenda (criação/edição de atividade, sync Google, feed ICS) abrem com largura e padding coerentes — sem bordas gigantes, sem largura espremida.
- Nenhum dos três corta conteúdo: quando o corpo excede a altura disponível, há rolagem interna e o rodapé de ações permanece visível.
- O par Início/Término do modal de criação não empilha no desktop — data e hora de cada campo na mesma linha (o rascunho mostra a disposição recomendada).
- Guardrails: mobile dos três modais intocado (apenas não pode regredir); lógica de validação/salvamento e dados intocados; nenhum outro modal do app muda.

## Dados (intenção)

- **Vou apresentar dados?** Não — correção de layout/encaixe; nenhuma superfície de dados nova.
- **Decisões desbloqueadas:** nenhuma além do aceite visual do gate.

## Dados da decisão (literais)

- N/A — a intenção não fixa IDs, strings ou thresholds; os literais operacionais são os três modais nomeados na direção e o corte desktop vs mobile (mobile = comportamento atual da folha com rolagem).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/activity/` — `ActivityOverlay.tsx` (criação/edição), `GoogleCalendarSyncDialog.tsx`, `CalendarFeedDialog.tsx`, `ActivityDateTimeField.tsx`; base compartilhada `src/components/ui/dialog.tsx`.
- **Hipótese central:** o override desktop do overlay usa largura/padding não-responsivos (`max-w-2xl`, `p-0`) que NÃO derrubam as variantes `sm:` da base (`sm:max-w-md`, `sm:p-8`) — em telas ≥ sm vencem as da base, e o modal fica com 28rem de largura e 2rem de padding (o "estreito + bordas gigantes"). Nos dois dialogs menores falta `max-h` + rolagem no caminho desktop (o mobile já resolve com a folha). O empilhamento data/hora vem da caixa estreita + grade de duas colunas.
- **Precedente a olhar:** o padrão mobile do próprio overlay (folha com max-h e corpo rolável) e do sync/feed no mobile — é o padrão a replicar no desktop.
- **Risco de acoplamento:** `ui/dialog.tsx` é a base de todos os modais do app — mudá-la globalmente causaria regressão silenciosa em toda tela; preferir correção local nos três modais da agenda (override explícito por breakpoint), sem tocar em outros consumidores.

## Dependências

- Nenhuma dura. Soft: C123 (ActivityOverlay — superfície de criação atual) e C94 (feed ICS) como precedentes de onde o defeito vive.

## Fora de escopo

- Mobile dos três modais (já está bom) — apenas garantir que não regrida.
- Lógica dos modais: validação, salvamento, dados e estados de erro intocados.
- Redesenho do formulário de atividade (campos, defaults, seções) — outro dia, outro pedido.
- Padronização de outros modais do app fora da agenda.
- A funcionalidade de sync/feed em si (feature existente — só o encaixe).

## Rabbit holes de produto

- **"Aproveitar e padronizar todos os modais do app."** Se alguém "só completar": varredura de todas as telas, PR gigante, regressão em massa. **Corte neste item:** só os três modais da agenda.
- **"Redesenhar o formulário de atividade."** Se alguém "só completar": reorganizar seções, campos novos, defaults. **Corte:** só encaixe/medidas dos campos existentes.
- **"Mudar a base ui/dialog.tsx para resolver de uma vez."** Se alguém "só completar": mudança global sem varredura de consumidores. **Corte:** mudança local nos três modais; a base só muda se o executor varrer os consumidores e provar zero regressão.

## Questões em aberto (produto)

- **Como dispor Início/Término no desktop?** **Opções:** A) os dois campos lado a lado, cada um com data+hora inline | B) um campo por linha com data+hora na mesma linha. **Recomendação:** A no desktop (aproveita a largura recuperada), fallback B se apertado. _(assumido — validar no gate com o rascunho; a cena 1 mostra A)._
- **Largura dos modais de sync/feed:** manter a atual (~32rem) ou ampliar um pouco (~36rem)? **Recomendação:** ampliar pouco e garantir rolagem — o defeito principal do sync/feed é a falta de scroll, não a largura. _(assumido — a cena 2 mostra ~36rem)._

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c148-modais-agenda-desktop-ui-draft.html`
- Arquivos para abrir primeiro: `src/components/campaign/activity/ActivityOverlay.tsx`, `GoogleCalendarSyncDialog.tsx`, `CalendarFeedDialog.tsx`, `ActivityDateTimeField.tsx`, `src/components/ui/dialog.tsx`
- `AGENTS-campaign.md` — seção "Campaign activities (C3)" (vocabulário Atividade; dado interno de staff, sem LGPD/consent aqui)
