/**
 * Deterministic disarm guard for the /testing-audit skill (Pass 6 P6-M909,
 * miss #909). Plain-Node CLI (no pnpm) — same runtime contract as
 * `github-pr.mjs`.
 *
 * The repo safety net (`agent-pr-ready-automerge.yml`) arms GitHub's native
 * auto-merge on EVERY ready PR against `main` and REARMS on every push
 * (`synchronize`). The /testing-audit contract forbids auto-merge (the human
 * decides the merge in the morning), so the disarm used to depend on the
 * agent remembering the order — one misordered step was the whole protection.
 * This CLI makes the disarm part of the creation step, atomic from the
 * agent's point of view:
 *
 *   GITHUB_TOKEN=<PAT> node scripts/testing-audit-disarm.mjs \
 *     --head <branch> --title "<título>" --body-file <relatório> --draft-on-failure
 *   GITHUB_TOKEN=<PAT> node scripts/testing-audit-disarm.mjs --pr <N> --draft-on-failure
 *
 * - First form: creates the PR ready → disarms → verifies (the disarm loop
 *   polls, because the safety net arms asynchronously AFTER `opened`).
 * - Second form: disarms an existing PR — the rearm after each subsequent
 *   push (`synchronize`). Read-first: an already-disarmed PR gets no
 *   mutation.
 * - Exit 0 ONLY when the final GraphQL status reads
 *   `autoMergeRequest === null && isDraft === false`. The status JSON is
 *   printed for the report.
 * - Without `--draft-on-failure` a failed verification exits 1 leaving the
 *   PR as-is; with it, the PR is converted to draft (structural veto) before
 *   exiting 1. A missing `GITHUB_TOKEN` dies BEFORE any API call, so nothing
 *   gets created-and-left-armed.
 */

import { readFileSync } from 'node:fs'

import { dieWithLabel } from './lib/cli.mjs'
import { createApi } from './lib/github-api.mjs'

const die = dieWithLabel('testing-audit-disarm')

const parseArgs = (argv) => {
  const flags = {}
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      const next = argv[index + 1]
      flags[name] = typeof next === 'string' && !next.startsWith('--') ? next : true
      if (typeof next === 'string' && !next.startsWith('--')) index += 1
    }
  }
  return flags
}

const flags = parseArgs(process.argv)

if (!process.env.GITHUB_TOKEN) {
  die(
    'GITHUB_TOKEN ausente — aborte antes de qualquer chamada à API (fail-closed: nada criado, nada armado).',
  )
}

const api = createApi({})

const printStatus = (number, status) => {
  console.log(`[testing-audit-disarm] status do PR #${number}:`)
  console.log(JSON.stringify(status, null, 2))
}

const disarmAndVerify = async (number, { afterCreate = false } = {}) => {
  // Read-first: a disarmed PR gets no mutation (idempotent rearm handling).
  // After CREATE the disarm loop always runs — the safety net arms
  // asynchronously right after `opened`, so the first read can be null while
  // the arm is still in flight (the race found live in OPS97, PR #905).
  const initial = await api.getPullRequestAutoMergeStatus(number)
  if (afterCreate || initial.autoMergeRequest !== null) {
    await api.ensureAutoMergeDisabled(number)
  }
  return api.getPullRequestAutoMergeStatus(number)
}

const main = async () => {
  const draftOnFailure = Boolean(flags['draft-on-failure'])
  const base = flags.base ?? 'main'
  let number
  let afterCreate = false

  if (flags.pr) {
    number = Number(flags.pr)
    if (!Number.isInteger(number) || number <= 0) {
      die(`--pr inválido: "${flags.pr}" — use o número do PR`)
    }
  } else {
    const { head, title } = flags
    if (!head || !title || !flags['body-file']) {
      console.error(
        'Usage: node scripts/testing-audit-disarm.mjs --head <branch> --title <t> --body-file <relatório> [--draft-on-failure]',
      )
      console.error('   ou: node scripts/testing-audit-disarm.mjs --pr <N> [--draft-on-failure]')
      process.exit(1)
    }
    let body
    try {
      body = readFileSync(flags['body-file'], 'utf8')
    } catch (error) {
      die(`não consegui ler --body-file: ${error.message}`)
    }
    if (typeof body !== 'string' || body.length === 0) {
      die('body vazio — o relatório precisa de conteúdo')
    }
    const pr = await api.createPullRequest({ head, base, title, body })
    number = pr.number
    afterCreate = true
    console.log(`[testing-audit-disarm] PR #${number} criado (Ready): ${pr.htmlUrl}`)
  }

  try {
    const status = await disarmAndVerify(number, { afterCreate })
    const disarmed = status.autoMergeRequest === null && !status.isDraft
    printStatus(number, status)
    if (disarmed) {
      console.log(`[testing-audit-disarm] PR #${number} desarmado e Ready — verificado.`)
      return
    }
    const reason = status.autoMergeRequest !== null ? 'auto-merge segue armado' : 'PR virou draft'
    throw new Error(`${reason} no PR #${number}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!draftOnFailure) {
      die(`verificação falhou: ${message} — sem --draft-on-failure, nada foi alterado.`)
    }
    try {
      const status = await api.getPullRequestAutoMergeStatus(number)
      await api.convertPullRequestToDraft(status.nodeId)
      const after = await api.getPullRequestAutoMergeStatus(number)
      printStatus(number, after)
      die(
        `verificação falhou: ${message} — PR #${number} convertida para draft (fail-closed; humano vira ready pela manhã).`,
      )
    } catch (draftError) {
      const draftMessage = draftError instanceof Error ? draftError.message : String(draftError)
      die(
        `verificação falhou (${message}) E a conversão para draft falhou: ${draftMessage} — intervenção humana obrigatória.`,
      )
    }
  }
}

try {
  await main()
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
}
