/**
 * Issue `model:` slug → Cursor Cloud `model.id` resolution
 * (docs/plans/agent-pool-orchestrator.md §5).
 *
 * Two namespaces meet here: the repo's model-selection slugs (frontmatter
 * `model:`) and the Cloud API ids. The live table (`GET /v1/models`) is the
 * authority — a slug resolves by exact id or alias, the repo `-fast` suffix
 * maps to the model's `fast` param when the table says it exists, and
 * anything else falls back to composer-2.5 (pool "Cursor Models", included
 * cost — model-selection rule 1). The fallback never crashes a tick.
 */

export const POOL_DEFAULT_MODEL_SLUG = 'composer-2.5'

const FAST_SUFFIX = '-fast'

const findModel = (models, slug) =>
  models.find((model) => model.id === slug || (model.aliases ?? []).includes(slug)) ?? null

/**
 * @param {unknown} issueModel frontmatter `model:` value
 * @param {Array<{ id: string, aliases?: string[], parameters?: Array<{ id: string }> }>} [apiModels] live /v1/models items
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

  if (requested.endsWith(FAST_SUFFIX)) {
    const base = findModel(apiModels, requested.slice(0, -FAST_SUFFIX.length))
    const supportsFast = (base?.parameters ?? []).some((param) => param.id === 'fast')
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
