/**
 * Pure view helpers + status strip view model for municipality v2 (B147).
 * Client-safe — no Payload / server-only imports.
 */
import {
  EMPTY_ENGAGEMENT_LEVEL_LABEL,
  formatEngagementLevelLabel,
  type EngagementLevel,
} from '@/lib/engagementLevel'
import {
  municipalityUpdatePolarityLabels,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import type { PoliticalTrendStatus } from '@/utilities/municipality/municipalityLabels'
import {
  isMunicipalitySignalCold,
  MUNICIPALITY_COLD_SIGNAL_DAYS,
  municipalitySignalAgeInDays,
} from '@/utilities/municipality/municipalitySignal'
import type { MunicipalityTerritorialClassification } from '@/utilities/municipality/municipalityTerritorialClass'

export type MunicipalityV2StatusViewModel = {
  id: number
  name: string
  slug: string
  canMoveEngagementLevel: boolean
  engagementLevel: EngagementLevel | null
  levelNote: string | null
  levelChangedAt: string | null
  politicalTrendStatus: PoliticalTrendStatus | null
  politicalTrendNote: string | null
  lastSignalAt: string | null
  lastUpdatePolarity: MunicipalityUpdatePolarity | null
  lastUpdateBody: string | null
  territorialClass: MunicipalityTerritorialClassification
}

/** Sentinel select value when the município is cold / has no typed signal. */
export const MUNICIPALITY_V2_SIGNAL_COLD_VALUE = '__cold__'

export type MunicipalityV2StatusNotes = {
  levelNote: string | null
  trendNote: string | null
  updateBody: string | null
  updatePolarity: MunicipalityUpdatePolarity | null
  lastSignalAt: string | null
  engagementLevel: EngagementLevel | null
}

export type MunicipalityV2UpdateState = {
  /** Current `<select>` value — polarity or cold sentinel. */
  value: MunicipalityUpdatePolarity | typeof MUNICIPALITY_V2_SIGNAL_COLD_VALUE
  /** Short label for the control (and cold readout). */
  label: string
  ageInDays: number | null
  isCold: boolean
}

/**
 * Product assumption (intention open Q): cold → sentinel "Sem sinal / frio"
 * in the strip; age lives in aggregate/tooltip. Warm but typeless → "Sem tipo"
 * without claiming frio (frescor can still be warm from notes/pledges).
 */
export const resolveMunicipalityV2UpdateState = (
  input: {
    polarity: MunicipalityUpdatePolarity | null
    lastSignalAt: string | null
  },
  now: Date = new Date(),
): MunicipalityV2UpdateState => {
  const ageInDays = municipalitySignalAgeInDays(input.lastSignalAt, now)
  const isCold = isMunicipalitySignalCold(ageInDays)

  if (isCold) {
    const daysLabel =
      ageInDays === null ? `frio (≥${MUNICIPALITY_COLD_SIGNAL_DAYS} d)` : `frio (${ageInDays} d)`
    return {
      value: MUNICIPALITY_V2_SIGNAL_COLD_VALUE,
      label: `Sem sinal / ${daysLabel}`,
      ageInDays,
      isCold: true,
    }
  }

  if (!input.polarity) {
    return {
      value: MUNICIPALITY_V2_SIGNAL_COLD_VALUE,
      label: 'Sem polaridade',
      ageInDays,
      isCold: false,
    }
  }

  return {
    value: input.polarity,
    label: municipalityUpdatePolarityLabels[input.polarity],
    ageInDays,
    isCold: false,
  }
}

/**
 * Aggregate under the status strip: latest notes from level · trend · update,
 * with absence/age when there is nothing to quote.
 */
export const buildMunicipalityV2StatusAggregate = (
  input: MunicipalityV2StatusNotes,
  now: Date = new Date(),
): string => {
  const levelPart = input.levelNote?.trim()
    ? input.levelNote.trim()
    : input.engagementLevel
      ? `${formatEngagementLevelLabel(input.engagementLevel)} — sem motivo`
      : EMPTY_ENGAGEMENT_LEVEL_LABEL

  const trendPart = input.trendNote?.trim() ? input.trendNote.trim() : 'Tendência sem nota'

  const updateState = resolveMunicipalityV2UpdateState(
    { polarity: input.updatePolarity, lastSignalAt: input.lastSignalAt },
    now,
  )
  const updatePart = input.updateBody?.trim()
    ? input.updateBody.trim()
    : updateState.isCold
      ? updateState.label
      : `${updateState.label} — sem nota`

  return `${levelPart} · ${trendPart} · ${updatePart}`
}
