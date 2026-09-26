import { TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'

/**
 * C229 — the discreet fallback notice when `mode=tema` was asked but the sense
 * engine was unavailable (no provider or an empty index). The list below shows
 * the literal results; the notice keeps the user's request honest instead of
 * hiding the downgrade.
 */
export const SpeechThemeFallbackNotice = () => (
  <Alert
    variant="pending"
    data-testid="speech-theme-fallback"
    className="gap-3 border-estimate-pending/80 bg-estimate-pending/55 px-4 py-3"
  >
    <TriangleAlertIcon aria-hidden="true" />
    <AlertTitle className="text-sm font-medium">
      A busca por sentido está indisponível agora.
    </AlertTitle>
    <AlertDescription className="text-xs leading-5">
      Para não interromper o trabalho, mostramos resultados por correspondência de termos.
    </AlertDescription>
  </Alert>
)
