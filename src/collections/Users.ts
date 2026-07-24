import { isPayloadAdmin, payloadAdminOnly } from '@/utilities/campaignAccess'
import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Usuário',
    plural: 'Usuários',
  },
  admin: {
    group: 'Coleções',
    useAsTitle: 'email',
  },
  auth: true,
  // Admin accounts are managed only by admin accounts. Without this, Payload's
  // "any authenticated user" default would let a campaignUser JWT manage admins
  // through /api/users — a privilege-escalation path.
  access: {
    admin: ({ req }) => isPayloadAdmin(req.user),
    create: payloadAdminOnly,
    read: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
    unlock: payloadAdminOnly,
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
