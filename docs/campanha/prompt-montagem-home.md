# Prompt — Montar a home pública de campanha (Jorge Solla 1313)

> Use este prompt com um agente **poderoso (visão + raciocínio)** para montar a
> home pública da campanha a partir do rascunho Penpot e do wireframe HTML.
> Você tem acesso ao **MCP do Penpot** (já configurado) e pode ler imagens.

---

## 1. Contexto

Você vai construir a **página inicial pública de campanha** do Deputado Federal
**Jorge Solla (PT-BA)**, nº **1313**, para o domínio `jorgesolla1313.com.br`.
O app é o **Teqo** (Next.js + Payload), monorepo; a home vive em
`src/app/(frontend)/(home)/`. A home foi **zerada** (placeholder) — você vai
substituí-la. A rota `/artigos` já existe (feed de notícias movido da home
antiga) — **não mexa nela**.

## 2. Fontes de verdade (leia TODAS antes de codar)

1. **Rascunho Penpot (o SPEC visual)** — acesse via MCP do Penpot:
   - Team: `369311f5-bdaf-8185-8008-54047a2d029c`
   - File: `8694f143-a620-8054-8008-66e8aa584028`
   - Page: `62dfa60b-a5ec-8097-8008-7cc15cc939bd` ("Page 2")
   - Use `penpotUtils` (getPageById, shapeStructure, dump de geometria x/y/w/h,
     cores, fontes) para extrair o layout exato. Há 2 boards: **desktop
     1024×1954** e **mobile 393×2365**. Referências exportadas também em:
     `/home/fsolla/Downloads/Board(2).png` (desktop) e
     `/home/fsolla/Downloads/Board(1).png` (mobile).
2. **Wireframe HTML** (draft de conversão): `docs/campanha/wireframe-solla-1313.html`
3. **Plano geral** (decisões, pendências, regras): `docs/campanha/plano-site-campanha-2026.md`
4. **Voz do mandato**: skill `solla-comunicacao` (carregue antes de escrever).

## 3. Estado atual do repo (já pronto — REUSE, não recrie)

- **Fontes** já carregadas no layout do frontend: `--font-exo2` (Exo 2), `--font-arimo` (Arimo), `--font-sans` (Inter). Use via `font-[family-name:var(--font-exo2)]`.
- **Tokens** `campaign-site` já em `src/app/(frontend)/styles.css`:
  `--pt-red:#a21c1c`, `--pt-red-dark:#47130e`, `--pt-yellow:#ffe607`,
  `--pt-yellow-ink:#000`, `--campaign-cream:#fff8f2`, `--campaign-ink:#000`,
  `--campaign-muted`, `--campaign-surface:#f9faff`, `--campaign-band:#ebe9e9`.
  Aplicados via `data-theme="campaign-site"` no layout da home.
- **Assets** em `public/` (.avif): `JOA00162.avif` (foto hero), `fundo.avif`,
  `53569851134_02afc18fb4_o.avif`, `52396285023_561ffc0ff6_o.avif` (cards),
  `Lula.avif`, `Jeronimo.avif`, `WAGNER%20-%202-9%20final.avif`,
  `RUI%20-%202-2.avif` (aliados), `LOGO_SOLLA_BRANCO.svg` (logo branca).
- **Componente** `src/components/CampaignFooter.tsx` (rodapé do wireframe, CNPJ
  68.430.467/0001-05 já aplicado) — pode usar ou refazer.
- Layout atual da home: `src/app/(frontend)/(home)/layout.tsx` (container de
  scroll + data-theme) — ajuste se precisar.

## 4. O que montar (as 4 seções do Penpot + rodapé)

### 4.1 Hero

- Fundo vermelho `#a21c1c`. **Sem header separado** — a logo branca vive DENTRO
  do hero (topo esquerdo). **Sem barra fixa**.
- Desktop: **foto à esquerda** (retrato JOA00162) + **colagem de 4 aliados**
  (Lula, Jerônimo, Wagner, Rui) + **texto à direita ALINHADO À DIREITA**.
- Mobile: foto em cima, texto centralizado embaixo.
- H1: `UM MANDATO DO TAMANHO DA BAHIA` (caixa alta, Exo 2, branco).
- Sub: `Médico sanitarista. Criou o SAMU 192 e o Brasil Sorridente. Já comandou a saúde em Vitória da Conquista, na Bahia e no Brasil — e leva o mandato aos 417 municípios, da saúde à educação.`
- Botões: `Conhecer bandeiras` (contorno branco) + `Quero apoiar` (amarelo
  `#ffe607`, texto preto) → **https://apoiar.me/jorgesolla** (vaquinha, CTA primário).
- Micro-provas: `DIAP entre os 40 melhores da Câmara` · `Mais votado do PT-BA em 2022`.

### 4.2 Prova social

- 3 números grandes centralizados, vermelho: `3.333 proposições apresentadas`,
  `1.031 discursos em Plenário`, `3º mandato de deputado federal`.

### 4.3 O problema

- Fundo `#47130e`. Eyebrow amarelo `POR QUE ESSA ELEIÇÃO IMPORTA`.
- H2: `Eleger deputado é coisa séria` / `O Congresso tem nas mãos vidas reais e o SUS` (2ª linha amarela).
- Lead: `É no Congresso que se define o orçamento do SUS, o piso da enfermagem, a recompra de Mataripe e o fim da escala 6×1. Reeleger Lula não basta: é preciso eleger uma bancada aliada.`
- 3 cards **em CARROSSEL** (auto-advance a cada ~4s, pausa no hover/touch;
  swipe no mobile). Cada card: foto no topo + texto branco sobreposto embaixo,
  cantos arredondados. O carrossel mostra UM card por vez (mobile) e pode
  mostrar mais de um no desktop se couber — mas o auto-advance e o indicador
  ativo valem para todos. Navegação: setas opcionais + indicadores (bolinhas)
  se fizer sentido visualmente; o essencial é o auto-advance:
  1. `Pelo fim da escala 6x1!` / foto `fundo.avif` / `Jornadas longas aumentam o risco de AVC e infarto. Descanso é saúde pública. A bancada de Lula derrotou a direita na Câmara: o fim da 6×1 avançou. Mas a briga continua no Senado, onde a direita tenta barrar o avanço. No dia 4 de outubro, o 1313 é o seu sim ao descanso.`
  2. `Pra valorizar o SUS` / foto `53569851134_02afc18fb4_o.avif` / `O SUS é o sistema de saúde de todo brasileiro. Com Lula, a saúde voltou a receber recursos: Nova PAC de R$ 30,5 bilhões e Mais Médicos retomado. Mas o teto de gastos da direita ainda trava o orçamento. O 1313 é seu voto em defesa do SUS no Congresso!`
  3. `Pra defender os baianos` / foto `52396285023_561ffc0ff6_o.avif` / `A Refinaria de Mataripe foi vendida no governo Bolsonaro e segue nas mãos de estrangeiros. Com Lula e Jerônimo, a Bahia voltou a andar pra frente; mas recomprar Mataripe exige bancada forte no Congresso. Votar 1313 é devolver à Bahia o que é seu.`

### 4.4 Bandeiras

- Fundo `#ebe9e9`. Eyebrow vermelho `NOSSA CAMINHADA`.
- H2: `Junto com o trabalhador e do lado de quem mais precisa, sempre.`
- Lead: `Não é promessa de palanque, é a experiência de quem já fez na gestão do SUS, do Ministério da Saúde e da saúde da Bahia.`
- **CARROSSEL de 6 cards** (auto-advance a cada ~4s, pausa no hover/touch,
  swipe no mobile) + **fileira de chips (as 6 tags) ACIMA dos cards** — o chip
  do card ATIVO fica DESTACADO (1ª vermelha `#a21c1c`; demais cinza
  `#dbdce0`), e o destaque acompanha o card visível no carrossel (sincronizado;
  clicar num chip leva ao card correspondente). Cards brancos `#f9faff`
  (1 por vez no mobile; no desktop pode mostrar mais de um), título + corpo
  (Arimo):
  1. `Defender o SUS e valorizar quem cuida` / `Saúde é direito, não mercadoria. Fim do subfinanciamento, piso da enfermagem e dos agentes pagos, concursos públicos, vacinação e ciência.`
  2. `Fim da escala 6×1 e jornada de 40h` / `Sem redução de salário. Jornada longa é questão de saúde pública: quem trabalha demais adoece. O SUS paga a conta.`
  3. `Educação em tempo integral e federais no interior` / `IFs, campus federal, escola de tempo integral: o interior não pode ficar para trás no conhecimento.`
  4. `Recomprar a Refinaria de Mataripe` / `Recomprar a refinaria é defender a Bahia e a soberania do Brasil. Preço justo de combustível é política de saúde e de renda.`
  5. `Salário mínimo forte, emprego e moradia` / `Valorização do mínimo, Bolsa Família, Minha Casa Minha Vida e agricultura familiar como motor do interior.`
  6. `Defesa intransigente da democracia` / `Participação popular, instituições fortes e combate à desinformação. Eleger o parlamento é coisa séria.`

### 4.5 Rodapé

- Use o `CampaignFooter` existente ou o rodapé do wireframe: identificação
  eleitoral (nome, nº 1313, Federação PT/PCdoB/PV, **CNPJ 68.430.467/0001-05**,
  eleições 04/10/2026), navegação, redes.

## 5. Decisões e regras (não negocie)

- **Um CTA primário** por tela (Quero apoiar → apoiar.me/jorgesolla). Doação
  nunca é processada no app.
- **Carrosséis**: as seções "O problema" e "Bandeiras" usam carrossel com
  **auto-advance** (timer ~4s), pausa no hover/touch, swipe no mobile e
  sincronização com os indicadores/chips. Componente client ("use client").
- **Mobile-first**; alvos de toque ≥44px; inputs ≥16px (quando houver).
- **Tipografia**: Exo 2 (display: H1, CTAs, números, eyebrows), Inter (corpo,
  sub, micro-provas), Arimo (títulos/textos dos cards, tags em caixa alta).
- **Copy**: use EXATAMENTE os textos acima (do Penpot). Correções já feitas:
  "mandato" (não "madato"), "O Congresso" (maiúsculo). Mantenha "pra frente",
  "Pra valorizar o SUS", "Pra defender os baianos" (escolhas do cliente).
- **Uniformize** espaçamentos/cores (escala única); não precisa replicar cada
  pixel do Penpot, mas a COMPOSIÇÃO (foto esq + texto dir, seções, cards,
  chips) deve casar.
- **Sem fonte, não publica**: não invente números/obras. Tudo acima é verificado.
- **Convenções Teqo**: identificadores em inglês, textos visíveis em pt-BR.
- Não criar coleções/rotas paralelas; não mexer em `/artigos`.

## 6. Como validar (obrigatório antes de entregar)

1. Extraia a geometria do Penpot via MCP e confira sua implementação contra ela
   (posições, alinhamentos, cores, fontes).
2. Suba `pnpm dev`, capture screenshots (desktop 1024 e mobile 393) **por seção**
   (elemento, não fullPage — o fullPage trunca por causa do scroll aninhado).
3. Use os subagentes `design-vision` / `design-vision-fidelidade` para conferir
   a implementação contra as referências `/home/fsolla/Downloads/Board(1|2).png`.
   Confira também o **comportamento dos carrosséis** (auto-advance, chip ativo
   sincronizado) com o Playwright (aguarde o timer avançar e valide o estado).
4. Rode: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm format:check`, `pnpm build`.
5. Entregue um resumo: o que foi construído, como ficou vs. o Penpot, e o que
   ficou pendente (assets/fontes/ajustes).

## 7. Entregável

- Home em `src/app/(frontend)/(home)/page.tsx` (+ layout/componentes se precisar),
  fiel ao Penpot, validada (build OK), com os 4 seções + rodapé.
- Resumo curto do que foi feito e das pendências.
