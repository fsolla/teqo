'use client'

import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { RecordingRetryResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { campaignRecordingRetryHref } from '@/lib/campaignPaths'

const RETRY_ERROR_MESSAGE = 'Não foi possível iniciar o reprocessamento. Tente novamente.'

/**
 * C199 — reprocesses a failed transcription in place. The failure panel of the
 * detail swaps to "Reprocessando" while the request is in flight (through
 * `onSubmittingChange`) and the error of the click stays as a bordered alert
 * right under the action, never a toast (approved scene 9).
 */
export const RecordingRetryButton = ({
  recordingId,
  className,
  onSubmittingChange,
}: {
  recordingId: number
  className?: string
  onSubmittingChange?: (submitting: boolean) => void
}) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateSubmitting = (value: boolean) => {
    setSubmitting(value)
    onSubmittingChange?.(value)
  }

  const retry = async () => {
    updateSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await postCampaignJson<RecordingRetryResponse>(
        campaignRecordingRetryHref(recordingId),
        { recordingId },
      )
      if (!ok || payload.status !== 'success') {
        // The action-level error keeps the approved copy (the failure panel
        // above already carries the transcript's own reason).
        setError(RETRY_ERROR_MESSAGE)
        return
      }
      router.refresh()
    } catch {
      setError(RETRY_ERROR_MESSAGE)
    } finally {
      updateSubmitting(false)
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        className="min-h-11 max-md:w-full"
        disabled={submitting}
        onClick={() => void retry()}
      >
        {submitting ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {submitting ? 'Reprocessando…' : 'Reprocessar transcrição'}
      </Button>
      {error ? (
        <Alert variant="destructive" className="mt-2 py-2">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
