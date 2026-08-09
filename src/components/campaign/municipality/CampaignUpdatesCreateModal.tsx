'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'

import { createCampaignUpdatesFormAction } from '@/app/(campaign)/campanha/(app)/atualizacoes/createFormActions'
import { MunicipalityUpdateFields } from '@/components/campaign/municipality/MunicipalityUpdateFields'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { StrictCombobox } from '@/components/campaign/shared/StrictCombobox'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/Drawer'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { fieldError } from '@/utilities/campaignFormFields'
import type { CampaignUpdatesFeedFacets } from '@/utilities/municipality/campaignUpdatesFeedData'

type CampaignUpdatesCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  municipalities: CampaignUpdatesFeedFacets['municipalities']
  isStaff: boolean
  /** Municipality slug to prefill when exactly one is active in the filter. */
  prefillSlug?: string
}

const MUNICIPALITY_COMBOBOX_ID = 'campaign-updates-create-municipality'

/**
 * The modal/sheet create surface for the updates feed (C89). One component
 * owns `useActionState` and renders the `<form>`, mirroring the proven
 * dialog-action pattern (ActivityLifecycleDialog) — the server action needs to
 * be bound where the form mounts for progressive enhancement to attach.
 */
export const CampaignUpdatesCreateModal = ({
  open,
  onOpenChange,
  municipalities,
  isStaff,
  prefillSlug,
}: CampaignUpdatesCreateModalProps) => {
  const isMobile = useIsMobile()
  const [state, submitAction, isPending] = useActionState(createCampaignUpdatesFormAction, {})

  const options = useMemo(
    () =>
      municipalities.map(({ id, slug }) => ({
        value: String(id),
        label: getMunicipalityCatalogEntry(slug)?.name ?? slug,
      })),
    [municipalities],
  )
  const initialMunicipalityId = useMemo(() => {
    if (!prefillSlug) return ''
    const match = municipalities.find((municipality) => municipality.slug === prefillSlug)
    return match ? String(match.id) : ''
  }, [municipalities, prefillSlug])
  const [municipalityId, setMunicipalityId] = useState(initialMunicipalityId)

  // The modal stays mounted (sibling of the filters form), so the municipality
  // must re-sync to the active filter's prefill on every open — otherwise a
  // stale selection would be silently submitted.
  useEffect(() => {
    if (open) setMunicipalityId(initialMunicipalityId)
  }, [open, initialMunicipalityId])

  useCampaignFormSuccessToast(state, () => onOpenChange(false))

  const municipalityError = fieldError(state.fieldErrors, 'municipalityId')

  const createForm = (
    <form action={submitAction} className="flex flex-col gap-4">
      <input type="hidden" name="municipalityId" value={municipalityId} />
      <Field>
        <FieldLabel htmlFor={MUNICIPALITY_COMBOBOX_ID}>Município</FieldLabel>
        <FieldDescription>
          O registro fica vinculado a um município da sua carteira.
        </FieldDescription>
        <StrictCombobox
          id={MUNICIPALITY_COMBOBOX_ID}
          options={options}
          value={municipalityId}
          onValueChange={setMunicipalityId}
          error={municipalityError}
        />
        {municipalityError ? (
          <FieldError id={`${MUNICIPALITY_COMBOBOX_ID}-error`}>{municipalityError}</FieldError>
        ) : null}
      </Field>

      <MunicipalityUpdateFields
        idPrefix="campaign-updates-create"
        fieldErrors={state.fieldErrors}
        isStaff={isStaff}
      />

      {state.status !== 'success' ? (
        <CampaignFormActionMessage
          state={state}
          errorTitle="Não foi possível registrar"
          successFallbackMessage="Atualização registrada."
        />
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending} className="min-h-11">
          {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Registrar atualização
        </Button>
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="max-h-[90dvh] border-t border-border bg-background text-foreground">
          <DrawerTitle className="mb-3 text-base font-medium">Nova atualização</DrawerTitle>
          <DrawerDescription className="sr-only">
            Registre um novo fato de campo em um município
          </DrawerDescription>
          <div className="flex flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {createForm}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
        <DialogTitle>Nova atualização</DialogTitle>
        <DialogDescription>Registre um novo fato de campo em um município.</DialogDescription>
        {createForm}
      </DialogContent>
    </Dialog>
  )
}
