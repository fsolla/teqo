/**
 * Thin Cursor Cloud Agents API v1 client (docs/plans/agent-pool-orchestrator.md
 * §14). REST + `CURSOR_API_KEY` (Basic auth, key as username). The API is in
 * public beta — the whole surface is isolated in this one module so a shape
 * change touches nothing else.
 */

const CURSOR_API_BASE = 'https://api.cursor.com'

export class CursorApiError extends Error {
  constructor(message, { status, body }) {
    super(message)
    this.name = 'CursorApiError'
    this.status = status
    this.body = body
  }
}

/**
 * @param {string} path e.g. '/v1/agents'
 * @param {Object} [options]
 * @param {string} [options.method]
 * @param {Record<string, unknown>} [options.body]
 * @param {string} [options.apiKey] defaults to CURSOR_API_KEY env
 * @param {typeof fetch} [options.fetchImpl] injected in tests
 */
export const cursorApiRequest = async (
  path,
  { method = 'GET', body, apiKey = process.env.CURSOR_API_KEY, fetchImpl = fetch } = {},
) => {
  if (!apiKey) {
    throw new CursorApiError(`Cursor API ${method} ${path}: CURSOR_API_KEY ausente`, {
      status: 0,
      body: null,
    })
  }
  const response = await fetchImpl(`${CURSOR_API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'content-type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  const json = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new CursorApiError(`Cursor API ${method} ${path} → ${response.status}`, {
      status: response.status,
      body: json,
    })
  }
  return json
}

export const cursorApiMe = (options) => cursorApiRequest('/v1/me', options)

export const listCursorModels = (options) => cursorApiRequest('/v1/models', options)

/** @param {Record<string, unknown>} payload the Create-An-Agent body */
export const createCursorAgent = (payload, options) =>
  cursorApiRequest('/v1/agents', { ...options, method: 'POST', body: payload })

export const getCursorAgent = (id, options) => cursorApiRequest(`/v1/agents/${id}`, options)

export const getCursorRun = (agentId, runId, options) =>
  cursorApiRequest(`/v1/agents/${agentId}/runs/${runId}`, options)

export const cancelCursorRun = (agentId, runId, options) =>
  cursorApiRequest(`/v1/agents/${agentId}/runs/${runId}/cancel`, { ...options, method: 'POST' })

export const archiveCursorAgent = (id, options) =>
  cursorApiRequest(`/v1/agents/${id}/archive`, { ...options, method: 'POST' })
