// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

/** YAML with comment-only lines stripped — header prose must never satisfy a pin. */
const readWithoutComments = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')

const workflow = readWithoutComments('.github/workflows/auto-unblock.yml')
const deployWorkflow = readWithoutComments('.github/workflows/deploy.yml')
const shell = readFileSync(join(repoRoot, 'scripts', 'auto-unblock.sh'), 'utf8')
const agent = readFileSync(join(repoRoot, 'scripts', 'auto-unblock-agent.mjs'), 'utf8')
const orchestrator = readFileSync(join(repoRoot, 'scripts', 'auto-unblock.mjs'), 'utf8')

describe('auto-unblock.yml (OPS106 reactor)', () => {
  it('is triggered only by a completed Deploy run', () => {
    expect(workflow).toContain('workflow_run:')
    expect(workflow).toContain("workflows: ['Deploy']")
    expect(workflow).toContain('types: [completed]')
  })

  it('gates on push to main and conclusion failure', () => {
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'failure'")
    expect(workflow).toContain("github.event.workflow_run.event == 'push'")
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'")
  })

  it('runs on the homeserver runner with the least permissions it needs', () => {
    expect(workflow).toContain('runs-on: [self-hosted, homeserver]')
    expect(workflow).toContain('actions: read')
    expect(workflow).toContain('issues: write')
  })

  it('checks out without persisted bot credentials and dispatches the shell entrypoint', () => {
    expect(workflow).toContain('persist-credentials: false')
    expect(workflow).toContain('bash scripts/auto-unblock.sh')
    expect(workflow).toContain('AUTOMERGE_PAT: ${{ secrets.AUTOMERGE_PAT }}')
    expect(workflow).toContain('RUN_ID: ${{ github.event.workflow_run.id }}')
  })

  it('installs repo deps before the launcher (the detached wrapper loads worktree.mjs)', () => {
    expect(workflow).toContain('pnpm install --frozen-lockfile')
  })

  it('sets up Node 24 before pnpm (OPS111: homeserver runner defaults to Node 18)', () => {
    // pnpm/action-setup@v6 dies under the homeserver default Node 18
    // (TypeError paths[0] undefined); setup-node@v5 (Node 24) must run first.
    const setupNodeIndex = workflow.indexOf('actions/setup-node@v5')
    const pnpmSetupIndex = workflow.indexOf('pnpm/action-setup')
    const installIndex = workflow.indexOf('pnpm install --frozen-lockfile')
    expect(setupNodeIndex).toBeGreaterThan(-1)
    expect(pnpmSetupIndex).toBeGreaterThan(setupNodeIndex)
    expect(installIndex).toBeGreaterThan(pnpmSetupIndex)
    expect(workflow).toContain('node-version: 24')
    expect(workflow).toContain('package-manager-cache: false')
  })

  it('keeps the Deploy workflow untouched (no auto-retry, no reactor wiring)', () => {
    expect(deployWorkflow).not.toContain('unblock')
    expect(deployWorkflow).not.toContain('workflow_run')
  })

  it('pins the deploy job id the reactor keys on (display name would break the gate)', () => {
    // The jobs API reports the job `name` (id when no display name is set);
    // classifyDeployFailure keys on exactly `verify`. A `name:` inside the job
    // block would change that value and silently disable the reactor.
    expect(deployWorkflow).toMatch(/^  verify:$/m)
    const verifyBlock = deployWorkflow
      .split(/\n(?=  [A-Za-z0-9_.-]+:)/)
      .find((block) => block.startsWith('  verify:'))
    expect(verifyBlock, 'job verify não encontrado no deploy.yml').toBeDefined()
    expect(verifyBlock).not.toMatch(/^    name:/m)
  })

  it('the token never enters the claim queue (no ready/in-progress label)', () => {
    expect(orchestrator).not.toContain("'in-progress'")
    expect(orchestrator).not.toContain("'ready'")
    expect(orchestrator).toContain('UNBLOCK_LABEL')
    expect(orchestrator).toContain('UNBLOCK_BLOCKED_LABEL')
  })
})

describe('scripts/auto-unblock.sh (flock handoff)', () => {
  it('is valid bash', () => {
    expect(() =>
      execFileSync('bash', ['-n', join(repoRoot, 'scripts', 'auto-unblock.sh')], {
        stdio: 'pipe',
      }),
    ).not.toThrow()
  })

  it('holds the agent-only lock and hands fd 9 to the orchestrator', () => {
    expect(shell).toContain('exec 9>"$LOCK_FILE"')
    expect(shell).toContain('flock -n 9')
    expect(shell).toContain('exec node scripts/auto-unblock.mjs')
    // The deploy lock must never be reused: the agent cannot block a deploy,
    // and a deploy cannot be mistaken for the agent.
    expect(shell).not.toContain('teqo-deploy.lock')
    expect(shell).toContain('/tmp/teqo-unblock.lock')
  })
})

describe('scripts/auto-unblock-agent.mjs (detached wrapper)', () => {
  it('provisions through the worktree owner in headless mode', () => {
    expect(agent).toContain("'worktree.mjs'")
    expect(agent).toContain("'--headless'")
    expect(agent).toContain("'--directive'")
  })

  it('enforces the database guard before launching opencode', () => {
    const guardIndex = agent.indexOf('const targets = evaluateDatabaseTargets(')
    const launchIndex = agent.indexOf('const agentRun = runTimed(')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(launchIndex).toBeGreaterThan(guardIndex)
  })

  it('receives the token number by argv (blocked comment works without state)', () => {
    expect(agent).toContain('flags.token')
    expect(orchestrator).toContain('`--token=${created.number}`')
  })

  it('injects the PAT only via the process env (no persisted git credential)', () => {
    expect(agent).toContain("'credential.helper'")
    expect(agent).toContain('password=$GITHUB_TOKEN')
    expect(agent).not.toContain('git config')
  })

  it('caps the opencode run with escalation to SIGKILL', () => {
    expect(agent).toContain("'--kill-after=120'")
    expect(agent).toContain('AGENT_TIMEOUT_SECONDS')
  })
})
