'use client'

import { useId, useState, type FormEvent, type ReactNode } from 'react'

import type { MunicipalityListSignalResponse } from '@/app/(campaign)/campanha/(app)/municipios/signal/types'
import { MunicipalitySignalFields } from '@/components/campaign/municipality/MunicipalitySignalFields'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellFailureChannel } from '@/components/campaign/shared/useCampaignCellFailureChannel'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { DrawerCloseButton } from '@/components/ui/Drawer'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  formatMunicipalitySignalAgeLabel,
  municipalitySignalAgeInDays,
} from '@/utilities/municipality/municipalitySignal'

const SIGNAL_ENDPOINT = '/campanha/municipios/signal'
const SAVE_ERROR_MESSAGE = 'Não foi possível registrar o sinal. Tente novamente.'

type MunicipalityListSignalControlProps = {
  municipalityID: number
  municipalitySlug: string
  municipalityName: string
  lastSignalAt: string | null
  variant: CampaignCellEditOverlayVariant
  children: ReactNode
}

export const MunicipalityListSignalControl = ({
  municipalityID,
  municipalitySlug: _municipalitySlug,
  municipalityName,
  lastSignalAt,
  variant,
  children,
}: MunicipalityListSignalControlProps) => {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [isPending, setIsPending] = useState(false)
  const { errorMessage, setErrorMessage, reportFailure, noteOpenChange } =
    useCampaignCellFailureChannel()
  const reactId = useId()
  const idPrefix = `municipality-list-signal-${variant}-${municipalityID}-${reactId}`
  const formId = `${idPrefix}-form`
  const isSheet = variant === 'sheet'
  const frescorLabel = formatMunicipalitySignalAgeLabel(municipalitySignalAgeInDays(lastSignalAt))

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    noteOpenChange(nextOpen)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsPending(true)

    const formData = new FormData(event.currentTarget)
    const body = (formData.get('body') as string) || undefined
    const signalType = (formData.get('signalType') as string) || undefined

    try {
      const { ok, payload } = await postCampaignJson<MunicipalityListSignalResponse>(
        SIGNAL_ENDPOINT,
        { municipalityId: municipalityID, body, signalType },
      )

      if (!ok || payload.status !== 'success') {
        reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
        setIsPending(false)
        return
      }

      setOpen(false)
      setFormKey((key) => key + 1)
    } catch {
      reportFailure(SAVE_ERROR_MESSAGE)
    } finally {
      setIsPending(false)
    }
  }

  const submitButton = (
    <Button type="submit" form={formId} disabled={isPending} className="min-h-11 w-full">
      {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
      Registrar sinal
    </Button>
  )

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={handleOpenChange}
      title="Registrar sinal"
      description={municipalityName}
      triggerLabel={`Registrar sinal em ${municipalityName} — ${frescorLabel}`}
      triggerBusy={isPending}
      statusMessage={isPending ? 'Registrando sinal…' : ''}
      triggerClassName="text-left"
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
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
        aria-busy={isPending || undefined}
      >
        <MunicipalitySignalFields idPrefix={idPrefix} />
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {isSheet ? null : submitButton}
      </form>
    </CampaignCellEditOverlay>
  )
}
