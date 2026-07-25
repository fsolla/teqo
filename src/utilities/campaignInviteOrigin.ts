import 'server-only'

import { isIP } from 'node:net'

export type CampaignInviteOriginInput = {
  configuredURL?: string
  environment?: string
  requestOrigin?: string | null
  forwardedHost?: string | null
  forwardedProto?: string | null
  allowLocalTLS?: boolean
}

const LOCAL_AUTHORITY_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?$/i
const DNS_HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

const parsePort = (rawPort: string | undefined): boolean => {
  if (rawPort === undefined) return true
  const port = Number(rawPort)
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

const parseHTTPOrigin = (rawURL: string, source: string): URL => {
  if (rawURL !== rawURL.trim()) {
    throw new Error(`${source} precisa conter somente uma origem exata.`)
  }

  let url: URL
  try {
    url = new URL(rawURL)
  } catch {
    throw new Error(`${source} precisa conter uma URL válida e absoluta.`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${source} precisa usar HTTP ou HTTPS.`)
  }
  if (url.username || url.password) {
    throw new Error(`${source} não pode conter credenciais.`)
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      `${source} precisa conter somente a origem, sem caminho, consulta ou fragmento.`,
    )
  }
  if (url.port && !parsePort(url.port)) {
    throw new Error(`${source} precisa usar uma porta válida.`)
  }
  return url
}

const parseRawLocalAuthority = (rawAuthority: string): RegExpMatchArray | null => {
  if (rawAuthority !== rawAuthority.trim()) return null
  const match = rawAuthority.match(LOCAL_AUTHORITY_PATTERN)
  return match && parsePort(match[2]) ? match : null
}

const parseLocalRequestOrigin = (
  value: string | null | undefined,
  allowLocalTLS: boolean,
): string | undefined => {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f,]/.test(value)) return undefined

  const rawMatch = value.match(
    /^(https?):\/\/(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?\/?$/i,
  )
  if (!rawMatch || !parsePort(rawMatch[3])) return undefined

  const url = parseHTTPOrigin(value, 'A origem do convite')
  if (url.protocol === 'https:' && !allowLocalTLS) url.protocol = 'http:'
  return url.origin
}

const parseLocalForwardedOrigin = ({
  forwardedHost,
  forwardedProto,
  allowLocalTLS,
}: Pick<CampaignInviteOriginInput, 'forwardedHost' | 'forwardedProto' | 'allowLocalTLS'>):
  | string
  | undefined => {
  if (!forwardedHost || !parseRawLocalAuthority(forwardedHost)) return undefined
  if (
    forwardedProto &&
    (forwardedProto !== forwardedProto.trim() ||
      /[\u0000-\u001f\u007f,]/.test(forwardedProto) ||
      !/^(?:http|https)$/i.test(forwardedProto))
  ) {
    return undefined
  }

  const protocol = forwardedProto?.toLowerCase() || 'http'
  return parseLocalRequestOrigin(`${protocol}://${forwardedHost}`, Boolean(allowLocalTLS))
}

const requireProductionDNSOrigin = (configuredURL: string): string => {
  const url = parseHTTPOrigin(configuredURL, 'NEXT_PUBLIC_SITE_URL')
  if (url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_SITE_URL precisa usar HTTPS em produção.')
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const forbiddenHostname =
    hostname === 'localhost' ||
    hostname.startsWith('localhost.') ||
    /^(?:[0-9]{1,3}\.){4}/.test(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localdomain') ||
    hostname.endsWith('.internal')
  if (isIP(hostname) !== 0 || forbiddenHostname || !DNS_HOSTNAME_PATTERN.test(hostname)) {
    throw new Error('NEXT_PUBLIC_SITE_URL precisa apontar para um nome DNS público em produção.')
  }
  return url.origin
}

export const getCampaignInviteBaseURL = (input: CampaignInviteOriginInput = {}): string => {
  const environment = input.environment ?? process.env.NODE_ENV
  const configuredURL = Object.hasOwn(input, 'configuredURL')
    ? input.configuredURL
    : process.env.NEXT_PUBLIC_SITE_URL

  if (environment === 'production') {
    if (!configuredURL) {
      throw new Error('NEXT_PUBLIC_SITE_URL precisa ser configurada em produção.')
    }
    return requireProductionDNSOrigin(configuredURL)
  }

  if (environment === 'development' || environment === 'test') {
    const requestURL =
      parseLocalRequestOrigin(input.requestOrigin, Boolean(input.allowLocalTLS)) ??
      parseLocalForwardedOrigin(input)
    if (requestURL) return requestURL
  }

  if (configuredURL) {
    const url = parseHTTPOrigin(configuredURL, 'NEXT_PUBLIC_SITE_URL')
    if (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') &&
      url.protocol === 'https:' &&
      !input.allowLocalTLS
    ) {
      url.protocol = 'http:'
    }
    return url.origin
  }

  throw new Error('Não foi possível determinar uma origem segura para o convite.')
}
