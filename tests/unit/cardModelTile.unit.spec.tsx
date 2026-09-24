import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CardModelTile } from '@/components/cards/CardModelTile'
import { CARD_MODELS } from '@/lib/cardModels'

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean
  priority?: boolean
}

vi.mock('next/image', () => ({
  default: ({ alt, fill: _fill, priority: _priority, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

// The name-tile canvas draws through the real font/canvas pipeline (jsdom has
// no canvas); the tile geometry under test does not depend on it.
vi.mock('@/components/cards/CardNameTileCanvas', () => ({
  CardNameTileCanvas: () => null,
}))

afterEach(cleanup)

/**
 * WebKit #265243: `aspect-ratio` on a flex item loses its height on relayout
 * (fixed only in WebKit main, 2026-05). The model tile cannot depend on
 * `aspect-ratio` for its box — the ratio must come from an in-flow spacer
 * (percentage padding), which every engine resolves against the tile width.
 */
describe('CardModelTile — proporção do tile não usa aspect-ratio', () => {
  it.each(CARD_MODELS.map((model) => [model.id, model] as const))(
    'tile %s tira a altura do espaçador de proporção',
    (_id, model) => {
      const { container } = render(<CardModelTile model={model} fontFamily="Brexter" />)

      const spacer = container.querySelector<HTMLElement>('[data-card-tile-ratio]')
      expect(spacer).toBeTruthy()

      const ratio = Number(spacer!.dataset.cardTileRatio)
      expect(ratio).toBeCloseTo(model.height / model.width, 6)
      // The computed style serializes integer percentages without decimals.
      expect(parseFloat(spacer!.style.paddingBottom)).toBeCloseTo(ratio * 100, 3)

      // The tile box (the spacer parent) must not carry the WebKit-fragile
      // `aspect-ratio`; nothing inside the tile may either.
      expect(spacer!.parentElement!.getAttribute('style') ?? '').not.toContain('aspect-ratio')
      expect(container.innerHTML).not.toContain('aspect-ratio')
    },
  )
})
