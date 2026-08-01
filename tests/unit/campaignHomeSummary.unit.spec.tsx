import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CampaignHomeSummary } from '@/components/campaign/dashboard/CampaignHomeSummary'

afterEach(() => {
  cleanup()
})

describe('CampaignHomeSummary', () => {
  it('renders central staff vote total and coverage bar', () => {
    render(
      <CampaignHomeSummary
        view={{
          staffVoteTotalCentral: 125_430,
          homeSummaryDelta: 5_000,
          goalCoverage: {
            goal: 200_000,
            committed: 80_000,
            coverageRatio: 0.4,
            deficit: 120_000,
          },
        }}
      />,
    )

    expect(screen.getByRole('region', { name: 'Resumo da campanha' })).toBeTruthy()
    expect(screen.getByText('Votos estimados')).toBeTruthy()
    expect(screen.getByText('125.430')).toBeTruthy()
    expect(screen.getByLabelText('Aumento de 5.000 votos nos últimos 7 dias')).toBeTruthy()
    expect(screen.getByText('nos últimos 7 dias')).toBeTruthy()
    expect(screen.getByText('Cobertura por lideranças')).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Cobertura por lideranças: 40%' })).toBeTruthy()
  })

  it('omits the progress bar when coverage is unknown', () => {
    render(
      <CampaignHomeSummary
        view={{
          staffVoteTotalCentral: 0,
          homeSummaryDelta: null,
          goalCoverage: {
            goal: 0,
            committed: 0,
            coverageRatio: null,
            deficit: 0,
          },
        }}
      />,
    )

    expect(screen.queryByLabelText(/nos últimos 7 dias/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('omits the delta chip and period caption when delta is flat', () => {
    render(
      <CampaignHomeSummary
        view={{
          staffVoteTotalCentral: 12_345,
          homeSummaryDelta: 0,
          goalCoverage: {
            goal: 0,
            committed: 0,
            coverageRatio: null,
            deficit: 0,
          },
        }}
      />,
    )

    expect(screen.getByText('12.345')).toBeTruthy()
    expect(screen.queryByLabelText(/nos últimos 7 dias/)).toBeNull()
    expect(screen.queryByText('nos últimos 7 dias')).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })
})
