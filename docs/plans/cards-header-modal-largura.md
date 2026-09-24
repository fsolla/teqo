# S35 — Header do modal de criação de card: largura do card e fechar na borda

Status: rascunho
Atualizado em: 2026-09-24
Issue: #1299
Priority: P2
Impeccable: C — ajuste visual num funil público existente (sem superfície nova)
Design UI: docs/plans/cards-header-modal-largura-ui-design.html
Appetite: ~0,3–0,5 dia eng; um ajuste visual verificável com prova no browser
Responsável: —

## Intenção

O modal de criação de card abre com o header com cara de quebrado: o título e o botão de fechar ficam agrupados à esquerda, ocupando menos largura que o próprio card. O design aprovado sempre mostrou o header atravessando o modal, com o × colado na borda direita. O relato é do humano testando o funil ao vivo («o header do modal da criação de card está quebrado. Ele fica menor que a largura do card.»). É um bug de fidelidade ao que foi aprovado, não um redesign: o desenho certo já existe nos artefatos do gate; a implementação é que divergiu (presente desde S13, 2026-09-12 — não é regressão).

## Persona e fluxo

- **Persona / contexto:** visitante/coordenador no funil de cards (home `#cards` ou `/cards`), no desktop, depois de escolher um modelo e abrir o compositor.
- **Job principal:** ler o título do passo e fechar o modal sem estranhar a moldura — o header precisa parecer a barra superior do card, de ponta a ponta.
- **Fluxo desejado:** abre o modelo → o modal aparece com o título do passo à esquerda e o × na borda direita, alinhados à largura do card → lê o passo → fecha pelo × (ou segue o fluxo). No celular, o mesmo compositor vive no drawer, que já está correto.
- **Anti-goals de produto:** redesenhar o shell ou o header; mexer nos primitivos de dialog/drawer usados por outras telas; mudar copy, hierarquia ou tipografia; criar controles novos.

### Esboço de fluxo (C)

```text
[home #cards ou /cards] → escolhe modelo → modal abre (header full-width, × na borda)
  → lê o título do passo → fecha pelo × | segue o fluxo
  (mobile: drawer — inalterado)
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-header-modal-largura-ui-design.html`

## Objetivo e aceite

- No modal de criação de card no desktop, o header ocupa a largura do modal: bloco do título alinhado à esquerda e × na borda direita, exatamente como nas cenas de dialog dos artefatos aprovados.
- Títulos longos e curtos se comportam igual — o header não encolhe nem "flutua" à esquerda.
- O drawer mobile mantém o layout atual (já correto) — sem mudança visível.
- Nada mais no estúdio muda: sem copy nova, sem tipografia nova, sem outros diálogos afetados.
- A correção é paridade com o artefato aprovado — nenhuma invenção visual.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhuma métrica.
- **Decisões desbloqueadas:** N/A — o alvo é visual e já está aprovado no gate.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: paridade com as cenas de dialog aprovadas.

## Dados da decisão (literais)

- Modelos/entradas do funil intocados: `#cards`, `/cards`, `?model=`.
- Modal desktop = dialog do `CardsStudio`; drawer mobile inalterado.
- Alvo visual = paridade com as cenas de dialog dos artefatos aprovados (`cards-time-de-voce-ui-design.html` e correlatos): header ocupando a largura, `×` na borda direita.
- Sem copy nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/cards/CardComposer.tsx` (a linha do header) e `src/components/cards/CardsStudio.tsx` (o shell do dialog).
- **Precedente a olhar:** artefatos aprovados de S15/S23/S30/S31 (cenas de dialog) e os e2e do funil (`tests/e2e/frontend.e2e.spec.ts`).
- **Risco de acoplamento:** o header é o mesmo para os seis modelos; os primitivos em `src/components/ui/` são compartilhados por 13+ telas — a correção fica no ponto de uso do composer, nunca na primitiva.

## Dependências

- Nenhuma. Soft: `#1277` (fatiar o `CardComposer`) e S33/S34 tocam o mesmo arquivo — coordenar/rebase.

## Fora de escopo

- Mudar o drawer mobile.
- Mexer nas primitivas de UI (dialog/drawer).
- Redesenhar o header (hierarquia, tipografia, copy).
- Qualquer outra tela.

## Rabbit holes de produto

- **"Aproveitar e redesenhar o header".** Se alguém "só completar": vira redesign do compositor e do funil. **Corte neste item:** só a largura/posição já aprovadas.
- **"Corrigir a primitiva para todos".** Se alguém "só completar": 13+ telas mudam de comportamento sem pedido. **Corte neste item:** o ajuste fica no composer.

## Questões em aberto (produto)

- N/A — o alvo já está aprovado nos artefatos do gate; sem decisão nova.

## Referências

- Design UI (gate): `docs/plans/cards-header-modal-largura-ui-design.html`
- Artefatos aprovados (cenas de dialog): `cards-time-de-voce-ui-design.html`, `cards-estadual-dobradinha-ui-design.html`, `cards-colinha-ui-design.html`
- `src/components/cards/CardComposer.tsx`, `src/components/cards/CardsStudio.tsx`
- `tests/e2e/frontend.e2e.spec.ts`

## Self-score (shaping)

**5/5.**

- Um outcome verificável: header do modal na largura do card com × na borda, nada mais.
- Appetite declarado (~0,3–0,5 dia) e a intenção cabe nele — ajuste visual localizado.
- Persona, job e aceite em linguagem de produto, sem jargão de stack.
- Direção no codebase é hipótese (arquivos prováveis), não contrato técnico.
- Zero decisões duras de engenharia; o alvo visual já está aprovado no gate.
