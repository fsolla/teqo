/**
 * Issue `model:` slug → Cursor Cloud `model.id` (+ params) resolution
 * (docs/plans/agent-pool-orchestrator.md §5; skill model-selection).
 *
 * Two namespaces meet here: the repo's model-selection slugs (frontmatter
 * `model:`) and the Cloud API ids. The live table (`GET /v1/models`) is the
 * authority.
 *
 * Repo slugs (Issue frontmatter / pool / skills) — **no `-fast`**:
 *   - `composer-2.5`
 *   - `cursor-grok-4.5-low` | `cursor-grok-4.5-medium` | `cursor-grok-4.5-high`
 *     → API `grok-4.5` + `effort`
 *   - `kimi-k3-low` (also `kimi-k3-high` / `kimi-k3-max`) → API `kimi-k3` + `reasoning`
 *
 * A slug ending in `-fast` is rejected (stripped + warn, then resolve the
 * base). Anything else unknown falls back to composer-2.5. The fallback
 * never crashes a tick.
 */

export const POOL_DEFAULT_MODEL_SLUG = 'composer-2.5'

const GROK_EFFORT_SLUG = /^cursor-grok-4\.5-(low|medium|high)$/
const KIMI_REASONING_SLUG = /^kimi-k3-(low|high|max)$/

const findModel = (models, slug) =>
  models.find((model) => model.id === slug || (model.aliases ?? []).includes(slug)) ?? null

const paramSupportsValue = (model, paramId, value) => {
  const param = (model.parameters ?? []).find((entry) => entry.id === paramId)
  if (!param) return false
  const values = param.values
  if (!Array.isArray(values) || values.length === 0) return true
  return values.some((entry) => entry.value === value)
}

/**
 * Resolve a canonical (non-fast) slug against the live table.
 * @returns {{ model: { id: string, params?: Array<{ id: string, value: string }> }, ok: true } | { ok: false }}
 */
const resolveCanonical = (slug, apiModels) => {
  const grokMatch = GROK_EFFORT_SLUG.exec(slug)
  if (grokMatch) {
    const effort = grokMatch[1]
    const base =
      findModel(apiModels, 'grok-4.5') ??
      findModel(apiModels, 'cursor-grok-4.5') ??
      (apiModels.length === 0 ? { id: 'grok-4.5', parameters: [{ id: 'effort' }] } : null)
    if (base && paramSupportsValue(base, 'effort', effort)) {
      return {
        ok: true,
        model: { id: base.id, params: [{ id: 'effort', value: effort }] },
      }
    }
    return { ok: false }
  }

  const kimiMatch = KIMI_REASONING_SLUG.exec(slug)
  if (kimiMatch) {
    const reasoning = kimiMatch[1]
    const base =
      findModel(apiModels, 'kimi-k3') ??
      (apiModels.length === 0 ? { id: 'kimi-k3', parameters: [{ id: 'reasoning' }] } : null)
    if (base && paramSupportsValue(base, 'reasoning', reasoning)) {
      return {
        ok: true,
        model: { id: base.id, params: [{ id: 'reasoning', value: reasoning }] },
      }
    }
    return { ok: false }
  }

  const direct = findModel(apiModels, slug)
  if (direct) return { ok: true, model: { id: direct.id } }
  return { ok: false }
}

/**
 * @param {unknown} issueModel frontmatter `model:` value
 * @param {Array<{ id: string, aliases?: string[], parameters?: Array<{ id: string, values?: Array<{ value: string }> }> }>} [apiModels] live /v1/models items
 * @returns {{ model: { id: string, params?: Array<{ id: string, value: string }> }, requested: string | null, usedFallback: boolean, warn?: string }}
 */
export const resolvePoolModel = (issueModel, apiModels = []) => {
  const requested =
    typeof issueModel === 'string' && issueModel.trim() !== '' ? issueModel.trim() : null

  const fallback = (warn) => {
    const known = findModel(apiModels, POOL_DEFAULT_MODEL_SLUG)
    const tableNote = apiModels.length === 0 ? ' (tabela /v1/models indisponível)' : ''
    return {
      model: { id: known?.id ?? POOL_DEFAULT_MODEL_SLUG },
      requested,
      usedFallback: requested !== null,
      ...(requested
        ? {
            warn:
              warn ??
              `modelo "${requested}" fora da tabela Cloud — fallback ${POOL_DEFAULT_MODEL_SLUG}${tableNote}`,
          }
        : {}),
    }
  }

  if (!requested) return fallback()

  let slug = requested
  /** @type {string | undefined} */
  let fastWarn
  if (slug.endsWith('-fast')) {
    slug = slug.slice(0, -'-fast'.length)
    fastWarn = `sufixo -fast não é permitido (pedido "${requested}") — resolvendo como "${slug}"`
  }

  const resolved = resolveCanonical(slug, apiModels)
  if (resolved.ok) {
    return {
      model: resolved.model,
      requested,
      usedFallback: false,
      ...(fastWarn ? { warn: fastWarn } : {}),
    }
  }

  return fallback(
    fastWarn
      ? `${fastWarn}; base também inválida — fallback ${POOL_DEFAULT_MODEL_SLUG}`
      : undefined,
  )
}
