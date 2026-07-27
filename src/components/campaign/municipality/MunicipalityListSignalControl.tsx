'use client'

import { useActionState, useEffect, useId, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { MunicipalitySignalFields } from '@/components/campaign/municipality/MunicipalitySignalFields'
import {
  campaignCellEditTriggerClassName,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatMunicipalitySignalAgeLabel,
  municipalitySignalAgeInDays,
} from '@/utilities/municipalitySignal'

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

const SignalFormFields = ({
  municipalityID,
  municipalitySlug,
  idPrefix,
  state,
  isPending,
}: {
  municipalityID: number
  municipalitySlug: string
  idPrefix: string
  state: CampaignFormActionState
  isPending: boolean
}) => (
  <>
    <input type="hidden" name="municipalityId" value={municipalityID} />
    <input type="hidden" name="municipalitySlug" value={municipalitySlug} />
    <MunicipalitySignalFields idPrefix={idPrefix} fieldErrors={state.fieldErrors} />
    {state.message && state.status !== 'success' ? (
      <Alert variant="destructive">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    ) : null}
    <span className="sr-only" aria-live="polite">
      {isPending ? 'Registrando sinal…' : ''}
    </span>
  </>
)

const SubmitButton = ({ isPending }: { isPending: boolean }) => (
  <Button type="submit" disabled={isPending} className="min-h-11 w-full">
    {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
    Registrar sinal
  </Button>
)

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
  const frescorLabel = formatMunicipalitySignalAgeLabel(municipalitySignalAgeInDays(lastSignalAt))
  const triggerLabel = `Registrar sinal em ${municipalityName} — ${frescorLabel}`

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    setOpen(false)
    setFormKey((key) => key + 1)
  }, [state.message, state.status])

  // This control keeps its own container (its `<form>` has to wrap header, body
  // and submit), so it borrows the shell's trigger instead of re-spelling it —
  // `relative` included, which is what keeps the tap on the mobile card.
  const triggerClassName = cn(campaignCellEditTriggerClassName, 'text-left')
  const triggerProps = {
    type: 'button',
    'aria-expanded': open,
    'aria-haspopup': 'dialog',
    'aria-busy': isPending || undefined,
    className: triggerClassName,
    'aria-label': triggerLabel,
  } as const

  const fields = (
    <SignalFormFields
      municipalityID={municipalityID}
      municipalitySlug={municipalitySlug}
      idPrefix={idPrefix}
      state={state}
      isPending={isPending}
    />
  )

  if (variant === 'sheet') {
    return (
      <>
        <button {...triggerProps} onClick={() => setOpen(true)}>
          {children}
        </button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <form key={formKey} action={submitAction} className="flex min-h-0 flex-1 flex-col">
              <DrawerHeader>
                <DrawerTitle>Registrar sinal</DrawerTitle>
                <DrawerDescription>{municipalityName}</DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
                {fields}
              </div>
              <DrawerFooter>
                <SubmitButton isPending={isPending} />
                <DrawerClose
                  render={<Button type="button" variant="outline" className="min-h-11 w-full" />}
                >
                  Cancelar
                </DrawerClose>
              </DrawerFooter>
            </form>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button {...triggerProps}>{children}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form key={formKey} action={submitAction} className="flex flex-col gap-3">
          {fields}
          <SubmitButton isPending={isPending} />
        </form>
      </PopoverContent>
    </Popover>
  )
}
