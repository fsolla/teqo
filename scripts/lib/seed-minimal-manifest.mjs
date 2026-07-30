/**
 * Canonical content manifest of `pnpm db:seed:minimal` (pure data — imported by
 * the seed script AND by the unit pin `tests/unit/seedMinimalManifest.unit.spec.ts`,
 * which is the guardrail against a schema/migration delivery that forgets to
 * update the minimal DB contract in the same PR).
 *
 * Everything here is synthetic (`.invalid` emails, 719999999Xx phones) and
 * idempotent: the seed upserts by stable keys (slug/email/username/phone/key).
 * Municipalities are NOT created — migrations seed all 435 catalog rows; the
 * seed only pins deterministic operational fields on a handful of them.
 */

export const MINIMAL_SEED_VERSION = 1

/** Consent keys that MUST exist after the seed (the four fail-closed keys). */
export const MINIMAL_CONSENT_KEYS = [
  'lideranca-autopreenchimento',
  'apoiador-cadastro',
  'apoiador-intencao-voto',
  'whatsapp-inscricao',
]

export const MINIMAL_CAMPAIGN_GOALS = { stateGoal: 150_000, margin: 10, baseYear: 2022 }

export const MINIMAL_CAMPAIGN_USERS = [
  {
    role: 'coordinator',
    name: 'Seed Coordenador',
    email: 'seed-coordenador@teqo.invalid',
    password: 'teqo-minimal-seed-password',
  },
  {
    role: 'advisor',
    name: 'Seed Assessor',
    email: 'seed-assessor@teqo.invalid',
    password: 'teqo-minimal-seed-password',
  },
  {
    role: 'candidate',
    name: 'Seed Candidato',
    email: 'seed-candidato@teqo.invalid',
    password: 'teqo-minimal-seed-password',
  },
  {
    role: 'leader',
    name: 'Seed Liderança',
    username: '71999999990',
    phone: '71999999990',
    password: 'teqo-minimal-seed-password',
  },
]

/**
 * Municipality slugs the seed pins deterministic strategy fields on. They must
 * exist in the catalog (the unit test proves it). Salvador ZE 1 + Camaçari are
 * required by name in the Onda 0 plan; the other three spread across TIs.
 */
export const MINIMAL_MUNICIPALITIES = [
  {
    slug: 'salvador-ze-1',
    priority: 'alta',
    expectedVotes: { pessimistic: 4000, central: 5000, optimistic: 6500 },
  },
  {
    slug: 'camacari',
    priority: 'alta',
    expectedVotes: { pessimistic: 2500, central: 3200, optimistic: 4000 },
  },
  {
    slug: 'feira-de-santana',
    priority: 'normal',
    expectedVotes: { pessimistic: 2000, central: 2600, optimistic: 3300 },
  },
  {
    slug: 'vitoria-da-conquista',
    priority: 'normal',
    expectedVotes: { pessimistic: 2200, central: 2800, optimistic: 3600 },
  },
  {
    slug: 'itabuna',
    priority: 'normal',
    expectedVotes: { pessimistic: 1200, central: 1600, optimistic: 2100 },
  },
]

export const MINIMAL_ORGANIZATION = {
  name: 'Seed Sindicato dos Trabalhadores',
  slug: 'seed-sindicato-dos-trabalhadores',
  kind: 'sindicato',
  municipalitySlugs: ['camacari'],
}

export const MINIMAL_STATE_DEPUTY = {
  name: 'Seed Deputada Estadual',
  slug: 'seed-deputada-estadual',
  party: 'PT',
}

/**
 * Leaderships link a synthetic Contact (unique by phone) to municipalities.
 * `consentKey` references one of MINIMAL_CONSENT_KEYS.
 */
export const MINIMAL_LEADERSHIPS = [
  {
    contactName: 'Seed Liderança Um',
    contactPhone: '71999999991',
    municipalitySlugs: ['salvador-ze-1'],
    supportStatus: 'engajado',
    exclusive: true,
    consentKey: 'lideranca-autopreenchimento',
  },
  {
    contactName: 'Seed Liderança Dois',
    contactPhone: '71999999992',
    municipalitySlugs: ['camacari', 'itabuna'],
    supportStatus: 'a_abordar',
    exclusive: false,
    consentKey: 'lideranca-autopreenchimento',
  },
]

export const MINIMAL_SUPPORTERS = [
  {
    contactName: 'Seed Apoiador Um',
    contactPhone: '71999999993',
    municipalitySlug: 'salvador-ze-1',
    voteIntention: 'certo',
    source: 'manual',
    consentKey: 'apoiador-cadastro',
    voteIntentionConsentKey: 'apoiador-intencao-voto',
  },
  {
    contactName: 'Seed Apoiador Dois',
    contactPhone: '71999999994',
    municipalitySlug: 'camacari',
    voteIntention: 'indeciso',
    source: 'evento',
    consentKey: 'apoiador-cadastro',
    voteIntentionConsentKey: 'apoiador-intencao-voto',
  },
  {
    contactName: 'Seed Apoiador Três',
    contactPhone: '71999999995',
    municipalitySlug: 'feira-de-santana',
    source: 'lideranca',
    consentKey: 'apoiador-cadastro',
  },
]
