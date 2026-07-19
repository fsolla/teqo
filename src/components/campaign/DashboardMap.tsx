'use client'

import { ChoroplethMapPanel } from '@/components/campaign/ChoroplethMapPanel'
import type { NucleusChoroplethBundle } from '@/utilities/nucleusChoroplethTypes'

export const DashboardMap = ({ choropleth }: { choropleth: NucleusChoroplethBundle }) => (
  <ChoroplethMapPanel
    bundle={choropleth}
    idPrefix="dashboard-map"
    title="Mapa da campanha"
    description="Visão por Território de Identidade dos núcleos ativos e estimativas confirmadas."
    ariaLabel="Mapa coroplético da Bahia com agregados dos núcleos ativos"
    defaultMode="territory"
    defaultMetric="confirmedEstimate"
  />
)
