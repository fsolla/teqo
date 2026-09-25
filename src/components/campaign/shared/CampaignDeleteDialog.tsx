'use client'

import { CircleAlertIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type ReactElement, type ReactNode } from 'react'

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

/**
 * The `{ status }` envelope every `/campanha` delete route answers: the shared
 * machine only needs the discriminator and the domain message.
 */
type CampaignDeleteDialogResponse = { status: 'success' } | { status: 'error'; message: string }

type CampaignDeleteDialogProps = {
  /** The DELETE endpoint of the row (the id lives in the path). */
  endpoint: string
  /** Fallback copy for a transport/unknown failure; domain errors travel from the route. */
  errorMessage: string
  /** The styled trigger button of the caller (the machine owns the confirm flow). */
  trigger: ReactElement
  title: string
  description: ReactNode
  confirmLabel: string
  /** Detail page: the row is gone after the delete, so leave the page. */
  redirectTo?: string
  /** Callers riding the frontend prose base reset the title's border. */
  titleClassName?: string
  /** Callers whose footer chrome differs from the default pass their own. */
  footerClassName?: string
}

/**
 * The one delete-confirmation machine of the campaign vertical (C183 built it
 * for the cut, C199 reused it for the recording, C222 is the third call site —
 * extracted here instead of copied again). Owns the submitting/error state, the
 * DELETE call, the redirect/refresh decision and the dialog chrome; each caller
 * passes policy only (endpoint, copy, trigger, classes). The error always stays
 * in the dialog context, never a toast.
 */
export const CampaignDeleteDialog = ({
  endpoint,
  errorMessage,
  trigger,
  title,
  description,
  confirmLabel,
  redirectTo,
  titleClassName,
  footerClassName,
}: CampaignDeleteDialogProps) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await deleteCampaignJson<CampaignDeleteDialogResponse>(endpoint)
      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : errorMessage)
        return
      }
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } catch {
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-destructive">
              <CircleAlertIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <AlertDialogTitle className={titleClassName}>{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive" className="py-2">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter className={footerClassName}>
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
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
