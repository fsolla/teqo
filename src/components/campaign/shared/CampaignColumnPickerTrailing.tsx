'use client'

import { CampaignColumnPicker } from '@/components/campaign/shared/CampaignColumnPicker'
import type {
  CampaignColumnPickerColumn,
  CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'

type CampaignColumnPickerTrailingProps = {
  columnVisibility: CampaignColumnVisibility
  columns: readonly CampaignColumnPickerColumn[]
}

/**
 * B137 — column picker beside the list omnibox (`trailing`), not stacked above
 * the table. Gated at `md:` because municípios and apoiadores hide the table
 * below that width and show cards instead (B17).
 */
export const CampaignColumnPickerTrailing = ({
  columnVisibility,
  columns,
}: CampaignColumnPickerTrailingProps) => (
  <div className="hidden md:flex">
    <CampaignColumnPicker
      listId={columnVisibility.listId}
      columns={columns}
      hiddenColumnIds={columnVisibility.hiddenColumnIds}
    />
  </div>
)
