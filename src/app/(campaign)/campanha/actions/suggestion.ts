'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import {
  SUGGESTION_STALE_MESSAGE,
  suggestionDecisionSchema,
  type SuggestionDecisionInput,
} from '@/lib/schemas/suggestion'
import {
  getSuggestionPattern,
  isSuggestionSuppressedByDecision,
  SUGGESTION_TEXT_MAX_LENGTH,
  suggestionPostponeDays,
} from '@/lib/suggestionCatalog'
import { DAY_MS } from '@/lib/text'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import type { AllocationDecision, CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { CAMPAIGN_STAFF_QUADRO_PATH } from '@/utilities/campaignPageActor'
import { loadMunicipalitySuggestions } from '@/utilities/municipality/municipalityTriggers'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

type ResolvedSuggestion = {
  decision: AllocationDecision
  municipalitySlug: string
  /** Set on `adiada` — how long the suggestion snoozes. */
  postponeDays: number | null
}

/**
 * E11 — record the human decision about one triggered pattern as an
 * `allocationDecision` (C12). The pattern is RE-EVALUATED server-side so the
 * snapshot records the factors as they are at decision time, never as the
 * client rendered them; a pattern that no longer fires refuses with a stale
 * message instead of recording a decision about a queue that moved.
 */
export const resolveSuggestionRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: SuggestionDecisionInput,
): Promise<ResolvedSuggestion> => {
  const data = suggestionDecisionSchema.parse(input)
  const now = new Date()

  // Evaluation reads the actor's scope (`overrideAccess: false` throughout),
  // so a município the actor cannot read yields "stale", never a decision.
  const bundle = await loadMunicipalitySuggestions(payload, actor, {
    municipalityID: data.municipality,
    now,
  })
  const triggered = bundle.suggestions.find((suggestion) => suggestion.patternId === data.patternId)
  if (!triggered) throw new Error(SUGGESTION_STALE_MESSAGE)

  const pattern = getSuggestionPattern(data.patternId)
  const postponeDays =
    data.outcome === 'adiada' ? suggestionPostponeDays(triggered.triageLevel) : null
  const suppressUntil =
    postponeDays === null ? null : new Date(now.getTime() + postponeDays * DAY_MS).toISOString()

  const chosenAction = data.chosenActionId
    ? (pattern.menu.find((action) => action.id === data.chosenActionId) ?? null)
    : null
  const note = data.note?.trim()
  const composedRationale =
    data.outcome === 'aceita'
      ? `${chosenAction?.label ?? 'Ação do menu'}${note ? ` — ${note}` : ''}`
      : data.outcome === 'adiada'
        ? `Adiada por ${postponeDays} dias.${note ? ` ${note}` : ''}`
        : (note ?? 'Descartada — leitura alternativa registrada.')
  // The note alone may already be at the cap the collection enforces, so the
  // composed prefix (menu label / postpone sentence) can push past it — and a
  // rejected create would read as a generic error no retry could fix. The
  // prefix carries the decision; only a maximal note loses its tail.
  const rationale = composedRationale.slice(0, SUGGESTION_TEXT_MAX_LENGTH)

  const decision = await withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      // Lock BEFORE re-reading the latest decision: two staff resolving the
      // same card at once must serialize, or both record "the" decision.
      await acquireTextAdvisoryLocks(payload, req, [
        `municipality-suggestion:${data.municipality}:${data.patternId}`,
      ])

      const latest = await payload.find({
        collection: 'allocationDecision',
        where: {
          and: [
            { municipality: { equals: data.municipality } },
            { patternId: { equals: data.patternId } },
          ],
        },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        select: { outcome: true, snapshot: true, createdAt: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })
      const existing = latest.docs[0]
      if (existing && isSuggestionSuppressedByDecision(existing, triggered, now)) {
        throw new Error(SUGGESTION_STALE_MESSAGE)
      }

      return payload.create({
        collection: 'allocationDecision',
        data: {
          municipality: data.municipality,
          patternId: data.patternId,
          outcome: data.outcome,
          rationale,
          ...(data.outcome === 'descarta' ? { alternativeReading: data.alternativeReading } : {}),
          snapshot: {
            triageLevel: triggered.triageLevel,
            factors: triggered.factors,
            metrics: triggered.metrics,
            scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
            ...(chosenAction ? { chosenActionId: chosenAction.id } : {}),
            ...(postponeDays !== null ? { postponeDays, suppressUntil } : {}),
          },
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro da decisão.' },
  )

  return { decision, municipalitySlug: triggered.municipalitySlug, postponeDays }
}

export const resolveSuggestion = async (
  input: SuggestionDecisionInput,
): Promise<{ postponeDays: number | null }> => {
  const { payload, actor } = await getCampaignActionContext()
  const { municipalitySlug, postponeDays } = await resolveSuggestionRecord(payload, actor, input)

  // The two surfaces that render the queue: the staff dashboard panel and the
  // município detail card.
  revalidatePath(CAMPAIGN_STAFF_QUADRO_PATH)
  revalidatePath(`/campanha/municipios/${municipalitySlug}`)

  return { postponeDays }
}
