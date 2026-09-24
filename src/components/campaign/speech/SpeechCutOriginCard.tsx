import Link from 'next/link'

import { formatSpeechClock } from '@/lib/speechClock'
import type { SpeechCutLibraryItemViewModel } from '@/lib/speechCut'
import { webSpeechPlatformLabel } from '@/lib/webSpeech'

/**
 * C168 — context of the cut: which speech it came from and the stored excerpt
 * span, with the link back to the acervo. Degrades honestly when the source
 * speech was deleted (the FK is `SET NULL`) — the cut itself stays usable.
 *
 * C217 — a web origin reads "Fala de origem" and links to its own detail.
 */
export const SpeechCutOriginCard = ({ cut }: { cut: SpeechCutLibraryItemViewModel }) => {
  const isWeb = cut.origin?.source === 'web'

  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
        {isWeb ? 'Fala de origem' : 'Discurso de origem'}
      </h2>
      {cut.origin ? (
        <>
          <p className="mt-1.5 text-sm text-foreground/90">{cut.origin.label}</p>
          {isWeb && cut.origin.platform ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {webSpeechPlatformLabel(cut.origin.platform)}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Trecho {formatSpeechClock(cut.startSeconds)}–{formatSpeechClock(cut.endSeconds)} da fala
          </p>
          <Link
            href={cut.origin.href}
            className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-foreground"
          >
            {isWeb ? 'Ver fala na internet' : 'Ver fala no acervo'}
          </Link>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">
          A fala de origem não está mais disponível. O corte continua salvo e compartilhável.
        </p>
      )}
    </section>
  )
}
