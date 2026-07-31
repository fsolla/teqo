import { describe, expect, it } from 'vitest'

import { notificationTypeLabels, notificationTypes } from '@/lib/notificationContract'
import { buildCampaignServiceWorkerScript } from '@/utilities/campaignPwa'

describe('notificationContract', () => {
  it('labels every notification type', () => {
    for (const type of notificationTypes) {
      expect(notificationTypeLabels[type]).toBeTruthy()
    }
  })
})

describe('buildCampaignServiceWorkerScript', () => {
  it('includes push and notificationclick handlers', () => {
    const script = buildCampaignServiceWorkerScript('test-build')
    expect(script).toContain("self.addEventListener('push'")
    expect(script).toContain("self.addEventListener('notificationclick'")
  })
})
