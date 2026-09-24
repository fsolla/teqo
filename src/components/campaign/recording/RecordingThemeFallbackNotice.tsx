import { TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'

/**
 * C219 — the discreet fallback notice when `mode=tema` was asked on the
 * recordings source but the theme expansion was unavailable. The list below
 * shows the literal results; the notice keeps the user's request honest
 * instead of hiding the downgrade (same contract as the Câmara acervo, C192).
 */
export const RecordingThemeFallbackNotice = () => (
  <Alert
    variant="pending"
    data-testid="recording-theme-fallback"
    className="gap-3 border-estimate-pending/80 bg-estimate-pending/55 px-4 py-3"
  >
    <TriangleAlertIcon aria-hidden="true" />
    <AlertTitle className="text-sm font-medium">
      A busca por tema está indisponível agora.
    </AlertTitle>
    <AlertDescription className="text-xs leading-5">
      Você pediu “Por tema”. Para não interromper o trabalho, mostramos abaixo os resultados por
      termo exato.
    </AlertDescription>
  </Alert>
)
