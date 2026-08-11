// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { CampaignUser } from '@/payload-types'

const authState = vi.hoisted(() => ({
  user: null as CampaignUser | null,
}))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: async () => authState.user,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { updateLeadershipInternalFormAction } from '@/app/(campaign)/campanha/(app)/liderancas/[id]/formActions'
import { createLeadershipFormAction } from '@/app/(campaign)/campanha/(app)/liderancas/nova/formActions'
import { createLeadershipRecord } from '@/app/(campaign)/campanha/actions/leadership'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const createFormData = (municipalityIds: number[], name: string, phone: string) => {
  const formData = new FormData()
  for (const municipalityId of municipalityIds)
    formData.append('municipalities', String(municipalityId))
  formData.set('name', name)
  formData.append('phones', phone)
  formData.set('supportStatus', 'engajado')
  return formData
}

const isNextRedirect = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')

const expectRedirectTo = async (action: Promise<unknown>, path: string): Promise<void> => {
  try {
    await action
    throw new Error('Expected the form action to redirect on success.')
  } catch (error) {
    if (!isNextRedirect(error)) throw error
    expect(String((error as { digest: string }).digest)).toContain(path)
  }
}

describe('campaign leadership exported form actions', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('creates a leadership and redirects to its detail page in advisor scope', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const municipality = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(municipality, [advisor])
    authState.user = advisor
    const phone = campaignFixtures().phone()

    try {
      await createLeadershipFormAction(
        {},
        createFormData([municipality.id], 'Liderança via Action', phone),
      )
      throw new Error('Expected the form action to redirect on success.')
    } catch (error) {
      if (!isNextRedirect(error)) throw error
    }

    const contacts = await payload.find({
      collection: 'contact',
      where: { 'phones.value': { equals: phone } },
      limit: 2,
      depth: 0,
    })
    expect(contacts.totalDocs).toBe(1)
    const leaderships = await payload.find({
      collection: 'leadership',
      where: { contact: { equals: contacts.docs[0]!.id } },
      limit: 2,
      depth: 0,
    })
    expect(leaderships.totalDocs).toBe(1)
    expect(leaderships.docs[0]!.supportStatus).toBe('engajado')
    expect(leaderships.docs[0]!.createdBy).toBe(advisor.id)
  })

  it('creates a normalized contact through the form action', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()
    const formData = createFormData(
      [municipality.id],
      'Francisco',
      `(71) ${phone.slice(2, 7)}-${phone.slice(7)}`,
    )
    formData.set('supportStatus', 'a_abordar')
    authState.user = coordinator

    await expectRedirectTo(createLeadershipFormAction({}, formData), '/campanha/liderancas/')

    const contacts = await payload.find({
      collection: 'contact',
      where: { 'phones.value': { equals: phone } },
      limit: 2,
      depth: 0,
    })
    expect(contacts.totalDocs).toBe(1)
    expect(contacts.docs[0]).toMatchObject({
      name: 'Francisco',
      phones: [{ value: phone }],
    })
    const leaderships = await payload.find({
      collection: 'leadership',
      where: {
        and: [
          { contact: { equals: contacts.docs[0]!.id } },
          { municipalities: { in: [municipality.id] } },
        ],
      },
      limit: 2,
      depth: 0,
    })
    expect(leaderships.totalDocs).toBe(1)
    expect(leaderships.docs[0]!.supportStatus).toBe('a_abordar')
  })

  it('applies server defaults when the form action receives only required fields', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()
    const formData = new FormData()
    formData.append('municipalities', String(municipality.id))
    formData.set('name', 'Liderança mínima')
    formData.append('phones', phone)
    authState.user = coordinator

    await expectRedirectTo(createLeadershipFormAction({}, formData), '/campanha/liderancas/')

    const contact = (
      await payload.find({
        collection: 'contact',
        where: { 'phones.value': { equals: phone } },
        limit: 1,
        depth: 0,
      })
    ).docs[0]!
    expect(contact).toMatchObject({
      name: 'Liderança mínima',
      phones: [{ value: phone }],
      email: null,
      gender: null,
    })
    const leadership = (
      await payload.find({
        collection: 'leadership',
        where: { contact: { equals: contact.id } },
        limit: 1,
        depth: 0,
      })
    ).docs[0]!
    expect(leadership).toMatchObject({
      supportStatus: 'a_abordar',
      exclusive: true,
      notes: null,
    })
  })

  it('surfaces the duplicate-person message through the create form action', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const otherMunicipality = await campaignFixtures().getMunicipality()
    const phone = campaignFixtures().phone()
    authState.user = coordinator
    await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Pessoa já cadastrada',
      phones: [phone],
      supportStatus: 'engajado',
    })

    await expect(
      createLeadershipFormAction({}, createFormData([otherMunicipality.id], 'Duplicada', phone)),
    ).resolves.toMatchObject({
      message:
        'Esta pessoa já está cadastrada como liderança. Edite a ficha existente para vincular novos municípios.',
    })
  })

  it('clears blank nullable fields and preserves absent fields through the update action', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    authState.user = coordinator
    const created = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Liderança com campos internos',
      phones: [campaignFixtures().phone()],
      exclusive: true,
      notes: 'Nota para limpar',
    })
    const formData = new FormData()
    formData.set('leadershipId', String(created.id))
    formData.append('municipalities', String(municipality.id))
    formData.set('notes', '   ')

    await expect(updateLeadershipInternalFormAction({}, formData)).resolves.toMatchObject({
      status: 'success',
      message: 'Ficha da liderança atualizada.',
    })
    await expect(
      payload.findByID({ collection: 'leadership', id: created.id, depth: 0 }),
    ).resolves.toMatchObject({
      exclusive: false,
      notes: null,
    })
  })

  it('creates with exclusive true by default and honors an explicit false', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    const defaulted = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Liderança exclusiva default',
      phones: [campaignFixtures().phone()],
    })
    expect(defaulted.exclusive).toBe(true)

    const divided = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Liderança dividida',
      phones: [campaignFixtures().phone()],
      exclusive: false,
    })
    expect(divided.exclusive).toBe(false)
  })

  it('returns denial states for out-of-scope advisor actions', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const otherAdvisor = await campaignFixtures().createCampaignUser('advisor')
    const assigned = await campaignFixtures().getMunicipality()
    const other = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(assigned, [advisor])
    await campaignFixtures().assignMunicipalityAdvisors(other, [otherAdvisor])
    const otherLeadership = await createLeadershipRecord(payload, coordinator, {
      municipalities: [other.id],
      name: 'Liderança fora do escopo',
      phones: [campaignFixtures().phone()],
      supportStatus: 'engajado',
    })
    authState.user = advisor

    await expect(
      createLeadershipFormAction(
        {},
        createFormData([other.id], 'Criação negada', campaignFixtures().phone()),
      ),
    ).resolves.toMatchObject({
      message: 'Você só pode vincular lideranças aos municípios que assessora.',
    })

    const updateData = new FormData()
    updateData.set('leadershipId', String(otherLeadership.id))
    updateData.append('municipalities', String(other.id))
    updateData.set('supportStatus', 'engajado')
    await expect(updateLeadershipInternalFormAction({}, updateData)).resolves.toMatchObject({
      message: expect.stringContaining('Não foi possível'),
    })
  })

  it('returns denial states when a leader invokes staff actions', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leaderAccount = await campaignFixtures().createCampaignUser('leader')
    const municipality = await campaignFixtures().getMunicipality()
    const existing = await createLeadershipRecord(payload, coordinator, {
      municipalities: [municipality.id],
      name: 'Registro protegido',
      phones: [campaignFixtures().phone()],
      supportStatus: 'engajado',
    })
    authState.user = leaderAccount

    await expect(
      createLeadershipFormAction(
        {},
        createFormData([municipality.id], 'Criação por liderança', campaignFixtures().phone()),
      ),
    ).resolves.toMatchObject({
      message: 'Somente a coordenação e a assessoria podem gerenciar lideranças.',
    })

    const updateData = new FormData()
    updateData.set('leadershipId', String(existing.id))
    updateData.append('municipalities', String(municipality.id))
    updateData.set('supportStatus', 'engajado')
    await expect(updateLeadershipInternalFormAction({}, updateData)).resolves.toMatchObject({
      message: 'Somente a coordenação e a assessoria podem gerenciar lideranças.',
    })
  })
})
