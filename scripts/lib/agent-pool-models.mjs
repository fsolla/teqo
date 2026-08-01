/**
 * Issue `model:` slug → Cursor Cloud `model.id` (+ params) resolution
 * (docs/plans/agent-pool-orchestrator.md §5; skill model-selection).
 *
 * Two namespaces meet here: the repo's model-selection slugs (frontmatter
 * `model:`) and the Cloud API ids. The live table (`GET /v1/models`) is the
 * authority.
 *
 * Repo slugs (Issue frontmatter / pool / skills):
 *   - `composer-2.5` / `composer-2.5-fast`
 *   - `cursor-grok-4.5-low` | `cursor-grok-4.5-medium` | `cursor-grok-4.5-high`
 *     (+ optional `-fast`) → API `grok-4.5` + `effort` (+ `fast`)
 *   - `kimi-k3-low` (also `kimi-k3-high` / `kimi-k3-max`) → API `kimi-k3` + `reasoning`
 *
 * Anything else falls back to composer-2.5 (pool "Cursor Models", included
 * cost — model-selection rule 1). The fallback never crashes a tick.
 */

export const POOL_DEFAULT_MODEL_SLUG = 'composer-2.5'

const FAST_SUFFIX = '-fast'
const GROK_EFFORT_SLUG = /^cursor-grok-4\.5-(low|medium|high)(-fast)?$/
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
 * @param {unknown} issueModel frontmatter `model:` value
 * @param {Array<{ id: string, aliases?: string[], parameters?: Array<{ id: string, values?: Array<{ value: string }> }> }>} [apiModels] live /v1/models items
 * @returns {{ model: { id: string, params?: Array<{ id: string, value: string }> }, requested: string | null, usedFallback: boolean, warn?: string }}
 */
export const resolvePoolModel = (issueModel, apiModels = []) => {
  const requested =
    typeof issueModel === 'string' && issueModel.trim() !== '' ? issueModel.trim() : null

  const fallback = () => {
    const known = findModel(apiModels, POOL_DEFAULT_MODEL_SLUG)
    const tableNote = apiModels.length === 0 ? ' (tabela /v1/models indisponível)' : ''
    return {
      model: { id: known?.id ?? POOL_DEFAULT_MODEL_SLUG },
      requested,
      usedFallback: requested !== null,
      ...(requested
        ? {
            warn: `modelo "${requested}" fora da tabela Cloud — fallback ${POOL_DEFAULT_MODEL_SLUG}${tableNote}`,
          }
        : {}),
    }
  }

  if (!requested) return fallback()

  const grokMatch = GROK_EFFORT_SLUG.exec(requested)
  if (grokMatch) {
    const effort = grokMatch[1]
    const wantFast = Boolean(grokMatch[2])
    const base =
      findModel(apiModels, 'grok-4.5') ??
      findModel(apiModels, 'cursor-grok-4.5') ??
      (apiModels.length === 0
        ? { id: 'grok-4.5', parameters: [{ id: 'effort' }, { id: 'fast' }] }
        : null)
    if (
      base &&
      paramSupportsValue(base, 'effort', effort) &&
      (!wantFast || paramSupportsValue(base, 'fast', 'true'))
    ) {
      /** @type {Array<{ id: string, value: string }>} */
      const params = [{ id: 'effort', value: effort }]
      if (wantFast) params.push({ id: 'fast', value: 'true' })
      return { model: { id: base.id, params }, requested, usedFallback: false }
    }
  }

  const kimiMatch = KIMI_REASONING_SLUG.exec(requested)
  if (kimiMatch) {
    const reasoning = kimiMatch[1]
    const base =
      findModel(apiModels, 'kimi-k3') ??
      (apiModels.length === 0 ? { id: 'kimi-k3', parameters: [{ id: 'reasoning' }] } : null)
    if (base && paramSupportsValue(base, 'reasoning', reasoning)) {
      return {
        model: { id: base.id, params: [{ id: 'reasoning', value: reasoning }] },
        requested,
        usedFallback: false,
      }
    }
  }

  if (requested.endsWith(FAST_SUFFIX)) {
    const base = findModel(apiModels, requested.slice(0, -FAST_SUFFIX.length))
    const supportsFast = paramSupportsValue(base ?? {}, 'fast', 'true')
    if (base && supportsFast) {
      return {
        model: { id: base.id, params: [{ id: 'fast', value: 'true' }] },
        requested,
        usedFallback: false,
      }
    }
  }

  const direct = findModel(apiModels, requested)
  if (direct) return { model: { id: direct.id }, requested, usedFallback: false }

  return fallback()
}
