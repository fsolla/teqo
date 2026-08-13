'use client'

import type { ReactNode } from 'react'

import { ContactMobileCard } from '@/components/campaign/contacts/ContactMobileCard'
import type { ContactRowViewModel } from '@/utilities/contacts/contactListData'

/** C139 — the mobile ficha list (below `md`), replacing the interim one-liner. */
export const ContactMobileList = ({
  rows,
  canDelete,
  empty,
}: {
  rows: readonly ContactRowViewModel[]
  canDelete: boolean
  empty: ReactNode
}) => (
  <ul data-view="mobile-cards" className="flex flex-col divide-y md:hidden">
    {rows.length === 0 ? <li className="py-4">{empty}</li> : null}
    {rows.map((row) => (
      <ContactMobileCard key={row.contactID} row={row} canDelete={canDelete} />
    ))}
  </ul>
)
