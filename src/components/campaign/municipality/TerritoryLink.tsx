import Link from 'next/link'

import { buildTerritoryPageHref } from '@/lib/territoryAnchor'

export const TerritoryLink = ({ region }: { region: string }) => (
  <Link
    href={buildTerritoryPageHref(region)}
    // B161: compact line — the ≥44px touch target comes from the hit-area
    // pseudo-element so the territory reads right below the município name.
    className="relative inline-flex items-center text-muted-foreground underline-offset-4 hover:underline after:absolute after:inset-x-0 after:-inset-y-2.5"
  >
    {region}
  </Link>
)
