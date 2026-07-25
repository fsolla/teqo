// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { FormDataBoundaryError } from '@/lib/formData'
import { runCampaignFormAction } from '@/utilities/campaignFormActionError'

const GENERIC = 'Não foi possível concluir a ação.'

describe('runCampaignFormAction (shared stay-on-page ladder)', () => {
  it('spreads the execute result into the success state', async () => {
    const state = await runCampaignFormAction({
      execute: async () => ({ message: 'Salvo.', advisorId: 42 }),
      genericMessage: GENERIC,
    })
    expect(state).toEqual({ status: 'success', message: 'Salvo.', advisorId: 42 })
  })

  it('maps FormDataBoundaryError to a field error', async () => {
    const state = await runCampaignFormAction({
      execute: async () => {
        throw new FormDataBoundaryError('cost', 'Informe um valor válido.')
      },
      genericMessage: GENERIC,
    })
    expect(state).toEqual({
      fieldErrors: { cost: ['Informe um valor válido.'] },
      values: undefined,
      revision: undefined,
    })
  })

  it('maps ZodError to per-field validation errors', async () => {
    const schema = z.object({ name: z.string().min(2, 'Informe o nome.') })
    const state = await runCampaignFormAction({
      execute: async () => {
        schema.parse({ name: '' })
        return { message: 'nunca chega' }
      },
      genericMessage: GENERIC,
    })
    expect(state).toMatchObject({ fieldErrors: { name: ['Informe o nome.'] } })
    expect(state).not.toHaveProperty('status')
  })

  it('echoes safe-listed error messages and hides everything else behind the generic one', async () => {
    const safe = await runCampaignFormAction({
      execute: async () => {
        throw new Error('Somente a coordenação gerencia isto.')
      },
      safeMessages: ['Somente a coordenação gerencia isto.'],
      genericMessage: GENERIC,
    })
    expect(safe.message).toBe('Somente a coordenação gerencia isto.')

    const leaked = await runCampaignFormAction({
      execute: async () => {
        throw new Error('duplicate key value violates unique constraint "contact_phone_idx"')
      },
      safeMessages: ['Somente a coordenação gerencia isto.'],
      genericMessage: GENERIC,
    })
    expect(leaked.message).toBe(GENERIC)
  })

  it('echoes pre-parsed values and the revision on failure so forms repopulate', async () => {
    const values = { name: 'Ana', phone: '71 9 9999-0000' }
    const state = await runCampaignFormAction({
      execute: async () => {
        throw new Error('boom')
      },
      genericMessage: GENERIC,
      values,
      revision: 3,
    })
    expect(state).toEqual({ message: GENERIC, values, revision: 3 })
  })
})
