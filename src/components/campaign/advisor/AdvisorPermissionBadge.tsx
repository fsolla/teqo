'use client'

import { useState } from 'react'

import { AdvisorPermissionEditor } from '@/components/campaign/advisor/AdvisorPermissionEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { useNarrowMeasured } from '@/hooks/use-mobile'
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

const NARROW_BREAKPOINT = 640
const OVERLAY_TITLE = 'Permissão da conta'

/**
 * C141/C145 — the "Permissão" cell: a compact badge that opens the Visão ×
 * Edição editor in a centered dialog (desktop) or bottom drawer (mobile).
 * Reused in the advisors list and the new-advisor draft row; the detail page
 * embeds the editor directly in its own section.
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
  const { isNarrow } = useNarrowMeasured(NARROW_BREAKPOINT)

  const close = () => setOpen(false)

  const editor = (
    <AdvisorPermissionEditor
      visibility={visibility}
      editing={editing}
      advisorId={advisorId}
      formAction={formAction}
      onDraftChange={onDraftChange}
      onSaved={close}
      onCancel={close}
    />
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-bold text-foreground underline-offset-4 hover:bg-accent hover:underline"
        aria-label={`Permissão de ${advisorName}`}
      >
        {advisorProfileLabel(visibility, editing)}
      </button>

      {isNarrow ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="sr-only">{OVERLAY_TITLE}</DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">{editor}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="sr-only">{OVERLAY_TITLE}</DialogTitle>
            </DialogHeader>
            {editor}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
