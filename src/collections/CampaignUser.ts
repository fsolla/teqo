import type { CampaignUser as CampaignUserDocument } from '@/payload-types'
import {
  canCreateCampaignUserPhone,
  canManageCampaignUserRole,
  canManageCampaignUsers,
  canReadCampaignUserIdentity,
  canReadCampaignUserPhone,
  canReadCampaignUsers,
  canUpdateCampaignUser,
  canUpdateCampaignUserAvatar,
  canUpdateCampaignUserPhone,
} from '@/utilities/campaignAccess'
import { buildCampaignPasswordResetUrl } from '@/utilities/campaignPasswordReset'
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

const preventAssignedAdvisorDowngrade: CollectionBeforeChangeHook<CampaignUserDocument> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (
    operation !== 'update' ||
    !originalDoc ||
    data.role !== 'leader' ||
    originalDoc.role === 'leader'
  ) {
    return data
  }

  const assignedPlaza = await req.payload.find({
    collection: 'plaza',
    where: {
      advisors: { contains: originalDoc.id },
    },
    depth: 0,
    limit: 1,
    select: { name: true },
    overrideAccess: true,
    req,
  })

  if (assignedPlaza.totalDocs > 0) {
    throw new APIError(
      'Remova ou substitua este usuário da assessoria de todas as Praças antes de alterar o papel para liderança.',
      409,
    )
  }

  return data
}

const preventSelfServicePrivilegedFields: CollectionBeforeChangeHook<
  CampaignUserDocument
> = async ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update' || !originalDoc || req.user?.collection !== 'campaignUser') {
    return data
  }

  if (String(req.user.id) !== String(originalDoc.id)) return data

  for (const field of ['role', 'name', 'email', 'username', 'phone'] as const) {
    if (field in data) delete data[field]
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
    forgotPassword: {
      generateEmailSubject: () => 'Redefinir sua senha — Campanha Jorge Solla',
      generateEmailHTML: (args) => {
        const token = args?.token
        const user = args?.user
        if (!token) {
          throw new Error('Password reset token is required to generate email HTML.')
        }
        const resetPasswordURL = buildCampaignPasswordResetUrl(token)
        const greeting = user?.email ? `Olá, ${user.email}` : 'Olá'

        return `
          <!doctype html>
          <html lang="pt-BR">
            <body style="font-family: sans-serif; line-height: 1.5; color: #111827;">
              <p>${greeting}</p>
              <p>Recebemos um pedido para redefinir a senha da sua conta na ferramenta de campanha.</p>
              <p>
                <a href="${resetPasswordURL}">Redefinir senha</a>
              </p>
              <p>Se você não solicitou esta alteração, ignore este e-mail.</p>
              <p style="font-size: 12px; color: #6b7280;">${resetPasswordURL}</p>
            </body>
          </html>
        `
      },
    },
  },
  access: {
    create: canManageCampaignUsers,
    read: canReadCampaignUsers,
    update: canUpdateCampaignUser,
    delete: canManageCampaignUsers,
  },
  hooks: {
    beforeChange: [preventAssignedAdvisorDowngrade, preventSelfServicePrivilegedFields],
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
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'Foto de perfil',
      access: {
        read: () => true,
        update: canUpdateCampaignUserAvatar,
      },
    },
    {
      name: 'role',
      type: 'select',
      label: 'Papel',
      required: true,
      defaultValue: 'leader',
      saveToJWT: true,
      options: [
        { label: 'Coordenador Geral', value: 'coordinator' },
        { label: 'Assessor', value: 'advisor' },
        { label: 'Liderança', value: 'leader' },
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
        update: canManageCampaignUserRole,
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
        update: canManageCampaignUserRole,
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
