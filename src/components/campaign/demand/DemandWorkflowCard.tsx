'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  discardOpsDemandTransitionOutboxRow,
  enqueueDemandTransition,
  readOpsDemandTransitionOutboxRow,
  subscribeOpsDemandTransitionOutboxRow,
} from '@/components/campaign/opsSync/opsDomainOutbox'
import { demandsCollection } from '@/components/campaign/opsSync/opsMirrorClient'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { resolveOpsHybridEnabled } from '@/lib/campaignOps/opsHybridFlag'
import {
  campaignDemandStatuses,
  campaignDemandTransitionLabels,
  campaignDemandTransitions,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import { OPS_UPDATED_AT_CONFLICT_MESSAGE } from '@/lib/schemas/opsCas'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type FormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

type DemandWorkflowCardProps = {
  demandID: number
  status: CampaignDemandStatus
  /** Coordinator or candidate — the roles allowed to decide escalated demands. */
  canDecideEscalated: boolean
  currentCost: number | null
  /** OH13 — CAS base when OPS_HYBRID outbox path is on. */
  updatedAt?: string
  opsHybridEnabled?: boolean
  transitionFormAction: FormAction
  costFormAction: FormAction
  receiptFormAction: FormAction
}

const CONFLICT_TOAST_ID_PREFIX = 'ops-demand-transition-conflict:'

const transitionVariant = (target: CampaignDemandStatus) =>
  target === 'aprovada' ? 'default' : target === 'rejeitada' ? 'destructive' : 'secondary'

/** Staff-only workflow: analysis, escalation, decision, cost and receipts. */
export const DemandWorkflowCard = ({
  demandID,
  status,
  canDecideEscalated,
  currentCost,
  updatedAt,
  opsHybridEnabled = resolveOpsHybridEnabled(),
  transitionFormAction,
  costFormAction,
  receiptFormAction,
}: DemandWorkflowCardProps) => {
  const router = useRouter()
  const [transitionState, submitTransition, transitionPending] = useActionState(
    transitionFormAction,
    {},
  )
  const [costState, submitCost, costPending] = useActionState(costFormAction, {})
  const [receiptState, submitReceipt, receiptPending] = useActionState(receiptFormAction, {})
  const [hybridPending, setHybridPending] = useState(false)
  const [hybridMessage, setHybridMessage] = useState<string | null>(null)
  const previousOutboxStatusRef = useRef<string | undefined>(undefined)

  const outboxRow = useSyncExternalStore(
    (onStoreChange) =>
      opsHybridEnabled
        ? subscribeOpsDemandTransitionOutboxRow(demandID, onStoreChange)
        : () => undefined,
    () => (opsHybridEnabled ? readOpsDemandTransitionOutboxRow(demandID) : undefined),
    () => undefined,
  )

  useEffect(() => {
    const previous = previousOutboxStatusRef.current
    previousOutboxStatusRef.current = outboxRow?.statusSync
    if (previous === 'pending' && outboxRow === undefined) {
      router.refresh()
    }
  }, [outboxRow, router])

  useEffect(() => {
    if (!opsHybridEnabled || outboxRow?.statusSync !== 'conflict') return
    const toastId = `${CONFLICT_TOAST_ID_PREFIX}${demandID}`
    toast.message(OPS_UPDATED_AT_CONFLICT_MESSAGE, {
      id: toastId,
      duration: Infinity,
      action: {
        label: 'Manter o meu',
        onClick: () => {
          void enqueueDemandTransition({
            demandId: demandID,
            status: outboxRow.status,
            decisionNote: outboxRow.decisionNote,
            baseUpdatedAt: outboxRow.serverUpdatedAt ?? null,
          })
        },
      },
      cancel: {
        label: 'Usar o novo',
        onClick: () => {
          discardOpsDemandTransitionOutboxRow(demandID)
          router.refresh()
        },
      },
    })
    return () => {
      toast.dismiss(toastId)
    }
  }, [opsHybridEnabled, outboxRow, demandID, router])

  const availableTransitions = campaignDemandTransitions[status].filter(
    (target) =>
      canDecideEscalated ||
      status !== 'escalada' ||
      (target !== 'aprovada' && target !== 'rejeitada'),
  )

  const onHybridTransition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const rawStatus =
      submitter instanceof HTMLButtonElement && submitter.name === 'status'
        ? submitter.value
        : data.get('status')
    if (
      typeof rawStatus !== 'string' ||
      !campaignDemandStatuses.includes(rawStatus as CampaignDemandStatus)
    ) {
      setHybridMessage('Status de demanda inválido.')
      return
    }
    const decisionNoteRaw = data.get('decisionNote')
    const decisionNote =
      typeof decisionNoteRaw === 'string' && decisionNoteRaw.trim() !== ''
        ? decisionNoteRaw.trim()
        : null
    const mirrorUpdatedAt = demandsCollection.get(demandID)?.updatedAt

    setHybridPending(true)
    setHybridMessage(null)
    void enqueueDemandTransition({
      demandId: demandID,
      status: rawStatus as CampaignDemandStatus,
      decisionNote,
      baseUpdatedAt: mirrorUpdatedAt ?? updatedAt,
    }).then(
      () => {
        setHybridPending(false)
        setHybridMessage('Decisão enfileirada. Será enviada ao reconectar.')
      },
      (error: unknown) => {
        setHybridPending(false)
        setHybridMessage(
          error instanceof Error ? error.message : 'Não foi possível enfileirar a decisão.',
        )
      },
    )
  }

  const transitionBusy =
    opsHybridEnabled
      ? hybridPending || outboxRow?.statusSync === 'pending'
      : transitionPending

  return (
    <section
      aria-labelledby="demand-workflow-title"
      className="flex flex-col gap-6 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="demand-workflow-title" className="text-base font-medium">
            Tratar demanda
          </h2>
          {outboxRow?.statusSync === 'pending' ? (
            <Badge variant="estimate-pending">Pendente</Badge>
          ) : null}
          {outboxRow?.statusSync === 'conflict' ? (
            <Badge variant="destructive">Conflito</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          O assessor analisa e decide — ou escala ao Coordenador Geral. Demandas escaladas são
          decididas somente por ele.
        </p>
      </div>

      {availableTransitions.length ? (
        <form
          action={opsHybridEnabled ? undefined : submitTransition}
          onSubmit={opsHybridEnabled ? onHybridTransition : undefined}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="demandId" value={demandID} />
          <Field>
            <FieldLabel htmlFor={`demand-note-${demandID}`}>Nota da decisão</FieldLabel>
            <Textarea
              id={`demand-note-${demandID}`}
              name="decisionNote"
              rows={2}
              maxLength={2000}
              placeholder="Contexto do encaminhamento (visível para quem abriu)…"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((target) => (
              <Button
                key={target}
                type="submit"
                name="status"
                value={target}
                variant={transitionVariant(target)}
                disabled={transitionBusy}
                className="min-h-11"
              >
                {transitionBusy ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                {campaignDemandTransitionLabels[target]}
              </Button>
            ))}
          </div>
          {!opsHybridEnabled && transitionState.message && transitionState.status !== 'success' ? (
            <Alert variant="destructive">
              <AlertDescription>{transitionState.message}</AlertDescription>
            </Alert>
          ) : null}
          {!opsHybridEnabled && transitionState.status === 'success' ? (
            <Alert>
              <AlertDescription>{transitionState.message}</AlertDescription>
            </Alert>
          ) : null}
          {hybridMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {hybridMessage}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Esta demanda já foi decidida.</p>
      )}

      <form action={submitCost} className="flex flex-col gap-2">
        <input type="hidden" name="demandId" value={demandID} />
        <FieldLabel htmlFor={`demand-cost-${demandID}`}>
          Custo estimado (R$) — controle interno
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`demand-cost-${demandID}`}
            name="cost"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={currentCost ?? undefined}
            className="min-h-11 w-40"
          />
          <Button type="submit" variant="secondary" disabled={costPending} className="min-h-11">
            {costPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Salvar custo
          </Button>
        </div>
        {fieldError(costState.fieldErrors, 'cost') ? (
          <FieldError>{fieldError(costState.fieldErrors, 'cost')}</FieldError>
        ) : null}
        {costState.message && costState.status !== 'success' ? (
          <Alert variant="destructive">
            <AlertDescription>{costState.message}</AlertDescription>
          </Alert>
        ) : null}
      </form>

      <form action={submitReceipt} className="flex flex-col gap-2">
        <input type="hidden" name="demandId" value={demandID} />
        <FieldLabel htmlFor={`demand-receipt-${demandID}`}>
          Anexar comprovante (imagem ou PDF, até 10 MB)
        </FieldLabel>
        <p className="text-xs text-muted-foreground">
          Controle interno de gastos — não substitui a prestação de contas oficial (SPCE/TSE).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`demand-receipt-${demandID}`}
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            className="min-h-11 max-w-xs"
          />
          <Button type="submit" variant="secondary" disabled={receiptPending} className="min-h-11">
            {receiptPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Anexar
          </Button>
        </div>
        {receiptState.message && receiptState.status !== 'success' ? (
          <Alert variant="destructive">
            <AlertDescription>{receiptState.message}</AlertDescription>
          </Alert>
        ) : null}
        {receiptState.status === 'success' ? (
          <Alert>
            <AlertDescription>{receiptState.message}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </section>
  )
}
