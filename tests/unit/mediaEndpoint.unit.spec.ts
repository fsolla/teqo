import { describe, expect, it } from 'vitest'

import {
  isHostGatewayEndpoint,
  renderMediaEndpointOverride,
  replaceEndpointHost,
} from '../../scripts/lib/mediaEndpoint.mjs'

describe('media endpoint deploy fallback', () => {
  it('recognizes only the documented host gateway endpoint for automatic repair', () => {
    expect(isHostGatewayEndpoint('http://host.docker.internal:3900')).toBe(true)
    expect(isHostGatewayEndpoint('http://10.0.11.1:3900')).toBe(false)
    expect(isHostGatewayEndpoint('not-a-url')).toBe(false)
  })

  it('renders an override for both services of only the selected environment', () => {
    const override = renderMediaEndpointOverride({
      container: 'teqo-1313',
      migrateService: 'teqo-1313-migrate',
      endpoint: 'http://host.docker.internal:3900',
      gateway: '10.0.11.1',
    })

    expect(override).toContain('teqo-1313:')
    expect(override).toContain('teqo-1313-migrate:')
    expect(override).toContain('S3_ENDPOINT: "http://10.0.11.1:3900"')
    expect(override).not.toContain('teqo-staging')
  })

  it('preserves the endpoint port and path when replacing the host', () => {
    expect(replaceEndpointHost('http://host.docker.internal:3900/media', '10.0.11.1')).toBe(
      'http://10.0.11.1:3900/media',
    )
  })
})
