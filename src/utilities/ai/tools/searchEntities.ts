import { tool } from 'ai'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { populatedContactName } from '@/lib/relationship'
import { salvadorCity } from '@/lib/salvadorCity'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

type SearchHit = {
  collection: string
  label: string
  description: string
  href?: string
}

export const searchEntities = (ctx: AIToolContext) =>
  tool({
    description:
      'Fuzzy search across municipalities, leaderships, organizations, and state deputies. ' +
      'Use this FIRST when the user mentions an entity name and you are not sure which tool to call. ' +
      'Returns categorized results that help you decide which specific tool to use next.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Search term (municipality name, person name, organization name, etc.).'),
    }),
    execute: async ({ query }) => {
      const { payload } = ctx

      const hits: SearchHit[] = []

      // B178 — the virtual Salvador city is a navigation destination the Sollinha
      // keeps hallucinating about: whenever the query matches the capital, the
      // city page is the canonical hit (the 19 ZE rows follow below).
      const normalizedQuery = normalizeSearchPhrase(query)
      if (normalizedQuery && normalizeSearchPhrase(salvadorCity.name).includes(normalizedQuery)) {
        hits.push({
          collection: 'cidade',
          label: salvadorCity.name,
          description: 'Cidade — agregado das 19 zonas eleitorais',
          href: `/campanha/municipios/${salvadorCity.slug}`,
        })
      }

      // Search municipalities
      const munResult = await payload.find({
        collection: 'municipality',
        where: {
          or: [{ name: { like: query } }, { city: { like: query } }, { region: { like: query } }],
        },
        depth: 0,
        limit: 5,
        pagination: false,
        select: { name: true, slug: true, city: true, region: true },
        sort: 'name',
        overrideAccess: false,
        user: ctx.user,
      })

      for (const doc of munResult.docs as Array<Record<string, unknown>>) {
        hits.push({
          collection: 'municipality',
          label: doc.name as string,
          description: `Município — ${doc.city} (${doc.region})`,
          href: `/campanha/municipios/${doc.slug}`,
        })
      }

      // Search leaderships
      const leadResult = await payload.find({
        collection: 'leadership',
        where: {
          or: [{ 'contact.name': { like: query } }, { 'municipalities.name': { like: query } }],
        },
        depth: 1,
        limit: 5,
        pagination: false,
        select: { contact: true, municipalities: true },
        sort: '-updatedAt',
        overrideAccess: false,
        user: ctx.user,
      })

      for (const doc of leadResult.docs as Array<Record<string, unknown>>) {
        const contact = doc.contact as { name?: string } | undefined
        const municipalities = (doc.municipalities as Array<{ name?: string }>) ?? []
        hits.push({
          collection: 'leadership',
          label: contact?.name ?? 'Liderança',
          description: `Liderança — ${municipalities.map((m) => m.name).join(', ')}`,
        })
      }

      // Search organizations
      const orgResult = await payload.find({
        collection: 'organization',
        where: {
          or: [{ name: { like: query } }, { 'municipalities.name': { like: query } }],
        },
        depth: 0,
        limit: 5,
        pagination: false,
        select: { name: true, kind: true },
        sort: 'name',
        overrideAccess: false,
        user: ctx.user,
      })

      for (const doc of orgResult.docs as Array<Record<string, unknown>>) {
        hits.push({
          collection: 'organization',
          label: doc.name as string,
          description: `Organização — ${doc.kind as string}`,
        })
      }

      // Search state deputies
      const depResult = await payload.find({
        collection: 'stateDeputy',
        where: {
          'contact.name': { like: query },
        },
        depth: 1,
        limit: 5,
        pagination: false,
        select: { contact: true, party: true },
        sort: 'contact.name',
        overrideAccess: false,
        user: ctx.user,
      })

      for (const doc of depResult.docs as Array<Record<string, unknown>>) {
        const name = populatedContactName(doc.contact)
        hits.push({
          collection: 'stateDeputy',
          label: name,
          description: `Dobradinha — ${(doc.party as string) ?? 'sem partido'}`,
          href: `/campanha/dobradinhas/${doc.id as number}`,
        })
      }

      if (hits.length === 0) {
        return {
          message: `Nenhum resultado encontrado para "${query}". Tente um termo diferente.`,
        }
      }

      return {
        termo: query,
        total: hits.length,
        resultados: hits,
      }
    },
  })
