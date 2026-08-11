import { CircleAlertIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { MunicipalityRelationAvatarStack } from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import { Badge } from '@/components/ui/Badge'
import { municipalityListCoverageLabels } from '@/utilities/municipality/municipalityLabels'

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
 *
 * B196: inside the mobile card's ~110px relation group the pill must wrap
 * (`whitespace-normal`, no fixed height) instead of clipping mid-letter —
 * on the wide desktop cell it still renders on a single line.
 */
export const MissingAdvisorBadge = ({ isPriority }: { isPriority: boolean }) => (
  <Badge
    variant={isPriority ? 'destructive' : 'estimate-pending'}
    className="h-auto min-h-5 whitespace-normal text-center"
  >
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
  overlapRow = false,
}: {
  advisors: MunicipalityAdvisorAvatarEntry[]
  isPriority: boolean
  /** B196 — dense mobile card mode: every advisor gets an avatar in one overlapping row. */
  overlapRow?: boolean
}) => {
  if (!advisors.length) return <MissingAdvisorBadge isPriority={isPriority} />

  return (
    <MunicipalityRelationAvatarStack
      entries={advisors.map((advisor) => ({ id: advisor.id, label: advisor.name }))}
      emptyState={null}
      overlapRow={overlapRow}
    />
  )
}
