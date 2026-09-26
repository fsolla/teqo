import { describe, expect, it } from 'vitest'

import { isPrivateVisionHost } from '../../scripts/lib/cli.mjs'

// C232 — the vision-endpoint locality predicate behind the PII guardrail: only
// the private network (loopback, RFC1918, CGNAT/tailnet, link-local/ULA, local
// names) passes without the explicit remote escape.

describe('isPrivateVisionHost (C232)', () => {
  it('accepts loopback, private ranges and the tailnet CGNAT block', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '10.0.0.7',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.15.142',
      '100.94.122.26',
      '100.64.0.1',
      '::1',
      '[::1]',
      'fe80::1',
      'fd00::1',
      'gpu-box',
      'ollama',
      'host.docker.internal',
      'workstation.local',
      'engine.internal',
    ]) {
      expect(isPrivateVisionHost(host), host).toBe(true)
    }
  })

  it('rejects public hosts and out-of-range addresses', () => {
    for (const host of [
      '8.8.8.8',
      '1.1.1.1',
      '172.32.0.1',
      '172.15.0.1',
      '100.63.0.1',
      '100.128.0.1',
      '203.0.113.10',
      'api.openai.com',
      'example.com',
      '256.1.1.1',
      // Names that merely START with the IPv6 ULA/link-local prefixes.
      'fdic.gov',
      'fcc.gov',
      'fd-openai.com',
      '',
    ]) {
      expect(isPrivateVisionHost(host), host).toBe(false)
    }
  })
})
