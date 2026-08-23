'use client'

import {
  startTransition,
  useActionState,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

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
import { cn } from '@/lib/utils'
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
  /** C142 — read-only presentation (advisor with Edição `somente_leitura`): the signal-age display renders with no "Registrar atualização" affordance. */
  readOnly?: boolean
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
  readOnly = false,
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

  // C142 — read-only: the signal-age display renders with no "Registrar
  // atualização" affordance (the write control is absent, not disabled).
  if (readOnly) {
    return children
  }

  // C140 — manual dispatch (no `action={submitAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping typed values
  // on a validation error — the overlay stays open, so the wipe showed.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

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
      sheetBodyClassName={isSheet ? 'px-0 pt-0' : undefined}
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
        onSubmit={handleSubmit}
        className={cn('flex flex-col', !isSheet && 'gap-3')}
        aria-busy={isPending || undefined}
      >
        <input type="hidden" name="municipalityId" value={municipalityID} />
        <input type="hidden" name="municipalitySlug" value={municipalitySlug} />
        <MunicipalityUpdateFields
          idPrefix={idPrefix}
          fieldErrors={state.fieldErrors}
          isStaff={isStaff}
          layout={isSheet ? 'list' : 'labeled'}
        />
        {state.status !== 'success' && state.message ? (
          <div className={cn(isSheet && 'px-4 pt-3')}>
            <CampaignFormActionMessage state={state} />
          </div>
        ) : null}
        {isSheet ? null : submitButton}
      </form>
    </CampaignCellEditOverlay>
  )
}
