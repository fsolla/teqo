// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

type ExecArgs = [command: string, args: string[], options: { cwd: string }]

const execFileSyncMock = vi.fn<(...args: ExecArgs) => unknown>()

vi.mock('node:child_process', () => ({
  execFileSync: (...args: ExecArgs) => execFileSyncMock(...args),
}))

import {
  parsePostgresContainerHealth,
  shouldSkipStart,
  startSharedPostgres,
  waitForHealthyPostgres,
} from '../../scripts/lib/db-start.mjs'

/** The `docker inspect --format '{{json .State}}'` shape, not a custom one. */
const stateJson = ({ running = true, health = 'healthy' } = {}) =>
  JSON.stringify({
    Status: running ? 'running' : 'exited',
    Running: running,
    ...(health ? { Health: { Status: health } } : {}),
  })

/** Throws exactly what docker does when the container does not exist. */
const throwNoSuchObject = () => {
  const error = new Error('No such object') as Error & { stderr: Buffer }
  error.stderr = Buffer.from('No such object: teqo-postgres-1')
  throw error
}

describe('shouldSkipStart', () => {
  it('skips when the container is running and healthy', () => {
    expect(shouldSkipStart({ running: true, health: 'healthy' })).toBe(true)
  })

  it('skips when the container is running and still starting (peer just created it)', () => {
    expect(shouldSkipStart({ running: true, health: 'starting' })).toBe(true)
  })

  it('does not skip when the container is unhealthy', () => {
    expect(shouldSkipStart({ running: true, health: 'unhealthy' })).toBe(false)
  })

  it('does not skip when the container predates the healthcheck (no Health object)', () => {
    expect(shouldSkipStart({ running: true, health: '' })).toBe(false)
  })

  it('does not skip when the container is stopped', () => {
    expect(shouldSkipStart({ running: false, health: 'healthy' })).toBe(false)
  })
})

describe('parsePostgresContainerHealth', () => {
  it('parses a running healthy container', () => {
    expect(parsePostgresContainerHealth(stateJson({ health: 'healthy' }))).toEqual({
      running: true,
      health: 'healthy',
    })
  })

  it('parses a stopped container without a Health object', () => {
    expect(parsePostgresContainerHealth(stateJson({ running: false, health: '' }))).toEqual({
      running: false,
      health: '',
    })
  })

  it('parses a running container without a Health object (legacy pre-healthcheck container)', () => {
    expect(parsePostgresContainerHealth(stateJson({ health: '' }))).toEqual({
      running: true,
      health: '',
    })
  })

  it('treats an explicit null Health as no healthcheck', () => {
    expect(
      parsePostgresContainerHealth('{"Status":"running","Running":true,"Health":null}'),
    ).toEqual({
      running: true,
      health: '',
    })
  })

  it('returns null on unparseable output', () => {
    expect(parsePostgresContainerHealth('not json')).toBeNull()
    expect(parsePostgresContainerHealth('')).toBeNull()
  })
})

describe('startSharedPostgres', () => {
  beforeEach(() => {
    execFileSyncMock.mockReset()
  })

  const composeArgs = () =>
    execFileSyncMock.mock.calls.find((call) => call[1][0] === 'compose')?.[1]

  it('is a no-op when the container is already healthy (never touches compose)', async () => {
    execFileSyncMock.mockReturnValue(stateJson({ health: 'healthy' }))
    await startSharedPostgres({ cwd: '/repo' })
    expect(execFileSyncMock.mock.calls).toHaveLength(1)
    expect(execFileSyncMock.mock.calls[0][1]).toEqual([
      'inspect',
      '--format',
      '{{json .State}}',
      'teqo-postgres-1',
    ])
  })

  it('runs compose up when the container does not exist', async () => {
    execFileSyncMock.mockImplementationOnce(throwNoSuchObject).mockReturnValueOnce('')
    await startSharedPostgres({ cwd: '/repo' })
    expect(composeArgs()).toEqual([
      'compose',
      '-p',
      'teqo',
      'up',
      '-d',
      '--wait',
      '--wait-timeout',
      '120',
      'postgres',
    ])
    const composeCall = execFileSyncMock.mock.calls.find((call) => call[1][0] === 'compose')
    expect(composeCall?.[2].cwd).toBe('/repo')
  })

  it('force-recreate bypasses the healthy skip', async () => {
    execFileSyncMock.mockReturnValue(stateJson({ health: 'healthy' })).mockReturnValueOnce('')
    await startSharedPostgres({ cwd: '/repo', forceRecreate: true })
    expect(composeArgs()).toEqual([
      'compose',
      '-p',
      'teqo',
      'up',
      '-d',
      '--force-recreate',
      '--wait',
      '--wait-timeout',
      '120',
      'postgres',
    ])
  })
})

describe('waitForHealthyPostgres', () => {
  beforeEach(() => {
    execFileSyncMock.mockReset()
  })

  it('waits for a starting container and returns true when it becomes healthy', async () => {
    execFileSyncMock
      .mockReturnValueOnce(stateJson({ health: 'starting' }))
      .mockReturnValue(stateJson({ health: 'healthy' }))
    expect(await waitForHealthyPostgres({ timeoutMs: 50, intervalMs: 1 })).toBe(true)
  })

  it('falls back (false) when a starting container never becomes healthy', async () => {
    execFileSyncMock.mockReturnValue(stateJson({ health: 'starting' }))
    expect(await waitForHealthyPostgres({ timeoutMs: 10, intervalMs: 1 })).toBe(false)
  })

  it('falls back (false) when the container turns unhealthy', async () => {
    execFileSyncMock
      .mockReturnValueOnce(stateJson({ health: 'starting' }))
      .mockReturnValue(stateJson({ health: 'unhealthy' }))
    expect(await waitForHealthyPostgres({ timeoutMs: 50, intervalMs: 1 })).toBe(false)
  })

  it('falls back (false) when the container disappears', async () => {
    execFileSyncMock
      .mockReturnValueOnce(stateJson({ health: 'starting' }))
      .mockImplementation(throwNoSuchObject)
    expect(await waitForHealthyPostgres({ timeoutMs: 50, intervalMs: 1 })).toBe(false)
  })
})
