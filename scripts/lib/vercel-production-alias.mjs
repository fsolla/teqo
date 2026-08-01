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
 * @typedef {{
 *   name: string
 *   gitBranch: string | null
 *   verified: boolean | null
 *   redirect: string | null
 *   customEnvironmentId: string | null
 * }} ProjectDomainRow
 */

/**
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   fetchImpl?: typeof fetch
 * }} options
 * @returns {Promise<ProjectDomainRow[]>}
 */
const fetchProjectDomains = async ({ token, projectId, teamId, fetchImpl = fetch }) => {
  const params = new URLSearchParams({ teamId })
  const response = await fetchImpl(
    `${VERCEL_API_BASE}/v9/projects/${projectId}/domains?${params}`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  )
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel project domains API returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel project domains API ${response.status}: ${message}`)
  }
  const rows = Array.isArray(body.domains) ? body.domains : Array.isArray(body) ? body : []
  return rows
    .filter((row) => row && typeof row.name === 'string' && row.name.trim())
    .map((row) => ({
      name: normalizeHostname(row.name),
      gitBranch: typeof row.gitBranch === 'string' && row.gitBranch.trim() ? row.gitBranch : null,
      verified: typeof row.verified === 'boolean' ? row.verified : null,
      redirect: typeof row.redirect === 'string' && row.redirect.trim() ? row.redirect : null,
      customEnvironmentId:
        typeof row.customEnvironmentId === 'string' && row.customEnvironmentId.trim()
          ? row.customEnvironmentId
          : null,
    }))
}

/**
 * Domains with a Git Branch set only auto-alias via Git Integration — CLI `--prod`
 * deploys (our Actions path) will not move them until the branch binding is cleared.
 * @param {{
 *   token: string
 *   projectId: string
 *   teamId: string
 *   domain: string
 *   fetchImpl?: typeof fetch
 * }} options
 */
const clearProjectDomainGitBranch = async ({
  token,
  projectId,
  teamId,
  domain,
  fetchImpl = fetch,
}) => {
  const host = normalizeHostname(domain)
  const params = new URLSearchParams({ teamId })
  const response = await fetchImpl(
    `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(host)}?${params}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      // JSON null clears the branch binding (returns domain to Production).
      body: JSON.stringify({ gitBranch: null }),
    },
  )
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel domain PATCH returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel domain PATCH ${response.status}: ${message}`)
  }
  return body
}

/**
 * Explicit alias assignment — required when custom domains don't ride Git Integration
 * auto-assign (CLI / prebuilt deploys).
 * @param {{
 *   token: string
 *   teamId: string
 *   deploymentId: string
 *   alias: string
 *   fetchImpl?: typeof fetch
 * }} options
 */
const assignDeploymentAlias = async ({ token, teamId, deploymentId, alias, fetchImpl = fetch }) => {
  const params = new URLSearchParams({ teamId })
  const response = await fetchImpl(
    `${VERCEL_API_BASE}/v2/deployments/${encodeURIComponent(deploymentId)}/aliases?${params}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ alias }),
    },
  )
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    body = { raw: bodyText }
  }
  if (response.ok) {
    const assigned =
      typeof body?.alias === 'string' ? normalizeHostname(body.alias) : normalizeHostname(alias)
    return { ok: true, body, assigned, already: false }
  }
  const message =
    typeof body?.error?.message === 'string'
      ? body.error.message
      : bodyText || `HTTP ${response.status}`
  // Only treat the exact "already on this deployment" 409 as success — other 409s
  // (e.g. "domain is not allowed") must fail loudly.
  if (response.status === 409 && /already assigned to (the )?given deployment/i.test(message)) {
    return { ok: true, body, assigned: normalizeHostname(alias), already: true }
  }
  throw new Error(`Vercel alias API ${response.status}: ${message}`)
}

/**
 * Prefer the aliases list endpoint — deployment.alias on GET /v13 can omit custom hosts.
 * @param {{
 *   token: string
 *   teamId: string
 *   deploymentId: string
 *   fetchImpl?: typeof fetch
 * }} options
 * @returns {Promise<string[]>}
 */
const listDeploymentAliasHosts = async ({ token, teamId, deploymentId, fetchImpl = fetch }) => {
  const params = new URLSearchParams({ teamId })
  const response = await fetchImpl(
    `${VERCEL_API_BASE}/v2/deployments/${encodeURIComponent(deploymentId)}/aliases?${params}`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  )
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel list-aliases API returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel list-aliases API ${response.status}: ${message}`)
  }
  const rows = Array.isArray(body.aliases) ? body.aliases : []
  return rows
    .map((row) => (row && typeof row.alias === 'string' ? normalizeHostname(row.alias) : ''))
    .filter(Boolean)
}

/**
 * @param {{
 *   token: string
 *   teamId: string
 *   domain: string
 *   fetchImpl?: typeof fetch
 * }} options
 * @returns {Promise<{ alias: string, deploymentId: string | null } | null>}
 */
const fetchDomainAliasTarget = async ({ token, teamId, domain, fetchImpl = fetch }) => {
  const host = normalizeHostname(domain)
  const params = new URLSearchParams({ teamId, domain: host, limit: '20' })
  const response = await fetchImpl(`${VERCEL_API_BASE}/v4/aliases?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const bodyText = await response.text()
  let body
  try {
    body = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error(`Vercel aliases-by-domain API returned non-JSON (${response.status})`)
  }
  if (!response.ok) {
    const message =
      typeof body?.error?.message === 'string'
        ? body.error.message
        : bodyText || `HTTP ${response.status}`
    throw new Error(`Vercel aliases-by-domain API ${response.status}: ${message}`)
  }
  const rows = Array.isArray(body.aliases) ? body.aliases : []
  const match = rows.find((row) => normalizeHostname(row?.alias) === host)
  if (!match) return null
  return {
    alias: normalizeHostname(match.alias),
    deploymentId: typeof match.deploymentId === 'string' ? match.deploymentId : null,
  }
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
 *   onStep?: (message: string) => void
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
  onStep,
}) => {
  const steps = []
  const note = (message) => {
    steps.push(message)
    onStep?.(message)
  }

  const project = await fetchVercelProject({ token, projectId, teamId, fetchImpl })
  const autoAssign = project.autoAssignCustomDomains

  if (autoAssign === false) {
    note('autoAssignCustomDomains was false — enabling (Git OFF ≠ domain assign OFF)')
    await setAutoAssignCustomDomains({
      token,
      projectId,
      teamId,
      enabled: true,
      fetchImpl,
    })
  } else {
    note(`autoAssignCustomDomains=${String(autoAssign)}`)
  }

  const projectDomains = await fetchProjectDomains({ token, projectId, teamId, fetchImpl })
  note(
    projectDomains.length > 0
      ? `project domains: ${projectDomains
          .map((d) => {
            const flags = [
              d.gitBranch ? `gitBranch=${d.gitBranch}` : null,
              d.redirect ? `redirect=${d.redirect}` : null,
              d.customEnvironmentId ? `customEnv=${d.customEnvironmentId}` : null,
              d.verified === false ? 'unverified' : null,
            ].filter(Boolean)
            return flags.length > 0 ? `${d.name}(${flags.join(',')})` : d.name
          })
          .join(', ')}`
      : 'project domains: (none)',
  )
  const expected = normalizeHostname(expectedHost)
  const domainRow = projectDomains.find((d) => d.name === expected)
  if (!domainRow) {
    throw new Error(
      `${expectedHost} is not attached to this Vercel project. Add it under Project → Settings → Domains, then re-run. Domains seen: ${JSON.stringify(projectDomains.map((d) => d.name))}`,
    )
  }
  if (domainRow.verified === false) {
    throw new Error(
      `${expectedHost} is on the project but not verified — finish DNS/TXT verification in Vercel Domains before aliasing.`,
    )
  }
  if (domainRow.redirect) {
    note(
      `warning: ${expectedHost} redirects to ${domainRow.redirect} — alias may not serve app traffic`,
    )
  }
  // Git-branch-bound domains only move with Git Integration deploys. We deploy via
  // CLI (`vercel deploy --prebuilt --prod`), so clear the binding first.
  if (domainRow.gitBranch) {
    note(
      `${expectedHost} had gitBranch=${domainRow.gitBranch} — clearing so CLI/Actions deploys can own Production`,
    )
    await clearProjectDomainGitBranch({
      token,
      projectId,
      teamId,
      domain: expected,
      fetchImpl,
    })
  }

  const deployment = await fetchDeploymentAliases({
    token,
    teamId,
    deploymentIdOrUrl: deploymentRef,
    fetchImpl,
  })
  note(`deployment ${deployment.id} readyState=${String(deployment.readyState)}`)

  const hostAlreadyOnDeployment = async () => {
    const hosts = await listDeploymentAliasHosts({
      token,
      teamId,
      deploymentId: deployment.id,
      fetchImpl,
    })
    if (aliasesIncludeHost(hosts, expectedHost)) return true
    const domainTarget = await fetchDomainAliasTarget({
      token,
      teamId,
      domain: expectedHost,
      fetchImpl,
    })
    return domainTarget?.deploymentId === deployment.id
  }

  if (aliasesIncludeHost(deployment.aliases, expectedHost) || (await hostAlreadyOnDeployment())) {
    note(`already aliased to ${expectedHost}`)
    return {
      alreadyAssigned: true,
      promoted: false,
      aliased: false,
      autoAssignWasFalse: autoAssign === false,
      clearedGitBranch: Boolean(domainRow.gitBranch),
      deployment,
      steps,
    }
  }

  let promoted = false
  try {
    note(`promoting ${deployment.id}`)
    await promoteProductionDeployment({
      token,
      projectId,
      teamId,
      deploymentId: deployment.id,
      fetchImpl,
    })
    promoted = true
  } catch (error) {
    note(`promote skipped: ${error instanceof Error ? error.message : String(error)}`)
  }

  note(`assigning alias ${expectedHost} → ${deployment.id}`)
  const assignResult = await assignDeploymentAlias({
    token,
    teamId,
    deploymentId: deployment.id,
    alias: expected,
    fetchImpl,
  })
  const assignedHost = assignResult.assigned ?? expected
  if (assignedHost !== expected) {
    throw new Error(
      `Alias API returned unexpected host ${JSON.stringify(assignedHost)} (wanted ${expected}). body=${JSON.stringify(assignResult.body)}`,
    )
  }
  note(
    assignResult.already
      ? `alias API: already on this deployment`
      : `alias API: assigned ${expectedHost}` +
          (assignResult.body?.oldDeploymentId
            ? ` (was ${String(assignResult.body.oldDeploymentId)})`
            : ''),
  )

  let verified = false
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await hostAlreadyOnDeployment()) {
      verified = true
      break
    }
    await sleepImpl(1500)
  }

  if (!verified) {
    const hosts = await listDeploymentAliasHosts({
      token,
      teamId,
      deploymentId: deployment.id,
      fetchImpl,
    })
    const domainTarget = await fetchDomainAliasTarget({
      token,
      teamId,
      domain: expectedHost,
      fetchImpl,
    })
    throw new Error(
      `After alias assign, ${expectedHost} is still not on deployment ${deployment.id}. ` +
        `deployment aliases=${JSON.stringify(hosts)}; domain points to=${JSON.stringify(domainTarget)}; ` +
        `aliasApiBody=${JSON.stringify(assignResult.body)}. ` +
        `Check Vercel → Settings → Domains: Git Branch must be empty, and Environments → Production → Auto-assign Custom Production Domains must be ON.`,
    )
  }

  note(`verified alias ${expectedHost}`)
  return {
    alreadyAssigned: false,
    promoted,
    aliased: true,
    autoAssignWasFalse: autoAssign === false,
    clearedGitBranch: Boolean(domainRow.gitBranch),
    deployment,
    steps,
  }
}
