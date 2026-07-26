import { CircleAlertIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { campaignUserInitials } from '@/utilities/campaignUserProfile'
import { municipalityListCoverageLabels } from '@/utilities/municipalityLabels'

export type MunicipalityAdvisorAvatarEntry = {
  id: number
  name: string
}

/** Resolves advisor ids to `{id, name}` entries, dropping any without a name (deleted/unknown user). */
export const advisorEntriesFromIds = (
  advisorIDs: number[],
  advisorNamesById: ReadonlyMap<number, { id: number; name: string }>,
): MunicipalityAdvisorAvatarEntry[] =>
  advisorIDs.flatMap((id) => {
    const advisor = advisorNamesById.get(id)
    return advisor ? [{ id: advisor.id, name: advisor.name }] : []
  })

/**
 * E9: a priority município with nobody answering for it is the queue's loudest
 * row, so it reads "Sem responsável" in destructive — the same words the
 * overview's coluna da vergonha uses to count them. Non-priority ones keep the
 * softer pending tone: they are a gap, not a fire. It stands in for the advisor
 * names, so it only ever states an absence.
 */
export const MissingAdvisorBadge = ({ isPriority }: { isPriority: boolean }) => (
  <Badge variant={isPriority ? 'destructive' : 'estimate-pending'}>
    <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
    {isPriority ? 'Sem responsável' : municipalityListCoverageLabels.sem_assessor}
  </Badge>
)

/** One advisor name per line, for the tooltip — `null` when the list is empty (that's `MissingAdvisorBadge`'s job). */
export const formatAdvisorNamesTooltip = (
  advisors: MunicipalityAdvisorAvatarEntry[],
): ReactElement | null =>
  advisors.length === 0 ? null : (
    <div className="flex flex-col">
      {advisors.map((advisor) => (
        <span key={advisor.id}>{advisor.name}</span>
      ))}
    </div>
  )

export const MunicipalityAdvisorAvatarStack = ({
  advisors,
  isPriority,
  maxVisible = 3,
}: {
  advisors: MunicipalityAdvisorAvatarEntry[]
  isPriority: boolean
  maxVisible?: number
}) => {
  if (!advisors.length) return <MissingAdvisorBadge isPriority={isPriority} />

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {advisors.slice(0, maxVisible).map((advisor) => (
          <Avatar key={advisor.id} className="size-8 border-2 border-background">
            <AvatarFallback>{campaignUserInitials(advisor.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="sr-only">{advisors.map((advisor) => advisor.name).join(', ')}</span>
    </div>
  )
}
