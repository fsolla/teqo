import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { Skeleton } from '@/components/ui/skeleton'

export default function NucleiLoading() {
  return (
    <CampaignPageShell aria-busy="true" aria-label="Carregando núcleos">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </CampaignPageShell>
  )
}
