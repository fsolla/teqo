import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'

type Dobradinha = {
  name: string
  party: string | null
  slug: string
  municipalities: Array<{ name: string; slug: string }>
  notes: string | null
}

export const getDobradinhas = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns state deputy partnerships (dobradinhas). Can filter by municipality or deputy name. ' +
      'Use when the user asks "Quais dobradinhas temos em X?", "Quem assessora a dobradinha com Y?", ' +
      'or "Me fala sobre a dobradinha Z".',
    inputSchema: z.object({
      municipality: z
        .string()
        .optional()
        .describe('Filter dobradinhas linked to this municipality (name or slug).'),
      deputyName: z.string().optional().describe('Filter by deputy name (partial match).'),
    }),
    execute: async ({ municipality, deputyName }) => {
      const { payload } = ctx

      const andClauses: Where[] = []
      if (deputyName) {
        andClauses.push({ name: { like: deputyName } })
      }

      const where: Where = andClauses.length > 0 ? { and: andClauses } : {}

      const result = await payload.find({
        collection: 'stateDeputy',
        where,
        depth: 1,
        limit: 20,
        pagination: false,
        select: { name: true, party: true, slug: true, notes: true },
        sort: 'name',
        overrideAccess: false,
        user: ctx.user,
      })

      let deputies: Dobradinha[] = result.docs.map((doc: Record<string, unknown>) => ({
        name: doc.name as string,
        party: (doc.party as string) ?? null,
        slug: doc.slug as string,
        municipalities: [],
        notes: (doc.notes as string) ?? null,
      }))

      // If municipality filter is provided, query the municipality to get its dobradinhas
      if (municipality) {
        const munResult = await payload.find({
          collection: 'municipality',
          where: {
            or: [
              { name: { equals: municipality } },
              { slug: { equals: municipality.toLowerCase().replace(/\s+/g, '-') } },
            ],
          },
          depth: 1,
          limit: 1,
          pagination: false,
          select: { name: true, slug: true, stateDeputies: true },
          overrideAccess: false,
          user: ctx.user,
        })

        if (munResult.docs.length > 0) {
          const mun = munResult.docs[0] as Record<string, unknown>
          const linkedDeputies = (mun.stateDeputies as Array<{ name: string }>) ?? []
          const linkedNames = new Set(linkedDeputies.map((d) => d.name))

          // Enrich deputies with municipality info
          for (const deputy of deputies) {
            if (linkedNames.has(deputy.name)) {
              deputy.municipalities.push({
                name: mun.name as string,
                slug: mun.slug as string,
              })
            }
          }

          deputies = deputies.filter((d) => linkedNames.has(d.name))
        }
      }

      if (deputies.length === 0) {
        if (municipality) {
          return { message: `Nenhuma dobradinha encontrada em "${municipality}".` }
        }
        if (deputyName) {
          return { message: `Nenhuma dobradinha encontrada com nome "${deputyName}".` }
        }
        return { message: 'Nenhuma dobradinha cadastrada.' }
      }

      return {
        total: deputies.length,
        dobradinhas: deputies.map((d) => ({
          nome: d.name,
          partido: d.party ?? 'não informado',
          municipios: d.municipalities.map((m) => m.name),
          observacoes: d.notes,
        })),
      }
    },
  })
