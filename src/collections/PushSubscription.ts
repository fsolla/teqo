import type { CollectionConfig } from 'payload'

import {
  canDeleteOwnPushSubscriptions,
  canReadOwnPushSubscriptions,
  canWritePushSubscriptions,
} from '@/utilities/campaignAccess'

export const PushSubscription: CollectionConfig = {
  slug: 'pushSubscription',
  labels: {
    singular: 'Inscrição push',
    plural: 'Inscrições push',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'endpoint',
    defaultColumns: ['user', 'endpoint', 'consentedAt', 'createdAt'],
    description: 'Endpoints Web Push por dispositivo. Não armazena dados biométricos.',
  },
  access: {
    create: canWritePushSubscriptions,
    read: canReadOwnPushSubscriptions,
    update: canWritePushSubscriptions,
    delete: canDeleteOwnPushSubscriptions,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Usuário',
      required: true,
      index: true,
    },
    {
      name: 'endpoint',
      type: 'text',
      label: 'Endpoint',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'p256dh',
      type: 'text',
      label: 'Chave p256dh',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'auth',
      type: 'text',
      label: 'Chave auth',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'expirationTime',
      type: 'number',
      label: 'Expiração (ms)',
      admin: { readOnly: true },
    },
    {
      name: 'consent',
      type: 'relationship',
      relationTo: 'consent',
      label: 'Consentimento',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'consentContentHash',
      type: 'text',
      label: 'Hash do conteúdo consentido',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'consentedAt',
      type: 'date',
      label: 'Consentido em',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'User agent',
      admin: { readOnly: true },
    },
  ],
}
