import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import {
  CampaignQuickActionContextProvider,
  useCampaignQuickActionContext,
  useSetCampaignQuickActionContext,
} from '@/components/campaign/shell/CampaignQuickActionContext'

const wrapper = ({ children }: { children: ReactNode }) => (
  <CampaignQuickActionContextProvider>{children}</CampaignQuickActionContextProvider>
)

describe('CampaignQuickActionContext', () => {
  it('starts empty and accepts route context from B80+ setters', () => {
    const { result, rerender } = renderHook(
      () => {
        useSetCampaignQuickActionContext({ municipalitySlug: 'cairu' })
        return useCampaignQuickActionContext().context
      },
      { wrapper },
    )

    expect(result.current).toEqual({ municipalitySlug: 'cairu' })

    rerender()
    expect(result.current).toEqual({ municipalitySlug: 'cairu' })
  })
})
