import { NextResponse } from 'next/server'

import { setMunicipalityEngagementLevel } from '@/app/(campaign)/campanha/actions/municipality'
import { EngagementLevelBlockedError } from '@/lib/engagementLevel'
import {
  MUNICIPALITY_ENGAGEMENT_LEVEL_UNRESTRICTED_MESSAGE,
  municipalityEngagementLevelSchema,
} from '@/lib/schemas/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { MunicipalityListEngagementLevelResponse } from './types'

export type { MunicipalityListEngagementLevelResponse } from './types'

export const dynamic = 'force-dynamic'

/** JSON body uses `municipalityId`; the action schema uses `municipality`. */
const bodySchema = municipalityEngagementLevelSchema
  .omit({ municipality: true })
  .extend({ municipalityId: positiveRelationshipId })

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    // Only the unrestricted-actor message: this action reloads the actor with
    // its own guard, never through `getFreshStaffActor` (same as `advisors/`).
    safeMessages: [MUNICIPALITY_ENGAGEMENT_LEVEL_UNRESTRICTED_MESSAGE],
    genericMessage: 'Não foi possível registrar o nível. Verifique seu acesso e tente novamente.',
  },
  async ({ municipalityId, ...movement }) => {
    // A blocked movement is the third state, not a failure: it is caught here
    // so the shared error mapping never sees it and never has to know about it.
    try {
      const updated = await setMunicipalityEngagementLevel({
        municipality: municipalityId,
        ...movement,
      })

      // Echoes the document, never the request: with `overrideAccess: false`
      // Payload drops a field the actor cannot write instead of refusing the
      // update, so reporting the requested level could claim a movement that
      // never landed. A movement always sets a level, so a document without one
      // IS that dropped write — it fails rather than falling back to the
      // request, which would be the lie this comment forbids.
      // Not a safe message: the mapping answers with this route's
      // `genericMessage`, and the internal text stays in the server log.
      if (!updated.engagementLevel) throw new Error('Engagement level write was dropped.')

      return NextResponse.json<MunicipalityListEngagementLevelResponse>({
        status: 'success',
        message: 'Nível de envolvimento registrado.',
        savedLevel: {
          level: updated.engagementLevel,
          note: updated.levelNote ?? null,
          changedAt: updated.levelChangedAt ?? null,
        },
      })
    } catch (error) {
      if (error instanceof EngagementLevelBlockedError) {
        return NextResponse.json<MunicipalityListEngagementLevelResponse>(
          { status: 'blocked', message: error.message, violations: error.violations },
          { status: 409 },
        )
      }

      throw error
    }
  },
)
