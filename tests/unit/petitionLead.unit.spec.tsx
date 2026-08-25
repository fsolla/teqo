import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { PetitionForm } from '@/components/PetitionForm'
import type { Petition } from '@/payload-types'

/**
 * #766 — the `Lead` wiring of the petition form: a successful signature with a
 * configured pixel fires exactly one `trackMetaLead` (content_name = petition
 * title, UUID eventID); without a pixel, or when the submission fails, nothing
 * fires. A tracking hiccup (e.g. `crypto.randomUUID` on a non-secure context)
 * must never turn an already-committed signature into the error UI — the
 * success dialog still shows, preventing a retry that would duplicate the
 * signature and re-fire the `Lead`.
 */
const submitPetitionSignatureMock = vi.fn()
const trackMetaLeadMock = vi.fn()

vi.mock('@/app/(frontend)/actions/submitPetitionSignature', () => ({
  submitPetitionSignature: (...args: unknown[]) => submitPetitionSignatureMock(...args),
}))

vi.mock('@/lib/facebookPixel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/facebookPixel')>()
  return {
    ...actual,
    trackMetaLead: (...args: unknown[]) => trackMetaLeadMock(...args),
  }
})

const PIXEL_ID = '123456789012345'

const petition = {
  id: '1',
  title: 'Pela manutenção do Hospital do Subúrbio',
  form: { title: 'Assine a petição', subtitle: '' },
} as unknown as Petition

beforeAll(() => {
  // Radix/Base UI comboboxes (StateSelect/CitySelect) need ResizeObserver in jsdom.
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
  fireEvent.input(screen.getByPlaceholderText('Digite seu nome completo'), {
    target: { value: 'Maria Teste' },
  })
  fireEvent.input(screen.getByPlaceholderText('Digite seu e-mail'), {
    target: { value: 'maria@teste.com' },
  })
  fireEvent.input(screen.getByPlaceholderText('(71) 99999-9999'), {
    target: { value: '71987654321' },
  })
  fireEvent.input(screen.getByPlaceholderText('00000-000'), {
    target: { value: '41950000' },
  })
  fireEvent.input(screen.getByPlaceholderText('Selecione um estado'), {
    target: { value: 'BA' },
  })
  fireEvent.click(await screen.findByRole('option', { name: 'Bahia' }))
  fireEvent.input(screen.getByPlaceholderText('Selecione uma cidade'), {
    target: { value: 'Salvador' },
  })
  fireEvent.click(await screen.findByRole('option', { name: 'Salvador' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Assinar' }))
  })
}

describe('Petition form Lead wiring', () => {
  beforeEach(() => {
    submitPetitionSignatureMock.mockReset()
    trackMetaLeadMock.mockReset()
    submitPetitionSignatureMock.mockResolvedValue({ ok: true, signatureNumber: 42 })
  })

  afterEach(() => {
    cleanup()
  })

  it('fires exactly one Lead on a successful signature with a configured pixel', async () => {
    render(
      <PetitionForm
        id="formulario"
        petition={petition}
        consentHTML=""
        facebookPixelId={PIXEL_ID}
      />,
    )
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Obrigado por assinar!' })).toBeTruthy()
    })
    expect(trackMetaLeadMock).toHaveBeenCalledTimes(1)
    expect(trackMetaLeadMock).toHaveBeenCalledWith(PIXEL_ID, petition.title, expect.any(String))
  })

  it('keeps the committed signature a success when tracking throws', async () => {
    trackMetaLeadMock.mockImplementation(() => {
      throw new Error('crypto.randomUUID is not available')
    })
    render(
      <PetitionForm
        id="formulario"
        petition={petition}
        consentHTML=""
        facebookPixelId={PIXEL_ID}
      />,
    )
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Obrigado por assinar!' })).toBeTruthy()
    })
    expect(submitPetitionSignatureMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Falha ao enviar assinatura. Tente novamente.')).toBeNull()
  })

  it('never fires a Lead without a configured pixel', async () => {
    render(<PetitionForm id="formulario" petition={petition} consentHTML="" />)
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Obrigado por assinar!' })).toBeTruthy()
    })
    expect(trackMetaLeadMock).not.toHaveBeenCalled()
  })

  it('never fires a Lead when the submission fails', async () => {
    submitPetitionSignatureMock.mockRejectedValue(new Error('boom'))
    render(
      <PetitionForm
        id="formulario"
        petition={petition}
        consentHTML=""
        facebookPixelId={PIXEL_ID}
      />,
    )
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByText('Falha ao enviar assinatura. Tente novamente.')).toBeTruthy()
    })
    expect(trackMetaLeadMock).not.toHaveBeenCalled()
  })
})
