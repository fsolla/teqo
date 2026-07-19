'use client'

import { useMemo } from 'react'

import { BahiaMap } from '@/components/campaign/BahiaMap'

type NucleusDetailMapProps = {
  codareas: string[]
  territoryCodes: string[]
  territoryLabel: string
}

export const NucleusDetailMap = ({
  codareas,
  territoryCodes,
  territoryLabel,
}: NucleusDetailMapProps) => {
  const highlightKeys = codareas.length > 0 ? codareas : territoryCodes
  const mode = codareas.length > 0 ? 'municipality' : 'territory'
  const values = useMemo(
    () => Object.fromEntries(highlightKeys.map((key) => [key, 1])),
    [highlightKeys],
  )

  return (
    <section aria-labelledby="nucleus-detail-map-title" className="flex flex-col gap-2">
      <div>
        <h3 id="nucleus-detail-map-title" className="text-base font-medium">
          Território no mapa
        </h3>
        <p className="text-sm text-muted-foreground">{territoryLabel}</p>
      </div>
      <BahiaMap
        mode={mode}
        values={values}
        highlightKeys={highlightKeys}
        heightClassName="h-[280px]"
        ariaLabel={`Mapa destacando o território do núcleo: ${territoryLabel}`}
      />
    </section>
  )
}
