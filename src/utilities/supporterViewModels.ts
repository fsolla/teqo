import { territoryForCity } from '@/lib/bahiaTerritories'
import { formatBrazilianPhoneInput } from '@/lib/phone'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import type { CampaignUser, Contact, Municipality, Supporter } from '@/payload-types'
import { isPopulatedRelationship } from '@/utilities/relationship'
import { supporterSourceLabels } from '@/utilities/supporterUi'

export type SupporterListItemViewModel = {
  id: number
  name: string
  phone: string
  city: string | null
  municipalityName: string | null
  municipalitySlug: string | null
  voteIntention: SupporterVoteIntention | null
}

export type SupporterListOverviewViewModel = {
  total: number
  certoAndTende: number
  indeciso: number
}

export type SupporterDetailViewModel = {
  id: number
  name: string
  phone: string
  phoneDisplay: string
  email: string | null
  city: string | null
  territory: string | null
  municipalityName: string | null
  municipalitySlug: string | null
  voteIntention: SupporterVoteIntention | null
  sourceLabel: string
  consentedAt: string | null
  createdByName: string | null
  hasVoteIntentionConsent: boolean
  createdAt: string
}

const contactFromSupporter = (supporter: { contact: Supporter['contact'] }): Contact | null =>
  isPopulatedRelationship<Contact>(supporter.contact) ? supporter.contact : null

const municipalityFromSupporter = (supporter: {
  municipality?: Supporter['municipality']
}): Municipality | null =>
  isPopulatedRelationship<Municipality>(supporter.municipality) ? supporter.municipality : null

export const toSupporterListItemViewModel = (
  supporter: Pick<Supporter, 'id' | 'voteIntention' | 'contact' | 'municipality'>,
): SupporterListItemViewModel => {
  const contact = contactFromSupporter(supporter)
  const municipality = municipalityFromSupporter(supporter)

  return {
    id: supporter.id,
    name: contact?.name ?? 'Contato sem nome',
    phone: contact?.phone ?? '',
    city: contact?.city ?? null,
    municipalityName: municipality?.name ?? null,
    municipalitySlug: municipality?.slug ?? null,
    voteIntention: supporter.voteIntention ?? null,
  }
}

export const toSupporterDetailViewModel = (supporter: Supporter): SupporterDetailViewModel => {
  const contact = contactFromSupporter(supporter)
  const municipality = municipalityFromSupporter(supporter)
  const creator = isPopulatedRelationship<CampaignUser>(supporter.createdBy)
    ? supporter.createdBy
    : null
  const city = contact?.city ?? null
  const phone = contact?.phone ?? ''

  return {
    id: supporter.id,
    name: contact?.name ?? 'Contato sem nome',
    phone,
    phoneDisplay: phone ? formatBrazilianPhoneInput(phone) : '',
    email: contact?.email ?? null,
    city,
    territory: city ? (territoryForCity(city) ?? null) : null,
    municipalityName: municipality?.name ?? null,
    municipalitySlug: municipality?.slug ?? null,
    voteIntention: supporter.voteIntention ?? null,
    sourceLabel: supporterSourceLabels[supporter.source],
    consentedAt: supporter.consentedAt ?? null,
    createdByName: creator?.name ?? null,
    hasVoteIntentionConsent: Boolean(supporter.voteIntentionConsentedAt),
    createdAt: supporter.createdAt,
  }
}

export const parseSupporterId = (value: string): number | null => {
  if (!/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}
