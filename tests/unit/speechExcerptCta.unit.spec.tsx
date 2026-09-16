import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SpeechExcerptCta } from '@/components/campaign/speech/SpeechExcerptCta'
import { SPEECH_EXCERPT_REQUEST_EVENT } from '@/lib/speechExcerptSelection'

const originalScrollIntoView = Element.prototype.scrollIntoView

afterEach(() => {
  cleanup()
  // jsdom has no scrollIntoView; the stub is restored so it cannot leak.
  if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
  else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe('SpeechExcerptCta (C174)', () => {
  it('announces the excerpt intent and scrolls the player into view', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const listened = vi.fn()
    window.addEventListener(SPEECH_EXCERPT_REQUEST_EVENT, listened)

    render(
      <>
        <div data-slot="speech-player" />
        <SpeechExcerptCta />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: /selecionar trecho/i }))

    expect(listened).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })

    window.removeEventListener(SPEECH_EXCERPT_REQUEST_EVENT, listened)
  })
})
