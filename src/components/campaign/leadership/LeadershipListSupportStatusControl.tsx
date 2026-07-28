'use client'

import type { LeadershipListSupportStatusResponse } from '@/app/(campaign)/campanha/(app)/liderancas/support-status/types'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellAutosave } from '@/components/campaign/shared/useCampaignCellAutosave'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import {
  isSupportStatus,
  leadershipSupportStatuses,
  type SupportStatus,
} from '@/lib/schemas/leadership'
import { supportStatusLabels } from '@/utilities/leadershipLabels'

const STATUS_AUTOSAVE_MS = 150
const SUPPORT_STATUS_ENDPOINT = '/campanha/liderancas/support-status'
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar o status. Tente novamente.'
const DEFAULT_STATUS: SupportStatus = 'a_abordar'

type LeadershipListSupportStatusControlProps = {
  leadershipID: number
  status: SupportStatus | null
}

export const LeadershipListSupportStatusControl = ({
  leadershipID,
  status,
}: LeadershipListSupportStatusControlProps) => {
  const { open, onOpenChange, value, change, isPending, errorMessage, statusMessage } =
    useCampaignCellAutosave<SupportStatus, LeadershipListSupportStatusResponse>({
      value: status ?? DEFAULT_STATUS,
      equals: (left, right) => left === right,
      endpoint: SUPPORT_STATUS_ENDPOINT,
      buildBody: (supportStatus) => ({ leadershipId: leadershipID, supportStatus }),
      readSaved: (payload) => payload.savedSupportStatus,
      errorMessage: SAVE_ERROR_MESSAGE,
      pendingMessage: 'Salvando status de apoio.',
    })

  const handleStatusChange = (raw: string) => {
    if (!isSupportStatus(raw)) return
    change(raw, STATUS_AUTOSAVE_MS)
  }

  return (
    // The leaderships list is table-only, so this stays a Popover at every
    // viewport — the shell is here for the trigger and content it already owns,
    // not for a Drawer this surface has nowhere to put (B42).
    <CampaignCellEditOverlay
      variant="popover"
      open={open}
      onOpenChange={onOpenChange}
      title="Editar status de apoio"
      triggerLabel={`Editar status de apoio — ${supportStatusLabels[value]}`}
      triggerBusy={isPending}
      statusMessage={statusMessage}
      contentClassName="w-64 p-3"
      preventPopoverAutoFocus
      trigger={<SupportStatusBadge status={value} />}
    >
      <div className="relative flex flex-col gap-3">
        {isPending ? (
          <Spinner
            className="absolute top-0 right-0 size-3.5 text-muted-foreground"
            aria-label="Salvando status de apoio"
          />
        ) : null}
        <Field>
          <FieldLabel htmlFor={`leadership-list-support-status-${leadershipID}`}>
            Status de apoio
          </FieldLabel>
          <NativeSelect
            id={`leadership-list-support-status-${leadershipID}`}
            value={value}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="min-h-11 w-full"
          >
            {leadershipSupportStatuses.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {supportStatusLabels[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </CampaignCellEditOverlay>
  )
}
