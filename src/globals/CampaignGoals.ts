import { isCampaignStaff, isCampaignUnrestricted, isPayloadAdmin } from '@/utilities/campaignAccess'
import type { GlobalConfig } from 'payload'

const slug = 'campaignGoals'

/**
 * State-level campaign goal used by E8 "conta da cadeira" to decompose a
 * per-municipality suggested goal proportional to each municipality's
 * projected field ceiling (`municipalityPotential.ts`). Editable by staff
 * (piso do CG, sessão 2026-07-23: 150.000) rather than derived automatically —
 * decomposition reads this value, it never writes back to it.
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
          'Piso decidido pela coordenação geral. A meta por município (E8) é decomposta proporcionalmente ao teto do campo projetado a partir deste valor.',
      },
    },
    {
      name: 'margin',
      type: 'number',
      label: 'Margem (%)',
      min: 0,
      admin: {
        description: 'Margem de segurança sobre a meta estadual, para leitura da mesa (não altera a decomposição).',
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
