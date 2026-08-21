import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { CampaignNewsletterCapture } from '@/components/CampaignNewsletterForm'

/**
 * S10 — the `Lead` wiring of the S9 capture form: a successful submission
 * with a configured pixel fires exactly one `trackMetaLead` (content_name
 * `novidades-da-campanha`, UUID eventID); without a pixel, or when the
 * submission fails, nothing fires. The e2e covers the base-code render; the
 * real submission stays out of e2e on purpose (the `campanha-novidades`
 * consent key is shared with the parallel `campaignNewsletter` spec).
 */
const submitCampaignNewsletterMock = vi.fn()
const trackMetaLeadMock = vi.fn()

vi.mock('@/app/(frontend)/actions/submitCampaignNewsletter', () => ({
  submitCampaignNewsletter: (...args: unknown[]) => submitCampaignNewsletterMock(...args),
}))

vi.mock('@/lib/facebookPixel', () => ({
  trackMetaLead: (...args: unknown[]) => trackMetaLeadMock(...args),
}))

const PIXEL_ID = '123456789012345'

beforeAll(() => {
  // Radix comboboxes (StateSelect/CitySelect) need ResizeObserver in jsdom.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

const fillAndSubmit = async () => {
  // FormInput propagates to react-hook-form through the native `input` event.
  fireEvent.input(screen.getByPlaceholderText('Nome completo*'), {
    target: { value: 'Maria Teste' },
  })
  fireEvent.input(screen.getByPlaceholderText('WhatsApp (com DDD)*'), {
    target: { value: '71987654321' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'QUERO RECEBER NOVIDADES' }))
  })
}

describe('Campaign newsletter Lead wiring', () => {
  beforeEach(() => {
    submitCampaignNewsletterMock.mockReset()
    trackMetaLeadMock.mockReset()
    submitCampaignNewsletterMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('fires exactly one Lead on a successful capture with a configured pixel', async () => {
    render(<CampaignNewsletterCapture pixelId={PIXEL_ID} />)
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Inscrição confirmada' })).toBeTruthy()
    })
    expect(trackMetaLeadMock).toHaveBeenCalledTimes(1)
    expect(trackMetaLeadMock).toHaveBeenCalledWith(
      PIXEL_ID,
      'novidades-da-campanha',
      expect.any(String),
    )
  })

  it('never fires a Lead without a configured pixel', async () => {
    render(<CampaignNewsletterCapture />)
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Inscrição confirmada' })).toBeTruthy()
    })
    expect(trackMetaLeadMock).not.toHaveBeenCalled()
  })

  it('never fires a Lead when the capture fails', async () => {
    submitCampaignNewsletterMock.mockRejectedValue(new Error('boom'))
    render(<CampaignNewsletterCapture pixelId={PIXEL_ID} />)
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByText('Falha ao enviar. Tente novamente.')).toBeTruthy()
    })
    expect(trackMetaLeadMock).not.toHaveBeenCalled()
  })
})
