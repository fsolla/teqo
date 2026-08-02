'use client'

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  discardOpsLeadershipUpdateOutboxRow,
  enqueueLeadershipUpdate,
  readOpsLeadershipUpdateOutboxRow,
  subscribeOpsLeadershipUpdateOutboxRow,
} from '@/components/campaign/opsSync/opsDomainOutbox'
import { leadershipsCollection } from '@/components/campaign/opsSync/opsMirrorClient'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import {
  RelationMultiSelect,
  type RelationOption,
} from '@/components/campaign/shared/RelationMultiSelect'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { resolveOpsHybridEnabled } from '@/lib/campaignOps/opsHybridFlag'
import {
  isSupportStatus,
  leadershipSupportStatuses,
  type SupportStatus,
} from '@/lib/schemas/leadership'
import { OPS_UPDATED_AT_CONFLICT_MESSAGE } from '@/lib/schemas/opsCas'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import type { LeadershipDetailViewModel } from '@/utilities/leadership/leadershipData'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

const CONFLICT_TOAST_ID_PREFIX = 'ops-leadership-update-conflict:'

const readRelationshipIds = (data: FormData, name: string): number[] => {
  const ids: number[] = []
  for (const raw of data.getAll(name)) {
    if (typeof raw !== 'string' || raw.trim() === '') continue
    const value = Number(raw)
    if (Number.isInteger(value) && value > 0) ids.push(value)
  }
  return [...new Set(ids)]
}

type LeadershipInternalFormProps = {
  leadership: LeadershipDetailViewModel
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  stateDeputyOptions: RelationOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  opsHybridEnabled?: boolean
}

/** Staff-only internal evaluation + links (municipalities, organizations). */
export const LeadershipInternalForm = ({
  leadership,
  municipalityOptions,
  organizationOptions,
  stateDeputyOptions,
  formAction,
  opsHybridEnabled = resolveOpsHybridEnabled(),
}: LeadershipInternalFormProps) => {
  const router = useRouter()
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [hybridPending, setHybridPending] = useState(false)
  const [hybridMessage, setHybridMessage] = useState<string | null>(null)
  const previousOutboxStatusRef = useRef<string | undefined>(undefined)

  const outboxRow = useSyncExternalStore(
    (onStoreChange) =>
      opsHybridEnabled
        ? subscribeOpsLeadershipUpdateOutboxRow(leadership.id, onStoreChange)
        : () => undefined,
    () => (opsHybridEnabled ? readOpsLeadershipUpdateOutboxRow(leadership.id) : undefined),
    () => undefined,
  )

  useEffect(() => {
    const previous = previousOutboxStatusRef.current
    previousOutboxStatusRef.current = outboxRow?.status
    if (previous === 'pending' && outboxRow === undefined) {
      router.refresh()
    }
  }, [outboxRow, router])

  useEffect(() => {
    if (!opsHybridEnabled || outboxRow?.status !== 'conflict') return
    const toastId = `${CONFLICT_TOAST_ID_PREFIX}${leadership.id}`
    toast.message(OPS_UPDATED_AT_CONFLICT_MESSAGE, {
      id: toastId,
      duration: Infinity,
      action: {
        label: 'Manter o meu',
        onClick: () => {
          void enqueueLeadershipUpdate({
            leadershipId: leadership.id,
            municipalities: outboxRow.municipalities,
            organizations: outboxRow.organizations,
            stateDeputies: outboxRow.stateDeputies,
            exclusive: outboxRow.exclusive,
            supportStatus: outboxRow.supportStatus,
            notes: outboxRow.notes,
            baseUpdatedAt: outboxRow.serverUpdatedAt ?? null,
          })
        },
      },
      cancel: {
        label: 'Usar o novo',
        onClick: () => {
          discardOpsLeadershipUpdateOutboxRow(leadership.id)
          router.refresh()
        },
      },
    })
    return () => {
      toast.dismiss(toastId)
    }
  }, [opsHybridEnabled, outboxRow, leadership.id, router])

  const onHybridSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const supportStatusRaw = data.get('supportStatus')
    const supportStatus =
      typeof supportStatusRaw === 'string' && isSupportStatus(supportStatusRaw)
        ? (supportStatusRaw as SupportStatus)
        : undefined
    const mirrorUpdatedAt = leadershipsCollection.get(leadership.id)?.updatedAt

    setHybridPending(true)
    setHybridMessage(null)
    void enqueueLeadershipUpdate({
      leadershipId: leadership.id,
      municipalities: readRelationshipIds(data, 'municipalities'),
      organizations: readRelationshipIds(data, 'organizations'),
      stateDeputies: readRelationshipIds(data, 'stateDeputies'),
      exclusive: data.get('exclusive') === 'true',
      supportStatus,
      notes: (() => {
        const raw = data.get('notes')
        return typeof raw === 'string' ? raw : null
      })(),
      baseUpdatedAt: mirrorUpdatedAt ?? leadership.updatedAt,
    }).then(
      () => {
        setHybridPending(false)
        setHybridMessage('Alterações enfileiradas. Serão enviadas ao reconectar.')
      },
      (error: unknown) => {
        setHybridPending(false)
        setHybridMessage(
          error instanceof Error ? error.message : 'Não foi possível enfileirar as alterações.',
        )
      },
    )
  }

  const pending = opsHybridEnabled ? hybridPending || outboxRow?.status === 'pending' : isPending

  return (
    <form
      action={opsHybridEnabled ? undefined : submitAction}
      onSubmit={opsHybridEnabled ? onHybridSubmit : undefined}
      className="flex max-w-2xl flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="leadershipId" value={leadership.id} />
        {outboxRow?.status === 'pending' ? <Badge variant="estimate-pending">Pendente</Badge> : null}
        {outboxRow?.status === 'conflict' ? (
          <Badge variant="destructive">Conflito</Badge>
        ) : null}
      </div>

      <RelationMultiSelect
        name="municipalities"
        label="Municípios em que atua"
        options={municipalityOptions}
        initialSelectedIDs={leadership.municipalityIDs}
        error={fieldError(state.fieldErrors, 'municipalities')}
        placeholder="Adicionar município…"
      />

      <RelationMultiSelect
        name="organizations"
        label="Organizações"
        options={organizationOptions}
        initialSelectedIDs={leadership.organizationIDs}
        error={fieldError(state.fieldErrors, 'organizations')}
        placeholder="Adicionar organização…"
      />

      <RelationMultiSelect
        name="stateDeputies"
        label="Dobradinhas"
        options={stateDeputyOptions}
        initialSelectedIDs={leadership.stateDeputyIDs}
        error={fieldError(state.fieldErrors, 'stateDeputies')}
        placeholder="Adicionar dobradinha…"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="leadership-internal-status">Status de apoio</FieldLabel>
          <NativeSelect
            id="leadership-internal-status"
            name="supportStatus"
            defaultValue={leadership.supportStatus ?? 'a_abordar'}
            className="min-h-11 w-full"
          >
            {leadershipSupportStatuses.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {supportStatusLabels[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field orientation="horizontal" className="items-center gap-2 self-end pb-2">
          <Checkbox
            id="leadership-internal-exclusive"
            name="exclusive"
            value="true"
            defaultChecked={leadership.exclusive}
          />
          <FieldLabel htmlFor="leadership-internal-exclusive" className="font-normal">
            Apoio exclusivo
          </FieldLabel>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="leadership-internal-notes">Observações internas</FieldLabel>
        <Textarea
          id="leadership-internal-notes"
          name="notes"
          rows={3}
          maxLength={3000}
          defaultValue={leadership.notes ?? undefined}
        />
      </Field>

      {!opsHybridEnabled ? <CampaignFormActionMessage state={state} /> : null}
      {hybridMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {hybridMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11 self-start">
        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar
      </Button>
    </form>
  )
}
