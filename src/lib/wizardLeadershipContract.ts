import type { SupportStatus } from '@/lib/schemas/leadership'

/** Client-safe tile payload for the B70 leadership wizard grid. */
export type WizardLeadershipTileViewModel = {
  id: number
  name: string
  /** Every number of the ficha, order = priority (C112). */
  phones: string[]
  phone: string | null
  email: string | null
  supportStatus: SupportStatus | null
  exclusive: boolean
  notes: string | null
}
