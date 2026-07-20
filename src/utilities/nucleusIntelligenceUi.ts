import { nucleusUpdateSchema, type NucleusUpdateInput } from '@/lib/schemas/nucleus'
import {
  boundedJsonFormValue,
  checkboxFormValue,
  nullableFormText,
  nullableRelationshipFormValue,
  requiredRelationshipFormValue,
} from '@/lib/formData'

export type VoterProfileWriteInput = {
  label: string
  ageRange?: string | null
  incomeBand?: string | null
  occupation?: string | null
  localTraits?: string | null
  notes?: string | null
}

export type VoterProfileWriteShape = {
  label: string
  ageRange?: string
  incomeBand?: string
  occupation?: string
  localTraits?: string
  notes?: string
}

export const voterProfileNullsToUndefined = (
  profile: VoterProfileWriteInput,
): VoterProfileWriteShape => ({
  label: profile.label,
  ageRange: profile.ageRange ?? undefined,
  incomeBand: profile.incomeBand ?? undefined,
  occupation: profile.occupation ?? undefined,
  localTraits: profile.localTraits ?? undefined,
  notes: profile.notes ?? undefined,
})

export const normalizedVoterProfilesForWrite = (
  profiles: VoterProfileWriteInput[],
): VoterProfileWriteShape[] =>
  profiles
    .map((profile) => ({
      label: profile.label.trim(),
      ageRange: profile.ageRange?.trim() || undefined,
      incomeBand: profile.incomeBand?.trim() || undefined,
      occupation: profile.occupation?.trim() || undefined,
      localTraits: profile.localTraits?.trim() || undefined,
      notes: profile.notes?.trim() || undefined,
    }))
    .filter(({ label }) => Boolean(label))

export const parseNucleusIntelligenceFormData = (formData: FormData): NucleusUpdateInput => {
  const hasTicketAlliance = ['partnerName', 'office', 'isCampaignPartner', 'allianceNotes'].some(
    (field) => formData.has(field),
  )
  const hasStrategyNotes = ['dobradinhaNotes', 'nextSteps'].some((field) => formData.has(field))

  return nucleusUpdateSchema.parse({
    id: requiredRelationshipFormValue(formData, 'nucleus'),
    strengths: boundedJsonFormValue(formData, 'strengths', 100_000),
    risks: boundedJsonFormValue(formData, 'risks', 100_000),
    voterProfiles: boundedJsonFormValue(formData, 'voterProfiles', 100_000),
    primaryContact: nullableRelationshipFormValue(formData, 'primaryContact'),
    ...(hasStrategyNotes
      ? {
          dobradinhaNotes: nullableFormText(formData, 'dobradinhaNotes'),
          nextSteps: nullableFormText(formData, 'nextSteps'),
        }
      : {}),
    ticketAlliance: hasTicketAlliance
      ? {
          partnerName: nullableFormText(formData, 'partnerName'),
          office: nullableFormText(formData, 'office'),
          isCampaignPartner: checkboxFormValue(formData, 'isCampaignPartner'),
          notes: nullableFormText(formData, 'allianceNotes'),
        }
      : undefined,
  })
}
