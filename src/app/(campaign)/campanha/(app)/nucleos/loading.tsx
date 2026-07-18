import { Skeleton } from '@/components/ui/skeleton'

export default function NucleiLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6"
      aria-busy="true"
      aria-label="Carregando núcleos"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-80 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
