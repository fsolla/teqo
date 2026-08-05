'use client'

import { useActionState, useId, useState, type ReactNode } from 'react'

import { MunicipalitySignalFields } from '@/components/campaign/municipality/MunicipalitySignalFields'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { DrawerCloseButton } from '@/components/ui/Drawer'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatMunicipalitySignalAgeLabel,
  municipalitySignalAgeInDays,
} from '@/utilities/municipality/municipalitySignal'

type MunicipalityStaffFormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

type MunicipalityListSignalControlProps = {
  municipalityID: number
  municipalitySlug: string
  municipalityName: string
  lastSignalAt: string | null
  variant: CampaignCellEditOverlayVariant
  formAction: MunicipalityStaffFormAction
  children: ReactNode
}

export const MunicipalityListSignalControl = ({
  municipalityID,
  municipalitySlug,
  municipalityName,
  lastSignalAt,
  variant,
  formAction,
  children,
}: MunicipalityListSignalControlProps) => {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const reactId = useId()
  const idPrefix = `municipality-list-signal-${variant}-${municipalityID}-${reactId}`
  const formId = `${idPrefix}-form`
  const isSheet = variant === 'sheet'
  const frescorLabel = formatMunicipalitySignalAgeLabel(municipalitySignalAgeInDays(lastSignalAt))

  useCampaignFormSuccessToast(state, () => {
    setOpen(false)
    setFormKey((key) => key + 1)
  })

  const submitButton = (
    // On the sheet this button lives in the footer, outside the `<form>` it
    // submits: `form={formId}` is the standard association, and React's action
    // still runs because the submit event fires on the form either way. That is
    // what let this control drop the Drawer/Popover it used to hand-roll only
    // because its `<form>` had to wrap the footer (B32+ F5).
    <Button type="submit" form={formId} disabled={isPending} className="min-h-11 w-full">
      {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
      Registrar sinal
    </Button>
  )

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={setOpen}
      title="Registrar sinal"
      description={municipalityName}
      triggerLabel={`Registrar sinal em ${municipalityName} — ${frescorLabel}`}
      triggerBusy={isPending}
      statusMessage={isPending ? 'Registrando sinal…' : ''}
      triggerClassName="min-w-11 text-left"
      contentClassName="w-80"
      trigger={children}
      footer={
        isSheet && open ? (
          <>
            {submitButton}
            <DrawerCloseButton>Cancelar</DrawerCloseButton>
          </>
        ) : undefined
      }
    >
      <form
        key={formKey}
        id={formId}
        action={submitAction}
        className="flex flex-col gap-3"
        aria-busy={isPending || undefined}
      >
        <input type="hidden" name="municipalityId" value={municipalityID} />
        <input type="hidden" name="municipalitySlug" value={municipalitySlug} />
        <MunicipalitySignalFields idPrefix={idPrefix} fieldErrors={state.fieldErrors} />
        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
        {isSheet ? null : submitButton}
      </form>
    </CampaignCellEditOverlay>
  )
}
