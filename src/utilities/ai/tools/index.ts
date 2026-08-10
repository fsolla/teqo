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
import { getMunicipalitiesWithoutUpdate } from '@/utilities/ai/tools/getMunicipalitiesWithoutUpdate'
import { getMunicipalityOverview } from '@/utilities/ai/tools/getMunicipalityOverview'
import { getMunicipalityPriorities } from '@/utilities/ai/tools/getMunicipalityPriorities'
import { getMunicipalityVotes } from '@/utilities/ai/tools/getMunicipalityVotes'
import { getOrganizations } from '@/utilities/ai/tools/getOrganizations'
import { getPartnershipCoverage } from '@/utilities/ai/tools/getPartnershipCoverage'
import { getPendingLeaderships } from '@/utilities/ai/tools/getPendingLeaderships'
import { getTopDeputies } from '@/utilities/ai/tools/getTopDeputies'
import { searchEntities } from '@/utilities/ai/tools/searchEntities'

export const buildAITools = (ctx: AIToolContext) => ({
  calculate,
  buildCampaignLinks: buildCampaignLinks(ctx),
  getMunicipalityVotes: getMunicipalityVotes(ctx),
  getTopDeputies: getTopDeputies(ctx),
  getLeadingMunicipalities: getLeadingMunicipalities(ctx),
  getDobradinhas: getDobradinhas(ctx),
  getMunicipalitiesWithoutUpdate: getMunicipalitiesWithoutUpdate(ctx),
  getMunicipalityOverview: getMunicipalityOverview(ctx),
  getMunicipalityPriorities: getMunicipalityPriorities(ctx),
  getLeaderships: getLeaderships(ctx),
  getPendingLeaderships: getPendingLeaderships(ctx),
  getOrganizations: getOrganizations(ctx),
  getPartnershipCoverage: getPartnershipCoverage(ctx),
  searchEntities: searchEntities(ctx),
})
