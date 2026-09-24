import { WebSpeechResultCard } from '@/components/campaign/speech/WebSpeechResultCard'
import type { WebSpeechListItemViewModel } from '@/utilities/speech/speechViewModels'

/** C216 — the "Falas na internet" results, one card per web speech. */
export const WebSpeechResultList = ({ rows }: { rows: readonly WebSpeechListItemViewModel[] }) => (
  <div className="space-y-3">
    {rows.map((speech) => (
      <WebSpeechResultCard key={speech.id} speech={speech} />
    ))}
  </div>
)
