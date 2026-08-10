import { tool } from 'ai'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import {
  campaignIntelligenceConcepts,
  type CampaignConceptId,
} from '@/lib/campaignIntelligenceConcepts'
import { activityStatuses } from '@/lib/schemas/activity'
import { campaignDemandKinds, campaignDemandStatuses } from '@/lib/schemas/campaignDemand'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import { organizationKinds } from '@/lib/schemas/organization'
import { TERRITORIAL_CLASSES } from '@/lib/territorialClassAnchors'
import { activityTabs } from '@/utilities/activityUi'
import type { CampaignNavigationLinkRequest } from '@/utilities/ai/campaignNavigationUrls'
import { buildCampaignNavigationLinks } from '@/utilities/ai/campaignNavigationUrls'
import { politicalTrendLabels } from '@/utilities/municipality/municipalityLabels'
import {
  municipalityListLevelFilterValues,
  NO_STATE_DEPUTY_FILTER_VALUE,
} from '@/utilities/municipality/municipalityListUrl'

const labelSchema = z
  .string()
  .optional()
  .describe('Rótulo humano para o link na resposta (ex.: "Ilhéus", "Municípios do assessor João").')

const territoryRegionSchema = z.enum(
  bahiaIdentityTerritories as [
    (typeof bahiaIdentityTerritories)[number],
    ...(typeof bahiaIdentityTerritories)[number][],
  ],
)

const politicalTrendKeys = Object.keys(politicalTrendLabels) as [
  keyof typeof politicalTrendLabels,
  ...(keyof typeof politicalTrendLabels)[],
]

const conceptIdSchema = z.enum(
  campaignIntelligenceConcepts.map((concept) => concept.id) as [
    CampaignConceptId,
    ...CampaignConceptId[],
  ],
)

const supporterVoteIntentions = ['certo', 'tende_a_certo', 'indeciso', 'outro'] as const
const supporterSources = ['import_csv', 'manual', 'lideranca', 'convite', 'evento'] as const

const territorySortKeys = [
  'region',
  'municipalities',
  'votes2022',
  'pct',
  'validVotes2022',
  'estimate2026',
  'coverage',
  'cobertura',
  'captura',
  'classe',
] as const

const linkRequestSchema = z.discriminatedUnion('destination', [
  z.object({ destination: z.literal('home'), label: labelSchema }),
  z.object({ destination: z.literal('quadro'), label: labelSchema }),
  z.object({ destination: z.literal('perfil'), label: labelSchema }),
  z.object({ destination: z.literal('giros'), label: labelSchema }),
  z.object({ destination: z.literal('leaderContacts'), label: labelSchema }),
  z.object({
    destination: z.literal('conceitos'),
    conceptId: conceptIdSchema.optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('municipality'),
    slug: z
      .string()
      .describe('Slug canônico do município (resolvido via searchEntities ou tools de dados).'),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('leadership'),
    id: z.number().int().positive(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('dobradinha'),
    slug: z.string(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('advisor'),
    id: z.number().int().positive(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('organization'),
    slug: z.string(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('activity'),
    slug: z.string(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('demand'),
    slug: z.string(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('supporter'),
    id: z.number().int().positive(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('municipalityList'),
    q: z.string().optional(),
    slugs: z.array(z.string()).optional(),
    regions: z.array(territoryRegionSchema).optional(),
    advisors: z.array(z.number().int().positive()).optional(),
    coverage: z.enum(['com_assessor', 'sem_assessor']).optional(),
    priority: z.literal('alta').optional(),
    trends: z.array(z.enum(politicalTrendKeys)).optional(),
    classes: z.array(z.enum(TERRITORIAL_CLASSES)).optional(),
    levels: z.array(z.enum(municipalityListLevelFilterValues as [string, ...string[]])).optional(),
    stateDeputies: z
      .array(z.union([z.number().int().positive(), z.literal(NO_STATE_DEPUTY_FILTER_VALUE)]))
      .optional()
      .describe(
        'Dobradinha ids to filter the list by, or the sentinel "sem_dobradinha" for municipalities without any dobradinha.',
      ),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('leadershipList'),
    q: z.string().optional(),
    statuses: z.array(z.enum(leadershipSupportStatuses)).optional(),
    municipalities: z.array(z.number().int().positive()).optional(),
    organizations: z.array(z.number().int().positive()).optional(),
    stateDeputies: z.array(z.number().int().positive()).optional(),
    access: z.enum(['com', 'sem']).optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('dobradinhaList'),
    q: z.string().optional(),
    parties: z.array(z.string()).optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('advisorList'),
    q: z.string().optional(),
    municipalities: z.array(z.number().int().positive()).optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('organizationList'),
    q: z.string().optional(),
    kind: z.enum(organizationKinds).optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('activityList'),
    tab: z.enum(activityTabs).optional(),
    q: z.string().optional(),
    tag: z.string().trim().min(1).optional(),
    status: z.enum(activityStatuses).optional(),
    municipality: z.number().int().positive().optional(),
    deputyPresent: z.boolean().optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('demandList'),
    q: z.string().optional(),
    status: z.enum(campaignDemandStatuses).optional(),
    kind: z.enum(campaignDemandKinds).optional(),
    activityId: z.number().int().positive().optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('supporterList'),
    q: z.string().optional(),
    voteIntention: z.enum(supporterVoteIntentions).optional(),
    source: z.enum(supporterSources).optional(),
    city: z.string().optional(),
    municipality: z.number().int().positive().optional(),
    label: labelSchema,
  }),
  z.object({
    destination: z.literal('territoryList'),
    q: z.string().optional(),
    regions: z.array(territoryRegionSchema).optional(),
    coverage: z.enum(['com_assessor', 'sem_assessor']).optional(),
    sort: z.enum(territorySortKeys).optional(),
    dir: z.enum(['asc', 'desc']).optional(),
    label: labelSchema,
  }),
])

export const buildCampaignLinks = (ctx: AIToolContext) =>
  tool({
    description:
      'Build canonical /campanha navigation links for the staff to open in the app. ' +
      'Use AFTER resolving entity ids/slugs with searchEntities or domain tools — never guess slugs. ' +
      'Offer links when the user asks to open/go to a view, or proactively when answering about a single entity. ' +
      'For "dobradinhas do assessor X" there is NO advisor filter on the dobradinhas list — use advisor detail plus individual dobradinha detail links instead.',
    inputSchema: z.object({
      links: z
        .array(linkRequestSchema)
        .min(1)
        .max(5)
        .describe(
          'One or more navigation targets to build (batch for e.g. assessor + dobradinhas).',
        ),
    }),
    execute: async ({ links }) => {
      const result = buildCampaignNavigationLinks(
        ctx.user.role,
        links as CampaignNavigationLinkRequest[],
      )

      if (result.errors?.length) {
        return {
          links: result.links,
          errors: result.errors,
          hint: 'Corrija os parâmetros inválidos ou use searchEntities para resolver ids/slugs antes de tentar de novo.',
        }
      }

      return {
        links: result.links,
        formatting:
          'Inclua cada link na resposta em markdown relativo: [rótulo](path). Ex.: [Ilhéus](/campanha/municipios/ilheus).',
      }
    },
  })
