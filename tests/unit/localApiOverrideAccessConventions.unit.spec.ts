import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Pass 4 (2026-07-31): the engineering standard is "Local API with `user`
// always with `overrideAccess: false`; bypass admin só com comentário
// justificando" — but until now nothing failed the build when a call passed
// `user` and simply omitted `overrideAccess` (Payload then bypasses access
// silently). Measured baseline at adoption: 59 calls with `user`, 0 missing
// (the undocumented-bypass ratchet in codebaseConventions covers the `true`
// side; this guard covers the omission side).
//
// Companion rule: the `server-only` sweep in codebaseConventions only sees
// static imports, so a runtime `await import('payload')` in utilities would
// dodge the mark. Banned outright — use a static import and the mark.

const repoRoot = process.cwd()
const repoPath = (absolute: string) => relative(repoRoot, absolute)

const srcFiles = readdirSync(resolve(repoRoot, 'src'), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
  .map((entry) => resolve(entry.parentPath, entry.name))

const CALL_PATTERN =
  /payload\.(find|create|update|delete|count|findByID|findGlobal|updateGlobal)\s*\(\s*\{/g

/** Brace-matches the first `{…}` object literal starting at `openIndex`. */
const callObjectBody = (source: string, openIndex: number): string => {
  let depth = 0
  for (let index = openIndex; index < source.length; index++) {
    if (source[index] === '{') depth++
    else if (source[index] === '}') {
      depth--
      if (depth === 0) return source.slice(openIndex, index + 1)
    }
  }
  return source.slice(openIndex)
}

describe('Local API overrideAccess discipline (Pass 4)', () => {
  it('declares overrideAccess on every payload call that passes user', () => {
    const offenders: string[] = []

    for (const file of srcFiles) {
      const source = readFileSync(file, 'utf8')
      CALL_PATTERN.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = CALL_PATTERN.exec(source)) !== null) {
        const openIndex = source.indexOf('{', match.index)
        const body = callObjectBody(source, openIndex)
        if (!/\buser\s*:/.test(body)) continue
        if (/overrideAccess\s*:/.test(body)) continue
        const line = source.slice(0, match.index).split('\n').length
        offenders.push(`${repoPath(file)}:${line} (payload.${match[1]})`)
      }
    }

    expect(
      offenders,
      'Local API with `user` must declare overrideAccess (false under access; true only with the justifying comment)',
    ).toEqual([])
  })

  it('bans runtime dynamic import/require of server-bound modules in utilities', () => {
    const offenders: string[] = []
    const dynamicServerImport =
      /\bawait\s+import\(\s*['"](?:payload|@payload-config|next\/(?:cache|server|headers))['"]\s*\)/
    const requireServerModule = /\brequire\(\s*['"](?:payload|@payload-config)['"]\s*\)/

    for (const file of srcFiles) {
      const path = repoPath(file)
      if (!path.startsWith('src/utilities/')) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const [index, line] of lines.entries()) {
        if (dynamicServerImport.test(line) || requireServerModule.test(line)) {
          offenders.push(`${path}:${index + 1}`)
        }
      }
    }

    expect(
      offenders,
      "use a static import plus `import 'server-only'` — dynamic imports dodge the boundary sweep",
    ).toEqual([])
  })
})
