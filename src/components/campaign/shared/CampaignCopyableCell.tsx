'use client'

import { toast } from 'sonner'

import { cn } from '@/lib/utils'

/** Mirrors the inline input box (height, border, padding) so a future editable variant never reflows. */
export const campaignReadCellClassName =
  'flex min-h-10 w-full items-center rounded-full border border-transparent px-2 text-left'

const copyText = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copiado.`)
  } catch {
    toast.error(`Não foi possível copiar o ${label.toLowerCase()}.`)
  }
}

type CampaignCopyableCellProps = {
  /** Raw value copied to the clipboard. `null`/empty renders `emptyDisplay` instead of a button. */
  value: string | null
  /** Used in the toast ("`label` copiado.") and the button's `aria-label`. */
  label: string
  /** Transforms `value` for display only — the clipboard still gets the raw value (e.g. phone masking). */
  formatDisplay?: (value: string) => string
  emptyDisplay?: string
  className?: string
}

/**
 * Click-to-copy read cell for the campaign list system (`CampaignTable`).
 * First promoted on B28 (2nd call site after `/campanha/assessores`'s inline
 * copy — B19) so the copy/toast/empty-state behavior can't drift between the
 * two tables.
 */
export const CampaignCopyableCell = ({
  value,
  label,
  formatDisplay,
  emptyDisplay = '—',
  className,
}: CampaignCopyableCellProps) => {
  if (!value) {
    return (
      <span className={cn(campaignReadCellClassName, 'text-sm text-muted-foreground', className)}>
        {emptyDisplay}
      </span>
    )
  }

  const displayValue = formatDisplay ? formatDisplay(value) : value

  return (
    <button
      type="button"
      className={cn(campaignReadCellClassName, 'underline-offset-4 hover:underline', className)}
      aria-label={`Copiar ${label.toLowerCase()}`}
      onClick={() => void copyText(label, value)}
    >
      <span className="truncate">{displayValue}</span>
    </button>
  )
}
