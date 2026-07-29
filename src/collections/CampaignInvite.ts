import type { CollectionConfig } from 'payload'

import {
  canCreateCampaignInvite,
  canMutateCampaignInvite,
  canReadCampaignInvite,
  canSetCampaignInviteSystemField,
} from '@/utilities/campaignAccess'
import { systemStampedActorField } from '@/utilities/campaignAuditFields'
import { campaignInviteExpiry } from '@/utilities/campaignInvite'

export const CampaignInvite: CollectionConfig = {
  slug: 'campaignInvite',
  labels: {
    singular: 'Convite',
    plural: 'Convites',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'leadership',
    defaultColumns: ['leadership', 'kind', 'expiresAt', 'usedAt', 'revokedAt', 'createdAt'],
  },
  access: {
    create: canCreateCampaignInvite,
    read: canReadCampaignInvite,
    update: canMutateCampaignInvite,
    delete: canMutateCampaignInvite,
  },
  indexes: [
    {
      fields: ['leadership', 'kind'],
    },
  ],
  fields: [
    {
      name: 'tokenHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
      },
      access: {
        create: canSetCampaignInviteSystemField,
        read: () => false,
        update: canSetCampaignInviteSystemField,
      },
    },
    {
      name: 'leadership',
      type: 'relationship',
      relationTo: 'leadership',
      label: 'Liderança',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Tipo',
      required: true,
      index: true,
      options: [
        { label: 'Acesso ao app', value: 'login' },
        { label: 'Completar cadastro', value: 'autopreenchimento' },
      ],
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Expira em',
      required: true,
      index: true,
      defaultValue: () => campaignInviteExpiry().toISOString(),
      access: {
        create: canSetCampaignInviteSystemField,
        update: canSetCampaignInviteSystemField,
      },
    },
    {
      name: 'usedAt',
      type: 'date',
      label: 'Usado em',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignInviteSystemField,
        update: canSetCampaignInviteSystemField,
      },
    },
    {
      name: 'revokedAt',
      type: 'date',
      label: 'Revogado em',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignInviteSystemField,
        update: canSetCampaignInviteSystemField,
      },
    },
    systemStampedActorField({ required: true, setAccess: canSetCampaignInviteSystemField }),
  ],
}
