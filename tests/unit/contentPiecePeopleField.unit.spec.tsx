import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ContentPiecePeopleField } from '@/components/campaign/content/ContentPiecePeopleField'

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
})

afterEach(cleanup)

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

const renderField = (props: {
  leaders?: { id: number; label: string }[]
  publicFigures?: string[]
  searchLeaders?: (query: string) => Promise<{ id: number; label: string }[]>
}) =>
  render(
    createElement(ContentPiecePeopleField, {
      leaders: props.leaders ?? [],
      publicFigures: props.publicFigures ?? [],
      searchLeaders: props.searchLeaders ?? vi.fn(async () => []),
    }),
  )

const hiddenValues = (container: HTMLElement, name: string): string[] =>
  [...container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].map(
    (input) => input.value,
  )

describe('ContentPiecePeopleField (S37)', () => {
  it('renders the picked people as chips plus hidden inputs, and the empty state when none', () => {
    const { container } = renderField({
      leaders: [{ id: 7, label: 'Maria Silva' }],
      publicFigures: ['Dra. Elaine'],
    })

    expect(screen.getByRole('heading', { name: 'Quem aparece na peça' })).toBeTruthy()
    expect(screen.getByText('Curadoria humana')).toBeTruthy()
    expect(hiddenValues(container, 'leaderIds')).toEqual(['7'])
    expect(hiddenValues(container, 'publicFigures')).toEqual(['Dra. Elaine'])
    expect(screen.queryByText(/Ninguém marcado/)).toBeNull()

    cleanup()
    renderField({})
    expect(screen.getByText(/Ninguém marcado/)).toBeTruthy()
  })

  it('searches leaders through the async action, adds and removes the chip', async () => {
    const searchLeaders = vi.fn(async (query: string) => [{ id: 1, label: `Liderança ${query}` }])
    const { container } = renderField({ searchLeaders })

    fireEvent.change(screen.getByLabelText('Buscar liderança'), { target: { value: 'Ma' } })
    const option = await screen.findByRole('option', { name: /Liderança Ma/ })
    expect(searchLeaders).toHaveBeenCalledWith('Ma')

    fireEvent.click(option)
    await waitFor(() => expect(hiddenValues(container, 'leaderIds')).toEqual(['1']))
    expect(screen.getByLabelText('Remover Liderança Ma')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Remover Liderança Ma'))
    await waitFor(() => expect(hiddenValues(container, 'leaderIds')).toEqual([]))
  })

  it('gates the leader search on two characters and reports an empty result', async () => {
    const searchLeaders = vi.fn(async () => [])
    renderField({ searchLeaders })

    fireEvent.change(screen.getByLabelText('Buscar liderança'), { target: { value: 'M' } })
    expect(screen.getByText('Digite ao menos dois caracteres para buscar.')).toBeTruthy()
    await waitFor(() => expect(searchLeaders).not.toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Buscar liderança'), { target: { value: 'Maria' } })
    await waitFor(() => expect(searchLeaders).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Nenhum resultado encontrado.')).toBeTruthy()
  })

  it('canonicalizes a catalog figure and accepts free text through "Usar"', async () => {
    const { container } = renderField({ publicFigures: [] })

    fireEvent.change(screen.getByLabelText('Buscar ou digitar uma figura pública'), {
      target: { value: 'elaine' },
    })
    fireEvent.click(screen.getByRole('option', { name: /Dra\. Elaine/ }))
    await waitFor(() => expect(hiddenValues(container, 'publicFigures')).toEqual(['Dra. Elaine']))

    fireEvent.change(screen.getByLabelText('Buscar ou digitar uma figura pública'), {
      target: { value: 'Personalidade Local' },
    })
    fireEvent.click(screen.getByRole('option', { name: /Usar «Personalidade Local»/ }))
    await waitFor(() =>
      expect(hiddenValues(container, 'publicFigures')).toEqual([
        'Dra. Elaine',
        'Personalidade Local',
      ]),
    )
  })
})
