import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import {
  isContentEventSubjectType,
  isContentEventType,
  type ContentEventSubjectType,
  type ContentEventType,
} from '@/lib/contentEvents'

/**
 * C213 — the single writer of anonymous content events. Both public call sites
 * (the validated beacon route and the media route's `?download=1`) go through
 * here, and this function NEVER throws and never delays its caller: a lost
 * count is acceptable, a visitor-visible error is not (fail-soft).
 *
 * The write is an intentional Local API admin bypass: the collection denies
 * every create through access control, and the gate is the caller's (the
 * published-slug read / the served file). No visitor identifier is ever part of
 * the row.
 */

export type ContentEventInput = {
  type: ContentEventType
  subjectType: ContentEventSubjectType
  subjectId: string
  /**
   * S32 — the optional sub-key of the subject: the state-deputy slug chosen on
   * the card models with a state-deputy picker. A public catalog slug, never a
   * visitor identifier.
   */
  variant?: string | null
}

export const recordContentEvent = async (event: ContentEventInput): Promise<boolean> => {
  if (!isContentEventType(event.type) || !isContentEventSubjectType(event.subjectType)) {
    return false
  }

  try {
    const payload = await getPayload({ config })
    await payload.create({
      collection: 'contentEvent',
      data: {
        type: event.type,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        variant: event.variant ?? null,
      },
      // Intentional admin bypass: the caller already resolved the public gate
      // (a published piece / a served file); `create` is denied by design.
      overrideAccess: true,
    })
    return true
  } catch (error) {
    // No PII to redact: the event carries the subject key only.
    console.warn('[contentEvent] falha ao registrar evento anônimo', {
      type: event.type,
      subjectType: event.subjectType,
      error,
    })
    return false
  }
}
