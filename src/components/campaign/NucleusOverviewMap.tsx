'use client'

import { ChoroplethMapPanel } from '@/components/campaign/ChoroplethMapPanel'
import type { NucleusChoroplethBundle } from '@/utilities/nucleusChoroplethTypes'

export const NucleusOverviewMap = ({ choropleth }: { choropleth: NucleusChoroplethBundle }) => (
  <ChoroplethMapPanel
    bundle={choropleth}
    idPrefix="nucleus-overview-map"
    title="Mapa do conjunto filtrado"
    description="Distribuição territorial dos núcleos e estimativas no recorte atual da lista."
    ariaLabel="Mapa coroplético da Bahia com os agregados dos núcleos filtrados"
    defaultMetric="confirmedEstimate"
  />
)
