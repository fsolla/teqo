import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampaignTable, CampaignTableHead } from '@/components/campaign/shared/CampaignTable'

type Row = { id: number; name: string; note: string | null }

const rows: Row[] = [
  { id: 1, name: 'Seabra', note: 'Vereador migrou para a base' },
  { id: 2, name: 'Itaberaba', note: null },
]

const renderTable = (cellTooltip?: (row: Row) => string | null) =>
  renderToStaticMarkup(
    createElement(CampaignTable<Row>, {
      columns: [
        {
          id: 'name',
          head: createElement(CampaignTableHead, {}, 'Município'),
          cell: (row) => row.name,
          cellTooltip,
        },
      ],
      rows,
      rowKey: (row) => row.id,
    }),
  )

/**
 * B23 seam consumed by E10's "Classe" column: the tooltip is declared by the
 * column, rendered by the table. These pin the two halves of the contract that
 * a consumer would otherwise have to rediscover.
 */
describe('CampaignTable cellTooltip', () => {
  it('renders the cell untouched when a column declares no tooltip', () => {
    const html = renderTable()

    expect(html).toContain('Seabra')
    // No wrapper at all: the municipality list runs with `overflow-x-visible`
    // and a sticky header, so an unrequested inline-flex span is a layout risk.
    expect(html).not.toContain('inline-flex')
  })

  it('wraps only the rows whose tooltip has content', () => {
    const html = renderTable((row) => row.note)

    // Itaberaba has no note, so it must render exactly like the no-tooltip
    // case — one trigger in the table, not two.
    expect(html.match(/data-slot="tooltip-trigger"/g)).toHaveLength(1)
    expect(html).toContain('>Itaberaba<')
  })

  /**
   * Radix mounts tooltip content only once opened, so the reason never reaches
   * the server markup. That is precisely why `cellTooltip`'s contract demands
   * the same information already exist as text in the cell — a column that
   * moves its only copy into the tooltip silently loses it for assistive tech.
   */
  it('keeps the tooltip content out of the server markup', () => {
    expect(renderTable((row) => row.note)).not.toContain('Vereador migrou para a base')
  })
})

/**
 * B22 seam: a plain header can carry the same redundant hover/focus/tap
 * explanation `cellTooltip` gives a cell. Without `description` the render is
 * byte-for-byte what it was before B22 — no new wrapper, no new tab stop.
 */
describe('CampaignTableHead description', () => {
  it('renders unchanged when no description is declared', () => {
    const html = renderToStaticMarkup(createElement(CampaignTableHead, {}, 'Território'))

    expect(html).toContain('Território')
    expect(html).not.toContain('data-slot="tooltip-trigger"')
    expect(html).not.toContain('tabindex')
  })

  it('wraps the label in exactly one tooltip trigger when description is declared', () => {
    const html = renderToStaticMarkup(
      createElement(
        CampaignTableHead,
        { description: 'Território de Identidade a que o município pertence.' },
        'Território',
      ),
    )

    expect(html.match(/data-slot="tooltip-trigger"/g)).toHaveLength(1)
    expect(html).toContain('>Território<')
    // Same contract as cellTooltip: Radix only mounts content once opened, so
    // the description text never reaches the server markup.
    expect(html).not.toContain('Território de Identidade a que o município pertence.')
  })
})
