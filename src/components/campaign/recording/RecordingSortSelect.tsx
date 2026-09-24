'use client'

import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  buildRecordingListHref,
  RECORDING_SORT_OPTIONS,
  recordingSortIsDuration,
  type RecordingListState,
  type RecordingSortKey,
} from '@/utilities/recordings/recordingListUrl'

/**
 * C219 — the list ordering control (design scene 01): "Mais recentes" (the
 * default, never serialized) plus the two duration orders. A duration order
 * only lists rows with a measured duration, so the hint says it out loud.
 */
export const RecordingSortSelect = ({ state }: { state: RecordingListState }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildRecordingListHref(next, 1),
  })
  const value: RecordingSortKey = state.sort ?? 'recentes'

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Ordenar por
        <select
          value={value}
          disabled={isPending}
          className="min-h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground disabled:opacity-70"
          onChange={(event) => {
            const next = event.target.value as RecordingSortKey
            navigate({ ...state, page: 1, sort: next === 'recentes' ? undefined : next })
          }}
        >
          {RECORDING_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {recordingSortIsDuration(state) ? (
        <p className="text-xs text-muted-foreground">
          Gravações sem duração aparecem apenas em Mais recentes.
        </p>
      ) : null}
    </div>
  )
}
