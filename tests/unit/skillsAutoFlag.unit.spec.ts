import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// OPS108: pins the `--auto` autonomous-mode contract of the plan-issue and
// work-issue skills (and their thin command wrappers). The flag lives inside
// the prompt ($ARGUMENTS), not in the opencode CLI argv — the specs below pin
// the fail-safe wording (no flag = current supervised flow) and the hard-stop
// list that the flag can never cross.

const repoRoot = process.cwd()

const skills = ['plan-issue', 'work-issue'] as const

function readSkill(name: (typeof skills)[number]): string {
  return readFileSync(resolve(repoRoot, `.agents/skills/${name}/SKILL.md`), 'utf8')
}

describe.each(skills)('skill /%s documents the --auto autonomous mode', (name) => {
  it('declares the flag, the fail-safe and the CLI disambiguation', () => {
    const content = readSkill(name)

    expect(content, 'skill must declare the --auto flag').toContain('--auto')
    expect(content, 'skill must name the autonomous-mode section').toContain('Modo autônomo')
    expect(content, 'skill must state the no-flag fail-safe').toContain('Sem a flag')
    expect(content, 'skill must disambiguate from the opencode CLI flag').toContain('Não confundir')
    expect(content, 'disambiguation must name the opencode CLI').toContain('CLI opencode')
  })

  it('pins the hard-stop list the flag can never cross', () => {
    const content = readSkill(name)

    expect(content, 'hard-stop must cite Consent/LGPD').toContain('Consent/LGPD')
    expect(content, 'hard-stop must cite schema migration').toContain('migração de schema')
    expect(content, 'hard-stop must cite the public URL contract').toContain('URL público')
    expect(content, 'hard-stop must cite production').toContain('produção')
  })
})

describe('work-issue --auto keeps the environment contract', () => {
  it('self-approves the impl plan but never claims and flips divergence to blocked', () => {
    const content = readSkill('work-issue')

    expect(content, 'autonomous impl plan must be self-approved').toContain('aprovado')
    expect(content, 'autonomous mode must never claim an issue').toContain('nunca claima')
    expect(content, 'material divergence must flip to blocked').toContain('blocked')
  })
})

describe('plan-issue --auto keeps the tracker gate', () => {
  it('skips only the pause and leaves diverged items unregistered', () => {
    const content = readSkill('plan-issue')

    expect(content, 'diverged items must stay unregistered').toContain('não é registrado')
    expect(content, 'nothing hits the tracker before the gate').toContain(
      'Nada no tracker antes do gate',
    )
  })
})

describe.each(skills)('command /%s advertises --auto without gaining logic', (name) => {
  it('mentions --auto while keeping the thin-wrapper contract', () => {
    const content = readFileSync(resolve(repoRoot, `.opencode/commands/${name}.md`), 'utf8')

    expect(content, 'command must advertise the --auto flag').toContain('--auto')
    expect(content, 'command must pass arguments through').toContain('$ARGUMENTS')
    expect(content, 'command must reference the skill by exact name').toContain(`\`${name}\``)
    expect(content, 'command must point at the canonical skill file').toContain(
      `.agents/skills/${name}/SKILL.md`,
    )
  })
})
