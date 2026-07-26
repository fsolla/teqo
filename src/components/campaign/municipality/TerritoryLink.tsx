import Link from 'next/link'

import { buildTerritoryPageHref } from '@/lib/territoryAnchor'

export const TerritoryLink = ({ region }: { region: string }) => (
  <Link
    href={buildTerritoryPageHref(region)}
    className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:underline"
  >
    {region}
  </Link>
)
