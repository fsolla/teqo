import { isIPv4 } from 'node:net'

const HOST_GATEWAY = 'host.docker.internal'
const SERVICE_NAME = /^[A-Za-z0-9_.-]+$/

const parseEndpoint = (endpoint) => {
  try {
    return new URL(endpoint)
  } catch {
    return null
  }
}

export const isHostGatewayEndpoint = (endpoint) => {
  const url = parseEndpoint(endpoint)
  return url?.hostname === HOST_GATEWAY
}

export const replaceEndpointHost = (endpoint, host) => {
  const url = parseEndpoint(endpoint)
  if (!url || !isIPv4(host)) throw new Error('Invalid media endpoint host')
  const hadExplicitPath = url.pathname !== '/'
  url.hostname = host
  const resolved = url.toString()
  return hadExplicitPath || !resolved.endsWith('/') ? resolved : resolved.slice(0, -1)
}

export const renderMediaEndpointOverride = ({ container, migrateService, endpoint, gateway }) => {
  if (
    !SERVICE_NAME.test(container) ||
    !SERVICE_NAME.test(migrateService) ||
    container === migrateService ||
    !isHostGatewayEndpoint(endpoint) ||
    !isIPv4(gateway)
  ) {
    throw new Error('Invalid media endpoint override')
  }

  const resolvedEndpoint = replaceEndpointHost(endpoint, gateway)
  return [
    'services:',
    `  ${container}:`,
    '    environment:',
    `      S3_ENDPOINT: ${JSON.stringify(resolvedEndpoint)}`,
    `  ${migrateService}:`,
    '    environment:',
    `      S3_ENDPOINT: ${JSON.stringify(resolvedEndpoint)}`,
    '',
  ].join('\n')
}

if (process.argv[1]?.endsWith('/mediaEndpoint.mjs')) {
  const args = process.argv.slice(2)
  const value = (name) => {
    const index = args.indexOf(name)
    return index === -1 ? '' : args[index + 1]
  }
  if (args[0] === 'is-host-gateway') {
    process.exit(isHostGatewayEndpoint(value('--endpoint')) ? 0 : 1)
  }
  process.stdout.write(
    renderMediaEndpointOverride({
      container: value('--container'),
      migrateService: value('--migrate-service'),
      endpoint: value('--endpoint'),
      gateway: value('--gateway'),
    }),
  )
}
