/**
 * Production deploy cooldown — queries Vercel for the last READY production
 * deployment and computes whether CI should defer another upload (OPS11).
 */

export const DEPLOY_COOLDOWN_MS = 15 * 60 * 1000

const VERCEL_API_BASE = 'https://api.vercel.com'

/**
 * @param {number | null | undefined} lastReadyAtMs
 * @param {number} [nowMs]
 */
export const computeCooldownWait = (lastReadyAtMs, nowMs = Date.now()) => {
  if (lastReadyAtMs == null || !Number.isFinite(lastReadyAtMs)) {
    return { active: false, waitSeconds: 0, ageMs: null }
  }

  const ageMs = nowMs - lastReadyAtMs
  const remainingMs = DEPLOY_COOLDOWN_MS - ageMs

  if (remainingMs <= 0) {
    return { active: false, waitSeconds: 0, ageMs }
  }

  return {
    active: true,
    waitSeconds: Math.ceil(remainingMs / 1000),
    ageMs,
  }
}

/**
 * @param {unknown} deployment
 * @returns {number | null}
 */
export const lastProductionReadyAtFromDeployment = (deployment) => {
  if (!deployment || typeof deployment !== 'object') return null
  const ready = /** @type {{ ready?: unknown; createdAt?: unknown }} */ (deployment).ready
  const createdAt = /** @type {{ ready?: unknown; createdAt?: unknown }} */ (deployment).createdAt
  const timestamp = ready ?? createdAt
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null
}

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   fetchImpl?: typeof fetch
 * }} options
 * @returns {Promise<number | null>}
 */
export const fetchLastProductionReadyAt = async ({
  token,
  projectId,
  teamId,
  fetchImpl = fetch,
}) => {
  const params = new URLSearchParams({
    projectId,
    teamId,
    target: 'production',
    state: 'READY',
    limit: '1',
  })

  const response = await fetchImpl(`${VERCEL_API_BASE}/v6/deployments?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  })

  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel API returned non-JSON (${response.status})`)
  }

  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel deployments API ${response.status}: ${message}`)
  }

  const deployments = Array.isArray(body.deployments) ? body.deployments : []
  return lastProductionReadyAtFromDeployment(deployments[0])
}

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   fetchImpl?: typeof fetch
 *   nowMs?: number
 * }} options
 */
export const evaluateDeployCooldown = async ({
  token,
  projectId,
  teamId,
  fetchImpl = fetch,
  nowMs = Date.now(),
}) => {
  const lastProductionDeployAt = await fetchLastProductionReadyAt({
    token,
    projectId,
    teamId,
    fetchImpl,
  })
  const { active, waitSeconds, ageMs } = computeCooldownWait(lastProductionDeployAt, nowMs)

  return {
    active,
    waitSeconds,
    ageMs,
    lastProductionDeployAt,
  }
}
