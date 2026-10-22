import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CampaignMobileMenu } from '@/components/CampaignMobileMenu'

afterEach(cleanup)

const openMenu = () => {
  const trigger = screen.getByRole('button', { name: 'Abrir menu' })
  fireEvent.click(trigger)
  return trigger
}

describe('CampaignMobileMenu', () => {
  it('abre no trigger e move o foco para o primeiro link', () => {
    render(<CampaignMobileMenu variant="home" />)

    const trigger = openMenu()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    const nav = screen.getByRole('navigation', { name: 'Navegação móvel' })
    expect(nav).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Artigos' }).getAttribute('href')).toBe('/artigos')
    expect(screen.getByRole('link', { name: 'Bandeiras' }).getAttribute('href')).toBe('#bandeiras')
    expect(screen.getByRole('link', { name: 'Fotos' }).getAttribute('href')).toBe('/fotos')
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/')
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Artigos' }))
  })

  it('usa o hash absoluto da home no menu das páginas internas', () => {
    render(<CampaignMobileMenu variant="internal" />)

    openMenu()
    expect(screen.getByRole('link', { name: 'Bandeiras' }).getAttribute('href')).toBe('/#bandeiras')
  })

  it('fecha no Escape e devolve o foco ao trigger', () => {
    render(<CampaignMobileMenu variant="internal" />)

    const trigger = openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('navigation', { name: 'Navegação móvel' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('fecha no clique fora e no X', () => {
    render(<CampaignMobileMenu variant="home" />)

    openMenu()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('navigation', { name: 'Navegação móvel' })).toBeNull()

    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    expect(screen.queryByRole('navigation', { name: 'Navegação móvel' })).toBeNull()
  })

  it('fecha ao escolher um link', () => {
    render(<CampaignMobileMenu variant="home" />)

    openMenu()
    fireEvent.click(screen.getByRole('link', { name: 'Artigos' }))
    expect(screen.queryByRole('navigation', { name: 'Navegação móvel' })).toBeNull()
  })

  it('marca a seção atual no menu móvel', () => {
    render(<CampaignMobileMenu variant="internal" current="fotos" />)

    openMenu()
    expect(screen.getByRole('link', { name: 'Fotos' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Artigos' }).getAttribute('aria-current')).toBeNull()
  })
})
