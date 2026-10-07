# Ativos do reel "Sua colinha para 2026" (colinha-time-1313)

Fotos oficiais recortadas e o selo da estrela usados pelo builder
[`scripts/build-colinha-reel.mjs`](../../../build-colinha-reel.mjs) — o reel de
chat que monta a colinha do time 1313 na ordem da urna. Os derivativos são
commitados (o reel é reprodutível a partir deles); as origens pesadas ficam fora
do repo.

| Arquivo                   | Origem                                                                                                                                                                                                                                            | Receita                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `solla.webp`              | `FOTO SOLLA CAMISA BRANCA.png` (kit oficial, `OneDrive_2026-09-19/kit solla 1313/`)                                                                                                                                                               | `trim` + altura 1000 px + webp q88                                                                       |
| `julio.webp`              | `DOBRADINHAS-ORGANIZADAS/Júlio Pinheiro/foto.png` (extração oficial da campanha; `FONTES.txt` da pasta documenta a camada do adesivo)                                                                                                             | idem                                                                                                     |
| `wagner.webp`             | `public/WAGNER - 2-9 final.webp` (site)                                                                                                                                                                                                           | idem                                                                                                     |
| `rui.webp`                | `public/RUI - 2-2.webp` (site)                                                                                                                                                                                                                    | idem                                                                                                     |
| `jeronimo.webp`           | `public/Jeronimo.webp` (site)                                                                                                                                                                                                                     | idem                                                                                                     |
| `lula.webp`               | `public/Lula.webp` (site)                                                                                                                                                                                                                         | idem                                                                                                     |
| `logo-o.webp`             | `public/campaign-kit/radio/radio-jorge-solla-1313-logo.png` (kit oficial — a logo "O" da rádio, usada no avatar do header)                                                                                                                        | `trim` + 256 px + webp q90                                                                               |
| `sfx-confirma.mp3`        | o "confirma" da urna eletrônica (som do TSE), extraído de uma gravação pública do efeito (YouTube `SALMI6_CSYk`): trecho 2,98–3,98 s (a sequência rápida de bipes após a tecla verde), high-pass 350 Hz / low-pass 9 kHz, mono, loudness −15 LUFS | `ffmpeg -ss 2.98 -t 1.00 -af "highpass=f=350,lowpass=f=9000" -ac 1 -ar 44100` + `loudnorm=I=-15:TP=-1.5` |
| `jingle-play.mp3`         | o jingle de axé da campanha (`/home/fsolla/Downloads/Jorge solla play.wav`, 2:11) — derivado mono 112 kbps; entra como cama sonora a partir de 0:04 do vídeo, bem baixo                                                                           | `ffmpeg -i "Jorge solla play.wav" -ac 1 -ar 44100 -b:a 112k`                                             |
| `fonts/inter-latin.woff2` | Inter (Google Fonts, OFL) — subset latim, eixo `wght` 100–900                                                                                                                                                                                     | baixado do CSS `https://fonts.googleapis.com/css2?family=Inter:wght@100..900` (bloco `latin`)            |

Os demais ativos do reel são lidos direto do site: a arte da colinha
(`public/cards/modelo-colinha.jpeg`), o fundo oficial da dobradinha
(`public/cards/estaduais/julio-fotos.webp`, céu da cena final) e o overlay
(`public/cards/estaduais/julio-base.webp`, lockup do Julio) e as fontes Brexter
(`src/app/(frontend)/fonts/`), Inter (os `fonts/` daqui) e Arimo
(`~/.local/share/fonts`, dependência já documentada pelo `build-radio-artes`
para a linha desenhada da colinha).

A cena final é remontada pelo builder a partir dessas artes: o grupo é a foto
oficial `julio-fotos.webp` (com uma cópia desfocada para o reveal por foco), a
faixa vermelha tem a crista preservada (recorte pelo topo da própria faixa) e
suas logos saem das artes com o vermelho (`#e50e2f`) virando alfa — a quadrada
do Solla e as quatro marcas da colinha, o lockup do Julio do overlay da
dobradinha. Nada disso é commitado — são derivados em memória a cada build.

O enquadramento da foto de cada candidato no card é dado pelo par
`photoZoom`/`photoShiftY` (e `photoOrigin`, quando preciso) em
`scripts/lib/colinhaReel.mjs`: o card usa `object-fit: cover` com o topo
ancorado e o zoom/deslocamento garantem cabeça inteira com respiro.

Regenerar um derivativo (exemplo da foto do Solla):

```bash
node -e "require('sharp')('<origem>').trim({threshold:8}).resize({height:1000,fit:'inside'}).webp({quality:88}).toFile('scripts/reels/assets/colinha-time-1313/solla.webp')"
```

A terceira versão do reel (`--finale=card`) não é composta aqui: o builder
dirige o estúdio de cards em produção (`/cards?model=minha-colinha`), escolhe o
estadual Julio Pinheiro e levanta o canvas 1080×1920 que o renderer do próprio
site pintou — o PNG cru sai no pacote como `colinha-site.png`.

O `--beeps` do builder mixa esse efeito (um bipe por card, no beat de cada
candidato) na trilha do vídeo, sem re-encodar o vídeo (`-c:v copy`); o lote
`pnpm reels:dobradinhas` já liga a flag.

Uso no reel: `pnpm reels:colinha` (ver o cabeçalho do builder para as flags de
finale, preview, capa, beeps e dry-run).
