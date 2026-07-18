import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  createLeadershipFormAction,
  setPrimaryContactFormAction,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/leadershipFormActions'
import { PrimaryContactFormFields } from '@/components/campaign/LeadershipPrimaryContactAction'
import {
  LeadershipFormFeedback,
  LeadershipFormFields,
  LeadershipHiddenFields,
} from '@/components/campaign/LeadershipForm'
import { getLeadershipInviteAvailability } from '@/components/campaign/LeadershipInviteDialog'
import { LeadershipInviteDialogShell } from '@/components/campaign/LeadershipInviteDialogShell'
import { LeadershipList } from '@/components/campaign/LeadershipList'
import { getLeadershipPanelKind } from '@/components/campaign/LeadershipPanelIsland'
import {
  buildLeadershipFilterHref,
  buildLeadershipPanelHref,
  filterLeaderships,
  getLeadershipPanelFocusTargetId,
  parseLeadershipFilterState,
  parseLeadershipPanelState,
} from '@/utilities/leadershipUi'
import {
  leadershipLeaderSelect,
  leadershipStaffListSelect,
  leadershipStaffSelect,
  toLeadershipEditViewModel,
  toLeadershipPageData,
  toSelectedLeadershipViewModel,
} from '@/utilities/leadershipViewModels'

const leadershipDocument = {
  id: 31,
  contact: {
    id: 41,
    name: 'Maria Aparecida',
    phone: '71976543210',
    email: 'maria@example.com',
    gender: 'feminino',
  },
  nucleus: 12,
  sector: 'religioso',
  sectorNotes: 'Pastoral local',
  supportStatus: 'engajado',
  notes: 'Avaliação interna sigilosa',
  consentNote: 'Registro interno sigiloso',
  consent: { id: 8 },
  user: null,
  createdBy: 2,
  updatedAt: '',
  createdAt: '',
} as const

describe('campaign leadership UI contracts', () => {
  it('parses shareable leadership filters and rejects unsupported values', () => {
    expect(
      parseLeadershipFilterState({
        leadershipQ: '  Maria  ',
        leadershipStatus: 'engajado',
        leadershipSector: 'religioso',
        leadershipPage: '3',
      }),
    ).toEqual({
      q: 'Maria',
      status: 'engajado',
      sector: 'religioso',
      page: 3,
    })

    expect(
      parseLeadershipFilterState({
        leadershipStatus: 'invalido',
        leadershipSector: 'invalido',
        leadershipPage: '10001',
      }),
    ).toEqual({})
  })

  it('filters leaderships by normalized text, status, and sector', () => {
    const leaderships = toLeadershipPageData(
      [
        leadershipDocument,
        {
          ...leadershipDocument,
          id: 32,
          contact: {
            ...leadershipDocument.contact,
            id: 42,
            name: 'João Silva',
            phone: '71987654321',
          },
          sector: 'sindical',
          supportStatus: 'a_abordar',
        },
      ] as never,
      'coordenador',
    ).leaderships

    expect(filterLeaderships(leaderships, { q: 'aparecida', status: 'engajado' })).toHaveLength(1)
    expect(filterLeaderships(leaderships, { q: '9876', sector: 'sindical' })[0]?.name).toBe(
      'João Silva',
    )
    expect(buildLeadershipFilterHref('nucleo-chapada', { q: 'Maria', status: 'engajado' })).toBe(
      '/campanha/nucleos/nucleo-chapada?tab=leaderships&leadershipQ=Maria&leadershipStatus=engajado',
    )
    expect(buildLeadershipFilterHref('nucleo-chapada', { q: 'Maria', page: 2 })).toBe(
      '/campanha/nucleos/nucleo-chapada?tab=leaderships&leadershipQ=Maria&leadershipPage=2',
    )
  })

  it('uses separate Payload selects and never serializes internal evaluation to liderança', () => {
    expect(JSON.stringify(leadershipLeaderSelect)).not.toContain('supportStatus')
    expect(JSON.stringify(leadershipLeaderSelect)).not.toContain('"notes"')
    expect(JSON.stringify(leadershipStaffListSelect)).not.toContain('"notes"')
    expect(JSON.stringify(leadershipStaffSelect)).toContain('supportStatus')

    const leaderView = toLeadershipPageData([leadershipDocument] as never, 'lideranca')
    const serialized = JSON.stringify(leaderView)

    expect(serialized).toContain('Maria Aparecida')
    expect(serialized).not.toContain('supportStatus')
    expect(serialized).not.toContain('Avaliação interna sigilosa')
    expect(serialized).not.toContain('Registro interno sigiloso')
    expect(leaderView.leaderships[0]).toEqual({
      name: 'Maria Aparecida',
      phone: '71976543210',
      email: 'maria@example.com',
      sector: 'religioso',
      confirmedByPerson: false,
    })
    expect(serialized).not.toContain('contactId')
    expect(serialized).not.toContain('"id"')
    expect(serialized).not.toContain('gender')
    expect(serialized).not.toContain('sectorNotes')
  })

  it('serializes only the selected record fields needed by the edit form island', () => {
    const selected = toSelectedLeadershipViewModel(leadershipDocument as never)!
    const serialized = JSON.stringify(toLeadershipEditViewModel(selected))

    expect(serialized).toContain('"id":31')
    expect(serialized).toContain('supportStatus')
    for (const privateToServerContent of [
      'Maria Aparecida',
      '71976543210',
      'maria@example.com',
      'contactId',
      'gender',
      'hasAppAccess',
    ]) {
      expect(serialized).not.toContain(privateToServerContent)
    }
  })

  it('renders scoped desktop rows and mobile cards with the invite action', () => {
    const staffView = toLeadershipPageData([leadershipDocument] as never, 'coordenador')
    const html = renderToStaticMarkup(
      createElement(LeadershipList, {
        leaderships: staffView.leaderships,
        primaryContactId: 41,
        nucleusSlug: 'nucleo-chapada',
        filters: { q: 'Maria', page: 2 },
      }),
    )

    expect(html).toContain('data-view="leadership-list"')
    expect(html).toContain('data-responsive-views="desktop-list mobile-cards"')
    expect(html).toContain('Maria Aparecida')
    expect(html).toContain('Religioso')
    expect(html).toContain('Engajado')
    expect(html).toContain('Contato principal')
    expect(html).toContain('href="/campanha/nucleos/nucleo-chapada?tab=leaderships')
    expect(html).toContain('leadershipQ=Maria')
    expect(html).toContain('leadershipPage=2')
    expect(html).toContain('leadership=31')

    const inviteHtml = renderToStaticMarkup(
      createElement(LeadershipInviteDialogShell, {
        leadershipId: 31,
        supportStatus: 'engajado',
        consentConfigured: false,
      }),
    )
    expect(inviteHtml).toContain('Convidar pelo WhatsApp')
    expect(inviteHtml).toContain('disabled=""')
    expect(inviteHtml).toContain('data-variant="default"')
    expect(inviteHtml).toContain('disabled:opacity-50')
    expect(inviteHtml).toContain('Consentimento ainda não configurado')

    const activeInviteHtml = renderToStaticMarkup(
      createElement(LeadershipInviteDialogShell, {
        leadershipId: 31,
        supportStatus: 'engajado',
        consentConfigured: true,
      }),
    )
    expect(activeInviteHtml).toContain('data-variant="default"')
    expect(activeInviteHtml).toContain('bg-primary')
    expect(activeInviteHtml).not.toContain('bg-secondary')
    expect(
      getLeadershipInviteAvailability({
        supportStatus: 'a_abordar',
        consentConfigured: true,
      }),
    ).toEqual({
      canInvite: true,
      canInviteLogin: false,
    })
    expect(
      getLeadershipInviteAvailability({
        supportStatus: 'engajado',
        consentConfigured: true,
      }),
    ).toEqual({
      canInvite: true,
      canInviteLogin: true,
    })
  })

  it('renders accessible create fields with linked errors and 44px targets', () => {
    const html = renderToStaticMarkup(
      createElement(LeadershipFormFields, {
        mode: 'create',
        values: {
          name: 'Francisco',
          phone: '71988671313',
          gender: 'outro',
        },
        fieldErrors: {
          name: ['Informe o nome da liderança.'],
          phone: ['Celular brasileiro inválido.'],
          gender: ['Gênero inválido.'],
          sector: ['Setor inválido.'],
          sectorNotes: ['Observação de setor inválida.'],
          supportStatus: ['Status inválido.'],
          notes: ['Observação interna inválida.'],
          consentNote: ['Registro inválido.'],
        },
      }),
    )

    expect(html).toContain('Nome')
    expect(html).toContain('Celular (WhatsApp)')
    expect(html).toContain('value="Francisco"')
    expect(html).toContain('value="(71) 98867-1313"')
    expect(html).not.toContain('value="nao_informado"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="leadership-name-error"')
    expect(html).toContain('id="leadership-name-error"')
    expect(html).toContain('min-h-11')
    expect(html).toContain('Observações internas')
    for (const field of [
      'gender',
      'sector',
      'sectorNotes',
      'supportStatus',
      'notes',
      'consentNote',
    ]) {
      expect(html).toContain(`aria-describedby="leadership-${field}-error`)
      expect(html).toContain(`id="leadership-${field}-error"`)
    }

    const hiddenHtml = renderToStaticMarkup(
      createElement(LeadershipHiddenFields, {
        nucleusId: 12,
        leadershipId: 31,
        fieldErrors: {
          nucleus: ['Núcleo inválido.'],
          id: ['Liderança inválida.'],
        },
      }),
    )
    expect(hiddenHtml).toContain('name="nucleus"')
    expect(hiddenHtml).toContain('aria-describedby="leadership-nucleus-error"')
    expect(hiddenHtml).toContain('id="leadership-nucleus-error"')
    expect(hiddenHtml).toContain('name="id"')
    expect(hiddenHtml).toContain('aria-describedby="leadership-id-error"')
    expect(hiddenHtml).toContain('id="leadership-id-error"')

    const feedbackHtml = renderToStaticMarkup(
      createElement(LeadershipFormFeedback, {
        message: 'Falha geral.',
        formErrors: ['Revise o formulário.'],
      }),
    )
    expect(feedbackHtml).toContain('id="leadership-form-error"')
    expect(feedbackHtml).toContain('Falha geral.')
    expect(feedbackHtml).toContain('Revise o formulário.')
  })

  it('links primary-contact hidden field errors to the form fallback', () => {
    const html = renderToStaticMarkup(
      createElement(PrimaryContactFormFields, {
        nucleusId: 12,
        contactId: 41,
        state: {
          message: 'Não foi possível atualizar.',
          fieldErrors: {
            nucleus: ['Núcleo inválido.'],
            contact: ['Liderança inválida.'],
          },
        },
      }),
    )

    expect(html).toContain('name="nucleus"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="primary-contact-nucleus-error"')
    expect(html).toContain('id="primary-contact-nucleus-error"')
    expect(html).toContain('name="contact"')
    expect(html).toContain('aria-describedby="primary-contact-contact-error"')
    expect(html).toContain('id="primary-contact-contact-error"')
    expect(html).toContain('id="primary-contact-form-error"')
    expect(html).toContain('Núcleo inválido.')
    expect(html).toContain('Liderança inválida.')
  })

  it('uses a mobile Drawer and desktop Sheet for the leadership panel', () => {
    expect(getLeadershipPanelKind(true)).toBe('drawer')
    expect(getLeadershipPanelKind(false)).toBe('sheet')
  })

  it('uses the Base UI Drawer with swipe semantics', () => {
    const drawerSource = readFileSync(
      resolve(process.cwd(), 'src/components/ui/Drawer.tsx'),
      'utf8',
    )
    const panelSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/LeadershipPanelIsland.tsx'),
      'utf8',
    )

    expect(drawerSource).toContain("from '@base-ui/react/drawer'")
    expect(drawerSource).toContain('data-[swipe-direction=down]')
    expect(drawerSource).not.toContain('vaul')
    expect(panelSource).toContain('showSwipeHandle')
  })

  it('drives selection, create, edit, close, and history from canonical URLs', () => {
    expect(
      parseLeadershipPanelState({ leadership: '31', editLeadership: '1' }, 'coordenador'),
    ).toEqual({ mode: 'edit', leadershipId: 31 })
    expect(
      parseLeadershipPanelState({ newLeadership: '1', leadership: '31' }, 'coordenador'),
    ).toEqual({ mode: 'create' })
    expect(parseLeadershipPanelState({ leadership: '31' }, 'lideranca')).toEqual({ mode: 'closed' })

    const filters = { q: 'Maria', status: 'engajado', page: 2 } as const
    const viewHref = buildLeadershipPanelHref('nucleo-chapada', filters, {
      mode: 'view',
      leadershipId: 31,
    })
    const editHref = buildLeadershipPanelHref('nucleo-chapada', filters, {
      mode: 'edit',
      leadershipId: 31,
    })
    const createHref = buildLeadershipPanelHref(
      'nucleo-chapada',
      { ...filters, sector: 'religioso' },
      { mode: 'create' },
    )
    const closeHref = buildLeadershipPanelHref('nucleo-chapada', filters, { mode: 'closed' })

    expect(viewHref).toContain('tab=leaderships')
    expect(viewHref).toContain('leadership=31')
    expect(editHref).toContain('editLeadership=1')
    expect(createHref).toBe(
      '/campanha/nucleos/nucleo-chapada?tab=leaderships&leadershipQ=Maria&leadershipStatus=engajado&leadershipSector=religioso&leadershipPage=2&newLeadership=1',
    )
    expect(closeHref).not.toContain('leadership=')
    expect(closeHref).not.toContain('editLeadership=')
    expect(closeHref).not.toContain('newLeadership=')
    expect(getLeadershipPanelFocusTargetId(31)).toBe('leadership-row-31')
  })

  it('keeps rows, detail, filters, and pagination outside client boundaries', () => {
    for (const file of [
      'LeadershipNetwork.tsx',
      'LeadershipList.tsx',
      'LeadershipRow.tsx',
      'LeadershipDetail.tsx',
    ]) {
      const source = readFileSync(resolve(process.cwd(), `src/components/campaign/${file}`), 'utf8')
      expect(source.startsWith("'use client'")).toBe(false)
    }

    const islandSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/LeadershipPanelIsland.tsx'),
      'utf8',
    )
    expect(islandSource.startsWith("'use client'")).toBe(true)
    expect(islandSource).toContain('children')
    expect(islandSource).not.toContain('leaderships')
    expect(islandSource).not.toContain('pageData')
    expect(islandSource).not.toContain('useEffect')
  })

  it('keeps the Sheet close control at least 44 by 44 pixels', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/Sheet.tsx'), 'utf8')
    expect(source).toContain('size="icon-lg"')
    expect(source).toContain('Fechar')
  })

  it('returns structured accessible errors before invoking mutations', async () => {
    const createData = new FormData()
    createData.set('nucleus', '12')
    createData.set('name', '')
    createData.set('phone', '123')
    createData.set('supportStatus', 'engajado')

    await expect(createLeadershipFormAction({}, createData)).resolves.toMatchObject({
      fieldErrors: {
        name: expect.any(Array),
        phone: ['Celular brasileiro inválido.'],
      },
      values: {
        name: undefined,
        phone: '123',
        supportStatus: 'engajado',
      },
    })

    const primaryData = new FormData()
    primaryData.set('nucleus', '12')
    primaryData.set('contact', 'inválido')
    await expect(setPrimaryContactFormAction({}, primaryData)).resolves.toEqual({
      fieldErrors: {
        contact: ['Não foi possível identificar a liderança. Atualize a página e tente novamente.'],
      },
    })
  })
})
