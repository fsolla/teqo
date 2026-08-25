import { FlagIcon } from 'lucide-react'

import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { cn } from '@/lib/utils'
import { municipalityPriorityIndicatorLabel } from '@/utilities/municipality/municipalityLabels'

type MunicipalityPriorityIndicatorProps = {
  className?: string
}

/** Staff-only `priority === 'alta'` readout on the municipality list (icon + tooltip). */
export const MunicipalityPriorityIndicator = ({
  className,
}: MunicipalityPriorityIndicatorProps) => (
  <CampaignHoverTooltip content={municipalityPriorityIndicatorLabel} align="start">
    <span
      className={cn('inline-flex shrink-0 items-center justify-center text-primary', className)}
      aria-label={municipalityPriorityIndicatorLabel}
    >
      <FlagIcon className="size-4" aria-hidden />
    </span>
  </CampaignHoverTooltip>
)
