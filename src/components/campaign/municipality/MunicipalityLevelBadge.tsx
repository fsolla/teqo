import { Badge } from '@/components/ui/Badge'
import {
  EMPTY_ENGAGEMENT_LEVEL_LABEL,
  formatEngagementLevelLabel,
  type EngagementLevel,
} from '@/lib/engagementLevel'

/**
 * Deliberately NOT a colour ramp. A five-step scale of importance painted
 * across a staff list is the "mapa de onde você não vai defender" the research
 * warns about (anti-goal 11), and this row already spends red on priority,
 * amber on cold signals and five fills on the E10 class. The ordinal
 * information is in the numeral; the pill is a hairline. Absence of a level is
 * not a sixth step, so it reads as flat muted text instead.
 */
const ENGAGEMENT_LEVEL_BADGE_VARIANT = 'outline' as const
const EMPTY_ENGAGEMENT_LEVEL_BADGE_VARIANT = 'ghost' as const

type MunicipalityLevelBadgeProps = {
  level: EngagementLevel | null
  /** The rationale behind the current level, when the caller has it. */
  note?: string | null
  /**
   * In the table the numeral carries it and the long name lives in the
   * column's `cellTooltip`; elsewhere there is room to spell it out.
   */
  layout: 'table' | 'card'
}

/**
 * E14 — the read-only face of the ladder, for staff who cannot move it.
 *
 * The long name (and the motivo, when given) is always TEXT next to the pill —
 * `sr-only` in the table, visible in the card — because the B23 `cellTooltip`
 * contract is that the tooltip only repeats what the cell already says: Radix
 * mounts tooltip content on open, and the table adds no tab stops. Same shape
 * as `TerritorialClassReadout` in the neighbouring column.
 */
export const MunicipalityLevelBadge = ({ level, note, layout }: MunicipalityLevelBadgeProps) => {
  if (!level) {
    return (
      <Badge variant={EMPTY_ENGAGEMENT_LEVEL_BADGE_VARIANT} className="text-muted-foreground">
        {EMPTY_ENGAGEMENT_LEVEL_LABEL}
      </Badge>
    )
  }

  const label = formatEngagementLevelLabel(level)

  // The card spells the name out in the pill itself, so only the motivo is
  // left to say; the table shows the numeral and owes the reader both.
  if (layout === 'card') {
    return (
      <>
        <Badge variant={ENGAGEMENT_LEVEL_BADGE_VARIANT}>{label}</Badge>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </>
    )
  }

  return (
    <>
      <Badge variant={ENGAGEMENT_LEVEL_BADGE_VARIANT}>{level.toUpperCase()}</Badge>
      <span className="sr-only">{[label, note].filter(Boolean).join(' — ')}</span>
    </>
  )
}
