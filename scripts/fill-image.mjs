/**
 * fill-image.mjs — completes/corrects a photo region with FLUX-2-dev on
 * DeepInfra, then chains the resize engine (avif + webp) on the result.
 *
 * Two flows, driven by the mask:
 *  1. `--extend <px|%>` — the photo has no room below (e.g. Lula cut off
 *     mid-torso): the canvas is grown downward, the strip is filled white
 *     and its mask is generated automatically (no painting by hand).
 *  2. `--mask <path>` — an explicit mask, white = regenerate, black =
 *     preserve (same size as the photo), for arbitrary inpaint regions.
 *
 * The photo is sent as a PNG whose ALPHA CHANNEL is the mask (transparent =
 * regenerate, opaque = preserve — the FLUX-2 native convention), padded to
 * a multiple of 64 for the VAE. The white/black user mask is inverted into
 * alpha; the auto `--extend` mask is a transparent bottom strip.
 *
 * The model output (master PNG) lands in `data/ai-fill/` (gitignored) and
 * the resize engine writes the site assets into `--out` (default `public/`).
 *
 * Usage:
 *   pnpm images:fill --photo lula.jpg --extend 40% --prompt "corpo completo de homem, terno cinza"
 *   pnpm images:fill --photo lula.jpg --extend 600
 *   pnpm images:fill --photo foto.png --mask mascara.png
 *   pnpm images:fill --photo foto.jpg --mask m.png --no-resize --out draft/
 *
 * Needs DEEPINFRA_API_KEY (see .env.example). Each run spends a few cents
 * of API credits.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join, parse, resolve } from 'node:path'
import sharp from 'sharp'

import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'
import {
  FILL_INFERENCE_URL,
  FILL_MODEL,
  padToMultipleOf64,
  parseExtendPx,
  parseFillArgs,
} from './lib/imageFill.mjs'
import { runResizeImages } from './resize-images.mjs'

const die = dieWithLabel('images:fill')

const USAGE = `Uso: pnpm images:fill --photo <arquivo> (--extend <px|%> | --mask <mascara.png>) [opções]

Completa uma região da foto com FLUX-2-dev (DeepInfra) e depois roda o
redimensionamento (avif + webp) na imagem resultante.

Modos:
  --extend <px|%>   aumenta o canvas PELA BASE, preenchendo a faixa nova de
                    branco, e gera a máscara dela sozinho — ideal quando o
                    corpo foi cortado e não há espaço na foto (ex.: 40%)
  --mask <mascara>  usa uma máscara sua (branco = regenerar, preto = manter),
                    do mesmo tamanho da foto

Opções:
  --photo <arquivo> foto a editar (obrigatório)
  --prompt "..."    o que gerar na região (default pronto para completar corpo)
  --steps <1-50>    passos de geração (default 28; mais = melhor, mais caro)
  --out <dir>       pasta dos avif/webp (default public/)
  --no-resize       não roda o redimensionamento depois
  -h, --help        mostra esta ajuda

Precisa de DEEPINFRA_API_KEY no .env.local (veja .env.example).
O mestre PNG fica em data/ai-fill/ (fora do git).`

/**
 * Builds the PNG sent to the model using the img2img outpaint strategy:
 * the photo is placed on a white canvas grown by the strip (on `--extend`),
 * and the model is told to keep the photo EXACTLY as it is and only fill
 * the white area. DeepInfra's FLUX-2-dev ignores masks (alpha or a `mask`
 * field both re-render the whole image — verified empirically), but with a
 * clear white "void" + a hard preservation prompt it keeps the photo and
 * only generates into the strip. With `--mask` the user's marked region is
 * itself whitened out, so it plays the same "void" role.
 *
 * The canvas is padded to a multiple of 64 for the VAE and the padding
 * (`crop`) is cut away after the fill.
 *
 * @param {string} photo
 * @param {string | null} maskPath
 * @param {string | null} extend
 * @returns {Promise<{ imageUri: string, width: number, height: number, crop: { left: number, top: number, width: number, height: number } }>}
 */
const buildFillInputs = async (photo, maskPath, extend) => {
  const photoBuffer = await sharp(await readFile(photo))
    .rotate()
    .toBuffer()
  const { width, height } = await sharp(photoBuffer).metadata()
  const extendPx = extend !== null ? extendPxOf(extend, height) : 0
  const canvasHeight = height + extendPx
  // The native endpoint refuses canvases beyond ~2 MP (and bills per pixel).
  // Scale down huge photos (e.g. 27 MP camera files) to a pre-pad budget so
  // the padded multiple-of-64 canvas stays under the cap.
  const scale = Math.min(1, Math.sqrt(FILL_MAX_PIXELS / (width * canvasHeight)))
  const photoW = Math.max(1, Math.floor(width * scale))
  const photoH = Math.max(1, Math.floor(height * scale))
  const canvasH = Math.max(1, Math.floor(canvasHeight * scale))
  const pad = padToMultipleOf64(photoW, canvasH)

  const rgb = await sharp({
    create: { width: pad.width, height: pad.height, channels: 3, background: '#ffffff' },
  })
    .composite([
      {
        input: await sharp(photoBuffer)
          .resize({ width: photoW, height: photoH, fit: 'fill' })
          .png()
          .toBuffer(),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer()
  const { data: rgbData } = await sharp(rgb).raw().toBuffer({ resolveWithObject: true })

  if (extend === null) {
    const userMask = await sharp(await readFile(maskPath))
      .rotate()
      .toBuffer()
    const { width: maskWidth, height: maskHeight } = await sharp(userMask).metadata()
    if (maskWidth !== width || maskHeight !== height) {
      die(
        `a máscara ${basename(maskPath)} tem ${maskWidth}×${maskHeight}, mas a foto tem ${width}×${height} — use o mesmo tamanho`,
      )
    }
    const { data: luma } = await sharp(userMask)
      .resize({ width: photoW, height: photoH, fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    for (let i = 0; i < photoW * photoH; i += 1) {
      if (luma[i] > 127) {
        rgbData[i * 3] = 255
        rgbData[i * 3 + 1] = 255
        rgbData[i * 3 + 2] = 255
      }
    }
  }

  const png = await sharp(rgbData, {
    raw: { width: pad.width, height: pad.height, channels: 3 },
  })
    .png()
    .toBuffer()
  return {
    imageUri: `data:image/png;base64,${png.toString('base64')}`,
    width: pad.width,
    height: pad.height,
    crop: { left: 0, top: 0, width: photoW, height: canvasH },
  }
}

/** Resolves the `--extend` value against a photo height once (shared by callers). */
const extendPxOf = (extend, photoHeight) =>
  parseExtendPx(extend) * (extend.endsWith('%') ? Math.round(photoHeight / 100) : 1)

/** Pre-pad canvas budget: keeps the padded multiple-of-64 canvas under ~2 MP. */
const FILL_MAX_PIXELS = 1_800_000

/**
 * Extracts the generated image from the OpenAI-images response shapes
 * (`data[].b64_json` / `.url`) with fallbacks for other shapes DeepInfra
 * returns (bare string, `images[]` data URIs).
 *
 * @param {unknown} payload
 * @returns {string | null} base64 image data
 */
const extractOutputBase64 = (payload) => {
  if (payload && typeof payload === 'object') {
    const data = payload.data
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item === 'object') {
          if (typeof item.b64_json === 'string') return item.b64_json
          if (typeof item.url === 'string') return item.url
        }
      }
    }
    if (Array.isArray(payload.images)) {
      for (const item of payload.images) {
        if (typeof item === 'string') return item.replace(/^data:image\/[a-z0-9+]+;base64,/, '')
      }
    }
    if (Array.isArray(payload.output)) return extractOutputBase64({ data: payload.output })
  }
  return null
}

const main = async () => {
  const options = parseFillArgs(process.argv.slice(2))
  if (options.help) {
    console.log(USAGE)
    process.exit(0)
  }

  loadCliEnv()
  const apiKey = process.env.DEEPINFRA_API_KEY
  if (!apiKey) {
    die('DEEPINFRA_API_KEY não configurada — veja .env.example')
  }

  const photo = resolve(options.photo)
  try {
    await stat(photo)
  } catch {
    die(`${options.photo} não existe`)
  }

  const { imageUri, width, height, crop } = await buildFillInputs(
    photo,
    options.mask !== null ? resolve(options.mask) : null,
    options.extend,
  )
  console.log(
    `\n[images:fill] ${basename(photo)} → canvas ${width}×${height} (${FILL_MODEL}, ${options.steps} passos)\n`,
  )

  // Hard preservation clause first: FLUX-2 keeps the photo only when told
  // in no uncertain terms to leave it untouched (img2img outpaint strategy).
  const prompt = `Mantenha a fotografia EXATAMENTE como está, sem alterar um único detalhe fora da área a completar. ${options.prompt}`
  const body = {
    prompt,
    image: imageUri,
    width,
    height,
    steps: options.steps,
    guidance: 30,
  }
  let response
  try {
    response = await fetch(FILL_INFERENCE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    })
  } catch (error) {
    die(`falha ao chamar o DeepInfra: ${error instanceof Error ? error.message : String(error)}`)
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : `HTTP ${response.status}`
    die(`DeepInfra respondeu erro: ${detail}`)
  }

  const base64 = extractOutputBase64(payload)
  if (!base64) {
    die('resposta inesperada do DeepInfra (sem imagem no output)')
  }

  const masterDir = resolve('data/ai-fill')
  await mkdir(masterDir, { recursive: true })
  const masterPath = join(masterDir, `${parse(photo).name}-fill.png`)
  const masterBuffer = await sharp(
    Buffer.from(base64.replace(/^data:image\/[a-z0-9+]+;base64,/, ''), 'base64'),
  )
    .extract(crop)
    .png()
    .toBuffer()
  await writeFile(masterPath, masterBuffer)
  const { width: outWidth, height: outHeight } = await sharp(masterPath).metadata()
  console.log(`[images:fill] mestre em ${masterPath} (${outWidth}×${outHeight})\n`)

  if (options.resize) {
    await runResizeImages({
      help: false,
      paths: [masterPath],
      maxWidth: undefined,
      quality: undefined,
      formats: ['avif', 'webp'],
      outDir: resolve(options.outDir),
      removeBg: false,
    })
  }
}

main().catch((error) => die(error instanceof Error ? error.message : String(error)))
