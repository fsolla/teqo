import { choroplethGradientCss } from '@/lib/choroplethColorScale'
import { formatElectionNumber } from '@/lib/electionInsights'

type ChoroplethLegendProps = {
  max: number
  metricLabel: string
}

export const ChoroplethLegend = ({ max, metricLabel }: ChoroplethLegendProps) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">0</span>
      <div
        className="h-2.5 min-w-0 flex-1 rounded-full ring-1 ring-foreground/10"
        style={{ background: choroplethGradientCss }}
        role="img"
        aria-label={`Escala de cor de 0 a ${formatElectionNumber(max)} para ${metricLabel}`}
      />
      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatElectionNumber(max)}
      </span>
    </div>
    <p className="text-xs text-muted-foreground">
      Escala: intensidade da cor indica {metricLabel.toLowerCase()} no território.
    </p>
  </div>
)
