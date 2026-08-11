/**
 * `pnpm dev` launcher (OPS40). `next dev` resolves its port from the `-p` flag
 * or the REAL process env BEFORE `@next/env` loads `.env.local`, so a worktree
 * provisioner's `PORT=3100+slot` was silently ignored and every worktree bound
 * 3000. The wrapper loads the env files itself (same precedence as the guard),
 * hands the port to Next as a CLI flag, and spawns the dev server in-process.
 *
 * Precedence (exactly what `loadCliEnv` merges, override:false):
 *   1. real `process.env.PORT` (Playwright's webServer injects it — e2e wins)
 *   2. `.env.local` (the worktree provisioner)
 *   3. `.env`
 *   4. none → no `-p` → Next default 3000 + its free-port retry (main repo)
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

import './guard-dev-db.mjs'
import { dieWithLabel, loadCliEnv, nextDevArgs, resolveDevPort } from './lib/cli.mjs'

const require = createRequire(import.meta.url)
const die = dieWithLabel('dev')

loadCliEnv()

let port
try {
  port = resolveDevPort(process.env)
} catch (error) {
  die(error.message)
}

const extraArgs = process.argv.slice(2)
const nextArgs = [...nextDevArgs(port), ...extraArgs]
const nextBin = require.resolve('next/dist/bin/next')

if (port === null) {
  console.log(`[dev] next dev ${nextArgs.join(' ')}  (sem PORT — porta padrão 3000)`)
} else {
  console.log(`[dev] dev server na porta ${port} (PORT do env) — next dev -p ${port}`)
}

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  stdio: 'inherit',
  // Paridade com o cross-env NODE_OPTIONS=--no-deprecation anterior.
  env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
})

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => die(`falha ao subir o next dev: ${error.message}`))

child.on('exit', (code, signal) => {
  if (signal) {
    // O listener acima re-forwardaria o sinal para um filho já morto e o
    // kill(process.pid) re-dispararia este próprio handler — remove antes de
    // re-sinalizar para deixar a disposição padrão encerrar o processo.
    process.removeAllListeners(signal)
    process.kill(process.pid, signal)
  } else {
    process.exit(code ?? 1)
  }
})
