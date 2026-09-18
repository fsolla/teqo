import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// C191: the skill and the command are prompt text, so the product contract
// lives in the SKILL.md prose. This guard fails the build if the flow, the
// guardrails, the gitignored artifacts or the CLI contract are dropped.

const repoRoot = process.cwd()

const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8')

const skill = read('.agents/skills/graficos-dados/SKILL.md')
const command = read('.opencode/commands/graficos-dados.md')

describe('skill /graficos-dados documents the flow', () => {
  it('declares when to use it and the canonical builder CLI', () => {
    expect(skill).toContain('## Quando usar')
    expect(skill).toContain('node scripts/build-chart-from-data.mjs')
    expect(skill).toContain('--inspect')
    expect(skill).toContain('--spec=')
  })

  it('pins the launch command and the gitignored artifacts', () => {
    expect(skill).toContain('/graficos-dados')
    expect(skill).toContain('data/graficos-instagram/')
    expect(skill).toContain('docs/research/graficos-instagram/')
    expect(skill).toContain('gitignored')
  })

  it('pins the three output sizes', () => {
    expect(skill).toContain('1080×1350')
    expect(skill).toContain('1080×1080')
    expect(skill).toContain('1080×1920')
  })

  it('pins the fail-closed guardrails', () => {
    expect(skill).toMatch(/partem do zero/i)
    expect(skill).toMatch(/7 pontos/)
    expect(skill).toMatch(/pizza/i)
    expect(skill).toMatch(/pergunta, nunca completa/i)
    expect(skill).toContain('--source')
    expect(skill).toMatch(/fail-closed/i)
  })
})

describe('command /graficos-dados couples to the skill', () => {
  it('references the canonical skill file and passes arguments', () => {
    expect(existsSync(resolve(repoRoot, '.opencode/commands/graficos-dados.md'))).toBe(true)
    expect(command).toContain('`graficos-dados`')
    expect(command).toContain('$ARGUMENTS')
    expect(command).toContain('.agents/skills/graficos-dados/SKILL.md')
  })
})
