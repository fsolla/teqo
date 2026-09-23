# S30 — Card personalizado com o seu estadual (dobradinha)

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1271
Priority: P1
Impeccable: B — encaixe no estúdio de cards existente (novo modelo + seletor de estadual no composer)
Design UI: docs/plans/cards-estadual-dobradinha-ui-design.html
Appetite: ~1–1,5 dia eng; o quinto modelo do estúdio entregue no mesmo fluxo, com a arte oficial do estadual
Responsável: —

## Intenção

O funil de cards do site já tem o "Time de você" (S15, #1161): o visitante digita o nome e a própria foto recortada entra no card `TIME DE <NOME>`, no aparelho, sem upload. Agora a campanha fechou dobradinhas com 53 estaduais e já mandou a arte pronta de cada um — o grupo com o estadual e a faixa com o lockup nome+número ao lado do Jorge Solla 1313 (ex.: `JULIO` = "JULIO PINHEIRO · DEPUTADO ESTADUAL · 13999").

O card novo é o mesmo "Time de você" com o seu estadual dentro: o visitante escolhe o estadual, digita o nome e manda a própria foto — o recorte entra na janela, em primeiro plano, como hoje, e o estadual aparece ao lado (a arte oficial do escolhido vira o fundo e a faixa do card). A referência aprovada pelo humano (2026-09-23) é exatamente isso: `TIME DE FULANO` com a silhueta do visitante no centro e o estadual ao lado. A arte já existe (53 pastas, dois PNGs 1080×1440 por estadual, ~90 MB de originais) e o repo recebe só derivativos otimizados; é um modelo novo ao lado dos quatro atuais, no mesmo estúdio.

## Persona e fluxo

- **Persona / contexto:** apoiador/militante no celular com um estadual de referência (a dobradinha do seu território), querendo um card para circular no WhatsApp sem montar nada.
- **Job principal:** escolher o seu estadual e sair com o card `TIME DE <NOME>` com a arte oficial dele, a partir da própria foto, sem cadastro e sem nenhum byte saindo do aparelho.
- **Fluxo desejado:** abre `#cards` na home (ou `/cards`) → escolhe `Time do estadual` → escolhe o estadual na lista dos 53 → digita o nome → manda a foto de busto → vê o recorte acontecer no aparelho e a prévia com o estadual ao lado → baixa o PNG.
- **Anti-goals de produto:** segundo cadastro de pessoas, ranking/placar de estaduais, página por estadual, controles novos além dos que o "Time de você" já tem, analytics, conta, persistência.

### Design UI (B)

- Design UI (gate): `docs/plans/cards-estadual-dobradinha-ui-design.html` — cenas: tile do quinto modelo na galeria, seletor dos 53 estaduais (mobile/desktop), prévia pronta com a banda do estadual e resultado baixado; o hi-fi é a fonte iterável do aceite visual até o gate.

## Objetivo e aceite

- O estúdio ganha o quinto modelo, `Time do estadual`, ao lado dos quatro atuais — mesmo editor, mesmas rotas (`#cards`, `/cards`, `?model=`).
- Escolhido o estadual, digitado o nome e enviada a foto, o card final é o "Time de você" com a arte do estadual: o recorte do visitante entra na janela em primeiro plano, o estadual aparece ao lado e a banda leva o lockup nome+número dele — exatamente a referência aprovada (silhueta do visitante + `TIME DE FULANO` + estadual).
- O fluxo de foto é o do S15 inteiro (envio, recorte no aparelho com progresso/retry, harmonização, arrasto/zoom como escape); nenhum controle novo nasce aqui.
- A lista dos 53 estaduais é navegável por toque e teclado no celular; trocar de estadual não perde o nome nem a foto já processada.
- Nome em uma linha com a máquina do S16 (banner azul dinâmico via `fitCardName`): fora do cap mínimo legível, a pessoa é pedida a usar um nome mais curto — nunca corte silencioso.
- Os derivativos otimizados das 53 artes ficam commitados em `public/cards/` (originais fora do repo); nome completo e número vêm do catálogo derivado da arte, não da base.
- 100% no aparelho: sem conta, sem PII, sem upload; a nota de privacidade do estúdio continua verdadeira e os quatro modelos existentes (e suas artes) ficam intocados.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas / forma:** N/A — nenhuma métrica é apresentada e a escolha do estadual não vira relatório; o catálogo dos 53 é conteúdo estático derivado da arte (_adiado ao plano de implementação_), e leitura de uso fica para S32.

## Dados da decisão (literais)

- ID `S30`; slug `cards-estadual-dobradinha` (arquivo `docs/plans/cards-estadual-dobradinha.md`); tipo `feature`; Priority `P1`; Impeccable `B — encaixe no estúdio de cards existente (novo modelo + seletor de estadual no composer)`; Design UI `docs/plans/cards-estadual-dobradinha-ui-design.html`.
- Model id `time-do-estadual`; label de galeria `Time do estadual`; kind: variante de time personalizada pelo nome.
- Composição do card (ordem do S15, com a arte do estadual por baixo): FOTOS do estadual (grupo com o estadual na janela) → foto recortada do visitante na janela em primeiro plano (x=286, y=439, largura=592, altura=577) → BASE do estadual (banda/overlay frontal, transparente no topo) → banners `TIME DE` + nome. O visitante **mantém** o fluxo de foto do S15 (envio, recorte no aparelho, harmonização, arrasto/zoom); o estadual aparece ao lado/atrás do recorte.
- A banda/overlay frontal carrega o lockup nome+número do estadual ao lado do Jorge Solla 1313, no desenho de `public/cards/team-card-front.png`; exemplo literal: `JULIO` = "JULIO PINHEIRO · DEPUTADO ESTADUAL · 13999".
- Arte do modelo no carrossel (decisão do humano, 2026-09-23): **o arquivo exato entregue pelo humano** — `docs/plans/cards-estadual-dobradinha-ui-design-assets/modelo-time-de-voce-com-estadual.jpeg` (1080×1440, "modelo-time-de-voce-com-estadual.jpeg"): `TIME DE FULANO` com a **silhueta do visitante no centro** sobre a arte do estadual de exemplo (JULIO: FOTOS + faixa). Usar esse arquivo como está (tile da galeria e placeholder do modelo no composer); não recriar nem substituir por outra arte. A arte de exemplo é uma só para o modelo (JULIO como estadual ilustrativo) e não muda a regra do card final (arte do estadual escolhido); na implementação, as artes de exemplo por estadual seguem essa mesma receita (FOTOS + silhueta + BASE).
- Catálogo exatamente as 53 pastas de `/home/fsolla/Downloads/DOBRADINHAS SITE-20260923T033020Z-1-001/DOBRADINHAS SITE/`: ADRIANA, ANDRE, ANDREA, ANGELO, ARTHUR, BOBO, CAROL, CICERO, DENISE, ELANE, EUCLIDES, FABIOLA, FATIMA, FELIPE, GEANE, HILTON, IVANA, JACO, JAMILLE, JOSAFA, JULIETE, JULIO, JUNIOR, KLEBER, LENINHA, LEO, LUDMILLA, MAGNO, MARCOS, MARLENE, MESTRE, NEUSA, NILTINHO, OSNI, PABLO, PATRICK, PINHEIRO, RADIOVALDO, ROBERTO, ROBINSON, ROGERIO, ROSEMBERG, ROSIVAL, ROWENNA, SILVA, SILVIO, THIAGO, VILMA, VITOR, WELLIGTON, WENCESLAU, YULO, ZE RAIMUNDO.
- Nome completo + número de urna vêm dos lockups da arte: a base da campanha não tem campo de número de candidato nem números de 2026 (`src/collections/StateDeputy.ts` só tem `ballotName`/`party`).
- O catálogo é commitado como tabela derivada e imutável (precedente: `src/lib/municipalityCatalog.ts` + snapshot test), com, por estadual: slug, nome de exibição/legenda, número de 5 dígitos e os dois caminhos de asset commitados.
- Assets commitados em `public/cards/` como derivativos otimizados; origem acima; os PNGs originais (~90 MB) não entram no repo.
- A máquina de banners existente é reusada: `TEAM_CARD_LABEL` ("TIME DE") + banner azul dinâmico via `fitCardName` (comportamento de nome longo do S16 intocado); o modelo não tem controles de recorte/harmonia.
- 100% no aparelho; nada do visitante sai do celular; sem conta, sem PII.

## Direção no codebase (hipótese)

- **Áreas prováveis:** catálogo `src/lib/cardModels.ts` (variante de time), tabela estática dos 53 num módulo de `src/lib/` (padrão do `municipalityCatalog`), render `src/lib/cardRender.ts`, seletor no `src/components/cards/CardComposer.tsx`, derivativos em `public/cards/`.
- **Precedente a olhar:** S15/S16 (`docs/plans/cards-time-de-voce.md`, `cards-time-de-voce-nomes-longos.md`); `src/lib/municipalityCatalog.ts` + `tests/fixtures/municipality-catalog.snapshot.json` para a tabela imutável.
- **Risco de acoplamento:** o composer ramifica por `kind` e a esteira de recorte é a do time; o novo modelo reusa essa esteira sem alterá-la e não pode tocar nos quatro existentes; o e2e falha em qualquer console error.

## Dependências

- S15 (#1161), S16 (#1195) e S17 (#1196) entregues — o fluxo de foto/recorte, a máquina do banner e a harmonização que este modelo reusa inteiros.
- Assets dos 53 estaduais entregues pela campanha no caminho de origem (acima); derivar e otimizar é parte desta entrega.
- S31 (`docs/plans/cards-colinha.md`) reusa o mesmo catálogo/artes — soft; S32 (analytics) soma model ids — soft.

## Fora de escopo

- CMS/collection/migration para o roster dos estaduais — catálogo estático, commitado no código.
- Segundo editor: mesmo estúdio/composer, mesmas rotas (`#cards`, `/cards`, `?model=`).
- Página ou rota por estadual; ranking/"força"; qualquer métrica ou analytics (isso é S32).
- Segundo cadastro de pessoas; ler `stateDeputy`/`Contact` para montar o card.
- Controle novo de foto/recorte além do que o "Time de você" já entrega.
- Mexer nos quatro modelos existentes; regenerar ou redesenhar arte.
- Compartilhamento direto em redes sociais.

## Rabbit holes de produto

- **O roster virar CMS com número de 2026.** Se alguém "só completar": collection nova, migration e cadastro de 53 pessoas, com os números divergindo da arte. **Corte neste item:** tabela estática derivada dos lockups, com snapshot test; a base não tem número e não ganha um aqui.
- **A lista virar ranking/"força".** Se alguém "só completar": ordenação por votos, placar por estadual, destaque de "prioridade". **Corte neste item:** lista simples em ordem estável, sem métrica.
- **O card virar o card do estadual.** Se alguém "só completar": o banner azul passa a estampar o nome do estadual e o visitante perde o que digitar. **Corte neste item:** banner do visitante (`TIME DE <nome>`); nome/número do estadual só na banda.
- **Reposicionar a arte por estadual.** Se alguém "só completar": medir cada uma das 53 artes e mover a janela por estadual. **Corte neste item:** a janela é a do S15 (286/439/592/577) para todas; as artes já foram feitas nessa régua.

## Questões em aberto (produto)

- **O banner `TIME DE <nome>` mostra o nome de quem?** **Opções:** A) o nome digitado pelo visitante (a referência mostra `FULANO`, o visitante) | B) o nome de urna do estadual (zero digitação; o card vira o card do time do estadual). **Recomendação:** A — a referência aprovada é a silhueta do visitante com `TIME DE FULANO`; o nome do estadual já vive na banda. _(assumido — validar com produto)_
- **`time-do-estadual` / "Time do estadual" está bom?** **Opções:** confirmar o id e o label. **Recomendação:** manter os dois como literais. _(assumido — validar com produto)_

## Referências

- `src/lib/cardModels.ts`, `src/lib/cardRender.ts`, `src/components/cards/CardComposer.tsx`, `tests/e2e/frontend.e2e.spec.ts`
- `src/lib/municipalityCatalog.ts` — precedente de catálogo derivado e imutável (com snapshot test)
- `docs/plans/cards-time-de-voce.md`, `docs/plans/cards-time-de-voce-nomes-longos.md` — o fluxo e a máquina do banner
- `public/cards/team-card-front.png` — desenho da banda/overlay frontal
- `src/collections/StateDeputy.ts` — o que a base (não) tem de número de urna
- Design UI (gate): `docs/plans/cards-estadual-dobradinha-ui-design.html` (+ assets em `cards-estadual-dobradinha-ui-design-assets/`)
- Origem da arte: `/home/fsolla/Downloads/DOBRADINHAS SITE-20260923T033020Z-1-001/DOBRADINHAS SITE/`

## Self-score (shaping)

5/5 — um outcome verificável, appetite declarado e nenhuma decisão dura de engenharia.

- Fatia = um outcome verificável: quinto modelo no estúdio existente, sem tocar nos quatro atuais.
- Appetite ~1–1,5 dia cabe: catálogo derivado + assets otimizados + seletor no composer, sem fluxo novo.
- Persona + job + aceite claros, em linguagem de produto, sem jargão de stack.
- Direção no codebase é hipótese: arquivos citados como pista, nenhum nome novo cravado.
- Zero schema/migration/signature no plano; literais são só de produto, arte e copy.
