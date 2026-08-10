# Atualizações mobile: sheet de criação usável (altura até o topo, sem título, form sem labels com divisórias, placeholders descritivos, polaridade em toggle)

Status: registrado
Atualizado em: 2026-08-09
Issue: #519
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na superfície existente (bottom sheet de criação do feed de atualizações, C89)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-16/canvases/plan-c107-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um outcome verificável — no celular o sheet de criação abre inteiro até o topo e registra sem rolar
Responsável: —

## Intenção

No celular, o sheet de criação do feed de atualizações (C89) desperdiça espaço e exige rolagem para concluir: o título "Nova atualização" + paddings ocupam o topo que podia ser do formulário, cada input vem com label, descrição e caixa com borda (muita altura por campo), e o botão "Registrar atualização" só aparece depois de rolar. A polaridade, um select de 3 opções, é um controle pesado para um campo de 3 valores. Queremos o mesmo tratamento que a agenda está recebendo (C103): sheet que **expande só o necessário** para mostrar o formulário inteiro, com o teto no topo da tela (a partir daí, rola), formulário enxuto estilo lista — sem labels nem bordas, separado por uma linha horizontal — com placeholders descritivos ("Adicionar município", "Descrever o que aconteceu..."), a polaridade em **toggle segmentado** com os valores dentro do controle (Ruim | Neutra | Boa), selecionado destacado, e os checks (Urgente, Sinalizar adversário) com o quadrado à direita e a linha inteira tocável.

## Persona e fluxo

- **Persona / contexto:** assessor ou coordenador no celular, em pé, um polegar; registra o fato de campo entre visitas — o telefone é a mesa.
- **Job principal:** registrar o que aconteceu no município pelo celular, vendo o formulário inteiro e o botão de confirmar, sem lutar com o sheet.
- **Fluxo desejado:** abre o feed → toca em criar → o sheet abre com tudo que o formulário precisa, até o topo da tela → "Adicionar município" → "Descrever o que aconteceu..." → marca Ruim | Neutra | Boa → Urgente? → Registrar atualização (visível, sem rolar) → volta ao feed.
- **Anti-goals de produto:** não virar overlay de tela cheia nem segunda página; não mudar os dados gravados (texto, polaridade boa|neutra|ruim, urgente, sinal de adversário); não redesenhar as outras listas; não mudar o desktop além do decidido no gate.

### Esboço de fluxo (B)

Ver Canvas UI (rascunho "Hoje × Depois"). Jornada textual:
`[feed] → [+ criar] → [sheet cresce até o topo, sem título] → [município · texto · toggle · urgentes] → [Registrar visível] → [volta ao feed no mesmo recorte]`

## Objetivo e aceite

- No celular, o sheet de criação abre com **altura = conteúdo necessário** — o botão "Registrar atualização" fica visível **sem rolar**; só quando o conteúdo passa da tela (ex.: teclado aberto) o sheet encosta no topo e o formulário **rola por dentro**.
- O título "Nova atualização" **não é exibido** no mobile; o nome acessível do sheet é preservado (título visualmente oculto).
- Cada input do formulário fica **sem label visível, sem descrição e sem borda/caixa**; os campos são separados **apenas por uma linha horizontal edge-to-edge** (full bleed, indo até as bordas laterais do sheet — estilo lista, precedente C103 na agenda).
- Placeholders descritivos no mobile: **"Adicionar município"** (combobox) e **"Descrever o que aconteceu..."** (texto).
- A polaridade vira **toggle de três valores com os valores dentro do controle** — Ruim | Neutra | Boa — com o selecionado **destacado** e o padrão **Neutra**; o valor submetido continua `boa|neutra|ruim` (mesmo dado de hoje).
- **Urgente** e **Sinalizar adversário** viram linhas de checklist com o **quadrado de check à direita** (mais confortável para o polegar) e a **linha inteira como área de toque** — tocar no texto também alterna o check, não só o quadrado; descrições removidas no mobile.
- Acessibilidade mantida: labels via `aria`/visualmente ocultos, erros de campo continuam anunciados, obrigatórios continuam marcados.
- Desktop do feed e demais superfícies ficam como hoje, salvo o que o gate decidir sobre os campos compartilhados.

## Dados (intenção)

- **Vou apresentar dados?** Não — `Dados: N/A`. Ajuste de affordance de escrita; nenhum dado, KPI ou mapa envolvido.
- **Decisões desbloqueadas:** o usuário decide "registrar este fato agora, pelo telefone, vendo o formulário inteiro".

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/municipality/CampaignUpdatesCreateModal.tsx` (altura/posição do sheet mobile, remoção do título), `src/components/campaign/municipality/MunicipalityUpdateFields.tsx` (labels/bordas/divisórias e o toggle de polaridade — **compartilhado** com o quick-edit da lista B42), `src/components/campaign/shared/StrictCombobox.tsx` (placeholder "Adicionar município"), `src/components/ui/Drawer.tsx` (primitiva — se o ajuste de altura não couber só no uso), `src/components/ui/ToggleGroup.tsx` (padrão segmentado já usado em `VoteIntentionControl`).
- **Precedente a olhar:** C103 (`docs/plans/agenda-mobile-form-criacao-usavel.md`, em execução) — a mesma família "sheet que cabe até o topo + form sem labels com divisórias + placeholders"; se o mecanismo (primitiva de drawer/posição ou padrão de form) já estiver em `main` quando este item for executado, reutilizar em vez de criar segundo caminho.
- **Risco de acoplamento:** `MunicipalityUpdateFields` é compartilhado com o quick-edit da lista de municípios (`MunicipalityListUpdateControl`); mudança de apresentação pode vazar para lá (decisão no gate). O `Drawer` é primitiva usada por outras superfícies — mudança de altura/posição deve ser scoped ao uso ou backward-compatible. `StrictCombobox` é compartilhado por outras listas — placeholder sem mudar comportamento das demais.

## Dependências

- Nenhuma dura.
- Suave: **C87** (#396, in-progress — dono do campo polaridade/urgente no modelo; executar sobre o estado mergido de C87), **C103** (#504, in-progress — padrão irmão do sheet/form sem labels na agenda; reutilizar o que ele estabelecer), **C106** (#517, ready — move o trigger de criar do feed para o header no mobile; sem colisão de superfície — este item não toca o trigger).

## Fora de escopo

- Desktop do feed (`Dialog`) — mantém título, labels e descrições, salvo decisão do gate sobre o toggle de polaridade.
- Trigger de criar no mobile (button na omnibox hoje → icon no header) → **C106**.
- Quick-edit "Registrar atualização" da lista de municípios (sheet/popover B42) — herda ou não o visual via campos compartilhados, conforme decisão do gate; nada de redesenho próprio.
- Conteúdo/dados do feed, filtros, ordenação; deliberação (responsável/thread) → C88.
- Redesenho geral do `Drawer` ou das demais listas `/campanha`.

## Rabbit holes de produto

- **"Já que os campos mudam, o quick-edit da lista também precisa de tratamento próprio."** O componente é o mesmo; herdar é de graça e consistente. **Corte:** se o gate aprovar compartilhar, é só herança natural; altura/título continuam exclusivos do feed.
- **"Sheet vira página de tela cheia."** O pedido é auto-fit até o topo com rolagem interna, não overlay fullscreen nem navegação nova. **Corte:** mesmo conteúdo/fluxo de hoje, só altura/posição/polimento.
- **"Redesenhar todos os forms /campanha."** Labels/placeholders/toggle são decisão deste sheet e do C103 (agenda). **Corte:** o resto dos forms fica intacto.
- **"Polaridade nova é mudança de dado."** É só apresentação: os valores `boa|neutra|ruim` e o default `neutra` não mudam; C87 é o dono do modelo. **Corte:** nenhuma mudança de schema/valor.

## Questões em aberto (produto)

- **Campos compartilhados (sem labels/bordas, divisórias, toggle): aplicar só no sheet do feed ou também no quick-edit da lista (B42)?** **Opções:** A) aplica nos dois via componente compartilhado — mesma pessoa/job "registrar o que aconteceu", zero duplicação | B) escopar ao feed, deixando a lista como está. **Recomendação:** A — o componente é o mesmo e a consistência é o valor; escopar criaria uma segunda apresentação do mesmo form. _(assumido — validar)_
- **Título "Nova atualização": remover só no mobile?** **Opções:** A) só mobile (desktop mantém) | B) remove nos dois. **Recomendação:** A — o pedido é mobile; no desktop o título é esperado e ainda dá nome acessível ao diálogo. _(assumido — validar)_
- **Labels/descrições/bordas: mobile-only ou também desktop?** **Opções:** A) só mobile (precedente C103) | B) os dois. **Recomendação:** A — o idiomático "sem moldura" é do mobile; o desktop tem espaço para labels que ajudam descoberta. _(assumido — validar)_
- **Toggle de polaridade: só mobile ou também no desktop?** **Opções:** A) só mobile (desktop mantém o select) | B) toggle nas duas resoluções — o padrão segmentado já existe no app (intenção de voto) e é superior a select para 3 valores. **Recomendação:** B — mesmo controle nas duas resoluções evita duas superfícies divergentes para o mesmo campo. _(aberto — validar)_
- **Ordem do toggle:** o pedido é **Ruim | Neutra | Boa** (leitura crescente, neutra no meio). **Opções:** A) Ruim | Neutra | Boa (pedida) | B) Boa | Neutra | Ruim (ordem do select de hoje). **Recomendação:** A — pedido explícito; neutra no meio funciona como default central. _(assumido — validar)_
- **Placeholder do município:** pedido "Adicionar município" (verbo primeiro, como os placeholders do C103). Confirmado? **Recomendação:** manter como pedido. _(assumido — validar)_

## Referências

- GitHub Issue: #519
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-16/canvases/plan-c107-ui-draft.canvas.tsx`
- `src/components/campaign/municipality/CampaignUpdatesCreateModal.tsx` — sheet mobile (C89)
- `src/components/campaign/municipality/MunicipalityUpdateFields.tsx` — campos compartilhados (feed + quick-edit B42)
- `src/components/campaign/supporter/VoteIntentionControl.tsx` — precedente do toggle segmentado (`ToggleGroup`)
- `docs/plans/agenda-mobile-form-criacao-usavel.md` (C103 — padrão irmão), `docs/plans/atualizacoes-mobile-sem-moldura.md` (C106 — feed, trigger no header), Issue #396 (C87)
