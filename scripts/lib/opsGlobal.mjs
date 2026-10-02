/**
 * C247 — pure planning/reporting of `pnpm ops:global`: the closed table of
 * operational public-global flags, the argv parser and the receipt helpers.
 * No I/O of its own, so the unit spec drives it with fakes.
 *
 * The table is the write surface AND the HELP source: a flag only becomes
 * writable by editing it here (reviewable, unit-pinned). Nothing outside it is
 * ever written.
 */

export const OPS_GLOBAL_DEFAULT_OUT_DIR = 'data/ops-global'

export const OPS_GLOBAL_WRITE_CONFIRM_FLAG = 'OPS_GLOBAL_CONFIRM'

const FLAG_VALUE_ON = 'on'
const FLAG_VALUE_OFF = 'off'

const USAGE =
  'uso: `pnpm ops:global <global> --<flag> <on|off> [--apply|--verify]` — ex.: `pnpm ops:global photoAlbum --selfie-search on`'

export const OPS_GLOBAL_TARGETS = Object.freeze({
  photoAlbum: Object.freeze({
    flags: Object.freeze({
      'selfie-search': Object.freeze({
        field: 'selfieSearchEnabled',
        label: 'Busca por selfie (/fotos/encontre)',
        defaultValue: false,
      }),
      published: Object.freeze({
        field: 'published',
        label: 'Álbum público (/fotos)',
        defaultValue: true,
      }),
    }),
  }),
})

/** The HELP operation block, generated from the table — never a second source. */
export const formatOpsGlobalOperations = () =>
  Object.entries(OPS_GLOBAL_TARGETS).flatMap(([slug, target]) =>
    Object.entries(target.flags).map(
      ([flag, definition]) => `  ${slug} --${flag} <on|off>   ${definition.label}`,
    ),
  )

export const opsGlobalReportStamp = (runAt) => String(runAt).replace(/[:.]/g, '-')

/** `on`/`off` → boolean; anything else is refused. */
const parseFlagValue = (raw, operation) => {
  if (raw === FLAG_VALUE_ON) return true
  if (raw === FLAG_VALUE_OFF) return false
  throw new Error(`valor inválido para --${operation}: "${raw}" (use on|off) — ${USAGE}.`)
}

/**
 * @param {string[]} [argv]
 * @returns {{ slug: string | null, operation: string | null, value: boolean | null, mode: 'plan' | 'apply' | 'verify', help: boolean }}
 */
export const parseOpsGlobalCliArgs = (argv = process.argv.slice(2)) => {
  const options = { slug: null, operation: null, value: null, mode: 'plan', help: false }
  const positionals = []
  let requestedOperation = null
  let requestedValue = null
  let sawApply = false
  let sawVerify = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--apply') {
      sawApply = true
      continue
    }
    if (arg === '--verify') {
      sawVerify = true
      continue
    }
    if (arg.startsWith('--')) {
      if (requestedOperation !== null) {
        throw new Error(
          `mais de uma operação (--${requestedOperation} e --${arg.slice(2)}) — ${USAGE}.`,
        )
      }
      requestedOperation = arg.slice(2)
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`faltou valor para --${requestedOperation} (on|off) — ${USAGE}.`)
      }
      requestedValue = next
      continue
    }
    positionals.push(arg)
  }

  if (options.help) return options
  if (sawApply && sawVerify) {
    throw new Error(`--apply e --verify são mutuamente exclusivos — ${USAGE}.`)
  }
  if (positionals.length !== 1) {
    throw new Error(
      positionals.length === 0
        ? `informe o global (ex.: photoAlbum) — ${USAGE}.`
        : `argumento posicional desconhecido: ${positionals.slice(1).join(', ')} — ${USAGE}.`,
    )
  }
  options.slug = positionals[0]
  if (!Object.hasOwn(OPS_GLOBAL_TARGETS, options.slug)) {
    throw new Error(
      `global "${options.slug}" fora da tabela de operações (${Object.keys(OPS_GLOBAL_TARGETS).join(', ')}) — ${USAGE}.`,
    )
  }
  if (requestedOperation === null) {
    throw new Error(`informe a operação (ex.: --selfie-search on) — ${USAGE}.`)
  }
  const flag = OPS_GLOBAL_TARGETS[options.slug].flags[requestedOperation]
  if (flag === undefined) {
    throw new Error(
      `operação "--${requestedOperation}" fora da tabela de ${options.slug} (${Object.keys(OPS_GLOBAL_TARGETS[options.slug].flags).join(', ')}) — ${USAGE}.`,
    )
  }

  options.operation = requestedOperation
  options.value = parseFlagValue(requestedValue, requestedOperation)
  options.mode = sawApply ? 'apply' : sawVerify ? 'verify' : 'plan'
  return options
}

/**
 * The write plan: a single-field partial update, its honest previous value
 * (the table default when the row/slot is absent) and the rollback command.
 *
 * @param {{ slug: string, operation: string, value: boolean, currentDoc?: Record<string, unknown> | null }} options
 */
export const buildOpsGlobalWrite = ({ slug, operation, value, currentDoc = null }) => {
  const flag = OPS_GLOBAL_TARGETS[slug]?.flags?.[operation]
  if (flag === undefined) {
    throw new Error(`operação "${operation}" fora da tabela de ${slug}.`)
  }

  const rawPrevious = currentDoc?.[flag.field]
  const previousValue = rawPrevious === undefined ? flag.defaultValue : rawPrevious === true

  return {
    slug,
    operation,
    field: flag.field,
    previousValue,
    newValue: value,
    changed: previousValue !== value,
    data: { [flag.field]: value },
    rollbackCommand: formatOpsGlobalCommand(slug, operation, previousValue),
  }
}

/** The same command with the previous value — the rollback recipe. */
export const formatOpsGlobalCommand = (slug, operation, value) =>
  `pnpm ops:global ${slug} --${operation} ${value ? FLAG_VALUE_ON : FLAG_VALUE_OFF} --apply`

/**
 * The manual recovery when the bust fails after the write: no secret value is
 * ever printed — the env var is referenced by name.
 */
export const formatOpsGlobalRecoveryCommand = ({ baseUrl, tag }) =>
  `curl -X POST ${baseUrl}/api/revalidate?tag=${encodeURIComponent(tag)} -H "x-revalidate-secret: $REVALIDATE_SECRET"`

export const formatOpsGlobalReport = (report) => {
  const state = `${report.previousValue ? FLAG_VALUE_ON : FLAG_VALUE_OFF} → ${report.newValue ? FLAG_VALUE_ON : FLAG_VALUE_OFF}`
  const lines = [
    `[ops:global] modo: ${report.mode} | alvo: ${report.target}`,
    `[ops:global] ${report.slug}.${report.field}: ${state}${report.changed ? '' : ' (sem mudança)'}`,
  ]

  if (report.mode === 'plan') {
    lines.push('[ops:global] plano — nenhuma escrita; use --apply para gravar e revalidar.')
  }
  if (report.write === 'applied') {
    lines.push('[ops:global] global atualizado pelo Local API.')
  }
  if (report.write === 'skipped') {
    lines.push(
      '[ops:global] escrita pulada (valor já era o pedido) — cache revalidado mesmo assim.',
    )
  }
  if (report.revalidation) {
    lines.push(
      `[ops:global] revalidação de ${report.revalidation.tag}: ${
        report.revalidation.ok ? 'ok' : `falhou (${report.revalidation.reason})`
      }`,
    )
  }
  if (report.mode === 'verify') {
    lines.push(
      report.changed
        ? '[ops:global] estado diverge do valor pedido (exit 1).'
        : '[ops:global] estado confere com o valor pedido.',
    )
  }

  return lines
}
