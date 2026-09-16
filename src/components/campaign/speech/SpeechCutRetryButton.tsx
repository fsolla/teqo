'use client'

import { RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { SpeechCutRetryResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/[id]/types'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { campaignSpeechCutRetryHref } from '@/lib/campaignPaths'
import { cn } from '@/lib/utils'

type SpeechCutRetryButtonProps = {
  cutId: number
  className?: string
}

const RETRY_ERROR_MESSAGE = 'Não foi possível tentar novamente.'

/**
 * C183 — retries a failed cut in place (the library card and the detail header),
 * so the recovery lives where the person sees the failure. Reuses the C167
 * request (`retryOf` → same row), never reshapes the cut.
 */
export const SpeechCutRetryButton = ({ cutId, className }: SpeechCutRetryButtonProps) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const retry = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await postCampaignJson<SpeechCutRetryResponse>(
        campaignSpeechCutRetryHref(cutId),
        { cutId },
      )

      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : RETRY_ERROR_MESSAGE)
        return
      }

      router.refresh()
    } catch {
      setError(RETRY_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        className={cn('min-h-10', className)}
        disabled={submitting}
        onClick={() => void retry()}
      >
        {submitting ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {submitting ? 'Tentando novamente…' : 'Tentar novamente'}
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </>
  )
}
