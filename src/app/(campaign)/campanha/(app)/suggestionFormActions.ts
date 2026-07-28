'use server'

import { resolveSuggestion } from '@/app/(campaign)/campanha/actions/suggestion'
import {
  FormDataBoundaryError,
  optionalFormText,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { SUGGESTION_OUTCOMES, SUGGESTION_STALE_MESSAGE } from '@/lib/schemas/suggestion'
import { suggestionPatternIds } from '@/lib/suggestionCatalog'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

/**
 * E11 — accept / postpone / dismiss one suggestion card. Lives at the `(app)`
 * segment root because the SAME card renders on the two staff surfaces
 * (dashboard panel and município detail); zod inside `resolveSuggestion` owns
 * the real validation, the boundary only narrows the enum strings.
 */
export const resolveSuggestionFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const patternIdRaw = requiredFormText(formData, 'patternId')
      const patternId = suggestionPatternIds.find((id) => id === patternIdRaw)
      if (!patternId) throw new FormDataBoundaryError('patternId', 'Padrão desconhecido.')
      const outcomeRaw = requiredFormText(formData, 'outcome')
      const outcome = SUGGESTION_OUTCOMES.find((value) => value === outcomeRaw)
      if (!outcome) throw new FormDataBoundaryError('outcome', 'Decisão desconhecida.')

      const { postponeDays } = await resolveSuggestion({
        municipality: requiredRelationshipFormValue(formData, 'municipality'),
        patternId,
        outcome,
        chosenActionId: optionalFormText(formData, 'chosenActionId'),
        note: optionalFormText(formData, 'note'),
        alternativeReading: optionalFormText(formData, 'alternativeReading'),
      })
      const message =
        outcome === 'aceita'
          ? 'Decisão registrada.'
          : outcome === 'adiada'
            ? `Sugestão adiada por ${postponeDays ?? 7} dias.`
            : 'Sugestão descartada — leitura alternativa registrada.'
      return { message }
    },
    safeMessages: [SUGGESTION_STALE_MESSAGE],
    genericMessage: 'Não foi possível registrar a decisão. Tente novamente.',
  })
