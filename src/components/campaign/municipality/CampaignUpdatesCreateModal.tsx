'use client'

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

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
import { cn } from '@/lib/utils'
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

  // C140 — manual dispatch (no `action={submitAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping typed values
  // on a validation error — the modal stays open, so the wipe showed.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  // Mobile sheet: list-style form — no visible labels/borders, full-bleed
  // divider rows, descriptive placeholders (C107). The label stays for the
  // accessible name; the sheet auto-sizes to the content with its ceiling at
  // the top of the screen (`max-h-dvh`), scrolling internally only when the
  // content outgrows the viewport (e.g. open keyboard). Desktop keeps the
  // labeled dialog chrome.
  const createForm = (
    <form onSubmit={handleSubmit} className={cn('flex flex-col', !isMobile && 'gap-4')}>
      <input type="hidden" name="municipalityId" value={municipalityId} />
      {isMobile ? (
        <>
          <div className="px-4 py-1">
            <FieldLabel htmlFor={MUNICIPALITY_COMBOBOX_ID} className="sr-only">
              Município
            </FieldLabel>
            <StrictCombobox
              id={MUNICIPALITY_COMBOBOX_ID}
              options={options}
              value={municipalityId}
              onValueChange={setMunicipalityId}
              error={municipalityError}
              placeholder="Adicionar município"
              className="min-h-11 w-full rounded-none border-0 bg-transparent shadow-none dark:bg-transparent"
            />
            {municipalityError ? (
              <FieldError id={`${MUNICIPALITY_COMBOBOX_ID}-error`}>{municipalityError}</FieldError>
            ) : null}
          </div>
          <div className="border-t border-border" />
        </>
      ) : (
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
      )}

      <MunicipalityUpdateFields
        idPrefix="campaign-updates-create"
        fieldErrors={state.fieldErrors}
        isStaff={isStaff}
        layout={isMobile ? 'list' : 'labeled'}
      />

      {state.status !== 'success' && state.message ? (
        <div className={cn(isMobile && 'border-t border-border px-4 pt-3')}>
          <CampaignFormActionMessage
            state={state}
            errorTitle="Não foi possível registrar"
            successFallbackMessage="Atualização registrada."
          />
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
          isMobile && 'border-t border-border px-4 pt-4 pb-1',
        )}
      >
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
        <DrawerContent className="max-h-dvh border-t border-border bg-background text-foreground">
          <DrawerTitle className="sr-only">Nova atualização</DrawerTitle>
          <DrawerDescription className="sr-only">
            Registre um novo fato de campo em um município
          </DrawerDescription>
          <div className="flex flex-col overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
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
