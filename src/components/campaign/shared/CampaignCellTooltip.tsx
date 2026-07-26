'use client'

import type { ReactNode } from 'react'

import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'

/**
 * Cell-level tooltip for the campaign list system — the render half of
 * `CampaignTableColumn.cellTooltip`. Columns declare the extra reading; the
 * table wraps the cell in this.
 *
 * The trigger `<span>` is created HERE rather than by the column, so a column
 * declares only the data (`cellTooltip`) and the table owns the affordance —
 * every cell tooltip in the system then behaves and is sized identically.
 *
 * It deliberately takes no `tabIndex` — 435 rows × N columns of dead tab stops
 * would be a worse trade than the redundancy contract documented on
 * `cellTooltip`, which requires the tooltip's information to already exist as
 * text in the cell (visible or `sr-only`).
 */
export const CampaignCellTooltip = ({
  content,
  children,
}: {
  content: ReactNode
  children: ReactNode
}) => (
  <CampaignHoverTooltip content={content} side="bottom" align="start">
    <span className="inline-flex max-w-full">{children}</span>
  </CampaignHoverTooltip>
)
