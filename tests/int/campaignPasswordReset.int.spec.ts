// @vitest-environment node

import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { requestCampaignPasswordReset } from '@/app/(campaign)/campanha/actions/password'
import config from '@/payload.config'
import { getPayload } from 'payload'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign password reset and change', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('issues a reset token via forgotPassword with email disabled', async () => {
    const email = `${campaignFixtures().value('reset')}@example.com`
    const password = campaignFixtures().value('password')

    await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Reset target',
        email,
        password,
        role: 'coordinator',
      },
    })

    const token = await payload.forgotPassword({
      collection: 'campaignUser',
      data: { email },
      disableEmail: true,
    })

    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(20)

    const reset = await payload.resetPassword({
      collection: 'campaignUser',
      data: { token, password: `${password}-new` },
      overrideAccess: true,
    })

    expect(reset.token).toBeTruthy()
  })

  it('returns a generic success message for forgot-password requests', async () => {
    const result = await requestCampaignPasswordReset({
      email: `${campaignFixtures().value('forgot')}@example.com`,
    })

    expect(result.status).toBe('success')
    expect(result.message).toMatch(/Se existir uma conta/)
  })

  it('rejects login when password is wrong', async () => {
    const email = `${campaignFixtures().value('change')}@example.com`
    const password = campaignFixtures().value('password')

    await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Change password target',
        email,
        password,
        role: 'coordinator',
      },
    })

    await expect(
      payload.login({
        collection: 'campaignUser',
        data: { email, password: 'wrong-password' },
      }),
    ).rejects.toThrow()
  })
})
