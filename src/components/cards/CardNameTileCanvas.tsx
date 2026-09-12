'use client'

import { useEffect, useRef } from 'react'

import { ensureCardFont } from '@/components/cards/cardCanvas'
import { CARD_NAME_TILE_PLACEHOLDER } from '@/components/cards/cardCopy'
import type { CardModel } from '@/lib/cardModels'
import { fitCardName } from '@/lib/cardNameFit'
import { createCardMeasure, drawCardName } from '@/lib/cardRender'

/**
 * S14 — the name-model tile preview: a transparent canvas over the base image
 * that draws `SEU NOME` with the exact composer pipeline (same fit, same slot,
 * same left border), so the tile cannot drift from the generated card. Draws
 * only after the real font loads — measuring with the fallback would lie.
 */
export const CardNameTileCanvas = ({
  model,
  fontFamily,
}: {
  model: CardModel
  fontFamily: string
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false

    const draw = async () => {
      const fontReady = await ensureCardFont(fontFamily)
      if (!fontReady || cancelled) return

      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return

      const fit = fitCardName(CARD_NAME_TILE_PLACEHOLDER, createCardMeasure(ctx, fontFamily))
      if (!fit.ok) return

      ctx.clearRect(0, 0, model.width, model.height)
      drawCardName(ctx, { fit, fontFamily })
    }

    void draw()
    return () => {
      cancelled = true
    }
  }, [model.width, model.height, fontFamily])

  return (
    <canvas
      ref={canvasRef}
      width={model.width}
      height={model.height}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  )
}
