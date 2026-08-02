'use client'

import { useRouter } from 'next/navigation'
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import { toast } from 'sonner'

import {
  discardOpsEstimateOutboxRow,
  enqueueEstimateVotes,
  getOpsEstimateOfflineExecutor,
  readOpsEstimateOutboxRow,
  subscribeOpsEstimateOutboxRow,
} from '@/components/campaign/opsSync/opsEstimateOutbox'
import type { OpsEstimateSyncStatus } from '@/components/campaign/opsSync/opsEstimateOutboxModel'
import {
  readOpsVotePledge,
  subscribeOpsVotePledge,
} from '@/components/campaign/opsSync/opsMirrorClient'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { OPS_ESTIMATE_CONFLICT_MESSAGE } from '@/lib/schemas/votePledge'
import {
  toVoteEstimateScenarioViewModel,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type PledgeEstimateFormProps = {
  pledgeID: number
  currentEstimatedVotes: VoteEstimateScenarioViewModel
  currentEstimateNote: string | null
  /** RSC `estimatedAt` used as CAS base when the hybrid outbox path is on. */
  currentEstimatedAt: string | null
  opsHybridEnabled: boolean
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

const syncStatusLabel: Record<OpsEstimateSyncStatus, string> = {
  pending: 'Pendente',
  synced: 'Sincronizado',
  conflict: 'Conflito',
  error: 'Erro',
}

const syncStatusBadgeVariant: Record<
  Exclude<OpsEstimateSyncStatus, 'synced'>,
  'estimate-pending' | 'destructive'
> = {
  pending: 'estimate-pending',
  conflict: 'destructive',
  error: 'destructive',
}

/** Mirrors `voteEstimateScenarioFromForm` field names without importing server-only formData. */
const readScenarioFromForm = (form: HTMLFormElement): VoteEstimateScenarioViewModel => {
  const data = new FormData(form)
  const read = (name: string): number | null => {
    const raw = data.get(name)
    if (typeof raw !== 'string' || raw.trim() === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? Math.trunc(value) : null
  }
  return toVoteEstimateScenarioViewModel({
    pessimistic: read('estimatedVotesPessimistic'),
    central: read('estimatedVotesCentral'),
    optimistic: read('estimatedVotesOptimistic'),
  })
}

const CONFLICT_TOAST_ID_PREFIX = 'ops-estimate-conflict:'

/** Staff-only inline estimate. The leader never sees these fields. */
export const PledgeEstimateForm = ({
  pledgeID,
  currentEstimatedVotes,
  currentEstimateNote,
  currentEstimatedAt: _currentEstimatedAt,
  opsHybridEnabled,
  formAction,
}: PledgeEstimateFormProps) => {
  if (!opsHybridEnabled) {
    return (
      <LegacyPledgeEstimateForm
        pledgeID={pledgeID}
        currentEstimatedVotes={currentEstimatedVotes}
        currentEstimateNote={currentEstimateNote}
        formAction={formAction}
      />
    )
  }

  return (
    <HybridPledgeEstimateForm
      pledgeID={pledgeID}
    />
  )
}

const LegacyPledgeEstimateForm = ({
  pledgeID,
  currentEstimatedVotes,
  currentEstimateNote,
  formAction,
}: Omit<PledgeEstimateFormProps, 'opsHybridEnabled' | 'currentEstimatedAt'>) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  return (
    <form action={submitAction} className="flex flex-col gap-3">
      <input type="hidden" name="pledgeId" value={pledgeID} />
      <VoteEstimateScenarioInputs
        fieldPrefix="estimatedVotes"
        values={currentEstimatedVotes}
        idPrefix={`pledge-estimate-${pledgeID}`}
      />
      <Field>
        <FieldLabel htmlFor={`pledge-note-${pledgeID}`} className="text-xs">
          Justificativa
        </FieldLabel>
        <Input
          id={`pledge-note-${pledgeID}`}
          name="estimateNote"
          maxLength={1000}
          defaultValue={currentEstimateNote ?? undefined}
          className="min-h-11"
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        disabled={isPending}
        className="min-h-11 self-start"
      >
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar estimativa
      </Button>
      {fieldError(state.fieldErrors, 'estimatedVotes') ||
      fieldError(state.fieldErrors, 'pessimistic') ||
      fieldError(state.fieldErrors, 'central') ||
      fieldError(state.fieldErrors, 'optimistic') ? (
        <FieldError>
          {fieldError(state.fieldErrors, 'estimatedVotes') ||
            fieldError(state.fieldErrors, 'pessimistic') ||
            fieldError(state.fieldErrors, 'central') ||
            fieldError(state.fieldErrors, 'optimistic')}
        </FieldError>
      ) : null}
      {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
    </form>
  )
}

const HybridPledgeEstimateForm = ({ pledgeID }: { pledgeID: number }) => {
  const router = useRouter()
  const liveRegionId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const previousStatusRef = useRef<OpsEstimateSyncStatus | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Override only until the mirror row catches up after "Manter o meu".
  const [baseOverride, setBaseOverride] = useState<string | null | undefined>(undefined)

  const mirrorPledge = useSyncExternalStore(
    (onStoreChange) => subscribeOpsVotePledge(pledgeID, onStoreChange),
    () => readOpsVotePledge(pledgeID),
    () => undefined,
  )

  const mirrorEstimatedVotes = toVoteEstimateScenarioViewModel(mirrorPledge?.estimatedVotes)
  const mirrorEstimateNote = mirrorPledge?.estimateNote ?? null
  const mirrorEstimatedAt = mirrorPledge?.estimatedAt ?? null
  const baseEstimatedAt = baseOverride !== undefined ? baseOverride : mirrorEstimatedAt

  const outboxRow = useSyncExternalStore(
    (onStoreChange) => subscribeOpsEstimateOutboxRow(pledgeID, onStoreChange),
    () => readOpsEstimateOutboxRow(pledgeID),
    () => undefined,
  )

  useEffect(() => {
    // Restore IndexedDB outbox + optimistic rows across reload.
    void getOpsEstimateOfflineExecutor()
  }, [])

  useEffect(() => {
    setBaseOverride(undefined)
  }, [mirrorEstimatedAt])

  useEffect(() => {
    const previous = previousStatusRef.current
    previousStatusRef.current = outboxRow?.status
    if (previous === 'pending' && outboxRow === undefined) {
      router.refresh()
    }
  }, [outboxRow, router])

  useEffect(() => {
    if (outboxRow?.status !== 'conflict') return

    const toastId = `${CONFLICT_TOAST_ID_PREFIX}${pledgeID}`
    toast.message(OPS_ESTIMATE_CONFLICT_MESSAGE, {
      id: toastId,
      duration: Infinity,
      action: {
        label: 'Manter o meu',
        onClick: () => {
          const form = formRef.current
          if (!form) return
          const estimatedVotes = readScenarioFromForm(form)
          const estimateNoteRaw = new FormData(form).get('estimateNote')
          const estimateNote =
            typeof estimateNoteRaw === 'string' && estimateNoteRaw.trim() !== ''
              ? estimateNoteRaw.trim()
              : null
          void enqueueEstimateVotes({
            pledge: pledgeID,
            estimatedVotes,
            estimateNote,
            baseEstimatedAt: outboxRow.serverEstimatedAt ?? null,
          }).then(
            () => {
              setBaseOverride(outboxRow.serverEstimatedAt ?? null)
              setFormError(null)
            },
            (error: unknown) => {
              setFormError(
                error instanceof Error ? error.message : 'Não foi possível reenviar a estimativa.',
              )
            },
          )
        },
      },
      cancel: {
        label: 'Usar o novo',
        onClick: () => {
          discardOpsEstimateOutboxRow(pledgeID)
          setFormError(null)
          router.refresh()
        },
      },
    })

    return () => {
      toast.dismiss(toastId)
    }
  }, [outboxRow?.status, outboxRow?.serverEstimatedAt, pledgeID, router])

  const status = outboxRow?.status
  const pending = isSubmitting || status === 'pending'
  const fieldsKey = `pledge-estimate-fields-${pledgeID}-${outboxRow?.status ?? 'mirror'}-${mirrorEstimatedAt ?? 'none'}`

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const estimatedVotes = readScenarioFromForm(form)
    const estimateNoteRaw = new FormData(form).get('estimateNote')
    const estimateNote =
      typeof estimateNoteRaw === 'string' && estimateNoteRaw.trim() !== ''
        ? estimateNoteRaw.trim()
        : null

    setIsSubmitting(true)
    setFormError(null)

    void enqueueEstimateVotes({
      pledge: pledgeID,
      estimatedVotes,
      estimateNote,
      baseEstimatedAt,
    }).then(
      () => {
        setIsSubmitting(false)
        setFormError(null)
      },
      (error: unknown) => {
        setIsSubmitting(false)
        setFormError(
          error instanceof Error ? error.message : 'Não foi possível enfileirar a estimativa.',
        )
      },
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" aria-busy={pending}>
      <input type="hidden" name="pledgeId" value={pledgeID} />
      <div className="flex flex-wrap items-center gap-2">
        {status && status !== 'synced' ? (
          <Badge variant={syncStatusBadgeVariant[status]}>{syncStatusLabel[status]}</Badge>
        ) : null}
        <span id={liveRegionId} className="sr-only" aria-live="polite">
          {pending ? 'Salvando estimativa…' : null}
        </span>
      </div>
      <div key={fieldsKey} className="flex flex-col gap-3">
        <VoteEstimateScenarioInputs
          fieldPrefix="estimatedVotes"
          values={outboxRow?.estimatedVotes ?? mirrorEstimatedVotes}
          idPrefix={`pledge-estimate-${pledgeID}`}
        />
        <Field>
          <FieldLabel htmlFor={`pledge-note-${pledgeID}`} className="text-xs">
            Justificativa
          </FieldLabel>
          <Input
            id={`pledge-note-${pledgeID}`}
            name="estimateNote"
            maxLength={1000}
            defaultValue={outboxRow?.estimateNote ?? mirrorEstimateNote ?? undefined}
            className="min-h-11"
          />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="min-h-11 self-start">
        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar estimativa
      </Button>
      {formError ? <FieldError>{formError}</FieldError> : null}
    </form>
  )
}
