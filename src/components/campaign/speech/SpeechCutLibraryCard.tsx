import Link from 'next/link'

import { SpeechCutLibraryCardActions } from '@/components/campaign/speech/SpeechCutLibraryCardActions'
import { SpeechCutStatusBadge } from '@/components/campaign/speech/SpeechCutStatusBadge'
import { WebSpeechPlatformPill } from '@/components/campaign/speech/WebSpeechPlatformPill'
import type { SpeechCutLibraryItemViewModel } from '@/lib/speechCut'
import { webSpeechPlatformLabel } from '@/lib/webSpeech'

/**
 * C168 — one row of the cut library: status + creation date, the editable title,
 * the origin speech (label + link to the acervo) with the stored duration, and
 * the actions (open, copy when live, retry a failure, delete) as a client island.
 *
 * C217 — a cut of a web speech shows the platform ("Origem: YouTube") and links
 * back to its own detail; the Câmara row is byte for byte the same.
 */
export const SpeechCutLibraryCard = ({ cut }: { cut: SpeechCutLibraryItemViewModel }) => (
  <article
    className={
      cut.status === 'published'
        ? 'rounded-xl border bg-card p-4'
        : 'rounded-xl border border-dashed bg-card p-4'
    }
  >
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <SpeechCutStatusBadge status={cut.status} />
      {cut.origin?.source === 'web' && cut.origin.platform ? (
        <WebSpeechPlatformPill
          platform={cut.origin.platform}
          label={`Origem: ${webSpeechPlatformLabel(cut.origin.platform)}`}
        />
      ) : null}
      {cut.createdAtLabel ? (
        <span className="text-xs text-muted-foreground">Criado em {cut.createdAtLabel}</span>
      ) : null}
    </div>

    <h3 className="mt-2 text-sm font-medium">{cut.title}</h3>

    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {cut.origin ? (
        <Link href={cut.origin.href} className="underline underline-offset-4 hover:text-foreground">
          {cut.origin.label}
        </Link>
      ) : (
        <span>Fala de origem indisponível</span>
      )}
      <span aria-hidden="true">·</span>
      <span>{cut.durationLabel}</span>
    </div>

    <SpeechCutLibraryCardActions cut={cut} />
  </article>
)
