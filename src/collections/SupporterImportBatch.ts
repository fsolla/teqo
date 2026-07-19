import type { Access, CollectionConfig } from 'payload'

import { getFreshCampaignUser, isCampaignGeneral, isPayloadAdmin } from '@/utilities/campaignAccess'

/**
 * Short-lived server-side staging for the supporter CSV import wizard (roadmap
 * C6, Phase 5). The preview stores the full `ok` row set here keyed by an
 * HMAC-signed token; the confirm step redeems the token, consumes the batch,
 * and bulk-inserts. This keeps thousands of rows from crossing the Server
 * Action boundary twice.
 *
 * The collection is hidden from the admin nav and restricted to `geral` /
 * Payload-admin; the import actions interact with it via the Local API with
 * `overrideAccess: true`. Rows hold transient supporter PII and must be
 * purged on consume or after `expiresAt` (lazy cleanup + sweep).
 */
const canAccessImportBatch: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  const fresh = await getFreshCampaignUser(req)
  return isCampaignGeneral(fresh)
}

export const SupporterImportBatch: CollectionConfig = {
  slug: 'supporterImportBatch',
  labels: {
    singular: 'Lote de importação',
    plural: 'Lotes de importação',
  },
  admin: {
    group: 'Campanha',
    hidden: () => true,
    useAsTitle: 'batchId',
    defaultColumns: ['batchId', 'actor', 'expiresAt'],
  },
  access: {
    create: canAccessImportBatch,
    read: canAccessImportBatch,
    update: canAccessImportBatch,
    delete: canAccessImportBatch,
  },
  fields: [
    {
      name: 'batchId',
      type: 'text',
      label: 'ID do lote',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Operador',
      required: true,
      index: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Expira em',
      required: true,
      index: true,
    },
    {
      name: 'rows',
      type: 'json',
      label: 'Linhas válidas',
      required: true,
    },
  ],
}
