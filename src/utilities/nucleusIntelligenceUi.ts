import { nucleusUpdateSchema, type NucleusUpdateInput } from '@/lib/schemas/nucleus'
import {
  boundedJsonFormValue,
  checkboxFormValue,
  nullableFormText,
  nullableRelationshipFormValue,
  requiredRelationshipFormValue,
} from '@/lib/formData'

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
