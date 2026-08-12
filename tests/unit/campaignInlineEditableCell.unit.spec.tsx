import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
const errorToast = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('sonner', () => ({ toast: { error: errorToast } }))

import { CampaignInlineEditableCell } from '@/components/campaign/shared/CampaignInlineEditableCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

afterEach(cleanup)

beforeEach(() => {
  router.refresh.mockReset()
  errorToast.mockReset()
})

describe('CampaignInlineEditableCell (B163)', () => {
  it('keeps the name link separate from the cell edit trigger', () => {
    const formAction = vi.fn(
      async (
        _state: CampaignFormActionState,
        _formData: FormData,
      ): Promise<CampaignFormActionState> => ({
        status: 'success',
        message: 'Salvo.',
      }),
    )

    render(
      <CampaignInlineEditableCell
        recordId={7}
        recordIdField="stateDeputyId"
        field="name"
        value="Ana Bastos"
        label="Nome"
        href="/campanha/dobradinhas/7"
        editTrigger="cell"
        saveOnChange={false}
        formAction={formAction}
      />,
    )

    const link = screen.getByRole('link', { name: 'Ana Bastos' })
    expect(link.getAttribute('href')).toBe('/campanha/dobradinhas/7')
    expect(link.closest('[role="button"]')).toBeNull()
    expect(link.parentElement?.className).toContain('pointer-events-none')
    expect(link.className).toContain('pointer-events-auto')

    expect(screen.queryByRole('textbox', { name: 'Nome' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Editar nome' }))
    expect(screen.getByRole('textbox', { name: 'Nome' })).toBeTruthy()
  })

  it('keeps a failed save in the editor and exposes the error locally', async () => {
    const formAction = vi.fn(
      async (
        _state: CampaignFormActionState,
        _formData: FormData,
      ): Promise<CampaignFormActionState> => ({
        message: 'Telefone já usado.',
      }),
    )

    render(
      <CampaignInlineEditableCell
        recordId={7}
        recordIdField="stateDeputyId"
        field="phone"
        value="71999991234"
        label="Telefone"
        editTrigger="cell"
        saveOnChange={false}
        formAction={formAction}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar telefone' }))
    const input = screen.getByRole('textbox', { name: 'Telefone' })
    fireEvent.change(input, { target: { value: '71999990000' } })
    fireEvent.blur(input)

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Telefone já usado.'),
    )
    expect(screen.getByRole('textbox', { name: 'Telefone' })).toBeTruthy()
    expect(errorToast).toHaveBeenCalledWith('Telefone já usado.')
  })

  it('renders field validation errors from the action beside the active editor', async () => {
    const formAction = vi.fn(
      async (
        _state: CampaignFormActionState,
        _formData: FormData,
      ): Promise<CampaignFormActionState> => ({
        fieldErrors: { email: ['E-mail inválido.'] },
      }),
    )

    render(
      <CampaignInlineEditableCell
        recordId={7}
        recordIdField="stateDeputyId"
        field="email"
        value={null}
        label="E-mail"
        editTrigger="cell"
        saveOnChange={false}
        formAction={formAction}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar e-mail' }))
    const input = screen.getByRole('textbox', { name: 'E-mail' })
    fireEvent.change(input, { target: { value: 'invalid' } })
    fireEvent.blur(input)

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('E-mail inválido.'))
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toBeTruthy()
  })

  it('shows local success feedback after a saved edit', async () => {
    const formAction = vi.fn(
      async (
        _state: CampaignFormActionState,
        _formData: FormData,
      ): Promise<CampaignFormActionState> => ({
        status: 'success',
        message: 'Salvo.',
      }),
    )

    render(
      <CampaignInlineEditableCell
        recordId={7}
        recordIdField="stateDeputyId"
        field="party"
        value="PT"
        label="Partido"
        editTrigger="cell"
        saveOnChange={false}
        formAction={formAction}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar partido' }))
    const input = screen.getByRole('textbox', { name: 'Partido' })
    fireEvent.change(input, { target: { value: 'PSD' } })
    fireEvent.blur(input)

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Salvo.'))
    expect(screen.queryByRole('textbox', { name: 'Partido' })).toBeNull()
    expect(router.refresh).toHaveBeenCalled()
  })

  it('permanent name cell: focus swaps to the caret input and Escape discards without saving (C130)', () => {
    const formAction = vi.fn(
      async (
        _state: CampaignFormActionState,
        _formData: FormData,
      ): Promise<CampaignFormActionState> => ({
        status: 'success',
        message: 'Salvo.',
      }),
    )

    render(
      <CampaignInlineEditableCell
        recordId={7}
        recordIdField="contactId"
        field="name"
        value="Ana Bastos"
        label="Nome"
        href="/campanha/pessoas/7"
        formAction={formAction}
        permanent
      />,
    )

    const link = screen.getByRole('link', { name: 'Ana Bastos' })
    const input = screen.getByRole('textbox', { name: 'Nome' }) as HTMLInputElement

    // Focus steps the link out of the way so the input's real caret shows.
    fireEvent.focus(input)
    expect(link.className).toContain('opacity-0')

    fireEvent.change(input, { target: { value: 'Ana Bastos Discard' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)

    // Escape reverts the draft and never persists it (the blur after Escape
    // used to save the stale draft from the keydown closure — C130 fix).
    expect(input.value).toBe('Ana Bastos')
    expect(formAction).not.toHaveBeenCalled()
    expect(link.className).not.toContain('opacity-0')
  })
})
