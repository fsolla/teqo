import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { Skeleton } from '@/components/ui/skeleton'

/** List-shaped skeleton for /apoiadores and its detail routes. */
export default function SupportersLoading() {
  return (
    <CampaignPageShell aria-label="Carregando apoiadores" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 w-full max-w-md" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </CampaignPageShell>
  )
}
