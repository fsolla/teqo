'use client'

import { startTransition, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

type WizardStepFormChromeCommonProps = {
  isPending: boolean
  /** sr-only announcement read out while the step is saving. */
  pendingAnnouncement: string
  ctaLabel: string
  children: ReactNode
  leadingSubmit?: ReactNode
  submitBarClassName?: string
  ctaClassName?: string
}

/**
 * Shared chrome of the wizard final steps (D11): pending attributes, submit
 * bar with Spinner + "Salvando…" and the sr-only pending announcement. Two
 * modes — `action` renders a `<form>` with a submit CTA (the three
 * `useActionState` steps); `onCtaClick` renders a plain `<div>` with a
 * button CTA (the votes step, which saves via `useTransition` + fetch).
 */
export const WizardStepFormChrome = (
  props:
    | ({
        action: (formData: FormData) => void | Promise<void>
      } & WizardStepFormChromeCommonProps)
    | ({ onCtaClick: () => void } & WizardStepFormChromeCommonProps),
) => {
  const {
    isPending,
    pendingAnnouncement,
    ctaLabel,
    children,
    leadingSubmit,
    submitBarClassName,
    ctaClassName,
  } = props

  const submitButton = (
    <>
      {leadingSubmit}
      <Button
        type={'action' in props ? 'submit' : 'button'}
        disabled={isPending}
        onClick={'action' in props ? undefined : props.onCtaClick}
        className={cn('min-h-11 min-w-[7rem]', ctaClassName)}
      >
        {isPending ? (
          <>
            <Spinner data-icon="inline-start" aria-hidden="true" />
            Salvando…
          </>
        ) : (
          ctaLabel
        )}
      </Button>
    </>
  )

  const pendingAttrs = {
    'aria-busy': isPending || undefined,
    'data-pending': isPending ? '' : undefined,
  }

  const content = (
    <>
      {children}
      <div className={cn('flex items-center justify-end', submitBarClassName)}>{submitButton}</div>
      <div aria-live="polite" className="sr-only">
        {isPending ? pendingAnnouncement : null}
      </div>
    </>
  )

  // C140 — manual dispatch (no `action={props.action}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping typed values
  // on a validation error — the step stays visible, so the wipe showed.
  // `startTransition` keeps `isPending` correct for the imperative dispatch.
  const handleSubmit =
    'action' in props
      ? (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          startTransition(() => props.action(new FormData(event.currentTarget)))
        }
      : undefined

  return 'action' in props ? (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" {...pendingAttrs}>
      {content}
    </form>
  ) : (
    <div className="flex flex-col gap-6" {...pendingAttrs}>
      {content}
    </div>
  )
}
