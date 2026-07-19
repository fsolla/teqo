// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  campaignChangePasswordSchema,
  campaignPasswordResetRequestSchema,
  campaignPasswordResetSchema,
} from '@/lib/schemas/campaignPassword'

describe('campaign password schemas', () => {
  it('accepts a valid forgot-password email', () => {
    const parsed = campaignPasswordResetRequestSchema.parse({ email: 'staff@example.com' })
    expect(parsed.email).toBe('staff@example.com')
  })

  it('rejects reset when confirmation does not match', () => {
    const result = campaignPasswordResetSchema.safeParse({
      token: 'a'.repeat(32),
      password: 'new-password',
      passwordConfirmation: 'other-password',
    })
    expect(result.success).toBe(false)
  })

  it('rejects change when new password equals current password', () => {
    const result = campaignChangePasswordSchema.safeParse({
      currentPassword: 'same-password',
      password: 'same-password',
      passwordConfirmation: 'same-password',
    })
    expect(result.success).toBe(false)
  })
})
