import type { Detection } from '@mediapipe/tasks-vision'
import { describe, expect, it } from 'vitest'

import { readLargestFaceBox } from '@/components/cards/cardCutout'

const detection = (originX: number, originY: number, width: number, height: number): Detection => ({
  categories: [],
  keypoints: [],
  boundingBox: { originX, originY, width, height, angle: 0 },
})

describe('readLargestFaceBox (S18)', () => {
  it('returns null when there is no usable box', () => {
    expect(readLargestFaceBox([])).toBeNull()
    expect(readLargestFaceBox([{ categories: [], keypoints: [] }])).toBeNull()
    expect(readLargestFaceBox([detection(0, 0, 0, 40), detection(0, 0, 40, 0)])).toBeNull()
  })

  it('maps the largest detection to the CardFaceBox shape', () => {
    expect(
      readLargestFaceBox([
        detection(10, 20, 30, 40),
        detection(50, 60, 80, 90),
        detection(0, 0, 70, 70),
      ]),
    ).toEqual({ x: 50, y: 60, width: 80, height: 90 })
  })
})
