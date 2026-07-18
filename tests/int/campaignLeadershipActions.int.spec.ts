// @vitest-environment node

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

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

import {
  createLeadershipFormAction,
  setPrimaryContactFormAction,
  updateLeadershipFormAction,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/leadershipFormActions'
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

const createFormData = (nucleusId: number, name: string, phone: string) => {
  const formData = new FormData()
  formData.set('nucleus', String(nucleusId))
  formData.set('name', name)
  formData.set('phone', phone)
  formData.set('supportStatus', 'engajado')
  return formData
}

describe('campaign leadership exported form actions', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('leaves phone normalization to the leadership domain boundary', () => {
    const formActionSource = readFileSync(
      new URL(
        '../../src/app/(campaign)/campanha/(app)/nucleos/[slug]/leadershipFormActions.ts',
        import.meta.url,
      ),
      'utf8',
    )

    expect(formActionSource).not.toContain('leadershipCreateSchema.parse')
  })

  it('executes create, update, and primary-contact actions in coordinator scope', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const nucleus = await campaignFixtures().createNucleus({ coordinators: [coordinator.id] })
    authState.user = coordinator

    const created = await createLeadershipFormAction(
      {},
      createFormData(nucleus.id, 'Liderança via Action', campaignFixtures().phone()),
    )
    expect(created).toMatchObject({
      status: 'success',
      message: 'Liderança cadastrada com sucesso.',
    })

    const updateData = new FormData()
    updateData.set('nucleus', String(nucleus.id))
    updateData.set('id', String(created.leadershipId))
    updateData.set('sector', 'comunitario')
    updateData.set('supportStatus', 'engajado')
    updateData.set('notes', 'Atualizada pela action exportada')
    await expect(updateLeadershipFormAction({}, updateData)).resolves.toMatchObject({
      status: 'success',
      leadershipId: created.leadershipId,
    })

    const leadership = await payload.findByID({
      collection: 'leadership',
      id: created.leadershipId!,
      depth: 0,
    })
    const primaryData = new FormData()
    primaryData.set('nucleus', String(nucleus.id))
    primaryData.set('contact', String(leadership.contact))
    await expect(setPrimaryContactFormAction({}, primaryData)).resolves.toEqual({
      status: 'success',
      message: 'Contato principal atualizado.',
    })
  })

  it('creates a normalized contact for a region-only nucleus through the form action', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await payload.create({
      collection: 'electoralNucleus',
      data: {
        name: campaignFixtures().value('Núcleo regional action'),
        region: 'Irecê',
        organizationKind: 'territorial',
      } as never,
      depth: 0,
    })
    const phone = campaignFixtures().phone()
    const formData = createFormData(
      nucleus.id,
      'Francisco',
      `(71) ${phone.slice(2, 7)}-${phone.slice(7)}`,
    )
    formData.set('gender', 'outro')
    formData.set('supportStatus', 'a_abordar')
    authState.user = general

    const result = await createLeadershipFormAction({}, formData)
    expect(result).toMatchObject({
      status: 'success',
      message: 'Liderança cadastrada com sucesso.',
    })

    const contacts = await payload.find({
      collection: 'contact',
      where: { phone: { equals: phone } },
      limit: 2,
      depth: 0,
    })
    expect(contacts.totalDocs).toBe(1)
    expect(contacts.docs[0]).toMatchObject({
      name: 'Francisco',
      phone,
      gender: 'outro',
    })
    const leaderships = await payload.find({
      collection: 'leadership',
      where: {
        and: [{ contact: { equals: contacts.docs[0]!.id } }, { nucleus: { equals: nucleus.id } }],
      },
      limit: 2,
      depth: 0,
    })
    expect(leaderships.totalDocs).toBe(1)
    expect(leaderships.docs[0]!.supportStatus).toBe('a_abordar')
  })

  it('applies server defaults when the form action receives only contextual and required fields', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await payload.create({
      collection: 'electoralNucleus',
      data: {
        name: campaignFixtures().value('Núcleo ação mínima'),
        region: 'Irecê',
        organizationKind: 'territorial',
      } as never,
      depth: 0,
    })
    const phone = campaignFixtures().phone()
    const formData = new FormData()
    formData.set('nucleus', String(nucleus.id))
    formData.set('name', 'Liderança mínima')
    formData.set('phone', phone)
    authState.user = general

    const result = await createLeadershipFormAction({}, formData)

    expect(result).toMatchObject({
      status: 'success',
      message: 'Liderança cadastrada com sucesso.',
    })
    const contact = (
      await payload.find({
        collection: 'contact',
        where: { phone: { equals: phone } },
        limit: 1,
        depth: 0,
      })
    ).docs[0]!
    expect(contact).toMatchObject({
      name: 'Liderança mínima',
      phone,
      email: null,
      gender: null,
    })
    const leadership = await payload.findByID({
      collection: 'leadership',
      id: result.leadershipId!,
      depth: 0,
    })
    expect(leadership).toMatchObject({
      supportStatus: 'a_abordar',
      sector: null,
      sectorNotes: null,
      notes: null,
      consentNote: null,
    })
  })

  it('clears blank nullable fields and preserves absent fields through the update action', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const nucleus = await campaignFixtures().createNucleus()
    authState.user = general
    const created = await createLeadershipRecord(payload, general, {
      nucleus: nucleus.id,
      name: 'Liderança com campos internos',
      phone: campaignFixtures().phone(),
      sectorNotes: 'Setor preservado',
      notes: 'Nota para limpar',
      consentNote: 'Consentimento para limpar',
    })
    const formData = new FormData()
    formData.set('id', String(created.id))
    formData.set('notes', '   ')
    formData.set('consentNote', '')

    await expect(updateLeadershipFormAction({}, formData)).resolves.toMatchObject({
      status: 'success',
      leadershipId: created.id,
    })
    await expect(
      payload.findByID({ collection: 'leadership', id: created.id, depth: 0 }),
    ).resolves.toMatchObject({
      sectorNotes: 'Setor preservado',
      notes: null,
      consentNote: null,
    })
  })

  it('returns denial states for out-of-scope coordinator actions', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const coordinator = await campaignFixtures().createCampaignUser('coordenador')
    const otherCoordinator = await campaignFixtures().createCampaignUser('coordenador')
    const assigned = await campaignFixtures().createNucleus({ coordinators: [coordinator.id] })
    const other = await campaignFixtures().createNucleus({ coordinators: [otherCoordinator.id] })
    const otherLeadership = await createLeadershipRecord(payload, general, {
      nucleus: other.id,
      name: 'Liderança fora do escopo',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })
    authState.user = coordinator

    await expect(
      createLeadershipFormAction(
        {},
        createFormData(other.id, 'Criação negada', campaignFixtures().phone()),
      ),
    ).resolves.toMatchObject({ message: expect.stringContaining('Não foi possível') })

    const updateData = new FormData()
    updateData.set('nucleus', String(assigned.id))
    updateData.set('id', String(otherLeadership.id))
    updateData.set('supportStatus', 'engajado')
    await expect(updateLeadershipFormAction({}, updateData)).resolves.toMatchObject({
      message: expect.stringContaining('Não foi possível'),
    })

    const primaryData = new FormData()
    primaryData.set('nucleus', String(other.id))
    primaryData.set('contact', String(otherLeadership.contact))
    await expect(setPrimaryContactFormAction({}, primaryData)).resolves.toMatchObject({
      message: expect.stringContaining('Não foi possível'),
    })
  })

  it('returns denial states when a liderança invokes staff actions', async () => {
    const general = await campaignFixtures().createCampaignUser('geral')
    const leadershipUser = await campaignFixtures().createCampaignUser('lideranca')
    const nucleus = await campaignFixtures().createNucleus()
    const existing = await createLeadershipRecord(payload, general, {
      nucleus: nucleus.id,
      name: 'Registro protegido',
      phone: campaignFixtures().phone(),
      supportStatus: 'engajado',
    })
    authState.user = leadershipUser

    await expect(
      createLeadershipFormAction(
        {},
        createFormData(nucleus.id, 'Criação por liderança', campaignFixtures().phone()),
      ),
    ).resolves.toMatchObject({
      message: 'Somente a coordenação pode gerenciar lideranças.',
    })

    const updateData = new FormData()
    updateData.set('nucleus', String(nucleus.id))
    updateData.set('id', String(existing.id))
    updateData.set('supportStatus', 'engajado')
    await expect(updateLeadershipFormAction({}, updateData)).resolves.toMatchObject({
      message: 'Somente a coordenação pode gerenciar lideranças.',
    })

    const primaryData = new FormData()
    primaryData.set('nucleus', String(nucleus.id))
    primaryData.set('contact', String(existing.contact))
    await expect(setPrimaryContactFormAction({}, primaryData)).resolves.toMatchObject({
      message: expect.stringContaining('Não foi possível'),
    })
  })
})
