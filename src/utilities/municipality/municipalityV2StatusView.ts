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
  municipalitySignalTypeLabels,
  type MunicipalitySignalType,
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
  lastSignalType: MunicipalitySignalType | null
  lastSignalBody: string | null
  territorialClass: MunicipalityTerritorialClassification
}

/** Sentinel select value when the município is cold / has no typed signal. */
export const MUNICIPALITY_V2_SIGNAL_COLD_VALUE = '__cold__'

export type MunicipalityV2StatusNotes = {
  levelNote: string | null
  trendNote: string | null
  signalBody: string | null
  signalType: MunicipalitySignalType | null
  lastSignalAt: string | null
  engagementLevel: EngagementLevel | null
}

export type MunicipalityV2SignalSelectState = {
  /** Current `<select>` value — signal type or cold sentinel. */
  value: MunicipalitySignalType | typeof MUNICIPALITY_V2_SIGNAL_COLD_VALUE
  /** Short label for the control (and cold readout). */
  label: string
  ageInDays: number | null
  isCold: boolean
}

/**
 * Product assumption (intention open Q): cold → sentinel “Sem sinal / frio”
 * in the strip; age lives in aggregate/tooltip.
 */
export const resolveMunicipalityV2SignalSelectState = (
  input: {
    signalType: MunicipalitySignalType | null
    lastSignalAt: string | null
  },
  now: Date = new Date(),
): MunicipalityV2SignalSelectState => {
  const ageInDays = municipalitySignalAgeInDays(input.lastSignalAt, now)
  const isCold = isMunicipalitySignalCold(ageInDays)

  if (isCold || !input.signalType) {
    const daysLabel =
      ageInDays === null ? `frio (≥${MUNICIPALITY_COLD_SIGNAL_DAYS} d)` : `frio (${ageInDays} d)`
    return {
      value: MUNICIPALITY_V2_SIGNAL_COLD_VALUE,
      label: `Sem sinal / ${daysLabel}`,
      ageInDays,
      isCold: true,
    }
  }

  return {
    value: input.signalType,
    label: municipalitySignalTypeLabels[input.signalType],
    ageInDays,
    isCold: false,
  }
}

/**
 * Aggregate under the status strip: latest notes from level · trend · signal,
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

  const signalState = resolveMunicipalityV2SignalSelectState(input, now)
  const signalPart = input.signalBody?.trim()
    ? input.signalBody.trim()
    : signalState.isCold
      ? signalState.label
      : `${signalState.label} — sem nota`

  return `${levelPart} · ${trendPart} · ${signalPart}`
}
