// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  OPS_GLOBAL_TARGETS,
  buildOpsGlobalWrite,
  formatOpsGlobalOperations,
  formatOpsGlobalRecoveryCommand,
  formatOpsGlobalReport,
  opsGlobalReportStamp,
  parseOpsGlobalCliArgs,
} from '../../scripts/lib/opsGlobal.mjs'

// C247 — the pure parser/plan of `pnpm ops:global`: the closed write surface,
// the dry-run default, the previous→new plan with rollback and the receipt
// helpers (the recovery recipe never carries the secret value).

describe('OPS_GLOBAL_TARGETS', () => {
  it('is a closed table: photoAlbum with the two operational flags only', () => {
    expect(Object.keys(OPS_GLOBAL_TARGETS)).toEqual(['photoAlbum'])
    expect(Object.keys(OPS_GLOBAL_TARGETS.photoAlbum.flags)).toEqual(['selfie-search', 'published'])
  })

  it('generates the HELP operation block from the table', () => {
    const lines = formatOpsGlobalOperations().join('\n')
    expect(lines).toContain('photoAlbum --selfie-search <on|off>')
    expect(lines).toContain('photoAlbum --published <on|off>')
    expect(lines).toContain('Busca por selfie')
  })
})

describe('parseOpsGlobalCliArgs', () => {
  it('defaults to the plan mode and parses the operation', () => {
    expect(parseOpsGlobalCliArgs(['photoAlbum', '--selfie-search', 'on'])).toEqual({
      slug: 'photoAlbum',
      operation: 'selfie-search',
      value: true,
      mode: 'plan',
      help: false,
    })
    expect(parseOpsGlobalCliArgs(['photoAlbum', '--published', 'off', '--apply'])).toEqual({
      slug: 'photoAlbum',
      operation: 'published',
      value: false,
      mode: 'apply',
      help: false,
    })
    expect(
      parseOpsGlobalCliArgs(['--verify', 'photoAlbum', '--selfie-search', 'off']),
    ).toMatchObject({
      operation: 'selfie-search',
      value: false,
      mode: 'verify',
    })
    expect(parseOpsGlobalCliArgs(['--help']).help).toBe(true)
  })

  it('fails closed on unknown slug/flag/value, missing value and mode conflicts', () => {
    expect(() => parseOpsGlobalCliArgs([])).toThrow(/informe o global/)
    expect(() => parseOpsGlobalCliArgs(['homePage', '--selfie-search', 'on'])).toThrow(
      /fora da tabela/,
    )
    expect(() => parseOpsGlobalCliArgs(['photoAlbum', '--nope', 'on'])).toThrow(/fora da tabela/)
    expect(() => parseOpsGlobalCliArgs(['photoAlbum', '--selfie-search', 'maybe'])).toThrow(
      /valor inválido/,
    )
    expect(() => parseOpsGlobalCliArgs(['photoAlbum', '--selfie-search'])).toThrow(/faltou valor/)
    expect(() => parseOpsGlobalCliArgs(['photoAlbum', '--selfie-search', 'on', 'extra'])).toThrow(
      /posicional desconhecido/,
    )
    expect(() =>
      parseOpsGlobalCliArgs(['photoAlbum', '--selfie-search', 'on', '--published', 'off']),
    ).toThrow(/mais de uma operação/)
    expect(() => parseOpsGlobalCliArgs(['photoAlbum'])).toThrow(/informe a operação/)
    expect(() =>
      parseOpsGlobalCliArgs(['photoAlbum', '--selfie-search', 'on', '--apply', '--verify']),
    ).toThrow(/mutuamente exclusivos/)
  })
})

describe('buildOpsGlobalWrite', () => {
  it('plans a single-field write with the previous value and the rollback command', () => {
    const fromAbsent = buildOpsGlobalWrite({
      slug: 'photoAlbum',
      operation: 'selfie-search',
      value: true,
      currentDoc: {},
    })
    expect(fromAbsent).toMatchObject({
      field: 'selfieSearchEnabled',
      previousValue: false,
      newValue: true,
      changed: true,
      data: { selfieSearchEnabled: true },
      rollbackCommand: 'pnpm ops:global photoAlbum --selfie-search off --apply',
    })

    const fromFalse = buildOpsGlobalWrite({
      slug: 'photoAlbum',
      operation: 'published',
      value: true,
      currentDoc: { published: false },
    })
    expect(fromFalse).toMatchObject({
      previousValue: false,
      changed: true,
      rollbackCommand: 'pnpm ops:global photoAlbum --published off --apply',
    })
  })

  it('reports no change when the flag already holds the requested value', () => {
    const write = buildOpsGlobalWrite({
      slug: 'photoAlbum',
      operation: 'published',
      value: true,
      currentDoc: { published: true },
    })
    expect(write.changed).toBe(false)
    expect(write.data).toEqual({ published: true })
  })

  it('falls back to the table default when the row/slot is absent', () => {
    // `published` defaults to true in the global; an absent row is an open album.
    const write = buildOpsGlobalWrite({
      slug: 'photoAlbum',
      operation: 'published',
      value: true,
      currentDoc: null,
    })
    expect(write.previousValue).toBe(true)
    expect(write.changed).toBe(false)
  })

  it('rolls back to on when the previous value was true, and refuses unknown operations', () => {
    const write = buildOpsGlobalWrite({
      slug: 'photoAlbum',
      operation: 'published',
      value: false,
      currentDoc: { published: true },
    })
    expect(write.rollbackCommand).toBe('pnpm ops:global photoAlbum --published on --apply')

    expect(() =>
      buildOpsGlobalWrite({
        slug: 'photoAlbum',
        operation: 'nope',
        value: true,
        currentDoc: {},
      }),
    ).toThrow(/fora da tabela/)
  })
})

describe('receipt helpers', () => {
  it('stamps the receipt name like the other CLIs', () => {
    expect(opsGlobalReportStamp('2026-10-01T04:09:04.123Z')).toBe('2026-10-01T04-09-04-123Z')
  })

  it('builds the recovery command without ever printing the secret value', () => {
    const command = formatOpsGlobalRecoveryCommand({
      baseUrl: 'https://jorgesolla1313.com.br',
      tag: 'global_photoAlbum',
    })
    expect(command).toContain('/api/revalidate?tag=global_photoAlbum')
    expect(command).toContain('x-revalidate-secret: $REVALIDATE_SECRET')
  })

  it('prints the plan line and the divergence verdict', () => {
    const plan = formatOpsGlobalReport({
      mode: 'plan',
      target: 'host/db',
      slug: 'photoAlbum',
      field: 'selfieSearchEnabled',
      previousValue: false,
      newValue: true,
      changed: true,
      write: 'none',
      revalidation: null,
    }).join('\n')
    expect(plan).toContain('modo: plan')
    expect(plan).toContain('photoAlbum.selfieSearchEnabled: off → on')
    expect(plan).toContain('use --apply')

    const verify = formatOpsGlobalReport({
      mode: 'verify',
      target: 'host/db',
      slug: 'photoAlbum',
      field: 'selfieSearchEnabled',
      previousValue: false,
      newValue: true,
      changed: true,
      write: 'none',
      revalidation: null,
    }).join('\n')
    expect(verify).toContain('diverge do valor pedido')
  })

  it('distinguishes the applied and skipped writes and the bust outcome', () => {
    const applied = formatOpsGlobalReport({
      mode: 'apply',
      target: 'host/db',
      slug: 'photoAlbum',
      field: 'selfieSearchEnabled',
      previousValue: false,
      newValue: true,
      changed: true,
      write: 'applied',
      revalidation: { ok: true, tag: 'global_photoAlbum', reason: null },
    }).join('\n')
    expect(applied).toContain('global atualizado pelo Local API.')
    expect(applied).toContain('revalidação de global_photoAlbum: ok')

    const skipped = formatOpsGlobalReport({
      mode: 'apply',
      target: 'host/db',
      slug: 'photoAlbum',
      field: 'selfieSearchEnabled',
      previousValue: true,
      newValue: true,
      changed: false,
      write: 'skipped',
      revalidation: { ok: false, tag: 'global_photoAlbum', reason: 'HTTP 401' },
    }).join('\n')
    expect(skipped).toContain('escrita pulada')
    expect(skipped).toContain('falhou (HTTP 401)')
  })
})
