import { RecordingResultCard } from '@/components/campaign/recording/RecordingResultCard'
import type { RecordingListItemViewModel } from '@/utilities/recordings/recordingViewModels'

export const RecordingResultList = ({ rows }: { rows: readonly RecordingListItemViewModel[] }) => (
  <div className="flex flex-col gap-3">
    {rows.map((row) => (
      <RecordingResultCard key={row.id} recording={row} />
    ))}
  </div>
)
