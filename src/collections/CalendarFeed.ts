import type { CollectionConfig } from 'payload'

import {
  canCreateCalendarFeed,
  canDeleteCalendarFeed,
  canReadCalendarFeed,
  canSetCalendarFeedSystemField,
  canUpdateCalendarFeed,
} from '@/utilities/campaignAccess'
import { systemStampedActorField } from '@/utilities/campaignAuditFields'

export const CalendarFeed: CollectionConfig = {
  slug: 'calendarFeed',
  labels: {
    singular: 'Feed de calendário',
    plural: 'Feeds de calendário',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'label',
    defaultColumns: [
      'label',
      'filterMunicipality',
      'filterTag',
      'filterDeputyPresent',
      'createdAt',
    ],
  },
  access: {
    create: canCreateCalendarFeed,
    read: canReadCalendarFeed,
    update: canUpdateCalendarFeed,
    delete: canDeleteCalendarFeed,
  },
  fields: [
    {
      name: 'secretSlug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
      },
      access: {
        create: canSetCalendarFeedSystemField,
        read: () => false,
        update: canSetCalendarFeedSystemField,
      },
    },
    {
      name: 'label',
      type: 'text',
      label: 'Nome',
      required: true,
      admin: {
        description: 'Nome descritivo para identificar o feed (ex: "Só deputado presente")',
      },
    },
    {
      name: 'filterMunicipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Filtro: Município',
      admin: {
        description: 'Se vazio, inclui todos os municípios do escopo do criador',
      },
    },
    {
      name: 'filterDeputyPresent',
      type: 'checkbox',
      label: 'Filtro: Deputado presente',
      defaultValue: false,
    },
    {
      name: 'filterTag',
      type: 'text',
      label: 'Filtro: Tag',
      admin: {
        description: 'Se vazio, inclui todas as tags',
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
        create: canSetCalendarFeedSystemField,
        update: canSetCalendarFeedSystemField,
      },
    },
    systemStampedActorField({ required: true, setAccess: canSetCalendarFeedSystemField }),
  ],
}
