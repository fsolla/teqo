import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Skeleton } from '@/components/ui/skeleton'

/** List-shaped skeleton for the speech acervo and its detail routes. */
export default function SpeechAcervoLoading() {
  return (
    <CampaignPageShell aria-label="Carregando acervo de falas" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </CampaignPageShell>
  )
}
