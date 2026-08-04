import { tool } from 'ai'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { formatEngagementLevelLabel } from '@/lib/engagementLevel'

export const getMunicipalityOverview = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns an overview of a campaign municipality: engagement level, priority, leadership count, ' +
      'pledge totals, goal coverage, advisors, and recent updates. ' +
      'Use when the user asks "Como está X?" or "Me fala sobre a situação de X".',
    inputSchema: z.object({
      municipality: z.string().describe('Municipality name or slug.'),
    }),
    execute: async ({ municipality }) => {
      const { payload } = ctx

      const result = await payload.find({
        collection: 'municipality',
        where: {
          or: [
            { name: { equals: municipality } },
            { slug: { equals: municipality.toLowerCase().replace(/\s+/g, '-') } },
          ],
        },
        depth: 0,
        limit: 1,
        pagination: false,
        select: {
          name: true,
          slug: true,
          city: true,
          region: true,
          kind: true,
          priority: true,
          engagementLevel: true,
          levelNote: true,
          politicalTrend: true,
          expectedVotes: true,
          strengths: true,
          risks: true,
          nextSteps: true,
          advisors: true,
        },
        overrideAccess: false,
        user: ctx.user,
      })

      if (result.docs.length === 0) {
        return {
          error: `Município não encontrado: "${municipality}". Verifique o nome e tente novamente.`,
        }
      }

      const doc = result.docs[0] as Record<string, unknown>
      const munSlug = doc.slug as string

      // Count leaderships and pledges for this municipality
      const [leaderships, pledges] = await Promise.all([
        payload.count({
          collection: 'leadership',
          where: { 'municipalities.slug': { equals: munSlug } },
          overrideAccess: false,
          user: ctx.user,
        }),
        payload.count({
          collection: 'votePledge',
          where: { 'municipality.slug': { equals: munSlug } },
          overrideAccess: false,
          user: ctx.user,
        }),
      ])

      const engagementLevel = doc.engagementLevel as string | null
      const trend = doc.politicalTrend as { status?: string; note?: string } | undefined
      const expected = doc.expectedVotes as
        | { pessimistic?: number; central?: number; optimistic?: number }
        | undefined

      return {
        municipio: doc.name,
        cidade: doc.city,
        regiao: doc.region,
        tipo: doc.kind === 'zona' ? 'Zona eleitoral (Salvador)' : 'Município inteiro',
        prioridade: doc.priority === 'alta' ? 'Alta' : 'Normal',
        nivelEngajamento: engagementLevel
          ? formatEngagementLevelLabel(engagementLevel as 'n0' | 'n1' | 'n2' | 'n3' | 'n4')
          : 'Não definido',
        motivoNivel: (doc.levelNote as string) ?? null,
        tendenciaPolitica: trend?.status
          ? {
              status: trend.status,
              justificativa: trend.note ?? null,
            }
          : null,
        votosEstimados: expected
          ? {
              pessimista: expected.pessimistic ?? null,
              central: expected.central ?? null,
              otimista: expected.optimistic ?? null,
            }
          : null,
        totalLiderancas: leaderships.totalDocs,
        totalCompromissos: pledges.totalDocs,
        forcas: ((doc.strengths as Array<{ text?: string }>) ?? [])
          .map((s) => s.text)
          .filter(Boolean),
        riscos: ((doc.risks as Array<{ text?: string }>) ?? []).map((r) => r.text).filter(Boolean),
        encaminhamentos: (doc.nextSteps as string) ?? null,
      }
    },
  })
