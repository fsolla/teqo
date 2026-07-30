import { z } from 'zod'

import { HOME_SEARCH_MIN_QUERY_LENGTH } from '@/lib/campaignHomeSearchContract'

export const HOME_SEARCH_QUERY_MAX_LENGTH = 80

const homeSearchQueryField = z
  .string()
  .trim()
  .min(HOME_SEARCH_MIN_QUERY_LENGTH, 'Digite pelo menos 2 caracteres.')
  .max(HOME_SEARCH_QUERY_MAX_LENGTH)

export const homeSearchBodySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('search'),
    query: homeSearchQueryField,
  }),
  z.object({
    mode: z.literal('suggest'),
  }),
])
