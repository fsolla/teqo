/**
 * Artes da Rádio Jorge Solla 1313 — `public/campaign-kit/radio/`.
 *
 * Gera (e revalida) os ativos da estação no zeno.fm a partir dos ativos
 * oficiais do kit 1313 e dos artboards de alta em `public/`:
 *
 *   radio-jorge-solla-1313-logo.png          1024x1024  logo escolhida (o "O"
 *                                                       do SOLLA em fundo branco;
 *                                                       o zeno exibe em círculo)
 *   radio-jorge-solla-1313-capa.png          2048x1024  capa da estação (crop
 *                                                       4:1 no desktop = a faixa
 *                                                       segura 2048x512 central)
 *   radio-jorge-solla-1313-website-card.png  1200x720   station website card
 *                                                       (exibido em quadrado)
 *   capa-com-foto.png                        2048x1024  alternativa da capa com
 *                                                       a foto oficial
 *   finalistas/logo-finalista-*.png          1024x1024  logos finalistas
 *                                                       (arquivo da decisão)
 *   ilustracao-solla-1313.png                769x1122   ilustração em alta
 *                                                       (entrada versionada)
 *
 * Regras de marca: `public/campaign-kit/README.md` (paleta #e4102f/#184e92, marca
 * positiva/oficial para fundo claro, sem recriar lockup). "RÁDIO" usa Brexter
 * Bold (display face oficial, `src/app/(frontend)/fonts`) e a assinatura usa
 * Arimo (face dos cards, via next/font). Prerequisito local (fora do repo):
 *
 *   cp src/app/'(frontend)'/fonts/Brexter-Bold.ttf ~/.local/share/fonts/
 *   cp <repo>/.next/static/media/<arimo-latin>.woff2 ~/.local/share/fonts/Arimo-Regular.woff2
 *   fc-cache -f ~/.local/share/fonts
 *
 * Uso: node scripts/build-radio-artes.mjs
 */
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../package.json', import.meta.url))
const sharp = require('sharp')

const REPO = new URL('../', import.meta.url).pathname
const KIT = `${REPO}public/campaign-kit`
const OUT = `${KIT}/radio`
const FINALISTS = `${OUT}/finalistas`

const RED = '#e4102f'
const BLUE = '#184e92'
const WHITE = '#ffffff'

const SAFE_TOP = 256
const SAFE_BOTTOM = 768
const OVERLAY = { left: 60, right: 380, top: 700 } // logo circular do zeno (desktop)

const assertFont = (family) => {
  const matched = execFileSync('fc-match', ['--format', '%{family}', `${family}:bold`], {
    encoding: 'utf8',
  })
  if (!matched.toLowerCase().includes(family.toLowerCase())) {
    console.error(`Fonte "${family}" não está instalada no fontconfig local — veja o cabeçalho.`)
    process.exit(1)
  }
}

async function text({ str, font = 'Brexter', size, fill, tracking = 0, weight = 700 }) {
  const w = Math.ceil(str.length * size * 1.7 + 4 * tracking + 240)
  const h = Math.ceil(size * 3)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central"
      font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}"
      letter-spacing="${tracking}">${str}</text></svg>`
  const t = await sharp(Buffer.from(svg))
    .png()
    .trim({ threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true })
  return { input: t.data, w: t.info.width, h: t.info.height }
}

async function asset(file, width) {
  const t = await sharp(file)
    .trim({ threshold: 5 })
    .resize({ width })
    .png()
    .toBuffer({ resolveWithObject: true })
  return { input: t.data, w: t.info.width, h: t.info.height }
}

/** "O" do SOLLA recortado do artboard de alta (caixa medida no trim de 1654x1245). */
async function oMonogram(file, width) {
  const trim = await sharp(file).trim({ threshold: 5 }).png().toBuffer({ resolveWithObject: true })
  const glyph = await sharp(trim.data)
    .extract({ left: 349, top: 258, width: 361, height: 330 })
    .png()
    .toBuffer()
  const t = await sharp(glyph).resize({ width }).png().toBuffer({ resolveWithObject: true })
  return { input: t.data, w: t.info.width, h: t.info.height }
}

/** Marca vertical oficial (nome, 1313 embaixo e slogan). */
async function verticalMark(height) {
  const trim = await sharp(`${REPO}public/Prancheta 1@3x.png`)
    .trim({ threshold: 5 })
    .png()
    .toBuffer({ resolveWithObject: true })
  const t = await sharp(trim.data).resize({ height }).png().toBuffer({ resolveWithObject: true })
  return { input: t.data, w: t.info.width, h: t.info.height }
}

/** Foto oficial do candidato (cutout com alfa). */
async function candidatePhoto(height) {
  const trim = await sharp(`${REPO}public/JOA00162.avif`)
    .trim({ threshold: 5 })
    .png()
    .toBuffer({ resolveWithObject: true })
  const t = await sharp(trim.data).resize({ height }).png().toBuffer({ resolveWithObject: true })
  return { input: t.data, w: t.info.width, h: t.info.height }
}

/** Ilustração em alta (recorte + upscale por IA + fundo removido — ver README do kit). */
async function illustration(height) {
  const t = await sharp(`${OUT}/ilustracao-solla-1313.png`)
    .trim({ threshold: 1 })
    .resize({ height })
    .png()
    .toBuffer({ resolveWithObject: true })
  return { input: t.data, w: t.info.width, h: t.info.height }
}

const place = (layers) =>
  layers.map(({ asset: a, x, y, cx, cy }) => ({
    input: a.input,
    left: Math.round(x ?? cx - a.w / 2),
    top: Math.round(y ?? cy - a.h / 2),
  }))

async function render({ name, width, height, layers, bg = WHITE }) {
  const buffer = await sharp({ create: { width, height, channels: 4, background: bg } })
    .composite(place(layers))
    .png({ compressionLevel: 9 })
    .toBuffer()
  await sharp(buffer).toFile(`${OUT}/${name}`)
  console.log(
    name,
    `${width}x${height}`,
    `${(statSync(`${OUT}/${name}`).size / 1024).toFixed(0)}KB`,
  )
  return buffer
}

/** Faixa segura da capa inteira branca fora de y 256..768, e livre do logo do zeno. */
async function assertCoverSafe(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const white = (i) => data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250
  let outside = 0
  let overlay = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      if (white(i)) continue
      if (y < SAFE_TOP || y >= SAFE_BOTTOM) outside++
      if (x >= OVERLAY.left && x <= OVERLAY.right && y >= OVERLAY.top) overlay++
    }
  }
  if (outside > 0 || overlay > 0) {
    throw new Error(
      `capa fora do contrato: ${outside}px fora da faixa segura, ${overlay}px no logo do zeno`,
    )
  }
}

/** Card: nada fora do quadrado central 720x720 (é o crop exibido no zeno). */
async function assertCardSquare(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const white = (i) => data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250
  let outside = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (x >= 240 && x < 960) continue
      if (!white((y * info.width + x) * 4)) outside++
    }
  }
  if (outside > 0) throw new Error(`card com ${outside}px fora do quadrado central`)
}

assertFont('Brexter')
assertFont('Arimo')

const ILLUSTRATION = `${OUT}/ilustracao-solla-1313.png`
try {
  await sharp(ILLUSTRATION).metadata()
} catch {
  console.error(
    `Ilustração ausente: ${ILLUSTRATION} — o pipeline está documentado em public/campaign-kit/README.md.`,
  )
  process.exit(1)
}
await mkdir(FINALISTS, { recursive: true })

/* ------------------------------- Logo -------------------------------
 * O "O" do SOLLA da marca positiva em fundo branco opaco — legível no círculo
 * pequeno do zeno e sem repetir o símbolo onde o nome estilizado já está.
 */
await render({
  name: 'radio-jorge-solla-1313-logo.png',
  width: 1024,
  height: 1024,
  layers: [{ asset: await oMonogram(`${REPO}public/Prancheta 1@3x.png`, 580), cx: 512, cy: 512 }],
})

/* ------------------------------- Capa -------------------------------
 * "RÁDIO" + marca vertical (nome, 1313 e slogan) + candidato à direita em
 * conjunto centralizado; tudo dentro da faixa segura 2048x512.
 */
{
  const KICKER_PX = 58
  const KICKER_GAP = 14
  const MARK_H = 420
  const PERSON_H = 500
  const PERSON_GAP = 60

  const kicker = await text({ str: 'RÁDIO', size: KICKER_PX, fill: RED, tracking: 22 })
  const mark = await verticalMark(MARK_H)
  const top = 512 - (kicker.h + KICKER_GAP + mark.h) / 2
  for (const [name, person] of [
    ['radio-jorge-solla-1313-capa.png', await illustration(PERSON_H)],
    ['capa-com-foto.png', await candidatePhoto(PERSON_H)],
  ]) {
    const groupW = mark.w + PERSON_GAP + person.w
    const markX = Math.round((2048 - groupW) / 2)
    const buffer = await render({
      name,
      width: 2048,
      height: 1024,
      layers: [
        { asset: kicker, cx: markX + mark.w / 2, cy: top + kicker.h / 2 },
        { asset: mark, x: markX, y: top + kicker.h + KICKER_GAP },
        { asset: person, cx: markX + mark.w + PERSON_GAP + person.w / 2, cy: 512 },
      ],
    })
    await assertCoverSafe(buffer)
  }
}

/* --------------------------- Website card ----------------------------
 * 1200x720 (5:3) · o zeno exibe em quadrado (corte central 720x720).
 */
{
  const kicker = await text({ str: 'RÁDIO', size: 52, fill: RED, tracking: 16 })
  const mark = await asset(`${KIT}/jorge-solla-positivo.png`, 560)
  const tag = await text({
    str: 'A rádio da nossa caminhada pela Bahia.',
    font: 'Arimo',
    weight: 400,
    size: 30,
    fill: BLUE,
    tracking: 1,
  })
  let y = 360 - (kicker.h + 14 + mark.h + 22 + tag.h) / 2
  const layers = []
  for (const [item, gap] of [
    [kicker, 14],
    [mark, 22],
    [tag, 0],
  ]) {
    layers.push({ asset: item, cx: 600, y })
    y += item.h + gap
  }
  const buffer = await render({
    name: 'radio-jorge-solla-1313-website-card.png',
    width: 1200,
    height: 720,
    layers,
  })
  await assertCardSquare(buffer)
}

/* ----------------------------- Finalistas ----------------------------
 * O arquivo da decisão de logo (2026-09-21): a escolhida é o "O" (acima).
 */
{
  const numero = await asset(`${KIT}/numero-negativo.png`, 860)
  await render({
    name: 'finalistas/logo-finalista-1313-no-vermelho.png',
    width: 1024,
    height: 1024,
    bg: RED,
    layers: [{ asset: numero, cx: 512, cy: 512 }],
  })

  const completa = await asset(`${REPO}public/Prancheta 1@3x.png`, 840)
  await render({
    name: 'finalistas/logo-finalista-marca-completa-no-branco.png',
    width: 1024,
    height: 1024,
    layers: [{ asset: completa, cx: 512, cy: 512 }],
  })

  const oBranco = await oMonogram(`${REPO}public/Prancheta 3@3x.png`, 580)
  await render({
    name: 'finalistas/logo-finalista-o-branco-no-vermelho.png',
    width: 1024,
    height: 1024,
    bg: RED,
    layers: [{ asset: oBranco, cx: 512, cy: 512 }],
  })
}
