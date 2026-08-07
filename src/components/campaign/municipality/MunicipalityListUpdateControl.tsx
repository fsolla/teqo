'use client'

import { useActionState, useId, useState, type ReactNode } from 'react'

import { MunicipalityUpdateFields } from '@/components/campaign/municipality/MunicipalityUpdateFields'
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

type MunicipalityListUpdateControlProps = {
  municipalityID: number
  municipalitySlug: string
  municipalityName: string
  lastSignalAt: string | null
  variant: CampaignCellEditOverlayVariant
  formAction: MunicipalityStaffFormAction
  isStaff: boolean
  children: ReactNode
}

export const MunicipalityListUpdateControl = ({
  municipalityID,
  municipalitySlug,
  municipalityName,
  lastSignalAt,
  variant,
  formAction,
  isStaff,
  children,
}: MunicipalityListUpdateControlProps) => {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const reactId = useId()
  const idPrefix = `municipality-list-update-${variant}-${municipalityID}-${reactId}`
  const formId = `${idPrefix}-form`
  const isSheet = variant === 'sheet'
  const frescorLabel = formatMunicipalitySignalAgeLabel(municipalitySignalAgeInDays(lastSignalAt))

  useCampaignFormSuccessToast(state, () => {
    setOpen(false)
    setFormKey((key) => key + 1)
  })

  const submitButton = (
    <Button type="submit" form={formId} disabled={isPending} className="min-h-11 w-full">
      {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
      Registrar atualização
    </Button>
  )

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={setOpen}
      title="Registrar atualização"
      description={municipalityName}
      triggerLabel={`Registrar atualização em ${municipalityName} — ${frescorLabel}`}
      triggerBusy={isPending}
      statusMessage={isPending ? 'Registrando atualização…' : ''}
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
        <MunicipalityUpdateFields
          idPrefix={idPrefix}
          fieldErrors={state.fieldErrors}
          isStaff={isStaff}
        />
        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
        {isSheet ? null : submitButton}
      </form>
    </CampaignCellEditOverlay>
  )
}
