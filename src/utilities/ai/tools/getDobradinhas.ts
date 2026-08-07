import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { populatedContactName, relationshipId, uniqueRelationshipIds } from '@/lib/relationship'

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
      let municipalityContext: { name: string; slug: string } | undefined

      if (municipality) {
        const munResult = await payload.find({
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
          select: { name: true, slug: true, stateDeputies: true },
          overrideAccess: false,
          user: ctx.user,
        })

        const mun = munResult.docs[0]
        if (!mun) return { message: `Nenhuma dobradinha encontrada em "${municipality}".` }

        const stateDeputyIDs = uniqueRelationshipIds(mun.stateDeputies)
        if (stateDeputyIDs.length === 0) {
          return { message: `Nenhuma dobradinha encontrada em "${municipality}".` }
        }

        municipalityContext = { name: mun.name, slug: mun.slug }
        andClauses.push({ id: { in: stateDeputyIDs } })
      }

      if (deputyName) {
        andClauses.push({ 'contact.name': { like: deputyName } })
      }

      const where: Where = andClauses.length > 0 ? { and: andClauses } : {}

      const result = await payload.find({
        collection: 'stateDeputy',
        where,
        depth: 1,
        limit: 20,
        pagination: false,
        select: { contact: true, party: true, slug: true, notes: true },
        sort: 'contact.name',
        overrideAccess: false,
        user: ctx.user,
      })

      const contactIDs = result.docs
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
          user: ctx.user,
        })
        for (const contact of contacts.docs) contactNames.set(contact.id, contact.name)
      }

      const deputies: Dobradinha[] = result.docs.map((doc: Record<string, unknown>) => ({
        name: populatedContactName(
          doc.contact,
          contactNames.get(relationshipId(doc.contact) ?? -1) ?? 'Contato',
        ),
        party: (doc.party as string) ?? null,
        slug: doc.slug as string,
        municipalities: municipalityContext ? [municipalityContext] : [],
        notes: (doc.notes as string) ?? null,
      }))

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
