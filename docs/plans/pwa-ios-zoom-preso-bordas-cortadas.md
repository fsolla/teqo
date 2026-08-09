# PWA iOS: tela fica ampliada e com as bordas cortadas (zoom preso)

Status: ready
Atualizado em: 2026-08-09
Issue: #500
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: A — N/A (bug fix; restaura o comportamento esperado, sem redesenho)
Canvas UI: N/A — sem UI nova
Appetite: ~0,5–1,5 dia eng (inclui diagnóstico no aparelho real)
Responsável: —

## Intenção

O PWA `/campanha` instalado no iPhone apresenta a tela "comida" pelas bordas do aparelho: parece que a página inteira passa um pouco o limite da tela, e as bordas (topo/laterais) ficam cortadas. É comportamento específico do PWA em Safari/iOS — na aba do Safari não acontece.

Pesquisa prévia confirma família de bugs conhecida do WebKit em PWA standalone: o visual viewport fica preso num scale > 1 (zoom "colado") — seja após usar um input com teclado (o teclado zooma e o restore não acontece), seja ao abrir/retomar o app de segundo plano. Sintomas relatados por outras aplicações são idênticos: "all edges clipped", "stays zoomed until the user pinches out". Há também regressões documentadas do iOS 26 com `position: fixed`/viewport após teclado.

## Persona e fluxo

- **Persona / contexto:** staff da campanha (coordinator/advisor) no campo, usando o PWA instalado no iPhone como ferramenta diária.
- **Job principal:** abrir o app e enxergar a tela inteira, na escala certa, sem ter que "consertar" o zoom.
- **Fluxo desejado:** abre o app (ou retoma de segundo plano) → tela ocupa exatamente a tela do aparelho, escala 100%, nenhuma borda cortada → usa por horas (lista, filtros, ficha) sem nunca precisar desfazer zoom manualmente.
- **Anti-goals de produto:** bloquear zoom por pinça do usuário (acessibilidade); hack de tela cheia que esconda conteúdo; mudar o design do app.

## Objetivo e aceite

- Ao abrir ou retomar o PWA, a escala está em 100% e nenhuma borda está cortada (validar no aparelho real, não em emulador).
- Após usar qualquer input + teclado e fechar o teclado, a tela volta sozinha à escala original (sem intervenção do usuário).
- Zoom por pinça continua funcionando para o usuário (não é um "app que não dá zoom").
- Nenhuma regressão no comportamento em aba do Safari nem no desktop.

## Dados (intenção)

- **Vou apresentar dados?** Não — bug de renderização/viewport, sem métrica nova.
- **Decisões desbloqueadas:** nenhuma para o produto; verificação é visual no aparelho.

## Direção no codebase (hipótese)

- **Áreas prováveis:** config de viewport do `/campanha` (`src/app/(campaign)/layout.tsx` — hoje só `themeColor`, sem `viewport-fit` nem política de escala); shell do app `h-svh overflow-hidden` (`src/app/(campaign)/campanha/(app)/layout.tsx`); chrome fixo do PWA (`CampaignBottomNav`, `CampaignMobileTopBar` — que já usam `env(safe-area-inset-*)`, precedente de que a intenção de tela cheia existe); meta `apple-mobile-web-app-status-bar-style` (`statusBarStyle: 'default'` hoje).
- **Precedente a olhar:** pesquisa externa citada em Referências — a família de bugs é a mesma relatada por Discourse, BookStack, Starbucks PWA etc.
- **Risco de acoplamento:** o shell `h-svh`/`overflow-hidden` é a espinha de layout de todas as páginas `(app)` — qualquer mudança de altura/viewport precisa manter lista/quadro/agenda rolando dentro do painel, não a página inteira.

## Dependências

- Nenhuma dura. Suave: B183 (eliminar o trigger do auto-zoom de input reduz a frequência deste bug) — podem ser executados em qualquer ordem.

## Fora de escopo

- Reescrita do sistema de teclado/keyboard-inset próprio (polifill custom do teclado virtual) — se precisar, é outro item.
- Redesenho do chrome do PWA (safe-area já está parcialmente tratada).
- Bugs de terceiros não reproduzíveis no nosso app.

## Rabbit holes de produto

- **Caçar a família inteira de bugs WebKit.** A lista de bugs do standalone é longa e cada versão de iOS se comporta diferente. **Corte neste item:** corrigir o sintoma do nosso app (zoom preso / escala > 1) com o menor conjunto de medidas verificado no aparelho; sem polifill geral de viewport.
- **Virar debate de acessibilidade.** Bloquear zoom globalmente resolveria fácil, mas degrada o usuário. **Corte:** se a política de escala for necessária, ela vale só para o modo standalone/PWA (ou via regra de fonte 16px), nunca para a aba.

## Questões em aberto (produto)

- ~~O corte é permanente ao launch ou só após input/resume?~~ **Decidido no gate (2026-08-09): desde o launch** — o corte de bordas está presente já ao abrir o app, independente de interação. Hipótese principal passa a ser zoom/escala preso do próprio standalone no launch/resume (não o trigger de teclado do B183); a verificação no aparelho deve medir a escala do visual viewport logo no primeiro launch (cold open) e comparar com um force-quit/rotação.
- **Bloquear escala como último recurso?** **Opções:** A) nunca bloquear; B) `maximum-scale` seletivo só no standalone iOS, sem afetar aba/pinça (WCAG tradeoff conhecido); C) bloquear em tudo. **Recomendação:** A ou B, nunca C — prefere-se eliminar o trigger (16px, B183) e curar o estado preso; o bloqueio seletivo fica como fallback documentado se o bug persistir em iOS corrente. _(assumido — validar com produto)_

## Referências

- GitHub Issue #500
- Pesquisa externa (já feita, reaproveitável pelo executor):
  - WebKit bug 237961 — standalone + `viewport-fit: cover`: overscroll/`position: fixed`/`-webkit-fill-available` quebrados
  - dev.to (cederhook, 2026-07) — PWA standalone iOS: viewport encolhe com o 1º teclado e não volta; heal via re-measure forçado
  - west-wind (2023) — auto-zoom de input iOS e por que `maximum-scale` seletivo funciona no iOS sem matar a pinça
  - Apple Developer Forums — iOS 26: `visualViewport.offsetTop` não reseta após teclado; fixed elements deslocados
  - StackOverflow — `100dvh` no standalone não preenche a tela física (viewport unidades reportam menos o inset)
- Reddit r/PWA — PWA standalone abre "zoomed" ao retomar de segundo plano (Starbucks PWA reproduz)
