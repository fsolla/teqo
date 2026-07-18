import { Skeleton } from '@/components/ui/skeleton'

export default function CampaignDashboardLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6"
      aria-label="Carregando painel da campanha"
      aria-busy="true"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-28" />
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-64" />
        ))}
      </div>
    </div>
  )
}
