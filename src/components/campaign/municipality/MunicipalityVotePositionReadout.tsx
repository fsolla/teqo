import {
  formatElectionNumber,
  formatPlacementOrdinal,
  formatVoteSharePercent,
} from '@/lib/electionFormat'
import type { MunicipalityVoteRankEntry } from '@/lib/municipalityVoteRank'
import { cn } from '@/lib/utils'

export type MunicipalityVotePositionReadoutLayout = 'table' | 'card' | 'search'

export const MunicipalityVotePositionReadout = ({
  position,
  layout,
  className,
}: {
  position: MunicipalityVoteRankEntry
  layout: MunicipalityVotePositionReadoutLayout
  /** B193 — the dense mobile card header right-aligns the card layout. */
  className?: string
}) => {
  const share = formatVoteSharePercent(position.share)
  const rank = formatPlacementOrdinal(position.rank)
  // B193 — the dense card reads "colocação · votos" per the wireframe; the
  // table keeps "votos · colocação" (desktop untouched by B193).
  const metaLine =
    layout === 'search'
      ? formatElectionNumber(position.votes)
      : layout === 'card'
        ? `${rank} · ${formatElectionNumber(position.votes)}`
        : `${formatElectionNumber(position.votes)} · ${rank}`
  const ariaLabel = `${share} da votação estadual, ${formatElectionNumber(position.votes)} votos, ${rank} de ${formatElectionNumber(position.totalUnits)}`

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 tabular-nums',
        layout === 'table' || layout === 'search' ? 'items-end text-right' : 'text-sm',
        className,
      )}
      aria-label={ariaLabel}
    >
      <span className={cn('font-medium', layout === 'card' && 'text-foreground')}>{share}</span>
      <span className="text-xs text-muted-foreground">{metaLine}</span>
    </div>
  )
}
