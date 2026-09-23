'use client'

import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { ContentPieceRetryResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { campaignContentPieceRetryHref } from '@/lib/campaignPaths'

const RETRY_ERROR_MESSAGE = 'Não foi possível iniciar o reprocessamento. Tente novamente.'

/**
 * C211 — reprocesses a failed piece in place: the list action and the ficha's
 * failure panel share this one control (approved design scenes 1 and 4). The
 * error of the click stays as a bordered alert under the action, never a toast.
 */
export const ContentPieceRetryButton = ({
  contentPieceId,
  className,
  label = 'Reprocessar',
  variant = 'outline',
  onSubmittingChange,
}: {
  contentPieceId: number
  className?: string
  label?: string
  variant?: 'default' | 'outline'
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
      const { ok, payload } = await postCampaignJson<ContentPieceRetryResponse>(
        campaignContentPieceRetryHref(contentPieceId),
        { contentPieceId },
      )
      if (!ok || payload.status !== 'success') {
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
        variant={variant}
        className="min-h-11 max-md:w-full"
        disabled={submitting}
        onClick={() => void retry()}
      >
        {submitting ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {submitting ? 'Reprocessando…' : label}
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
