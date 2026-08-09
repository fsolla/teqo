/**
 * AI chat tools — exposed to the model via `streamText({ tools })`.
 *
 * Each domain tool is a factory that receives an `AIToolContext` (user + payload instance)
 * so database queries respect the authenticated user's access scope.
 */

import type { AIToolContext } from '@/lib/ai/types'

import { buildCampaignLinks } from '@/utilities/ai/tools/buildCampaignLinks'
import { calculate } from '@/utilities/ai/tools/calculate'
import { getDobradinhas } from '@/utilities/ai/tools/getDobradinhas'
import { getLeaderships } from '@/utilities/ai/tools/getLeaderships'
import { getLeadingMunicipalities } from '@/utilities/ai/tools/getLeadingMunicipalities'
import { getMunicipalityOverview } from '@/utilities/ai/tools/getMunicipalityOverview'
import { getMunicipalityVotes } from '@/utilities/ai/tools/getMunicipalityVotes'
import { getOrganizations } from '@/utilities/ai/tools/getOrganizations'
import { getTopDeputies } from '@/utilities/ai/tools/getTopDeputies'
import { searchEntities } from '@/utilities/ai/tools/searchEntities'

export const buildAITools = (ctx: AIToolContext) => ({
  calculate,
  buildCampaignLinks: buildCampaignLinks(ctx),
  getMunicipalityVotes: getMunicipalityVotes(ctx),
  getTopDeputies: getTopDeputies(ctx),
  getLeadingMunicipalities: getLeadingMunicipalities(ctx),
  getDobradinhas: getDobradinhas(ctx),
  getMunicipalityOverview: getMunicipalityOverview(ctx),
  getLeaderships: getLeaderships(ctx),
  getOrganizations: getOrganizations(ctx),
  searchEntities: searchEntities(ctx),
})
