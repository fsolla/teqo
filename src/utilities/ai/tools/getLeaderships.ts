import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

export const getLeaderships = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns leaderships (lideranças) filtered by municipality or name. ' +
      'Use when the user asks "Quais lideranças temos em X?" or "Me fala sobre a liderança Y".',
    inputSchema: z.object({
      municipality: z.string().optional().describe('Filter by municipality name or slug.'),
      name: z.string().optional().describe('Filter by leadership contact name (partial match).'),
      limit: z.number().optional().default(10).describe('Max results (default 10, max 30).'),
    }),
    execute: async ({ municipality, name, limit }) => {
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

      const where: Where = andClauses.length > 0 ? { and: andClauses } : {}

      const result = await payload.find({
        collection: 'leadership',
        where,
        depth: 1,
        limit: safeLimit,
        pagination: false,
        select: {
          contact: true,
          municipalities: true,
          organizations: true,
          exclusive: true,
          supportStatus: true,
          notes: true,
        },
        sort: '-updatedAt',
        overrideAccess: false,
        user: ctx.user,
      })

      let leaderships = result.docs.map((doc: Record<string, unknown>) => {
        const contact = doc.contact as { name?: string } | undefined
        const municipalities = (doc.municipalities as Array<{ name?: string; slug?: string }>) ?? []
        const organizations = (doc.organizations as Array<{ name?: string }>) ?? []
        return {
          nome: contact?.name ?? 'Sem nome',
          municipios: municipalities.map((m) => ({ nome: m.name, slug: m.slug })),
          organizacoes: organizations.map((o) => o.name),
          apoioExclusivo: doc.exclusive === true,
          status:
            supportStatusLabels[doc.supportStatus as keyof typeof supportStatusLabels] ??
            (doc.supportStatus as string),
          observacoes: (doc.notes as string) ?? null,
        }
      })

      // Apply name filter client-side (Payload doesn't support deep like on relationships easily)
      if (name) {
        const nameLower = name.toLowerCase()
        leaderships = leaderships.filter((l) => l.nome.toLowerCase().includes(nameLower))
      }

      if (leaderships.length === 0) {
        const context = municipality ? ` em "${municipality}"` : ''
        return { message: `Nenhuma liderança encontrada${context}.` }
      }

      return {
        total: leaderships.length,
        liderancas: leaderships,
      }
    },
  })
