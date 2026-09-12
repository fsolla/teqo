import type { CollectionConfig } from 'payload'

import {
  canCreateGoogleCalendarSync,
  canDeleteGoogleCalendarSync,
  canReadGoogleCalendarSync,
  canReadGoogleCalendarSyncIdentityField,
  canSetGoogleCalendarSyncConfigField,
  canSetGoogleCalendarSyncDisabled,
  canSetGoogleCalendarSyncSystemField,
  canUpdateGoogleCalendarSync,
} from '@/utilities/access/googleCalendarSync'
import { googleCalendarSyncConfigHook } from '@/utilities/googleCalendarSyncHooks'

/**
 * C114 — configuration and state of the campaign→Google calendar mirror
 * (one row in practice, created/edited by Payload admin in ops). The service
 * account private key never lives here — it is `GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY`
 * in the environment. Changing `calendarId` (or re-enabling) re-runs the full
 * reconciliation automatically via `googleCalendarSyncConfigHook` (D7).
 *
 * C149 — the same row also holds the OAuth connection (refresh token + state)
 * created by the "Conectar com o Google" button. The refresh token is
 * system-only and unreadable by every user path (`read: false`), exactly like
 * the push-channel secret; the engine reads it with the admin bypass. The
 * service account remains the fallback while no OAuth connection exists.
 */
export const GoogleCalendarSync: CollectionConfig = {
  slug: 'googleCalendarSync',
  labels: {
    singular: 'Sincronização Google Agenda',
    plural: 'Sincronização Google Agenda',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'calendarId',
    defaultColumns: [
      'calendarId',
      'lastSyncedAt',
      'lastSuccessAt',
      'lastError',
      'pushChannelExpiresAt',
    ],
  },
  access: {
    create: canCreateGoogleCalendarSync,
    read: canReadGoogleCalendarSync,
    update: canUpdateGoogleCalendarSync,
    delete: canDeleteGoogleCalendarSync,
  },
  hooks: {
    afterChange: [googleCalendarSyncConfigHook],
  },
  fields: [
    {
      name: 'calendarId',
      type: 'text',
      label: 'ID do calendário (Google)',
      index: true,
      access: {
        create: canSetGoogleCalendarSyncConfigField,
        update: canSetGoogleCalendarSyncConfigField,
      },
      admin: {
        description:
          'O calendarId do calendário "Agenda da Campanha" na conta Google da campanha (ex.: c_…@group.calendar.google.com). O calendário precisa estar público no link e a service account com permissão de edição.',
      },
    },
    {
      name: 'oauthRefreshToken',
      type: 'text',
      label: 'Token de atualização (OAuth)',
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        read: canReadGoogleCalendarSyncIdentityField,
        update: canSetGoogleCalendarSyncSystemField,
      },
      admin: {
        readOnly: true,
        description:
          'Credencial da conexão OAuth com a conta Google da campanha. Preenchida pelo callback do botão "Conectar com o Google"; nunca é exibida.',
      },
    },
    {
      name: 'oauthScope',
      type: 'text',
      label: 'Escopos concedidos (OAuth)',
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
      admin: {
        readOnly: true,
        description: 'Escopos que o Google devolveu na conexão (diagnóstico).',
      },
    },
    {
      name: 'oauthConnectedAt',
      type: 'date',
      label: 'Conta Google conectada em',
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
      admin: { readOnly: true },
    },
    {
      name: 'oauthErrorAt',
      type: 'date',
      label: 'Último erro de conexão (OAuth)',
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
      admin: { readOnly: true },
    },
    {
      name: 'oauthError',
      type: 'textarea',
      label: 'Mensagem do último erro de conexão (OAuth)',
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
      admin: { readOnly: true },
    },
    {
      name: 'disabledAt',
      type: 'date',
      label: 'Desativado em',
      index: true,
      access: {
        create: canSetGoogleCalendarSyncDisabled,
        update: canSetGoogleCalendarSyncDisabled,
      },
      admin: {
        readOnly: true,
        description: 'Enquanto preenchido, o Teqo não escreve no Google.',
      },
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      label: 'Última sincronização',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'lastSuccessAt',
      type: 'date',
      label: 'Última sincronização com sucesso',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'lastErrorAt',
      type: 'date',
      label: 'Último erro',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'lastError',
      type: 'textarea',
      label: 'Mensagem do último erro',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'pushChannelId',
      type: 'text',
      label: 'ID do canal de notificação (Google)',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        read: canReadGoogleCalendarSyncIdentityField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'pushChannelResourceId',
      type: 'text',
      label: 'Resource ID do canal (Google)',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        read: canReadGoogleCalendarSyncIdentityField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'pushChannelExpiresAt',
      type: 'date',
      label: 'Canal de notificação expira em',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'pushChannelSecret',
      type: 'text',
      label: 'Segredo do webhook (URL)',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        read: canReadGoogleCalendarSyncIdentityField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'pushChannelError',
      type: 'textarea',
      label: 'Erro do canal de notificação',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
    {
      name: 'lastSeenEventIds',
      type: 'json',
      label: 'Eventos vistos na última sincronização',
      admin: { readOnly: true },
      access: {
        create: canSetGoogleCalendarSyncSystemField,
        update: canSetGoogleCalendarSyncSystemField,
      },
    },
  ],
}
