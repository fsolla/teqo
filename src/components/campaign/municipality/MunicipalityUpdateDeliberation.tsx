'use client'

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { MUNICIPALITY_UPDATE_COMMENT_MAX_LENGTH } from '@/lib/schemas/municipalityUpdate'
import type { MunicipalityUpdateDeliberationCapabilities } from '@/utilities/campaignAccess'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type {
  EligibleUpdateStaffMember,
  MunicipalityUpdateCommentViewModel,
} from '@/utilities/municipality/municipalityUpdatePageData'

/** C88 — the four deliberation server actions, injected by the server feeds. */
export type MunicipalityUpdateDeliberationFormActions = {
  assign: (state: CampaignFormActionState, formData: FormData) => Promise<CampaignFormActionState>
  comment: (state: CampaignFormActionState, formData: FormData) => Promise<CampaignFormActionState>
  resolve: (state: CampaignFormActionState, formData: FormData) => Promise<CampaignFormActionState>
  reopen: (state: CampaignFormActionState, formData: FormData) => Promise<CampaignFormActionState>
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const staffRoleLabels: Record<'coordinator' | 'advisor' | 'candidate', string> = {
  coordinator: 'Coordenador Geral',
  advisor: 'Assessor',
  candidate: 'Candidato',
}

type MunicipalityUpdateDeliberationProps = {
  updateId: number
  responsibleId: number | null
  responsibleName: string | null
  resolvedAt: string | null
  resolvedByName: string | null
  comments: MunicipalityUpdateCommentViewModel[]
  eligibleStaff: EligibleUpdateStaffMember[]
  capabilities: MunicipalityUpdateDeliberationCapabilities
  formActions: MunicipalityUpdateDeliberationFormActions
}

/**
 * C88 — the deliberation island on an update card: assignee select, comment
 * thread and the Resolvido/Reabrir transition. The server passes the actor's
 * capabilities; the client only renders what the actor may do. Leader lockdown
 * is upstream — this card never renders for a leader.
 */
export const MunicipalityUpdateDeliberation = ({
  updateId,
  responsibleId,
  responsibleName,
  resolvedAt,
  resolvedByName,
  comments,
  eligibleStaff,
  capabilities,
  formActions,
}: MunicipalityUpdateDeliberationProps) => {
  const isResolved = resolvedAt !== null
  const inDeliberation = !isResolved && (responsibleId !== null || comments.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {isResolved || inDeliberation ? (
        <div className="flex flex-wrap items-center gap-2">
          {isResolved ? (
            <Badge variant="secondary">Resolvido</Badge>
          ) : (
            <Badge variant="outline">Em deliberação</Badge>
          )}
        </div>
      ) : null}

      {isResolved ? (
        <p className="text-xs text-muted-foreground">
          Resolvido por <span className="font-medium text-foreground">{resolvedByName}</span>
          {resolvedAt ? ` em ${dateTimeFormatter.format(new Date(resolvedAt))}` : ''}
        </p>
      ) : null}

      {capabilities.canAssign || responsibleId !== null ? (
        <ResponsibleBlock
          updateId={updateId}
          responsibleId={responsibleId}
          responsibleName={responsibleName}
          eligibleStaff={eligibleStaff}
          canAssign={capabilities.canAssign}
          formAction={formActions.assign}
        />
      ) : null}

      {comments.length > 0 || capabilities.canComment ? (
        <CommentThread
          updateId={updateId}
          comments={comments}
          canComment={capabilities.canComment && !isResolved}
          formAction={formActions.comment}
        />
      ) : null}

      {capabilities.canResolve ? (
        <div className="flex justify-end">
          <ResolveAction
            updateId={updateId}
            isResolved={isResolved}
            formAction={isResolved ? formActions.reopen : formActions.resolve}
          />
        </div>
      ) : null}
    </div>
  )
}

const ResponsibleBlock = ({
  updateId,
  responsibleId,
  responsibleName,
  eligibleStaff,
  canAssign,
  formAction,
}: {
  updateId: number
  responsibleId: number | null
  responsibleName: string | null
  eligibleStaff: EligibleUpdateStaffMember[]
  canAssign: boolean
  formAction: MunicipalityUpdateDeliberationFormActions['assign']
}) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  if (!canAssign) {
    return (
      <p className="text-sm">
        <span className="font-medium">Responsável:</span>{' '}
        <span className="text-muted-foreground">{responsibleName}</span>
      </p>
    )
  }

  return (
    <form action={submitAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="updateId" value={updateId} />
      <label htmlFor={`update-responsible-${updateId}`} className="text-sm font-medium">
        Responsável
      </label>
      <NativeSelect
        id={`update-responsible-${updateId}`}
        name="responsibleId"
        size="sm"
        defaultValue={responsibleId === null ? 'none' : String(responsibleId)}
        disabled={isPending}
      >
        <NativeSelectOption value="none">Sem responsável</NativeSelectOption>
        {eligibleStaff.map((staff) => (
          <NativeSelectOption key={staff.id} value={String(staff.id)}>
            {staff.name} ({staffRoleLabels[staff.role]})
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Definir
      </Button>
      {state.message ? (
        <CampaignFormActionMessage
          state={state}
          errorTitle="Não foi possível definir o responsável"
        />
      ) : null}
    </form>
  )
}

const CommentThread = ({
  updateId,
  comments,
  canComment,
  formAction,
}: {
  updateId: number
  comments: MunicipalityUpdateCommentViewModel[]
  canComment: boolean
  formAction: MunicipalityUpdateDeliberationFormActions['comment']
}) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === 'success' && formRef.current) formRef.current.reset()
  }, [state])

  // C139 — manual dispatch: React 19 resets uncontrolled fields after any
  // settled form action, wiping the typed comment on a validation error.
  // The success reset above stays explicit; `startTransition` keeps `pending`.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Discussão</p>
      {comments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li
              key={comment.id ?? `${comment.authorName}-${comment.createdAt}-${comment.body}`}
              className="flex flex-col gap-0.5 rounded-lg border px-3 py-2"
            >
              <p className="text-xs">
                <span className="font-medium text-foreground">{comment.authorName}</span>
                {comment.createdAt ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="text-muted-foreground">
                      {dateTimeFormatter.format(new Date(comment.createdAt))}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {canComment ? (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input type="hidden" name="updateId" value={updateId} />
          <Textarea
            name="body"
            rows={2}
            maxLength={MUNICIPALITY_UPDATE_COMMENT_MAX_LENGTH}
            placeholder="Escrever comentário…"
            disabled={isPending}
          />
          {state.message ? (
            <CampaignFormActionMessage state={state} errorTitle="Não foi possível comentar" />
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="outline" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
              Comentar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

const ResolveAction = ({
  updateId,
  isResolved,
  formAction,
}: {
  updateId: number
  isResolved: boolean
  formAction: MunicipalityUpdateDeliberationFormActions['resolve']
}) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  return (
    <form action={submitAction}>
      <input type="hidden" name="updateId" value={updateId} />
      {state.message ? (
        <CampaignFormActionMessage
          state={state}
          errorTitle={isResolved ? 'Não foi possível reabrir' : 'Não foi possível marcar'}
        />
      ) : null}
      <Button type="submit" variant={isResolved ? 'outline' : 'default'} disabled={isPending}>
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        {isResolved ? 'Reabrir' : 'Marcar como resolvido'}
      </Button>
    </form>
  )
}
