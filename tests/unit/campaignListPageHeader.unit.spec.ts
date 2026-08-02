import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampaignListPageHeader } from '@/components/campaign/shared/CampaignListPageHeader'
import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'

describe('CampaignListPageHeader (B118)', () => {
  it('keeps h1 in the DOM with sr-only chrome on mobile (B118)', () => {
    const html = renderToStaticMarkup(
      createElement(CampaignListPageHeader, {
        title: 'Municípios',
        description: 'Os 435 municípios da campanha.',
        scope: createElement(CampaignScopeBadge, null, '435 municípios'),
      }),
    )

    expect(html).toContain('<h1')
    expect(html).toContain('sr-only')
    expect(html).toContain('Municípios')
    expect(html).toContain('Os 435 municípios da campanha.')
    expect(html).toContain('435 municípios')
  })
})
