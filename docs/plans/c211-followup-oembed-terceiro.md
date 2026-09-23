# C211-FOLLOWUP-OEMBED — C211 — link de terceiro: o oEmbed não permite persistir metadados/conteúdo

Status: rascunho
Atualizado em: 2026-09-22
Issue: (registrada via `pnpm agent:register`; destrava quando o C211 flipar `done`)
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~30 min de ajuste documental no C211 (fill-in); nenhum código nasce aqui
Responsável: —

## Intenção

A investigação do C212 (Issue #1256, achados em `docs/plans/central-conteudos-varredura-instagram.md` §Q2) provou que o oEmbed do Instagram só serve para **renderizar** o post embutido (visão de front-end): "consuming, manipulating, extracting, or persisting the metadata and content … is strictly prohibited" (doc datada em 2026-09-22; probe sem credencial devolveu 403 `Provide valid app ID` ao pedir metadados). O plano do C211 (Issue #1254, `in-progress`) ainda carrega a hipótese B ("entra com thumbnail/embed quando o caminho oficial permitir") na questão em aberto "Peça por link: circula ou é baixada?" — interpretável como persistir thumbnail de terceiro, o que a plataforma proíbe.

Este item garante que, quando o C211 for implementado/refinado, a regra chegue ao plano dele: peça de terceiro circula **pelo link**; o embed pode ser renderizado; **nada é extraído, baixado ou persistido** de terceiro; catalogação/extração de arquivo só da conta própria via Graph API.

## Objetivo e aceite

- Ao destravar (C211 `done`), aplicar no plano/impl do C211 a linha de refinamento na questão "Peça por link" (`docs/plans/central-conteudos-ingestao.md:105`) e, se o aceite `:49` ainda prometer thumbnail de terceiro, alinhar o texto ao limite do oEmbed — citando `docs/plans/central-conteudos-varredura-instagram.md` §Q2.
- Nada além de documentação: sem código, sem schema, sem migration, sem Consent, sem URL.

## Dados da decisão (literais)

- **Guardrail:** mídia de terceiro nunca é baixada (C211 `:68`); o C212 acrescentou o limite do oEmbed: persistir metadados/conteúdo de terceiro é proibido pela plataforma.
- **Caminho oficial:** embed/render para terceiro; Graph API (`media_url`) só para a conta própria.

## Fora de escopo

- Implementar o fluxo de link (é o C211) e a varredura (item próprio descrito no C212 §Q4).

## Rabbit holes de produto

- **"Baixar a thumbnail porque dá."** O endpoint devolve o embed, não licença de persistência. **Corte:** render, nunca persistir.
- **"Editar o plano do C211 durante o in-progress."** Proibido (regra de captura de débitos): este item só age quando o C211 fechar.

## Referências

- Achados: `docs/plans/central-conteudos-varredura-instagram.md` §Q2 · Plano do pai: `docs/plans/central-conteudos-ingestao.md` · Doc datada: Instagram oEmbed (`developers.facebook.com/documentation/instagram-platform/oembed`, consultado em 2026-09-22)

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — a regra do oEmbed no plano do C211, sem código.
2. Appetite declarado e a intenção cabe? **Sim** (~30 min, quando destravar).
3. Persona + job + aceite claros? **Sim** — dono do C211.
4. Direção no codebase é hipótese? **Sim** — duas linhas de plano.
5. Zero decisões duras de engenharia? **Sim**.

**Score: 5/5.**
