'use client'

import { Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  deletePersonAction,
  getPersonDeleteManifestAction,
} from '@/app/(campaign)/campanha/actions/person'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/AlertDialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import {
  PERSON_DELETE_NOT_FOUND_MESSAGE,
  PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE,
} from '@/lib/schemas/personDelete'
import type { PersonDeleteManifest } from '@/utilities/people/personDelete'

type DeletePersonButtonProps = {
  personName: string
  contactId: number
  /**
   * Where to go after the destructive cascade succeeds. The people list keeps
   * the default (`router.refresh()`); detail pages that show the person
   * navigate away — the ficha no longer exists.
   */
  deletedHref?: string
}

type ManifestState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; manifest: PersonDeleteManifest }
  | { kind: 'error'; message: string }

const mapManifestError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : ''
  if (message === PERSON_DELETE_NOT_FOUND_MESSAGE) return 'Pessoa não encontrada.'
  return 'Não foi possível carregar o que será apagado. Tente de novo.'
}

const mapDeleteError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : ''
  if (message === PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE) return message
  if (message === PERSON_DELETE_NOT_FOUND_MESSAGE) return 'Pessoa não encontrada.'
  return 'Não foi possível apagar a pessoa. Tente de novo.'
}

/**
 * The C100 destructive action: opens a confirmation that lists — from the
 * read-only manifest — everything the transactional cascade will remove, and
 * only then offers the destroy. Coordinator/candidate accounts make the whole
 * person protected; the ficha is deleted or anonymized (LGPD tombstone)
 * depending on public joins.
 */
export const DeletePersonButton = ({
  personName,
  contactId,
  deletedHref,
}: DeletePersonButtonProps) => {
  const router = useRouter()
  const [manifest, setManifest] = useState<ManifestState>({ kind: 'idle' })
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleOpenChange = async (open: boolean) => {
    if (!open) return
    setDeleteError('')
    setManifest({ kind: 'loading' })
    try {
      const next = await getPersonDeleteManifestAction({ contactId })
      setManifest(
        next
          ? { kind: 'ready', manifest: next }
          : {
              kind: 'error',
              message: mapManifestError(new Error(PERSON_DELETE_NOT_FOUND_MESSAGE)),
            },
      )
    } catch (error) {
      setManifest({ kind: 'error', message: mapManifestError(error) })
    }
  }

  const handleDelete = async () => {
    if (manifest.kind !== 'ready' || manifest.manifest.hasProtectedAccount) return
    setDeleting(true)
    setDeleteError('')
    try {
      const result = await deletePersonAction({ contactId })
      toast.success(
        result.contactDeleted
          ? 'Pessoa apagada.'
          : result.contactAnonymized
            ? 'Pessoa apagada. A ficha foi anonimizada porque ainda é referenciada por participações públicas.'
            : 'Pessoa apagada.',
      )
      if (deletedHref) {
        router.push(deletedHref)
      } else {
        router.refresh()
      }
    } catch (error) {
      setDeleteError(mapDeleteError(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 text-destructive hover:text-destructive"
          aria-label={`Apagar pessoa ${personName}`}
        >
          <Trash2Icon className="size-4" aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar pessoa</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Serão removidos todos os vínculos de{' '}
            <span className="font-medium text-foreground">{personName}</span> com a campanha.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {manifest.kind === 'loading' ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner aria-label="Carregando o que será apagado" />
          </div>
        ) : null}

        {manifest.kind === 'error' ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{manifest.message}</AlertDescription>
          </Alert>
        ) : null}

        {manifest.kind === 'ready' ? (
          <>
            {manifest.manifest.hasProtectedAccount ? (
              <Alert variant="destructive" aria-live="polite">
                <AlertDescription>
                  {PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE} A ação está bloqueada.
                </AlertDescription>
              </Alert>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                {manifest.manifest.leaderships.length > 0 ? (
                  <li>
                    Liderança
                    {manifest.manifest.leaderships.length > 1 ? 's' : ''} (
                    {manifest.manifest.leaderships
                      .map((leadership) =>
                        leadership.municipalityNames.length
                          ? `${leadership.name} · ${leadership.municipalityNames.join(' · ')}`
                          : leadership.name,
                      )
                      .join('; ')}
                    )
                  </li>
                ) : null}
                {manifest.manifest.stateDeputies.length > 0 ? (
                  <li>
                    Dobradinha{manifest.manifest.stateDeputies.length > 1 ? 's' : ''} (
                    {manifest.manifest.stateDeputies
                      .map((deputy) =>
                        deputy.party ? `${deputy.name} (${deputy.party})` : deputy.name,
                      )
                      .join('; ')}
                    )
                  </li>
                ) : null}
                {manifest.manifest.pledgeCount > 0 ? (
                  <li>
                    {manifest.manifest.pledgeCount}{' '}
                    {manifest.manifest.pledgeCount === 1 ? 'voto declarado' : 'votos declarados'}
                  </li>
                ) : null}
                {manifest.manifest.inviteCount > 0 ? (
                  <li>
                    {manifest.manifest.inviteCount}{' '}
                    {manifest.manifest.inviteCount === 1
                      ? 'convite pendente'
                      : 'convites pendentes'}
                  </li>
                ) : null}
                {manifest.manifest.supporterCount > 0 ? (
                  <li>
                    {manifest.manifest.supporterCount}{' '}
                    {manifest.manifest.supporterCount === 1
                      ? 'cadastro de apoiador'
                      : 'cadastros de apoiador'}
                  </li>
                ) : null}
                {manifest.manifest.municipalityUpdateCount > 0 ? (
                  <li>
                    {manifest.manifest.municipalityUpdateCount}{' '}
                    {manifest.manifest.municipalityUpdateCount === 1
                      ? 'atualização de município'
                      : 'atualizações de município'}
                  </li>
                ) : null}
                {manifest.manifest.calendarFeedCount > 0 ? (
                  <li>
                    {manifest.manifest.calendarFeedCount}{' '}
                    {manifest.manifest.calendarFeedCount === 1
                      ? 'link de agenda'
                      : 'links de agenda'}
                  </li>
                ) : null}
                {manifest.manifest.accounts.length > 0 ? (
                  <li>
                    {manifest.manifest.accounts.length}{' '}
                    {manifest.manifest.accounts.length === 1
                      ? 'conta de acesso'
                      : 'contas de acesso'}{' '}
                    ({manifest.manifest.accounts.map((account) => account.name).join('; ')})
                  </li>
                ) : null}
                <li>
                  {manifest.manifest.fichaWillBeAnonymized
                    ? 'A ficha de contato será anonimizada (ainda é referenciada por participações públicas).'
                    : 'Ficha de contato'}
                </li>
              </ul>
            )}
            {deleteError ? (
              <Alert variant="destructive" aria-live="polite">
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            ) : null}
          </>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel type="button" className="min-h-11" disabled={deleting}>
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={
              manifest.kind !== 'ready' || manifest.manifest.hasProtectedAccount || deleting
            }
            onClick={handleDelete}
          >
            {deleting ? <Spinner data-icon="inline-start" /> : null}
            Apagar definitivamente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
