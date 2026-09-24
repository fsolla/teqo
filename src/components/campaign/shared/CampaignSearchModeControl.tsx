'use client'

import { SparklesIcon, TriangleAlertIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SpeechSearchMode } from '@/utilities/speech/speechListUrl'

/** C192/C219 — segmented search-mode button (mobile full width, desktop inline). */
const modeButtonClass = (active: boolean, tone: 'termo' | 'tema'): string =>
  cn(
    'min-h-11 rounded-md px-3 text-sm md:min-h-9',
    active
      ? cn(
          'bg-white font-semibold shadow-sm ring-1 ring-border',
          tone === 'tema' ? 'text-primary' : 'text-foreground',
        )
      : 'font-medium text-muted-foreground',
  )

/**
 * C219 — the "Termo exato | Por tema" selector shared by the two acervo
 * sources. The mechanics (mode semantics, degradation) belong to the URL
 * contract and the loader; this component only renders the choice and the
 * honest state of the theme bridge.
 */
export const CampaignSearchModeControl = ({
  activeMode,
  themeUnavailable = false,
  onSelect,
  relatedHint,
}: {
  activeMode: SpeechSearchMode
  /** The theme expansion is down; the selector reflects the fallback. */
  themeUnavailable?: boolean
  onSelect: (mode: SpeechSearchMode) => void
  /** Desktop hint of the corpus ("Encontra falas relacionadas pelo sentido."). */
  relatedHint: string
}) => (
  <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
    <div className="flex w-full items-center gap-2 md:w-auto">
      <span className="hidden text-xs font-medium text-muted-foreground md:inline">Buscar por</span>
      <div
        role="group"
        aria-label="Modo de busca"
        className="grid w-full grid-cols-2 rounded-lg bg-muted p-1 md:inline-flex md:w-auto"
      >
        <button
          type="button"
          aria-pressed={activeMode === 'termo'}
          className={modeButtonClass(activeMode === 'termo', 'termo')}
          onClick={() => onSelect('termo')}
        >
          Termo exato
        </button>
        <button
          type="button"
          aria-pressed={activeMode === 'tema'}
          aria-disabled={themeUnavailable || undefined}
          className={modeButtonClass(activeMode === 'tema', 'tema')}
          onClick={() => {
            if (themeUnavailable) return
            onSelect('tema')
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            {themeUnavailable ? (
              <TriangleAlertIcon
                className="size-3.5 text-estimate-pending-foreground"
                aria-hidden="true"
              />
            ) : (
              <SparklesIcon className="size-3.5" aria-hidden="true" />
            )}
            Por tema
          </span>
        </button>
      </div>
    </div>
    <p className="hidden text-xs text-muted-foreground md:block">
      {themeUnavailable ? 'Indisponível agora; mostramos o termo exato.' : relatedHint}
    </p>
  </div>
)
