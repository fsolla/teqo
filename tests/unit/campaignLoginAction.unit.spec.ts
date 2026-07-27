// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clearAuthCookie: vi.fn(),
  cookieGet: vi.fn(),
  login: vi.fn(),
  redirect: vi.fn(),
  revokeSession: vi.fn(),
  setAuthCookie: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    login: mocks.login,
  })),
}))
vi.mock('@/utilities/campaignAuth', () => ({
  CAMPAIGN_TOKEN_COOKIE: 'campaign-token',
  clearCampaignAuthCookie: mocks.clearAuthCookie,
  revokeCampaignSession: mocks.revokeSession,
  setCampaignAuthCookie: mocks.setAuthCookie,
}))

import {
  loginCampaign,
  loginCampaignFormAction,
  logoutCampaign,
} from '@/app/(campaign)/campanha/actions/auth'
import { CAMPAIGN_SESSION_TTL_LONG, CAMPAIGN_SESSION_TTL_SHORT } from '@/lib/campaignSessionTtl'

const longToken =
  'header.eyJpZCI6MSwiY29sbGVjdGlvbiI6ImNhbXBhaWduVXNlciIsInNpZCI6InNlc3Npb24taWQiLCJpYXQiOjEsImV4cCI6Mn0.signature'

describe('loginCampaign credential mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.login.mockResolvedValue({ token: longToken })
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

  it('uses an eight-hour session when remember me is not selected', async () => {
    await loginCampaign({
      identifier: 'staff@example.com',
      password: 'secret',
    })

    expect(mocks.setAuthCookie).toHaveBeenCalledWith(
      longToken,
      expect.objectContaining({ login: mocks.login }),
      CAMPAIGN_SESSION_TTL_SHORT,
    )
  })

  it('uses a fourteen-day session when remember me is selected in FormData', async () => {
    const formData = new FormData()
    formData.set('identifier', 'staff@example.com')
    formData.set('password', 'secret')
    formData.set('rememberMe', 'true')

    await loginCampaignFormAction({}, formData)

    expect(mocks.setAuthCookie).toHaveBeenCalledWith(
      longToken,
      expect.objectContaining({ login: mocks.login }),
      CAMPAIGN_SESSION_TTL_LONG,
    )
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

  describe('logoutCampaign', () => {
    beforeEach(() => {
      mocks.cookieGet.mockReturnValue({ value: longToken })
    })

    it('revokes the current server session before clearing the logout cookie', async () => {
      await logoutCampaign()

      expect(mocks.revokeSession).toHaveBeenCalledWith(
        longToken,
        expect.objectContaining({ login: mocks.login }),
      )
      expect(mocks.clearAuthCookie).toHaveBeenCalledOnce()
    })

    it('still clears the logout cookie when server revocation rejects the token', async () => {
      mocks.revokeSession.mockRejectedValueOnce(new Error('revocation unavailable'))

      await logoutCampaign()

      expect(mocks.clearAuthCookie).toHaveBeenCalledOnce()
    })
  })
})
