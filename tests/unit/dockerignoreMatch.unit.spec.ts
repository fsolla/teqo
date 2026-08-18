// @vitest-environment node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  compileDockerignoreRule,
  isDockerignored,
  parseDockerignore,
} from '../../scripts/lib/dockerignore.mjs'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')
const dockerignore = readFileSync(join(repoRoot, '.dockerignore'), 'utf8')

describe('dockerignoreMatch (OPS65 production-change gate)', () => {
  it('compiles the moby semantics: basename at any depth, subtree exclusion', () => {
    const rules = parseDockerignore('docs\n*.log\n')
    expect(isDockerignored('docs', rules)).toBe(true)
    expect(isDockerignored('docs/plans/x.md', rules)).toBe(true)
    expect(isDockerignored('a/docs/plans/x.md', rules)).toBe(true)
    expect(isDockerignored('x.log', rules)).toBe(true)
    expect(isDockerignored('a/b/x.log', rules)).toBe(true)
    expect(isDockerignored('src/app/page.tsx', rules)).toBe(false)
  })

  it('anchors leading-slash patterns to the context root', () => {
    const rules = parseDockerignore('/*.png\n')
    expect(isDockerignored('a.png', rules)).toBe(true)
    expect(isDockerignored('sub/b.png', rules)).toBe(false)
  })

  it('honours ! negations with last-match-wins', () => {
    const rules = parseDockerignore('.env.*\n!.env.example\n')
    expect(isDockerignored('.env.local', rules)).toBe(true)
    expect(isDockerignored('.env.example', rules)).toBe(false)
    expect(isDockerignored('a/.env.example', rules)).toBe(false)
  })

  it('supports globstar and directory-only patterns', () => {
    const rules = parseDockerignore('**/fixtures\na/**/b\n')
    expect(isDockerignored('x/fixtures/y.json', rules)).toBe(true)
    expect(isDockerignored('a/b', rules)).toBe(true)
    expect(isDockerignored('a/x/b', rules)).toBe(true)
    expect(isDockerignored('a/x/c/b', rules)).toBe(true)
  })

  it('ignores blank lines and comments', () => {
    const rules = parseDockerignore('# header\n\ndocs\n')
    expect(rules).toHaveLength(1)
    expect(isDockerignored('docs/x', rules)).toBe(true)
  })

  it('escapes regex metacharacters in plain patterns', () => {
    const rules = parseDockerignore('foo.bar\n')
    expect(isDockerignored('foo.bar', rules)).toBe(true)
    expect(isDockerignored('fooXbar', rules)).toBe(false)
  })

  it('treats the repo .dockerignore as the source of truth', () => {
    const rules = parseDockerignore(dockerignore)
    // Anything the image needs is production: changes force the full suite.
    for (const path of [
      'src/app/page.tsx',
      'src/migrations/20260818_x.ts',
      'public/favicon.ico',
      'Dockerfile',
      '.dockerignore',
      'AGENTS.md',
      'package.json',
      'pnpm-lock.yaml',
      'scripts/deploy-homeserver.sh',
      'scripts/ci-classify-production.mjs',
      '.forgejo/workflows/ci.yml',
      '.forgejo/workflows/ci-pr.yml',
      'tests/unit/dockerignoreMatch.unit.spec.ts',
      '.env.example',
    ]) {
      expect(isDockerignored(path, rules), path).toBe(false)
    }
    // Non-artifact paths skip the suite (quiet days cost seconds).
    for (const path of [
      'docs/plans/x.md',
      'docs/ops/teqo-1313-deploy.md',
      '.agents/skills/foo/SKILL.md',
      '.env.local',
      '.env.test.local',
      'data/tse/x.zip',
      'media/x.jpg',
      'foo.png',
      'x.log',
      'x.tsbuildinfo',
      'node_modules/x',
      '.next/x',
      '.next-e2e/x',
    ]) {
      expect(isDockerignored(path, rules), path).toBe(true)
    }
  })

  it('keeps the .dockerignore itself explicit (self-referential gate)', () => {
    const rule = compileDockerignoreRule('!.dockerignore')
    expect(rule.negate).toBe(true)
  })
})
