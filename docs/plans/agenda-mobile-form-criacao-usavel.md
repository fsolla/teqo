# Agenda mobile: formulário de criação usável no celular (sheet do topo, rolável, salvar alcançável, popover dentro da tela, form sem labels)

Status: rascunho
Atualizado em: 2026-08-09
Issue: #504
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na superfície existente (bottom sheet + popover de data/hora da criação inline, C91/C97)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-13/canvases/plan-c103-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um outcome verificável — no celular o formulário de criação preenche até o fim e salva
Responsável: —

## Intenção

No celular, o sheet de criação rápida (C91) corta o formulário embaixo: "Responsáveis" e o botão "Salvar" ficam fora da tela e **não há rolagem** — o coordenador/assessor de campo não consegue concluir a criação pelo telefone, que é a mesa do campo. Pior, o popover de data/hora (C97) estoura a tela e os seletores de hora/minuto aparecem espremidos. Queremos o formulário **preenchível de ponta a ponta no celular**: o sheet abre do topo (mais espaço), o conteúdo rola, "Salvar" sempre alcançável, o seletor de data/hora abre **como bottom sheet** no mobile (inteiro na tela, sem colisão de popover), e o form fica mais enxuto — sem labels nem margens, só a linha divisória entre os campos; os placeholders dão o contexto ("Adicionar título", "Adicionar responsáveis").

## Persona e fluxo

- **Persona / contexto:** coordenador ou assessor de campo, em pé, um polegar, sol/ruído; o celular é a ferramenta de trabalho.
- **Job principal:** criar um compromisso no slot certo da agenda **pelo celular**, sem perder nenhum campo do caminho.
- **Fluxo desejado:**
  1. Toca num slot vazio → o sheet abre **do topo**, preenchendo a altura útil da tela, com cabeçalho fixo ("Nova atividade" + data do slot).
  2. O formulário aparece sem labels — "Adicionar título", data/hora, "Município", "Local (opcional)", "Adicionar responsáveis".
  3. Rola o conteúdo livremente até o fim; "Salvar" fica fixo no rodapé do sheet, sempre na mão.
  4. Toca em Início/Término → no mobile, o seletor de data/hora abre como **bottom sheet** (calendário + hora/minuto inteiros na tela), por cima do sheet de criação.
- **Anti-goals de produto:** não vira o formulário completo (tarefas, resultados, organizações continuam no detalhe); não muda a página de edição (`/atividades/[slug]/editar`) nem o formulário completo (`/nova`); não mexe no chrome do calendário (C101); não muda o desktop além do que o mesmo mecanismo de "caber na viewport" resolver (B181).

### Esboço de fluxo (B)

```text
[toca no slot vazio] → [sheet do topo: "Nova atividade" + data fixos]
  → "Adicionar título" | Início/Término (popover inteiro na tela) | Município | "Adicionar responsáveis"
  → rolagem livre até o fim
  → rodapé fixo: [Mais detalhes] [Salvar] → evento aparece no calendário
```

## Objetivo e aceite

- No celular, tocar num slot abre o sheet de criação **do topo** (ou equivalente que maximize a área útil do formulário — ver questão em aberto), em vez do bottom sheet atual que corta o conteúdo.
- O conteúdo do formulário **rola até o fim**: "Responsáveis" e "Salvar" alcançáveis em viewport pequeno (ex. 640×480) e com teclado aberto.
- **"Salvar" sempre visível** no rodapé do sheet (recomendação) ou alcançável ao rolar — sem gesto oculto.
- O formulário **não exibe labels visíveis**: os placeholders dão o contexto ("Adicionar título", "Adicionar responsáveis", "Município", "Local (opcional)"); campos obrigatórios continuam marcados (asterisco) e a acessibilidade é mantida (labels via `aria`/visualmente ocultos, erros anunciados).
- Os campos do formulário ficam **empilhados sem margens/gaps**: apenas uma **linha divisória** entre eles (estilo lista — ex.: configurações do iOS), sem respiro nem card entre os inputs.
- No celular, o seletor de **data/hora abre como bottom sheet** (drawer aninhado por cima do sheet de criação): calendário e seletores de hora/minuto ficam **inteiros na tela**, legíveis — sem colisão de popover. No **desktop, o popover continua** como hoje.
- Sem regressão: desktop mantém o fluxo atual; criar não navega; salvar insere o evento no calendário; leader lockdown intacto.

## Dados (intenção)

- **Vou apresentar dados?** Não. `Dados: N/A` — affordance de escrita sobre a agenda; nenhuma métrica/série/mapa envolvida.
- **Decisões desbloqueadas:** o usuário decide "criar o compromisso agora, pelo telefone, sem perder o rascunho".

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/components/campaign/activity/ActivityInlineCreate.tsx` — o braço mobile (`Drawer`) hoje abre do fundo com conteúdo `overflow-hidden`; é aqui que a posição do sheet, a rolagem do form e o rodapé fixo de "Salvar" se resolvem.
  - `src/components/campaign/activity/ActivityDateTimeField.tsx` — no mobile, o disparo do campo abre um **bottom sheet** com o mesmo conteúdo (calendário + hora/minuto); no desktop, o popover atual continua.
  - `src/components/ui/Drawer.tsx` — primitiva de drawer (posição do topo / altura / scroll interno do conteúdo / drawer aninhado), se o ajuste não couber só no uso.
- **Precedente a olhar:** B181 (#490 — clip do topo do overlay no desktop ≤720px; mecanismo irmão "cabe na viewport com scroll interno", mesmo padrão do `max-h` do C97), C91 (`agenda-criar-evento-inline.md` — desenho do sheet), C97 (popover de data/hora), drawer aninhado já suportado pela primitiva (`CalendarFeedDialog`).
- **Risco de acoplamento:** o `Drawer` é primitiva compartilhada (`CalendarFeedDialog`, listas) — mudança de posicionamento/scroll deve ser scoped ao uso da criação inline ou ser backward-compatible; o popover é portado para o body, então o posicionamento precisa levar a viewport inteira em conta, não só o sheet.

## Dependências

- Nenhuma dura. Coordenação suave com **C101** (#497 — o plano dele exclui explicitamente o overlay de criação; nada de colisão) e **B181** (#490 — clip do popover **desktop**; com o seletor mobile virando sheet, as superfícies não se sobrepõem).

## Fora de escopo

- Formulário completo `/campanha/atividades/nova` e página de edição `/campanha/atividades/[slug]/editar` (labels/placeholders/seletor ficam como estão).
- Abrir evento existente em sheet de edição (continua indo ao detalhe).
- "Todo o dia" → **C104**. Tags → **C105**.
- Chrome do calendário mobile (header contextual, arrasto, filtro sticky) → **C101**.
- Clip do topo do overlay/popover **desktop** em viewport baixa (≤720px) → **B181**.

## Rabbit holes de produto

- **"Sheet vira página."** Se alguém "só completar", o sheet vira o formulário grande. **Corte:** mesmo conteúdo do C91, só posição/altura/rolagem/rodapé.
- **"Redesenhar todos os forms /campanha."** Labels/placeholders são decisão deste sheet. **Corte:** só a criação inline da agenda; o resto dos forms fica intacto.
- **"Mexer no desktop junto."** **Corte:** o desktop fica como está — o seletor continua em popover e o form com labels; B181 segue na fila.

## Questões em aberto (produto)

- **Sheet do topo vs outras formas de maximizar o formulário?** **Opções:** A) sheet que desce do topo da tela (como pedido — "trazer até o topo") | B) bottom sheet em altura cheia com scroll | C) overlay de tela cheia sem swipe. **Recomendação: A** — é o pedido explícito, dá o máximo de espaço e mantém o gesto de fechar. _(assumido — validar)_
- **"Salvar" fixo ou no fim do form?** **Opções:** A) rodapé fixo do sheet, sempre visível | B) fim do formulário (alcançável ao rolar). **Recomendação: A** — thumb-zone; o usuário nunca perde o botão. _(assumido — validar)_
- **Placeholders puros ou micro-labels flutuantes?** **Opções:** A) placeholders puros (como pedido) | B) labels que sobem ao digitar. **Recomendação: A** — o form é curto e os obrigatórios continuam marcados. _(assumido — validar)_
- **B181 (clip do topo do overlay desktop ≤720px): absorver ou manter?** **Opções:** A) manter B181 na fila — o C103 mexe no seletor mobile (bottom sheet) e não toca o posicionamento do popover desktop; B181 segue seu próprio caminho | B) fundir B181 no C103. **Recomendação: A** — com o seletor mobile virando sheet, as superfícies deixam de se sobrepor; B181 permanece o ajuste do popover desktop. _(decidido no gate)_
- **Seletor de data/hora no mobile: popover ajustado ou bottom sheet?** **Opções:** A) popover com colisão/limite de viewport | B) **bottom sheet** com calendário + hora/minuto inteiros na tela (padrão nativo; evita controlar colisão dentro do sheet de criação). **Recomendação: B** — pedido do usuário no gate; mais simples de garantir visualização total. _(decidido no gate)_
- **Edição de evento existente na agenda mobile?** **Opções:** A) continua indo à página de detalhe/edição (atual) | B) abre o mesmo sheet pré-preenchido para editar. **Recomendação: A** — fora deste lote; se a mesa pedir, vira item futuro. _(assumido — validar)_

## Referências

- GitHub Issue: — (a registrar)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-13/canvases/plan-c103-ui-draft.canvas.tsx`
- `src/components/campaign/activity/ActivityInlineCreate.tsx` — braço mobile do sheet de criação (C91)
- `src/components/campaign/activity/ActivityDateTimeField.tsx` — popover de data/hora (C97)
- `src/components/ui/Drawer.tsx` / `src/components/ui/Popover.tsx` — primitivas
- Precedentes: `docs/plans/agenda-criar-evento-inline.md` (C91), `docs/plans/c97-agenda-popover-seletor-data-hora.md`, Issue #490 (B181)
