import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'

const KIND_LABELS: Record<string, string> = {
  sindicato: 'Sindicato',
  associacao: 'Associação',
  religioso: 'Religiosa',
  movimento: 'Movimento',
  categoria_profissional: 'Categoria profissional',
  outro: 'Outro',
}

export const getOrganizations = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns organizations (sindicatos, associações, movimentos) filtered by municipality or name. ' +
      'Use when the user asks "Quais organizações temos em X?" or "Quais sindicatos apoiam em Y?".',
    inputSchema: z.object({
      municipality: z.string().optional().describe('Filter by municipality name or slug.'),
      name: z.string().optional().describe('Filter by organization name (partial match).'),
      kind: z
        .string()
        .optional()
        .describe(
          'Filter by kind: sindicato, associacao, religioso, movimento, categoria_profissional, outro.',
        ),
      limit: z.number().optional().default(10).describe('Max results (default 10, max 30).'),
    }),
    execute: async ({ municipality, name, kind, limit }) => {
      const { payload } = ctx
      const safeLimit = Math.min(limit, 30)

      const andClauses: Where[] = []

      if (municipality) {
        andClauses.push({
          or: [
            { 'municipalities.name': { equals: municipality } },
            { 'municipalities.slug': { equals: municipality.toLowerCase().replace(/\s+/g, '-') } },
          ],
        })
      }

      if (kind) {
        andClauses.push({ kind: { equals: kind } })
      }

      if (name) {
        andClauses.push({ name: { like: name } })
      }

      const where: Where = andClauses.length > 0 ? { and: andClauses } : {}

      const result = await payload.find({
        collection: 'organization',
        where,
        depth: 1,
        limit: safeLimit,
        pagination: false,
        select: {
          name: true,
          slug: true,
          kind: true,
          municipalities: true,
          notes: true,
        },
        sort: 'name',
        overrideAccess: false,
        user: ctx.user,
      })

      if (result.docs.length === 0) {
        const context = municipality ? ` em "${municipality}"` : ''
        return { message: `Nenhuma organização encontrada${context}.` }
      }

      return {
        total: result.docs.length,
        organizacoes: result.docs.map((doc: Record<string, unknown>) => {
          const municipalities = (doc.municipalities as Array<{ name?: string }>) ?? []
          return {
            nome: doc.name,
            tipo: KIND_LABELS[(doc.kind as string) ?? ''] ?? (doc.kind as string),
            municipios: municipalities.map((m) => m.name),
            observacoes: (doc.notes as string) ?? null,
          }
        }),
      }
    },
  })
