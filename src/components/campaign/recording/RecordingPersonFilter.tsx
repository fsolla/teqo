'use client'

import { FunnelIcon, XIcon } from 'lucide-react'
import { useOptimistic } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { foldSpeakerName } from '@/lib/recordingDiarization'
import {
  buildRecordingListHref,
  removeRecordingPerson,
  toggleRecordingPerson,
  type RecordingListState,
} from '@/utilities/recordings/recordingListUrl'

const PERSON_FILTER_ID = 'recording-filter-person'

/**
 * C200 — the "Pessoa" facet of the uploaded recordings (design scene 3): one
 * removable chip per selected label plus the multi-select popover backed by the
 * labels actually present. Options come from the server (`speakerNames`), never
 * from a free-form directory — the label is text, not a `Contact`.
 */
export const RecordingPersonFilter = ({
  state,
  options,
}: {
  state: RecordingListState
  options: readonly string[]
}) => {
  const { navigate } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildRecordingListHref(next, 1),
  })
  const [viewState, setOptimisticState] = useOptimistic(state)
  const selected = viewState.people ?? []

  const optionRows: CampaignHeaderFilterRow[] = options.map((option) => {
    const next = toggleRecordingPerson(viewState, option)
    return {
      value: option,
      label: option,
      href: buildRecordingListHref(next, 1),
      selected: selected.some((person) => foldSpeakerName(person) === foldSpeakerName(option)),
      checkbox: true,
      onChoose: () => setOptimisticState(next),
    }
  })

  const clear = {
    href: buildRecordingListHref({ ...viewState, page: 1, people: undefined }, 1),
    onChoose: () => setOptimisticState({ ...viewState, page: 1, people: undefined }),
  }

  return (
    <div role="group" aria-label="Filtrar por pessoa" className="flex flex-wrap items-center gap-2">
      <CampaignHeaderFilterPopover
        id={PERSON_FILTER_ID}
        label="Pessoa"
        triggerVariant="chip"
        triggerLabel={selected.length > 1 ? `Pessoa: ${selected.length}` : 'Pessoa'}
        active={selected.length > 0}
        closeOnChoose={false}
        emptyLabel="Nenhuma pessoa identificada nas gravações."
        optionRows={optionRows}
        clear={selected.length ? clear : undefined}
      />

      {selected.map((person) => (
        <button
          key={person}
          type="button"
          className="inline-flex h-8 min-h-8 items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => navigate(removeRecordingPerson(viewState, person))}
          aria-label={`Remover filtro de ${person}`}
        >
          <FunnelIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="max-w-56 truncate">Pessoa: {person}</span>
          <XIcon className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
