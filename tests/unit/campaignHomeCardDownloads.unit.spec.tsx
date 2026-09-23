import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CampaignHomeCardDownloads } from '@/components/campaign/dashboard/CampaignHomeCardDownloads'
import {
  CARD_DOWNLOAD_COUNTS_CAPTION,
  CARD_DOWNLOAD_COUNTS_EMPTY_BODY,
  CARD_DOWNLOAD_COUNTS_EMPTY_TITLE,
  CARD_DOWNLOAD_COUNTS_SUBTITLE,
  CARD_DOWNLOAD_COUNTS_TITLE,
  cardDownloadCountsFromRows,
} from '@/lib/cardDownloadCounts'
import { CARD_MODELS } from '@/lib/cardModels'

afterEach(() => {
  cleanup()
})

describe('CampaignHomeCardDownloads', () => {
  it('renders one counter per model, in the catalog order, with the honesty caption', () => {
    render(
      <CampaignHomeCardDownloads
        view={{
          state: 'data',
          counts: cardDownloadCountsFromRows([
            { subjectId: 'eu-sou-solla', type: 'download', count: 1_234 },
            { subjectId: 'minha-colinha', type: 'download', count: 76 },
          ]),
        }}
      />,
    )

    expect(screen.getByRole('region', { name: CARD_DOWNLOAD_COUNTS_TITLE })).toBeTruthy()
    expect(screen.getByText(CARD_DOWNLOAD_COUNTS_SUBTITLE)).toBeTruthy()
    expect(screen.getByText('1.234')).toBeTruthy()
    expect(screen.getByText('76')).toBeTruthy()
    expect(screen.getByText(CARD_DOWNLOAD_COUNTS_CAPTION)).toBeTruthy()

    const terms = screen.getAllByRole('term').map((node) => node.textContent)
    expect(terms).toEqual(CARD_MODELS.map((model) => model.label))
  })

  it('renders the honest empty box instead of six zeros', () => {
    render(<CampaignHomeCardDownloads view={{ state: 'empty' }} />)

    expect(screen.getByText(CARD_DOWNLOAD_COUNTS_EMPTY_TITLE)).toBeTruthy()
    expect(screen.getByText(CARD_DOWNLOAD_COUNTS_EMPTY_BODY)).toBeTruthy()
    expect(screen.queryByText(CARD_DOWNLOAD_COUNTS_SUBTITLE)).toBeNull()
    expect(screen.queryByText('Card com seu nome')).toBeNull()
    expect(screen.queryByText(CARD_DOWNLOAD_COUNTS_CAPTION)).toBeNull()
  })

  it('renders nothing when the aggregate is unavailable — never "no downloads yet"', () => {
    const { container } = render(<CampaignHomeCardDownloads view={{ state: 'unavailable' }} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(CARD_DOWNLOAD_COUNTS_EMPTY_TITLE)).toBeNull()
  })
})
