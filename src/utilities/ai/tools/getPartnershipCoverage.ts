import 'server-only'

import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import {
  groupCoverageByCity,
  PARTNERSHIP_COVERAGE_CRITERION,
  resolveIdentityTerritory,
  sortCoverageUnits,
  sortOrphanDobradinhas,
  type PartnershipCoverageUnit,
} from '@/lib/partnershipCoverage'
import { populatedContactName, relationshipId } from '@/lib/relationship'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { municipalityIdsByStateDeputyIds } from '@/utilities/stateDeputyData'

const COVERAGE_DENIED = { error: 'Leitura de dados da campanha negada.' }

export const getPartnershipCoverage = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns partnership (dobradinha) coverage for the campaign: which municipalities have NO ' +
      'linked dobradinha ("quais municípios ainda não têm dobradinha?"), or which dobradinhas are ' +
      'orphans with no municipality linked ("quais dobradinhas estão sem município?"). ' +
      'The reading is about the current registry, not about which deputy to approach. ' +
      'Salvador is grouped by city by default (its 19 zones as one unit); pass expandZones to list zones individually.',
    inputSchema: z.object({
      mode: z
        .enum(['municipalities', 'orphanDeputies'])
        .describe(
          'municipalities = municipalities in the user scope without any linked dobradinha; ' +
            'orphanDeputies = dobradinhas with no municipality linked anywhere in the registry.',
        ),
      region: z
        .string()
        .optional()
        .describe(
          'Optional identity territory filter (e.g. "Vale do Jiquiriçá"). Only for mode municipalities.',
        ),
      city: z
        .string()
        .optional()
        .describe(
          'Optional city filter (e.g. "Salvador" matches its 19 zones). Only for mode municipalities.',
        ),
      expandZones: z
        .boolean()
        .optional()
        .describe(
          'List Salvador zone municipalities individually instead of grouping them under the city (default false).',
        ),
    }),
    execute: async ({ mode, region, city, expandZones }) => {
      const { payload, user } = ctx

      // Fail-closed: leaders never reach the coverage reading (the orphan
      // side reads the whole registry through an aggregate bypass).
      if (!isCampaignStaff(user)) return COVERAGE_DENIED

      if (mode === 'orphanDeputies') {
        return loadOrphanDobradinhas(payload, user)
      }

      const andClauses: Where[] = [{ stateDeputies: { exists: false } }]

      if (region) {
        const territory = resolveIdentityTerritory(region)
        if (!territory) {
          return {
            error: `Região não reconhecida: "${region}". Use o nome de um território de identidade da Bahia (ex.: "Vale do Jiquiriçá").`,
          }
        }
        andClauses.push({ region: { equals: territory } })
      }

      if (city) {
        andClauses.push({ city: { like: city } })
      }

      const result = await payload.find({
        collection: 'municipality',
        where: { and: andClauses },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { name: true, slug: true, city: true, region: true, zoneNumber: true },
        overrideAccess: false,
        user,
      })

      const units: PartnershipCoverageUnit[] = (result.docs as Array<Record<string, unknown>>).map(
        (doc) => ({
          nome: doc.name as string,
          slug: doc.slug as string,
          cidade: doc.city as string,
          regiao: doc.region as string,
          zoneNumber: typeof doc.zoneNumber === 'number' ? doc.zoneNumber : null,
        }),
      )

      const ordered = sortCoverageUnits(units)

      if (ordered.length === 0) {
        return {
          message: 'Nenhum município sem dobradinha no escopo atual.',
          criterio: PARTNERSHIP_COVERAGE_CRITERION.municipalities,
        }
      }

      if (expandZones) {
        return {
          criterio: PARTNERSHIP_COVERAGE_CRITERION.municipalities,
          agrupadoPorCidade: false,
          total: ordered.length,
          municipios: ordered.map((unit) => ({
            nome: unit.nome,
            slug: unit.slug,
            cidade: unit.cidade,
            regiao: unit.regiao,
          })),
        }
      }

      const rows = groupCoverageByCity(ordered)
      return {
        criterio: PARTNERSHIP_COVERAGE_CRITERION.municipalities,
        agrupadoPorCidade: true,
        total: ordered.length,
        municipios: rows,
      }
    },
  })

/**
 * Orphans are a registry-level fact, not a scope-relative one: a dobradinha
 * linked to municipalities outside the advisor's scope is NOT an orphan. The
 * linked set therefore comes from `municipalityIdsByStateDeputyIds` (aggregate
 * bypass, B34 precedent — reads only `stateDeputies` ids), and the deputy
 * rows themselves stay under the staff read access.
 */
const loadOrphanDobradinhas = async (
  payload: AIToolContext['payload'],
  user: AIToolContext['user'],
) => {
  const deputies = await payload.find({
    collection: 'stateDeputy',
    where: {},
    depth: 0,
    limit: 0,
    pagination: false,
    select: { contact: true, slug: true, party: true, notes: true },
    overrideAccess: false,
    user,
  })

  const stateDeputyIDs = deputies.docs.map((doc) => doc.id)
  const municipalitiesByDeputy = await municipalityIdsByStateDeputyIds(payload, stateDeputyIDs)

  const contactIDs = deputies.docs
    .map((doc) => relationshipId(doc.contact))
    .filter((id): id is number => id !== null)
  const contactNames = new Map<number, string>()
  if (contactIDs.length > 0) {
    const contacts = await payload.find({
      collection: 'contact',
      where: { id: { in: contactIDs } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { name: true },
      overrideAccess: false,
      user,
    })
    for (const contact of contacts.docs) contactNames.set(contact.id, contact.name)
  }

  const orphans = sortOrphanDobradinhas(
    deputies.docs
      .filter((doc) => !municipalitiesByDeputy.has(doc.id))
      .map((doc) => ({
        nome: populatedContactName(
          doc.contact,
          contactNames.get(relationshipId(doc.contact) ?? -1) ?? 'Contato',
        ),
        slug: doc.slug,
        partido: doc.party ?? null,
        observacoes: doc.notes ?? null,
      })),
  )

  if (orphans.length === 0) {
    return {
      message: 'Nenhuma dobradinha órfã cadastrada.',
      criterio: PARTNERSHIP_COVERAGE_CRITERION.orphanDeputies,
    }
  }

  return {
    criterio: PARTNERSHIP_COVERAGE_CRITERION.orphanDeputies,
    total: orphans.length,
    dobradinhas: orphans,
  }
}
