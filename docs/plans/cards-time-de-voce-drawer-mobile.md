# Ajuste fino da foto no celular: drawer "Time de você" até o topo, sem nada sobre a imagem

Status: rascunho
Atualizado em: 2026-09-20
Issue: #1234
Priority: P2
Impeccable: B — encaixe no drawer mobile do estúdio de cards (funil público)
Design UI: docs/plans/cards-time-de-voce-drawer-mobile-ui-design.html
Appetite: ~0,5–1 dia eng; um outcome verificável — no celular, o ajuste fino da foto cabe na tela sem vaivém de rolagem
Responsável: —

## Intenção

No celular, a etapa de ajuste fino da foto do card "Time de você" é desastrada: o visitante ou vê a imagem, ou vê os controles — precisa rolar para cima e para baixo no meio do gesto. Duas correções pedidas no gate: (a) nada de sobreposto à imagem — o badge "Arraste para ajustar" sai de cima da prévia — e o aviso "O recorte já foi centralizado. Se precisar, arraste a foto ou use os controles." pode continuar existindo, desde que role junto com o conteúdo, sem ficar em cima da imagem quando o visitante desce para ver o conteúdo completo; (b) fazer o drawer inferior subir até o topo da página, removendo a faixa livre que hoje sobra acima dele e devolvendo espaço ao conteúdo. O enquadramento automático (S18), os controles existentes (arrastar, zoom, setas) e o resto do funil não mudam; o shell desktop (dialog) mantém a geometria.

## Persona e fluxo

- **Persona / contexto:** visitante do site público no celular, no meio do funil de cards, já com a foto preparada pelo recorte automático; quer ajustar e compartilhar sem fricção.
- **Job principal:** conferir e ajustar o enquadramento da foto com a prévia e os controles visíveis ao mesmo tempo, sem rolar a tela para lá e para cá.
- **Fluxo desejado:** escolhe o modelo "Time de você" → envia a foto → o drawer sobe até o topo da tela → vê a prévia; ao descer, o aviso rola junto e sai de cena, sem nada fixo sobre a imagem, e os controles de zoom/ajuste fino aparecem juntos → ajusta → segue para o card pronto e o compartilhamento.
- **Anti-goals de produto:** não redesenhar o estúdio nem o composer; não mudar a primitiva `Drawer` global; não mexer na geometria do dialog desktop; não remover a frase própria dos modelos de foto; não reabrir S18/S20.

### Esboço de fluxo (B)

```text
[galeria de modelos] → [foto enviada / recorte automático] → [drawer sobe até o topo]
→ [prévia; aviso rola junto e sai de cena ao descer] → [controles na mesma tela] → [card pronto] → [compartilhar]
```

### Design UI (B)

- Design UI (gate): `docs/plans/cards-time-de-voce-drawer-mobile-ui-design.html`

## Objetivo e aceite

- Nada fica sobreposto à imagem: o badge "Arraste para ajustar" sai de cima da prévia, no drawer e no dialog.
- O aviso "O recorte já foi centralizado. Se precisar, arraste a foto ou use os controles." permanece, mas dentro da área rolável: rola junto com o conteúdo e sai de cena quando o visitante desce para ver os controles — nunca fica fixo por cima da imagem.
- No celular, o drawer ocupa até o topo da tela, sem faixa livre; o passo de ajuste fino mostra a prévia e os controles de zoom/ajuste fino sem o vaivém de rolagem (o restante do conteúdo pode rolar).
- A geometria do shell desktop (dialog) e os demais modelos de card permanecem intocados; a regra "nada sobreposto à imagem / aviso rolável" vale nos dois shells.
- Swipe-down/fechar e acessibilidade continuam funcionando; o drawer segue anunciando título e conteúdo.
- **Guardrail:** a orientação `aria-describedby` do drawer precisa ser tratada ao remover a descrição — sem prescrever como (a decisão fica para o plano de implementação).
- A intenção diz "até o topo": nenhum token ou valor de altura é fixado aqui; a implementação decide o valor.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhuma PII é coletada ou exibida; a foto e a posição do recorte existem só no aparelho do visitante e nunca saem dele. Sem métrica nova neste item.
- **Decisões desbloqueadas:** N/A — ajuste de layout/UX, sem decisão de dado.
- **Forma:** N/A.

## Dados da decisão (literais)

- ID: `S23`; slug: `cards-time-de-voce-drawer-mobile`; tipo: `feature`; Priority: `P2`; Impeccable: `B`.
- Texto exato do aviso do time (verbatim): "O recorte já foi centralizado. Se precisar, arraste a foto ou use os controles." — permanece, porém dentro da área rolável (rola com o conteúdo); a frase própria dos modelos de foto ("Arraste para posicionar e use os controles para aproximar ou ajustar.") fica intocada no header.
- Badge sobre a prévia: "Arraste para ajustar" — sai da posição sobreposta à imagem; nada fica por cima da prévia.
- Alvo do drawer no celular: subir até o topo da viewport, respeitando safe-area — o `92dvh` de hoje vira teto efetivo da tela (validar o teclado no aparelho real).
- Rotas afetadas: `/` (home, seção de cards) e `/cards`.
- Drawer desktop (dialog) fica como está.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/cards/CardComposer.tsx` (composição da descrição/header), `src/components/cards/CardsStudio.tsx` (override do drawer mobile no ponto de uso), `src/components/ui/Drawer.tsx` (primitiva compartilhada — leitura apenas).
- **Precedente a olhar:** `docs/plans/atualizacoes-mobile-sheet-criacao-usavel.md` e o impl (C107: mesmo padrão de sheet que expande só o necessário, teto no topo; decisão de manter o override no ponto de uso), `docs/plans/bottom-drawer-busca-fullscreen-polimento.md` (fullscreen `100dvh`), `docs/plans/cards-time-de-voce-ajuste-lateral.md`.
- **Risco de acoplamento:** a primitiva `Drawer` serve outros drawers de campanha; manter o override no ponto de uso para não ampliar o blast radius. Respeitar `data-theme="campaign-site"` e o swipe handle/foco do drawer.

## Dependências

- Nenhuma. Sucessor de S20 (Issue #1216, entregue) — não reabre S18/S20.

## Fora de escopo

- Tutorial ou e2e novo de rolagem.
- Mudanças de copy do funil (o aviso do time permanece — só muda de lugar).
- Outros drawers de campanha.

## Rabbit holes de produto

- **"Já que vamos mexer no drawer, ajustamos todos os drawers de campanha."** Se alguém "só completar": vira refactor da primitiva com blast radius em campanha. **Corte neste item:** só o drawer do estúdio de cards; primitiva intacta.
- **"Já que o badge sai, tira o aviso também."** Se alguém "só completar": reabre a decisão do gate. **Corte neste item:** o aviso fica, rolando com o conteúdo.
- **"Aproveita e redesenha os controles do passo de ajuste."** Se alguém "só completar": redesign do composer estoura o appetite. **Corte neste item:** só espaço vertical e a remoção do aviso.

## Questões em aberto (produto)

- **Nada sobreposto à imagem e aviso rolável (resolvido no gate):** o badge "Arraste para ajustar" sai de cima da prévia; o aviso do time rola com o conteúdo; nada fica fixo sobre a imagem. _(decidido com o humano no gate)_
- **Topo da tela com safe-area (resolvido no gate):** subir até o topo respeitando safe-area; validar o teclado no celular real durante o work-issue. _(decidido com o humano no gate)_

## Referências

- GitHub Issue: a registrar (`S23`); S20 = Issue #1216 (entregue, sucessor).
- Design UI (gate): `docs/plans/cards-time-de-voce-drawer-mobile-ui-design.html`
- `docs/plans/atualizacoes-mobile-sheet-criacao-usavel.md` (precedente C107) e `docs/plans/atualizacoes-mobile-sheet-criacao-usavel-impl.md`
- `docs/plans/bottom-drawer-busca-fullscreen-polimento.md`
- `docs/plans/cards-time-de-voce-ajuste-lateral.md`
- `src/components/cards/CardComposer.tsx`, `src/components/cards/CardsStudio.tsx`, `src/components/ui/Drawer.tsx`
