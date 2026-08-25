// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCampaignUser: vi.fn(),
  getCampaignUserWithAvatar: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: mocks.getCampaignUser,
  getCampaignUserWithAvatar: mocks.getCampaignUserWithAvatar,
}))

vi.mock('@/utilities/access/shared', () => ({
  advisorEditingAccess: (user: { role: string; visibility?: string; editing?: string }) => {
    if (user.role !== 'advisor') return 'none'
    if (user.editing === 'somente_leitura') return 'none'
    return 'carteira'
  },
}))

import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

type Actor = {
  role: 'coordinator' | 'candidate' | 'advisor' | 'leader'
  visibility?: 'carteira' | 'tudo'
  editing?: 'carteira' | 'tudo' | 'somente_leitura'
  email: string
}

const actor = (
  role: Actor['role'],
  profile?: { visibility?: Actor['visibility']; editing?: Actor['editing'] },
): Actor => ({
  role,
  email: `${role}@example.com`,
  ...profile,
})

describe('requireCampaignPageActor — gate: writable (C142)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets a coordinator through the writable gate (C142 regression: advisorEditingAccess returns "none" for non-advisors)', async () => {
    mocks.getCampaignUser.mockResolvedValue(actor('coordinator'))
    const user = await requireCampaignPageActor({ gate: 'writable' })
    expect(user.role).toBe('coordinator')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('lets a candidate through the writable gate', async () => {
    mocks.getCampaignUser.mockResolvedValue(actor('candidate'))
    const user = await requireCampaignPageActor({ gate: 'writable' })
    expect(user.role).toBe('candidate')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('redirects an advisor with Edição somente_leitura away from write pages', async () => {
    mocks.getCampaignUser.mockResolvedValue(actor('advisor', { editing: 'somente_leitura' }))
    await requireCampaignPageActor({ gate: 'writable', redirectTo: '/campanha' })
    expect(mocks.redirect).toHaveBeenCalledWith('/campanha')
  })

  it('lets an advisor with carteira editing through the writable gate', async () => {
    mocks.getCampaignUser.mockResolvedValue(actor('advisor', { editing: 'carteira' }))
    const user = await requireCampaignPageActor({ gate: 'writable' })
    expect(user.role).toBe('advisor')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('blocks a leader (non-staff) on the writable gate', async () => {
    mocks.getCampaignUser.mockResolvedValue(actor('leader'))
    await requireCampaignPageActor({ gate: 'writable' })
    expect(mocks.redirect).toHaveBeenCalled()
  })
})

describe('requireCampaignPageActor — withAvatar option', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the actor through the avatar getter (perfil shell needs a populated avatarUrl)', async () => {
    mocks.getCampaignUserWithAvatar.mockResolvedValue(actor('coordinator'))
    const user = await requireCampaignPageActor({ withAvatar: true })
    expect(user.role).toBe('coordinator')
    expect(mocks.getCampaignUserWithAvatar).toHaveBeenCalledTimes(1)
    expect(mocks.getCampaignUser).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('redirects to login when the avatar getter finds no session', async () => {
    mocks.getCampaignUserWithAvatar.mockResolvedValue(null)
    // Real `next/navigation` redirect never returns (throws NEXT_REDIRECT);
    // the helper reads `user.role` right after, so mimic that here.
    mocks.redirect.mockImplementationOnce(() => {
      throw new Error('NEXT_REDIRECT')
    })
    await expect(requireCampaignPageActor({ withAvatar: true })).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/campanha/login')
    expect(mocks.getCampaignUser).not.toHaveBeenCalled()
  })
})
