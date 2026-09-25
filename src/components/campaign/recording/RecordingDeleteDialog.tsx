'use client'

import { CircleAlertIcon } from 'lucide-react'

import { CampaignDeleteDialog } from '@/components/campaign/shared/CampaignDeleteDialog'
import { Button } from '@/components/ui/button'
import { campaignRecordingDeleteHref } from '@/lib/campaignPaths'
import { cn } from '@/lib/utils'

const DELETE_ERROR_MESSAGE = 'Não foi possível apagar a gravação.'

/**
 * C199 — the delete confirmation of the recording detail. The trigger lives
 * only here (never on the list cards): an irreversible action stays out of the
 * scan path, per the approved design. The machine lives in
 * `CampaignDeleteDialog`; here is the recording's policy only.
 */
export const RecordingDeleteDialog = ({
  recordingId,
  redirectTo,
  triggerClassName,
}: {
  recordingId: number
  /** Detail page: the row is gone after the delete, so leave the page. */
  redirectTo?: string
  triggerClassName?: string
}) => (
  <CampaignDeleteDialog
    endpoint={campaignRecordingDeleteHref(recordingId)}
    errorMessage={DELETE_ERROR_MESSAGE}
    title="Apagar esta gravação?"
    titleClassName="border-b-0 pb-0"
    description="O arquivo e toda a transcrição serão removidos. Esta ação não pode ser desfeita."
    confirmLabel="Apagar gravação"
    footerClassName="border-t-0 bg-transparent"
    redirectTo={redirectTo}
    trigger={
      <Button
        type="button"
        variant="ghost"
        className={cn('min-h-11 text-destructive hover:bg-red-50', triggerClassName)}
      >
        <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
        Apagar
      </Button>
    }
  />
)
