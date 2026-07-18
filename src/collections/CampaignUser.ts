import type { CampaignUser as CampaignUserDocument } from '@/payload-types'
import {
  canCreateCampaignUserPhone,
  canManageCampaignUsers,
  canManageCampaignUserRole,
  canReadCampaignUserIdentity,
  canReadCampaignUserPhone,
  canReadCampaignUsers,
  canUpdateCampaignUserPhone,
} from '@/utilities/campaignAccess'
import { normalizeBrazilianPhone } from '@/utilities/phone'
import {
  APIError,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
} from 'payload'

const removePrivateAuthFields: CollectionAfterReadHook<CampaignUserDocument> = async ({
  doc,
  req,
}) => {
  const user = req.user

  if (!user || user.collection === 'users' || String(user.id) === String(doc.id)) {
    return doc
  }

  const privateDoc = doc as unknown as Record<string, unknown>
  delete privateDoc.email
  delete privateDoc.username
  delete privateDoc.sessions
  delete privateDoc.salt
  delete privateDoc.hash
  delete privateDoc.resetPasswordToken
  delete privateDoc.resetPasswordExpiration

  return doc
}

const preventAssignedCoordinatorDowngrade: CollectionBeforeChangeHook<CampaignUserDocument> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (
    operation !== 'update' ||
    !originalDoc ||
    data.role !== 'lideranca' ||
    originalDoc.role === 'lideranca'
  ) {
    return data
  }

  const assignedNucleus = await req.payload.find({
    collection: 'electoralNucleus',
    where: {
      coordinators: { contains: originalDoc.id },
    },
    depth: 0,
    limit: 1,
    select: { name: true, status: true },
    overrideAccess: true,
    req,
  })

  if (assignedNucleus.totalDocs > 0) {
    throw new APIError(
      'Remova ou substitua este usuário da coordenação de todos os núcleos antes de alterar o papel para liderança.',
      409,
    )
  }

  return data
}

export const CampaignUser: CollectionConfig = {
  slug: 'campaignUser',
  labels: {
    singular: 'Usuário',
    plural: 'Usuários',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'name',
  },
  auth: {
    loginWithUsername: {
      allowEmailLogin: true,
      requireEmail: false,
      requireUsername: false,
    },
  },
  access: {
    create: canManageCampaignUsers,
    read: canReadCampaignUsers,
    update: canManageCampaignUsers,
    delete: canManageCampaignUsers,
  },
  hooks: {
    beforeChange: [preventAssignedCoordinatorDowngrade],
    afterRead: [removePrivateAuthFields],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Papel',
      required: true,
      defaultValue: 'lideranca',
      saveToJWT: true,
      options: [
        { label: 'Coordenação geral', value: 'geral' },
        { label: 'Coordenador', value: 'coordenador' },
        { label: 'Liderança', value: 'lideranca' },
      ],
      access: {
        update: canManageCampaignUserRole,
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'E-mail',
      unique: true,
      index: true,
      access: {
        read: canReadCampaignUserIdentity,
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Celular de contato',
      index: true,
      access: {
        create: canCreateCampaignUserPhone,
        read: canReadCampaignUserPhone,
        update: canUpdateCampaignUserPhone,
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (typeof value !== 'string' || value.length === 0) return value

            return normalizeBrazilianPhone(value) ?? value
          },
        ],
      },
      validate: (value: unknown) => {
        if (value === undefined || value === null || value === '') return true

        return normalizeBrazilianPhone(String(value)) ? true : 'Informe um celular válido com DDD.'
      },
    },
    {
      name: 'username',
      type: 'text',
      label: 'Celular de acesso',
      unique: true,
      index: true,
      access: {
        read: canReadCampaignUserIdentity,
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (typeof value !== 'string' || value.length === 0) return value

            return normalizeBrazilianPhone(value) ?? value
          },
        ],
      },
      validate: (value: unknown) => {
        if (value === undefined || value === null || value === '') return true

        return normalizeBrazilianPhone(String(value)) ? true : 'Informe um celular válido com DDD.'
      },
    },
  ],
}
