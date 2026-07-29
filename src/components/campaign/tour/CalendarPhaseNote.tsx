import { Badge } from '@/components/ui/Badge'
import type { CalendarPhase } from '@/lib/visitPlannerAnchors'
import { calendarPhaseLabels, calendarPhaseVisitProduct } from '@/utilities/visit/visitEligibility'

/**
 * E13 — the phase never travels without what it changes. The same date can make
 * a visit worth a night of organizing or a night of votes, so both surfaces that
 * judge a visit (the município card and the composer) say which phase it is AND
 * what the visit is supposed to produce in it.
 */
export const CalendarPhaseNote = ({ phase }: { phase: CalendarPhase }) => (
  <div className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2">
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Fase do calendário</span>
      <Badge variant="outline">{calendarPhaseLabels[phase]}</Badge>
    </div>
    <p className="text-xs text-muted-foreground">{calendarPhaseVisitProduct[phase]}</p>
  </div>
)
