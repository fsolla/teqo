// @vitest-environment node

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { classifyProduction } from '../../scripts/ci-classify-production.mjs'
import { parseDockerignore } from '../../scripts/lib/dockerignore.mjs'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')
const cliPath = join(repoRoot, 'scripts/ci-classify-production.mjs')
const realRules = parseDockerignore(readFileSync(join(repoRoot, '.dockerignore'), 'utf8'))

let fixturesDir: string
let filesFrom: string
let gitRepo: string
let fixtureShas: { baseSha: string; prodSha: string; docsSha: string }

beforeAll(() => {
  fixturesDir = mkdtempSync(join(tmpdir(), 'ci-classify-production-'))
  filesFrom = join(fixturesDir, 'changed.txt')
  gitRepo = join(fixturesDir, 'repo')
  execFileSync('git', ['init', '-q', '-b', 'main', gitRepo])
  writeFileSync(join(gitRepo, '.dockerignore'), 'docs\n')
  writeFileSync(join(gitRepo, 'README.md'), 'a\n')
  const commit = (message: string) =>
    execFileSync('git', [
      '-C',
      gitRepo,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-q',
      '-m',
      message,
    ])
  execFileSync('git', ['-C', gitRepo, 'add', '-A'])
  commit('base')
  const baseSha = execFileSync('git', ['-C', gitRepo, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  execFileSync('mkdir', ['-p', join(gitRepo, 'src'), join(gitRepo, 'docs')])
  writeFileSync(join(gitRepo, 'src', 'a.ts'), 'x\n')
  writeFileSync(join(gitRepo, 'docs', 'x.md'), 'x\n')
  execFileSync('git', ['-C', gitRepo, 'add', '-A'])
  commit('prod change')
  const prodSha = execFileSync('git', ['-C', gitRepo, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  writeFileSync(join(gitRepo, 'docs', 'y.md'), 'x\n')
  execFileSync('git', ['-C', gitRepo, 'add', '-A'])
  commit('docs only')
  const docsSha = execFileSync('git', ['-C', gitRepo, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  fixtureShas = { baseSha, prodSha, docsSha }
})

afterAll(() => {
  execFileSync('rm', ['-rf', fixturesDir])
})

const fixture = () => fixtureShas

const runCli = (args: string[], options: { cwd?: string } = {}) => {
  const env = { ...process.env, GITHUB_EVENT_NAME: 'schedule' }
  const result = spawnSync('node', [cliPath, ...args], {
    encoding: 'utf8',
    env,
    cwd: options.cwd,
  })
  return { out: result.stdout.trim(), status: result.status }
}

const writeChanged = (paths: string[]) => writeFileSync(filesFrom, paths.join('\n'))

describe('classifyProduction (pure)', () => {
  it('keeps paths the docker build context receives', () => {
    const { production, kept, skipped } = classifyProduction(
      ['src/app/page.tsx', 'docs/plans/x.md', 'package.json'],
      realRules,
    )
    expect(production).toBe(true)
    expect(kept).toEqual(['src/app/page.tsx', 'package.json'])
    expect(skipped).toEqual(['docs/plans/x.md'])
  })

  it('reports no production change when every path is ignored', () => {
    const { production, kept, skipped } = classifyProduction(
      ['docs/ops/teqo-1313-deploy.md', '.agents/skills/foo/SKILL.md'],
      realRules,
    )
    expect(production).toBe(false)
    expect(kept).toEqual([])
    expect(skipped).toHaveLength(2)
  })
})

describe('ci-classify-production CLI (OPS65 gate)', () => {
  it('reports JSON with production, changed, kept and skipped', () => {
    writeChanged(['docs/plans/x.md', 'src/lib/foo.ts'])
    const { out, status } = runCli(['--files-from', filesFrom])
    expect(status).toBe(0)
    const result = JSON.parse(out)
    expect(result.production).toBe(true)
    expect(result.kept).toEqual(['src/lib/foo.ts'])
    expect(result.skipped).toEqual(['docs/plans/x.md'])
  })

  it('--value prints only the boolean', () => {
    writeChanged(['docs/plans/x.md'])
    expect(runCli(['--files-from', filesFrom, '--value']).out).toBe('false')
    writeChanged(['src/app/page.tsx'])
    expect(runCli(['--files-from', filesFrom, '--value']).out).toBe('true')
  })

  it('an empty diff means nothing to do (production=false)', () => {
    writeChanged([])
    const { out, status } = runCli(['--files-from', filesFrom])
    expect(status).toBe(0)
    const result = JSON.parse(out)
    expect(result.production).toBe(false)
    expect(result.reason).toContain('nada a fazer')
  })

  it('classifies a real git diff against the deployed revision', () => {
    const { baseSha, prodSha, docsSha } = fixture()
    // HEAD is the docs-only commit; from the base SHA the diff mixes the
    // production change (src/a.ts) with the docs-only commits.
    const prod = JSON.parse(runCli(['--deployed', baseSha], { cwd: gitRepo }).out)
    expect(prod.production).toBe(true)
    expect(prod.changed).toEqual(['docs/x.md', 'docs/y.md', 'src/a.ts'])
    expect(prod.kept).toEqual(['src/a.ts'])
    expect(prod.skipped).toEqual(['docs/x.md', 'docs/y.md'])

    const docs = JSON.parse(runCli(['--deployed', prodSha], { cwd: gitRepo }).out)
    expect(docs.production).toBe(false)
    expect(docs.skipped).toEqual(['docs/y.md'])

    const same = JSON.parse(runCli(['--deployed', docsSha], { cwd: gitRepo }).out)
    expect(same.production).toBe(false)
  })

  it('keeps the run green when the deployed SHA is unknown (empty)', () => {
    const { out, status } = runCli(['--deployed', ''])
    expect(status).toBe(0)
    const result = JSON.parse(out)
    expect(result.production).toBe(true)
    expect(result.reason).toContain('sem SHA deployado')
  })

  it('turns the run red when it cannot classify (no input)', () => {
    const { out, status } = runCli([])
    expect(status).not.toBe(0)
    expect(JSON.parse(out).production).toBe(true)
  })

  it('turns the run red when the deployed revision cannot be diffed', () => {
    const { out, status } = runCli(['--deployed', 'ffffffffffffffffffffffffffffffffffffffff'], {
      cwd: gitRepo,
    })
    expect(status).not.toBe(0)
    const result = JSON.parse(out)
    expect(result.production).toBe(true)
    expect(result.reason).toContain('erro ao obter o diff')
  })

  it('turns the run red when the .dockerignore is unreadable', () => {
    writeChanged(['src/app/page.tsx'])
    const { out, status } = runCli(['--files-from', filesFrom], { cwd: fixturesDir })
    expect(status).not.toBe(0)
    const result = JSON.parse(out)
    expect(result.production).toBe(true)
    expect(result.reason).toContain('.dockerignore ilegível')
  })

  it('workflow_dispatch always runs the full pipeline', () => {
    const env = { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch' }
    const result = spawnSync('node', [cliPath, '--files-from', filesFrom], {
      encoding: 'utf8',
      env,
    })
    const parsed = JSON.parse(result.stdout)
    expect(result.status).toBe(0)
    expect(parsed.production).toBe(true)
    expect(parsed.reason).toContain('workflow_dispatch')
  })
})
