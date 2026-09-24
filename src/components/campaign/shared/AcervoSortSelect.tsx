'use client'

import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { ACERVO_SORT_OPTIONS, acervoSortIsDuration, type AcervoSortKey } from '@/lib/acervoListSort'
import {
  buildRecordingListHref,
  type RecordingListState,
} from '@/utilities/recordings/recordingListUrl'
import { buildSpeechListHref, type SpeechListState } from '@/utilities/speech/speechListUrl'

/**
 * C216 — the list state of one acervo source. The `source` discriminator picks
 * the canonical serializer inside this client component: a server component
 * can never hand a function prop across the boundary, so the domain modules
 * are imported here (they are client-safe pure contracts) and the page only
 * passes the serializable state and its honest hint.
 */
export type AcervoSortState = RecordingListState | SpeechListState

/**
 * C216 — the shared acervo ordering control (design scene 01): "Mais recentes"
 * (the default, never serialized) plus the two duration orders. Each source
 * passes its own state and the honest line shown while a duration order is
 * active (it only lists rows with a measured duration).
 */
export const AcervoSortSelect = ({ state, hint }: { state: AcervoSortState; hint: string }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) =>
      next.source === 'enviadas' ? buildRecordingListHref(next, 1) : buildSpeechListHref(next, 1),
  })

  const change = (value: AcervoSortKey) => {
    const sort = value === 'recentes' ? undefined : value
    navigate(
      state.source === 'enviadas' ? { ...state, page: 1, sort } : { ...state, page: 1, sort },
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Ordenar por
        <select
          value={state.sort ?? 'recentes'}
          disabled={isPending}
          className="min-h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground disabled:opacity-70"
          onChange={(event) => change(event.target.value as AcervoSortKey)}
        >
          {ACERVO_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {acervoSortIsDuration(state.sort) ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
