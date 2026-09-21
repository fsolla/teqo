# Kit oficial da campanha Jorge Solla 1313

Ativos oficiais de marca, recebidos no kit "kit solla 1313" (2026-09-19) e
versionados aqui para o site, os reels e as peças da campanha. O manual de
marca completo está em [`docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`](../../docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf).

Origem externa: `/home/fsolla/Downloads/OneDrive_2026-09-19/kit solla 1313/PNGs/`
(os arquivos pesados do kit original — a foto em alta e o `.ai` do manual — não
são versionados).

## Paleta oficial (extraída dos próprios ativos)

| Cor    | Hex       | Uso |
| ------ | --------- | --- |
| Vermelho | `#e4102f` | fundo positivo, nome na marca positiva |
| Azul   | `#184e92` | "1313", "DEPUTADO FEDERAL", fundo do gradiente |
| Amarelo | `#ffeb00` | "1313" na marca negativa, destaques |
| Verde  | `#009647` | detalhe da bandeira na estrela (só dentro dos ativos) |

O laranja do manual (`#f89c0e`) só existe nas variações de paleta; não é usado
nos reels.

## Ativos e quando usar

### Marcas completas

- **`marca-negativa-completa.png`** — marca completa (nome + 1313 + slogan),
  branco/amarelo, para **fundos escuros/vermelhos** (hook, capa, CTA no topo
  vermelho).
- **`marca-positiva-completa.png`** — mesma marca em vermelho/azul, para
  **fundos claros** (card do CTA sobre creme).

### Lockups do nome

- **`jorge-solla-positivo.png`** — lockup do nome em vermelho/azul, para
  **fundos claros** (plate do chrome sobre o site capturado).
- **`jorge-solla-negativo.png`** — lockup do nome em branco, para fundos
  escuros.

### Número

- **`numero-positivo.png`** — "1313" em azul com o slogan em vermelho, quando o
  número for o protagonista em **fundos claros**.
- **`numero-negativo.png`** — "1313" em amarelo com o slogan em branco, quando o
  número for o protagonista em **fundos escuros/vermelhos**.

### Estrela

- **`estrela.png`** — a estrela oficial (roundel amarelo/verde com estrela
  vermelha). Usar a 100% sobre disco branco do mesmo diâmetro — nunca com
  opacidade reduzida, que mistura as cores com o fundo e suja o ativo.

### Ícones e pattern

Ícones soltos e um pattern da linguagem visual do kit, sem legenda de uso no
manual; as entradas abaixo descrevem a forma (uso a confirmar).

- **`bahia.png`** — silhueta do mapa da Bahia em branco recortada em quarto de
  círculo vermelho.
- **`coração.png`** — coração verde cortado por uma linha de pulso (ECG) branca.
- **`estrela-2.png`** — grade 2×2 de discos alternando amarelo liso e verde com
  estrela branca.
- **`pattern-shapes.png`** — pattern (faixa no topo de um canvas 2000×3000) com
  os ícones da marca — mapa da Bahia, punho, pulso, cruz, estrela e coração —
  em vermelho/azul/verde/amarelo sobre fundo transparente.
- **`punho.png`** — punho erguido branco sobre quarto de círculo azul.
- **`saude.png`** — cruz verde (ícone de saúde).
- **`saude-2.png`** — disco amarelo com linha de pulso branca (ícone de saúde —
  variação 2).

## Regras do manual

- A identidade combina **vermelho + azul** (histórico progressista + saúde
  pública) com detalhe **verde/amarelo** na estrela.
- O slogan **"Mais Saúde, Mais Futuro"** vive dentro das marcas completas —
  não é uma quarta mensagem nem headline solta.
- O nome e o número são os elementos de memorização: não recriar lockups
  tipográficos quando o ativo oficial existe.

## Rádio Jorge Solla 1313 (zeno.fm)

Artes da estação [`zeno.fm/radio/jorge-solla-1313`](https://zeno.fm/radio/jorge-solla-1313/),
geradas por [`scripts/build-radio-artes.mjs`](../../scripts/build-radio-artes.mjs)
a partir dos ativos deste kit e dos artboards de alta em `public/`. Os campos do
painel do zeno têm contratos diferentes — medidos na própria página da estação:

| Arquivo | Campo | Como o zeno exibe |
| --- | --- | --- |
| `radio/radio-jorge-solla-1313-logo.png` (1024², fundo branco opaco) | Logo | círculo pequeno (CDN entrega 152², `rounded-full`) — o desenho tem de ler dentro do círculo e em ~40 px |
| `radio/radio-jorge-solla-1313-capa.png` (2048×1024) | Cover Image | 2:1 no celular, 3:1 e 4:1 no desktop (`object-cover` central) → todo o conteúdo na **faixa segura central 2048×512**; a área do logo circular sobreposto no desktop (x 60..380, y ≥700) fica branca |
| `radio/radio-jorge-solla-1313-website-card.png` (1200×720) | Station Website Card | quadrado (`aspect-square`, corte central 720×720) → o conteúdo vive nesse quadrado |

- **Logo escolhida (2026-09-21):** o "O" do SOLLA da marca positiva em fundo
  branco — recorte do artboard `public/Prancheta 1@3x.png`, com a estrela vazada
  e o rastro verde/amarelo/azul. As finalistas (arquivo da decisão) ficam em
  `radio/finalistas/`: "1313" no vermelho, marca completa positiva no branco e o
  "O" branco no vermelho.
- **Capa:** `RÁDIO` (Brexter Bold) + marca vertical oficial (o "1313" embaixo do
  JORGE SOLLA, com o slogan) + o candidato à direita, em conjunto centralizado —
  ilustração (padrão) ou foto (`radio/capa-com-foto.png`, alternativa).
- **Ilustração em alta:** `radio/ilustracao-solla-1313.png` (769×1122, RGBA)
  parte da ilustração do card de foto de perfil
  (`cards/photo-portrait-frame.png`, recorte em x 100..355, y 840..1265),
  sobe 4× por IA (Real-ESRGAN ncnn-vulkan, modelo `realesrgan-x4plus-anime`) e
  perde o fundo por flood fill + abertura morfológica (a faixa do frame é
  `#b72031`, não a cor do kit). A receita completa está no cabeçalho do builder.
- **Regenerar:** `node scripts/build-radio-artes.mjs` — exige Brexter e Arimo no
  fontconfig local (instruções no cabeçalho do script). O builder revalida o
  contrato da capa e do card (faixa segura, área do logo do zeno, quadrado
  central) e falha fechado.
