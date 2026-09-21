import { describe, expect, it } from 'vitest'

import {
  buildRadioShareWhatsAppUrl,
  JINGLE_PLAY_EVENT,
  RADIO_CONNECT_TIMEOUT_MS,
  RADIO_PAGE_URL,
  RADIO_PLAY_EVENT,
  RADIO_SHARE_MESSAGE,
  RADIO_STREAM_URL,
  RADIO_TITLE,
} from '@/lib/radio'

describe('radio contract', () => {
  it('pins the stream, the public page and the fixed display title', () => {
    expect(RADIO_STREAM_URL).toBe('https://stream.zeno.fm/hys86kx6k16tv')
    expect(RADIO_PAGE_URL).toBe('https://zeno.fm/radio/jorge-solla-1313/')
    expect(RADIO_TITLE).toBe('Rádio Jorge Solla 1313')
  })

  it('builds the literal share message of the gate', () => {
    expect(RADIO_SHARE_MESSAGE).toBe(
      'Ouça a Rádio Jorge Solla 1313 — https://zeno.fm/radio/jorge-solla-1313/',
    )
  })

  it('opens the sender WhatsApp with the literal message inside the URL', () => {
    const url = buildRadioShareWhatsAppUrl()

    expect(new URL(url).searchParams.get('text')).toBe(RADIO_SHARE_MESSAGE)
  })

  it('arms a finite connect timeout', () => {
    expect(RADIO_CONNECT_TIMEOUT_MS).toBe(12_000)
  })

  it('names the exclusivity broadcast events of the sound section', () => {
    expect(RADIO_PLAY_EVENT).toBe('radio:play')
    expect(JINGLE_PLAY_EVENT).toBe('jingle:play')
  })
})
