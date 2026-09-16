// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assertKnownFlags,
  attachArgs,
  buildCreateSessionBody,
  codeFromBranch,
  DEFAULT_AGENT_SERVER_HOST,
  DEFAULT_AGENT_SERVER_PORT,
  deriveSessionStatus,
  driverArgs,
  driverLogPath,
  formatSessionList,
  isLoopbackHost,
  isStaleLock,
  nearestAcceptedFlag,
  parseModelRef,
  parseServerState,
  parseSessionState,
  purposeInvocation,
  resolveServerConfig,
  resolveSessionRef,
  resolveStartDecision,
  serializeServerState,
  serializeSessionState,
  serverArgs,
  serverStatePath,
  SESSION_COMMAND_BY_PURPOSE,
  SESSION_FLAG_ALLOWLIST,
  sessionDirFromEnv,
  sessionListPayload,
  sessionSlug,
  sessionStatePath,
  startLockPath,
  STATE_VERSION,
  validateServerBind,
  validateSessionFlags,
} from '../../scripts/lib/agent-session.mjs'

const state = (over: Record<string, unknown> = {}) => ({
  version: STATE_VERSION,
  code: 'OPS110',
  issue: 1019,
  purpose: 'next',
  branch: 'OPS110-acompanhar-runs',
  dir: '/home/fsolla/.cursor/worktrees/teqo/OPS110-acompanhar-runs',
  sessionID: 'ses_f5b6ec763ffeTquA6nLR2XVxz3',
  url: `http://${DEFAULT_AGENT_SERVER_HOST}:${DEFAULT_AGENT_SERVER_PORT}`,
  model: 'deepseek/deepseek-flash',
  driverPid: 4242,
  logPath: '/home/fsolla/.local/state/teqo/agent-sessions/ops110-acompanhar-runs.log',
  startedAt: '2026-09-15T10:00:00.000Z',
  stoppedAt: null,
  ...over,
})

describe('resolveServerConfig (OPS110 — loopback por padrão, env/flag overridáveis)', () => {
  it('defaults to loopback:4199', () => {
    expect(resolveServerConfig({ env: {} })).toEqual({
      hostname: '127.0.0.1',
      port: 4199,
      url: 'http://127.0.0.1:4199',
    })
    expect(DEFAULT_AGENT_SERVER_HOST).toBe('127.0.0.1')
    expect(DEFAULT_AGENT_SERVER_PORT).toBe(4199)
  })

  it('reads TEQO_AGENT_SERVER_HOST/PORT from the env', () => {
    expect(
      resolveServerConfig({
        env: { TEQO_AGENT_SERVER_HOST: '100.119.220.31', TEQO_AGENT_SERVER_PORT: '4300' },
      }),
    ).toEqual({ hostname: '100.119.220.31', port: 4300, url: 'http://100.119.220.31:4300' })
  })

  it('explicit flags win over the env (serve --hostname/--port)', () => {
    expect(
      resolveServerConfig({
        hostname: '127.0.0.1',
        port: 5000,
        env: { TEQO_AGENT_SERVER_PORT: '4300' },
      }),
    ).toEqual({ hostname: '127.0.0.1', port: 5000, url: 'http://127.0.0.1:5000' })
  })

  it('rejects a non-numeric/out-of-range port — fail high, never guess', () => {
    expect(() => resolveServerConfig({ env: { TEQO_AGENT_SERVER_PORT: 'abc' } })).toThrow(/porta/)
    expect(() => resolveServerConfig({ env: { TEQO_AGENT_SERVER_PORT: '70000' } })).toThrow(/porta/)
  })
})

describe('validateServerBind + isLoopbackHost (aceite: nada além do loopback sem credencial)', () => {
  it('recognizes loopback spellings only', () => {
    for (const host of ['127.0.0.1', '127.0.0.5', 'localhost', '::1', '[::1]', ' LOCALHOST ']) {
      expect(isLoopbackHost(host)).toBe(true)
    }
    for (const host of [
      '0.0.0.0',
      '100.119.220.31',
      '192.168.1.10',
      'jorgesolla1313.com.br',
      '127.0.0.1.evil',
      '127.0.0.1.example.com',
    ]) {
      expect(isLoopbackHost(host)).toBe(false)
    }
  })

  it('loopback never requires a password', () => {
    expect(validateServerBind({ hostname: '127.0.0.1', password: '' })).toBe(true)
  })

  it('non-loopback without OPENCODE_SERVER_PASSWORD fails closed', () => {
    expect(() => validateServerBind({ hostname: '100.119.220.31', password: '' })).toThrow(
      /OPENCODE_SERVER_PASSWORD/,
    )
    expect(() => validateServerBind({ hostname: '0.0.0.0', password: undefined })).toThrow(
      /credencial|OPENCODE_SERVER_PASSWORD/,
    )
  })

  it('non-loopback with a password is allowed', () => {
    expect(validateServerBind({ hostname: '100.119.220.31', password: 'x' })).toBe(true)
  })
})

describe('sessionDirFromEnv + caminhos de estado', () => {
  it('TEQO_AGENT_SESSION_DIR wins; XDG_STATE_HOME; HOME fallback', () => {
    expect(sessionDirFromEnv({ TEQO_AGENT_SESSION_DIR: '/tmp/runs', HOME: '/home/x' })).toBe(
      '/tmp/runs',
    )
    expect(sessionDirFromEnv({ XDG_STATE_HOME: '/xdg', HOME: '/home/x' })).toBe(
      '/xdg/teqo/agent-sessions',
    )
    expect(sessionDirFromEnv({ HOME: '/home/x' })).toBe('/home/x/.local/state/teqo/agent-sessions')
  })

  it('slugs the branch (paths with / become one filename) and derives every path', () => {
    expect(sessionSlug('OPS110-acompanhar-runs')).toBe('ops110-acompanhar-runs')
    expect(sessionSlug('plans/plan-issue-agenda eleitoral')).toBe(
      'plans-plan-issue-agenda-eleitoral',
    )
    const sessionDir = '/state'
    const branch = 'plans/plan-issue-agenda'
    expect(sessionStatePath({ sessionDir, branch })).toBe('/state/plans-plan-issue-agenda.json')
    expect(startLockPath({ sessionDir, branch })).toBe('/state/plans-plan-issue-agenda.lock')
    expect(driverLogPath({ sessionDir, branch })).toBe('/state/plans-plan-issue-agenda.log')
    expect(serverStatePath({ sessionDir })).toBe('/state/server.json')
  })
})

describe('codeFromBranch', () => {
  it('reads the uppercase code prefix of a claim branch', () => {
    expect(codeFromBranch('OPS110-acompanhar-runs')).toBe('OPS110')
    expect(codeFromBranch('C15-fullcalendar')).toBe('C15')
  })

  it('returns null for namespace branches (plan/new/fix have no claim code)', () => {
    expect(codeFromBranch('plans/plan-issue-1')).toBeNull()
    expect(codeFromBranch('work/ideia')).toBeNull()
    expect(codeFromBranch('fix/abc')).toBeNull()
  })
})

describe('estado da sessão (contrato OPS109)', () => {
  it('serializes and parses the documented fields (roundtrip)', () => {
    const parsed = parseSessionState(serializeSessionState(state()))
    expect(parsed).toEqual(state())
    expect(parsed.sessionID).toMatch(/^ses/)
    expect(parsed.version).toBe(STATE_VERSION)
  })

  it('fails high on a malformed state (never silently accepts)', () => {
    expect(() => parseSessionState('not json')).toThrow(/inválido/)
    expect(() => parseSessionState(JSON.stringify({ branch: 'x' }))).toThrow(/inválido/)
    expect(() => parseSessionState(JSON.stringify({ ...state(), sessionID: 'nope' }))).toThrow(
      /inválido/,
    )
  })

  it('serializes/parses the server state', () => {
    const server = {
      version: STATE_VERSION,
      url: 'http://127.0.0.1:4199',
      hostname: '127.0.0.1',
      port: 4199,
      pid: 777,
      startedAt: '2026-09-15T10:00:00.000Z',
      logPath: '/state/server.log',
    }
    expect(parseServerState(serializeServerState(server))).toEqual(server)
    expect(() => parseServerState('{}')).toThrow(/inválido/)
  })
})

describe('purposeInvocation (mapa purpose→comando movido do worktree)', () => {
  it('pins the skill command by purpose', () => {
    expect(SESSION_COMMAND_BY_PURPOSE).toEqual({
      next: 'work-issue',
      plan: 'plan-issue',
      new: null,
      fix: 'bug-fix',
    })
  })

  it('next carries the claimed issue as --issue <N>', () => {
    expect(purposeInvocation({ purpose: 'next', issueNumber: 1019 })).toEqual({
      command: 'work-issue',
      arguments: '--issue 1019',
    })
  })

  it('next without a valid issue starts no driver — nothing to auto-submit', () => {
    expect(purposeInvocation({ purpose: 'next' })).toBeNull()
    expect(purposeInvocation({ purpose: 'next', issueNumber: 'x' })).toBeNull()
    expect(purposeInvocation({ purpose: 'next', issueNumber: 0 })).toBeNull()
  })

  it('plan without a bag starts no driver — the human types the context', () => {
    expect(purposeInvocation({ purpose: 'plan' })).toBeNull()
    expect(purposeInvocation({ purpose: 'plan', issueNumber: 7 })).toBeNull()
    expect(purposeInvocation({ purpose: 'plan', argument: '  ""  ' })).toBeNull()
  })

  it('plan carries the opening message as the sanitized bag (xargs/argv-safe)', () => {
    expect(purposeInvocation({ purpose: 'plan', argument: 'revisa o gate do designer' })).toEqual({
      command: 'plan-issue',
      arguments: 'revisa o gate do designer',
    })
    expect(purposeInvocation({ purpose: 'plan', argument: 'a"b\\c' })).toEqual({
      command: 'plan-issue',
      arguments: 'abc',
    })
  })

  it('new has no command at all (apenas conversar)', () => {
    expect(purposeInvocation({ purpose: 'new' })).toBeNull()
  })

  it('fix sends the sanitized bag (xargs/argv-safe); empty bag sends the bare command', () => {
    expect(purposeInvocation({ purpose: 'fix', argument: 'a"b\\c bug' })).toEqual({
      command: 'bug-fix',
      arguments: 'abc bug',
    })
    expect(purposeInvocation({ purpose: 'fix', argument: '  ""  ' })).toEqual({
      command: 'bug-fix',
      arguments: '',
    })
  })

  it('unknown purpose degrades to no command (fail-safe direction)', () => {
    expect(purposeInvocation({ purpose: 'bogus' })).toBeNull()
    expect(purposeInvocation({})).toBeNull()
  })

  it('auto=true transposes to the exact skill flags — /work-issue --issue N --auto', () => {
    expect(purposeInvocation({ purpose: 'next', issueNumber: 1088, auto: true })).toEqual({
      command: 'work-issue',
      arguments: '--issue 1088 --auto',
    })
  })

  it('auto=true prefixes plan/fix bags — /plan-issue --auto <bag> and /bug-fix --auto <bag>', () => {
    expect(purposeInvocation({ purpose: 'plan', argument: 'revisa o gate', auto: true })).toEqual({
      command: 'plan-issue',
      arguments: '--auto revisa o gate',
    })
    expect(purposeInvocation({ purpose: 'fix', argument: '500 no autosave', auto: true })).toEqual({
      command: 'bug-fix',
      arguments: '--auto 500 no autosave',
    })
  })

  it('auto=true with an empty fix bag still submits the bare flag — /bug-fix --auto', () => {
    expect(purposeInvocation({ purpose: 'fix', auto: true })).toEqual({
      command: 'bug-fix',
      arguments: '--auto',
    })
  })

  it('auto=false (default) keeps the supervised forms byte-identical', () => {
    expect(purposeInvocation({ purpose: 'next', issueNumber: 1088 })).toEqual({
      command: 'work-issue',
      arguments: '--issue 1088',
    })
    expect(purposeInvocation({ purpose: 'fix', argument: 'b' })).toMatchObject({
      arguments: 'b',
    })
    expect(purposeInvocation({ purpose: 'fix' })).toMatchObject({ arguments: '' })
    expect(purposeInvocation({ purpose: 'plan', argument: 'b' })).toMatchObject({
      arguments: 'b',
    })
  })

  it('auto=true never resurrects a missing invocation (new / plan without bag stay null)', () => {
    expect(purposeInvocation({ purpose: 'new', auto: true })).toBeNull()
    expect(purposeInvocation({ purpose: 'plan', auto: true })).toBeNull()
    expect(purposeInvocation({ purpose: 'plan', argument: '  ', auto: true })).toBeNull()
  })
})

describe('parseModelRef + buildCreateSessionBody (OPS122 — o modelo chega à SESSÃO)', () => {
  it('splits provider/model at the FIRST slash', () => {
    expect(parseModelRef('opencode/muse-spark-1.3-contributor-free')).toEqual({
      providerID: 'opencode',
      id: 'muse-spark-1.3-contributor-free',
    })
    expect(parseModelRef('openrouter/openrouter/free')).toEqual({
      providerID: 'openrouter',
      id: 'openrouter/free',
    })
    expect(parseModelRef('opencode-go/deepseek-v4.1-flash')).toEqual({
      providerID: 'opencode-go',
      id: 'deepseek-v4.1-flash',
    })
  })

  it('fails high on a model without provider/id — never sends a half ref', () => {
    expect(() => parseModelRef('deepseek-flash')).toThrow(/provider\/model|inválido/)
    expect(() => parseModelRef('/deepseek-flash')).toThrow(/inválido/)
    expect(() => parseModelRef('deepseek/')).toThrow(/inválido/)
    expect(() => parseModelRef('')).toThrow()
    expect(() => parseModelRef(null as unknown as string)).toThrow()
  })

  it('builds the POST /session body with the model ref, or an empty body without one', () => {
    expect(buildCreateSessionBody({ model: 'opencode-go/deepseek-v4.1-flash' })).toEqual({
      model: { providerID: 'opencode-go', id: 'deepseek-v4.1-flash' },
    })
    expect(buildCreateSessionBody({ model: null })).toEqual({})
    expect(buildCreateSessionBody({ model: undefined })).toEqual({})
    expect(buildCreateSessionBody({})).toEqual({})
    expect(buildCreateSessionBody()).toEqual({})
    expect(() => buildCreateSessionBody({ model: 'no-slash' })).toThrow(/inválido|provider/)
  })

  it('never emits a variant (OPS95 — variants live on the machine config)', () => {
    const body = buildCreateSessionBody({ model: 'opencode-go/deepseek-v4.1-flash' })
    expect(body.model).not.toHaveProperty('variant')
  })
})

describe('assertKnownFlags (dono único da mensagem fail-high)', () => {
  it('is silent when every flag is accepted or a bare `--`', () => {
    expect(() =>
      assertKnownFlags({ flags: { '': true, stay: true }, accepted: ['stay'] }),
    ).not.toThrow()
  })

  it('throws with a neighbor suggestion, or as-is without one', () => {
    expect(() => assertKnownFlags({ flags: { stya: true }, accepted: ['stay'] })).toThrow(
      /--stya[\s\S]*--stay/,
    )
    expect(() => assertKnownFlags({ flags: { nope: true }, accepted: ['stay'] })).toThrow(
      'flag desconhecida: --nope.',
    )
  })
})

describe('validateSessionFlags + nearestAcceptedFlag (OPS110-F1 — flag desconhecida falha alto)', () => {
  it('pins the accepted flag names per verb', () => {
    expect(SESSION_FLAG_ALLOWLIST).toEqual({
      serve: ['hostname', 'port'],
      start: [
        'purpose',
        'dir',
        'model',
        'issue',
        'argument',
        'new',
        'skill-auto',
        'hostname',
        'port',
      ],
      attach: ['session', 'branch', 'issue'],
      stop: ['session', 'branch', 'issue'],
      list: ['json', 'hostname', 'port'],
    })
  })

  it('accepts every documented flag per verb (names only, valued or boolean)', () => {
    expect(() =>
      validateSessionFlags({
        subcommand: 'start',
        flags: {
          purpose: 'next',
          dir: '/d',
          model: 'm',
          issue: '1',
          argument: 'x',
          new: true,
          'skill-auto': true,
          hostname: 'h',
          port: '1',
        },
      }),
    ).not.toThrow()
    expect(() =>
      validateSessionFlags({ subcommand: 'serve', flags: { hostname: 'h', port: '1' } }),
    ).not.toThrow()
    expect(() =>
      validateSessionFlags({ subcommand: 'list', flags: { json: true, hostname: 'h', port: '1' } }),
    ).not.toThrow()
    expect(() =>
      validateSessionFlags({ subcommand: 'attach', flags: { session: 'ses_x' } }),
    ).not.toThrow()
    expect(() => validateSessionFlags({ subcommand: 'stop', flags: { branch: 'b' } })).not.toThrow()
  })

  it('suggests the transposition neighbor: --prupose → --purpose', () => {
    expect(nearestAcceptedFlag('prupose', ['purpose', 'dir', 'model'])).toBe('purpose')
    expect(() => validateSessionFlags({ subcommand: 'start', flags: { prupose: 'next' } })).toThrow(
      /--prupose[\s\S]*--purpose/,
    )
  })

  it('suggests substitution/insertion neighbors at distance 1, nothing at distance 2', () => {
    expect(nearestAcceptedFlag('purposee', ['purpose'])).toBe('purpose')
    expect(nearestAcceptedFlag('purpos', ['purpose'])).toBe('purpose')
    expect(nearestAcceptedFlag('prpose', ['purpose'])).toBe('purpose')
    expect(nearestAcceptedFlag('purposxx', ['purpose'])).toBeNull()
    expect(nearestAcceptedFlag('totallyWrong', ['purpose', 'dir'])).toBeNull()
  })

  it('reports an unknown flag without a suggestion as-is', () => {
    expect(() =>
      validateSessionFlags({ subcommand: 'start', flags: { totallyWrong: true } }),
    ).toThrow('flag desconhecida: --totallyWrong.')
  })

  it('rejects a flag that belongs to another verb', () => {
    expect(() => validateSessionFlags({ subcommand: 'serve', flags: { purpose: 'next' } })).toThrow(
      /--purpose/,
    )
    expect(() => validateSessionFlags({ subcommand: 'list', flags: { dir: '/d' } })).toThrow(
      /--dir/,
    )
  })

  it('ignores a bare `--` (empty flag name), never a typo', () => {
    expect(() =>
      validateSessionFlags({ subcommand: 'start', flags: { '': true, purpose: 'next' } }),
    ).not.toThrow()
  })

  it('stays silent for an unknown verb (the CLI prints the USAGE itself)', () => {
    expect(() =>
      validateSessionFlags({ subcommand: 'bogus', flags: { whatever: true } }),
    ).not.toThrow()
    expect(() =>
      validateSessionFlags({ subcommand: null, flags: { whatever: true } }),
    ).not.toThrow()
  })
})

describe('driverArgs + attachArgs (o argv verificado ao vivo)', () => {
  it('drives the run through the server with --auto and --command + `--` separator', () => {
    expect(
      driverArgs({
        url: 'http://127.0.0.1:4199',
        sessionID: 'ses_abc',
        dir: '/work/OPS110',
        model: 'deepseek/deepseek-flash',
        invocation: { command: 'work-issue', arguments: '--issue 1019' },
      }),
    ).toEqual([
      'run',
      '--attach',
      'http://127.0.0.1:4199',
      '-s',
      'ses_abc',
      '--dir',
      '/work/OPS110',
      '--model',
      'deepseek/deepseek-flash',
      '--auto',
      '--command',
      'work-issue',
      '--',
      '--issue 1019',
    ])
  })

  it('omits the `--` separator when the invocation carries no arguments (fix with an empty bag)', () => {
    expect(
      driverArgs({
        url: 'http://127.0.0.1:4199',
        sessionID: 'ses_abc',
        dir: '/work/fix',
        model: 'm',
        invocation: { command: 'bug-fix', arguments: '' },
      }),
    ).toEqual([
      'run',
      '--attach',
      'http://127.0.0.1:4199',
      '-s',
      'ses_abc',
      '--dir',
      '/work/fix',
      '--model',
      'm',
      '--auto',
      '--command',
      'bug-fix',
    ])
  })

  it('fails high on a missing url/session/model (never spawns half a run)', () => {
    expect(() =>
      driverArgs({
        url: '',
        sessionID: 'ses_abc',
        dir: '/d',
        model: 'm',
        invocation: { command: 'work-issue', arguments: '' },
      }),
    ).toThrow(/url/)
    expect(() =>
      driverArgs({
        url: 'http://x',
        sessionID: '',
        dir: '/d',
        model: 'm',
        invocation: { command: 'work-issue', arguments: '' },
      }),
    ).toThrow(/session/)
    expect(() =>
      driverArgs({
        url: 'http://x',
        sessionID: 'ses_abc',
        dir: '/d',
        model: '',
        invocation: { command: 'work-issue', arguments: '' },
      }),
    ).toThrow(/model/)
    expect(() =>
      driverArgs({
        url: 'http://x',
        sessionID: 'ses_abc',
        dir: '/d',
        model: 'm',
        invocation: null,
      }),
    ).toThrow(/invocation|comando/i)
  })

  it('fails high on a missing attach url/session/dir — never spawns a half attach', () => {
    expect(() => attachArgs({ url: '', sessionID: 'ses_a', dir: '/d' })).toThrow(/url/)
    expect(() => attachArgs({ url: 'http://x', sessionID: '', dir: '/d' })).toThrow(/session/)
    expect(() => attachArgs({ url: 'http://x', sessionID: 'ses_a', dir: '' })).toThrow(/dir/)
  })

  it('attach resumes exactly the same session/dir (never passes --auto/--model)', () => {
    const argv = attachArgs({ url: 'http://127.0.0.1:4199', sessionID: 'ses_abc', dir: '/work/x' })
    expect(argv).toEqual(['attach', 'http://127.0.0.1:4199', '--dir', '/work/x', '-s', 'ses_abc'])
    expect(argv).not.toContain('--auto')
    expect(argv).not.toContain('--model')
  })

  it('serverArgs is loopback-flagged and never enables --mdns', () => {
    expect(serverArgs({ port: 4199, hostname: '127.0.0.1' })).toEqual([
      'serve',
      '--port',
      '4199',
      '--hostname',
      '127.0.0.1',
    ])
    expect(serverArgs({ port: 4199, hostname: '127.0.0.1' })).not.toContain('--mdns')
  })
})

describe('resolveSessionRef (--session > --branch > --issue > branch do cwd)', () => {
  const next = state()
  const plan = state({
    code: null,
    issue: null,
    branch: 'plans/plan-issue-agenda',
    sessionID: 'ses_plan',
    dir: '/work/plans/plan-issue-agenda',
  })

  it('resolves by session id first', () => {
    expect(
      resolveSessionRef({ states: [next, plan], session: 'ses_plan', branch: next.branch }),
    ).toBe(plan)
  })

  it('resolves by branch, then by issue, then by cwd branch', () => {
    expect(resolveSessionRef({ states: [next, plan], branch: plan.branch })).toBe(plan)
    expect(resolveSessionRef({ states: [next, plan], issue: 1019 })).toBe(next)
    expect(resolveSessionRef({ states: [next, plan], cwdBranch: next.branch })).toBe(next)
  })

  it('returns null when nothing matches', () => {
    expect(resolveSessionRef({ states: [next, plan], session: 'ses_nope' })).toBeNull()
    expect(resolveSessionRef({ states: [], cwdBranch: 'x' })).toBeNull()
    expect(resolveSessionRef({ states: [next, plan] })).toBeNull()
  })
})

describe('resolveStartDecision (OPS110-F1 — single-flight "reusar vs criar")', () => {
  const liveState = state()
  const base = {
    statePath: '/state/OPS110.json',
    serverUrl: liveState.url,
    readFile: () => JSON.stringify(liveState),
    exists: () => true,
    probeBusy: async () => false,
    driverAlive: () => false,
  }

  it('reuses when the driver is alive on the same server', async () => {
    expect(await resolveStartDecision({ ...base, driverAlive: () => true })).toMatchObject({
      action: 'reuse',
      reason: 'running',
      state: liveState,
    })
  })

  it('reuses when the session is busy even with the driver gone', async () => {
    expect(await resolveStartDecision({ ...base, probeBusy: async () => true })).toMatchObject({
      action: 'reuse',
      reason: 'running',
    })
  })

  it('creates fresh when idle (driver dead and not busy)', async () => {
    expect(await resolveStartDecision(base)).toMatchObject({ action: 'fresh', reason: 'idle' })
  })

  it('--new forces fresh without reading the state', async () => {
    let read = false
    const decision = await resolveStartDecision({
      ...base,
      forceNew: true,
      readFile: () => {
        read = true
        return 'ignored'
      },
    })
    expect(decision).toMatchObject({ action: 'fresh', reason: 'forced' })
    expect(read).toBe(false)
  })

  it('creates fresh when there is no state file', async () => {
    expect(await resolveStartDecision({ ...base, exists: () => false })).toMatchObject({
      action: 'fresh',
      reason: 'missing',
    })
  })

  it('creates fresh on unreadable state and surfaces the error for the CLI warning', async () => {
    const decision = await resolveStartDecision({
      ...base,
      readFile: () => {
        throw new Error('boom')
      },
    })
    expect(decision.action).toBe('fresh')
    expect(decision.reason).toBe('unreadable')
    expect(decision.error?.message).toBe('boom')
  })

  it('creates fresh when the state points at another server', async () => {
    expect(await resolveStartDecision({ ...base, serverUrl: 'http://other:1' })).toMatchObject({
      action: 'fresh',
      reason: 'server-mismatch',
    })
  })
})

describe('isStaleLock (OPS110-F1 — reclaim do lock com PID morto)', () => {
  it('treats a dead PID as stale', () => {
    expect(isStaleLock({ holderPid: 4242, isPidAlive: () => false })).toBe(true)
  })

  it('keeps a live holder (not stale)', () => {
    expect(isStaleLock({ holderPid: 4242, isPidAlive: () => true })).toBe(false)
  })

  it('treats a missing/non-numeric holder as stale (never deadlocks forever)', () => {
    expect(isStaleLock({ holderPid: NaN, isPidAlive: () => true })).toBe(true)
    expect(isStaleLock({ holderPid: null, isPidAlive: () => true })).toBe(true)
    expect(isStaleLock({ holderPid: 0, isPidAlive: () => true })).toBe(true)
  })
})

describe('deriveSessionStatus + list (contrato OPS109)', () => {
  it('stopped > unknown (server down) > working (busy or driver alive) > idle', () => {
    const live = state()
    expect(
      deriveSessionStatus({
        state: live,
        serverHealthy: true,
        sessionBusy: true,
        driverAlive: false,
      }),
    ).toBe('working')
    expect(
      deriveSessionStatus({
        state: live,
        serverHealthy: true,
        sessionBusy: false,
        driverAlive: true,
      }),
    ).toBe('working')
    expect(
      deriveSessionStatus({
        state: live,
        serverHealthy: true,
        sessionBusy: false,
        driverAlive: false,
      }),
    ).toBe('idle')
    expect(
      deriveSessionStatus({
        state: live,
        serverHealthy: false,
        sessionBusy: false,
        driverAlive: false,
      }),
    ).toBe('unknown')
    const stopped = state({ stoppedAt: '2026-09-15T11:00:00.000Z' })
    expect(
      deriveSessionStatus({
        state: stopped,
        serverHealthy: true,
        sessionBusy: true,
        driverAlive: true,
      }),
    ).toBe('stopped')
  })

  it('list payload carries the versioned contract with the derived status', () => {
    const payload = sessionListPayload({
      states: [state()],
      statuses: { ses_f5b6ec763ffeTquA6nLR2XVxz3: 'working' },
      server: { url: 'http://127.0.0.1:4199', healthy: true, version: '1.18.31' },
    })
    expect(payload.version).toBe(STATE_VERSION)
    expect(payload.server).toEqual({
      url: 'http://127.0.0.1:4199',
      healthy: true,
      version: '1.18.31',
    })
    expect(payload.sessions).toHaveLength(1)
    expect(payload.sessions[0]).toMatchObject({
      sessionID: 'ses_f5b6ec763ffeTquA6nLR2XVxz3',
      issue: 1019,
      status: 'working',
    })
  })

  it('list payload marks a session without a known status as unknown (never lies)', () => {
    const payload = sessionListPayload({
      states: [state()],
      server: { url: 'http://127.0.0.1:4199', healthy: false, version: null },
    })
    expect(payload.sessions[0].status).toBe('unknown')
  })

  it('human list prints one line per run with status/session/branch/dir/log', () => {
    const lines = formatSessionList([
      {
        status: 'working',
        code: 'OPS110',
        issue: 1019,
        branch: 'OPS110-acompanhar-runs',
        sessionID: 'ses_abc',
        dir: '/work/OPS110',
        logPath: '/state/ops110-acompanhar-runs.log',
      },
      {
        status: 'idle',
        code: null,
        issue: null,
        branch: 'plans/plan-issue-1',
        sessionID: 'ses_def',
        dir: '/work/plans/plan-issue-1',
      },
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('working')
    expect(lines[0]).toContain('OPS110')
    expect(lines[0]).toContain('#1019')
    expect(lines[0]).toContain('ses_abc')
    expect(lines[0]).toContain('/work/OPS110')
    expect(lines[0]).toContain('/state/ops110-acompanhar-runs.log')
    expect(lines[1]).toContain('plans/plan-issue-1')
    expect(lines[1]).not.toContain('#null')
    expect(lines[1].endsWith('—')).toBe(true)
  })
})
