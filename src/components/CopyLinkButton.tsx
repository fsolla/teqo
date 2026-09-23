'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { copyFeedbackLabels, copyFeedbackLiveMessages, useCopyFeedback } from '@/lib/copyFeedback'
import { cn } from '@/lib/utils'

type CopyLinkButtonProps = {
  /** Absolute URL or a same-origin path — resolved against the current origin on click. */
  url: string
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
  /**
   * Called only when the text actually landed in the clipboard (C213 counts the
   * share-by-link of a piece). The control itself never counts: it is shared
   * with the cut surfaces.
   */
  onCopied?: () => void
}

/**
 * The one copy-to-clipboard control of the cut surfaces (public page, result
 * card, library): same feedback label/auto-reset and screen-reader live region.
 * A relative path is resolved against the current origin on click, so a server
 * component can pass `publicPath` directly.
 */
export const CopyLinkButton = ({
  url,
  variant = 'outline',
  className,
  onCopied,
}: CopyLinkButtonProps) => {
  const { feedback, copy } = useCopyFeedback()

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={cn('min-h-10', className)}
        onClick={() => {
          void copy(new URL(url, window.location.origin).toString()).then((copied) => {
            if (copied) onCopied?.()
          })
        }}
      >
        {feedback === 'copied' ? (
          <CheckIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <CopyIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {copyFeedbackLabels[feedback]}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copyFeedbackLiveMessages[feedback]}
      </span>
    </>
  )
}
