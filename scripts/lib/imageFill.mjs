/**
 * Pure derivation for `scripts/fill-image.mjs` — argument parsing, canvas
 * extension math and prompt defaults, unit-tested like the rest of
 * `scripts/lib/`. The CLI itself only threads sharp + the DeepInfra call
 * through these decisions.
 */

/** DeepInfra model that fills masked regions with text guidance. */
export const FILL_MODEL = 'black-forest-labs/FLUX-2-dev'

/** Native DeepInfra inference endpoint for `FILL_MODEL` (accepts arbitrary multiples of 64). */
export const FILL_INFERENCE_URL = `https://api.deepinfra.com/v1/inference/${FILL_MODEL}`

/** When the photo is extended, the white strip below is the void to fill — this is the prompt. */
export const EXTEND_DEFAULT_PROMPT =
  'Continue a imagem apenas na área branca abaixo: complete o corpo da pessoa de forma realista e coerente com a cena, com as mesmas roupas, iluminação, cores e estilo da foto, sem elementos novos.'

/** When an explicit mask is given, only the marked (whitened) region is regenerated. */
export const MASK_DEFAULT_PROMPT =
  'Regenere apenas a área branca marcada, de forma natural e coerente com a cena, preservando roupas, iluminação, cores e estilo da foto original.'

/**
 * Parses `--extend` values: a plain integer is pixels, `30%` is a share of
 * the photo height. Returns null when the value is not one of those shapes.
 *
 * @param {string} value
 * @returns {number | null}
 */
export const parseExtendPx = (value) => {
  const percent = /^(\d{1,3})%$/.exec(value.trim())
  if (percent) return Number(percent[1])
  const px = Number(value.trim())
  if (Number.isInteger(px) && px > 0) return px
  return null
}

/**
 * Bottom-strip extension for a canvas. `extendPx` may be pixels or a
 * percentage of the photo height (already resolved by the caller via
 * `parseExtendPx` + height).
 *
 * @param {number} width
 * @param {number} height
 * @param {number} extendPx
 * @returns {{ width: number, height: number, offsetY: number }}
 */
export const extendedCanvas = (width, height, extendPx) => ({
  width,
  height: height + extendPx,
  offsetY: height,
})

/**
 * The FLUX VAE needs dimensions that are multiples of 64. Pads a canvas up
 * to the next multiple on each axis; the padding is masked OPAQUE
 * (preserved) and cropped away after the fill, so the final image is
 * exactly the canvas the caller built.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number, padRight: number, padBottom: number }}
 */
export const padToMultipleOf64 = (width, height) => ({
  width: Math.ceil(width / 64) * 64,
  height: Math.ceil(height / 64) * 64,
  padRight: Math.ceil(width / 64) * 64 - width,
  padBottom: Math.ceil(height / 64) * 64 - height,
})

const VALUE_FLAGS = new Set(['--photo', '--mask', '--extend', '--prompt', '--out', '--steps'])

const BOOLEAN_FLAGS = new Set(['--no-resize'])

const HELP_FLAGS = new Set(['--help', '-h'])

/**
 * Parses CLI argv into options. Throws with a human-readable message on any
 * unknown flag or invalid value (fail closed — a typo must not silently
 * fall back to a default).
 *
 * @param {string[]} argv - `process.argv.slice(2)`
 * @returns {{ photo: string, mask: string | null, extend: string | null, prompt: string, steps: number, outDir: string, resize: boolean, help: boolean }}
 */
export const parseFillArgs = (argv) => {
  const options = {
    help: false,
    photo: undefined,
    mask: null,
    extend: null,
    prompt: undefined,
    steps: 28,
    outDir: 'public',
    resize: true,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (HELP_FLAGS.has(arg)) {
      options.help = true
      continue
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      options.resize = false
      continue
    }
    const [flag, inlineValue] = arg.startsWith('--') ? arg.split('=') : [null, null]
    if (flag !== null && VALUE_FLAGS.has(flag)) {
      const value = inlineValue ?? argv[i + 1]
      if (inlineValue === undefined) i += 1
      if (value === undefined || value === '' || value.startsWith('--')) {
        throw new Error(`flag ${flag} espera um valor (ex.: ${flag}=valor ou ${flag} valor)`)
      }
      if (flag === '--photo') {
        options.photo = value
      } else if (flag === '--mask') {
        options.mask = value
      } else if (flag === '--extend') {
        if (parseExtendPx(value) === null) {
          throw new Error(
            `--extend inválido: ${JSON.stringify(value)} (esperado pixels, ex.: 400, ou percentual, ex.: 30%)`,
          )
        }
        options.extend = value
      } else if (flag === '--prompt') {
        options.prompt = value
      } else if (flag === '--steps') {
        const steps = Number(value)
        if (!Number.isInteger(steps) || steps < 1 || steps > 50) {
          throw new Error(`--steps inválido: ${JSON.stringify(value)} (esperado 1..50)`)
        }
        options.steps = steps
      } else {
        options.outDir = value
      }
      continue
    }
    if (flag !== null && !HELP_FLAGS.has(arg)) {
      throw new Error(`flag desconhecida: ${JSON.stringify(arg)} (veja --help)`)
    }
    throw new Error(`argumento posicional não esperado: ${JSON.stringify(arg)} (veja --help)`)
  }

  if (!options.help) {
    if (options.photo === undefined) {
      throw new Error('--photo é obrigatório (veja --help)')
    }
    if (options.mask === null && options.extend === null) {
      throw new Error('informe --mask (região pintada de branco) ou --extend (aumentar embaixo)')
    }
    if (options.mask !== null && options.extend !== null) {
      throw new Error('--mask e --extend são mutuamente exclusivos — escolha um')
    }
    options.prompt =
      options.prompt ?? (options.extend !== null ? EXTEND_DEFAULT_PROMPT : MASK_DEFAULT_PROMPT)
  }

  return options
}
