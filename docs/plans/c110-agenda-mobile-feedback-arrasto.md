# C110 — Agenda mobile: feedback visual do arrasto (reveal do período adjacente + commit/snap-back)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #589
Priority: P2
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: C — interação de gesto nova na superfície mobile de `/campanha/agenda` (feedback durante o arrasto)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-26/canvases/plan-c110-ui-draft.canvas.tsx
Appetite: ~1 dia eng; um outcome verificável — ao arrastar o calendário no mobile, o gesto "pega": o grid acompanha o dedo, o período adjacente aparece, e a troca se concretiza ao soltar acima do limiar (ou volta ao período atual abaixo dele)
Responsável: —

## Intenção

No celular, `/campanha/agenda` já navega por arrasto (C101), mas a troca salta **sem feedback**: ao cruzar 48 px, ainda com o dedo no ar, o período muda instantaneamente — o usuário não vê o gesto "pegar" nem para onde ele vai. O calendário nativo dá a sensação de folhear: o grid acompanha o dedo e o próximo período aparece por trás. Este item é o débito cortado no C101 ("Animação do swipe / transição suave entre períodos — corte: troca instantânea", `c101-agenda-mobile-calendario-nativo-impl.md`), agora com pedido explícito de feedback.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor de campo, de pé, um polegar, sol/ruído; o celular é a mesa de trabalho.
- **Job principal:** pular entre dias/semanas/meses com a certeza de que o gesto pegou e para onde ele leva — sem depender de o título mudar depois.
- **Fluxo desejado:**
  1. Usuário arrasta o calendário para a esquerda (quer o período seguinte).
  2. O grid atual segue o dedo; na borda que se abre, o período adjacente aparece aos poucos, com chevron de direção — **e seus eventos entram no preview conforme carregam** (objetivo; degradação aceita: se ainda carregando, o quadro aparece sem eles e eles entram ao carregar).
  3. Soltou antes do limiar → o grid volta ao período atual (snap-back); nada navega.
  4. Passou do limiar e soltou → o período adjacente assume a tela (commit), como a troca de hoje, mas com o grid acompanhando o gesto.
- **Anti-goals de produto:** não vira segunda barra de controles nem ganha botões; **não muda o desktop**; não engole o tap de criação inline (C91) nem o long-press de remanejo (C15); o carregamento de eventos do período adjacente nunca trava ou atrasa o gesto (assíncrono; se não chegar a tempo, o preview mostra o quadro sem eventos).

### Esboço de fluxo (C)

```text
abre /campanha/agenda (mobile) — grid do período atual
→ arrasta para a esquerda → grid segue o dedo; período adjacente aparece na borda (+ chevron)
→ solta abaixo do limiar → snap-back ao período atual (sem navegação)
→ ou solta acima do limiar → período adjacente assume a tela; título e eventos atualizam (como hoje)
```

## Objetivo e aceite

- Durante o arrasto horizontal no calendário (mobile, vistas dia/semana/mês), o grid **acompanha o dedo em tempo real** e o período adjacente é **revelado progressivamente** na direção do gesto.
- **Os eventos do período adjacente aparecem no preview conforme carregam** (carregamento disparado durante o arrasto, assíncrono). Objetivo do item; degradação aceita: se não carregaram a tempo, o quadro aparece sem eventos e eles entram quando chegam.
- Um **chevron na borda revelada** indica a direção da mudança (próximo/anterior) enquanto o dedo arrasta.
- **Soltar abaixo do limiar (48 px, o atual)** → o grid retorna ao período atual com animação de volta; nenhuma navegação acontece.
- **Soltar acima do limiar** → a navegação confirma (período adjacente assume a tela) com transição suave; o resultado final (título do header, carregamento de eventos) é o de hoje.
- **`prefers-reduced-motion`:** sem animação — troca instantânea (comportamento atual).
- Sem regressão: desktop intacto; tap para criar inline e long-press de remanejo intactos; vista de dia (coluna única) segue sem abrir criação após arrasto; o contrato e2e CDP do gesto é atualizado no mesmo item.
- **Vista de lista:** ideal que participe do preview (seta/reveal); degradação aceita para troca instantânea atual.
- **Fallback aceito (Opção 2):** se o reveal do período adjacente não fechar com fidelidade aceitável, o grid atual translada e o espaço vazio revelado mostra o chevron progressivo — com os mesmos limiar, commit no soltar e snap-back.

## Dados (intenção)

- **Vou apresentar dados?** Não — feedback de gesto, sem apresentação de dados.
- **Decisões desbloqueadas:** "o gesto pegou e para onde ele leva" durante o arrasto.
- **Forma:** N/A (só restrição de produto: o preview do período adjacente mostra o quadro do grid, não números).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/activity/useAgendaSwipeNavigation.ts` (expor o delta vivo do gesto; decisão passa a ser no soltar), `src/components/campaign/activity/ActivityAgenda.tsx` (estado de arrasto + transform no container `.activity-agenda` + commit no pointerup; carregamento dos eventos do período adjacente durante o arrasto, na linha do `loadActivityAgendaEvents` existente), `ActivityAgenda.css` (transições + `prefers-reduced-motion` já honrado), testes: unit do hook (limiar/dominância/pointerType/guarda/disparo único) e `tests/e2e/campaignAgendaMobile.e2e.spec.ts`.
- **Precedente a olhar:** plano C101 + impl (o gesto e o corte explícito); `docs/plans/modo-focado-busca-no-focus.md` (CSS transitions + tokens; sem lib de motion antes do 3º call site de animação complexa).
- **Risco de acoplamento:** o hook é o dono do gesto (contrato unit-testado); o container é compartilhado com o FullCalendar (long-press, `dateClick`, event drag) e o `touchmove` non-passive é o que impede o pan controller de roubar o gesto — mudar o momento do commit (meio do gesto → soltar) mexe no contrato que o e2e pina.

## Dependências

- Suave: C101 (#497, entregue — base do gesto). Nenhuma dura.

## Fora de escopo

- Desktop (mantém chrome atual).
- Animar o título do período no header do app (troca instantânea como hoje; débito leve se fizer falta).
- Transições de criação inline, remanejo e redimensionamento de evento.

## Rabbit holes de produto

- **"Folhear real" com dois grids FullCalendar vivos + preload.** Renderizar o período adjacente de verdade (com eventos) durante o arrasto puxa renderização extra do FC e uma chamada de dados por período arrastado. **Corte neste item:** o reveal é o quadro do período adjacente (aparência do grid, cabeçalho com as datas) com os eventos entrando **assíncronos** conforme carregam; se não chegaram a tempo, o quadro aparece sem eventos (degradação aceita pelo produto) — nunca bloquear o gesto.
- **Replicar o grid do FC pixel-perfect.** O preview pode destoar do grid real. **Corte:** preview simples que comunique "é o próximo período"; se destoar demais, o aceite permite cair para a Opção 2 (só seta).
- **Mudança do momento do commit.** Passar do disparo no meio do gesto para o disparo no soltar muda a janela do long-press do FC e o e2e. **Corte:** manter claim de 12 px e limiar de 48 px; o cancelamento sintético do toque passa a ocorrer no claim, não no commit.

## Questões em aberto (produto)

- **Opção 1 (revelar adjacente) ou Opção 2 (só seta)?** **Opções:** A) revelar o período adjacente progressivamente | B) transladar o grid atual + seta no espaço vazio. **Recomendação:** A — cumpre a promessa "calendário nativo" do C101 e é o pedido do usuário; guarda no aceite autoriza degradar para B se o preview ficar barato/destoado. _(confirmado no gate)_
- **Eventos aparecem no preview do período adjacente?** **Opções:** A) sim — carregados de forma assíncrona durante o arrasto | B) não — só o quadro, eventos após o commit. **Recomendação:** A como objetivo, com degradação aceita para B se o carregamento não chegar a tempo do gesto. _(confirmado no gate — objetivo é que apareçam)_
- **Quando a navegação se concretiza?** **Opções:** A) no soltar, acima do limiar | B) continua no meio do gesto (como hoje). **Recomendação:** A — sem isso o snap-back abaixo do limiar não existe (a troca já teria acontecido). _(confirmado no gate)_
- **Vista de lista participa?** **Opções:** A) sim — ideal | B) não — mantém troca instantânea atual. **Recomendação:** A como objetivo; degradação aceita para B. _(confirmado no gate — ideal que participe; sem aparecer é aceitável)_
- **O que o preview adjacente mostra?** **Opções:** A) quadro do grid (faixas/colunas + cabeçalho de datas) + chevron | B) só o chevron sobre fundo neutro. **Recomendação:** A — comunica o período sem depender só do símbolo. _(confirmado no gate)_

## Referências

- GitHub Issue #589 (C110)
- GitHub Issue #497 (C101 — base do gesto, débito cortado na impl)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-26/canvases/plan-c110-ui-draft.canvas.tsx`
- `src/components/campaign/activity/useAgendaSwipeNavigation.ts` (limiar/dominância/claim/touchcancel sintético), `ActivityAgenda.tsx`, `ActivityAgenda.css` (`touch-action: pan-y`, `prefers-reduced-motion`)
- `tests/e2e/campaignAgendaMobile.e2e.spec.ts` (contrato CDP do gesto)
