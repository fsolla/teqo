'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import { ZodError } from 'zod'

import {
  archiveNucleus,
  createNucleus,
  updateNucleus,
} from '@/app/(campaign)/campanha/actions/nucleus'
import type { NucleusFormState } from '@/components/campaign/NucleusForm'
import {
  FormDataBoundaryError,
  optionalFormText,
  requiredRelationshipFormValue,
  validationFieldErrors,
} from '@/lib/formData'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  parseNucleusCreateFormData,
  parseNucleusUpdateFormData,
} from '@/utilities/nucleusFormData'
import { slugify } from '@/utilities/slug'

const getActionError = (error: unknown): NucleusFormState => {
  if (error instanceof FormDataBoundaryError) {
    return { fieldErrors: { [error.field]: [error.message] } }
  }
  if (error instanceof ZodError) {
    return { fieldErrors: validationFieldErrors(error) }
  }

  return { message: 'Não foi possível concluir a ação. Atualize a página e tente novamente.' }
}

const existingNucleusState = async (formData: FormData): Promise<NucleusFormState | null> => {
  const name = optionalFormText(formData, 'name')
  const slug = name ? slugify(name) : ''
  if (!slug) return null
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user || user.role !== 'geral') return null
  const result = await payload.find({
    collection: 'electoralNucleus',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { slug: true },
    user,
    overrideAccess: false,
  })
  const existing = result.docs[0]
  return existing
    ? {
        fieldErrors: { name: ['Já existe um núcleo com este nome.'] },
        existingHref: `/campanha/nucleos/${existing.slug}`,
        submittedName: name,
      }
    : null
}

export const createNucleusFormAction = async (
  _state: NucleusFormState,
  formData: FormData,
): Promise<NucleusFormState> => {
  let nucleusSlug: string

  try {
    const nucleus = await createNucleus(parseNucleusCreateFormData(formData))
    nucleusSlug = nucleus.slug
  } catch (error) {
    const existing = await existingNucleusState(formData)
    if (existing) return existing
    return getActionError(error)
  }

  redirect(`/campanha/nucleos/${nucleusSlug}`)
}

export const updateNucleusFormAction = async (
  _state: NucleusFormState,
  formData: FormData,
): Promise<NucleusFormState> => {
  let nucleusSlug: string

  try {
    const input = parseNucleusUpdateFormData(formData)
    const nucleus = await updateNucleus(input)
    nucleusSlug = nucleus.slug
  } catch (error) {
    return getActionError(error)
  }

  redirect(`/campanha/nucleos/${nucleusSlug}`)
}

export const archiveNucleusFormAction = async (
  _state: NucleusFormState,
  formData: FormData,
): Promise<NucleusFormState> => {
  let nucleusId: number
  try {
    nucleusId = requiredRelationshipFormValue(formData, 'id')
  } catch {
    return {
      message: 'Não foi possível identificar o núcleo. Atualize a página e tente novamente.',
    }
  }

  try {
    await archiveNucleus(nucleusId)
  } catch {
    return {
      message:
        'Não foi possível arquivar este núcleo. Verifique seu acesso ou atualize a página e tente novamente.',
    }
  }
  redirect('/campanha/nucleos')
}
