import { SpeechCutLibraryCard } from '@/components/campaign/speech/SpeechCutLibraryCard'
import type { SpeechCutLibraryItemViewModel } from '@/lib/speechCut'

export const SpeechCutLibraryList = ({
  rows,
}: {
  rows: readonly SpeechCutLibraryItemViewModel[]
}) => (
  <div className="flex flex-col gap-3">
    {rows.map((cut) => (
      <SpeechCutLibraryCard key={cut.id} cut={cut} />
    ))}
  </div>
)
