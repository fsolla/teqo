'use client'

import { useEffect, useState } from 'react'

const COPY_FEEDBACK_RESET_MS = 2000

export type CopyFeedback = 'idle' | 'copied' | 'error'

/**
 * C194 — what is being copied changes the wording. `link` is the share
 * controls' default; `text` serves the reel transcript.
 */
export type CopySubject = 'link' | 'text'

const copyFeedbackLabelsBySubject: Record<CopySubject, Record<CopyFeedback, string>> = {
  link: {
    idle: 'Copiar link',
    copied: 'Link copiado',
    error: 'Não foi possível copiar',
  },
  text: {
    idle: 'Copiar texto',
    copied: 'Texto copiado',
    error: 'Não foi possível copiar',
  },
}

const copyFeedbackLiveMessagesBySubject: Record<CopySubject, Record<CopyFeedback, string>> = {
  link: {
    idle: '',
    copied: 'Link copiado.',
    error: 'Não foi possível copiar o link.',
  },
  text: {
    idle: '',
    copied: 'Texto copiado.',
    error: 'Não foi possível copiar o texto.',
  },
}

export const copyFeedbackLabelsFor = (subject: CopySubject): Record<CopyFeedback, string> =>
  copyFeedbackLabelsBySubject[subject]

export const copyFeedbackLiveMessagesFor = (subject: CopySubject): Record<CopyFeedback, string> =>
  copyFeedbackLiveMessagesBySubject[subject]

/** The link wording the existing share controls import (unchanged). */
export const copyFeedbackLabels = copyFeedbackLabelsBySubject.link
export const copyFeedbackLiveMessages = copyFeedbackLiveMessagesBySubject.link

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
