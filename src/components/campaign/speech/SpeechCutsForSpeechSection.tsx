import { PlayIcon, ScissorsIcon } from 'lucide-react'
import Link from 'next/link'

import { SpeechCutStatusBadge } from '@/components/campaign/speech/SpeechCutStatusBadge'
import { SpeechExcerptCta } from '@/components/campaign/speech/SpeechExcerptCta'
import { Button } from '@/components/ui/button'
import { campaignSpeechCutDetailHref } from '@/lib/campaignPaths'
import { formatSpeechClock } from '@/lib/speechClock'
import type { SpeechCutSummaryViewModel } from '@/lib/speechCut'

const SECTION_TITLE = 'Cortes desta fala'
const SECTION_DESCRIPTION = 'Abra um corte existente para editar ou reaproveitar.'

const OpenCutButton = ({
  cutId,
  title,
  className,
}: {
  cutId: number
  title: string
  className?: string
}) => (
  <Button asChild variant="outline" className={className}>
    <Link href={campaignSpeechCutDetailHref(cutId)} aria-label={`Abrir corte: ${title}`}>
      <PlayIcon data-icon="inline-start" aria-hidden="true" />
      Abrir corte
    </Link>
  </Button>
)

/**
 * C174 — "Cortes desta fala" on the speech detail: what was already cut from
 * this speech, so nobody re-cuts it. Lists and links only — editing continues in
 * the C168 library detail. The empty state points at the player's own picker
 * (only when that picker exists — a speech under the 5 s minimum offers none).
 */
export const SpeechCutsForSpeechSection = ({
  cuts,
  excerptSelectionAvailable,
}: {
  cuts: readonly SpeechCutSummaryViewModel[]
  excerptSelectionAvailable: boolean
}) => {
  if (cuts.length === 0) {
    return (
      <section aria-labelledby="speech-cuts" className="border-t pt-6">
        <h2 id="speech-cuts" className="text-lg font-semibold tracking-tight">
          {SECTION_TITLE}
        </h2>
        <div className="mt-4 flex min-h-52 flex-col items-center justify-center rounded-xl border px-6 py-8 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <ScissorsIcon className="size-5" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-medium">Nenhum corte desta fala ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione um trecho no player para criar o primeiro corte.
          </p>
          {excerptSelectionAvailable ? (
            <div className="mt-4">
              <SpeechExcerptCta />
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="speech-cuts" className="border-t pt-6">
      <div>
        <h2 id="speech-cuts" className="text-lg font-semibold tracking-tight">
          {SECTION_TITLE}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{SECTION_DESCRIPTION}</p>
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-xl border md:block">
        <div className="grid grid-cols-[minmax(0,1fr)_130px_76px_112px] gap-3 border-b bg-muted/60 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <span>Título</span>
          <span>Status</span>
          <span>Duração</span>
          <span className="sr-only">Ação</span>
        </div>
        {cuts.map((cut) => (
          <div
            key={cut.id}
            className="grid grid-cols-[minmax(0,1fr)_130px_76px_112px] items-center gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <p className="truncate text-sm font-medium">{cut.title}</p>
            <SpeechCutStatusBadge status={cut.status} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatSpeechClock(cut.durationSeconds)}
            </span>
            <OpenCutButton cutId={cut.id} title={cut.title} className="min-h-9" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 md:hidden">
        {cuts.map((cut) => (
          <div key={cut.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SpeechCutStatusBadge status={cut.status} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatSpeechClock(cut.durationSeconds)}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium">{cut.title}</p>
            <OpenCutButton cutId={cut.id} title={cut.title} className="mt-3 min-h-11 w-full" />
          </div>
        ))}
      </div>
    </section>
  )
}
