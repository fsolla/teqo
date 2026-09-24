# S40 — Time do estadual: a arte de modelo genérica entregue pelo humano (sem estadual específico)

Status: rascunho
Atualizado em: 2026-09-24
Issue: #1316
Priority: P2
Impeccable: C — troca da arte de modelo e remoção de um desenho num funil público existente (sem superfície nova)
Design UI: docs/plans/cards-estadual-modelo-generico-ui-design.html
Appetite: ~0,5 dia eng; a arte aprovada vira tile/placeholder, a silhueta desenhada sai e os pins acompanham
Responsável: —

## Intenção

O tile e o placeholder de pré-escolha do modelo `Time do estadual` mostram hoje a arte de exemplo do S30: o JULIO PINHEIRO 13999 específico como ilustração. Quem chega na galeria pelo celular pode ler aquilo como "o card do Julio" em vez de "o modelo com o _seu_ estadual" — a arte ilustra um estadual real no lugar onde deveria ilustrar o conceito. A campanha entregou (2026-09-24) uma arte genérica: `SEU ESTADUAL` no lugar do lockup e **duas silhuetas** — o lugar da foto do visitante e o lugar do estadual ainda vazio. Essa arte passa a ser o tile e o placeholder de pré-escolha.

No gate (2026-09-24), o humano decidiu também que a pós-escolha sem foto **não desenha mais a silhueta do visitante**: «Acho melhor sem silhueta. Essa silhueta desenhada nao ficou bom. Deixa vazio ate adicionar a foto do usuario.» A janela fica vazia (a arte do estadual escolhido aparece como é) até a foto entrar — como o `Time de você` já faz. A pré-escolha segue com a arte entregue, que já traz as duas silhuetas.

O que NÃO muda: fluxo, copy, seletor, catálogo das 53, artes das 53 e o analytics S32. É troca de um arquivo público no mesmo caminho e na mesma dimensão 1080×1440, mais a remoção de um desenho; nenhuma superfície, controle ou estado novo nasce.

## Persona e fluxo

- **Persona / contexto:** apoiador/militante no celular, navegando o estúdio de cards antes de decidir a dobradinha; não conhece a arte interna da campanha e lê o tile pelo que ele mostra.
- **Job principal:** reconhecer o modelo antes de escolher o estadual — "é o card com o meu estadual" — sem achar que o card é do Julio; depois de escolher, ver o card limpo até colocar a própria foto.
- **Fluxo desejado:** home (`#cards`) ou `/cards` → vê o tile `Time do estadual` com a arte genérica → abre o composer → antes de escolher, o placeholder é a mesma arte genérica com `A silhueta marca o lugar da sua foto.` e o CTA desabilitado → escolhe o estadual na lista dos 53 → sem foto, vê a arte do escolhido com a janela vazia (sem silhueta desenhada) → nome + foto → prévia e download, como sempre.
- **Anti-goals de produto:** renomear/redesenhar o modelo; segunda arte por estadual; editar a arte entregue (recorte, re-encode, apagar as silhuetas dela); tocar nas 106 artes; mexer em copy/estados/analytics.

### Esboço de fluxo (C)

```text
[home #cards / /cards] → tile `Time do estadual` (arte genérica "SEU ESTADUAL" + 2 silhuetas; badge NOVO da colinha ao lado)
→ composer: pré-escolha = a mesma arte + "A silhueta marca o lugar da sua foto." / "Escolha um estadual para continuar." (CTA desabilitado)
→ escolhe o estadual (53) → sem foto: arte do escolhido com a janela vazia (sem silhueta desenhada)
→ nome + foto → prévia final → baixa o PNG
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-estadual-modelo-generico-ui-design.html` (+ assets em `cards-estadual-modelo-generico-ui-design-assets/`)
- Cenas: (1) galeria com o tile `Time do estadual` no desktop 1280 e no mobile 390, o badge `NOVO` da colinha ao lado; (2) placeholder de pré-escolha no composer, antes de escolher, em 390/1280, com o notice e o CTA desabilitado; (3) continuidade pós-escolha sem foto — arte do estadual escolhido com a **janela vazia** (sem o desenho `#001a42`) até a foto do visitante.

## Objetivo e aceite

- O tile e o placeholder de pré-escolha passam a ser a nova arte, **byte-a-byte**, no MESMO caminho público, 1080×1440 jpeg sRGB — sem re-encode, sem edição, sem recorte.
- Pós-escolha sem foto: nenhuma silhueta desenhada; a janela mostra a arte do estadual escolhido (FOTOS + BASE) até a foto entrar. A pré-escolha segue com a arte entregue (as duas silhuetas dela são parte da arte, não desenho).
- Nenhum outro pixel, fluxo, copy ou estado muda: seletor, catálogo das 53, artes das 53, notice, CTA, download e evento S32 seguem intocados. O notice continua verdadeiro (é da pré-escolha).
- A nova arte lê como modelo genérico: `SEU ESTADUAL` no lugar do lockup e duas silhuetas, sem nome nem número de nenhum estadual real.
- A remoção da silhueta é limpeza do dono: o desenho e seus pins saem em vez de ficarem mortos (sem consumidor).

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhum dado é apresentado; a troca é visual e não há analytics novo.
- **Decisões desbloqueadas:** N/A — a leitura de uso do modelo, quando houver, continua sendo S32.
- **Forma:** _adiada ao plano de implementação_ — N/A.

## Dados da decisão (literais)

- ID `S40`; slug `cards-estadual-modelo-generico`; tipo `feature`; Priority `P2`; Impeccable `C — troca da arte de modelo e remoção de um desenho num funil público existente (sem superfície nova)`; Design UI `docs/plans/cards-estadual-modelo-generico-ui-design.html`.
- Modelo `time-do-estadual`; caminho público inalterado `/cards/modelo-time-de-voce-com-estadual.jpeg`.
- **Decisão do gate (2026-09-24) — fonte canônica:** sobrescrever **in-place** o asset do S30 `docs/plans/cards-estadual-dobradinha-ui-design-assets/modelo-time-de-voce-com-estadual.jpeg` com a nova arte (1080×1440 jpeg sRGB, sha256 `1f5dc8212662697149f0acac5701e8de58c53a86f5af316535736dccb7a53c7b`; a arte antiga de sha `7fc8a50a…` fica no histórico do git). Sem pasta de assets nova; `scripts/build-state-deputy-card-assets.mjs` (`APPROVED_EXAMPLE_SRC`, linhas 38–41) e `tests/unit/stateDeputyCatalog.unit.spec.ts` (`APPROVED_EXAMPLE_SRC`, linhas 34–39 e 75–82) mantêm os mesmos paths — só os bytes mudam; recomenda-se pinar o sha literal novo no teste.
- **Decisão do gate (2026-09-24) — sem silhueta desenhada:** pós-escolha sem foto mostra a arte do estadual escolhido sem o desenho `#001a42`; a janela fica vazia até a foto do visitante. Remover `drawCardVisitorSilhouette` + `CARD_VISITOR_SILHOUETTE_FILL` + o subject `{kind:'silhouette'}` (`src/lib/cardRender.ts:236-278,334-336`); o ramo `CardComposer.tsx:408-423` passa a desenhar só a arte + nome; os pins acompanham — unit `tests/unit/cardRender.unit.spec.ts:22,320-327,342-348` (remover) e e2e `tests/e2e/frontend.e2e.spec.ts:2243-2268` (o pixel probe `[0,26,66,255]` vira a cor da arte na janela; com JULIO, sem silhueta, o ponto (582,540) do compositor dá `[239,223,196,255]` — confirmar na implementação).
- Copy intocada: o notice `A silhueta marca o lugar da sua foto. O card final usa a arte do estadual escolhido.` é da pré-escolha (arte com silhuetas) e segue verdadeiro (`CardComposer.tsx:877-883`).
- Arquivo entregue no MacBook: `/Users/fsolla/Downloads/WhatsApp Image 2026-09-24 at 12.57.00.jpeg` (os bytes já estão no repo, no asset do S30 acima).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/cardModels.ts` (`previewSrc` do modelo, linhas 110–126 — só leitura; o path não muda), `src/components/cards/CardModelTile.tsx` (tile, `previewSrc ?? assetSrc`, linha 58) e `src/components/cards/CardComposer.tsx` (placeholder `drawImage(previewImage, …)`, linhas 277–287 e 364–377; ramo da silhueta, linhas 408–423), `src/lib/cardRender.ts` (dono do desenho), `docs/plans/cards-estadual-dobradinha-ui-design-assets/` (asset sobrescrito), `scripts/build-state-deputy-card-assets.mjs`, `tests/unit/stateDeputyCatalog.unit.spec.ts`, `tests/unit/cardRender.unit.spec.ts`, `tests/e2e/frontend.e2e.spec.ts`.
- **Precedente a olhar:** S34 (`docs/plans/cards-colinha-arte-exata.md`) — arte exata entregue pelo humano, byte-a-byte; S30 (`docs/plans/cards-estadual-dobradinha.md`) — decisão original da arte de modelo e da silhueta.
- **Risco de acoplamento:** não tocar catálogo/artes dos 53; a fonte em `docs/` não vai para a imagem Docker (`.dockerignore:25`), só o `public/` serve em produção; o e2e do ramo pina o pixel da silhueta (`tests/e2e/frontend.e2e.spec.ts:2266-2268`) e precisa acompanhar a remoção, mas copy/CTA/download/evento seguem verdes.

## Dependências

- Nenhuma.

## Fora de escopo

- As 106 artes das dobradinhas (53× FOTOS/BASE); as silhuetas da arte entregue usada na pré-escolha; renomear/mover o caminho público; copy/estados do composer; analytics S32; os demais modelos do estúdio; arte de exemplo por estadual.

## Rabbit holes de produto

- **"Já que a janela fica vazia, apaga as silhuetas da arte entregue também."** Se alguém "só completar": editaria o arquivo aprovado e a pré-escolha mudaria junto. **Corte neste item:** a pré-escolha usa a arte entregue como está; a decisão vale só para o desenho do canvas pós-escolha.
- **"Gera arte de exemplo por estadual."** Se alguém "só completar": 53 artes novas, um estúdio de ilustração e pin por estadual — o oposto do pedido. **Corte neste item:** uma arte genérica só, a mesma para todos.

## Questões em aberto (produto)

- Nenhuma — as decisões do gate (2026-09-24) estão registradas nos literais: sobrepor o asset do S30 in-place, manter o caminho público, remover a silhueta desenhada e manter o render de pré-escolha.

## Referências

- GitHub Issue #1316
- Design UI (gate): `docs/plans/cards-estadual-modelo-generico-ui-design.html`
- `docs/plans/cards-estadual-dobradinha.md` e `docs/plans/cards-estadual-dobradinha-impl.md` — S30 (arte de modelo original, catálogo, placeholder, silhueta)
- `docs/plans/cards-colinha-arte-exata.md` — S34 (precedente: arte exata entregue pelo humano, byte-a-byte)
- `src/lib/cardModels.ts`, `src/components/cards/CardModelTile.tsx`, `src/components/cards/CardComposer.tsx`, `src/lib/cardRender.ts`, `scripts/build-state-deputy-card-assets.mjs`, `tests/unit/stateDeputyCatalog.unit.spec.ts`, `tests/unit/cardRender.unit.spec.ts`, `tests/e2e/frontend.e2e.spec.ts`
- `AGENTS.md` — convenção de assets byte-for-byte e de migrations/estrutura do repo
