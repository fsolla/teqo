#!/usr/bin/env node
/**
 * vercel-ensure-production-alias — after `vercel deploy --prod`, make sure the
 * custom production hostname (pt.jorgesolla.com.br) points at the deployment.
 *
 * Usage:
 *   node scripts/vercel-ensure-production-alias.mjs <deployment-url-or-id>
 *   node scripts/vercel-ensure-production-alias.mjs --latest
 *
 * Env: VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_ORG_ID
 */
import { dieWithLabel } from './lib/cli.mjs'
import {
  ensureProductionCustomDomain,
  fetchLatestProductionReadyDeployment,
  PRODUCTION_CUSTOM_DOMAIN,
} from './lib/vercel-production-alias.mjs'

const die = dieWithLabel('vercel-ensure-production-alias')

const main = async () => {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_ORG_ID
  if (!token) die('VERCEL_TOKEN is required')
  if (!projectId) die('VERCEL_PROJECT_ID is required')
  if (!teamId) die('VERCEL_ORG_ID is required')

  const arg = process.argv[2]
  if (!arg) {
    die('pass a deployment URL/id, or --latest')
  }

  let deploymentRef = arg
  if (arg === '--latest') {
    const latest = await fetchLatestProductionReadyDeployment({ token, projectId, teamId })
    if (!latest) die('no READY production deployment found')
    deploymentRef = latest.url ? `https://${latest.url}` : latest.id
    console.log(`[vercel-ensure-production-alias] latest READY production: ${deploymentRef}`)
  }

  const result = await ensureProductionCustomDomain({
    token,
    projectId,
    teamId,
    deploymentRef,
    expectedHost: PRODUCTION_CUSTOM_DOMAIN,
    onStep: (message) => console.log(`[vercel-ensure-production-alias] ${message}`),
  })

  console.log(
    `[vercel-ensure-production-alias] ok — ${PRODUCTION_CUSTOM_DOMAIN} → ${result.deployment.id}` +
      (result.aliased ? ' (aliased)' : result.alreadyAssigned ? ' (already assigned)' : ''),
  )
}

main().catch((error) => {
  die(error instanceof Error ? error.message : String(error))
})
