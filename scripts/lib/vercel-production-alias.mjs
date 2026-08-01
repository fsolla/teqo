/**
 * Ensure a Vercel production deployment is assigned to custom domains.
 *
 * Disabling Git auto-deploy (`git.deploymentEnabled: false`) is correct for
 * Actions-gated deploys. Separately, project setting
 * `autoAssignCustomDomains` must stay ON — when OFF, `vercel deploy --prod`
 * creates a staged production deployment that only gets `*.vercel.app` and
 * leaves custom domains (e.g. pt.jorgesolla.com.br) on an older Current.
 */

const VERCEL_API_BASE = 'https://api.vercel.com'

/** Canonical Teqo production hostname — WordPress stays on jorgesolla.com.br. */
export const PRODUCTION_CUSTOM_DOMAIN = 'pt.jorgesolla.com.br'

/**
 * @param {string} value
 * @returns {string}
 */
export const normalizeHostname = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()

/**
 * @param {unknown} aliases
 * @param {string} expectedHost
 */
export const aliasesIncludeHost = (aliases, expectedHost) => {
  const want = normalizeHostname(expectedHost)
  if (!want) return false
  if (!Array.isArray(aliases)) return false
  return aliases.some((alias) => normalizeHostname(alias) === want)
}

/**
 * Normalize a CLI stdout URL / inspect path / bare id into something the
 * deployments GET endpoint accepts (`dpl_…`, short id, or hostname).
 * @param {string} deploymentRef
 * @returns {{ kind: 'id' | 'url'; value: string }}
 */
export const parseDeploymentRef = (deploymentRef) => {
  const raw = String(deploymentRef ?? '').trim()
  if (!raw) throw new Error('deployment ref is required')
  if (/^dpl_[A-Za-z0-9]+$/.test(raw)) return { kind: 'id', value: raw }

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    // Dashboard inspect: vercel.com/{team}/{project}/{deploymentId}
    if (url.hostname === 'vercel.com') {
      const pathId = url.pathname.split('/').filter(Boolean).at(-1)
      if (pathId && /^[A-Za-z0-9]+$/.test(pathId)) return { kind: 'id', value: pathId }
    }
    if (url.hostname.endsWith('.vercel.app') || url.hostname.includes('.')) {
      return { kind: 'url', value: url.hostname }
    }
  } catch {
    // fall through
  }

  if (/^[A-Za-z0-9_]+$/.test(raw)) return { kind: 'id', value: raw }
  return { kind: 'url', value: normalizeHostname(raw) }
}

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   fetchImpl?: typeof fetch
 * }} options
 */
const fetchVercelProject = async ({ token, projectId, teamId, fetchImpl = fetch }) => {
  const params = new URLSearchParams({ teamId })
  const response = await fetchImpl(`${VERCEL_API_BASE}/v9/projects/${projectId}?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel project API returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel project API ${response.status}: ${message}`)
  }
  return body
}

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   enabled: boolean
 *   fetchImpl?: typeof fetch
 * }} options
 */
const setAutoAssignCustomDomains = async ({
  token,
  projectId,
  teamId,
  enabled,
  fetchImpl = fetch,
}) => {
  const params = new URLSearchParams({ teamId })
  const response = await fetchImpl(`${VERCEL_API_BASE}/v9/projects/${projectId}?${params}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ autoAssignCustomDomains: enabled }),
  })
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel project PATCH returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel project PATCH ${response.status}: ${message}`)
  }
  return body
}

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   deploymentId: string
 *   fetchImpl?: typeof fetch
 * }} options
 */
const promoteProductionDeployment = async ({
  token,
  projectId,
  teamId,
  deploymentId,
  fetchImpl = fetch,
}) => {
  const params = new URLSearchParams({ teamId })
  const response = await fetchImpl(
    `${VERCEL_API_BASE}/v10/projects/${projectId}/promote/${deploymentId}?${params}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: '{}',
    },
  )
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    body = { raw: bodyText }
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel promote API ${response.status}: ${message}`)
  }
  return body
}

/**
 * @param {{
 *   token: string
 *   teamId: string
 *   deploymentIdOrUrl: string
 *   fetchImpl?: typeof fetch
 * }} options
 */
const fetchDeploymentAliases = async ({ token, teamId, deploymentIdOrUrl, fetchImpl = fetch }) => {
  const parsed = parseDeploymentRef(deploymentIdOrUrl)
  const params = new URLSearchParams({ teamId })
  // GET /v13/deployments/{idOrUrl} accepts dpl_ id, short id, or hostname.
  const pathValue = encodeURIComponent(parsed.value)
  const response = await fetchImpl(`${VERCEL_API_BASE}/v13/deployments/${pathValue}?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel deployment API returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel deployment API ${response.status}: ${message}`)
  }
  const aliases = Array.isArray(body.alias)
    ? body.alias
    : Array.isArray(body.aliases)
      ? body.aliases
      : []
  return {
    id: typeof body.id === 'string' ? body.id : parsed.value,
    url: typeof body.url === 'string' ? body.url : null,
    aliases,
    readyState: body.readyState ?? body.status ?? null,
  }
}

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   fetchImpl?: typeof fetch
 * }} options
 * @returns {Promise<{ id: string, url: string | null, ready: number | null } | null>}
 */
export const fetchLatestProductionReadyDeployment = async ({
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
    throw new Error(`Vercel deployments list returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel deployments list ${response.status}: ${message}`)
  }
  const deployment = Array.isArray(body.deployments) ? body.deployments[0] : null
  if (!deployment || typeof deployment !== 'object') return null
  const id = typeof deployment.uid === 'string' ? deployment.uid : deployment.id
  if (typeof id !== 'string') return null
  return {
    id,
    url: typeof deployment.url === 'string' ? deployment.url : null,
    ready: typeof deployment.ready === 'number' ? deployment.ready : null,
  }
}

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   deploymentRef: string
 *   expectedHost?: string
 *   fetchImpl?: typeof fetch
 *   sleepImpl?: (ms: number) => Promise<void>
 * }} options
 */
export const ensureProductionCustomDomain = async ({
  token,
  projectId,
  teamId,
  deploymentRef,
  expectedHost = PRODUCTION_CUSTOM_DOMAIN,
  fetchImpl = fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) => {
  const project = await fetchVercelProject({ token, projectId, teamId, fetchImpl })
  const autoAssign = project.autoAssignCustomDomains
  const steps = []

  if (autoAssign === false) {
    steps.push('autoAssignCustomDomains was false — enabling (Git OFF ≠ domain assign OFF)')
    await setAutoAssignCustomDomains({
      token,
      projectId,
      teamId,
      enabled: true,
      fetchImpl,
    })
  } else {
    steps.push(`autoAssignCustomDomains=${String(autoAssign)}`)
  }

  const deployment = await fetchDeploymentAliases({
    token,
    teamId,
    deploymentIdOrUrl: deploymentRef,
    fetchImpl,
  })

  if (aliasesIncludeHost(deployment.aliases, expectedHost)) {
    steps.push(`already aliased to ${expectedHost}`)
    return {
      alreadyAssigned: true,
      promoted: false,
      autoAssignWasFalse: autoAssign === false,
      deployment,
      steps,
    }
  }

  steps.push(`promoting ${deployment.id} so ${expectedHost} points at this deployment`)
  await promoteProductionDeployment({
    token,
    projectId,
    teamId,
    deploymentId: deployment.id,
    fetchImpl,
  })

  // Promote is async on some accounts — poll briefly for the alias.
  let verified = deployment
  for (let attempt = 0; attempt < 8; attempt += 1) {
    verified = await fetchDeploymentAliases({
      token,
      teamId,
      deploymentIdOrUrl: deployment.id,
      fetchImpl,
    })
    if (aliasesIncludeHost(verified.aliases, expectedHost)) break
    await sleepImpl(1500)
  }

  if (!aliasesIncludeHost(verified.aliases, expectedHost)) {
    throw new Error(
      `After promote, ${expectedHost} is still not on deployment ${deployment.id}. Aliases: ${JSON.stringify(verified.aliases)}`,
    )
  }

  steps.push(`verified alias ${expectedHost}`)
  return {
    alreadyAssigned: false,
    promoted: true,
    autoAssignWasFalse: autoAssign === false,
    deployment: verified,
    steps,
  }
}
