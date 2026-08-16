/**
 * Pure derivation for `scripts/resize-images.mjs` — argument parsing,
 * format/quality policy and output-name derivation, unit-tested like the
 * rest of `scripts/lib/`. The CLI itself only threads `sharp` through these
 * decisions, so nothing here imports sharp or touches the filesystem.
 */

import { parse } from 'node:path'

/** 2× the reference desktop viewport (1920px) — retina-grade site assets. */
const MAX_WEB_WIDTH = 3840

/**
 * Max width per format: AVIF serves the site at retina grade (2× desktop),
 * while WebP/JPEG are the draft/compatibility companions (PenPot, email,
 * older browsers) and can stay at 1× — a quarter of the pixels, so the
 * design tool never has to chew on multi-MB files.
 */
export const FORMAT_MAX_WIDTHS = { avif: MAX_WEB_WIDTH, webp: 1920, jpeg: 1920 }

/** Width to use for a format — an explicit `--max-width` wins over the per-format default. */
export const maxWidthFor = (format, override) =>
  override ?? FORMAT_MAX_WIDTHS[format] ?? MAX_WEB_WIDTH

/** Output formats sharp can encode for the browser, in order of preference. */
const SUPPORTED_FORMATS = ['avif', 'webp', 'jpeg']

/**
 * The default output set: AVIF for the site (lightest modern format) plus
 * WebP as the broadly accepted companion — design tools such as PenPot and
 * older browsers do not open AVIF.
 */
const DEFAULT_FORMATS = ['avif', 'webp']

/** Extension per normalized format (jpeg keeps the compact `.jpg`). */
const FORMAT_EXTENSIONS = { avif: '.avif', webp: '.webp', jpeg: '.jpg' }

/** Sharp quality defaults per format (AVIF compresses far better than WebP). */
const FORMAT_QUALITY_DEFAULTS = { avif: 60, webp: 75, jpeg: 82 }

/** Accepted input extensions when a positional argument is a directory. */
export const INPUT_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.tif',
  '.tiff',
  '.gif',
  '.heic',
  '.bmp',
])

/**
 * Normalizes a `--format` value (aliases + leading dot, case-insensitive).
 * Returns `null` when the value is not encodable.
 *
 * @param {string} value
 * @returns {'avif' | 'webp' | 'jpeg' | null}
 */
export const normalizeImageFormat = (value) => {
  const normalized = value.trim().toLowerCase().replace(/^\./, '')
  const alias = { jpg: 'jpeg', jpe: 'jpeg', jfif: 'jpeg' }[normalized]
  const format = alias ?? normalized
  return SUPPORTED_FORMATS.includes(format) ? format : null
}

/** @param {'avif' | 'webp' | 'jpeg'} format */
export const defaultQualityFor = (format) => FORMAT_QUALITY_DEFAULTS[format] ?? 60

/**
 * The web asset keeps the source basename, only the extension changes
 * (`foto.jpg` → `foto.avif`), so re-running with another format never
 * collides with the source file.
 *
 * @param {string} inputPath
 * @param {'avif' | 'webp' | 'jpeg'} format
 */
export const deriveOutputFileName = (inputPath, format) =>
  `${parse(inputPath).name}${FORMAT_EXTENSIONS[format]}`

const FLAGS = new Set(['--max-width', '--quality', '--format', '--out'])

const BOOLEAN_FLAGS = new Set(['--remove-bg'])

const HELP_FLAGS = new Set(['--help', '-h'])

/**
 * Parses `--format` into a deduped, order-preserving list. Accepts a
 * comma-separated set (`avif,webp`) and the singular spellings (`jpg`).
 * Returns `null` when every item is missing or any item is unknown.
 *
 * @param {string} value
 * @returns {('avif' | 'webp' | 'jpeg')[] | null}
 */
const parseFormatList = (value) => {
  const formats = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map(normalizeImageFormat)
  if (formats.length === 0 || formats.some((format) => format === null)) {
    return null
  }
  return [...new Set(formats)]
}

/**
 * Parses CLI argv into options. Throws with a human-readable message on any
 * unknown flag or invalid value (fail closed — a typo must not silently
 * fall back to a default). `quality` and `maxWidth` stay undefined when
 * absent so each format applies its own default at conversion time.
 *
 * @param {string[]} argv - `process.argv.slice(2)`
 * @returns {{ paths: string[], maxWidth: number | undefined, quality: number | undefined, formats: ('avif' | 'webp' | 'jpeg')[], outDir: string, removeBg: boolean, help: boolean }}
 */
export const parseResizeArgs = (argv) => {
  const options = {
    help: false,
    paths: [],
    maxWidth: undefined,
    quality: undefined,
    formats: [...DEFAULT_FORMATS],
    outDir: 'public',
    removeBg: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (HELP_FLAGS.has(arg)) {
      options.help = true
      continue
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      options.removeBg = true
      continue
    }
    const [flag, inlineValue] = arg.startsWith('--') ? arg.split('=') : [null, null]
    if (flag !== null && FLAGS.has(flag)) {
      const value = inlineValue ?? argv[i + 1]
      if (inlineValue === undefined) i += 1
      if (value === undefined || value === '' || value.startsWith('--')) {
        throw new Error(`flag ${flag} espera um valor (ex.: ${flag}=3840 ou ${flag} 3840)`)
      }
      if (flag === '--max-width') {
        const width = Number(value)
        if (!Number.isInteger(width) || width < 1) {
          throw new Error(`--max-width inválido: ${JSON.stringify(value)} (esperado inteiro > 0)`)
        }
        options.maxWidth = width
      } else if (flag === '--quality') {
        const quality = Number(value)
        if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
          throw new Error(`--quality inválido: ${JSON.stringify(value)} (esperado 1..100)`)
        }
        options.quality = quality
      } else if (flag === '--format') {
        const formats = parseFormatList(value)
        if (formats === null) {
          throw new Error(
            `--format inválido: ${JSON.stringify(value)} (esperado ${SUPPORTED_FORMATS.join('|')}, lista separada por vírgula)`,
          )
        }
        options.formats = formats
      } else {
        options.outDir = value
      }
      continue
    }
    if (flag !== null && !HELP_FLAGS.has(arg)) {
      throw new Error(`flag desconhecida: ${JSON.stringify(arg)} (veja --help)`)
    }
    options.paths.push(arg)
  }

  if (!options.help && options.paths.length === 0) {
    throw new Error('nenhum caminho informado — passe arquivos de imagem ou pastas (veja --help)')
  }

  return options
}
