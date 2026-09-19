'use client'

import { InfoIcon, UserIcon } from 'lucide-react'

import { RecordingSpeakerDialog } from '@/components/campaign/recording/RecordingSpeakerDialog'
import { RecordingTranscriptSegmentButton } from '@/components/campaign/recording/RecordingTranscriptSegmentButton'
import {
  RECORDING_SPEAKER_BANNER_BODY,
  RECORDING_SPEAKER_BANNER_DROPPED,
  RECORDING_SPEAKER_BANNER_TITLE,
  RECORDING_SPEAKER_GROUP_IDENTIFIED,
  RECORDING_SPEAKER_GROUP_UNIDENTIFIED,
} from '@/lib/recording'
import { cn } from '@/lib/utils'
import type { RecordingSpeakerGroupViewModel } from '@/utilities/recordings/recordingViewModels'

type RecordingSpeakerTranscriptProps = {
  recordingId: number
  groups: readonly RecordingSpeakerGroupViewModel[]
  labelsDropped: boolean
  /** `?t=` search hit or the segment under the player's current time. */
  activeStart: number | null
  onSeek: (seconds: number) => void
}

/**
 * C200 — the grouped transcript of the recording detail (design scenes 1, 4 and
 * 5): anonymous clusters in first-appearance order, the always-visible
 * imprecision warning (the grouping is automatic; the team identifies) and the
 * "Identificar falante" affordance per group.
 */
export const RecordingSpeakerTranscript = ({
  recordingId,
  groups,
  labelsDropped,
  activeStart,
  onSeek,
}: RecordingSpeakerTranscriptProps) => (
  <section aria-label="Transcrição por falante" className="min-w-0">
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden="true" />
      <div>
        <h4 className="text-sm font-semibold text-amber-950">{RECORDING_SPEAKER_BANNER_TITLE}</h4>
        <p className="mt-1 text-sm leading-5 text-amber-900">{RECORDING_SPEAKER_BANNER_BODY}</p>
        {labelsDropped ? (
          <p className="mt-1 text-sm leading-5 text-amber-900">
            {RECORDING_SPEAKER_BANNER_DROPPED}
          </p>
        ) : null}
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Transcrição por falante
      </h4>
      <span className="text-[11px] text-muted-foreground md:text-xs">
        <span className="md:hidden">Toque para posicionar</span>
        <span className="max-md:hidden">Clique para posicionar</span>
      </span>
    </div>

    <div className="mt-2 max-h-[28rem] space-y-3 overflow-y-auto">
      {groups.map((group) => (
        <article key={group.key} className="overflow-hidden rounded-xl border bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-stone-50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full',
                  group.isIdentified ? 'bg-primary/10 text-primary' : 'bg-muted',
                )}
              >
                <UserIcon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h5 className="truncate text-sm font-semibold">
                  {group.label ?? group.defaultLabel}
                </h5>
                <p className="text-[11px] text-muted-foreground">
                  {group.isIdentified
                    ? RECORDING_SPEAKER_GROUP_IDENTIFIED
                    : RECORDING_SPEAKER_GROUP_UNIDENTIFIED}
                </p>
              </div>
            </div>
            <RecordingSpeakerDialog recordingId={recordingId} group={group} />
          </header>

          {group.segments.map((segment) => (
            <RecordingTranscriptSegmentButton
              key={`${segment.startSeconds}-${segment.startLabel}`}
              segment={segment}
              active={activeStart === segment.startSeconds}
              variant="grouped"
              onSeek={onSeek}
            />
          ))}
        </article>
      ))}
    </div>
  </section>
)
