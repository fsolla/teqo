import type { LucideIcon } from 'lucide-react'

/** Client-safe quick-action row rendered by the B79 drawer strip. */
export type CampaignQuickAction = {
  id: string
  label: string
  icon: LucideIcon
  description: string
  href?: string
  /** Dialog-style actions (no route); the drawer button fires it instead of navigating. */
  onAction?: () => void
}
