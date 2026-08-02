import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

const ROW_Y_TOLERANCE_PX = 12

export type ActionBoundingBox = {
  label: string
  x: number
  y: number
  width: number
  height: number
}

export async function collectActionBoundingBoxes(
  container: Locator,
  labels: readonly string[],
): Promise<ActionBoundingBox[]> {
  const boxes: ActionBoundingBox[] = []

  for (const label of labels) {
    const control = container
      .getByRole('link', { name: label, exact: true })
      .or(container.getByRole('button', { name: label, exact: true }))
    const box = await control.boundingBox()
    if (!box) {
      throw new Error(`Missing bounding box for action "${label}"`)
    }
    boxes.push({ label, ...box })
  }

  return boxes
}

export function groupActionsByRow(
  boxes: readonly ActionBoundingBox[],
  tolerancePx = ROW_Y_TOLERANCE_PX,
): ActionBoundingBox[][] {
  const sorted = [...boxes].sort((left, right) => left.y - right.y || left.x - right.x)
  const rows: ActionBoundingBox[][] = []

  for (const box of sorted) {
    const row = rows.find((entry) => Math.abs(entry[0]!.y - box.y) <= tolerancePx)
    if (row) {
      row.push(box)
    } else {
      rows.push([box])
    }
  }

  for (const row of rows) {
    row.sort((left, right) => left.x - right.x)
  }

  return rows
}

/** Asserts a 3-column grid with `expectedRowCount` rows (staff = 2 rows of 3). */
export function assertThreeColumnActionGrid(
  rows: readonly ActionBoundingBox[][],
  expectedRowCount: number,
) {
  expect(rows).toHaveLength(expectedRowCount)

  for (const row of rows) {
    expect(row).toHaveLength(3)
    const [first, second, third] = row
    expect(second.x).toBeGreaterThan(first.x + first.width * 0.4)
    expect(third.x).toBeGreaterThan(second.x + second.width * 0.4)
  }
}
