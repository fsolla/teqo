'use client'

import { useState } from 'react'

import { AdvisorPermissionEditor } from '@/components/campaign/advisor/AdvisorPermissionEditor'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import {
  advisorProfileLabel,
  type AdvisorEditing,
  type AdvisorVisibility,
} from '@/lib/campaignAdvisorProfile'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type AdvisorPermissionBadgeProps = {
  visibility: AdvisorVisibility
  editing: AdvisorEditing
  /** Present = saved on the server; absent = new-advisor draft row. */
  advisorId?: number
  formAction?: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  onDraftChange?: (visibility: AdvisorVisibility, editing: AdvisorEditing) => void
  /** Names the account for the badge's accessible label. */
  advisorName?: string
}

/**
 * C141 — the "Permissão" cell: a compact badge that opens the Visão × Edição
 * editor in a popover. Reused in the advisors list and the new-advisor draft
 * row; the detail page embeds the editor directly in its own section.
 */
export const AdvisorPermissionBadge = ({
  visibility,
  editing,
  advisorId,
  formAction,
  onDraftChange,
  advisorName = 'conta',
}: AdvisorPermissionBadgeProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-bold text-foreground underline-offset-4 hover:bg-accent hover:underline"
          aria-label={`Permissão de ${advisorName}`}
        >
          {advisorProfileLabel(visibility, editing)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <AdvisorPermissionEditor
          visibility={visibility}
          editing={editing}
          advisorId={advisorId}
          formAction={formAction}
          onDraftChange={onDraftChange}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
