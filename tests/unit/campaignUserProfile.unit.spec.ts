// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assertCampaignAvatarFile,
  campaignUserInitials,
  campaignUserShellView,
  mediaDocumentUrl,
} from '@/utilities/campaignUserProfile'

describe('campaignUserProfile helpers', () => {
  it('builds initials from the user name', () => {
    expect(campaignUserInitials('Maria Silva')).toBe('MS')
    expect(campaignUserInitials('João')).toBe('J')
  })

  it('builds shell view from a campaign user', () => {
    expect(
      campaignUserShellView({
        name: 'Maria',
        role: 'coordinator',
        avatar: { id: 1, url: 'https://example.com/a.jpg' } as never,
      }),
    ).toEqual({
      name: 'Maria',
      role: 'coordinator',
      avatarUrl: 'https://example.com/a.jpg',
    })
    expect(mediaDocumentUrl(42)).toBeNull()
  })

  it('rejects unsupported avatar mime types', () => {
    const file = new File(['x'], 'avatar.gif', { type: 'image/gif' })
    expect(() => assertCampaignAvatarFile(file)).toThrow(/JPEG, PNG ou WebP/)
  })
})
