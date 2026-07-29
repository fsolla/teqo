import 'server-only'

import type { CollectionBeforeChangeHook, Field, FieldAccess } from 'payload'

/**
 * The system-stamped actor field and its stamping hook (Pass 3 P3-I): the
 * `createdBy` relationship + readOnly + canSet*SystemField shape was spelled
 * near-verbatim in 7 collections and drifted organically (Supporter/Leadership
 * gained a `read:` override, CampaignInvite is `required`). The field is DATA
 * — name, label, which access policy, whether staff reads it — so the factory
 * takes those and nothing else. The convention guard in
 * `codebaseConventions.unit.spec.ts` fails the build on a hand-spelled actor
 * field outside this module.
 */
export const systemStampedActorField = ({
  name = 'createdBy',
  label = 'Criado por',
  required = false,
  indexed = true,
  readAccess,
  setAccess,
}: {
  /** `decidedBy`/`declaredBy` variants rename it; the default covers `createdBy`. */
  name?: string
  label?: string
  /** CampaignInvite is the one required actor field. */
  required?: boolean
  /** VotePledge's `declaredBy` was born unindexed — keep it that way (no migration). */
  indexed?: boolean
  /** Staff-readable actor attribution (Supporter/Leadership); absent elsewhere. */
  readAccess?: FieldAccess
  /** The domain's system-field policy (`canSet*SystemField`). */
  setAccess: FieldAccess
}): Field => ({
  name,
  type: 'relationship',
  relationTo: 'campaignUser',
  label,
  ...(required ? { required: true } : {}),
  ...(indexed ? { index: true } : {}),
  admin: {
    readOnly: true,
  },
  access: {
    create: setAccess,
    ...(readAccess ? { read: readAccess } : {}),
    update: setAccess,
  },
})

/**
 * Stamps `createdBy` from the acting campaign user on create. Usable directly
 * as the beforeChange hook (the stamp-only collections) or called inline from
 * a hook that does more than stamp.
 */
export const stampCampaignCreatedBy: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'create' && req.user?.collection === 'campaignUser') {
    data.createdBy = req.user.id
  }
  return data
}
