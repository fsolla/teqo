import 'server-only'

/** Domain hooks create notifications with admin bypass (`overrideAccess: true`). */

import type { PayloadRequest } from 'payload'

import {
  ENABLE_CAMPAIGN_NOTIFICATION_CONTEXT_KEY,
  SKIP_CAMPAIGN_NOTIFICATION_CONTEXT_KEY,
} from '@/lib/notificationContract'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import type { MunicipalityUpdatePolarity } from '@/lib/schemas/municipalityUpdate'
import { municipalityUpdatePolarityLabels } from '@/lib/schemas/municipalityUpdate'
import { createCampaignNotifications } from '@/utilities/notification/createCampaignNotification'
import { resolveMunicipalityStaffRecipientIds } from '@/utilities/notification/notificationRecipients'

export type NotificationEventRequest = Pick<PayloadRequest, 'payload' | 'context' | 'transactionID'>

const shouldSkipCampaignNotification = (context: Record<string, unknown>): boolean => {
  if (context[ENABLE_CAMPAIGN_NOTIFICATION_CONTEXT_KEY]) return false
  if (context[SKIP_CAMPAIGN_NOTIFICATION_CONTEXT_KEY]) return true
  // Int suite shares one Postgres across ~48 workers; hook side-effects (extra
  // rows, coordinator fan-out reads) are tested in campaignNotifications.int.
  return process.env.VITEST === 'true'
}

export const notifyMunicipalityUpdateCreated = async (
  req: NotificationEventRequest,
  doc: {
    id: number
    municipality: unknown
    author: unknown
    polarity: MunicipalityUpdatePolarity
  },
): Promise<void> => {
  if (shouldSkipCampaignNotification(req.context)) return

  const municipalityID = relationshipId(doc.municipality)
  if (!municipalityID) return

  const authorID = relationshipId(doc.author)
  const municipality = await req.payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { name: true, slug: true },
    overrideAccess: true,
    req,
  })

  let authorName = 'Equipe'
  if (authorID) {
    const author = await req.payload.findByID({
      collection: 'campaignUser',
      id: authorID,
      depth: 0,
      select: { name: true },
      overrideAccess: true,
      req,
    })
    authorName = author.name
  }

  const polarityLabel =
    doc.polarity in municipalityUpdatePolarityLabels
      ? municipalityUpdatePolarityLabels[
          doc.polarity as keyof typeof municipalityUpdatePolarityLabels
        ]
      : 'Atualização'

  const recipientIDs = await resolveMunicipalityStaffRecipientIds(
    req.payload,
    municipalityID,
    { excludeUserId: authorID },
    req,
  )

  await createCampaignNotifications(
    req.payload,
    recipientIDs,
    {
      type: 'municipality_update',
      municipalityID,
      payload: {
        title: `${polarityLabel} — ${municipality.name}`,
        detail: `${authorName} registrou uma atualização`,
        href: `/campanha/municipios/${municipality.slug}`,
      },
    },
    req,
  )
}

export const notifySupporterCreated = async (
  req: NotificationEventRequest,
  doc: { municipality: unknown; createdBy?: unknown; contact?: unknown },
): Promise<void> => {
  if (shouldSkipCampaignNotification(req.context)) return

  const municipalityID = relationshipId(doc.municipality)
  if (!municipalityID) return

  const authorID = relationshipId(doc.createdBy)
  const [municipality, contactName] = await Promise.all([
    req.payload.findByID({
      collection: 'municipality',
      id: municipalityID,
      depth: 0,
      select: { name: true, slug: true },
      overrideAccess: true,
      req,
    }),
    loadSupporterContactName(req, doc),
  ])

  const recipientIDs = await resolveMunicipalityStaffRecipientIds(
    req.payload,
    municipalityID,
    { excludeUserId: authorID },
    req,
  )

  await createCampaignNotifications(
    req.payload,
    recipientIDs,
    {
      type: 'new_supporter',
      municipalityID,
      payload: {
        title: `Novo apoiador — ${municipality.name}`,
        detail: contactName ? `${contactName} entrou na base` : 'Novo cadastro na base',
        href: '/campanha/apoiadores',
      },
    },
    req,
  )
}

const loadSupporterContactName = async (
  req: NotificationEventRequest,
  doc: { contact?: unknown },
): Promise<string | null> => {
  const contactID = relationshipId(doc.contact)
  if (!contactID) return null

  const contact = await req.payload.findByID({
    collection: 'contact',
    id: contactID,
    depth: 0,
    select: { name: true },
    overrideAccess: true,
    req,
  })

  return contact.name ?? null
}

export const notifyActivityNeedsAttention = async (
  req: NotificationEventRequest,
  doc: {
    title: string
    slug: string
    municipality: unknown
    advisors?: unknown
  },
): Promise<void> => {
  if (shouldSkipCampaignNotification(req.context)) return

  const municipalityID = relationshipId(doc.municipality)
  if (!municipalityID) return

  const municipality = await req.payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { name: true },
    overrideAccess: true,
    req,
  })

  const advisorIDs = uniqueRelationshipIds(doc.advisors as readonly unknown[] | null | undefined)

  const recipientIDs = [...new Set(advisorIDs)]

  await createCampaignNotifications(
    req.payload,
    recipientIDs,
    {
      type: 'activity_attention',
      municipalityID,
      payload: {
        title: `Atividade precisa de atenção — ${doc.title}`,
        detail: `Em ${municipality.name}`,
        href: `/campanha/atividades/${doc.slug}`,
      },
    },
    req,
  )
}

export const notifyInviteAccepted = async (
  req: NotificationEventRequest,
  leadership: { contact: unknown; municipalities?: unknown },
): Promise<void> => {
  if (shouldSkipCampaignNotification(req.context)) return

  const contactID = relationshipId(leadership.contact)
  const municipalityIDs = uniqueRelationshipIds(
    leadership.municipalities as readonly unknown[] | null | undefined,
  )

  if (municipalityIDs.length === 0) return

  const contact = contactID
    ? await req.payload.findByID({
        collection: 'contact',
        id: contactID,
        depth: 0,
        select: { name: true },
        overrideAccess: true,
        req,
      })
    : null

  const recipientIDs = await resolveMunicipalityStaffRecipientIds(
    req.payload,
    municipalityIDs[0],
    { includeUnrestricted: true },
    req,
  )

  if (recipientIDs.length === 0) return

  const municipality = await req.payload.findByID({
    collection: 'municipality',
    id: municipalityIDs[0],
    depth: 0,
    select: { name: true, slug: true },
    overrideAccess: true,
    req,
  })

  await createCampaignNotifications(
    req.payload,
    recipientIDs,
    {
      type: 'invite_accepted',
      municipalityID: municipalityIDs[0],
      payload: {
        title: `Convite aceito — ${contact?.name ?? 'Nova liderança'}`,
        detail: `Entrou em ${municipality.name}`,
        href: '/campanha/liderancas',
      },
    },
    req,
  )
}
