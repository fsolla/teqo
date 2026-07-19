'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type { NucleusUpdateFormState } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/nucleusUpdateFormActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { fieldError } from '@/utilities/campaignFormFields'

export type NucleusUpdateFormAction = (
  state: NucleusUpdateFormState,
  formData: FormData,
) => Promise<NucleusUpdateFormState>

const kinds = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'nota', label: 'Nota' },
] as const

export const NucleusUpdateForm = ({
  nucleusId,
  action,
  onClose,
  onPendingChange,
}: {
  nucleusId: number
  action: NucleusUpdateFormAction
  onClose?: () => void
  onPendingChange?: (pending: boolean) => void
}) => {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [kind, setKind] = useState<(typeof kinds)[number]['value']>('semanal')
  const [state, formAction, pending] = useActionState(action, {})
  const isWeekly = kind === 'semanal'
  const bodyError = fieldError(state.fieldErrors, 'body')

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    formRef.current?.reset()
    setKind('semanal')
    router.refresh()
    onClose?.()
  }, [onClose, router, state.message, state.status])

  useEffect(() => {
    onPendingChange?.(pending)
  }, [onPendingChange, pending])

  return (
    <DialogContent
      className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      showCloseButton={!pending}
      onEscapeKeyDown={(event) => {
        if (pending) event.preventDefault()
      }}
      onPointerDownOutside={(event) => {
        if (pending) event.preventDefault()
      }}
    >
      <DialogHeader>
        <DialogTitle>Nova atualização</DialogTitle>
        <DialogDescription>
          Registre o pulso semanal ou uma informação urgente do núcleo.
        </DialogDescription>
      </DialogHeader>
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="nucleus" value={nucleusId} />
        <input type="hidden" name="kind" value={kind} />
        {state.message && state.status !== 'success' ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertTitle>Não foi possível enviar</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Tipo de atualização</FieldLegend>
            <ToggleGroup
              type="single"
              value={kind}
              onValueChange={(value) => value && setKind(value as typeof kind)}
              variant="outline"
              className="flex w-full flex-wrap justify-start"
              aria-label="Tipo de atualização"
            >
              {kinds.map(({ value, label }) => (
                <ToggleGroupItem key={value} value={value}>
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>

          {isWeekly ? (
            <>
              {[
                ['worked', 'O que funcionou'],
                ['failed', 'O que não funcionou'],
                ['needs', 'O que preciso'],
              ].map(([field, label]) => {
                const error = fieldError(state.fieldErrors, field)
                return (
                  <Field key={field} data-invalid={Boolean(error)}>
                    <FieldLabel htmlFor={`update-${field}`}>{label} *</FieldLabel>
                    <Textarea
                      id={`update-${field}`}
                      name={field}
                      required
                      maxLength={3000}
                      className="min-h-24"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `update-${field}-error` : undefined}
                    />
                    {error ? <FieldError id={`update-${field}-error`}>{error}</FieldError> : null}
                  </Field>
                )
              })}
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['activeVolunteers', 'Voluntários ativos'],
                  ['newSupports', 'Novos apoios'],
                ].map(([field, label]) => {
                  const error = fieldError(state.fieldErrors, field)
                  return (
                    <Field key={field} data-invalid={Boolean(error)}>
                      <FieldLabel htmlFor={`update-${field}`}>{label}</FieldLabel>
                      <Input
                        id={`update-${field}`}
                        name={field}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100000000}
                        step={1}
                        className="min-h-11"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `update-${field}-error` : undefined}
                      />
                      {error ? <FieldError id={`update-${field}-error`}>{error}</FieldError> : null}
                    </Field>
                  )
                })}
              </div>
            </>
          ) : (
            <Field data-invalid={Boolean(bodyError)}>
              <FieldLabel htmlFor="update-body">Texto da atualização *</FieldLabel>
              <Textarea
                id="update-body"
                name="body"
                required
                maxLength={5000}
                className="min-h-32"
                aria-invalid={Boolean(bodyError)}
                aria-describedby={bodyError ? 'update-body-error' : undefined}
              />
              {bodyError ? <FieldError id="update-body-error">{bodyError}</FieldError> : null}
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? 'Enviando…' : 'Enviar atualização'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
