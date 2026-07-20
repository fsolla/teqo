// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  login: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: mocks.cookieSet })),
}))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    collections: {
      campaignUser: {
        config: {
          auth: {
            tokenExpiration: 7200,
          },
        },
      },
    },
    login: mocks.login,
  })),
}))

import { loginCampaign, loginCampaignFormAction } from '@/app/(campaign)/campanha/actions/auth'

describe('loginCampaign credential mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.login.mockResolvedValue({ token: 'campaign-token' })
  })

  it('maps an email identifier to email credentials', async () => {
    await loginCampaign({
      identifier: 'staff@example.com',
      password: 'secret',
    })

    expect(mocks.login).toHaveBeenCalledWith({
      collection: 'campaignUser',
      data: {
        email: 'staff@example.com',
        password: 'secret',
      },
    })
  })

  it('normalizes a phone identifier and maps it to username credentials', async () => {
    await loginCampaign({
      identifier: '+55 (71) 99999-1234',
      password: 'secret',
    })

    expect(mocks.login).toHaveBeenCalledWith({
      collection: 'campaignUser',
      data: {
        password: 'secret',
        username: '71999991234',
      },
    })
  })

  it('accepts FormData at the action-state boundary', async () => {
    const formData = new FormData()
    formData.set('identifier', '+55 (71) 99999-1234')
    formData.set('password', 'secret')

    await loginCampaignFormAction({}, formData)

    expect(mocks.login).toHaveBeenCalledWith({
      collection: 'campaignUser',
      data: {
        password: 'secret',
        username: '71999991234',
      },
    })
  })

  it('preserves password whitespace at the FormData boundary', async () => {
    const formData = new FormData()
    formData.set('identifier', ' staff@example.com ')
    formData.set('password', '  exact secret  ')

    await loginCampaignFormAction({}, formData)

    expect(mocks.login).toHaveBeenCalledWith({
      collection: 'campaignUser',
      data: {
        email: 'staff@example.com',
        password: '  exact secret  ',
      },
    })
  })

  it('returns a generic validation error for invalid FormData', async () => {
    const formData = new FormData()
    formData.set('identifier', 'not-an-identifier')
    formData.set('password', '')

    await expect(loginCampaignFormAction({}, formData)).resolves.toEqual({
      error: 'Dados inválidos.',
    })
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('returns a generic authentication error without exposing the failure', async () => {
    mocks.login.mockRejectedValueOnce(new Error('account not found'))

    await expect(
      loginCampaign({
        identifier: 'staff@example.com',
        password: 'wrong-password',
      }),
    ).resolves.toEqual({
      error: 'E-mail, celular ou senha inválidos.',
    })
  })

  it('returns a distinct message when Payload locks the account', async () => {
    const locked = new Error('This user is locked due to having too many failed login attempts.')
    locked.name = 'LockedAuth'
    mocks.login.mockRejectedValueOnce(locked)

    await expect(
      loginCampaign({
        identifier: 'staff@example.com',
        password: 'any-password',
      }),
    ).resolves.toEqual({
      error:
        'Conta temporariamente bloqueada após várias tentativas. Aguarde alguns minutos e tente de novo.',
    })
  })
})
