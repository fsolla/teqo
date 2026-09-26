'use client'

import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  ACERVO_SORT_OPTIONS,
  ACERVO_THEME_SORT_OPTIONS,
  acervoSortIsDuration,
  type AcervoThemeSortKey,
} from '@/lib/acervoListSort'
import { cn } from '@/lib/utils'
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
 *
 * C229 — the web theme mode opens with "Mais relevantes" (the semantic default,
 * never serialized) and keeps "Mais recentes" as a real, serializable state;
 * recordings (and the exact mode) keep the C216 vocabulary untouched.
 */
type AcervoSortState = RecordingListState | SpeechListState

export const AcervoSortSelect = ({
  state,
  hint,
  themeUnavailable = false,
}: {
  state: AcervoSortState
  hint: string
  /** C229 — the engine is down: the list is literal, so show the exact-mode order. */
  themeUnavailable?: boolean
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) =>
      next.source === 'enviadas' ? buildRecordingListHref(next, 1) : buildSpeechListHref(next, 1),
  })

  const isWebTheme = state.source === 'internet' && state.mode === 'tema'
  const isSpeechTheme = isWebTheme && !themeUnavailable
  const options = isSpeechTheme ? ACERVO_THEME_SORT_OPTIONS : ACERVO_SORT_OPTIONS
  const selected: AcervoThemeSortKey = state.sort ?? (isSpeechTheme ? 'relevancia' : 'recentes')

  const change = (value: AcervoThemeSortKey) => {
    // Relevance means "no sort" in the theme mode; "recentes" does so in every
    // other path (each mode's never-serialized default).
    if (value === 'relevancia' || (value === 'recentes' && !isSpeechTheme)) {
      navigate({ ...state, page: 1, sort: undefined })
      return
    }
    navigate({ ...state, page: 1, sort: value })
  }

  return (
    <div
      className={cn(
        'flex flex-col items-end gap-1',
        // C229 — the web theme control takes the full row on mobile (design
        // scene 02): one bordered line with the label left and the order right.
        isWebTheme && 'w-full md:w-auto',
      )}
    >
      <label
        className={cn(
          'flex items-center gap-2 text-xs text-muted-foreground',
          isWebTheme &&
            'min-h-11 w-full justify-between rounded-lg border border-input bg-white px-3 md:min-h-0 md:w-auto md:justify-start md:gap-2 md:rounded-none md:border-0 md:bg-transparent md:px-0',
        )}
      >
        Ordenar por
        <select
          value={selected}
          disabled={isPending}
          className={cn(
            'min-h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground disabled:opacity-70',
            isWebTheme &&
              'min-h-11 rounded-md border-0 bg-transparent px-0 text-sm font-medium outline-none md:min-h-10 md:rounded-md md:border md:border-input md:bg-white md:px-3',
          )}
          onChange={(event) => change(event.target.value as AcervoThemeSortKey)}
        >
          {options.map((option) => (
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
