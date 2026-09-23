/**
 * Deriva os derivativos otimizados do modelo de card `time-do-estadual` (S30)
 * a partir das artes oficiais entregues pela campanha — as 53 dobradinhas, cada
 * uma com dois PNGs 1080×1440 (`FOTOS*` = fundo com o grupo + o estadual na
 * janela; `BASE*` = overlay frontal com a faixa do lockup).
 *
 * Grava, de forma idempotente, em `public/cards/estaduais/`:
 *   <slug>-fotos.webp   fundo (o canvas do estúdio carrega a URL crua)
 *   <slug>-base.webp    overlay frontal (alfa preservado)
 *
 * e copia byte-a-byte o arquivo exato aprovado pelo humano
 * (`docs/plans/cards-estadual-dobradinha-ui-design-assets/modelo-time-de-voce-com-estadual.jpeg`)
 * para `public/cards/modelo-time-de-voce-com-estadual.jpeg` (tile da galeria e
 * placeholder do composer antes da escolha).
 *
 * O slug de cada pasta é `slugify(nome da pasta)` e TEM de existir no catálogo
 * commitado (`src/lib/stateDeputyCatalog.ts`); pasta sem entrada, entrada sem
 * pasta, par ausente/duplicado ou dimensão fora de 1080×1440 falham fechado —
 * o script nunca deriva um roster divergente do catálogo.
 *
 * Uso (a origem fica fora do repo):
 *   pnpm build:state-deputy-card-assets -- --from="/caminho/DOBRADINHAS SITE"
 */
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

import { slugify } from '../src/lib/slug.ts'
import { stateDeputyCatalog } from '../src/lib/stateDeputyCatalog.ts'
import { dieWithLabel, parseEqualsFlags, sha256Hex } from './lib/cli.mjs'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const die = dieWithLabel('build:state-deputy-card-assets')

const OUT_DIR = resolve('public/cards/estaduais')
const APPROVED_EXAMPLE_SRC = resolve(
  'docs/plans/cards-estadual-dobradinha-ui-design-assets/modelo-time-de-voce-com-estadual.jpeg',
)
const APPROVED_EXAMPLE_OUT = resolve('public/cards/modelo-time-de-voce-com-estadual.jpeg')
const WIDTH = 1080
const HEIGHT = 1440
const WEBP_QUALITY = 82

const USAGE = `Uso: pnpm build:state-deputy-card-assets -- --from=<pasta das dobradinhas>

A pasta de origem tem uma subpasta por estadual, cada uma com os dois PNGs
1080×1440 (FOTOS*/BASE*, prefixo case-insensitive). Ex.:
  --from="/home/fsolla/Downloads/DOBRADINHAS SITE-20260923T033020Z-1-001/DOBRADINHAS SITE"`

const { flags } = parseEqualsFlags(process.argv.slice(2))
if (flags.help === true) {
  console.log(USAGE)
  process.exit(0)
}
if (typeof flags.from !== 'string' || flags.from.length === 0) die(USAGE)

const originRoot = resolve(flags.from)
const originStat = await stat(originRoot).catch(() => null)
if (!originStat?.isDirectory()) die(`Origem inválida: ${originRoot}`)

const originDirs = (await readdir(originRoot, { withFileTypes: true }))
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .sort((left, right) => left.localeCompare(right, 'pt-BR'))

const catalogBySlug = new Map(stateDeputyCatalog.map((card) => [card.slug, card]))
const paired = new Map()

for (const dirName of originDirs) {
  const files = await readdir(join(originRoot, dirName))
  const pick = (prefix) =>
    files.filter((file) => file.toLowerCase().startsWith(prefix))
  const photos = pick('fotos')
  const base = pick('base')

  if (photos.length !== 1 || base.length !== 1) {
    die(
      `Par FOTOS/BASE inválido em ${dirName}: ${photos.length} FOTOS*, ${base.length} BASE* — esperado exatamente 1 de cada`,
    )
  }

  const slug = slugify(dirName)
  const card = catalogBySlug.get(slug)
  if (!card) die(`Pasta sem entrada no catálogo (${dirName} → ${slug})`)
  if (paired.has(slug)) die(`Slug duplicado: ${slug}`)
  paired.set(slug, dirName)

  for (const [label, file] of [
    ['FOTOS', photos[0]],
    ['BASE', base[0]],
  ]) {
    const metadata = await sharp(join(originRoot, dirName, file)).metadata()
    if (metadata.width !== WIDTH || metadata.height !== HEIGHT) {
      die(`${dirName}/${file}: ${metadata.width}×${metadata.height} — esperado ${WIDTH}×${HEIGHT}`)
    }
    if (label === 'BASE' && !metadata.hasAlpha) {
      die(`${dirName}/${file}: o overlay frontal precisa de alfa`)
    }
  }
}

for (const card of stateDeputyCatalog) {
  if (!paired.has(card.slug)) die(`Entrada do catálogo sem pasta de origem: ${card.slug}`)
}

await mkdir(OUT_DIR, { recursive: true })

let totalBytes = 0
for (const card of stateDeputyCatalog) {
  const dirName = paired.get(card.slug)
  const files = await readdir(join(originRoot, dirName))
  const findOne = (prefix) => files.find((file) => file.toLowerCase().startsWith(prefix))

  for (const [suffix, prefix] of [
    ['fotos', 'fotos'],
    ['base', 'base'],
  ]) {
    const source = join(originRoot, dirName, findOne(prefix))
    const target = join(OUT_DIR, `${card.slug}-${suffix}.webp`)
    const buffer = await sharp(source).webp({ quality: WEBP_QUALITY }).toBuffer()
    const current = await readFile(target).catch(() => null)
    if (current && sha256Hex(current) === sha256Hex(buffer)) continue

    await writeFile(target, buffer)
    totalBytes += buffer.length
    console.log(`${card.slug}-${suffix}.webp  ${(buffer.length / 1024).toFixed(0)}KB  (${dirName})`)
  }
}

const exampleSource = await readFile(APPROVED_EXAMPLE_SRC)
const exampleCurrent = await readFile(APPROVED_EXAMPLE_OUT).catch(() => null)
if (!exampleCurrent || sha256Hex(exampleCurrent) !== sha256Hex(exampleSource)) {
  await copyFile(APPROVED_EXAMPLE_SRC, APPROVED_EXAMPLE_OUT)
  console.log('modelo-time-de-voce-com-estadual.jpeg  copiado do asset aprovado')
}

console.log(
  `\n[build:state-deputy-card-assets] ${stateDeputyCatalog.length} estaduais · ${(
    totalBytes / 1024
  ).toFixed(0)}KB gravados nesta execução`,
)
