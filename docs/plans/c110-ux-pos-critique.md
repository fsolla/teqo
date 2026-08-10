# UX pós-critique: C110 — refinamentos do feedback visual do arrasto da agenda

Status: rascunho
Atualizado em: 2026-08-10
Issue: — (registrar via agent:register após o plano)
Priority: P3
Model: cursor-grok-4.5-medium
Impeccable: B — encaixes na superfície já entregue (preview do arrasto do C110)
Canvas UI: N/A — superfície existente
Appetite: ~0,5 dia eng fill-in

## Intenção

O C110 (#589, entregue) trouxe o feedback visual do arrasto com um preview do período adjacente — aprovação do gate com o canvas, corte de fidelidade aceito ("preview aproximado; Opção 2 se destoar"). Este lote colhe os débitos pós-/simplify que ficaram abaixo do limiar de Issue individual, agrupados por superfície (o preview do arrasto): uma validação de leitura de produto (chevron) e dois polimentos visuais dentro da aproximação aceita.

## Escopo do lote

1. **Chevron: confirmar a leitura "direção da mudança"** (origem: /simplify). O aceite diz "um chevron na borda revelada indica a direção da mudança (próximo/anterior)"; o canvas do gate desenhou o chevron apontando para o **lado revelado** (direita quando o próximo é revelado à direita). Implementado seguindo o canvas. **Fase:** validar com um usuário da persona (coordenador/assessor) qual leitura prevalece; se "direção da mudança" (apontar na direção do gesto) vencer, flip de 1 linha (ChevronLeft/Right) no `ActivityAgendaSwipePreview` + ajuste do e2e se assertar a classe.
2. **Dots do mês ancorados ao frame do grid** (origem: /simplify). Os dots do preview no mês posicionam contra o bloco do conteúdo (chevron/label inclusos), não contra o frame skeleton — a primeira fileira pode sobrepor a área do rótulo. **Fase:** envolver head+frame+dots num container posicionado único para os dots ancorarem no frame.
3. **Gradiente de colunas duplicado no CSS** (origem: /simplify). A base do frame e a camada do mês repetem o mesmo `repeating-linear-gradient` de 14.285%. **Fase:** custom property `--swipe-frame-columns` se o lote já mexer nesse CSS (senão descartar — a var valeria mais indireção que as ~5 linhas).

## Fora de escopo / já resolvido

- Já resolvido no /simplify da sessão: helpers `clampDisplacement`/`isVerticalDrag`; `civilDateParts` fundido (year); `civilInstantAtBahia` → `allDayStartInstant`; seed e2e generalizado; `dispatchTouchDrag` unificado; CSS sem regras mortas (`background-size`, `position: relative` no frame, regra `--next`); paridade de label foldada nos unit tests.
- Decisões travadas (não reabrir): direção do gesto travada no claim; `touchcancel` sintético no claim; range do mês de 42 dias; transform imperativo no hook (sem estado por frame).

## Rabbit holes

- Redesenho do preview (Opção 2 do aceite — só seta) — não reabrir sem evidência nova de que o preview destoa.
- Animar mais superfícies da agenda (título do header, criação inline) — anti-goals do C110.

## Questões em aberto

- Nenhuma — o gate é a validação do chevron com usuário (fase 1).
