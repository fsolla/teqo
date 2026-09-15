'use client'

import { useEffect, useState } from 'react'

const COPY_FEEDBACK_RESET_MS = 2000

export type CopyFeedback = 'idle' | 'copied' | 'error'

export const copyFeedbackLabels: Record<CopyFeedback, string> = {
  idle: 'Copiar link',
  copied: 'Link copiado',
  error: 'Não foi possível copiar',
}

export const copyFeedbackLiveMessages: Record<CopyFeedback, string> = {
  idle: '',
  copied: 'Link copiado.',
  error: 'Não foi possível copiar o link.',
}

/**
 * The one copy-to-clipboard feedback contract of the share controls (C166 share
 * sheet, C167 cut share kit): the label per state, the screen-reader live
 * message and the auto-reset. `copy` never throws — a denied clipboard is the
 * `error` state.
 */
export const useCopyFeedback = () => {
  const [feedback, setFeedback] = useState<CopyFeedback>('idle')

  useEffect(() => {
    if (feedback === 'idle') return
    const reset = setTimeout(() => setFeedback('idle'), COPY_FEEDBACK_RESET_MS)
    return () => clearTimeout(reset)
  }, [feedback])

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setFeedback('copied')
    } catch {
      setFeedback('error')
    }
  }

  return { feedback, copy }
}
