'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

export const createCampaignClientDynamic = <P extends object>(
  importModule: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string,
  skeletonHeightClassName: string,
) =>
  dynamic(() => importModule().then((module) => module[exportName]), {
    ssr: false,
    loading: () => (
      <Skeleton className={`${skeletonHeightClassName} w-full rounded-lg`} aria-hidden="true" />
    ),
  })
