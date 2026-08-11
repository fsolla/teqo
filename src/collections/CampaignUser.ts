import { CAMPAIGN_SESSION_TTL_LONG } from '@/lib/campaignSessionTtl'
import { normalizeBrazilianPhone } from '@/lib/phone'
import { relationshipId } from '@/lib/relationship'
import { isPlanilhaPlaceholderEmail } from '@/lib/schemas/advisor'
import type { CampaignUser as CampaignUserDocument } from '@/payload-types'
import {
  canCreateCampaignUserPhone,
  canManageCampaignUserRole,
  canManageCampaignUsers,
  canReadCampaignUserIdentity,
  canReadCampaignUserPhone,
  canReadCampaignUsers,
  canSetCampaignSystemField,
  canUpdateCampaignUser,
  canUpdateCampaignUserAvatar,
  canUpdateCampaignUserPhone,
} from '@/utilities/campaignAccess'
import { buildCampaignPasswordResetUrl } from '@/utilities/campaignPasswordReset'
import { findOrCreateContactByPhone } from '@/utilities/contactIdentity'
import {
  APIError,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type Payload,
  type PayloadRequest,
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

  // Intentional admin bypass: the downgrade guard must see every relation the
  // account is assigned to, regardless of the actor's read scope.
  const assignments = await Promise.all([
    req.payload.find({
      collection: 'municipality',
      where: { advisors: { contains: originalDoc.id } },
      depth: 0,
      limit: 1,
      select: { slug: true },
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'stateDeputy',
      where: { advisors: { contains: originalDoc.id } },
      depth: 0,
      limit: 1,
      select: { slug: true },
      // Same justified bypass as the municipality probe above.
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'leadership',
      where: { advisors: { contains: originalDoc.id } },
      depth: 0,
      limit: 1,
      select: { contact: true },
      // Same justified bypass as the probes above.
      overrideAccess: true,
      req,
    }),
  ])

  if (assignments.some((result) => result.totalDocs > 0)) {
    throw new APIError(
      'Remova ou substitua este usuário da assessoria de municípios, dobradinhas ou lideranças antes de alterar o papel para liderança.',
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

  for (const field of ['role', 'name', 'email', 'username', 'phone', 'contact'] as const) {
    if (field in data) delete data[field]
  }

  return data
}
/**
 * Resolves the `Contact` ficha for an account that has none yet: by phone
 * (find-or-create, same dedupe policy as the supporter flows) or a fresh
 * name-only ficha when there is no phone. Multiple accounts may share one
 * ficha — a person with two roles (liderança + assessora) keeps two accounts
 * but ONE ficha, which is exactly the C100 dedupe.
 */
const resolveContactForAccount = async ({
  payload,
  req,
  name,
  email,
  phone,
}: {
  payload: Payload
  req: PayloadRequest
  name: string
  email?: string | null
  phone?: string | null
}): Promise<number> => {
  const { contactID } = await findOrCreateContactByPhone({
    payload,
    req,
    phone: typeof phone === 'string' && phone.length > 0 ? phone : null,
    name,
    email: email && !isPlanilhaPlaceholderEmail(email) ? email : null,
  })
  return contactID
}

/**
 * C99 — every staff account points at ONE normalized `Contact` ficha, without
 * asking for the person's data twice (admin UI and the inline advisor flows
 * only collect account fields). An explicit `data.contact` (different from the
 * linked ficha) always wins — the hook only fills the gap. On updates of a
 * linked account, identity changes (name/e-mail/phone) are synced one-way
 * account → ficha so the C100 list reads fresh data; a phone already used by
 * another ficha is shared, not rejected (C111 — the phone is a contact
 * channel; the account's `username` keeps the login key unique).
 *
 * Runs AFTER `preventSelfServicePrivilegedFields` on purpose: the strip
 * deletes the merged identity fields (including `contact`) for self-service,
 * so by the time this hook sees them they look "explicitly different" — which
 * is what keeps self-service edits from ever writing the ficha.
 */
const ensureCampaignUserContactIdentity: CollectionBeforeChangeHook<CampaignUserDocument> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  // Unauthenticated updates are the password-reset token flow
  // (`payload.forgotPassword` runs its `update` with `overrideAccess` and no
  // `req.user`): it must never create or rewrite a LGPD-relevant `Contact`
  // row, and a ficha phone conflict must not be able to block password
  // recovery. Every real identity write is authenticated (admin REST token or
  // a server action passing `user`); the invite redemption passes `contact`
  // explicitly, so skipping the hook there changes nothing.
  if (!req.user && operation === 'update') return data

  // Payload's field `beforeValidate` merges the original document into the
  // incoming data, so "explicitly provided" is "different from the linked
  // ficha", never "key present".
  if (operation === 'create') {
    if (data.contact !== undefined) return data
    data.contact = await resolveContactForAccount({
      payload: req.payload,
      req,
      name: data.name ?? '',
      email: data.email ?? null,
      phone: data.phone ?? null,
    })
    return data
  }

  if (data.contact !== originalDoc?.contact) return data

  const linkedContactID = relationshipId(originalDoc?.contact)

  if (linkedContactID !== null) {
    const contactData: { name?: string; email?: string | null; phone?: string } = {}

    if (data.name !== undefined && data.name !== originalDoc?.name) {
      contactData.name = data.name
    }
    if (data.email !== undefined && data.email !== originalDoc?.email) {
      if (data.email === null || !isPlanilhaPlaceholderEmail(data.email)) {
        contactData.email = data.email
      }
    }
    // Clearing the account's phone never clears the ficha's: the ficha's
    // phone is the person's dedupe key across every join (supporter,
    // leadership, dobradinha), and the account edit is not a ficha edit.
    if (
      typeof data.phone === 'string' &&
      data.phone.length > 0 &&
      data.phone !== originalDoc?.phone
    ) {
      contactData.phone = data.phone
    }

    if (Object.keys(contactData).length === 0) return data

    await req.payload.update({
      collection: 'contact',
      id: linkedContactID,
      data: contactData,
      depth: 0,
      // Intentional admin bypass: the account operation is already authorized;
      // the ficha write is scoped by the account link and may share the phone
      // with other fichas (C111).
      overrideAccess: true,
      req,
    })
    return data
  }

  data.contact = await resolveContactForAccount({
    payload: req.payload,
    req,
    name: data.name ?? originalDoc?.name ?? '',
    email: data.email ?? originalDoc?.email ?? null,
    phone: data.phone ?? originalDoc?.phone ?? null,
  })
  return data
}

/**
 * Revokes the account's passkeys (roadmap B40) before it is deleted. This is a
 * hook rather than an `ON DELETE cascade` because Payload derives FK actions
 * from the field config, so a hand-written cascade in the migration is drift the
 * next `migrate:create` reverts. `campaign_web_authn_credential.user_id` is NOT
 * NULL with `ON DELETE set null`, so without this the delete fails and the
 * account becomes undeletable the moment it enrolled a passkey. Note that the
 * test fixtures rely on it too: `campaignWebAuthnCredential` is the one
 * collection with no `owned` entry, because `deleteOwned('campaignUser')`
 * reaches it through here.
 */
const deleteCampaignUserPasskeys: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'campaignWebAuthnCredential',
    where: { user: { equals: id } },
    overrideAccess: true,
    req,
  })
}

const deleteCampaignUserNotifications: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'notification',
    where: { recipient: { equals: id } },
    overrideAccess: true,
    req,
  })
  await req.payload.delete({
    collection: 'pushSubscription',
    where: { user: { equals: id } },
    overrideAccess: true,
    req,
  })
}

/**
 * Staged CSV-import batches authored by the deleted account must go BEFORE the
 * account: `supporter_import_batch.actor_id` is NOT NULL with an `ON DELETE
 * set null` FK (C6 schema drift — the column and the FK action disagree), so
 * without this the delete fails with a not-null violation whenever the account
 * left an unconsumed batch (10-minute window, no sweep). Same pattern as the
 * passkey/notification cascade above; `deletePersonRecord` spells the same
 * cleanup by hand.
 */
const deleteCampaignUserImportBatches: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'supporterImportBatch',
    where: { actor: { equals: id } },
    depth: 0,
    // Intentional bypass: the account deletion itself is the authorization;
    // the batches are transient staging rows owned by the deleted account
    // (same cascade contract as the passkey/notification deletes above).
    overrideAccess: true,
    req,
  })
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
    tokenExpiration: CAMPAIGN_SESSION_TTL_LONG,
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
    beforeChange: [
      preventAssignedAdvisorDowngrade,
      preventSelfServicePrivilegedFields,
      ensureCampaignUserContactIdentity,
    ],
    beforeDelete: [
      deleteCampaignUserPasskeys,
      deleteCampaignUserNotifications,
      deleteCampaignUserImportBatches,
    ],
    afterRead: [removePrivateAuthFields],
  },
  fields: [
    {
      name: 'contact',
      type: 'relationship',
      relationTo: 'contact',
      label: 'Ficha de contato',
      index: true,
      access: {
        read: canReadCampaignUserIdentity,
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
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
        { label: 'Candidato', value: 'candidate' },
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
