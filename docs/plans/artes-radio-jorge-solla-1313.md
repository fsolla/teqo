# Artes da Rádio Jorge Solla 1313 (zeno.fm) — logo, capa e website card

Status: entregue (2026-09-21)
Atualizado em: 2026-09-21 — as-built: ativos versionados em `public/campaign-kit/radio/` (logo, capa, website card, ilustração em alta e as três logos finalistas), gerados por `scripts/build-radio-artes.mjs`; mapa de uso no `public/campaign-kit/README.md`.
Issue: #1241 (C208) · Design UI: N/A — peças estáticas aprovadas pelo humano no fluxo (não é superfície de app)
Impeccable: A — assets e builder; nenhuma UI do app tocada
Appetite: ~0,5 dia eng; 3 ativos + finalistas + builder; sem migration
Responsável: —

## Intenção

A estação [`Rádio Jorge Solla 1313`](https://zeno.fm/radio/jorge-solla-1313/) no
zeno.fm estava com os três campos de imagem ocupados pela arte da **carreata**
(eventual). O humano pediu artes **gerais** da rádio — logo, capa e station
website card — para o painel do zeno, com a marca oficial do kit 1313, e depois
decidiu o sistema visual em conversa: a **logo escolhida é o "O" do SOLLA**
(letra oficial com a estrela vazada e o rastro verde/amarelo/azul) em fundo
branco; a capa usa a marca vertical ("1313" embaixo do "JORGE SOLLA", com o
slogan) centrada com o candidato à direita; o card segue o mesmo fundo branco.
Esta entrega **registra** no repo os ativos aprovados, as logos finalistas, a
ilustração do candidato em alta e o builder que os reproduz.

## Persona e fluxo

- **Persona / contexto:** quem opera a estação no painel do zeno (comunicação) e
  quem produz peças da campanha (agentes de design, reels, dossiês).
- **Job principal:** achar o ativo oficial certo e saber o contrato de cada
  campo do zeno (corte circular do logo, faixa segura da capa, corte quadrado do
  card) sem adivinhar.
- **Fluxo desejado:** abre o README do kit → acha a seção da rádio → pega o
  arquivo do campo → sobe no painel. Se precisar mudar, roda o builder.

## Contrato do zeno (medido na página da estação)

| Campo                | Arquivo                                                             | Como o zeno exibe                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo                 | `radio/radio-jorge-solla-1313-logo.png` (1024², fundo branco opaco) | círculo pequeno (CDN entrega 152², `rounded-full`); o desenho tem de ler dentro do círculo e em ~40 px                                                                                                     |
| Cover Image          | `radio/radio-jorge-solla-1313-capa.png` (2048×1024)                 | 2:1 no celular, 3:1 e 4:1 no desktop (`object-cover` central) → todo o conteúdo na **faixa segura central 2048×512**; o logo circular sobreposto no desktop (x 60..380, y ≥700) tem de achar a área branca |
| Station Website Card | `radio/radio-jorge-solla-1313-website-card.png` (1200×720)          | quadrado (`aspect-square`, corte central 720×720) → o conteúdo vive nesse quadrado                                                                                                                         |

- Limites de arquivo: logo ≥500² e ≤5 MB; capa ≥2048×1024 e ≤5 MB; card ≥500×300
  e ≤500 KB. Todos os três ficam muito abaixo (69 KB / 325 KB / 64 KB).
- O builder **revalida** os contratos (faixa segura, área do logo do zeno e
  quadrado central do card) e falha fechado se algo sair do lugar.

## Decisões (2026-09-21)

- **Logo:** o "O" do SOLLA da marca positiva em fundo branco — recorte do
  artboard oficial `public/Prancheta 1@3x.png` (mesma paleta do kit:
  `#e4102f`/`#184e92`/`#009647`/`#ffeb00` conferidos), em PNG opaco para a
  estrela continuar branca sobre qualquer fundo. Finalistas arquivadas em
  `radio/finalistas/`: "1313" no vermelho (`numero-negativo`), marca completa
  positiva no branco e o "O" branco no vermelho.
- **Capa:** `RÁDIO` (Brexter Bold, vermelho) + marca vertical + candidato à
  direita, em conjunto centralizado; a ilustração (padrão) e a foto
  (`capa-com-foto.png`) entram inteiras na faixa segura (y 262..762).
- **Sem repetir símbolo:** onde o "JORGE SOLLA" estilizado já está, não entra o
  "O" como badge — a estrela já vive dentro do próprio lockup.
- **Ilustração em alta:** a do card de foto de perfil
  (`public/cards/photo-portrait-frame.png`) só existia a ~255 px; virou
  769×1122 por recorte + 4× por IA (Real-ESRGAN ncnn-vulkan, modelo
  `realesrgan-x4plus-anime`) + remoção de fundo por flood fill + abertura
  morfológica (a faixa do frame é `#b72031`, não a cor do kit). Receita no
  cabeçalho do builder; a ilustração final é entrada versionada.

## Objetivo e aceite

- `public/campaign-kit/radio/` com logo, capa, website card, `capa-com-foto.png`
  (alternativa) e `ilustracao-solla-1313.png` (alta, RGBA), mais as três
  finalistas em `radio/finalistas/`.
- `public/campaign-kit/README.md` com a seção da rádio (mapa de uso + contrato
  dos campos + como regenerar) — a marca continua com dono único.
- `scripts/build-radio-artes.mjs` reproduz o conjunto a partir dos ativos do kit
  e falha fechado fora do contrato; depende de Brexter e Arimo instalados no
  fontconfig local (instruções no cabeçalho).
- ONE entrada em `docs/changelog/2026-09-21-c208.md`.

## Fora de escopo

- Trocar a arte no painel do zeno (é upload humano; a entrega é o arquivo).
- Player próprio da rádio na home (S25, Issue #1239) e qualquer UI do app.
- Redesenhar os ativos oficiais do kit ou o card de foto de perfil.
- Versionar os intermediários do upscale por IA (o `.4x` fica local; reprodutível
  pelo comando documentado).

## Rabbit holes

- **Segundo mapa de uso da marca.** A seção da rádio descreve o contrato dos
  campos; as regras de marca continuam só no README do kit + manual. **Corte:**
  sem recópia de paleta/regra.
- **Segunda fonte da ilustração.** Guardar o `.4x` gigante no repo para "não
  precisar da IA". **Corte:** a entrada é o PNG final; a receita é o comando.
- **Arte por campo com nomes próprios.** **Corte:** nomes espelham o campo do
  zeno (`logo`, `capa`, `website-card`), sem sinônimos.

## Referências

- GitHub Issue: #1241 (C208)
- `public/campaign-kit/README.md` (mapa de uso; dona da marca) e
  `docs/campaign-kit/manual-campanha-jorge-solla-1313.pdf`
- `scripts/build-radio-artes.mjs` (builder + receita da ilustração)
- S21/S22/S24 (`docs/plans/jingles-*.md`, `docs/plans/radio-embed-direto.md`) —
  a rádio no site; aqui é a identidade da estação fora do site
