import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// C210: the briefing skill, the command and the author subagent are prompt
// text, so the product contract (label, 4-page cap, vote literal, anchor
// fail-closed, no second research) lives in the SKILL.md prose. This guard
// fails the build if the flow, the guardrails or the CLI contract are dropped.

const repoRoot = process.cwd()

const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8')

const skill = read('.agents/skills/briefing-capacitacao-solla/SKILL.md')
const agent = read('.opencode/agent/briefing-capacitacao-solla.md')
const command = read('.opencode/commands/briefing-capacitacao-solla.md')

describe('skill /briefing-capacitacao-solla documents the flow', () => {
  it('declares when to use it, the batch selector and the integration', () => {
    expect(skill).toContain('## Quando usar')
    expect(skill).toContain('## Lote (recortes)')
    expect(skill).toContain('cidade:')
    expect(skill).toContain('instituicao:')
    expect(skill).toContain('tema:')
    expect(skill).toContain('/dossie-solla-cidade')
    expect(skill).toMatch(/3º entregável/)
  })

  it('pins the canonical builder CLI and the gitignored artifacts', () => {
    expect(skill).toContain('node scripts/build-dossie-solla-briefing.mjs')
    expect(skill).toContain('--unit=')
    expect(skill).toContain('data/dossie-solla-')
    expect(skill).toContain('docs/research/dossie-solla-')
    expect(skill).toContain('gitignored')
  })

  it('pins the hard product literals', () => {
    expect(skill).toContain('Insumo interno de capacitação — não publicar')
    expect(skill).toContain('vote 1313')
    expect(skill).toMatch(/4 páginas/)
    expect(skill).toContain('insumo interno')
    expect(skill).toMatch(/sem CTA público/i)
  })

  it('pins the fail-closed content contract', () => {
    expect(skill).toContain('## Contrato do')
    expect(skill).toContain('factId')
    expect(skill).toContain('gapReason')
    expect(skill).toContain('estimatedVotes')
    expect(skill).toMatch(/sem fonte, o item não entra/i)
    expect(skill).toMatch(/dois lados/)
  })

  it('pins the hard four-page cap with declared shed and the .md superset', () => {
    expect(skill).toMatch(/teto de \*\*4 páginas é rígido\*\*/)
    expect(skill).toMatch(/corta por\s+prioridade/)
    expect(skill).toContain('no briefing completo (.md)')
    expect(skill).toMatch(/nunca\*\* são cortados/)
  })

  it('pins the offline guardrail: no second factual research', () => {
    expect(skill).toMatch(/sem segunda pesquisa factual/i)
    expect(skill).toMatch(/nunca faz segunda pesquisa factual/i)
  })
})

describe('author subagent is writer-only (briefing.json)', () => {
  it('stays a subagent that writes the briefing.json and returns the receipt', () => {
    expect(agent).toMatch(/^---\n[\s\S]*mode: subagent[\s\S]*\n---/)
    expect(agent).toContain('.briefing.json')
    expect(agent).toContain('Recibo do autor')
    const frontmatter = agent.match(/^---\n([\s\S]*?)\n---/)
    expect(frontmatter, 'agent frontmatter must be delimited by ---').not.toBeNull()
    expect(frontmatter![1]).not.toMatch(/^\s*["']?model["']?\s*:/m)
  })

  it('does not run the deterministic build or a new web research', () => {
    expect(agent, 'author must not run the builder CLI').not.toContain('--snapshot=')
    expect(agent, 'author must not do new web research').toMatch(/não\*\* faça pesquisa web/i)
    expect(agent, 'author must not edit the research files').toMatch(/não\*\* edite os/)
  })
})

describe('command /briefing-capacitacao-solla couples to the skill', () => {
  it('references the canonical skill file and passes arguments', () => {
    expect(existsSync(resolve(repoRoot, '.opencode/commands/briefing-capacitacao-solla.md'))).toBe(
      true,
    )
    expect(command).toContain('`briefing-capacitacao-solla`')
    expect(command).toContain('$ARGUMENTS')
    expect(command).toContain('.agents/skills/briefing-capacitacao-solla/SKILL.md')
    expect(command).toContain('insumo interno')
  })
})
