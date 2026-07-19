import type { CollectionConfig } from 'payload'

import { canManageCampaignUsers } from '@/utilities/campaignAccess'

/**
 * Short-lived server-side staging for the supporter CSV import wizard (roadmap
 * C6, Phase 5). The preview stores the full `ok` row set here keyed by an
 * HMAC-signed token; the confirm step redeems the token, consumes the batch,
 * and bulk-inserts. This keeps thousands of rows from crossing the Server
 * Action boundary twice.
 *
 * The collection is hidden from the admin nav and restricted to `geral` /
 * Payload-admin (same policy as `campaignUser` management); the import actions
 * interact with it via the Local API with `overrideAccess: true`. Rows hold
 * transient supporter PII and must be purged on consume or after `expiresAt`
 * (lazy cleanup + sweep).
 */
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
    create: canManageCampaignUsers,
    read: canManageCampaignUsers,
    update: canManageCampaignUsers,
    delete: canManageCampaignUsers,
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
