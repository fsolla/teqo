// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'

describe('campaign invite origin policy', () => {
  it.each([
    'https://0.0.0.0',
    'https://10.0.0.1',
    'https://172.16.0.1',
    'https://192.168.0.1',
    'https://169.254.1.1',
    'https://[::]',
    'https://[fc00::1]',
    'https://[fe80::1]',
    'https://[::ffff:127.0.0.1]',
    'https://127.1',
    'https://2130706433',
    'https://0x7f000001',
  ])('rejects the production IP literal %s', (configuredURL) => {
    expect(() => getCampaignInviteBaseURL({ environment: 'production', configuredURL })).toThrow()
  })

  it.each([
    'http://127.1:3000',
    'http://2130706433:3000',
    'http://0x7f000001:3000',
    'http://017700000001:3000',
    'http://localhost.attacker:3000',
    'http://user@localhost:3000',
    'http://localhost:3000,https://attacker.example',
    ' http://localhost:3000',
    'http://localhost:3000 ',
    'http://localhost:3000\r\nx-forwarded-host: attacker.example',
  ])('rejects the raw request origin %s', (requestOrigin) => {
    expect(() =>
      getCampaignInviteBaseURL({
        environment: 'test',
        configuredURL: undefined,
        requestOrigin,
      }),
    ).toThrow('origem segura')
  })

  it.each([
    { forwardedHost: '127.1:3000', forwardedProto: 'http' },
    { forwardedHost: '2130706433:3000', forwardedProto: 'http' },
    { forwardedHost: '0x7f000001:3000', forwardedProto: 'http' },
    { forwardedHost: 'localhost.attacker:3000', forwardedProto: 'http' },
    { forwardedHost: 'user@localhost:3000', forwardedProto: 'http' },
    { forwardedHost: 'localhost:3000,attacker.example', forwardedProto: 'http' },
    { forwardedHost: ' localhost:3000', forwardedProto: 'http' },
    { forwardedHost: 'localhost:3000', forwardedProto: 'http,https' },
  ])('rejects the raw forwarded authority $forwardedHost', (forwarded) => {
    expect(() =>
      getCampaignInviteBaseURL({
        environment: 'development',
        configuredURL: undefined,
        ...forwarded,
      }),
    ).toThrow('origem segura')
  })

  it.each([
    ['http://localhost', 'http://localhost'],
    ['http://LOCALHOST:3000', 'http://localhost:3000'],
    ['https://localhost:3443', 'http://localhost:3443'],
    ['http://127.0.0.1:65535', 'http://127.0.0.1:65535'],
    ['http://[::1]:3000', 'http://[::1]:3000'],
  ])('accepts the exact local request origin %s', (requestOrigin, expected) => {
    expect(
      getCampaignInviteBaseURL({
        environment: 'test',
        configuredURL: undefined,
        requestOrigin,
      }),
    ).toBe(expected)
  })

  it('accepts an exact real HTTPS DNS production origin', () => {
    expect(
      getCampaignInviteBaseURL({
        environment: 'production',
        configuredURL: 'https://campanha.example.org/',
        requestOrigin: 'http://localhost:3000',
        forwardedHost: 'localhost:3000',
        forwardedProto: 'http',
      }),
    ).toBe('https://campanha.example.org')
  })
})
