import { createHash } from 'node:crypto'

import { normalizeMunicipalityKey } from '@/lib/electionResults'

/** Same NFD/case fold as municipality keys; empty string for missing parts. */
export const normalizeIdentityPart = (value: string | null | undefined): string =>
  normalizeMunicipalityKey(value ?? '')

export type IdentityKeyInput = {
  urnaName: string | null | undefined
  birthCity: string | null | undefined
  birthState: string | null | undefined
  party: string | null | undefined
}

/**
 * identityKey = sha256(normalize(urnaName) + birthCity + birthState + party)
 * Collisions (homonyms) and false negatives (party change) are expected;
 * admin review sets runningAgain2026 before relying on the match.
 */
export const computeIdentityKey = (input: IdentityKeyInput): string => {
  const material = [
    normalizeIdentityPart(input.urnaName),
    normalizeIdentityPart(input.birthCity),
    normalizeIdentityPart(input.birthState),
    normalizeIdentityPart(input.party),
  ].join('|')

  return createHash('sha256').update(material, 'utf8').digest('hex')
}
