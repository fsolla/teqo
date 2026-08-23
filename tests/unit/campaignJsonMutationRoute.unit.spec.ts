import { NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { CAMPAIGN_SESSION_EXPIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

/**
 * B32+ F2: the same-origin check used to be a line each of the five quick-edit
 * routes wrote by hand, and the one that forgot it would have failed OPEN. It
 * is now the wrapper's, so these cases guard it once for all of them — plus the
 * error contract the routes had before the extraction, which must not have
 * moved.
 */
const SAFE_MESSAGE = 'Você não administra este município.'
const GENERIC_MESSAGE = 'Não foi possível salvar. Verifique seu acesso e tente novamente.'

const bodySchema = z.object({ municipalityId: z.number().int().positive() })

const buildRoute = (handler: (body: { municipalityId: number }) => Promise<NextResponse>) =>
  campaignJsonMutationRoute(
    { bodySchema, safeMessages: [SAFE_MESSAGE], genericMessage: GENERIC_MESSAGE },
    handler,
  )

const postRequest = (body: unknown, headers?: HeadersInit) =>
  new Request('https://jorgesolla1313.com.br/campanha/municipios/political-trend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('campaignJsonMutationRoute', () => {
  it('answers a cross-origin POST with 403 before parsing or calling the handler', async () => {
    const handler = vi.fn()
    const response = await buildRoute(handler)(
      postRequest({ municipalityId: 1 }, { Origin: 'https://evil.example' }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      message: 'Requisição inválida.',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('accepts an Origin matching the request URL', async () => {
    const route = buildRoute(async ({ municipalityId }) =>
      NextResponse.json({ status: 'success', municipalityId }),
    )

    const response = await route(
      postRequest({ municipalityId: 7 }, { Origin: 'https://jorgesolla1313.com.br' }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'success', municipalityId: 7 })
  })

  it('answers a malformed body with the shared 400', async () => {
    const handler = vi.fn()
    const response = await buildRoute(handler)(postRequest('{ not json'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      message: 'Corpo da requisição inválido.',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('collapses a schema violation into the route generic message, as before', async () => {
    const handler = vi.fn()
    const response = await buildRoute(handler)(postRequest({ municipalityId: 'abc' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      message: GENERIC_MESSAGE,
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('lets a safe domain message through and collapses anything else', async () => {
    const safe = await buildRoute(async () => {
      throw new Error(SAFE_MESSAGE)
    })(postRequest({ municipalityId: 1 }))

    expect(safe.status).toBe(400)
    await expect(safe.json()).resolves.toEqual({ status: 'error', message: SAFE_MESSAGE })

    const leaky = await buildRoute(async () => {
      throw new Error('column "engagement_level" does not exist')
    })(postRequest({ municipalityId: 1 }))

    expect(leaky.status).toBe(400)
    await expect(leaky.json()).resolves.toEqual({ status: 'error', message: GENERIC_MESSAGE })
  })

  it('answers an expired session with 401', async () => {
    const response = await buildRoute(async () => {
      throw new Error(CAMPAIGN_SESSION_EXPIRED_MESSAGE)
    })(postRequest({ municipalityId: 1 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      message: CAMPAIGN_SESSION_EXPIRED_MESSAGE,
    })
  })

  it('returns a handler response untouched, status included', async () => {
    const response = await buildRoute(async () =>
      NextResponse.json({ status: 'blocked', violations: [] }, { status: 409 }),
    )(postRequest({ municipalityId: 1 }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ status: 'blocked', violations: [] })
  })
})
