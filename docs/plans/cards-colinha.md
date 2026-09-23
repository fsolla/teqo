# S31 — Minha colinha: o estadual escolhido na colinha de voto

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1272
Priority: P1
Impeccable: B — novo modelo no estúdio de cards existente com saída nova (colinha) e seletor de estadual
Design UI: docs/plans/cards-colinha-ui-design.html
Appetite: ~1–1,5 dia eng; um modelo novo e verificável no estúdio de cards existente
Responsável: —

## Intenção

O funil de cards (seção `#cards` da home + `/cards`) dá ao visitante cards para circular — nome, foto e "Time de você". Falta a peça que o cabo eleitoral leva para a rua: a **colinha de voto**, o papel com o número de cada cargo. O pedido do humano é auto-serviço: o visitante escolhe o estadual da mesma lista da dobradinha (S30) e recebe uma colinha 9:16 no modelo de referência, com a linha do estadual preenchida — nome de urna e os cinco dígitos, um por caixa — e as outras cinco escolhas fixas do voto.

A referência é uma arte vertical 1080×1920 de fundo branco: topo com o lockup "MAIS SAÚDE MAIS FUTURO", a foto do grupo e a faixa vermelha JORGE SOLLA · DEPUTADO FEDERAL · 1313 (com as marcas menores LULA 13, JERO 13, WAGNER 130, RUI 133); linha legal vertical na borda esquerda; corpo com uma linha por cargo (rótulo escuro em caixa alta, nome em vermelho, dígitos em caixas brancas contornadas de preto e um selo verde "CONFIRMA"). É um modelo novo do estúdio de cards, não uma superfície nova.

## Persona e fluxo

- **Persona / contexto:** militante/eleitor no celular, prestes a pedir voto na rua ou no grupo; quer a colinha certa do seu estadual, pronta para imprimir ou mandar.
- **Job principal:** sair com a colinha completa — o estadual que ele apoia preenchido no meio das escolhas fixas — sem instalar nada, sem cadastro e sem digitar.
- **Fluxo desejado:** home ou `/cards` → escolhe `Minha colinha` → escolhe o estadual na lista da dobradinha → vê a prévia com a linha preenchida → baixa o PNG 1080×1920.
- **Anti-goals de produto:** segundo editor/estúdio, rota ou página por colinha, coleta de nome/foto do visitante, editor de linhas, upload, CMS.

### Esboço de fluxo (B)

```text
[home/#cards ou /cards] → [modelo "Minha colinha"] → [seletor do estadual (lista da dobradinha)] → [prévia 9:16 com a linha preenchida] → [baixar PNG]
```

### Design UI (B)

- Design UI (gate): `docs/plans/cards-colinha-ui-design.html`
- Cenas: tile do modelo na galeria, seletor do estadual (busca e estado vazio), prévia completa 9:16 em desktop e mobile e o detalhe da linha preenchida (cinco dígitos nas cinco caixas + CONFIRMA).

## Objetivo e aceite

- O estúdio ganha o modelo `Minha colinha`; escolhido o estadual, a prévia mostra a linha do estadual preenchida (nome de urna + cinco dígitos, um por caixa) e as cinco linhas fixas intocadas; o PNG 1080×1920 (9:16) sai do mesmo estúdio dos cards atuais.
- 100% no aparelho: sem nome do visitante, sem foto, sem upload e sem análise de uso neste item (analytics é S32).
- O catálogo de estaduais é o de S30 (arte predefinida; slug, nome de urna e número): um estadual, uma linha; sem estadual escolhido não há prévia.
- Fidelidade ao modelo de referência: topo, linha legal vertical na borda esquerda e corpo de linhas seguem o desenho aprovado no gate.
- Escolha por toque e teclado, no idioma do seletor de S30; sem página/rota por colinha; a nota de privacidade existente permanece verdadeira.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — nenhum dado é apresentado; medir uso da colinha é S32.
- **Forma:** _adiada ao plano de implementação_ — o catálogo de estaduais é conteúdo (arte + número), não análise.

## Dados da decisão (literais)

- ID `S31`; tipo `feature`; Priority `P1`; Impeccable `B — novo modelo no estúdio de cards existente com saída nova (colinha) e seletor de estadual`; Design UI `docs/plans/cards-colinha-ui-design.html`; slug `cards-colinha` (arquivo `docs/plans/cards-colinha.md`).
- Model id `colinha`; label de galeria `Minha colinha`.
- Saída PNG 1080×1920 (9:16), seguindo o modelo de referência, baixada do mesmo estúdio; sem nome do visitante, sem foto, sem upload — 100% no aparelho.
- Linhas fixas (conteúdo do template, não digitação do visitante), cada uma com o selo verde `CONFIRMA`: `DEPUTADO FEDERAL Jorge Solla — 1313`; `SENADOR Jaques Wagner — 130`; `SENADOR Rui Costa — 133`; `GOVERNADOR Jerônimo — 13`; `PRESIDENTE Lula — 13`.
- Linha preenchida: `DEPUTADO ESTADUAL <nome de urna do estadual> — <5 dígitos>`, com os cinco dígitos dentro das cinco caixas, um por caixa; vem do catálogo compartilhado com S30.
- Modelo aprovado (arquivo exato entregue pelo humano, 2026-09-23): `docs/plans/cards-colinha-ui-design-assets/modelo-colinha.jpeg` (900×1600) — usar como referência canônica do layout (tile da galeria e conferência no gate); o preenchimento é o resultado (linha do estadual com nome de urna + 5 dígitos).
- Topo (arte-mestre) — **NEEDS ASSET**: lockup "MAIS SAÚDE MAIS FUTURO" + foto do grupo + faixa `JORGE SOLLA · DEPUTADO FEDERAL · 1313` com `LULA 13`, `JERO 13`, `WAGNER 130`, `RUI 133`; definida no design hi-fi e montada a partir do kit oficial (`public/campaign-kit/`, `public/cards/team-card-base.png`, `public/cards/team-card-front.png`).
- Linha legal vertical (borda esquerda): `FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL (PT-PC DO B - PV) | CNPJ CANDIDATO: 68.430.467/0001-05`.
- Catálogo compartilhado com S30: as 53 pastas de arte predefinida em `/home/fsolla/Downloads/DOBRADINHAS SITE-20260923T033020Z-1-001/DOBRADINHAS SITE/` (slug, nome de urna, número de 5 dígitos); dependência dura de S30 para o catálogo/assets commitados.
- Pipeline reaproveitado: `renderX → preview canvas → PNG download` — o mesmo motor único de prévia/export do estúdio.

## Direção no codebase (hipótese)

- **Áreas prováveis:** catálogo `src/lib/cardModels.ts`, roteiro/render `src/lib/cardRender.ts`, compositor `src/components/cards/CardComposer.tsx`, assets `public/cards/` e `public/campaign-kit/`.
- **Precedente a olhar:** S13/S14/S15 (`docs/plans/cards-personalizados-campanha-impl.md`, `docs/plans/cards-time-de-voce-impl.md`) e S30 (`docs/plans/cards-estadual-dobradinha.md`) — o seletor do estadual segue o idioma de escolha de S30.
- **Risco de acoplamento:** o `CardComposer` ramifica por `kind`; testes de unidade pinam os ids e o e2e falha em qualquer console error; a colinha não pode virar segundo editor nem mexer nos modelos existentes.

## Dependências

- S30 (`docs/plans/cards-estadual-dobradinha.md`) — catálogo e assets dos estaduais; dependência dura para o preenchimento da linha.
- NEEDS ASSET: arte-mestre do topo — definida no design hi-fi e construída a partir dos ativos oficiais (o pacote não existe no repo hoje).

## Fora de escopo

- Segundo editor/estúdio; rota ou página por colinha; CMS/coleção/migration.
- Nome do visitante ou "feito por você" (Questão 2); PDF A4/impressão em casa (Questão 1).
- Analytics de uso/abandono (S32); foto/recorte do visitante; upload ou processamento no servidor.
- Mudar o conteúdo das cinco linhas fixas; redesenhar os modelos existentes.

## Rabbit holes de produto

- **A colinha virar editor de voto.** Se alguém "só completar": reordenar/remover linhas e acrescentar cargos. **Corte neste item:** cinco linhas fixas + a linha do estadual.
- **A escolha do estadual virar "matching".** Se alguém "só completar": busca por município, perfil e recomendação. **Corte neste item:** uma lista no idioma de S30.
- **A arte do topo virar redesenho infinito.** Se alguém "só completar": recriar tipografia e foto em vez de usar o kit. **Corte neste item:** arte aprovada no gate a partir dos ativos oficiais.
- **Impressão/PDF no mesmo item.** Se alguém "só completar": entra diagramação A4 e margem de impressora. **Corte neste item:** só PNG 9:16; A4 vira item próprio se o produto pedir.

## Questões em aberto (produto)

- **Saída só 9:16 ou também PDF/A4 para imprimir?** **Opções:** A) PNG 1080×1920 9:16 (bate com a referência e com os stories) | B) também A4/impressão (escopo extra). **Recomendação:** A. _(assumido — validar com produto)_
- **A colinha leva o nome do visitante ou "feito por você"?** **Opções:** A) não (a colinha é o produto) | B) linha opcional com o nome (escopo extra). **Recomendação:** A. _(assumido — validar com produto)_
- **Onde o visitante escolhe o estadual?** **Opções:** A) mesmo idioma de seletor de S30 dentro do compositor | B) só um ponto de entrada próprio na galeria. **Recomendação:** A — um só fluxo, um só editor. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1272
- Design UI (gate): `docs/plans/cards-colinha-ui-design.html`
- `docs/plans/cards-estadual-dobradinha.md` (S30 — catálogo e assets compartilhados)
- `src/lib/cardModels.ts`, `src/lib/cardRender.ts`, `src/components/cards/CardComposer.tsx`, `tests/e2e/frontend.e2e.spec.ts`
- `public/campaign-kit/README.md`, `public/cards/team-card-base.png`, `public/cards/team-card-front.png`
- `/home/fsolla/Downloads/DOBRADINHAS SITE-20260923T033020Z-1-001/DOBRADINHAS SITE/` — referência externa do catálogo (53 pastas)

## Self-score (shaping)

**5/5.**

- Fatia = um outcome verificável (colinha baixável com a linha do estadual preenchida) e nada além.
- Appetite (~1–1,5 dia) declarado e a intenção cabe nele: um modelo novo em estúdio existente, sem fluxo novo.
- Persona, job e aceite em linguagem de produto; o anti-goal (editor de voto) está explícito.
- Direção no codebase é hipótese revisável; nenhuma signature, schema ou migration prescrita.
- Arte final, geometria e o seletor ficam para a implementação; o NEEDS ASSET é pendência de produto no gate.
