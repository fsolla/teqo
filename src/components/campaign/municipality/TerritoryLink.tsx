import Link from 'next/link'

import { buildTerritoryPageHref } from '@/lib/territoryAnchor'
import { cn } from '@/lib/utils'

export const TerritoryLink = ({
  region,
  compact = false,
}: {
  region: string
  /** B165 — the desktop name cell reads name+territory as one block, so the
   * territory drops its 44px touch-min there; the mobile card keeps it. */
  compact?: boolean
}) => (
  <Link
    href={buildTerritoryPageHref(region)}
    className={cn(
      'inline-flex items-center text-muted-foreground underline-offset-4 hover:underline',
      compact ? 'min-h-0' : 'min-h-11',
    )}
  >
    {region}
  </Link>
)
