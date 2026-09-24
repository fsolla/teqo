'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'

/**
 * C192/C219 — re-runs the same `mode=tema` request after a degraded fallback.
 * Shared by both acervo sources; the notice copy stays per domain.
 */
export const CampaignThemeRetryButton = () => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-10"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      Tentar por tema novamente
    </Button>
  )
}
