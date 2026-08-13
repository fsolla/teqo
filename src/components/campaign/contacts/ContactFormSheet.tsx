'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import {
  ContactFormFields,
  type ContactFormDefaults,
} from '@/components/campaign/contacts/ContactFormFields'
import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { Button } from '@/components/ui/button'
import { DrawerCloseButton } from '@/components/ui/Drawer'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

/**
 * C139 — the mobile ficha sheet (edit card / create FAB): the shared
 * `CampaignListSheetProvider` drawer via `CampaignCellEditOverlay`, the whole
 * ficha as ONE form (plan decision F) and the custom footer submit. Success
 * toasts, closes and refreshes; field errors render inline in the body.
 */
export const ContactFormSheet = ({
  title,
  description,
  trigger,
  triggerLabel,
  triggerClassName,
  formAction,
  defaults,
  successMessage,
  deleteControl,
  contactId,
}: {
  title: string
  description?: string
  trigger: ReactNode
  triggerLabel: string
  triggerClassName?: string
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  defaults: ContactFormDefaults
  successMessage: string
  /** Rendered under the form, outside it (the destructive dialog, edit only). */
  deleteControl?: ReactNode
  /** Edit mode: the record being updated (submitted as the `id` field). */
  contactId?: string
}) => {
  const router = useRouter()
  const formId = useId()
  const [open, setOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const [formActionState, submitAction, isPending] = useActionState<
    CampaignFormActionState,
    FormData
  >(formAction, {})

  // Bump on every open so the fields can drop a PREVIOUS session's action
  // state (the sheet wrapper stays mounted; useActionState does not reset).
  useEffect(() => {
    if (open) setOpenCount((count) => count + 1)
  }, [open])

  useEffect(() => {
    if (formActionState.status !== 'success') return
    toast.success(formActionState.message ?? successMessage)
    setOpen(false)
    router.refresh()
  }, [formActionState, router, successMessage])

  const footer = (
    <div className="flex w-full flex-col gap-2">
      <Button form={formId} type="submit" disabled={isPending} className="min-h-11 w-full">
        {isPending ? <Spinner data-icon="inline-start" /> : null}
        Salvar
      </Button>
      <DrawerCloseButton disabled={isPending}>Cancelar</DrawerCloseButton>
    </div>
  )

  return (
    <CampaignCellEditOverlay
      variant="sheet"
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={trigger}
      triggerLabel={triggerLabel}
      triggerClassName={triggerClassName}
      footer={footer}
      sheetBodyClassName="gap-4"
    >
      <ContactFormFields
        formId={formId}
        state={formActionState}
        sessionId={openCount}
        submitAction={submitAction}
        defaults={defaults}
        contactId={contactId}
      />
      {deleteControl}
    </CampaignCellEditOverlay>
  )
}
