// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildBugReport,
  classifyDeployFailure,
  classifyOutcome,
  databaseUrlFromEnvText,
  decideUnblock,
  evaluateDatabaseTargets,
  outcomeComment,
  parseHeadlessDirective,
  resolveOpenCodeBinary,
  tokenBody,
  tokenTitle,
  UNBLOCK_LABEL,
  UNBLOCK_TOKEN_TTL_MS,
} from '../../scripts/lib/auto-unblock.mjs'
import { parseEqualsFlags } from '../../scripts/lib/cli.mjs'

const job = (over: Record<string, unknown> = {}) => ({
  name: 'verify',
  conclusion: 'failure',
  htmlUrl: 'https://github.com/fsolla/teqo/actions/runs/1/job/2',
  steps: [
    { name: 'Lint', conclusion: 'success' },
    { name: 'Integration tests (full suite)', conclusion: 'failure' },
  ],
  ...over,
})

describe('decideUnblock (single-flight)', () => {
  it('sem lock e sem token → start', () => {
    expect(decideUnblock({ lockBusy: false, openToken: false })).toEqual({
      action: 'start',
      reason: 'clear',
    })
  })

  it('lock livre + token órfão imaturo → skip_comment (não dispara outro)', () => {
    expect(decideUnblock({ lockBusy: false, openToken: true, tokenAgeMs: 60_000 })).toEqual({
      action: 'skip_comment',
      reason: 'orphan-token-fresh',
    })
  })

  it('lock livre + token órfão velho → reclaim', () => {
    expect(
      decideUnblock({
        lockBusy: false,
        openToken: true,
        tokenAgeMs: UNBLOCK_TOKEN_TTL_MS,
      }),
    ).toEqual({ action: 'reclaim', reason: 'orphan-token-stale' })
  })

  it('lock livre + idade desconhecida (createdAt ilegível) → reclaim (fail-closed)', () => {
    expect(decideUnblock({ lockBusy: false, openToken: true, tokenAgeMs: Number.NaN })).toEqual({
      action: 'reclaim',
      reason: 'orphan-token-age-unknown',
    })
    expect(decideUnblock({ lockBusy: false, openToken: true, tokenAgeMs: null })).toEqual({
      action: 'reclaim',
      reason: 'orphan-token-age-unknown',
    })
  })

  it('lock ocupado + token aberto → skip_comment com agente ativo (nunca enfileira)', () => {
    for (const tokenAgeMs of [1_000, UNBLOCK_TOKEN_TTL_MS * 10]) {
      expect(decideUnblock({ lockBusy: true, openToken: true, tokenAgeMs })).toEqual({
        action: 'skip_comment',
        reason: 'agent-active',
      })
    }
  })

  it('lock ocupado sem token → skip silencioso (corrida de lock)', () => {
    expect(decideUnblock({ lockBusy: true, openToken: false })).toEqual({
      action: 'skip',
      reason: 'lock-raced',
    })
  })
})

describe('classifyDeployFailure (só o job verify interessa)', () => {
  it('verify falhou → dispara, com jobs/steps falhos normalizados', () => {
    const result = classifyDeployFailure([
      { name: 'preflight', conclusion: 'success', steps: [] },
      job(),
    ])
    expect(result.verifyFailed).toBe(true)
    expect(result.failedJobs).toEqual([
      {
        name: 'verify',
        url: 'https://github.com/fsolla/teqo/actions/runs/1/job/2',
        steps: ['Integration tests (full suite)'],
      },
    ])
  })

  it('staging vermelho com verify verde → NÃO dispara', () => {
    const result = classifyDeployFailure([
      { name: 'verify', conclusion: 'success', steps: [] },
      { name: 'deploy staging (teqo-staging)', conclusion: 'failure', steps: [] },
    ])
    expect(result.verifyFailed).toBe(false)
  })

  it('verify ausente/skipped/cancelled → NÃO dispara (fail-closed)', () => {
    expect(classifyDeployFailure([]).verifyFailed).toBe(false)
    expect(
      classifyDeployFailure([{ name: 'verify', conclusion: 'skipped', steps: [] }]).verifyFailed,
    ).toBe(false)
    expect(
      classifyDeployFailure([{ name: 'verify', conclusion: 'cancelled', steps: [] }]).verifyFailed,
    ).toBe(false)
  })
})

describe('evaluateDatabaseTargets (guard fail-closed do banco)', () => {
  const dev = 'postgresql://teqo:teqo@localhost:5432/teqo_wt42'
  const test = 'postgresql://teqo:teqo@localhost:5432/teqo_wt42_test'

  it('bancos gerados locais do worktree → ok', () => {
    expect(evaluateDatabaseTargets({ devUrl: dev, testUrl: test })).toEqual({
      ok: true,
      problems: [],
    })
  })

  it('aceita 127.0.0.1 (host local)', () => {
    expect(
      evaluateDatabaseTargets({
        devUrl: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_wt7',
        testUrl: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_wt7_test',
      }).ok,
    ).toBe(true)
  })

  it('.env.test.local precisa terminar em _test (não basta teqo_wtN)', () => {
    const result = evaluateDatabaseTargets({
      devUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt42',
      testUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt42',
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toContain('_test')
  })

  it('fallback compartilhado (teqo/teqo_test) → falha (não é banco gerado)', () => {
    const result = evaluateDatabaseTargets({
      devUrl: 'postgresql://teqo:teqo@localhost:5432/teqo',
      testUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_test',
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toContain('teqo_wt')
  })

  it('nome de produção/staging → falha mesmo em host local', () => {
    const result = evaluateDatabaseTargets({
      devUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_1313',
      testUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_staging',
    })
    expect(result.ok).toBe(false)
    expect(result.problems).toHaveLength(2)
  })

  it('host não-local → falha (nunca aponta para fora)', () => {
    const result = evaluateDatabaseTargets({
      devUrl: 'postgresql://teqo:teqo@10.20.30.40:5432/teqo_wt42',
      testUrl: 'postgresql://teqo:teqo@db.example.com:5432/teqo_wt42_test',
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toContain('não-local')
  })

  it('portas 5433/5434 (proxies do stack) → falha por defesa em profundidade', () => {
    const result = evaluateDatabaseTargets({
      devUrl: 'postgresql://teqo:teqo@127.0.0.1:5433/teqo_wt42',
      testUrl: 'postgresql://teqo:teqo@127.0.0.1:5434/teqo_wt42_test',
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toContain('proxy')
  })

  it('URL ausente/inparseável → falha', () => {
    expect(evaluateDatabaseTargets({}).ok).toBe(false)
    expect(
      evaluateDatabaseTargets({ devUrl: 'não é url', testUrl: test }).problems.join(' '),
    ).toContain('inparseável')
  })
})

describe('databaseUrlFromEnvText', () => {
  it('extrai o DATABASE_URL do texto do env gerado', () => {
    const text =
      '# marker\nPORT=3142\nDATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_wt42\n'
    expect(databaseUrlFromEnvText(text)).toBe('postgresql://teqo:teqo@localhost:5432/teqo_wt42')
  })

  it('sem DATABASE_URL → null', () => {
    expect(databaseUrlFromEnvText('PORT=3000\n')).toBeNull()
  })
})

describe('buildBugReport (handoff headless)', () => {
  const report = buildBugReport({
    runUrl: 'https://github.com/fsolla/teqo/actions/runs/123',
    runId: '123',
    sha: 'abcdef1234567890',
    failedJobs: [{ name: 'verify', steps: ['Lint'] }],
  })

  it('carrega run/SHA/jobs e o comando de logs', () => {
    expect(report).toContain('https://github.com/fsolla/teqo/actions/runs/123')
    expect(report).toContain('abcdef1234567890')
    expect(report).toContain('- verify (steps com falha: Lint)')
    expect(report).toContain('gh run view 123 --log-failed')
  })

  it('proíbe prod/staging e avisa que não há humano', () => {
    expect(report).toContain('NÃO há humano disponível')
    expect(report).toContain('teqo_1313')
    expect(report).toContain('ALLOW_REMOTE_DB')
    expect(report).toContain('Não feche a Issue do disparo')
  })
})

describe('token do single-flight', () => {
  it('título e corpo linkam o run e explicam a regra de não enfileirar', () => {
    expect(tokenTitle({ runId: '123', sha: 'abcdef1234567890' })).toBe(
      'Auto-unblock: verify falhou no deploy run 123 (abcdef1)',
    )
    const body = tokenBody({
      runUrl: 'https://github.com/fsolla/teqo/actions/runs/123',
      runId: '123',
      sha: 'abcdef1234567890',
      failedJobs: [{ name: 'verify' }],
      logPath: '/home/x/teqo-unblock/logs/unblock-123.log',
    })
    expect(body).toContain('não** dispara outro agente')
    expect(body).toContain('https://github.com/fsolla/teqo/actions/runs/123')
    expect(body).toContain('`blocked`')
  })

  it('o label do token não entra na fila de claim', () => {
    expect(UNBLOCK_LABEL).toBe('auto-unblock')
    expect(UNBLOCK_LABEL).not.toBe('ready')
    expect(UNBLOCK_LABEL).not.toBe('in-progress')
  })
})

describe('classifyOutcome', () => {
  it('PR encontrado → pr-opened', () => {
    const pr = { number: 1, htmlUrl: 'https://x/1' }
    expect(classifyOutcome({ exitCode: 0, pullRequest: pr })).toEqual({
      status: 'pr-opened',
      exitCode: 0,
      pullRequest: pr,
    })
  })

  it('sem PR → no-pr (gate humano)', () => {
    expect(classifyOutcome({ exitCode: 1 })).toEqual({ status: 'no-pr', exitCode: 1 })
  })

  it('outcomeComment cobre os dois desfechos', () => {
    expect(
      outcomeComment({
        status: 'pr-opened',
        exitCode: 0,
        branch: 'fix/x',
        pullRequest: { htmlUrl: 'https://x/1' },
        logPath: '/tmp/log',
      }),
    ).toContain('https://x/1')
    expect(
      outcomeComment({ status: 'no-pr', exitCode: 143, branch: 'fix/x', logPath: '/tmp/log' }),
    ).toContain('SEM PR')
  })
})

describe('resolveOpenCodeBinary (o PATH do runner não tem ~/.opencode/bin)', () => {
  const home = '/home/runner'
  const binDir = `${home}/.opencode/bin/opencode`

  it('OPENCODE_BIN tem precedência', () => {
    expect(
      resolveOpenCodeBinary({
        env: { OPENCODE_BIN: '/custom/opencode', PATH: '/usr/bin' },
        home,
        exists: () => true,
      }),
    ).toBe('/custom/opencode')
  })

  it('argv0 com path é devolvido como veio (o runner pode usar caminho absoluto)', () => {
    expect(
      resolveOpenCodeBinary({
        argv0: '/opt/opencode/bin/opencode',
        env: {},
        home: '',
        exists: () => false,
      }),
    ).toBe('/opt/opencode/bin/opencode')
  })

  it('cai no install padrão ~/.opencode/bin quando fora do PATH (causa do exit 127)', () => {
    expect(
      resolveOpenCodeBinary({
        argv0: 'opencode',
        env: { PATH: '/usr/bin:/bin' },
        home,
        exists: (candidate) => candidate === binDir,
      }),
    ).toBe(binDir)
  })

  it('encontra o opencode no PATH quando presente', () => {
    expect(
      resolveOpenCodeBinary({
        argv0: 'opencode',
        env: { PATH: '/usr/bin:/usr/local/bin' },
        home,
        exists: (candidate) => candidate === '/usr/local/bin/opencode',
      }),
    ).toBe('/usr/local/bin/opencode')
  })

  it('sem candidato existente → null (caller falha fechado, sem `timeout ... opencode`)', () => {
    expect(
      resolveOpenCodeBinary({
        argv0: 'opencode',
        env: { PATH: '/usr/bin' },
        home,
        exists: () => false,
      }),
    ).toBeNull()
  })
})

describe('parseHeadlessDirective', () => {
  const valid = JSON.stringify({
    dir: '/home/x/teqo-unblock/worktrees/fix/abc',
    branch: 'fix/abc',
    model: 'deepseek/deepseek-flash',
    argv: [
      'opencode',
      'run',
      '--model',
      'deepseek/deepseek-flash',
      '--auto',
      '--command',
      'bug-fix',
      'x',
    ],
  })

  it('lê a última linha JSON não vazia', () => {
    expect(parseHeadlessDirective(`\n${valid}\n`).branch).toBe('fix/abc')
  })

  it('falha fechado em payload inválido (sem dir, sem branch, sem argv)', () => {
    expect(() => parseHeadlessDirective('')).toThrow(/ausente/)
    expect(() => parseHeadlessDirective('{não json}')).toThrow()
    expect(() => parseHeadlessDirective(JSON.stringify({ dir: '/x' }))).toThrow(/inválida/)
    expect(() =>
      parseHeadlessDirective(JSON.stringify({ dir: '/x', branch: '', argv: ['opencode'] })),
    ).toThrow(/inválida/)
    expect(() =>
      parseHeadlessDirective(JSON.stringify({ dir: '/x', branch: 'fix/a', argv: [] })),
    ).toThrow(/argv/)
  })
})

describe('parseEqualsFlags (cli compartilhado)', () => {
  it('separa --flag=valor, --flag booleano e posicionais', () => {
    const { flags, positional } = parseEqualsFlags(['--state=/tmp/s.json', '--check', 'extra'])
    expect(flags).toEqual({ state: '/tmp/s.json', check: true })
    expect(positional).toEqual(['extra'])
  })

  it('valor vazio não engole o próximo argv', () => {
    const parsed = parseEqualsFlags(['--token=', '42'])
    expect(parsed.flags).toEqual({ token: '' })
    expect(parsed.positional).toEqual(['42'])
  })
})
