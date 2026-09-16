import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// OPS117 guard: the two design agents must carry the SAME `permission.bash`
// ruleset. They are two files by design (the degraded agent is a distinct
// `mode: subagent` identity), so nothing but this spec stops one of them from
// drifting while the other keeps the guard — the exact anti-goal (`designer`
// guarded, `designer-degraded` leaking a shell write).
//
// The expected array is pinned on purpose: comparing the two files only would
// let a rule disappear from BOTH at once. Here the contract is the literal
// ruleset, so eroding the guard fails the build too.
//
// The spec parses the YAML frontmatter line-by-line (no YAML dependency): a
// block is the 4-space-indented run under `  <key>:`. Order matters — bash
// rules resolve last-match-wins, so the artifact allow sits at the end.

const repoRoot = process.cwd()
const agents = ['designer', 'designer-degraded'] as const

// Keep in sync with `.opencode/agent/designer.md` and `designer-degraded.md`.
const expectedBash = [
  `'*': ask`,
  `'*>*': deny`,
  `'sed *-i*': deny`,
  `'tee *': deny`,
  `'cp *': deny`,
  `'mv *': deny`,
  `'rm *': deny`,
  `'mkdir *': deny`,
  `'touch *': deny`,
  `'truncate *': deny`,
  `'dd *': deny`,
  `'install *': deny`,
  `'ln *': deny`,
  `'chmod *': deny`,
  `'chown *': deny`,
  `'bash *': deny`,
  `'sh *': deny`,
  `'zsh *': deny`,
  `'python*': deny`,
  `'node *': deny`,
  `'bun *': deny`,
  `'deno *': deny`,
  `'perl *': deny`,
  `'ruby *': deny`,
  `'find *-exec*': deny`,
  `'find *-delete*': deny`,
  `'xargs *': deny`,
  `'git checkout*': deny`,
  `'git restore*': deny`,
  `'git apply*': deny`,
  `'* > docs/plans/*-ui-design*': allow`,
  `'prettier --write docs/plans/*-ui-design*': allow`,
]

const frontmatter = (agent: string) => {
  const content = readFileSync(resolve(repoRoot, `.opencode/agent/${agent}.md`), 'utf8')
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  expect(match, `${agent}: frontmatter must be delimited by ---`).not.toBeNull()
  return match![1]
}

const block = (agent: string, key: 'bash' | 'edit') => {
  const lines = frontmatter(agent).split('\n')
  const start = lines.findIndex((line) => line === `  ${key}:`)
  expect(start, `${agent}: permission.${key} block must exist`).toBeGreaterThanOrEqual(0)

  const rules: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue
    if (!line.startsWith('    ')) break
    rules.push(line.trim())
  }
  return rules
}

describe('design agents share the OPS117 bash write guard', () => {
  it.each(agents)('%s declares the pinned bash ruleset (default ask, writes denied)', (agent) => {
    const rules = block(agent, 'bash')

    // Default is `ask` (never silent), the artifact is the last match, and the
    // enumerated write vectors — redirect, in-place sed, tee, mutators, nested
    // shells/interpreters, find -exec/-delete, xargs, destructive git — deny.
    expect(rules).toEqual(expectedBash)
  })

  it.each(agents)('%s keeps the file-tool gate fail-closed (OPS113 intact)', (agent) => {
    expect(block(agent, 'edit')).toEqual([`'*': deny`, `'docs/plans/*-ui-design*': allow`])
  })
})
