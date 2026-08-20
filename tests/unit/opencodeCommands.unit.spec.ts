import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Programmatic guard for the OPS25 coupling: each `.opencode/commands/<name>.md`
// must keep pointing at the skill of the same name (`.agents/skills/<name>/SKILL.md`).
// The command body deliberately does NOT transcribe the skill — the canonical
// source is the SKILL.md. If a skill is renamed, this spec fails the build so the
// command is renamed together instead of breaking silently at the `/` prompt.

const repoRoot = process.cwd()

const commands = ['work-issue', 'plan-issue'] as const

describe('opencode commands couple to their skill by exact name', () => {
  it.each(commands)('command /%s references the existing skill of the same name', (name) => {
    const commandPath = resolve(repoRoot, `.opencode/commands/${name}.md`)
    const skillPath = resolve(repoRoot, `.agents/skills/${name}/SKILL.md`)

    expect(existsSync(commandPath), 'command file must exist').toBe(true)
    expect(existsSync(skillPath), 'referenced skill must exist').toBe(true)

    const content = readFileSync(commandPath, 'utf8')

    expect(content, 'command must reference the skill by exact name').toContain(`\`${name}\``)
    expect(content, 'command must pass arguments through').toContain('$ARGUMENTS')
    expect(content, 'command must point at the canonical skill file').toContain(
      `.agents/skills/${name}/SKILL.md`,
    )

    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)
    expect(frontmatter, 'frontmatter must be delimited by ---').not.toBeNull()
    expect(frontmatter![1], 'frontmatter must declare a TUI description').toMatch(
      /^description: .+$/m,
    )
    expect(frontmatter![1], 'frontmatter must pin the preference model').toMatch(
      /^model: cheapestinference\/deepseek-v4-flash$/m,
    )
  })
})
