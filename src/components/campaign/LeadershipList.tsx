import { UsersIcon } from 'lucide-react'

import { LeadershipRow } from '@/components/campaign/LeadershipRow'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/Empty'
import {
  buildLeadershipPanelHref,
  formatLeadershipPhone,
  leadershipSectorLabels,
  type LeadershipFilterState,
} from '@/utilities/leadershipUi'
import type { LeadershipStaffListItemViewModel } from '@/utilities/leadershipViewModels'

export const LeadershipList = ({
  leaderships,
  primaryContactId,
  nucleusSlug,
  filters,
}: {
  leaderships: LeadershipStaffListItemViewModel[]
  primaryContactId: number | null
  nucleusSlug: string
  filters: LeadershipFilterState
}) => {
  if (!leaderships.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nenhuma liderança encontrada</EmptyTitle>
          <EmptyDescription>
            Cadastre quem influencia este território ou ajuste os filtros.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const renderLeadership = (leadership: LeadershipStaffListItemViewModel, className?: string) => (
    <LeadershipRow
      name={leadership.name}
      phone={formatLeadershipPhone(leadership.phone)}
      sector={leadership.sector ? leadershipSectorLabels[leadership.sector] : undefined}
      supportStatus={leadership.supportStatus}
      isPrimaryContact={primaryContactId === leadership.contactId}
      href={buildLeadershipPanelHref(nucleusSlug, filters, {
        mode: 'view',
        leadershipId: leadership.id,
      })}
      rowId={`leadership-row-${leadership.id}`}
      className={className}
    />
  )

  return (
    <div
      data-view="leadership-list"
      data-responsive-views="desktop-list mobile-cards"
      aria-label="Lideranças do núcleo"
      className="flex flex-col gap-3 md:gap-0 md:overflow-hidden md:rounded-xl md:border md:bg-card"
    >
      {leaderships.map((leadership, index) => (
        <div key={leadership.id} className="overflow-hidden rounded-xl border bg-card md:contents">
          {renderLeadership(
            leadership,
            index === leaderships.length - 1 ? 'border-b-0' : 'border-b-0 md:border-b',
          )}
        </div>
      ))}
    </div>
  )
}
