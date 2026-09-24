'use client'

import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { ACERVO_SORT_OPTIONS, acervoSortIsDuration, type AcervoSortKey } from '@/lib/acervoListSort'
import {
  buildRecordingListHref,
  type RecordingListState,
} from '@/utilities/recordings/recordingListUrl'
import { buildSpeechListHref, type SpeechListState } from '@/utilities/speech/speechListUrl'

/**
 * C216 — the shared acervo ordering control (design scene 01): "Mais recentes"
 * (the default, never serialized) plus the two duration orders. The list state
 * of one source carries the `source` discriminator that picks the canonical
 * serializer here: a server component can never hand a function prop across
 * the boundary, so the client-safe domain contracts are imported inside this
 * component and the page passes only the serializable state and the honest
 * line shown while a duration order is active (it lists measured rows only).
 */
type AcervoSortState = RecordingListState | SpeechListState

export const AcervoSortSelect = ({ state, hint }: { state: AcervoSortState; hint: string }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) =>
      next.source === 'enviadas' ? buildRecordingListHref(next, 1) : buildSpeechListHref(next, 1),
  })

  const change = (value: AcervoSortKey) => {
    navigate({ ...state, page: 1, sort: value === 'recentes' ? undefined : value })
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
