import { redirect } from 'next/navigation'

/** Inline create lives on the assessors list — keep old bookmarks working. */
export default function AdvisorNewRedirectPage() {
  redirect('/campanha/assessores')
}
