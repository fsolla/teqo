import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Skeleton } from '@/components/ui/skeleton'

export default function CampaignQuadroLoading() {
  return (
    <CampaignPageShell aria-label="Carregando painel da campanha" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </CampaignPageShell>
  )
}
