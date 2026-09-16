import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// OPS123: the OpenAI provider (ChatGPT Plus OAuth) is reserved to the design
// agents. A manual `/models` switch is covered by the always-on rule in
// `AGENTS.md`; this spec is the static half of the guard — no repo-controlled
// agent/command/config may pin an `openai/*` model outside the allow-list, and
// the doctrine keeps the reservation written down (so it cannot erode silently).
//
// The waste this pins against: non-design sessions (build/explore/general)
// running `gpt-5.6-luna`/`sol` and burning the shared weekly quota.

const repoRoot = process.cwd()
const AGENT_DIR = resolve(repoRoot, '.opencode/agent')
const COMMAND_DIR = resolve(repoRoot, '.opencode/commands')

/** Only these agents may use the `openai` provider — they are the design tier. */
const ALLOWED_OPENAI_AGENTS = new Set(['designer'])

const frontmatter = (file: string) => {
  const content = readFileSync(file, 'utf8')
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  return match ? match[1] : null
}

const pinnedModel = (file: string) => {
  const block = frontmatter(file)
  if (!block) return null
  const line = block.split('\n').find((entry) => entry.startsWith('model:'))
  return line ? line.slice('model:'.length).trim() : null
}

const mdFiles = (dir: string) => readdirSync(dir).filter((file) => file.endsWith('.md'))

describe('the OpenAI provider stays reserved to the design agents (OPS123)', () => {
  it('no agent outside the allow-list pins an openai/* model', () => {
    const offenders = mdFiles(AGENT_DIR)
      .map((file) => ({
        name: file.replace(/\.md$/, ''),
        path: resolve(AGENT_DIR, file),
      }))
      .filter(({ name }) => !ALLOWED_OPENAI_AGENTS.has(name))
      .map(({ name, path }) => ({ name, model: pinnedModel(path) }))
      .filter(({ model }) => Boolean(model?.startsWith('openai/')))
      .map(({ name, model }) => `${name} -> ${model}`)

    expect(
      offenders,
      `agentes fora do design não podem pinar openai/* (só ${[...ALLOWED_OPENAI_AGENTS].join(', ')} pode): ${offenders.join(', ')}`,
    ).toEqual([])
  })

  it('the designer keeps its frontier pin (the reservation is real, not empty)', () => {
    expect(pinnedModel(resolve(AGENT_DIR, 'designer.md'))).toBe('openai/gpt-5.6-sol')
  })

  it('no command pins an openai model', () => {
    const offenders = mdFiles(COMMAND_DIR)
      .filter((file) => pinnedModel(resolve(COMMAND_DIR, file))?.startsWith('openai/'))
      .map((file) => `commands/${file}`)

    expect(offenders, `comandos não pinam modelo (OPS101): ${offenders.join(', ')}`).toEqual([])
  })

  it('no project config routes a model field to openai/*', () => {
    const offenders: string[] = []
    for (const config of ['opencode.json', '.opencode/opencode.json']) {
      let raw: string
      try {
        raw = readFileSync(resolve(repoRoot, config), 'utf8')
      } catch {
        continue
      }
      if (/"(?:model|small_model|smallModel)"\s*:\s*"openai\//.test(raw)) offenders.push(config)
    }

    expect(
      offenders,
      `config de projeto não aponta modelo para openai/*: ${offenders.join(', ')}`,
    ).toEqual([])
  })

  it('the doctrine and AGENTS.md keep the reservation written down', () => {
    const doctrine = readFileSync(
      resolve(repoRoot, '.agents/skills/plan-issue/ui-design-html.md'),
      'utf8',
    )
    const agents = readFileSync(resolve(repoRoot, 'AGENTS.md'), 'utf8')

    expect(doctrine, 'a doutrina deve reservar o provider openai ao design').toContain(
      'Provider `openai` reservado aos agentes de design',
    )
    expect(agents, 'AGENTS.md (always-on) deve carregar a reserva').toContain(
      'Provider `openai` reservado aos agentes de design',
    )
  })
})
