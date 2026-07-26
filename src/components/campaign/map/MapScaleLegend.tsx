import Link from 'next/link'

import { campaignConceptHref, type CampaignConceptId } from '@/lib/campaignIntelligenceConcepts'
import type { MapScaleClassing } from '@/lib/mapScaleClasses'

type MapScaleLegendProps = {
  classing: MapScaleClassing
  /** What the swatches measure — "votos de Jorge Solla em 2022". */
  metricLabel: string
  /** What the colour means plus any caveat (small scope, missing data). */
  note: string
  /** Ties the note to the scale selector through `aria-describedby`. */
  noteId: string
  /** Glossary entry for this scale, when it has one (E18). */
  conceptID?: CampaignConceptId
}

/**
 * Discrete counterpart of `ChoroplethLegend`: a swatch per class with its real
 * range, weakest on the left. A gradient bar cannot answer "which band is this
 * município in", which is the only question a classed map is asked.
 */
export const MapScaleLegend = ({
  classing,
  metricLabel,
  note,
  noteId,
  conceptID,
}: MapScaleLegendProps) => (
  <div className="flex flex-col gap-1.5">
    <ul
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
      aria-label={`Faixas de cor para ${metricLabel}`}
    >
      {classing.classes.map((entry, index) => (
        <li key={index} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-[3px] ring-1 ring-foreground/15"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-xs tabular-nums text-muted-foreground">{entry.label}</span>
        </li>
      ))}
    </ul>
    <p id={noteId} className="text-xs text-muted-foreground">
      {note}
      {conceptID ? (
        <>
          {' '}
          <Link
            href={campaignConceptHref(conceptID)}
            className="font-medium underline underline-offset-2"
          >
            Saiba mais
          </Link>
        </>
      ) : null}
    </p>
  </div>
)
