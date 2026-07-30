/**
 * Worker prompt for pool-spawned Cursor Cloud Agents
 * (docs/plans/agent-pool-orchestrator.md §4/§5).
 *
 * The supervisor claims the issue BEFORE spawning (label flip + pool-worker
 * marker comment — the coordinated-claim anti-race), so the worker SKIPS the
 * claim step of work-issue and starts at step 1b. Everything else — gates, PR
 * base stage with Closes #N, auto-merge + CI watch, never promote — is the
 * standard skill contract restated so the worker cannot miss it.
 */

/** First docs/plans/*.md path in the issue body (the linked plan), if any. */
export const extractPlanPath = (body) => body?.match(/docs\/plans\/[\w./-]+\.md/)?.[0] ?? null

/**
 * @param {Object} options
 * @param {number} options.issueNumber
 * @param {string} options.issueTitle
 * @param {string | null} [options.issueId] frontmatter id (e.g. B79)
 * @param {string | null} [options.planPath]
 * @param {string | null} [options.modelSlug] frontmatter model: as declared
 */
export const buildPoolWorkerPrompt = ({ issueNumber, issueTitle, issueId, planPath, modelSlug }) =>
  [
    'Você é um worker do pool de agentes do Teqo (repo fsolla/teqo).',
    '',
    '## Sua Issue (já claimada — NÃO rode `pnpm agent:claim`)',
    '',
    `#${issueNumber} — ${issueTitle}${issueId ? ` (${issueId})` : ''}`,
    'O pool-supervisor já fez o claim desta Issue (label `in-progress` + comentário de claim). Outros workers do pool pegam outras Issues — trabalhe somente nesta.',
    '',
    '## Fluxo',
    '',
    'Siga a skill `.cursor/skills/work-issue/SKILL.md` a partir do passo 1b, PULANDO o passo 1 (claim):',
    '1. Rode `pnpm i` se `node_modules` não existir.',
    planPath
      ? `2. Plano: \`${planPath}\` — freshness audit enxuto (passo 3 da skill).`
      : '2. O body da Issue é a spec (não há plano linkado — avalie se ele basta para trabalhar).',
    '3. Execute as fases com os gates do repo: `pnpm gate:fast` antes do push (o pre-push roda `pnpm gate:push`). Comandos bare, nunca piped.',
    `4. PR obrigatoriamente com \`gh pr create --base stage\` e "Closes #${issueNumber}" no body.`,
    '5. `gh pr merge --auto --merge <PR>` e acompanhe `gh pr checks <PR> --watch` até o merge. Falha de CI no seu PR é sua (docs/AGENT-OPS.md — "Dono do PR, dono do CI"): corrija na mesma branch.',
    '',
    '## Proibido',
    '',
    '- `pnpm agent:promote` — promote stage→main é humano.',
    '- `DATABASE_URL` de stage/prod ou `ALLOW_REMOTE_DB` — o setup local (`.cursor/cloud-setup.sh` + seed mínimo) cobre tudo.',
    `- Editar outras Issues \`in-progress\` ou trabalhar fora da Issue #${issueNumber}.`,
    '',
    modelSlug
      ? `Modelo declarado da Issue: \`${modelSlug}\` — você foi spawnado nele (ou no fallback documentado pelo pool); a verificação assimétrica do passo 2 não se aplica.`
      : 'A Issue não declara `model:` — você foi spawnado no default do pool (composer-2.5).',
    '',
    `Ao terminar — merge concluído ou falha terminal — comente na Issue #${issueNumber} o desfecho em uma linha e encerre.`,
  ].join('\n')
