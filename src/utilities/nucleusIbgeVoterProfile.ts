import {
  demographicsForMunicipalityName,
  type MunicipalityAgeBandKey,
} from '@/lib/bahiaMunicipalityDemographics'
import {
  resolveNucleusTerritoryCities,
  type NucleusTerritoryCitiesInput,
} from '@/utilities/nucleusTerritoryCities'

export const IBGE_VOTER_PROFILE_LABEL = 'Perfil médio do território'

export type ComputedVoterProfileViewModel = {
  label: string
  ageRange: string
  localTraits: string
  notes: string
}

export type NucleusIbgeVoterProfileResult =
  | { status: 'available'; profile: ComputedVoterProfileViewModel }
  | { status: 'semPerfil' }

const AGE_BAND_LABELS: Record<MunicipalityAgeBandKey, string> = {
  '0-17': '0 a 17 anos',
  '18-29': '18 a 29 anos',
  '30-59': '30 a 59 anos',
  '60+': '60 anos ou mais',
}

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const formatPercent = (value: number) => percentFormatter.format(value)

const formatInteger = (value: number) => integerFormatter.format(value)

const buildSummaryLine = ({
  dominantBand,
  dominantSharePercent,
  medianAge,
  sexShareFemalePercent,
}: {
  dominantBand: MunicipalityAgeBandKey
  dominantSharePercent: number
  medianAge: number | null
  sexShareFemalePercent: number
}) => {
  const medianText =
    medianAge == null
      ? 'idade mediana indisponível'
      : `idade mediana de ${formatInteger(medianAge)} anos`
  return `Predominam moradores na faixa de ${AGE_BAND_LABELS[dominantBand]} (${formatPercent(dominantSharePercent)}%). ${medianText.charAt(0).toUpperCase()}${medianText.slice(1)}; ${formatPercent(sexShareFemalePercent)}% mulheres.`
}

export const getNucleusIbgeVoterProfile = (
  input: NucleusTerritoryCitiesInput,
): NucleusIbgeVoterProfileResult => {
  const effectiveCities = resolveNucleusTerritoryCities(input)
  if (effectiveCities.length === 0) return { status: 'semPerfil' }

  const ageBands: Record<MunicipalityAgeBandKey, number> = {
    '0-17': 0,
    '18-29': 0,
    '30-59': 0,
    '60+': 0,
  }
  let population = 0
  let femalePopulation = 0
  let medianAgeWeighted = 0
  let medianAgeWeight = 0

  for (const city of effectiveCities) {
    const record = demographicsForMunicipalityName(city)
    if (!record) continue

    population += record.population
    femalePopulation += record.population * record.sexShareFemale
    for (const band of Object.keys(ageBands) as MunicipalityAgeBandKey[]) {
      ageBands[band] += record.ageBands[band]
    }
    if (record.medianAge != null) {
      medianAgeWeighted += record.medianAge * record.population
      medianAgeWeight += record.population
    }
  }

  if (population <= 0) return { status: 'semPerfil' }

  const ageBandShares = {} as Record<MunicipalityAgeBandKey, number>
  for (const band of Object.keys(ageBands) as MunicipalityAgeBandKey[]) {
    ageBandShares[band] = (ageBands[band] / population) * 100
  }

  const dominantBand = (Object.keys(ageBandShares) as MunicipalityAgeBandKey[]).reduce(
    (best, band) => (ageBandShares[band] > ageBandShares[best] ? band : best),
    '0-17' as MunicipalityAgeBandKey,
  )
  const sexShareFemalePercent = (femalePopulation / population) * 100
  const medianAge = medianAgeWeight > 0 ? medianAgeWeighted / medianAgeWeight : null

  const ageRange = (Object.keys(AGE_BAND_LABELS) as MunicipalityAgeBandKey[])
    .map((band) => `${AGE_BAND_LABELS[band]}: ${formatPercent(ageBandShares[band])}%`)
    .join(' · ')

  const notes = `População residente estimada: ${formatInteger(population)} habitantes (Censo 2022, média ponderada de ${effectiveCities.length} município${effectiveCities.length === 1 ? '' : 's'}).`

  return {
    status: 'available',
    profile: {
      label: IBGE_VOTER_PROFILE_LABEL,
      ageRange,
      localTraits: buildSummaryLine({
        dominantBand,
        dominantSharePercent: ageBandShares[dominantBand],
        medianAge,
        sexShareFemalePercent,
      }),
      notes,
    },
  }
}
