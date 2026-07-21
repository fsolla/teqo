import { territoryForCity } from '@/lib/bahiaTerritories'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import type { CampaignUser, Contact, Plaza, Supporter } from '@/payload-types'
import { formatBrazilianPhoneInput } from '@/utilities/phone'
import { isPopulatedRelationship } from '@/utilities/relationship'
import { supporterSourceLabels } from '@/utilities/supporterUi'

export type SupporterListItemViewModel = {
  id: number
  name: string
  phone: string
  city: string | null
  plazaName: string | null
  plazaSlug: string | null
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
  plazaName: string | null
  plazaSlug: string | null
  voteIntention: SupporterVoteIntention | null
  sourceLabel: string
  consentedAt: string | null
  createdByName: string | null
  hasVoteIntentionConsent: boolean
  createdAt: string
}

const contactFromSupporter = (supporter: { contact: Supporter['contact'] }): Contact | null =>
  isPopulatedRelationship<Contact>(supporter.contact) ? supporter.contact : null

const plazaFromSupporter = (supporter: { plaza?: Supporter['plaza'] }): Plaza | null =>
  isPopulatedRelationship<Plaza>(supporter.plaza) ? supporter.plaza : null

export const toSupporterListItemViewModel = (
  supporter: Pick<Supporter, 'id' | 'voteIntention' | 'contact' | 'plaza'>,
): SupporterListItemViewModel => {
  const contact = contactFromSupporter(supporter)
  const plaza = plazaFromSupporter(supporter)

  return {
    id: supporter.id,
    name: contact?.name ?? 'Contato sem nome',
    phone: contact?.phone ?? '',
    city: contact?.city ?? null,
    plazaName: plaza?.name ?? null,
    plazaSlug: plaza?.slug ?? null,
    voteIntention: supporter.voteIntention ?? null,
  }
}

export const toSupporterDetailViewModel = (supporter: Supporter): SupporterDetailViewModel => {
  const contact = contactFromSupporter(supporter)
  const plaza = plazaFromSupporter(supporter)
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
    plazaName: plaza?.name ?? null,
    plazaSlug: plaza?.slug ?? null,
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
