'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { EngagementLevelViolation } from '@/lib/engagementLevel'
import { ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH } from '@/lib/engagementLevel'

export type MunicipalityV2StatusReasonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  reasonLabel?: string
  reasonPlaceholder?: string
  confirmLabel?: string
  isPending?: boolean
  errorMessage?: string | null
  /** Level-only: show triangulated-shock checkbox. */
  showTriangulatedShock?: boolean
  triangulatedShock?: boolean
  onTriangulatedShockChange?: (value: boolean) => void
  violations?: EngagementLevelViolation[]
  override?: boolean
  onOverrideChange?: (value: boolean) => void
  onConfirm: (reason: string) => void
}

/**
 * Shared optional-motivo confirm for nível / tendência / sinal on the v2 strip.
 * Empty reason is OK — product rite from B134/B147.
 */
export const MunicipalityV2StatusReasonDialog = ({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel = 'Motivo (opcional)',
  reasonPlaceholder = 'Contexto para esta mudança, se quiser registrar.',
  confirmLabel = 'Confirmar',
  isPending = false,
  errorMessage = null,
  showTriangulatedShock = false,
  triangulatedShock = false,
  onTriangulatedShockChange,
  violations = [],
  override = false,
  onOverrideChange,
  onConfirm,
}: MunicipalityV2StatusReasonDialogProps) => {
  const id = useId()
  const [reason, setReason] = useState('')
  const canConfirm = violations.length === 0 || override

  const handleOpenChange = (next: boolean) => {
    if (!next) setReason('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-reason`}>{reasonLabel}</FieldLabel>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH}
              rows={3}
              className="min-h-20 resize-y"
              placeholder={reasonPlaceholder}
              disabled={isPending}
            />
          </Field>
          {showTriangulatedShock ? (
            <Field orientation="horizontal" className="min-h-11">
              <Checkbox
                id={`${id}-shock`}
                checked={triangulatedShock}
                onCheckedChange={(checked) => onTriangulatedShockChange?.(checked === true)}
                disabled={isPending}
              />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-shock`}>
                  Choque triangulado (dois níveis de uma vez)
                </FieldLabel>
              </FieldContent>
            </Field>
          ) : null}
          {violations.length > 0 ? (
            <>
              <Alert className="py-2">
                <AlertDescription className="text-xs">
                  <ul className="list-disc space-y-1 pl-4">
                    {violations.map((violation) => (
                      <li key={violation.id}>{violation.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              <Field orientation="horizontal" className="min-h-11">
                <Checkbox
                  id={`${id}-override`}
                  checked={override}
                  onCheckedChange={(checked) => onOverrideChange?.(checked === true)}
                  disabled={isPending}
                />
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-override`}>
                    Registrar mesmo assim, ciente das ressalvas
                  </FieldLabel>
                </FieldContent>
              </Field>
            </>
          ) : null}
          {errorMessage ? (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!canConfirm || isPending}
              onClick={() => onConfirm(reason)}
            >
              {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
              {confirmLabel}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Conceitos:{' '}
            <Link href="/campanha/conceitos" className="underline underline-offset-2">
              glossário da campanha
            </Link>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
