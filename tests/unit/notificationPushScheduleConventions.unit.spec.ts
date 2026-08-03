import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Pass 5 P1: notification push must not be scheduled with `queueMicrotask` while
// the create still rides `req.transactionID` — microtasks flush before
// `withPayloadTransaction` commits. The create module must route txn-bound
// sends through `onPayloadTransactionCommit`.
describe('notification push schedule (Pass 5 P1)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/utilities/notification/createCampaignNotification.ts'),
    'utf8',
  )

  it('registers push on withPayloadTransaction commit when a transactionID is present', () => {
    expect(source).toMatch(/onPayloadTransactionCommit\s*\(/)
    expect(source).toMatch(/req\?\.transactionID/)
  })

  it('does not schedule sendCampaignPush via queueMicrotask unconditionally', () => {
    // Unconditional microtask around send was the P1 bug. A microtask only on
    // the no-transaction branch remains allowed; the send call must not appear
    // as the sole queueMicrotask body without a transactionID guard above it.
    expect(source).not.toMatch(
      /queueMicrotask\s*\(\s*\(\)\s*=>\s*\{\s*void sendCampaignPushForNotification/,
    )
  })
})
