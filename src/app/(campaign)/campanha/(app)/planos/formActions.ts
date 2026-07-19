'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

import { createActionPlan, updateActionPlan } from '@/app/(campaign)/campanha/actions/actionPlan'
import type { ActionPlanFormState } from '@/components/campaign/ActionPlanForm'
import { optionalFormText } from '@/lib/formData'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'
import {
  parseActionPlanCreateFormData,
  parseActionPlanUpdateFormData,
} from '@/utilities/actionPlanFormData'
import { slugify } from '@/utilities/slug'

const getActionError = (error: unknown): ActionPlanFormState => {
  // Checked before the shared mapper: a DB-level unique-violation message isn't
  // a `FormDataBoundaryError`/`ZodError`/known-safe string, so it needs its own
  // branch to surface as a field error instead of falling to the generic message.
  if (error instanceof Error && /já existe|unique|duplicate key/i.test(error.message)) {
    return { fieldErrors: { title: ['Já existe um plano com este título.'] } }
  }
  return mapCampaignFormActionError({
    error,
    genericMessage: 'Não foi possível concluir a ação. Atualize a página e tente novamente.',
  })
}

const existingActionPlanState = async (formData: FormData): Promise<ActionPlanFormState | null> => {
  const title = optionalFormText(formData, 'title')
  const slug = title ? slugify(title) : ''
  if (!slug) return null
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) return null

  const result = await payload.find({
    collection: 'actionPlan',
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
        fieldErrors: { title: ['Já existe um plano com este título.'] },
        existingHref: `/campanha/planos/${existing.slug}`,
        submittedTitle: title,
      }
    : null
}

export const createActionPlanFormAction = async (
  _state: ActionPlanFormState,
  formData: FormData,
): Promise<ActionPlanFormState> => {
  let planSlug: string

  try {
    const plan = await createActionPlan(parseActionPlanCreateFormData(formData))
    planSlug = plan.slug
  } catch (error) {
    const existing = await existingActionPlanState(formData)
    if (existing) return existing
    return getActionError(error)
  }

  redirect(`/campanha/planos/${planSlug}`)
}

export const updateActionPlanFormAction = async (
  _state: ActionPlanFormState,
  formData: FormData,
): Promise<ActionPlanFormState> => {
  let planSlug: string

  try {
    const input = parseActionPlanUpdateFormData(formData)
    const plan = await updateActionPlan(input)
    planSlug = plan.slug
  } catch (error) {
    return getActionError(error)
  }

  redirect(`/campanha/planos/${planSlug}`)
}
