import { redirect } from 'next/navigation'

import { advisorQuickCreateHref } from '@/lib/campaignAdvisorQuickActions'

/** Inline create lives on the assessores list — keep old bookmarks working. */
export default function AdvisorNewRedirectPage() {
  redirect(advisorQuickCreateHref)
}
