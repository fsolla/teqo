'use client'

import type { ReactNode } from 'react'

import { CampaignSortableHead } from '@/components/campaign/shared/CampaignSortableHead'
import {
  buildContactSortHref,
  contactListSortLabels,
  defaultContactListSortDir,
  resolveContactListSort,
  type ContactListSortKey,
  type ContactListState,
} from '@/utilities/contacts/contactListUrl'

type ContactSortableHeadProps = {
  state: ContactListState
  sortKey: ContactListSortKey
  children?: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}

/** Sortable header for the contacts table (C139). Filters live in the
 * omnibox only — no header filter popovers (people precedent, C117). */
export const ContactSortableHead = ({
  state,
  sortKey,
  children,
  align = 'left',
  className,
}: ContactSortableHeadProps) => {
  const { sort: activeSort, dir } = resolveContactListSort(state)
  const active = activeSort === sortKey
  const nextDir = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultContactListSortDir(sortKey)

  return (
    <CampaignSortableHead
      active={active}
      align={align}
      className={className}
      dir={dir}
      href={buildContactSortHref(state, sortKey)}
      nextDir={nextDir}
      sortLabel={contactListSortLabels[sortKey]}
    >
      {children ?? contactListSortLabels[sortKey]}
    </CampaignSortableHead>
  )
}
