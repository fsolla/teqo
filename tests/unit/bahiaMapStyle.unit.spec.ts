import { describe, expect, it } from 'vitest'

import {
  buildLayerStyleContext,
  computeChoroplethMax,
  resolvePathStyle,
} from '@/lib/bahiaMapStyle'

describe('bahiaMapStyle', () => {
  const baseContext = buildLayerStyleContext({
    values: { '2927408': 500, '2905701': 200 },
    fillMode: 'sequential',
    highlightKey: '',
    selectedKey: null,
  })

  describe('computeChoroplethMax', () => {
    it('uses scaleMax when provided', () => {
      expect(computeChoroplethMax({ '2927408': 999 }, 'sequential', 1)).toBe(1)
    })

    it('derives max from positive values in sequential mode', () => {
      expect(computeChoroplethMax({ '2927408': 100, '2905701': 300 }, 'sequential')).toBe(300)
    })

    it('uses absolute max in diverging mode', () => {
      expect(computeChoroplethMax({ '2927408': -40, '2905701': 100 }, 'diverging')).toBe(100)
    })
  })

  describe('resolvePathStyle', () => {
    it('highlights hovered feature over selected', () => {
      const context = {
        ...baseContext,
        selectedKey: '2905701',
        hoveredKey: '2927408',
      }

      expect(resolvePathStyle(context, '2927408').weight).toBe(2.5)
      expect(resolvePathStyle(context, '2905701').weight).toBe(1)
    })

    it('highlights selected feature when not hovering', () => {
      const context = {
        ...baseContext,
        selectedKey: '2905701',
        hoveredKey: null,
      }

      expect(resolvePathStyle(context, '2905701').weight).toBe(2.5)
    })

    it('reveals selected highlight after hover clears on a different feature', () => {
      const context = {
        ...baseContext,
        selectedKey: '2905701',
        hoveredKey: null,
      }

      expect(resolvePathStyle(context, '2927408').weight).toBe(1)
      expect(resolvePathStyle(context, '2905701').weight).toBe(2.5)
    })

    it('highlights keys in highlightSet', () => {
      const context = {
        ...baseContext,
        highlightSet: new Set(['2927408']),
      }

      expect(resolvePathStyle(context, '2927408').weight).toBe(2.5)
    })

    it('uses diverging fill for negative metrics', () => {
      const context = buildLayerStyleContext({
        values: { '2927408': -100 },
        fillMode: 'diverging',
        scaleMax: 200,
        highlightKey: '',
        selectedKey: null,
      })

      expect(resolvePathStyle(context, '2927408').fillColor).toMatch(/^rgb\(/)
    })

    it('returns neutral style for missing feature key', () => {
      const style = resolvePathStyle(baseContext, '')
      expect(style.fillOpacity).toBe(0.35)
      expect(style.weight).toBe(1)
    })
  })
})
