'use server'

// Documented exception to `runCampaignRedirectFormAction`/`runCampaignFormAction`
// (Pass 2 W4d): these ladders carry a custom error mapper (DB unique-violation
// regexes surfacing as field errors) plus an async duplicate-title fallback
// that links to the existing activity — policy the shared wrappers deliberately
// don't grow parameters for.

import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { createActivity, updateActivity } from '@/app/(campaign)/campanha/actions/activity'
import type { ActivityFormState } from '@/components/campaign/activity/ActivityForm'
import { optionalFormText } from '@/lib/formData'
import { slugify } from '@/lib/slug'
import {
  parseActivityCreateFormData,
  parseActivityUpdateFormData,
} from '@/utilities/activityFormData'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'

const getActionError = (error: unknown): ActivityFormState => {
  if (
    error instanceof Error &&
    /campaign_demand.*(?:slug|title)|campaignDemand.*(?:slug|title)/i.test(error.message)
  ) {
    return {
      fieldErrors: {
        demandsJson: ['Já existe uma demanda com um dos títulos informados.'],
      },
    }
  }
  // Checked before the shared mapper: a DB-level unique-violation message isn't
  // a `FormDataBoundaryError`/`ZodError`/known-safe string, so it needs its own
  // branch to surface as a field error instead of falling to the generic message.
  if (error instanceof Error && /já existe|unique|duplicate key/i.test(error.message)) {
    return { fieldErrors: { title: ['Já existe uma atividade com este título.'] } }
  }
  return mapCampaignFormActionError({
    error,
    genericMessage: 'Não foi possível concluir a ação. Atualize a página e tente novamente.',
  })
}

const existingActivityState = async (formData: FormData): Promise<ActivityFormState | null> => {
  const title = optionalFormText(formData, 'title')
  const slug = title ? slugify(title) : ''
  if (!slug) return null
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) return null

  const result = await payload.find({
    collection: 'activity',
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
        fieldErrors: { title: ['Já existe uma atividade com este título.'] },
        existingHref: `/campanha/atividades/${existing.slug}`,
        submittedTitle: title,
      }
    : null
}

export const createActivityFormAction = async (
  _state: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> => {
  let activitySlug: string

  try {
    const { demands, ...activityInput } = parseActivityCreateFormData(formData)
    const activity = await createActivity(activityInput, demands)
    activitySlug = activity.slug
  } catch (error) {
    const existing = await existingActivityState(formData)
    if (existing) return existing
    return getActionError(error)
  }

  redirect(`/campanha/atividades/${activitySlug}`)
}

export const updateActivityFormAction = async (
  _state: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> => {
  let activitySlug: string

  try {
    const { demands, ...activityInput } = parseActivityUpdateFormData(formData)
    const activity = await updateActivity(activityInput, demands)
    activitySlug = activity.slug
  } catch (error) {
    return getActionError(error)
  }

  redirect(`/campanha/atividades/${activitySlug}`)
}
