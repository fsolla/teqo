'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { postCampaignJson } from '@/lib/campaignJsonRequest'

const PUBLICATION_ERROR_MESSAGE = 'Não foi possível atualizar a publicação.'

type PublicationToggleResponse = { status: 'success' } | { status: 'error'; message: string }

/**
 * C194 — the one submit/error/refresh contract of a library publish toggle
 * (cut library, reel library): POST the domain body to the mutation route,
 * surface the safe domain message or the shared fallback, and refresh the RSC
 * page on success so the new status renders. The panels keep their own copy,
 * confirmation dialog and status branches.
 */
export const usePublicationToggle = ({
  href,
  buildBody,
}: {
  href: string
  buildBody: (published: boolean) => Record<string, unknown>
}) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setPublished = async (published: boolean): Promise<void> => {
    setSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await postCampaignJson<PublicationToggleResponse>(
        href,
        buildBody(published),
      )

      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : PUBLICATION_ERROR_MESSAGE)
        return
      }

      router.refresh()
    } catch {
      setError(PUBLICATION_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, error, setPublished }
}
