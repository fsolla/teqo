'use client'

import dynamic from 'next/dynamic'

import type { FederalCandidateOption } from '@/utilities/electionCandidateOptions'
import type { MunicipalityMapBundle } from '@/utilities/municipalityMapContract'

const MunicipalityMapPanelLazy = dynamic(
  () => import('@/components/campaign/map/MunicipalityMapPanel').then((module) => module.MunicipalityMapPanel),
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

export const MunicipalityMapPanelDynamic = ({
  bundle,
  candidateOptions,
}: {
  bundle: MunicipalityMapBundle
  candidateOptions: FederalCandidateOption[]
}) => <MunicipalityMapPanelLazy bundle={bundle} candidateOptions={candidateOptions} />
