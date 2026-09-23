'use client'

import { CircleAlertIcon, EyeOffIcon, SendIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { ContentPiecePublicationResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { campaignContentPiecePublicationHref } from '@/lib/campaignPaths'
import type { ContentPieceStatus } from '@/lib/contentPiece'

const PUBLICATION_ERROR_MESSAGE = 'Não foi possível mudar a publicação. Tente novamente.'

/**
 * C211 — the kill switch of one piece: "Publicar" (the first publication also
 * generates the canonical slug) and "Despublicar" (takes it off the public
 * Central at once, preserving the file and the link). Never a confirm dialog:
 * the gesture is reversible and the badge on the screen is the receipt.
 */
export const ContentPiecePublicationButton = ({
  contentPieceId,
  status,
  className,
}: {
  contentPieceId: number
  status: ContentPieceStatus
  className?: string
}) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const published = status === 'publicado'

  const toggle = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await postCampaignJson<ContentPiecePublicationResponse>(
        campaignContentPiecePublicationHref(contentPieceId),
        { contentPieceId, published: !published },
      )
      if (!ok || payload.status !== 'success') {
        setError(PUBLICATION_ERROR_MESSAGE)
        return
      }
      router.refresh()
    } catch {
      setError(PUBLICATION_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={published ? 'outline' : 'default'}
        className="min-h-11 max-md:w-full"
        disabled={submitting}
        onClick={() => void toggle()}
      >
        {submitting ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : published ? (
          <EyeOffIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <SendIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {submitting ? 'Salvando…' : published ? 'Despublicar' : 'Publicar'}
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
