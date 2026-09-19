/**
 * C196 — the reel shot list: the single source of truth of one tutorial reel.
 * The skill edits this file (natural-language adjustment is translated here)
 * and re-runs the build; the rendered MP4 is never edited.
 *
 * A shot list has a `hook` (graphic), N `capture` scenes (the real site driven
 * in a mobile viewport) and a `cta` (graphic). Capture scenes declare invisible
 * `setup` steps (scroll/prepare, outside the recorded clip) and visible `steps`
 * (paced clicks/typing that the viewer sees), plus the burned caption and the
 * step badge of the design artifact.
 *
 * Pure module: no browser, no ffmpeg, no I/O beyond reading the JSON file.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { sha256Hex } from './cli.mjs'

const SHOT_LIST_DIR = 'scripts/reels/shot-lists'

/**
 * @typedef {{
 *   slug: string, title: string, feature: string, route: string,
 *   fixture: Record<string, unknown>,
 *   scenes: Array<{
 *     id: string, kind: string,
 *     template?: string, durationMs?: number,
 *     badge?: { number: number, total: number, label: string },
 *     caption?: { parts: Array<{ text: string, accent?: boolean }> } | null,
 *     setup: Array<{ action: string, selector: string }>,
 *     steps: Array<{ action: string, selector: string, value?: string, pauseMs?: number, zoom?: boolean }>,
 *     leadInMs: number, trailOutMs: number, captionDelayMs: number, captionDurationMs: number | null,
 *   }>,
 * }} ShotList
 */

const SCENE_KINDS = new Set(['capture', 'graphic'])
const GRAPHIC_TEMPLATES = new Set(['hook', 'cta'])
const SETUP_ACTIONS = new Set(['scrollIntoView'])
const STEP_ACTIONS = new Set(['click', 'fill', 'waitFor', 'download'])

const fail = (message) => {
  throw new Error(`Shot list: ${message}`)
}

const assertObject = (value, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} deve ser um objeto.`)
  }
}

const assertString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} deve ser string não vazia.`)
  return value.trim()
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
    const text = assertString(part.text, `${label}.parts[${index}].text`)
    return part.accent === true ? { text, accent: true } : { text }
  })
  return { parts }
}

const normalizeBadge = (raw, label) => {
  assertObject(raw, label)
  const number = assertPositiveInt(raw.number, `${label}.number`, { max: 99 })
  const total = assertPositiveInt(raw.total, `${label}.total`, { max: 99 })
  if (number > total) fail(`${label}.number não pode ser maior que total.`)
  const labelText = assertString(raw.label, `${label}.label`)
  return { number, total, label: labelText }
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
  const allowedKeys = new Set(['action', 'selector', 'value', 'pauseMs', 'zoom'])
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
    if (action === 'fill' && step.value !== undefined) {
      normalized.value = assertString(step.value, `${label}[${index}].value`)
    }
    if (step.zoom !== undefined) {
      if (typeof step.zoom !== 'boolean') fail(`${label}[${index}].zoom deve ser boolean.`)
      normalized.zoom = step.zoom
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
  if (scenes[0].kind !== 'graphic' || scenes[0].template !== 'hook')
    fail('a primeira cena deve ser o hook.')
  const last = scenes[scenes.length - 1]
  if (last.kind !== 'graphic' || last.template !== 'cta') fail('a última cena deve ser o CTA.')
  return {
    slug,
    title: assertString(raw.title ?? slug, 'title'),
    feature: assertString(raw.feature ?? slug, 'feature'),
    route,
    fixture,
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
