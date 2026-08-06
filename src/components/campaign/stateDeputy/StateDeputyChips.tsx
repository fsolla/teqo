import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import type { StateDeputySummary } from '@/utilities/stateDeputyData'

type StateDeputyChipsProps = {
  deputies: StateDeputySummary[]
}

export const StateDeputyChips = ({ deputies }: StateDeputyChipsProps) => {
  if (deputies.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {deputies.map((deputy) => (
        <Badge key={deputy.id} variant="outline" asChild>
          <Link href={`/campanha/dobradinhas/${deputy.id}`}>
            {deputy.name}
            {deputy.party ? ` (${deputy.party})` : ''}
          </Link>
        </Badge>
      ))}
    </div>
  )
}
