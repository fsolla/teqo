import { hasPayloadPanelAccess, isPayloadAdmin, payloadAdminOnly } from '@/utilities/campaignAccess'
import type { Access, CollectionBeforeChangeHook, CollectionConfig, FieldAccess } from 'payload'

const canManageUserRoles: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

/** Panel users may read/update themselves; admins may read/update anyone. */
const canAccessSelfOrAdmin: Access = ({ req, id }) => {
  if (!hasPayloadPanelAccess(req.user)) return false
  if (isPayloadAdmin(req.user)) return true
  return id !== undefined && String(id) === String(req.user.id)
}

/**
 * Defense in depth for Local API self-updates with `overrideAccess: true` —
 * field access already blocks role writes when access is enforced.
 */
const preventSelfServiceRoleEscalation: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !originalDoc || !hasPayloadPanelAccess(req.user)) {
    return data
  }

  if (isPayloadAdmin(req.user)) return data
  if (String(req.user.id) !== String(originalDoc.id)) return data

  if ('roles' in data) delete data.roles

  return data
}

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
  // through /api/users — a privilege-escalation path. Editors may enter the
  // panel and read/update their own account; only admins manage other users.
  access: {
    admin: ({ req }) => hasPayloadPanelAccess(req.user),
    create: payloadAdminOnly,
    read: canAccessSelfOrAdmin,
    update: canAccessSelfOrAdmin,
    delete: payloadAdminOnly,
    unlock: payloadAdminOnly,
  },
  hooks: {
    beforeChange: [preventSelfServiceRoleEscalation],
  },
  fields: [
    {
      name: 'roles',
      type: 'select',
      label: 'Papéis',
      hasMany: true,
      required: true,
      defaultValue: ['admin'],
      saveToJWT: true,
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: {
        create: canManageUserRoles,
        update: canManageUserRoles,
      },
      admin: {
        description:
          'Administrador: acesso total ao painel. Editor: publica notícias/tags/mídia — sem PII nem campanha. Contas novas de comunicação devem ser “Editor”.',
      },
    },
  ],
}
