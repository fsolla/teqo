/**
 * resize-images.mjs — local image optimizer for the campaign site draft.
 *
 * Takes one or more image paths (or folders, which are scanned recursively)
 * and, for each: rotates per EXIF, resizes to at most `--max-width` keeping
 * the aspect ratio (no upscaling), strips metadata and encodes two outputs
 * by default — AVIF (lightest modern format, for the site) and WebP (the
 * broadly accepted companion: design tools such as PenPot and older
 * browsers do not open AVIF). `--format` narrows the set. Outputs keep the
 * source basename into the Next.js `public/` folder (or `--out`), so the
 * draft pages can reference `/arquivo.avif` directly.
 *
 * Usage:
 *   pnpm images:resize 1.jpg 2.png
 *   pnpm images:resize --out public/campanha --max-width 2560 fotos/*
 *   pnpm images:resize --format avif,webp --quality 80 ~/Downloads/foto.JPG
 *   pnpm images:resize --format webp ~/Downloads/foto.JPG
 *
 * AVIF encoding is slower than WebP/JPEG — a large batch is expected to
 * take a few seconds per image.
 */
import { removeBackground } from '@imgly/background-removal-node'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

import { dieWithLabel } from './lib/cli.mjs'
import {
  INPUT_EXTENSIONS,
  defaultQualityFor,
  deriveOutputFileName,
  maxWidthFor,
  parseResizeArgs,
} from './lib/imageResize.mjs'

const die = dieWithLabel('images:resize')

const USAGE = `Uso: pnpm images:resize [opções] <caminhos...>

Redimensiona e converte imagens para a web, gravando na pasta public/.
Por padrão gera DUAS versões: .avif para o site e .webp para PenPot e
navegadores antigos — o webp sai bem menor (1x a tela desktop) porque é
só referência de draft, não asset de produção.

Opções:
  --max-width <px>   largura máxima de TODOS os formatos (default por
                     formato: avif 3840 = 2x desktop, webp/jpeg 1920 = 1x)
  --format <fmt>     formato(s) de saída: avif, webp, jpeg (default avif,webp)
  --quality <1-100>  qualidade de compressão (defaults: avif 60, webp 75, jpeg 82)
  --remove-bg        remove o fundo da foto com IA local (1a execução
                     baixa o modelo, ~40 MB, depois usa cache)
  --out <dir>        pasta de saída (default public/)
  -h, --help         mostra esta ajuda

Caminhos podem ser arquivos de imagem ou pastas (varridas recursivamente).
O nome do arquivo é mantido; só a extensão muda (foto.jpg -> foto.avif + foto.webp).`

/**
 * Expands positional args into a sorted, deduped list of image files.
 * Directories are walked recursively; anything else is kept as-is.
 *
 * @param {string[]} paths
 * @returns {Promise<string[]>} absolute input paths
 */
const expandImagePaths = async (paths) => {
  const found = new Set()
  for (const path of paths) {
    const absolute = resolve(path)
    let info
    try {
      info = await stat(absolute)
    } catch {
      die(`${path} não existe`)
    }
    if (info.isDirectory()) {
      const entries = await readdir(absolute, { recursive: true, withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const lower = entry.name.toLowerCase()
        if ([...INPUT_EXTENSIONS].some((ext) => lower.endsWith(ext))) {
          // `parentPath` is absolute on Node >= 22 and relative on older —
          // resolve() folds either spelling onto the scanned root.
          found.add(resolve(absolute, entry.parentPath, entry.name))
        }
      }
    } else if (info.isFile()) {
      found.add(absolute)
    }
  }
  return [...found].sort()
}

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Loads one input and prepares it once for every output format: EXIF
 * rotation is baked in, then (optionally) the background is removed with
 * the local ONNX model. The result is the raw buffer every format encodes
 * from, so the segmentation never runs per format.
 *
 * The imgly node package decodes only blobs whose `type` it knows
 * (png/jpeg/webp) and does NOT sniff bytes — a bare `new Blob([buffer])`
 * arrives with an empty type and dies with "Unsupported format: " (bug
 * in 1.4.5). PNG is the lossless universal intermediate, declared
 * explicitly.
 *
 * @param {string} input
 * @param {boolean} removeBg
 */
const prepareImage = async (input, removeBg) => {
  let buffer = await sharp(await readFile(input))
    .rotate()
    .toBuffer()
  if (removeBg) {
    buffer = await sharp(buffer).png().toBuffer()
    const blob = new Blob([buffer], { type: 'image/png' })
    const result = await removeBackground(blob, { output: { format: 'image/png' } })
    buffer = Buffer.from(await result.arrayBuffer())
  }
  return buffer
}

/**
 * Resizes + converts one prepared image to one format. Returns the
 * width/height pair of the output for the summary. Never touches the
 * source: the output path is derived from the basename and the target
 * format, so it can only collide with the source when the input already is
 * the output format AND sits in the output folder — which is refused.
 * JPEG cannot hold the alpha channel left by background removal, so it is
 * flattened onto white instead of leaking black.
 *
 * @param {Buffer} prepared
 * @param {string} input
 * @param {string} output
 * @param {{ maxWidth: number | undefined, quality: number | undefined, format: 'avif' | 'webp' | 'jpeg', removeBg: boolean }} options
 */
const encodeImage = async (prepared, input, output, { maxWidth, quality, format, removeBg }) => {
  if (resolve(input) === resolve(output)) {
    throw new Error(
      `saída colidiria com a fonte em ${basename(input)} — troque o formato ou use --out`,
    )
  }
  let pipeline = sharp(prepared).resize({
    width: maxWidthFor(format, maxWidth),
    withoutEnlargement: true,
    fit: 'inside',
  })
  if (removeBg && format === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' })
  const encoded = await pipeline
    .toFormat(format, { quality: quality ?? defaultQualityFor(format) })
    .toBuffer()
  await writeFile(output, encoded)
  const { width, height } = await sharp(encoded).metadata()
  return { width: width ?? 0, height: height ?? 0 }
}

/**
 * The shared resize+encode engine — the CLI entry point and `fill-image.mjs`
 * (which chains this onto the model output) both call it with a
 * `parseResizeArgs`-shaped options object.
 *
 * @param {ReturnType<typeof parseResizeArgs>} options
 */
export const runResizeImages = async (options) => {
  if (options.help) {
    console.log(USAGE)
    return
  }

  const inputs = await expandImagePaths(options.paths)
  if (inputs.length === 0) {
    die(`nenhuma imagem encontrada nos caminhos informados (${options.paths.join(', ')})`)
  }

  const outDir = resolve(options.outDir)
  await mkdir(outDir, { recursive: true })

  const { formats, quality, maxWidth, removeBg } = options
  const results = []
  const failures = []
  for (const input of inputs) {
    const before = (await stat(input)).size
    let prepared
    try {
      prepared = await prepareImage(input, removeBg)
    } catch (error) {
      failures.push(`${basename(input)}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    for (const format of formats) {
      const output = join(outDir, deriveOutputFileName(input, format))
      try {
        const { width, height } = await encodeImage(prepared, input, output, {
          maxWidth,
          quality,
          format,
          removeBg,
        })
        const after = (await stat(output)).size
        results.push({
          name: `${basename(input)} → .${format}`,
          dimensions: `${width}×${height}`,
          before,
          after,
        })
      } catch (error) {
        failures.push(
          `${basename(input)} (.${format}): ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  const nameWidth = Math.max(...results.map((r) => r.name.length), 6)
  console.log(`\n${'arquivo'.padEnd(nameWidth)}  dimensão    antes -> depois        economia`)
  console.log('-'.repeat(nameWidth + 54))
  let totalBefore = 0
  let totalAfter = 0
  for (const result of results) {
    totalBefore += result.before
    totalAfter += result.after
    const saved = 100 - (result.after / result.before) * 100
    console.log(
      `${result.name.padEnd(nameWidth)}  ${result.dimensions.padEnd(9)} ${formatBytes(result.before).padEnd(8)} -> ${formatBytes(result.after).padEnd(9)} ${saved.toFixed(1).padStart(5)}%`,
    )
  }
  if (results.length > 1) {
    const saved = 100 - (totalAfter / totalBefore) * 100
    console.log('-'.repeat(nameWidth + 54))
    console.log(
      `${'TOTAL'.padEnd(nameWidth)}  ${String(results.length).padEnd(9)} ${formatBytes(totalBefore).padEnd(8)} -> ${formatBytes(totalAfter).padEnd(9)} ${saved.toFixed(1).padStart(5)}%`,
    )
  }
  const widthSummary = maxWidth
    ? `largura máxima ${maxWidth}px`
    : `largura por formato (${formats.map((f) => `${f} ${maxWidthFor(f)}px`).join(', ')})`
  console.log(
    `\n${results.length} arquivo(s) em ${join(outDir, '')} (${formats.join(', ')}, ${quality ? `qualidade ${quality}, ` : ''}${widthSummary}${removeBg ? ', fundo removido' : ''})\n`,
  )

  if (failures.length > 0) {
    console.error(`\n${failures.length} falha(s):`)
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }
}

// CLI entry: only when run directly — `fill-image.mjs` imports the engine
// without triggering the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runResizeImages(parseResizeArgs(process.argv.slice(2))).catch((error) =>
    die(error instanceof Error ? error.message : String(error)),
  )
}
