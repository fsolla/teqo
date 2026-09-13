import { SpeechResultCard } from '@/components/campaign/speech/SpeechResultCard'
import type { SpeechListItemViewModel } from '@/utilities/speech/speechViewModels'

export const SpeechResultList = ({ rows }: { rows: readonly SpeechListItemViewModel[] }) => (
  <div className="flex flex-col gap-3">
    {rows.map((row) => (
      <SpeechResultCard key={row.id} speech={row} />
    ))}
  </div>
)
