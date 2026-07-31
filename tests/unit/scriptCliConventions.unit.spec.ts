import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Pass 4 (2026-07-31): `scripts/seed-posts.mjs` called `dieWithLabel(…)`
// without importing it — a ReferenceError on the empty-fetch abort path that
// lint, typecheck and knip all let through (P3-H half-adopted in the same pass
// that added the guard). The CLI skeleton is only a skeleton when the symbols
// it exports are actually imported.
//
// `DAY_MS` is single-sourced in `src/lib/text.ts` (P3-K); a private re-spell
// survived in `engagementLevel.ts` until this pass — ban the declaration form.

const repoRoot = process.cwd()
const repoPath = (absolute: string) => relative(repoRoot, absolute)

const walkFiles = (root: string, extensions: readonly string[]): string[] =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => resolve(entry.parentPath, entry.name))

describe('script CLI skeleton (Pass 4)', () => {
  const scriptFiles = walkFiles(resolve(repoRoot, 'scripts'), ['.mjs'])

  it('imports dieWithLabel / dieAgent wherever they are called', () => {
    const offenders: string[] = []

    for (const file of scriptFiles) {
      const source = readFileSync(file, 'utf8')
      for (const symbol of ['dieWithLabel', 'dieAgent'] as const) {
        const callsIt = new RegExp(`\\b${symbol}\\s*\\(`).test(source)
        if (!callsIt) continue
        const definesIt = new RegExp(`export const ${symbol}\\b`).test(source)
        const importsIt = new RegExp(`^import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}`, 'm').test(source)
        if (!definesIt && !importsIt) offenders.push(`${repoPath(file)} (${symbol})`)
      }
    }

    expect(
      offenders,
      'import the CLI die helper from scripts/lib instead of calling it bare',
    ).toEqual([])
  })

  it('keeps DAY_MS single-sourced in src/lib/text.ts', () => {
    const offenders: string[] = []
    const declaration = /const DAY_MS\s*=/ // this spec quotes the shape itself

    for (const root of ['src', 'tests', 'scripts'] as const) {
      for (const file of walkFiles(resolve(repoRoot, root), ['.ts', '.tsx', '.mjs'])) {
        const path = repoPath(file)
        if (path === 'src/lib/text.ts') continue
        if (path === repoPath(import.meta.filename)) continue
        const lines = readFileSync(file, 'utf8').split('\n')
        for (const [index, line] of lines.entries()) {
          if (declaration.test(line)) offenders.push(`${path}:${index + 1}`)
        }
      }
    }

    expect(offenders, 'import DAY_MS from @/lib/text instead of re-spelling it').toEqual([])
  })
})
