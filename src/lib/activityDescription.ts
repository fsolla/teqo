/**
 * Shared description parts for campaign activities — the iCal feed and the
 * C114 Google mirror render the same facts (municipality, locality, tags,
 * deputy flag) with their own consumers' separators/escapes. No PII: no
 * leadership names, phones or emails.
 */
import type { Activity } from '@/payload-types'

export type ActivityDescriptionSource = Pick<Activity, 'locality' | 'tags' | 'deputyPresent'>

export const buildActivityDescriptionParts = (
  activity: ActivityDescriptionSource,
  municipalityName?: string,
): string[] => {
  const parts: string[] = []
  if (municipalityName) parts.push(`Município: ${municipalityName}`)
  if (activity.locality) parts.push(`Local: ${activity.locality}`)
  if (activity.tags?.length) parts.push(`Tags: ${activity.tags.join(', ')}`)
  if (activity.deputyPresent) parts.push('Deputado presente')
  return parts
}
