'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'

/** C192 — re-runs the same `mode=tema` request after a degraded fallback. */
export const SpeechThemeRetryButton = () => {
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
