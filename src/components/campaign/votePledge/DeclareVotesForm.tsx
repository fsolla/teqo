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
  discardOpsDeclareVotesOutboxRow,
  enqueueDeclareVotes,
  getOpsMunicipalityOfflineExecutor,
  readOpsDeclareVotesOutboxRow,
  subscribeOpsDeclareVotesOutboxRow,
} from '@/components/campaign/opsSync/opsMunicipalityOutbox'
import type { OpsMunicipalityWriteSyncStatus } from '@/components/campaign/opsSync/opsMunicipalityOutboxModel'
import {
  subscribeOpsVotePledge,
  votePledgesCollection,
} from '@/components/campaign/opsSync/opsVotePledgeMirror'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { resolveOpsHybridEnabled } from '@/lib/campaignOps/opsHybridFlag'
import { OPS_UPDATED_AT_CONFLICT_MESSAGE } from '@/lib/schemas/opsCas'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type DeclareVotesFormProps = {
  municipalityID: number
  /** Present when staff declare on behalf of a leadership. */
  leadershipID?: number
  currentDeclaredVotes: number | null
  /** Pledge row `updatedAt` for CAS when a pledge already exists. */
  currentUpdatedAt?: string | null
  opsHybridEnabled?: boolean
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

const syncStatusLabel: Record<OpsMunicipalityWriteSyncStatus, string> = {
  pending: 'Pendente',
  synced: 'Sincronizado',
  conflict: 'Conflito',
  error: 'Erro',
}

const CONFLICT_TOAST_ID_PREFIX = 'ops-declare-conflict:'

export const DeclareVotesForm = ({
  municipalityID,
  leadershipID,
  currentDeclaredVotes,
  currentUpdatedAt = null,
  opsHybridEnabled = resolveOpsHybridEnabled(),
  formAction,
}: DeclareVotesFormProps) => {
  if (!opsHybridEnabled || leadershipID === undefined) {
    return (
      <LegacyDeclareVotesForm
        municipalityID={municipalityID}
        leadershipID={leadershipID}
        currentDeclaredVotes={currentDeclaredVotes}
        formAction={formAction}
      />
    )
  }

  return (
    <HybridDeclareVotesForm
      municipalityID={municipalityID}
      leadershipID={leadershipID}
      currentDeclaredVotes={currentDeclaredVotes}
      currentUpdatedAt={currentUpdatedAt}
    />
  )
}

const LegacyDeclareVotesForm = ({
  municipalityID,
  leadershipID,
  currentDeclaredVotes,
  formAction,
}: Omit<DeclareVotesFormProps, 'opsHybridEnabled' | 'currentUpdatedAt'>) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  return (
    <form action={submitAction} className="flex flex-col gap-3">
      <input type="hidden" name="municipalityId" value={municipalityID} />
      {leadershipID !== undefined ? (
        <input type="hidden" name="leadershipId" value={leadershipID} />
      ) : null}
      <Field>
        <FieldLabel htmlFor={`declare-votes-${municipalityID}-${leadershipID ?? 'own'}`}>
          {leadershipID !== undefined
            ? 'Quantos votos a liderança traz neste município?'
            : 'Quantos votos você está trazendo neste município?'}
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`declare-votes-${municipalityID}-${leadershipID ?? 'own'}`}
            name="declaredVotes"
            type="number"
            min={0}
            max={1000000}
            required
            inputMode="numeric"
            defaultValue={currentDeclaredVotes ?? undefined}
            className="min-h-11 w-36"
          />
          <Button type="submit" disabled={isPending} className="min-h-11">
            {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {currentDeclaredVotes == null ? 'Declarar' : 'Atualizar'}
          </Button>
        </div>
        {fieldError(state.fieldErrors, 'declaredVotes') ? (
          <FieldError>{fieldError(state.fieldErrors, 'declaredVotes')}</FieldError>
        ) : null}
      </Field>
      <CampaignFormActionMessage state={state} successFallbackMessage="Declaração registrada." />
    </form>
  )
}

const HybridDeclareVotesForm = ({
  municipalityID,
  leadershipID,
  currentDeclaredVotes,
  currentUpdatedAt,
}: {
  municipalityID: number
  leadershipID: number
  currentDeclaredVotes: number | null
  currentUpdatedAt: string | null
}) => {
  const router = useRouter()
  const liveRegionId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const previousStatusRef = useRef<OpsMunicipalityWriteSyncStatus | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [baseOverride, setBaseOverride] = useState<string | null | undefined>(undefined)

  const mirrorPledge = useSyncExternalStore(
    (onStoreChange) => {
      const pledge = votePledgesCollection.toArray.find(
        (row) => row.leadership === leadershipID && row.municipality === municipalityID,
      )
      if (!pledge) return () => undefined
      return subscribeOpsVotePledge(pledge.id, onStoreChange)
    },
    () =>
      votePledgesCollection.toArray.find(
        (row) => row.leadership === leadershipID && row.municipality === municipalityID,
      ),
    () => undefined,
  )

  const displayVotes = mirrorPledge?.declaredVotes ?? currentDeclaredVotes
  const mirrorUpdatedAt = mirrorPledge?.updatedAt ?? currentUpdatedAt
  const baseUpdatedAt = baseOverride !== undefined ? baseOverride : mirrorUpdatedAt

  const outboxRow = useSyncExternalStore(
    (onStoreChange) =>
      subscribeOpsDeclareVotesOutboxRow(leadershipID, municipalityID, onStoreChange),
    () => readOpsDeclareVotesOutboxRow(leadershipID, municipalityID),
    () => undefined,
  )

  useEffect(() => {
    void getOpsMunicipalityOfflineExecutor()
  }, [])

  useEffect(() => {
    setBaseOverride(undefined)
  }, [mirrorUpdatedAt])

  useEffect(() => {
    const previous = previousStatusRef.current
    previousStatusRef.current = outboxRow?.status
    if (previous === 'pending' && outboxRow === undefined) {
      router.refresh()
    }
  }, [outboxRow, router])

  useEffect(() => {
    if (outboxRow?.status !== 'conflict') return
    const toastId = `${CONFLICT_TOAST_ID_PREFIX}${leadershipID}:${municipalityID}`
    toast.message(OPS_UPDATED_AT_CONFLICT_MESSAGE, {
      id: toastId,
      duration: Infinity,
      action: {
        label: 'Manter o meu',
        onClick: () => {
          const form = formRef.current
          if (!form) return
          const raw = new FormData(form).get('declaredVotes')
          const declaredVotes = typeof raw === 'string' ? Number(raw) : NaN
          if (!Number.isFinite(declaredVotes)) return
          void enqueueDeclareVotes({
            municipalityId: municipalityID,
            leadershipId: leadershipID,
            declaredVotes: Math.trunc(declaredVotes),
            baseUpdatedAt: outboxRow.serverUpdatedAt ?? null,
          }).then(
            () => {
              setBaseOverride(outboxRow.serverUpdatedAt ?? null)
              setFormError(null)
            },
            (error: unknown) => {
              setFormError(
                error instanceof Error ? error.message : 'Não foi possível reenviar a declaração.',
              )
            },
          )
        },
      },
      cancel: {
        label: 'Usar o novo',
        onClick: () => {
          discardOpsDeclareVotesOutboxRow(leadershipID, municipalityID)
          setFormError(null)
          router.refresh()
        },
      },
    })
    return () => {
      toast.dismiss(toastId)
    }
  }, [outboxRow, leadershipID, municipalityID, router])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const raw = new FormData(form).get('declaredVotes')
    const declaredVotes = typeof raw === 'string' ? Number(raw) : NaN
    if (!Number.isFinite(declaredVotes) || declaredVotes < 0) {
      setFormError('Informe um número válido de votos.')
      return
    }
    setIsSubmitting(true)
    setFormError(null)
    void enqueueDeclareVotes({
      municipalityId: municipalityID,
      leadershipId: leadershipID,
      declaredVotes: Math.trunc(declaredVotes),
      baseUpdatedAt,
    }).then(
      () => setIsSubmitting(false),
      (error: unknown) => {
        setIsSubmitting(false)
        setFormError(
          error instanceof Error ? error.message : 'Não foi possível enfileirar a declaração.',
        )
      },
    )
  }

  const status = outboxRow?.status
  const pending = isSubmitting || status === 'pending'

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={`declare-votes-${municipalityID}-${leadershipID}`}>
          Quantos votos a liderança traz neste município?
        </FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`declare-votes-${municipalityID}-${leadershipID}`}
            name="declaredVotes"
            type="number"
            min={0}
            max={1000000}
            required
            inputMode="numeric"
            defaultValue={displayVotes ?? undefined}
            className="min-h-11 w-36"
          />
          <Button type="submit" disabled={pending} className="min-h-11">
            {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {displayVotes == null ? 'Declarar' : 'Atualizar'}
          </Button>
          {status && status !== 'synced' ? (
            <Badge variant={status === 'pending' ? 'estimate-pending' : 'destructive'}>
              {syncStatusLabel[status]}
            </Badge>
          ) : null}
        </div>
        {formError || outboxRow?.errorMessage ? (
          <FieldError>{formError ?? outboxRow?.errorMessage}</FieldError>
        ) : null}
      </Field>
      <p id={liveRegionId} className="sr-only" aria-live="polite">
        {pending ? 'Salvando declaração…' : null}
      </p>
    </form>
  )
}