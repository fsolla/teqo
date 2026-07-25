import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Skeleton } from '@/components/ui/skeleton'

/** List-shaped skeleton for /municipios and its detail routes. */
export default function MunicipalitiesLoading() {
  return (
    <CampaignPageShell aria-label="Carregando municípios" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 w-full max-w-md" />
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-40" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </CampaignPageShell>
  )
}
