'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { CheckIcon, LightbulbIcon, PencilIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  suggestVoteEstimateFormAction,
  type VoteEstimateFormState,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/voteEstimateFormActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignUser } from '@/payload-types'

type VoteEstimateDialogProps = {
  nucleusId: number
  role: CampaignUser['role']
  confirmedEstimate: number | null
  proposedEstimate: number | null
  confirmAction: VoteEstimateFormAction
}

export type VoteEstimateDialogMode = 'suggest' | 'review' | 'edit'
export type VoteEstimateFormAction = (
  state: VoteEstimateFormState,
  formData: FormData,
) => Promise<VoteEstimateFormState>

type VoteEstimateActionDialogProps = {
  nucleusId: number
  mode: VoteEstimateDialogMode
  initialEstimate: number | null
  proposedEstimate: number | null
  hasConfirmedEstimate: boolean
  confirmAction: VoteEstimateFormAction
  onPendingChange?: (pending: boolean, mode: VoteEstimateDialogMode, succeeded: boolean) => void
  onSuccessClose?: (mode: VoteEstimateDialogMode) => void
}

const VoteEstimateFeedback = ({ state }: { state: VoteEstimateFormState }) => {
  if (!state.message || state.status === 'success') return null

  return (
    <Alert variant="destructive" aria-live="polite">
      <AlertTitle>Não foi possível salvar</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  )
}

export const VoteEstimateActionDialog = ({
  nucleusId,
  mode,
  initialEstimate,
  proposedEstimate,
  confirmAction,
  onPendingChange,
  onSuccessClose,
}: VoteEstimateActionDialogProps) => {
  const isSuggestion = mode === 'suggest'
  const isReview = mode === 'review'
  const isEdit = mode === 'edit'
  const action = isSuggestion ? suggestVoteEstimateFormAction : confirmAction
  const [state, formAction, pending] = useActionState(action, {})
  const [estimate, setEstimate] = useState(String(initialEstimate ?? ''))
  const successfulCloseRef = useRef(false)
  const requiresNote =
    isEdit || (isReview && proposedEstimate != null && Number(estimate) !== proposedEstimate)
  const estimateError = state.fieldErrors?.estimate?.[0]
  const noteError = state.fieldErrors?.confirmationNote?.[0]
  const fieldIdSuffix = mode

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    setEstimate(String(initialEstimate ?? ''))
    successfulCloseRef.current = true
    onSuccessClose?.(mode)
  }, [initialEstimate, mode, onSuccessClose, state])

  useEffect(() => {
    onPendingChange?.(pending, mode, state.status === 'success')
  }, [mode, onPendingChange, pending, state.status])

  useEffect(() => {
    setEstimate(String(initialEstimate ?? ''))
  }, [initialEstimate])

  return (
    <DialogContent
      showCloseButton={!pending}
      onCloseAutoFocus={(event) => {
        if (successfulCloseRef.current) event.preventDefault()
      }}
      onEscapeKeyDown={(event) => {
        if (pending) event.preventDefault()
      }}
      onPointerDownOutside={(event) => {
        if (pending) event.preventDefault()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {isReview
            ? 'Revisar sugestão de estimativa'
            : isEdit
              ? 'Editar estimativa confirmada'
              : 'Sugerir estimativa de votos'}
        </DialogTitle>
        <DialogDescription>
          {isReview
            ? 'Confirme o valor sugerido ou ajuste-o com uma justificativa.'
            : isEdit
              ? 'Registre o novo valor e justifique a alteração da estimativa confirmada.'
              : 'A sugestão ficará pendente até a confirmação da coordenação.'}
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="nucleus" value={nucleusId} />
        <VoteEstimateFeedback state={state} />
        <FieldGroup>
          <Field data-invalid={Boolean(estimateError)}>
            <FieldLabel htmlFor={`vote-estimate-${fieldIdSuffix}`}>
              Estimativa de votos *
            </FieldLabel>
            <Input
              id={`vote-estimate-${fieldIdSuffix}`}
              name="estimate"
              type="number"
              inputMode="numeric"
              min={0}
              max={100000000}
              step={1}
              required
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              className="min-h-11"
              aria-invalid={Boolean(estimateError)}
              aria-describedby={estimateError ? `vote-estimate-error-${fieldIdSuffix}` : undefined}
            />
            <FieldDescription>
              Use este número como régua de mobilização, não como previsão estatística.
            </FieldDescription>
            {estimateError ? (
              <FieldError id={`vote-estimate-error-${fieldIdSuffix}`}>{estimateError}</FieldError>
            ) : null}
          </Field>

          {!isSuggestion ? (
            <Field data-invalid={Boolean(noteError)}>
              <FieldLabel htmlFor={`vote-estimate-note-${fieldIdSuffix}`}>
                {isEdit ? 'Justificativa da alteração' : 'Justificativa do ajuste'}
                {requiresNote ? ' *' : ''}
              </FieldLabel>
              <Textarea
                id={`vote-estimate-note-${fieldIdSuffix}`}
                name="confirmationNote"
                maxLength={1000}
                required={requiresNote}
                aria-invalid={Boolean(noteError)}
                aria-describedby={
                  noteError
                    ? `vote-estimate-note-error-${fieldIdSuffix}`
                    : `vote-estimate-note-help-${fieldIdSuffix}`
                }
              />
              <FieldDescription id={`vote-estimate-note-help-${fieldIdSuffix}`}>
                {isEdit
                  ? 'Obrigatória para registrar por que a estimativa confirmada foi alterada.'
                  : `Obrigatória quando o valor final for diferente da sugestão de ${new Intl.NumberFormat(
                      'pt-BR',
                    ).format(proposedEstimate ?? 0)} votos.`}
              </FieldDescription>
              {noteError ? (
                <FieldError id={`vote-estimate-note-error-${fieldIdSuffix}`}>
                  {noteError}
                </FieldError>
              ) : null}
            </Field>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending
              ? 'Salvando…'
              : isSuggestion
                ? 'Enviar sugestão'
                : isEdit
                  ? 'Salvar estimativa'
                  : 'Confirmar estimativa'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

const StandaloneVoteEstimateDialog = (
  props: Omit<VoteEstimateActionDialogProps, 'onPendingChange' | 'onSuccessClose'>,
) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const isReview = props.mode === 'review'
  const isEdit = props.mode === 'edit'
  const label = isReview
    ? 'Revisar sugestão'
    : isEdit
      ? 'Editar confirmada'
      : props.hasConfirmedEstimate
        ? 'Sugerir nova estimativa'
        : 'Sugerir estimativa'

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!pending || nextOpen) && setOpen(nextOpen)}>
      <DialogTrigger asChild>
        <Button type="button" className="min-h-11" variant={isReview ? 'default' : 'outline'}>
          {isReview ? (
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
          ) : isEdit ? (
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <LightbulbIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {label}
        </Button>
      </DialogTrigger>
      {open ? (
        <VoteEstimateActionDialog
          {...props}
          onPendingChange={setPending}
          onSuccessClose={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      ) : null}
    </Dialog>
  )
}

export const VoteEstimateDialog = ({
  nucleusId,
  role,
  confirmedEstimate,
  proposedEstimate,
  confirmAction,
}: VoteEstimateDialogProps) => {
  const canConfirm = role === 'geral' || role === 'coordenador'
  const hasConfirmedEstimate = confirmedEstimate != null

  if (canConfirm && proposedEstimate != null) {
    return (
      <StandaloneVoteEstimateDialog
        nucleusId={nucleusId}
        mode="review"
        initialEstimate={proposedEstimate}
        proposedEstimate={proposedEstimate}
        hasConfirmedEstimate={hasConfirmedEstimate}
        confirmAction={confirmAction}
      />
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <StandaloneVoteEstimateDialog
        nucleusId={nucleusId}
        mode="suggest"
        initialEstimate={confirmedEstimate}
        proposedEstimate={null}
        hasConfirmedEstimate={hasConfirmedEstimate}
        confirmAction={confirmAction}
      />
      {canConfirm && hasConfirmedEstimate ? (
        <StandaloneVoteEstimateDialog
          nucleusId={nucleusId}
          mode="edit"
          initialEstimate={confirmedEstimate}
          proposedEstimate={null}
          hasConfirmedEstimate
          confirmAction={confirmAction}
        />
      ) : null}
    </div>
  )
}
