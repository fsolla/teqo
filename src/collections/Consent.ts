import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { APIError, type CollectionBeforeDeleteHook, type CollectionConfig } from 'payload'

/**
 * Block deleting a Consent that is still referenced by a versioned legal-text
 * consumer. The DB uses `ON DELETE SET NULL` FKs, but several consumers store
 * the consent as NOT NULL (subscription, signature, pushSubscription) — deleting
 * would trip a 23502 — while others (petition, leadership, supporter) null the
 * column silently and corrupt the audit link. Either way the text is still in
 * use, so we refuse the delete up front with an actionable message instead of a
 * raw 500. The counts run with an INTENTIONAL access bypass (`overrideAccess`):
 * Consent read is admin-only and the hook must see every reference to decide
 * whether to block — mirrors the before-delete guards in CampaignUser /
 * personDelete.
 */
const blockConsentDeletionWithReferences: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const [
    subscriptions,
    signatures,
    pushSubscriptions,
    petitions,
    leaderships,
    supporters,
    voteSupporters,
  ] = await Promise.all([
    req.payload.count({
      collection: 'subscription',
      where: { consent: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'signature',
      where: { consent: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'pushSubscription',
      where: { consent: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'petition',
      where: { 'form.consent': { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'leadership',
      where: { consent: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'supporter',
      where: { consent: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'supporter',
      where: { voteIntentionConsent: { equals: id } },
      overrideAccess: true,
      req,
    }),
  ])

  const references: Array<[number, string]> = [
    [subscriptions.totalDocs, 'inscrições'],
    [signatures.totalDocs, 'assinaturas'],
    [pushSubscriptions.totalDocs, 'inscrições push'],
    [petitions.totalDocs, 'petições'],
    [leaderships.totalDocs, 'lideranças'],
    [supporters.totalDocs, 'apoiadores'],
    [voteSupporters.totalDocs, 'apoiadores (intenção de voto)'],
  ]
  const used = references.filter(([count]) => count > 0)
  if (used.length === 0) return

  const detail = used.map(([count, label]) => `${count} ${label}`).join(', ')
  throw new APIError(`Consentimento em uso — não é possível excluir (${detail}).`, 409)
}

export const Consent: CollectionConfig = {
  slug: 'consent',
  labels: {
    singular: 'Consentimento',
    plural: 'Consentimentos',
  },
  admin: {
    group: 'Contatos',
    useAsTitle: 'text',
  },
  // Versioned legal texts referenced by signatures/subscriptions/supporters.
  // Server flows resolve them via the Local API without a user; only admins
  // may create or alter them.
  access: {
    create: payloadAdminOnly,
    read: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    beforeDelete: [blockConsentDeletionWithReferences],
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      label: 'Chave estável',
      required: false,
      unique: true,
      index: true,
      admin: {
        description: 'Identificador estável para referências no código.',
      },
    },
    {
      name: 'text',
      type: 'richText',
      label: 'Texto',
      required: true,
    },
  ],
}
