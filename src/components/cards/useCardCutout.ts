'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { removeCardPhotoBackground } from '@/components/cards/cardCutout'
import type { CardRect } from '@/lib/cardModels'
import { frameCardPhotoOnBbox, type CardPhotoTransform } from '@/lib/cardPhotoTransform'

export type CardCutoutState =
  | { status: 'idle' }
  | { status: 'processing'; phase: 'download' | 'process'; ratio: number }
  | {
      status: 'ready'
      canvas: HTMLCanvasElement
      width: number
      height: number
      /** Initial framing: cutout top on the slot top, centered, covering it. */
      transform: CardPhotoTransform
    }
  | { status: 'error'; reason: 'engine' | 'empty' }

/**
 * S15 — owns the cutout lifecycle for the team model: engine import, progress,
 * degenerate framing (fail-closed), retry with the same file and run-id guards
 * so a stale inference or an unmount never writes state. The engine itself is a
 * page-lifetime singleton in the adapter (re-creating the wasm session per open
 * would cost seconds); each result's masks/bitmap are released there.
 */
export const useCardCutout = (photoWindow: CardRect | undefined) => {
  const [state, setState] = useState<CardCutoutState>({ status: 'idle' })
  const fileRef = useRef<File | null>(null)
  const runRef = useRef(0)

  useEffect(
    () => () => {
      runRef.current += 1
    },
    [],
  )

  const start = useCallback(
    async (file: File) => {
      runRef.current += 1
      const run = runRef.current
      fileRef.current = file
      setState({ status: 'processing', phase: 'download', ratio: 0 })

      const result = await removeCardPhotoBackground(file, (progress) => {
        if (runRef.current !== run) return
        setState({ status: 'processing', phase: progress.phase, ratio: progress.ratio })
      })
      if (runRef.current !== run) return

      if (!result.ok) {
        setState({ status: 'error', reason: result.reason })
        return
      }

      const transform = photoWindow
        ? frameCardPhotoOnBbox(
            { width: result.width, height: result.height },
            photoWindow,
            result.bbox,
          )
        : null
      if (!transform) {
        setState({ status: 'error', reason: 'empty' })
        return
      }

      setState({
        status: 'ready',
        canvas: result.canvas,
        width: result.width,
        height: result.height,
        transform,
      })
    },
    [photoWindow],
  )

  const retry = useCallback(() => {
    const file = fileRef.current
    if (file) void start(file)
  }, [start])

  return { state, start, retry }
}
