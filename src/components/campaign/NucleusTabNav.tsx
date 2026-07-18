import Link from 'next/link'

import { cn } from '@/lib/utils'
import {
  buildNucleusDetailTabHref,
  type NucleusDetailKind,
  type NucleusDetailSearchParams,
  type NucleusDetailTab,
} from '@/utilities/nucleusDetailTabUi'

const tabLabels: Record<NucleusDetailTab, string> = {
  overview: 'Visão geral',
  territory: 'Território',
  electorate: 'Eleitorado',
  leaderships: 'Lideranças',
  updates: 'Atualizações',
}

const visibleTabs = (nucleusKind: NucleusDetailKind): NucleusDetailTab[] =>
  nucleusKind === 'staff'
    ? ['overview', 'territory', 'electorate', 'leaderships', 'updates']
    : ['overview', 'territory', 'leaderships', 'updates']

export const NucleusTabNav = ({
  activeTab,
  nucleusKind,
  nucleusSlug,
  searchParams,
}: {
  activeTab: NucleusDetailTab
  nucleusKind: NucleusDetailKind
  nucleusSlug: string
  searchParams: NucleusDetailSearchParams
}) => (
  <nav
    aria-label="Seções do núcleo"
    className="h-14 min-w-0 overflow-x-auto overflow-y-hidden border-b"
  >
    <ul
      role="list"
      className="m-0 flex h-full min-w-max list-none items-stretch gap-1 p-0 md:gap-0 lg:gap-1"
    >
      {visibleTabs(nucleusKind).map((tab) => {
        const isActive = tab === activeTab
        return (
          <li key={tab} className="m-0 h-full p-0">
            <Link
              href={buildNucleusDetailTabHref(nucleusSlug, tab, searchParams)}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative inline-flex h-full items-center whitespace-nowrap px-4 text-sm font-medium text-muted-foreground outline-none transition-colors md:px-2 lg:px-4',
                'hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50',
                'after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-transparent',
                isActive && 'font-semibold text-primary after:bg-primary',
              )}
            >
              {tabLabels[tab]}
            </Link>
          </li>
        )
      })}
    </ul>
  </nav>
)
