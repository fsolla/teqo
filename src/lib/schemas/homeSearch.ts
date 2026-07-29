import { z } from 'zod'

import { HOME_SEARCH_MIN_QUERY_LENGTH } from '@/lib/campaignHomeSearchContract'

export const HOME_SEARCH_QUERY_MAX_LENGTH = 80

export const homeSearchBodySchema = z.object({
  query: z
    .string()
    .trim()
    .min(HOME_SEARCH_MIN_QUERY_LENGTH, 'Digite pelo menos 2 caracteres.')
    .max(HOME_SEARCH_QUERY_MAX_LENGTH),
})
