import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { CampaignInviteKind } from '@/utilities/campaignInvite'
import { hashCampaignInviteToken } from '@/utilities/campaignInvite'
import { drizzleResultRows } from '@/utilities/drizzleBulk'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import {
  acquireTextAdvisoryLocks,
  getPostgresTransactionDatabase,
} from '@/utilities/postgresTransactionLocks'

export const INVALID_CAMPAIGN_INVITE_MESSAGE = 'Convite inválido ou expirado.'

export const requireCampaignInvitePostgres = (payload: Pick<Payload, 'db'>): void => {
  if (payload.db.name !== 'postgres') {
    throw new Error('O domínio de convites exige o adaptador PostgreSQL.')
  }
}

export const revokePriorActiveCampaignInvites = async (
  payload: Payload,
  req: PayloadTransactionRequest,
  leadershipID: number,
  kind: CampaignInviteKind,
): Promise<void> => {
  await acquireTextAdvisoryLocks(payload, req, [`invite-creation:${leadershipID}:${kind}`])
  const database = await getPostgresTransactionDatabase(payload, req)
  await database.execute(sql`
    UPDATE "campaign_invite"
    SET "revoked_at" = now(), "updated_at" = now()
    WHERE "leadership_id" = ${leadershipID}
      AND "kind" = ${kind}
      AND "used_at" IS NULL
      AND "revoked_at" IS NULL
      AND "expires_at" > now()
  `)
}

export const createCampaignInviteRecord = (
  payload: Payload,
  req: PayloadTransactionRequest,
  data: {
    tokenHash: string
    leadershipID: number
    kind: CampaignInviteKind
    expiresAt: string
    createdBy: number
  },
) =>
  payload.create({
    collection: 'campaignInvite',
    data: {
      tokenHash: data.tokenHash,
      leadership: data.leadershipID,
      kind: data.kind,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })

export const consumeCampaignInvite = async (
  payload: Payload,
  req: PayloadTransactionRequest,
  token: string,
  kind: CampaignInviteKind,
): Promise<number> => {
  const database = await getPostgresTransactionDatabase(payload, req)
  const result = await database.execute(sql`
    UPDATE "campaign_invite"
    SET "used_at" = now(), "updated_at" = now()
    WHERE "token_hash" = ${hashCampaignInviteToken(token)}
      AND "kind" = ${kind}
      AND "used_at" IS NULL
      AND "revoked_at" IS NULL
      AND "expires_at" > now()
    RETURNING "leadership_id"
  `)
  const leadershipID = drizzleResultRows(result)[0]?.leadership_id
  if (typeof leadershipID !== 'number') throw new Error(INVALID_CAMPAIGN_INVITE_MESSAGE)
  return leadershipID
}

export const findActiveCampaignInvite = async (payload: Payload, token: string) => {
  const result = await payload.find({
    collection: 'campaignInvite',
    where: {
      and: [
        { tokenHash: { equals: hashCampaignInviteToken(token) } },
        { usedAt: { exists: false } },
        { revokedAt: { exists: false } },
        { expiresAt: { greater_than: new Date().toISOString() } },
      ],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { kind: true, leadership: true },
    overrideAccess: true,
  })
  return result.docs[0]
}

export const findSameContactAccountIDs = async (
  payload: Payload,
  req: PayloadTransactionRequest,
  contactID: number,
): Promise<number[]> => {
  const database = await getPostgresTransactionDatabase(payload, req)
  const result = await database.execute(sql`
    SELECT DISTINCT "user_id"
    FROM "leadership"
    WHERE "contact_id" = ${contactID}
      AND "user_id" IS NOT NULL
    LIMIT 2
  `)
  return drizzleResultRows(result)
    .map((row) => row.user_id)
    .filter((value): value is number => typeof value === 'number')
}

export const acquireCampaignInviteRedemptionContactLock = (
  payload: Payload,
  req: PayloadTransactionRequest,
  contactID: number,
): Promise<void> =>
  acquireTextAdvisoryLocks(payload, req, [`invite-redemption-contact:${contactID}`])

export const acquireCampaignInviteAccountLocks = (
  payload: Payload,
  req: PayloadTransactionRequest,
  keys: string[],
): Promise<void> => acquireTextAdvisoryLocks(payload, req, keys)
