'use client'

import { CircleAlertIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { RecordingDeleteResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/types'
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
import { deleteCampaignJson } from '@/lib/campaignJsonRequest'
import { campaignRecordingDeleteHref } from '@/lib/campaignPaths'
import { cn } from '@/lib/utils'

const DELETE_ERROR_MESSAGE = 'Não foi possível apagar a gravação.'

/**
 * C199 — the delete confirmation of the recording detail. The trigger lives
 * only here (never on the list cards): an irreversible action stays out of the
 * scan path, per the approved design.
 */
export const RecordingDeleteDialog = ({
  recordingId,
  redirectTo,
  triggerClassName,
}: {
  recordingId: number
  /** Detail page: the row is gone after the delete, so leave the page. */
  redirectTo?: string
  triggerClassName?: string
}) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await deleteCampaignJson<RecordingDeleteResponse>(
        campaignRecordingDeleteHref(recordingId),
      )
      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : DELETE_ERROR_MESSAGE)
        return
      }
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } catch {
      setError(DELETE_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn('min-h-11 text-destructive hover:bg-red-50', triggerClassName)}
        >
          <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
          Apagar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-destructive">
              <CircleAlertIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              {/* The frontend prose base styles every `h2` with a bottom border. */}
              <AlertDialogTitle className="border-b-0 pb-0">Apagar esta gravação?</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                O arquivo e toda a transcrição serão removidos. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t-0 bg-transparent">
          <AlertDialogCancel type="button" className="min-h-11" disabled={submitting}>
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
            disabled={submitting}
            onClick={() => void confirmDelete()}
          >
            {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Apagar gravação
          </Button>
        </AlertDialogFooter>
        {error ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}
