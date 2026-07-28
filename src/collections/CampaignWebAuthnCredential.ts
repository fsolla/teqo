import type { CollectionConfig } from 'payload'

import { CAMPAIGN_WEBAUTHN_DEVICE_LABEL_MAX_LENGTH } from '@/lib/campaignWebAuthn'
import {
  canDeleteOwnWebAuthnCredentials,
  canReadOwnWebAuthnCredentials,
  canWriteWebAuthnCredentials,
} from '@/utilities/campaignAccess'

/**
 * A passkey enrolled on one device for one `campaignUser` (roadmap B40). Only
 * the credential's public half is stored — the private key never leaves the
 * device's secure element and the fingerprint/face template never leaves the
 * OS, which is why biometric login opens no LGPD art. 11 question and needs no
 * `Consent` key.
 *
 * Writes happen exclusively inside the verified `/campanha/webauthn/*`
 * ceremonies with `overrideAccess: true`; reads and deletes are the owner's
 * only (see `utilities/access/webauthnCredentials.ts`).
 */
export const CampaignWebAuthnCredential: CollectionConfig = {
  slug: 'campaignWebAuthnCredential',
  labels: {
    singular: 'Acesso por biometria',
    plural: 'Acessos por biometria',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'deviceLabel',
    defaultColumns: ['deviceLabel', 'user', 'lastUsedAt', 'createdAt'],
    description:
      'Chaves públicas dos aparelhos que entram com digital ou Face ID. Nenhum dado biométrico é armazenado.',
  },
  access: {
    create: canWriteWebAuthnCredentials,
    read: canReadOwnWebAuthnCredentials,
    update: canWriteWebAuthnCredentials,
    delete: canDeleteOwnWebAuthnCredentials,
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
      name: 'credentialId',
      type: 'text',
      label: 'ID da credencial',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'publicKey',
      type: 'text',
      label: 'Chave pública (base64url)',
      required: true,
      admin: { readOnly: true },
    },
    {
      /**
       * Authenticator signature counter. A response whose counter did not
       * advance past the stored one is a replay (or a cloned authenticator),
       * and the ceremony refuses it.
       */
      name: 'counter',
      type: 'number',
      label: 'Contador de assinaturas',
      required: true,
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'transports',
      type: 'json',
      label: 'Transportes',
      admin: { readOnly: true },
    },
    {
      name: 'deviceLabel',
      type: 'text',
      label: 'Aparelho',
      required: true,
      maxLength: CAMPAIGN_WEBAUTHN_DEVICE_LABEL_MAX_LENGTH,
    },
    {
      name: 'lastUsedAt',
      type: 'date',
      label: 'Último uso',
      admin: { readOnly: true },
    },
  ],
}
