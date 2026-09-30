'use client'

import { CircleAlertIcon, CircleCheckIcon, XIcon } from 'lucide-react'
import { useEffect } from 'react'

import { useContentPieceSelection } from '@/components/campaign/content/ContentPieceSelectionProvider'
import { cn } from '@/lib/utils'

/** How long an all-success receipt stays before it fades on its own. */
const RECEIPT_AUTO_DISMISS_MS = 6_000

/**
 * C236 — the honest receipt of the batch (approved design scene 5): a single
 * inline banner at the top of the list, never over it. Success is one neutral
 * phrase with a green icon and dismisses itself; a partial failure is an
 * assertive `role="alert"` that always separates affected from failures and
 * stays until it is closed.
 */
export const ContentPieceBatchReceipt = () => {
  const { receipt, dismissReceipt } = useContentPieceSelection()

  useEffect(() => {
    if (receipt?.kind !== 'success') return
    const timer = window.setTimeout(dismissReceipt, RECEIPT_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [receipt, dismissReceipt])

  if (!receipt) return null

  const success = receipt.kind === 'success'

  return (
    <div
      role={success ? 'status' : 'alert'}
      aria-live={success ? 'polite' : undefined}
      aria-atomic="true"
      className={cn(
        'mt-4 flex items-start gap-2 rounded-lg border bg-card px-3 py-2.5',
        success ? 'border-border' : 'border-destructive/40',
      )}
    >
      {success ? (
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden="true" />
      ) : (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      )}
      <p className={cn('flex-1 text-sm font-medium', !success && 'text-destructive')}>
        {receipt.message}
      </p>
      <button
        type="button"
        aria-label="Fechar aviso"
        className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={dismissReceipt}
      >
        <XIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
