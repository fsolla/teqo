import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Skeleton } from '@/components/ui/skeleton'

/** List-shaped skeleton for the cut library and its detail route. */
export default function SpeechCutLibraryLoading() {
  return (
    <CampaignPageShell aria-label="Carregando biblioteca de cortes" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </CampaignPageShell>
  )
}
