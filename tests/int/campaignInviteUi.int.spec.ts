// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import {
  redeemCampaignInviteAutofillFormAction,
  redeemCampaignInviteLoginFormAction,
} from '@/app/(campaign)/campanha/convite/[token]/formActions'
import { CampaignInviteForm } from '@/components/campaign/CampaignInviteForm'
import { ConsentText } from '@/components/campaign/ConsentText'
import { InvalidCampaignInvite } from '@/components/campaign/InvalidCampaignInvite'
import type { Consent } from '@/payload-types'
import config from '@/payload.config'
import {
  getCampaignInviteConsentState,
  getCampaignInvitePageData,
} from '@/utilities/campaignInvitePageData'
import { hashCampaignInviteToken } from '@/utilities/campaignInvite'
import { hashConsentContent } from '@/utilities/consentContentHash'
import { withInviteConsent } from '../helpers/testDatabaseLease'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})
let activeInviteConsent: Consent | undefined

const consentText = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Consentimento configurado', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
      {
        type: 'list',
        children: [
          {
            type: 'listitem',
            children: [
              {
                type: 'text',
                text: 'Uso limitado à campanha',
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            value: 1,
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        version: 1,
      },
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            children: [{ type: 'text', text: 'Política de privacidade', version: 1 }],
            direction: null,
            fields: {
              linkType: 'custom',
              newTab: true,
              url: 'https://example.com/privacidade',
            },
            format: '',
            indent: 0,
            version: 3,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
}

// Builds the complete public invite graph, including optional consent and terminal state.
const createPublicInviteScenario = async (
  kind: 'login' | 'autopreenchimento',
  options: { used?: boolean; expired?: boolean; consent?: boolean } = {},
) => {
  const consent = activeInviteConsent
  if (!consent) throw new Error('Invite consent fixture scope is missing.')
  const actor = await payload.create({
    collection: 'campaignUser',
    data: {
      name: 'Coordenação de teste',
      email: `${campaignFixtures().value('invite-ui')}@example.com`,
      password: campaignFixtures().value('password'),
      role: 'coordinator',
    },
    depth: 0,
  })
  const municipality = await campaignFixtures().getMunicipality()
  const contact = await payload.create({
    collection: 'contact',
    data: {
      name: 'Maria da Conceição',
      phone: campaignFixtures().phone(),
      email: 'maria@example.com',
      state: 'BA',
      city: 'Salvador',
      gender: 'feminino',
    },
    depth: 0,
  })
  const leadership = await payload.create({
    collection: 'leadership',
    data: {
      contact: contact.id,
      municipalities: [municipality.id],
      sector: 'comunitario',
      sectorNotes: 'Associação do bairro',
      supportStatus: 'engajado',
      notes: 'Avaliação interna protegida',
      consentNote: 'Registro interno protegido',
      consent: options.consent ? consent.id : null,
      consentContentHash: options.consent ? hashConsentContent(consent.text) : null,
      consentedAt: options.consent ? new Date().toISOString() : null,
      createdBy: actor.id,
    },
    depth: 0,
  })
  const token = campaignFixtures().value('raw-public-token-long-enough')
  await payload.create({
    collection: 'campaignInvite',
    data: {
      tokenHash: hashCampaignInviteToken(token),
      leadership: leadership.id,
      kind,
      expiresAt: new Date(Date.now() + (options.expired ? -60_000 : 60_000)).toISOString(),
      usedAt: options.used ? new Date().toISOString() : null,
      createdBy: actor.id,
    },
    depth: 0,
  })
  return { token, contact, leadership }
}

const itWithInviteConsent = (name: string, test: (consent: Consent) => Promise<void>) =>
  it(name, () =>
    withInviteConsent(payload, async (consent) => {
      activeInviteConsent = consent
      try {
        await test(consent)
      } finally {
        activeInviteConsent = undefined
      }
    }),
  )

describe('campaign invite UI contracts', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('keeps consent rendering and invalid-state markup outside the client module graph', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/CampaignInviteForm.tsx'),
      'utf8',
    )
    const consentSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/ConsentText.tsx'),
      'utf8',
    )
    const invalidSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/InvalidCampaignInvite.tsx'),
      'utf8',
    )

    expect(clientSource).toMatch(/^'use client'/)
    expect(clientSource).not.toMatch(/@payloadcms\/richtext-lexical|RichText|consentData/)
    expect(clientSource).not.toContain('campaignInvitePageData')
    expect(consentSource).not.toContain('use client')
    expect(consentSource).not.toContain('@payloadcms/richtext-lexical')
    expect(invalidSource).not.toContain('use client')
  })

  itWithInviteConsent(
    'loads only the whitelisted public preview after hashing the token',
    async () => {
      const fixture = await createPublicInviteScenario('autopreenchimento')

      const preview = await getCampaignInvitePageData(payload, fixture.token)
      const serialized = JSON.stringify(preview)

      expect(preview).toEqual({
        status: 'valid',
        kind: 'autopreenchimento',
        profile: {
          name: fixture.contact.name,
          phone: fixture.contact.phone,
          email: fixture.contact.email,
          gender: fixture.contact.gender,
          sector: 'comunitario',
          sectorNotes: 'Associação do bairro',
        },
        requiresConsent: true,
        consentData: expect.objectContaining({ root: expect.any(Object) }),
      })
      expect(serialized).not.toMatch(
        /supportStatus|Avaliação interna|Registro interno|tokenHash|leadershipId|municipality|user/,
      )
    },
  )

  itWithInviteConsent('makes nonexistent, used, and expired tokens indistinguishable', async () => {
    const used = await createPublicInviteScenario('autopreenchimento', { used: true })
    const expired = await createPublicInviteScenario('autopreenchimento', { expired: true })

    const states = await Promise.all([
      getCampaignInvitePageData(payload, campaignFixtures().value('unknown-token-long-enough')),
      getCampaignInvitePageData(payload, used.token),
      getCampaignInvitePageData(payload, expired.token),
    ])

    expect(states).toEqual([{ status: 'invalid' }, { status: 'invalid' }, { status: 'invalid' }])
    const html = renderToStaticMarkup(createElement(InvalidCampaignInvite))
    expect(html).toContain('Este convite não está disponível')
    expect(html).not.toMatch(/usado|expirado|inexistente/)
  })

  itWithInviteConsent(
    'requires acceptance only when the accepted consent differs from the configured one',
    async (consent) => {
      const current = await createPublicInviteScenario('login', { consent: true })
      await expect(getCampaignInvitePageData(payload, current.token)).resolves.toMatchObject({
        status: 'valid',
        requiresConsent: false,
      })

      const oldConsent = await campaignFixtures().createConsent({
        key: null,
        text: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Versão anterior', version: 1 }],
                direction: null,
                format: '',
                indent: 0,
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
          },
        },
      })
      await payload.update({
        collection: 'leadership',
        id: current.leadership.id,
        data: { consent: oldConsent.id },
      })

      await expect(getCampaignInvitePageData(payload, current.token)).resolves.toMatchObject({
        status: 'valid',
        requiresConsent: true,
        consentData: consent.text,
      })
    },
  )

  it('reports whether the required consent is configured without exposing it to staff UI', async () => {
    const missingConsentPayload = {
      find: async () => ({ docs: [] }),
    } as unknown as Payload
    const configuredConsentPayload = {
      find: async () => ({ docs: [{ id: 1 }] }),
    } as unknown as Payload

    await expect(getCampaignInviteConsentState(missingConsentPayload)).resolves.toEqual({
      configured: false,
    })
    await expect(getCampaignInviteConsentState(configuredConsentPayload)).resolves.toEqual({
      configured: true,
    })
  })

  itWithInviteConsent(
    'renders a minimal accessible public form without internal fields',
    async () => {
      const fixture = await createPublicInviteScenario('login')
      const preview = await getCampaignInvitePageData(payload, fixture.token)
      if (preview.status !== 'valid') throw new Error('Expected a valid preview.')

      const html = renderToStaticMarkup(
        createElement(
          CampaignInviteForm,
          {
            action: async () => ({}),
            kind: preview.kind,
            profile: preview.profile,
            requiresConsent: preview.requiresConsent,
          },
          createElement(ConsentText, {
            data: consentText as typeof preview.consentData,
          }),
        ),
      )

      expect(html).toContain('Oi, Maria da Conceição!')
      expect(html).toContain('name="name"')
      expect(html).toContain('name="phone"')
      expect(html).toContain('name="password"')
      expect(html).toContain('name="passwordConfirmation"')
      expect(html).toContain('Ler o texto completo')
      expect(html).toContain('<ul')
      expect(html).toContain('<li')
      expect(html).toContain('href="https://example.com/privacidade"')
      expect(html).toContain('aria-describedby')
      expect(html).not.toContain(fixture.token)
      expect(html).not.toContain('name="token"')
      expect(html).not.toContain('name="supportStatus"')
      expect(html).not.toContain('name="notes"')
      expect(html).not.toContain('name="consentNote"')
      expect(html).not.toContain('tokenHash')
      expect(html).not.toContain('name="municipalities"')
    },
  )

  itWithInviteConsent(
    'returns structured form errors and does not consume a login invite on mismatch',
    async () => {
      const fixture = await createPublicInviteScenario('login')
      const formData = new FormData()
      formData.set('name', fixture.contact.name)
      formData.set('phone', fixture.contact.phone!)
      formData.set('email', fixture.contact.email ?? '')
      formData.set('password', 'senha-segura')
      formData.set('passwordConfirmation', 'senha-diferente')
      formData.set('consentAccepted', 'on')

      await expect(
        redeemCampaignInviteLoginFormAction(fixture.token, {}, formData),
      ).resolves.toEqual({
        fieldErrors: {
          passwordConfirmation: ['As senhas não coincidem.'],
        },
      })
      await expect(getCampaignInvitePageData(payload, fixture.token)).resolves.toMatchObject({
        status: 'valid',
      })
    },
  )

  itWithInviteConsent('compares password confirmation without trimming either secret', async () => {
    const fixture = await createPublicInviteScenario('login')
    const formData = new FormData()
    formData.set('name', fixture.contact.name)
    formData.set('phone', fixture.contact.phone!)
    formData.set('email', fixture.contact.email ?? '')
    formData.set('password', ' senha-segura ')
    formData.set('passwordConfirmation', 'senha-segura')
    formData.set('consentAccepted', 'on')

    await expect(redeemCampaignInviteLoginFormAction(fixture.token, {}, formData)).resolves.toEqual(
      {
        fieldErrors: {
          passwordConfirmation: ['As senhas não coincidem.'],
        },
      },
    )
    await expect(getCampaignInvitePageData(payload, fixture.token)).resolves.toMatchObject({
      status: 'valid',
    })
  })

  itWithInviteConsent(
    'redeems autofill through the real form action and returns a minimal success state',
    async () => {
      const fixture = await createPublicInviteScenario('autopreenchimento')
      const formData = new FormData()
      formData.set('name', 'Maria Atualizada')
      formData.set('phone', fixture.contact.phone!)
      formData.set('email', fixture.contact.email ?? '')
      formData.set('gender', 'feminino')
      formData.set('sector', 'comunitario')
      formData.set('sectorNotes', 'Dados revisados pela titular')
      formData.set('consentAccepted', 'on')

      await expect(
        redeemCampaignInviteAutofillFormAction(fixture.token, {}, formData),
      ).resolves.toEqual({
        status: 'success',
        message: 'Seus dados foram confirmados com sucesso.',
      })
      await expect(getCampaignInvitePageData(payload, fixture.token)).resolves.toEqual({
        status: 'invalid',
      })
    },
  )

  itWithInviteConsent('renders the actual route without serializing its bearer token', async () => {
    const fixture = await createPublicInviteScenario('login')
    const route = await import('@/app/(campaign)/campanha/convite/[token]/page')
    const page = await route.default({ params: Promise.resolve({ token: fixture.token }) })
    const html = renderToStaticMarkup(page)
    const inviteFormElement = (page as ReactElement<{ children: ReactElement }>).props
      .children as ReactElement<Record<string, unknown>>

    expect(route.dynamic).toBe('force-dynamic')
    expect(route.fetchCache).toBe('force-no-store')
    expect(route.revalidate).toBe(0)
    expect(route.metadata).toMatchObject({
      referrer: 'no-referrer',
      robots: {
        index: false,
        follow: false,
        nocache: true,
      },
    })
    expect(html).toContain('Oi, Maria da Conceição!')
    expect(html).not.toContain(fixture.token)
    expect(html).not.toContain('name="token"')
    expect(Object.keys(inviteFormElement.props).sort()).toEqual([
      'action',
      'children',
      'kind',
      'profile',
      'requiresConsent',
    ])
    const serializedClientProps = JSON.stringify(inviteFormElement.props)
    expect(serializedClientProps).not.toContain(fixture.token)
    expect(serializedClientProps).not.toContain('"type":"root"')
    expect(serializedClientProps).not.toContain('"version":1')
  })

  itWithInviteConsent(
    'renders the same actual route response for unknown, used, and expired tokens',
    async () => {
      const route = await import('@/app/(campaign)/campanha/convite/[token]/page')
      const used = await createPublicInviteScenario('autopreenchimento', { used: true })
      const expired = await createPublicInviteScenario('autopreenchimento', { expired: true })
      const tokens = [
        campaignFixtures().value('unknown-token-long-enough'),
        used.token,
        expired.token,
      ]

      const responses = await Promise.all(
        tokens.map(async (token) =>
          renderToStaticMarkup(await route.default({ params: Promise.resolve({ token }) })),
        ),
      )

      expect(new Set(responses)).toHaveLength(1)
      expect(responses[0]).toContain('Este convite não está disponível')
    },
  )
})
