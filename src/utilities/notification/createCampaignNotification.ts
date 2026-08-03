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
  const uniqueRecipients = [...new Set(recipientIDs)]
  if (uniqueRecipients.length === 0) return

  await Promise.all(
    uniqueRecipients.map((recipientID) =>
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
