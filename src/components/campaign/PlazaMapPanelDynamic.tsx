'use client'

import dynamic from 'next/dynamic'

import type { FederalCandidateOption } from '@/utilities/electionCandidateOptions'
import type { PlazaMapBundle } from '@/utilities/plazaMapData'

const PlazaMapPanelLazy = dynamic(
  () => import('@/components/campaign/PlazaMapPanel').then((module) => module.PlazaMapPanel),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="h-[420px] w-full animate-pulse rounded-xl border bg-muted/40"
      />
    ),
  },
)

export const PlazaMapPanelDynamic = ({
  bundle,
  candidateOptions,
}: {
  bundle: PlazaMapBundle
  candidateOptions: FederalCandidateOption[]
}) => <PlazaMapPanelLazy bundle={bundle} candidateOptions={candidateOptions} />
