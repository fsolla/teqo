'use client'

import { Button } from '@/components/ui/button'
import { SPEECH_OMNIBOX_ID } from '@/utilities/speech/speechOmnibox'

/** C192 — the honest empty state's "reformulate" exit: focuses the omnibox. */
export const SpeechRefineSearchButton = () => (
  <Button
    type="button"
    className="min-h-11"
    onClick={() => {
      const input = document.getElementById(SPEECH_OMNIBOX_ID)
      if (input instanceof HTMLInputElement) {
        input.scrollIntoView({ block: 'nearest' })
        input.focus()
      }
    }}
  >
    Reformular busca
  </Button>
)
