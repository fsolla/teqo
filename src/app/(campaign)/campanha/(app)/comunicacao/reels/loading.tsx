import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Skeleton } from '@/components/ui/skeleton'

/** C194 — grid-shaped skeleton for the reel library and its detail route. */
export default function ReelLibraryLoading() {
  return (
    <CampaignPageShell aria-label="Carregando biblioteca de reels" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-[9/16] w-full rounded-xl" />
        ))}
      </div>
    </CampaignPageShell>
  )
}
