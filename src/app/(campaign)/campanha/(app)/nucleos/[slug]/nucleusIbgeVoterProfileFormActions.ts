'use server'

import { revalidatePath } from 'next/cache'

import { updateNucleus } from '@/app/(campaign)/campanha/actions/nucleus'
import { requiredRelationshipFormValue } from '@/lib/formData'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  type CampaignFormActionState,
  mapCampaignFormActionError,
} from '@/utilities/campaignFormActionError'
import { toNucleusElectionGeographyInput } from '@/utilities/nucleusElectionGeography'
import {
  getNucleusIbgeVoterProfile,
  IBGE_VOTER_PROFILE_LABEL,
} from '@/utilities/nucleusIbgeVoterProfile'
import { voterProfileNullsToUndefined } from '@/utilities/nucleusIntelligenceUi'

export type AppendIbgeVoterProfileFormState = CampaignFormActionState

const safeMessages = [
  'Somente a coordenação pode editar a inteligência do núcleo.',
  'Não há perfil IBGE disponível para este território.',
  'Já existe um perfil manual com este rótulo.',
] as const

const errorState = (error: unknown): AppendIbgeVoterProfileFormState =>
  mapCampaignFormActionError({
    error,
    safeMessages,
    genericMessage: 'Não foi possível adicionar o perfil IBGE. Tente novamente.',
  })

export const appendIbgeVoterProfileFormAction = async (
  _state: AppendIbgeVoterProfileFormState,
  formData: FormData,
): Promise<AppendIbgeVoterProfileFormState> => {
  try {
    const { payload, actor } = await getCampaignActionContext()
    if (actor.role === 'lideranca') {
      throw new Error('Somente a coordenação pode editar a inteligência do núcleo.')
    }

    const nucleusId = requiredRelationshipFormValue(formData, 'nucleus')
    const nucleus = await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleusId,
      depth: 0,
      user: actor,
      overrideAccess: false,
      select: {
        slug: true,
        cities: true,
        regions: true,
        voterProfiles: {
          label: true,
          ageRange: true,
          incomeBand: true,
          occupation: true,
          localTraits: true,
          notes: true,
        },
      },
    })

    const computed = getNucleusIbgeVoterProfile(toNucleusElectionGeographyInput(nucleus))

    if (computed.status !== 'available') {
      throw new Error('Não há perfil IBGE disponível para este território.')
    }

    const existingProfiles = (nucleus.voterProfiles ?? []).map(voterProfileNullsToUndefined)
    if (existingProfiles.some((profile) => profile.label === IBGE_VOTER_PROFILE_LABEL)) {
      throw new Error('Já existe um perfil manual com este rótulo.')
    }

    const updated = await updateNucleus({
      id: nucleusId,
      voterProfiles: [
        ...existingProfiles,
        {
          label: computed.profile.label,
          ageRange: computed.profile.ageRange,
          localTraits: computed.profile.localTraits,
          notes: computed.profile.notes,
        },
      ],
    })

    revalidatePath(`/campanha/nucleos/${updated.slug}`)
    return { status: 'success', message: 'Perfil IBGE adicionado aos perfis manuais.' }
  } catch (error) {
    return errorState(error)
  }
}
