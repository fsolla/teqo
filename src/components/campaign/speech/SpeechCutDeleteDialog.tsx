'use client'

import { CircleAlertIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { SpeechCutDeleteResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/[id]/types'
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
import { campaignSpeechCutDeleteHref } from '@/lib/campaignPaths'
import type { SpeechCutStatus } from '@/lib/speechCut'
import { cn } from '@/lib/utils'

type SpeechCutDeleteDialogProps = {
  cutId: number
  status: SpeechCutStatus
  publicPath: string
  /** Layout of the trigger (list card right-aligns; detail/mobile goes full width). */
  triggerClassName?: string
  /** Detail page: the row is gone after the delete, so leave the page. */
  redirectTo?: string
}

const DELETE_ERROR_MESSAGE = 'Não foi possível apagar o corte.'

/**
 * C183 — the one delete confirmation of the cut surfaces. The warning grows only
 * when there is a public link: a `published` cut names the `/corte/<id>` that
 * stops working for whoever already received it.
 */
export const SpeechCutDeleteDialog = ({
  cutId,
  status,
  publicPath,
  triggerClassName,
  redirectTo,
}: SpeechCutDeleteDialogProps) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await deleteCampaignJson<SpeechCutDeleteResponse>(
        campaignSpeechCutDeleteHref(cutId),
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
          className={cn('text-destructive hover:bg-red-50', triggerClassName)}
        >
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
              <AlertDialogTitle>Apagar este corte?</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                {status === 'published' ? (
                  <>
                    O link público <span className="font-medium text-foreground">{publicPath}</span>{' '}
                    deixa de funcionar para quem já recebeu. Esta ação não pode ser desfeita.
                  </>
                ) : (
                  'Esta ação não pode ser desfeita.'
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
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
            Apagar
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
