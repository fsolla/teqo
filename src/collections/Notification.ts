import type { CollectionConfig } from 'payload'

import { notificationTypeLabels, notificationTypes } from '@/lib/notificationContract'
import {
  canDeleteOwnNotifications,
  canReadOwnNotifications,
  canWriteNotifications,
} from '@/utilities/campaignAccess'

const NOTIFICATION_TYPE_OPTIONS = notificationTypes.map((value) => ({
  label: notificationTypeLabels[value],
  value,
}))

export const Notification: CollectionConfig = {
  slug: 'notification',
  labels: {
    singular: 'Notificação',
    plural: 'Notificações',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'type',
    defaultColumns: ['recipient', 'type', 'readAt', 'createdAt'],
    description: 'Avisos in-app e push da campanha. Cada linha pertence a um destinatário.',
  },
  access: {
    create: canWriteNotifications,
    read: canReadOwnNotifications,
    update: canWriteNotifications,
    delete: canDeleteOwnNotifications,
  },
  fields: [
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Destinatário',
      required: true,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      label: 'Tipo',
      required: true,
      index: true,
      options: NOTIFICATION_TYPE_OPTIONS,
    },
    {
      name: 'payload',
      type: 'json',
      label: 'Conteúdo',
      required: true,
      admin: {
        description: 'Título, detalhe e href exibidos no sino e no push.',
      },
    },
    {
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Município',
      index: true,
    },
    {
      name: 'readAt',
      type: 'date',
      label: 'Lida em',
      index: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
}
