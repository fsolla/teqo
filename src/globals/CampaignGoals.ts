import { isCampaignStaff, isCampaignUnrestricted, isPayloadAdmin } from '@/utilities/campaignAccess'
import type { GlobalConfig } from 'payload'

const slug = 'campaignGoals'

/**
 * State-level campaign goal used by E8 "conta da cadeira" to derive the
 * per-municipality suggested goal (`municipalityPotential.ts`'s
 * `deriveSuggestedGoalsByScenario`, anchored on the candidate's own 2022 vote:
 * `stateGoal` sets the optimistic scenario's growth factor, `margin` the
 * pessimistic haircut). Editable by staff (piso do CG, sessão 2026-07-23:
 * 150.000) rather than derived automatically — the derivation reads these
 * values, it never writes back to them.
 *
 * No `afterChange` revalidation hook: `/campanha` is dynamic with
 * authentication on every request (no ISR/ISR tag caches this global), and
 * `campaignGoals` is not in the `revalidateRequest.ts` tag allowlist. Adding
 * one here would be dead ceremony (see the E8 plan audit finding #4).
 *
 * Access is explicit (not Payload's "any authenticated user" default) because
 * a `campaignUser` JWT reaches `/api/globals/*` directly: leaders and
 * unauthenticated requests must be denied on read, and only coordinator/
 * candidate (`isCampaignUnrestricted`) may write the state goal.
 */
export const CampaignGoals: GlobalConfig = {
  slug,
  label: 'Metas da campanha',
  admin: {
    group: 'Campanha',
  },
  access: {
    read: ({ req: { user } }) => isPayloadAdmin(user) || isCampaignStaff(user),
    update: ({ req: { user } }) => isPayloadAdmin(user) || isCampaignUnrestricted(user),
  },
  fields: [
    {
      name: 'stateGoal',
      type: 'number',
      label: 'Meta estadual (votos)',
      required: true,
      defaultValue: 150_000,
      min: 0,
      admin: {
        description:
          'Piso decidido pela coordenação geral. Define o cenário OTIMISTA da meta sugerida por município: a votação de 2022 de cada município é multiplicada por (meta estadual ÷ votação estadual de 2022), então a soma das metas otimistas fecha exatamente neste valor.',
      },
    },
    {
      name: 'margin',
      type: 'number',
      label: 'Margem (%)',
      min: 0,
      admin: {
        description:
          'Corte do cenário PESSIMISTA da meta sugerida: quanto da votação de 2022 a campanha admite perder (ex.: 10 = meta pessimista 10% abaixo de 2022). Vazio usa 10%.',
      },
    },
    {
      name: 'baseYear',
      type: 'number',
      label: 'Ano de referência',
      admin: {
        description: 'Ano-base considerado pela coordenação ao fixar a meta estadual (contexto, não usado em cálculo).',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Observação',
      admin: {
        description: 'Contexto livre sobre a decisão da meta (ex.: data e instância que decidiu).',
      },
    },
  ],
}
