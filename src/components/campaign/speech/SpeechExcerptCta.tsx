'use client'

import { ScissorsIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SPEECH_EXCERPT_REQUEST_EVENT } from '@/lib/speechExcerptSelection'

/**
 * C174 — the "Selecionar trecho" CTA of the empty "Cortes desta fala" block. It
 * is rendered outside the player (the section is server-side), so it announces
 * the intent and scrolls the player into view instead of owning a second copy
 * of the selection state.
 */
export const SpeechExcerptCta = () => (
  <Button
    type="button"
    className="min-h-11"
    data-slot="speech-excerpt-cta"
    onClick={() => {
      window.dispatchEvent(new CustomEvent(SPEECH_EXCERPT_REQUEST_EVENT))
      // No explicit `behavior`: the CSS `scroll-behavior` owns smooth/reduced-motion.
      document.querySelector('[data-slot="speech-player"]')?.scrollIntoView({ block: 'start' })
    }}
  >
    <ScissorsIcon data-icon="inline-start" aria-hidden="true" />
    Selecionar trecho
  </Button>
)
