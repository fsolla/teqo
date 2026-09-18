import { ReelLibraryCard } from '@/components/campaign/reels/ReelLibraryCard'
import type { ReelLibraryItemViewModel } from '@/lib/reel'

/** C194 — the cover grid: two columns on the phone, four on the desktop. */
export const ReelLibraryList = ({ rows }: { rows: readonly ReelLibraryItemViewModel[] }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
    {rows.map((reel) => (
      <ReelLibraryCard key={reel.id} reel={reel} />
    ))}
  </div>
)
