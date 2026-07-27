import type { SupportStatus } from '@/lib/schemas/leadership'

export type LeadershipListSupportStatusResponse =
  | { status: 'success'; message: string; savedSupportStatus: SupportStatus }
  | { status: 'error'; message: string }
