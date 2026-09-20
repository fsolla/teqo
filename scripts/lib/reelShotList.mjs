/**
 * C196 — the reel shot list: the single source of truth of one tutorial reel.
 * The skill edits this file (natural-language adjustment is translated here)
 * and re-runs the build; the rendered MP4 is never edited.
 *
 * A shot list has a `hook` (graphic), N `capture` scenes (the real site driven
 * in a mobile viewport) and a `cta` (graphic). Capture scenes declare invisible
 * `setup` steps (scroll/prepare, outside the recorded clip) and visible `steps`
 * (paced clicks/typing/file pick that the viewer sees), plus the burned caption
 * and the step badge of the design artifact.
 *
 * C197 adds the spoken script: an optional `narration` per scene (capture
 * scenes fall back to the burned caption, graphic scenes are silent without
 * one) and the top-level `coverAlt` of the cover. Both enter the normalized
 * object, so the shot list hash identifies them too.
 *
 * The graphic copy lives in the shot list (`graphics.hook/cta/profile` and the
 * package `graphics.cover`): the templates carry structure, the reel carries
 * its message. The capture overlay is a command rail, not a central caption
 * card.
 *
 * Pure module: no browser, no ffmpeg, no I/O beyond reading the JSON file.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { sha256Hex } from './cli.mjs'

const SHOT_LIST_DIR = 'scripts/reels/shot-lists'
const NARRATION_MAX_LENGTH = 600

/**
 * @typedef {{
 *   slug: string, title: string, feature: string, route: string,
 *   coverAlt: string,
 *   fixture: Record<string, unknown>,
 *   graphics: Record<string, {
 *     eyebrow: string, headlineLines: string[], accentIndex: number | null,
 *     sub?: string, tag?: string, instruction?: string, apps?: string[],
 *     actionLines?: string[], url?: string,
 *   }>,
 *   scenes: Array<{
 *     id: string, kind: string,
 *     template?: string, durationMs?: number,
 *     badge?: { number?: number, total?: number, label: string },
 *     caption?: { parts: Array<{ text: string, accent?: boolean }> } | null,
 *     narration?: string | null,
 *     setup: Array<{ action: string, selector: string }>,
 *     steps: Array<{ action: string, selector: string, value?: string, pauseMs?: number, zoom?: boolean }>,
 *     leadInMs: number, trailOutMs: number, captionDelayMs: number, captionDurationMs: number | null,
 *   }>,
 * }} ShotList
 */

const SCENE_KINDS = new Set(['capture', 'graphic'])
const GRAPHIC_TEMPLATES = new Set(['hook', 'cta', 'profile'])
/** Copy keys of each graphic template; `cover` is a package template, not a scene. */
const GRAPHIC_COPY_KEYS = {
  hook: ['eyebrow', 'headlineLines', 'accentIndex', 'sub'],
  cta: ['eyebrow', 'headlineLines', 'accentIndex', 'actionLines', 'sub', 'url'],
  profile: ['eyebrow', 'headlineLines', 'accentIndex', 'instruction', 'apps'],
  cover: ['eyebrow', 'headlineLines', 'accentIndex', 'sub', 'tag'],
}
const COPY_ORDER = ['hook', 'cta', 'profile', 'cover']
const MAX_HEADLINE_LINES = 3
const SETUP_ACTIONS = new Set(['scrollIntoView'])
const STEP_ACTIONS = new Set([
  'click',
  'fill',
  'waitFor',
  'download',
  'upload',
  'scrollIntoView',
  'swipe',
])
/** Actions whose `value` is meaningful: the inline text (`fill`) or file (`upload`). */
const VALUE_ACTIONS = new Set(['fill', 'upload'])

const fail = (message) => {
  throw new Error(`Shot list: ${message}`)
}

const assertObject = (value, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} deve ser um objeto.`)
  }
}

const assertString = (value, label, { trim = true } = {}) => {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} deve ser string não vazia.`)
  return trim ? value.trim() : value
}

const assertPositiveInt = (value, label, { max = 120000 } = {}) => {
  if (!Number.isInteger(value) || value <= 0 || value > max) {
    fail(`${label} deve ser inteiro entre 1 e ${max}.`)
  }
  return value
}

const assertSelector = (value, label) => {
  const selector = assertString(value, label)
  if (selector.length > 240) fail(`${label} longo demais.`)
  return selector
}

const normalizeCaption = (raw, label) => {
  if (raw === undefined || raw === null) return null
  assertObject(raw, label)
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) fail(`${label}.parts deve ter itens.`)
  const parts = raw.parts.map((part, index) => {
    assertObject(part, `${label}.parts[${index}]`)
    // The authored spacing between parts is part of the caption AND of the
    // narration fallback — validated, never trimmed away.
    const text = assertString(part.text, `${label}.parts[${index}].text`, { trim: false })
    return part.accent === true ? { text, accent: true } : { text }
  })
  return { parts }
}

const normalizeNarration = (raw, label) => {
  if (raw === undefined || raw === null) return null
  const text = assertString(raw, label)
  if (text.length > NARRATION_MAX_LENGTH) {
    fail(`${label} excede ${NARRATION_MAX_LENGTH} caracteres.`)
  }
  return text
}

const normalizeBadge = (raw, label) => {
  assertObject(raw, label)
  const labelText = assertString(raw.label, `${label}.label`)
  // The guiding scene carries a label pill; numbered steps carry `n/total`.
  if (raw.number === undefined && raw.total === undefined) return { label: labelText }
  const number = assertPositiveInt(raw.number, `${label}.number`, { max: 99 })
  const total = assertPositiveInt(raw.total, `${label}.total`, { max: 99 })
  if (number > total) fail(`${label}.number não pode ser maior que total.`)
  return { number, total, label: labelText }
}

const normalizeCopyLines = (raw, label, max) => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > max) {
    fail(`${label} deve ter de 1 a ${max} linhas.`)
  }
  return raw.map((line, index) => assertString(line, `${label}[${index}]`))
}

const normalizeAccentIndex = (raw, lines, label) => {
  if (raw === undefined || raw === null) return null
  if (!Number.isInteger(raw) || raw < 0 || raw >= lines.length) {
    fail(`${label} deve indexar uma linha do título.`)
  }
  return raw
}

const normalizeGraphicCopy = (raw, label, keys) => {
  assertObject(raw, label)
  for (const key of Object.keys(raw)) {
    if (!keys.includes(key)) fail(`${label}.${key} não é uma chave válida (${keys}).`)
  }
  const copy = { eyebrow: assertString(raw.eyebrow, `${label}.eyebrow`) }
  copy.headlineLines = normalizeCopyLines(
    raw.headlineLines,
    `${label}.headlineLines`,
    MAX_HEADLINE_LINES,
  )
  copy.accentIndex = normalizeAccentIndex(
    raw.accentIndex,
    copy.headlineLines,
    `${label}.accentIndex`,
  )
  if (keys.includes('sub')) copy.sub = assertString(raw.sub, `${label}.sub`)
  if (keys.includes('tag')) copy.tag = assertString(raw.tag, `${label}.tag`)
  if (keys.includes('instruction')) {
    copy.instruction = assertString(raw.instruction, `${label}.instruction`)
  }
  if (keys.includes('apps')) {
    if (!Array.isArray(raw.apps) || raw.apps.length !== 2) fail(`${label}.apps deve ter 2 apps.`)
    copy.apps = raw.apps.map((app, index) => assertString(app, `${label}.apps[${index}]`))
  }
  if (keys.includes('actionLines')) {
    copy.actionLines = normalizeCopyLines(raw.actionLines, `${label}.actionLines`, 2)
  }
  if (keys.includes('url')) copy.url = assertString(raw.url, `${label}.url`)
  return copy
}

const normalizeSetup = (raw, label) => {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) fail(`${label} deve ser uma lista.`)
  return raw.map((step, index) => {
    assertObject(step, `${label}[${index}]`)
    const action = assertString(step.action, `${label}[${index}].action`)
    if (!SETUP_ACTIONS.has(action)) {
      fail(`${label}[${index}].action "${action}" não é um setup válido (${[...SETUP_ACTIONS]}).`)
    }
    return { action, selector: assertSelector(step.selector, `${label}[${index}].selector`) }
  })
}

const normalizeSteps = (raw, label) => {
  if (!Array.isArray(raw) || raw.length === 0) fail(`${label} deve ter ao menos um passo.`)
  const allowedKeys = new Set(['action', 'selector', 'value', 'pauseMs', 'zoom', 'distance'])
  return raw.map((step, index) => {
    assertObject(step, `${label}[${index}]`)
    for (const key of Object.keys(step)) {
      if (!allowedKeys.has(key)) fail(`${label}[${index}].${key} não é uma chave válida.`)
    }
    const action = assertString(step.action, `${label}[${index}].action`)
    if (!STEP_ACTIONS.has(action)) {
      fail(`${label}[${index}].action "${action}" inválida (${[...STEP_ACTIONS]}).`)
    }
    const normalized = {
      action,
      selector: assertSelector(step.selector, `${label}[${index}].selector`),
    }
    if (step.value !== undefined && !VALUE_ACTIONS.has(action)) {
      fail(`${label}[${index}].value só é válido em ${[...VALUE_ACTIONS]} (ação "${action}").`)
    }
    if (step.value !== undefined) {
      normalized.value = assertString(step.value, `${label}[${index}].value`)
    }
    if (step.zoom !== undefined) {
      if (typeof step.zoom !== 'boolean') fail(`${label}[${index}].zoom deve ser boolean.`)
      normalized.zoom = step.zoom
    }
    if (step.distance !== undefined) {
      if (action !== 'swipe') fail(`${label}[${index}].distance só é válido em swipe.`)
      normalized.distance = assertPositiveInt(step.distance, `${label}[${index}].distance`, {
        max: 1000,
      })
    }
    if (step.pauseMs !== undefined) {
      normalized.pauseMs = assertPositiveInt(step.pauseMs, `${label}[${index}].pauseMs`, {
        max: 10000,
      })
    }
    return normalized
  })
}

const normalizeCaptureScene = (scene, index) => {
  const label = `scenes[${index}]`
  const id = assertString(scene.id, `${label}.id`)
  const normalized = {
    id,
    kind: 'capture',
    badge: normalizeBadge(scene.badge, `${label}.badge`),
    caption: normalizeCaption(scene.caption, `${label}.caption`),
    narration: normalizeNarration(scene.narration, `${label}.narration`),
    setup: normalizeSetup(scene.setup, `${label}.setup`),
    steps: normalizeSteps(scene.steps, `${label}.steps`),
    leadInMs:
      scene.leadInMs === undefined
        ? 700
        : assertPositiveInt(scene.leadInMs, `${label}.leadInMs`, { max: 10000 }),
    trailOutMs:
      scene.trailOutMs === undefined
        ? 800
        : assertPositiveInt(scene.trailOutMs, `${label}.trailOutMs`, { max: 10000 }),
    captionDelayMs:
      scene.captionDelayMs === undefined
        ? 250
        : assertPositiveInt(scene.captionDelayMs, `${label}.captionDelayMs`, { max: 10000 }),
    captionDurationMs:
      scene.captionDurationMs === undefined
        ? null
        : assertPositiveInt(scene.captionDurationMs, `${label}.captionDurationMs`, { max: 30000 }),
  }
  if (normalized.caption === null) fail(`${label}.caption é obrigatória em cena de captura.`)
  return normalized
}

const normalizeGraphicScene = (scene, index) => {
  const label = `scenes[${index}]`
  const template = assertString(scene.template, `${label}.template`)
  if (!GRAPHIC_TEMPLATES.has(template)) {
    fail(`${label}.template "${template}" inválido (${[...GRAPHIC_TEMPLATES]}).`)
  }
  return {
    id: assertString(scene.id, `${label}.id`),
    kind: 'graphic',
    template,
    durationMs: assertPositiveInt(scene.durationMs, `${label}.durationMs`, { max: 15000 }),
    narration: normalizeNarration(scene.narration, `${label}.narration`),
  }
}

/**
 * Validates and normalizes the raw JSON of a shot list (pure).
 *
 * @param {Record<string, unknown>} raw
 * @returns {ShotList}
 */
export const normalizeShotList = (raw) => {
  assertObject(raw, 'raiz')
  const slug = assertString(raw.slug, 'slug')
  if (!/^[a-z0-9-]+$/.test(slug)) fail('slug deve ser kebab-case (a-z, 0-9, -).')
  const route = assertString(raw.route ?? '/', 'route')
  if (!route.startsWith('/')) fail('route deve começar com "/".')
  assertObject(raw.fixture ?? {}, 'fixture')
  const fixture = raw.fixture ?? {}
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0)
    fail('scenes deve ter ao menos uma cena.')
  const scenes = raw.scenes.map((scene, index) => {
    assertObject(scene, `scenes[${index}]`)
    const kind = assertString(scene.kind, `scenes[${index}].kind`)
    if (!SCENE_KINDS.has(kind)) fail(`scenes[${index}].kind "${kind}" inválido.`)
    return kind === 'capture'
      ? normalizeCaptureScene(scene, index)
      : normalizeGraphicScene(scene, index)
  })
  const ids = new Set(scenes.map((scene) => scene.id))
  if (ids.size !== scenes.length) fail('ids de cena precisam ser únicos.')
  const usesFixtureName = scenes.some(
    (scene) =>
      scene.kind === 'capture' &&
      scene.steps.some((step) => step.action === 'fill' && step.value === undefined),
  )
  if (usesFixtureName && typeof fixture.cardName !== 'string') {
    fail('fixture.cardName é obrigatório quando um passo fill não declara value.')
  }
  const usesFixturePhoto = scenes.some(
    (scene) =>
      (scene.kind === 'capture' &&
        scene.steps.some((step) => step.action === 'upload' && step.value === undefined)) ||
      (scene.kind === 'graphic' && scene.template === 'profile'),
  )
  if (usesFixturePhoto && typeof fixture.photo !== 'string') {
    fail('fixture.photo é obrigatório no upload de foto e na cena profile.')
  }
  if (scenes[0].kind !== 'graphic' || scenes[0].template !== 'hook')
    fail('a primeira cena deve ser o hook.')
  const last = scenes[scenes.length - 1]
  if (last.kind !== 'graphic' || last.template !== 'cta') fail('a última cena deve ser o CTA.')
  const rawGraphics = raw.graphics ?? {}
  assertObject(rawGraphics, 'graphics')
  for (const key of Object.keys(rawGraphics)) {
    if (!(key in GRAPHIC_COPY_KEYS)) fail(`graphics.${key} não é um template válido.`)
  }
  const usedTemplates = new Set(
    scenes.filter((scene) => scene.kind === 'graphic').map((scene) => scene.template),
  )
  usedTemplates.add('cover')
  const graphics = {}
  for (const template of COPY_ORDER) {
    if (!usedTemplates.has(template)) continue
    const rawCopy = rawGraphics[template]
    if (rawCopy === undefined) fail(`graphics.${template} é obrigatório (copy do template).`)
    graphics[template] = normalizeGraphicCopy(
      rawCopy,
      `graphics.${template}`,
      GRAPHIC_COPY_KEYS[template],
    )
  }
  const title = assertString(raw.title ?? slug, 'title')
  return {
    slug,
    title,
    feature: assertString(raw.feature ?? slug, 'feature'),
    route,
    coverAlt:
      raw.coverAlt === undefined || raw.coverAlt === null
        ? title
        : assertString(raw.coverAlt, 'coverAlt'),
    fixture,
    graphics,
    scenes,
  }
}

/** Deterministic sha256 of the normalized shot list — the reel version. */
export const shotListHash = (shotList) => sha256Hex(Buffer.from(JSON.stringify(shotList), 'utf8'))

const shotListPath = ({ slug, root = process.cwd() }) =>
  resolve(root, SHOT_LIST_DIR, `${slug}.json`)

/**
 * Reads + normalizes a shot list; returns it with its hash.
 *
 * @param {{ slug: string, root?: string }} options
 * @returns {Promise<{ shotList: ShotList, hash: string }>}
 */
export const loadShotList = async ({ slug, root = process.cwd() }) => {
  const path = shotListPath({ slug, root })
  let raw
  try {
    raw = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT')
      fail(`não encontrei ${path}. Rode a skill a partir da raiz do repo.`)
    throw new Error(`Shot list inválido em ${path}: ${error.message}`)
  }
  const shotList = normalizeShotList(raw)
  if (shotList.slug !== slug) fail(`slug do arquivo ("${shotList.slug}") difere de "${slug}".`)
  return { shotList, hash: shotListHash(shotList) }
}

export const captureScenes = (shotList) =>
  shotList.scenes.filter((scene) => scene.kind === 'capture')
export const graphicScenes = (shotList) =>
  shotList.scenes.filter((scene) => scene.kind === 'graphic')
