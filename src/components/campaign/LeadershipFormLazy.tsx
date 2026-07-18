'use client'

import { lazy, Suspense } from 'react'

import type { LeadershipFormProps } from '@/components/campaign/LeadershipForm'
import { Skeleton } from '@/components/ui/skeleton'

const LazyLeadershipForm = lazy(() =>
  import('./LeadershipForm').then((module) => ({ default: module.LeadershipForm })),
)

export const LeadershipFormLazy = (props: LeadershipFormProps) => (
  <Suspense
    fallback={
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4" aria-label="Carregando formulário">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    }
  >
    <LazyLeadershipForm {...props} />
  </Suspense>
)
