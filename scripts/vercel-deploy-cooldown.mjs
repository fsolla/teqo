#!/usr/bin/env node
/**
 * vercel-deploy-cooldown — CI helper for OPS11. Queries the last READY
 * production deployment on Vercel and writes GitHub Actions outputs:
 *   active=true|false
 *   wait_seconds=<residual>
 *   last_production_deploy_at=<ms epoch or empty>
 */
import { appendFileSync } from 'node:fs'

import { dieWithLabel } from './lib/cli.mjs'
import { DEPLOY_COOLDOWN_MS, evaluateDeployCooldown } from './lib/vercel-deploy-cooldown.mjs'

const die = dieWithLabel('vercel-deploy-cooldown')

const writeGithubOutput = (pairs) => {
  const outputPath = process.env.GITHUB_OUTPUT
  const lines = Object.entries(pairs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
    .concat('\n')

  if (outputPath) {
    appendFileSync(outputPath, lines)
    return
  }

  process.stdout.write(lines)
}

const main = async () => {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_ORG_ID

  if (!token) die('VERCEL_TOKEN is required')
  if (!projectId) die('VERCEL_PROJECT_ID is required')
  if (!teamId) die('VERCEL_ORG_ID is required')

  const result = await evaluateDeployCooldown({ token, projectId, teamId })

  if (result.lastProductionDeployAt == null) {
    console.log(
      `[vercel-deploy-cooldown] no READY production deployment found — proceed (${DEPLOY_COOLDOWN_MS / 60_000} min cooldown N/A)`,
    )
  } else if (result.active) {
    const ageMinutes = Math.floor((result.ageMs ?? 0) / 60_000)
    console.log(
      `[vercel-deploy-cooldown] defer deploy — last production deploy ${ageMinutes} min ago; wait ${result.waitSeconds}s`,
    )
  } else {
    const ageMinutes = Math.floor((result.ageMs ?? 0) / 60_000)
    console.log(
      `[vercel-deploy-cooldown] cooldown clear — last production deploy ${ageMinutes} min ago`,
    )
  }

  writeGithubOutput({
    active: result.active ? 'true' : 'false',
    wait_seconds: String(result.waitSeconds),
    last_production_deploy_at:
      result.lastProductionDeployAt == null ? '' : String(result.lastProductionDeployAt),
  })
}

main().catch((error) => {
  die(error instanceof Error ? error.message : String(error))
})
