import { SpeechResultCard } from '@/components/campaign/speech/SpeechResultCard'
import type { SpeechListItemViewModel } from '@/utilities/speech/speechViewModels'

export const SpeechResultList = ({
  rows,
  query,
}: {
  rows: readonly SpeechListItemViewModel[]
  /** C174 — the search term, highlighted on the nested cuts. */
  query?: string
}) => (
  <div className="flex flex-col gap-3">
    {rows.map((row) => (
      <SpeechResultCard key={row.id} speech={row} query={query} />
    ))}
  </div>
)
