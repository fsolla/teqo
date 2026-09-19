# Card "Time de você": nomes longos cabendo no banner

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1195
Priority: P1
Impeccable: C — ajuste visual num funil público existente (não é superfície nova)
Design UI: docs/plans/cards-time-de-voce-nomes-longos-ui-design.html
Appetite: ~0,5–1 dia eng; nomes longos cabendo sem corte no banner do card
Responsável: —

## Intenção

O modelo "Time de você" (S15, #1161, no ar desde 2026-09-18) já tem o primeiro retorno de campo: nomes compostos não cabem. O verbatim da pessoa: "O card só permite hoje nomes com no máximo 7 letras, mas tem mais espaço no card. Deve mudar para permitir nomes maiores, podemos estender o espaço horizontal ocupado pela segunda linha do título. Ou mesmo diminuir um pouco a fonte da segunda linha para caber."

Medido no navegador com a fonte real (Brexter 700, cap ratio 0,72): hoje `GUSTAVO` (7) passa no cap 57; de 8 letras para cima tudo falha — `FERNANDA` para em 48, `GUILHERME` em 45, `JOÃO VITOR` em 44, `MARIA EDUARDA` em 30. A pessoa é mandada encurtar o nome, mas o banner azul tem folga visível dos dois lados. Esta entrega usa essa folga: o banner azul passa a se alargar só o necessário, podendo passar o banner vermelho e chegar perto da largura toda do card (decisão do humano no gate, 2026-09-19), e os limites de legibilidade são reposicionados, sem tocar no que o S15 mediu.

## Persona e fluxo

- **Persona / contexto:** militante no celular com nome composto (Maria Eduarda, João Vitor, Pedro Henrique) que hoje é obrigado a encurtar ou apelidar o próprio nome para gerar o card.
- **Job principal:** ver o nome inteiro no card, sem apelido forçado e sem corte.
- **Fluxo desejado:** abre `#cards` na home (ou `/cards`) → escolhe `Time de você` → digita o nome composto → vê o banner azul se alargar apenas o necessário e o nome inteiro em uma linha na prévia → baixa o PNG. Nenhum passo novo, nenhuma decisão nova.
- **Anti-goals de produto:** virar editor de texto/layout, permitir duas linhas no banner, mexer no banner vermelho ou na geometria medida do S15, regenerar a arte de exemplo, mexer no modelo de nome (S13) ou nos outros 3 modelos.

### Esboço de fluxo (C)

```text
[home/#cards ou /cards] → [Time de você] → [digita nome composto]
→ [banner azul alarga só o necessário até o teto] → [prévia com nome inteiro em 1 linha]
→ [fora do teto: mensagem de nome curto, como hoje] → [baixar PNG]
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-time-de-voce-nomes-longos-ui-design.html`
- Cenas: nome curto no banner de referência (509), nomes longos com banner alargado (até o teto de 1000) e nome que continua pedindo encurtamento, em desktop e mobile.
- `Design tier: DEGRADED` — o frontier `openai/gpt-5.6-sol` bateu quota; o artefato saiu do `designer-degraded` e **não certifica**: exige sign-off humano no gate/PR.

## Objetivo e aceite

- Nomes que DEVEM caber (aceite, medidos com a fonte real): MARIA EDUARDA (cap 62), PEDRO HENRIQUE (62), MARIA CLARA (73), ANA BEATRIZ (78), JOSÉ CARLOS (78), JOÃO VITOR (89), GUILHERME (94), FERNANDA (98), MARIA DA CONCEIÇÃO (47), FULANO e MARIA no cap ideal 130.
- O banner azul do nome deixa de ter largura fixa: mantém a referência 509 quando o nome cabe nela e alarga só o necessário até o teto de 1000 (≈40px de margem em cada lado do card) — pode ultrapassar o banner vermelho (693) como decidido no gate; centro, y, altura e rotação permanecem os do S15.
- O banner alargado nunca cruza o topo da janela da foto (y=439) nem as margens do card (para qualquer largura ≤1000, o canto mais baixo fica em ~436).
- Nome continua em uma linha, nunca quebra e nunca é cortado: fora do teto, a pessoa recebe a mesma mensagem de "nome muito longo" do modelo de nome — os absurdos pinados (BARTOLOMEUCOSTAJUNIOR e ANTICONSTITUCIONALISSIMAMENTE) seguem como `too-long`; como o teto subiu, `MARIA DA CONCEIÇÃO` passa a caber e o pin de unit correspondente muda (o nome de teste claramente fora passa a ser o absurdo mais longo).
- O banner vermelho "TIME DE", as cores e o restante da geometria medida do S15 ficam intocados; os outros 3 modelos do funil e o modelo de nome não mudam.
- A prévia de exemplo (`team-card-example.jpg`) é referência congelada e fica fora do escopo: não regenerar neste item.
- Um único editor, privacidade local e download por toque/teclado continuam como hoje.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — nenhuma métrica é apresentada; o ajuste é de layout/legibilidade, não desbloqueia decisão operacional por dado.
- **Forma:** _adiada ao plano de implementação_ — nome e imagem seguem insumos locais do card; nenhum conteúdo pessoal entra em analytics.

## Dados da decisão (literais)

- ID `S16`; slug `cards-time-de-voce-nomes-longos`; tipo `feature`; Priority `P1`; Impeccable `C — ajuste visual num funil público existente (não é superfície nova)`; Design UI: `docs/plans/cards-time-de-voce-nomes-longos-ui-design.html`.
- O banner azul deixa de ter largura fixa: mantém a largura de referência 509 quando o nome cabe nela e se alarga só o necessário, até o teto de 1000 (≈40px de margem em cada lado do card; pode ultrapassar o banner vermelho 693 — decidido no gate em 2026-09-19). Centro 545, y 313, altura 176 e rotação −4,1° inalterados.
- Tinta máxima disponível sobe de 470 para 961; cap mínimo legível desce de 56 para 40.
- Nomes que DEVEM caber (exemplos de aceite, medidos): MARIA DA CONCEIÇÃO (cap 47, banner ~991), MARIA EDUARDA/PEDRO HENRIQUE (cap 62), MARIA CLARA (73), ANA BEATRIZ/JOSÉ CARLOS (78), JOÃO VITOR (89), GUILHERME (94), FERNANDA (98), FULANO/MARIA no cap ideal 130.
- Nomes que continuam recebendo a mensagem de nome curto: os absurdos pinados (BARTOLOMEUCOSTAJUNIOR, cap 39; ANTICONSTITUCIONALISSIMAMENTE, cap 30) — nunca corte silencioso.
- Sem pin de modelo de execução (roda no modelo padrão da sessão; provider `openai` é reservado ao design).
- A prévia de exemplo do modelo (`team-card-example.jpg`, mostrada na galeria e no estado vazio) é uma referência congelada e fica FORA do escopo; não regenerar neste item.
- O banner alargado não pode cruzar o topo da janela da foto (y=439) nem as margens do card.
- Tudo o mais do S15 permanece literal: banner vermelho 693×118 (centro 545, 162, −3,5°), fill azul `#0061A5`, texto branco `#FFFFFF`, uma linha, sem quebra.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/cardModels.ts` (TEAM_CARD_NAME_BANNER/TEAM_CARD_NAME_SLOT), `src/lib/cardNameFit.ts`, `src/lib/cardRender.ts` (drawCardBanner/drawCardName/renderTeamCard), `src/components/cards/CardComposer.tsx`; testes `tests/unit/cardModels.unit.spec.ts`, `tests/unit/cardNameFit.unit.spec.ts`, `tests/unit/cardRender.unit.spec.ts`, e2e `tests/e2e/frontend.e2e.spec.ts` (describe Time de você; hoje pina um nome absurdo como too-long).
- **Precedente a olhar:** o próprio S15 (`docs/plans/cards-time-de-voce.md` e `-impl.md`) — a geometria medida e o fit de uma linha já estão lá.
- **Risco de acoplamento:** o fit é compartilhado com o modelo de nome (slot próprio, 714/48) — o ajuste deve ficar no slot do time, sem afrouxar o outro modelo; o e2e falha em qualquer console error. O unit de `cardNameFit` hoje pina `'Maria da Conceição'` e `'Bartolomeucostajunior'` como `too-long` — com o teto novo o primeiro passa a caber e o pin precisa ser reescrito (nome de teste claramente fora).

## Dependências

- S15 (#1161) entregue em 2026-09-18; sem outras dependências.

## Fora de escopo

- Duas linhas no banner ou auto-quebra de nome.
- Mudar o banner vermelho, as cores ou qualquer outra geometria medida do S15.
- Regenerar `team-card-example.jpg` ou qualquer arte-mestre.
- Mexer no modelo de nome (S13) e nos outros 3 modelos do funil.
- Editor de texto/layout, escolha manual de tamanho de fonte ou largura do banner.
- Métricas de uso, analytics de nome, ou qualquer persistência do nome.

## Rabbit holes de produto

- **Encolher a fonte até caber sempre.** Se alguém "só completar": nome gigante vira letra ilegível e o aceite de legibilidade morre. **Corte neste item:** cap mínimo 40; abaixo disso, mensagem de nome curto.
- **Fixar o banner no teto para todo mundo.** Se alguém "só completar": o card de quem tem nome curto deixa de parecer o exemplo do S15. **Corte neste item:** largura dinâmica com referência 509 e alargamento só quando necessário.
- **Cortar ou elidir o nome na marra.** Se alguém "só completar": entra corte silencioso no lugar da mensagem. **Corte neste item:** nunca cortar; fora do teto, pedir nome curto.
- **Regenerar o exemplo para "ficar coerente".** Se alguém "só completar": vira produção de arte não pedida. **Corte neste item:** exemplo congelado, fora do escopo.

## Questões em aberto (produto)

- **Teto de largura do banner azul?** **Decidido com o humano em 2026-09-19:** pode passar o vermelho e ir até quase a largura toda do card sem problema → teto de 1000 (≈40px de margem em cada lado), com o banner se alargando só o necessário.
- **Cap mínimo 40 ou 44?** **Decidido com o humano em 2026-09-19:** 40 — é o valor em que os nomes compostos longos cabem medidos.
- **Banner dinâmico ou fixo no teto?** **Decidido com o humano em 2026-09-19:** dinâmico — curto mantém a referência 509, longo alarga só o necessário até 1000.
- **A mensagem de nome curto muda?** **Decidido com o humano em 2026-09-19:** manter idêntica à do modelo de nome — mudar só o limiar, não o texto.

## Referências

- GitHub Issue #1195
- Design UI (gate): `docs/plans/cards-time-de-voce-nomes-longos-ui-design.html` (+ assets em `cards-time-de-voce-nomes-longos-ui-design-assets/`)
- `docs/plans/cards-time-de-voce.md` e `docs/plans/cards-time-de-voce-impl.md` — S15, geometria medida e fit
- `src/lib/cardModels.ts`, `src/lib/cardNameFit.ts`, `src/lib/cardRender.ts`, `src/components/cards/CardComposer.tsx`
- `tests/unit/cardModels.unit.spec.ts`, `tests/unit/cardNameFit.unit.spec.ts`, `tests/unit/cardRender.unit.spec.ts`, `tests/e2e/frontend.e2e.spec.ts` (describe Time de você)
- `AGENTS.md` — convenções do funil de cards e fontes commitadas
