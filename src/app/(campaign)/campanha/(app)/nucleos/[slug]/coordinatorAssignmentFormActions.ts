'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'

import { assignNucleusCoordinators } from '@/app/(campaign)/campanha/actions/coordinatorAssignment'
import {
  FormDataBoundaryError,
  repeatedRelationshipFormValues,
  validationFieldErrors,
} from '@/lib/formData'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { getEligibleNucleusCoordinatorOptions } from '@/utilities/nucleusCoordinatorOptions'

export type CoordinatorAssignmentFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
}

export type CoordinatorAssignmentOptionsResult = {
  expectedUpdatedAt: string
  options: Array<{ id: number; name: string; isCurrent: boolean }>
}

const knownMessages = new Set([
  'Somente a coordenação geral pode alterar coordenadores.',
  'Núcleo não encontrado ou sem acesso.',
  'A coordenação deste núcleo foi alterada. Atualize a página e tente novamente.',
  'Uma ou mais pessoas selecionadas não são mais elegíveis para coordenação.',
])

const errorState = (error: unknown): CoordinatorAssignmentFormState => {
  if (error instanceof FormDataBoundaryError) {
    return { fieldErrors: { [error.field]: [error.message] } }
  }
  if (error instanceof ZodError) return { fieldErrors: validationFieldErrors(error) }
  if (error instanceof Error && knownMessages.has(error.message)) {
    return { message: error.message }
  }
  return { message: 'Não foi possível salvar a coordenação. Atualize a página e tente novamente.' }
}

export const assignNucleusCoordinatorsFormAction = async (
  slug: string,
  _state: CoordinatorAssignmentFormState,
  formData: FormData,
): Promise<CoordinatorAssignmentFormState> => {
  try {
    const expectedUpdatedAt = formData.get('expectedUpdatedAt')
    if (typeof expectedUpdatedAt !== 'string' || !expectedUpdatedAt) {
      return { message: 'A coordenação deste núcleo foi alterada. Atualize a página e tente novamente.' }
    }
    await assignNucleusCoordinators({
      slug,
      expectedUpdatedAt,
      coordinatorIds: repeatedRelationshipFormValues(formData, 'coordinators'),
    })
    revalidatePath(`/campanha/nucleos/${slug}`)
    revalidatePath('/campanha')
    return { status: 'success', message: 'Coordenação atualizada.' }
  } catch (error) {
    return errorState(error)
  }
}

export const loadCoordinatorAssignmentOptions = async (
  slug: string,
): Promise<CoordinatorAssignmentOptionsResult> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user || user.role !== 'geral') {
    throw new Error('Somente a coordenação geral pode alterar coordenadores.')
  }

  const result = await payload.find({
    collection: 'electoralNucleus',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    select: { updatedAt: true },
    user,
    overrideAccess: false,
  })
  const nucleus = result.docs[0]
  if (!nucleus) throw new Error('Núcleo não encontrado ou sem acesso.')

  return {
    expectedUpdatedAt: nucleus.updatedAt,
    options: await getEligibleNucleusCoordinatorOptions(payload, user),
  }
}
