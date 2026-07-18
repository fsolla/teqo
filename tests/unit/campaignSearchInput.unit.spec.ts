import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampaignSearchInput } from '@/components/campaign/CampaignSearchInput'

describe('CampaignSearchInput', () => {
  it('renders the shared accessible 44px campaign search composition', () => {
    const html = renderToStaticMarkup(
      createElement(CampaignSearchInput, {
        id: 'leadership-search',
        label: 'Buscar liderança',
        placeholder: 'Buscar liderança ou celular',
      }),
    )

    expect(html).toContain('for="leadership-search"')
    expect(html).toContain('id="leadership-search"')
    expect(html).toContain('data-slot="input-group"')
    expect(html).toContain('data-slot="input-group-addon"')
    expect(html).toContain('data-slot="input-group-control"')
    expect(html).toContain('min-h-11')
    expect(html).toContain('rounded-[6px]')
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('absolute')
  })
})
