import 'server-only'

/** Trusted server writes in this module use admin bypass (`overrideAccess: true`). */

import type { NotificationPayload, NotificationType } from '@/lib/notificationContract'
import type { Notification } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'

import { sendCampaignPushForNotification } from '@/utilities/notification/sendCampaignPush'
import { onPayloadTransactionCommit } from '@/utilities/payloadTransaction'

export type NotificationWriteRequest = Pick<PayloadRequest, 'transactionID'>

type CreateCampaignNotificationInput = {
  recipientID: number
  type: NotificationType
  payload: NotificationPayload
  municipalityID?: number | null
}

const scheduleCampaignNotificationPush = (
  payload: Payload,
  notificationID: number,
  req?: NotificationWriteRequest,
): void => {
  const run = (): void => {
    void sendCampaignPushForNotification(payload, notificationID)
  }

  // Pass 5 P1: never `queueMicrotask` under an open transaction — microtasks
  // flush before `withPayloadTransaction` reaches `commitTransaction`.
  const transactionID = req?.transactionID
  if (typeof transactionID === 'string' || typeof transactionID === 'number') {
    onPayloadTransactionCommit(transactionID, run)
    return
  }

  queueMicrotask(run)
}

const createCampaignNotification = async (
  payload: Payload,
  input: CreateCampaignNotificationInput,
  req?: NotificationWriteRequest,
): Promise<Notification> => {
  const notification = await payload.create({
    collection: 'notification',
    data: {
      recipient: input.recipientID,
      type: input.type,
      payload: input.payload,
      municipality: input.municipalityID ?? undefined,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })

  scheduleCampaignNotificationPush(payload, notification.id, req)

  return notification
}

export const createCampaignNotifications = async (
  payload: Payload,
  recipientIDs: number[],
  input: Omit<CreateCampaignNotificationInput, 'recipientID'>,
  req?: NotificationWriteRequest,
): Promise<void> => {
  const candidates = [...new Set(recipientIDs)].filter((id) => Number.isFinite(id))
  if (candidates.length === 0) return

  // A resolved recipient can be concurrently deleted (a staff member removed
  // from a município's `advisors`, or a parallel writer's cleanup) between the
  // recipient resolution and this insert. Inserting for a stale id aborts the
  // WHOLE host transaction with an FK violation — observed crashing
  // `notifyMunicipalityUpdateCreated` under the parallel e2e suite (OPS83 run
  // #16) and the same hazard exists in production when an advisor is removed
  // while a notification fan-out is in flight. Re-validate existence before
  // the fan-out so a vanished recipient is skipped, never a transaction kill.
  const existing = await payload.find({
    collection: 'campaignUser',
    where: { id: { in: candidates } },
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const existingIDs = new Set(existing.docs.map((doc) => doc.id))
  const recipients = candidates.filter((id) => existingIDs.has(id))
  if (recipients.length === 0) return

  await Promise.all(
    recipients.map((recipientID) =>
      createCampaignNotification(
        payload,
        {
          recipientID,
          type: input.type,
          payload: input.payload,
          municipalityID: input.municipalityID,
        },
        req,
      ),
    ),
  )
}
