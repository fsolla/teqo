// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CONTENT_EVENT_ENDPOINT,
  sendCardDownloadEvent,
  sendCardOpeningEvent,
  sendContentPieceEvent,
} from '@/lib/contentEvents'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ContentEvent collection contract', () => {
  it('carries the subject only — no visitor identifier — and never hooks the public cache', async () => {
    const { ContentEvent } = await import('@/collections/ContentEvent')

    const fieldNames = ContentEvent.fields.map((field) => ('name' in field ? field.name : ''))
    expect(fieldNames).toEqual(['type', 'subjectType', 'subjectId', 'variant'])
    for (const forbidden of ['ip', 'useragent', 'cookie', 'session', 'visitor', 'fingerprint']) {
      expect(fieldNames.some((name) => name.toLowerCase().includes(forbidden))).toBe(false)
    }

    // A write must never bust the public `contentPieces` listing tag.
    expect(ContentEvent.hooks ?? {}).toEqual({})
    expect(ContentEvent.admin?.hidden).toBeTypeOf('function')
    // No access predicate grants a create; the writer bypasses explicitly.
    const createAccess = ContentEvent.access?.create
    expect(createAccess).toBeTypeOf('function')
    const decision = await (
      createAccess as (args: { req: { user: null } }) => boolean | Promise<boolean>
    )({ req: { user: null } })
    expect(decision).toBe(false)
  })
})

describe('sendContentPieceEvent', () => {
  it('prefers sendBeacon with a JSON blob and does not touch fetch', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    const fetchMock = vi.fn()
    vi.stubGlobal('navigator', { sendBeacon })
    vi.stubGlobal('fetch', fetchMock)

    sendContentPieceEvent('abertura', 'fim-da-escala-6x1')

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [endpoint, blob] = sendBeacon.mock.calls[0]!
    expect(endpoint).toBe(CONTENT_EVENT_ENDPOINT)
    expect(blob).toBeInstanceOf(Blob)
    expect((blob as Blob).type).toBe('application/json')
    await expect((blob as Blob).text()).resolves.toBe(
      JSON.stringify({ type: 'abertura', pieceSlug: 'fim-da-escala-6x1' }),
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to a keepalive fetch when the beacon refuses the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('navigator', { sendBeacon: vi.fn().mockReturnValue(false) })
    vi.stubGlobal('fetch', fetchMock)

    sendContentPieceEvent('compartilhar_link', 'solla-no-sus')

    expect(fetchMock).toHaveBeenCalledWith(
      CONTENT_EVENT_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ type: 'compartilhar_link', pieceSlug: 'solla-no-sus' }),
      }),
    )
  })

  it('never throws when the beacon and the fetch both fail', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockImplementation(() => {
        throw new Error('beacon exploded')
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(() => sendContentPieceEvent('download', 'peca')).not.toThrow()
    await Promise.resolve()

    vi.stubGlobal('fetch', undefined)
    expect(() => sendContentPieceEvent('download', 'peca')).not.toThrow()
  })

  it('reaches the fetch fallback when there is no navigator at all', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('fetch', fetchMock)

    sendContentPieceEvent('download', 'peca')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('sendCardDownloadEvent', () => {
  it('carries the model id and the state-deputy slug on the picker models', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon })

    sendCardDownloadEvent('minha-colinha', 'julio')

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [endpoint, blob] = sendBeacon.mock.calls[0]!
    expect(endpoint).toBe(CONTENT_EVENT_ENDPOINT)
    await expect((blob as Blob).text()).resolves.toBe(
      JSON.stringify({
        type: 'download',
        subjectType: 'card',
        cardModelId: 'minha-colinha',
        stateDeputySlug: 'julio',
      }),
    )
  })

  it('omits the slug key on models without a picker (null or undefined)', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon })

    sendCardDownloadEvent('eu-sou-solla', null)

    const [, blob] = sendBeacon.mock.calls[0]!
    await expect((blob as Blob).text()).resolves.toBe(
      JSON.stringify({ type: 'download', subjectType: 'card', cardModelId: 'eu-sou-solla' }),
    )
  })

  it('never throws when the beacon and the fetch both fail', async () => {
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockImplementation(() => {
        throw new Error('beacon exploded')
      }),
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(() => sendCardDownloadEvent('time-do-estadual', 'julio')).not.toThrow()
    await Promise.resolve()

    vi.stubGlobal('fetch', undefined)
    expect(() => sendCardDownloadEvent('time-do-estadual', 'julio')).not.toThrow()
  })
})

describe('sendCardOpeningEvent (S38)', () => {
  it('carries the model id only, as the opening of a card', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon })

    sendCardOpeningEvent('time-de-voce')

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [endpoint, blob] = sendBeacon.mock.calls[0]!
    expect(endpoint).toBe(CONTENT_EVENT_ENDPOINT)
    await expect((blob as Blob).text()).resolves.toBe(
      JSON.stringify({ type: 'abertura', subjectType: 'card', cardModelId: 'time-de-voce' }),
    )
  })

  it('never throws when the beacon and the fetch both fail', async () => {
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockImplementation(() => {
        throw new Error('beacon exploded')
      }),
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(() => sendCardOpeningEvent('minha-colinha')).not.toThrow()
    await Promise.resolve()

    vi.stubGlobal('fetch', undefined)
    expect(() => sendCardOpeningEvent('minha-colinha')).not.toThrow()
  })
})
