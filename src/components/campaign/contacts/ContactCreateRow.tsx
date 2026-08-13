'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { useContactCreate } from '@/components/campaign/contacts/ContactCreateState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { CitiesByState } from '@/lib/cities'
import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/lib/phone'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { firstFormActionMessage } from '@/utilities/campaignFormFields'

const stateOptions = Object.keys(CitiesByState)

const rowInputClassName =
  'border-border/60 bg-background shadow-none focus-visible:ring-1 focus-visible:ring-ring/50'

type ContactCreateRowProps = {
  /** The `contatos/formActions` create ladder (`runCampaignFormAction`). */
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/**
 * C139 — the create row of the contacts table: an empty ficha at the top of
 * the list (highlighted background, borderless inputs), mounted by the shared
 * create store (omnibox button / mobile FAB). Salvar stays disabled until the
 * name is filled; a conflict (duplicate name) keeps the typed values and
 * shows the message inside the row; success resets, closes and refreshes.
 */
export const ContactCreateRow = ({ formAction }: ContactCreateRowProps) => {
  const router = useRouter()
  const { open, setOpen } = useContactCreate()
  const formRef = useRef<HTMLFormElement>(null)
  const [hasName, setHasName] = useState(false)
  const [phone, setPhone] = useState('')
  const [formActionState, submitAction, isPending] = useActionState<
    CampaignFormActionState,
    FormData
  >(formAction, {})
  const errorMessage =
    formActionState.status === 'success' ? undefined : firstFormActionMessage(formActionState)

  useEffect(() => {
    if (formActionState.status === 'success') {
      toast.success(formActionState.message)
      formRef.current?.reset()
      setHasName(false)
      setPhone('')
      setOpen(false)
      router.refresh()
    }
  }, [formActionState, router, setOpen])

  if (!open) return null

  // C139 — manual dispatch (no `action={submitAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping the typed name
  // on a validation/conflict error — the row stays open, so the wipe showed.
  // `startTransition` keeps `isPending` correct for the imperative dispatch.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      data-view="contact-create-row"
      aria-busy={isPending}
      className="hidden rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 md:block"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <label
            htmlFor="contact-create-name"
            className="text-xs font-medium text-muted-foreground"
          >
            Nome <span className="text-destructive">*</span>
          </label>
          <Input
            id="contact-create-name"
            name="name"
            required
            autoFocus
            placeholder="Nome e sobrenome"
            aria-label="Nome do contato"
            className={rowInputClassName}
            onChange={(event) => setHasName(event.currentTarget.value.trim().length >= 2)}
          />
        </div>
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
          <label
            htmlFor="contact-create-phone"
            className="text-xs font-medium text-muted-foreground"
          >
            Telefone
          </label>
          <Input
            id="contact-create-phone"
            name="phone"
            inputMode="numeric"
            placeholder="(71) 9 0000-0000"
            aria-label="Telefone do contato"
            className={rowInputClassName}
            value={phone}
            onChange={(event) =>
              setPhone(
                formatBrazilianPhoneInput(sanitizeBrazilianPhoneInput(event.currentTarget.value)),
              )
            }
          />
        </div>
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
          <label
            htmlFor="contact-create-email"
            className="text-xs font-medium text-muted-foreground"
          >
            E-mail
          </label>
          <Input
            id="contact-create-email"
            name="email"
            type="email"
            placeholder="nome@email.com"
            aria-label="E-mail do contato"
            className={rowInputClassName}
          />
        </div>
        <div className="flex min-w-32 flex-1 flex-col gap-1.5">
          <label
            htmlFor="contact-create-city"
            className="text-xs font-medium text-muted-foreground"
          >
            Cidade
          </label>
          <Input
            id="contact-create-city"
            name="city"
            placeholder="Cidade"
            aria-label="Cidade do contato"
            className={rowInputClassName}
          />
        </div>
        <div className="flex min-w-24 flex-col gap-1.5">
          <label
            htmlFor="contact-create-state"
            className="text-xs font-medium text-muted-foreground"
          >
            Estado
          </label>
          <select
            id="contact-create-state"
            name="state"
            defaultValue="BA"
            aria-label="Estado do contato"
            className={cn(
              rowInputClassName,
              'min-h-10 rounded-md border bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none',
            )}
          >
            {stateOptions.map((stateKey) => (
              <option key={stateKey} value={stateKey}>
                {stateKey}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-24 flex-col gap-1.5">
          <label
            htmlFor="contact-create-postal-code"
            className="text-xs font-medium text-muted-foreground"
          >
            CEP
          </label>
          <Input
            id="contact-create-postal-code"
            name="postalCode"
            inputMode="numeric"
            maxLength={8}
            placeholder="00000000"
            aria-label="CEP do contato"
            className={rowInputClassName}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit" disabled={!hasName || isPending} className="min-h-10">
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            className="min-h-10"
            onClick={() => {
              formRef.current?.reset()
              setHasName(false)
              setPhone('')
              setOpen(false)
            }}
          >
            Descartar
          </Button>
        </div>
      </div>
      {errorMessage ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </form>
  )
}
