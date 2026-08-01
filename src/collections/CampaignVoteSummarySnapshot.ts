import type { CollectionConfig } from 'payload'

import { isCampaignStaff, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * Daily statewide snapshot of the B56 hero scalar (`staffVoteTotal` central).
 * B57 reads T−7d for the Início delta; rows are written idempotently on the
 * first staff home load of each Bahia civil day and pruned after 30 days.
 *
 * Hidden from admin nav — staff interact via `loadCampaignHomeSummary`; internal
 * snapshot writes use an intentional admin bypass through the Local API.
 */
export const CampaignVoteSummarySnapshot: CollectionConfig = {
  slug: 'campaignVoteSummarySnapshot',
  labels: {
    singular: 'Snapshot de estimativa',
    plural: 'Snapshots de estimativa',
  },
  admin: {
    group: 'Campanha',
    hidden: () => true,
    useAsTitle: 'day',
    defaultColumns: ['day', 'scopeKey', 'staffVoteTotalCentral'],
  },
  access: {
    create: payloadAdminOnly,
    read: ({ req }) => isCampaignStaff(req.user),
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      name: 'day',
      type: 'date',
      label: 'Dia (Bahia)',
      required: true,
      index: true,
      admin: {
        description: 'Dia civil America/Bahia (`aaaa-mm-dd`), armazenado como meia-noite UTC.',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'scopeKey',
      type: 'text',
      label: 'Escopo',
      required: true,
      defaultValue: 'statewide',
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'staffVoteTotalCentral',
      type: 'number',
      label: 'Total estimado (central)',
      required: true,
      min: 0,
    },
  ],
  indexes: [
    {
      fields: ['day', 'scopeKey'],
      unique: true,
    },
  ],
}
