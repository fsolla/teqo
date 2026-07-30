'use client'

import { MunicipalityVotePositionReadout } from '@/components/campaign/municipality/MunicipalityVotePositionReadout'
import type { MunicipalityVoteRankEntry } from '@/lib/municipalityVoteRank'

type HomeSearchMunicipalityVoteTrailingProps = {
  position: MunicipalityVoteRankEntry | null
}

export const HomeSearchMunicipalityVoteTrailing = ({
  position,
}: HomeSearchMunicipalityVoteTrailingProps) =>
  position ? (
    <MunicipalityVotePositionReadout position={position} layout="search" />
  ) : (
    <span className="text-sm text-muted-foreground">—</span>
  )
