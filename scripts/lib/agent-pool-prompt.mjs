/**
 * Worker prompt for pool-spawned Cursor Cloud Agents
 * (docs/plans/agent-pool-orchestrator.md §4/§5).
 *
 * The supervisor claims the issue BEFORE spawning (label flip + pool-worker
 * marker comment — the coordinated-claim anti-race), so the worker SKIPS
 * claim and runs `agent-work-issue` (autonomous: impl plan → execute →
 * simplify → capture-review-debts → PR). Human-supervised path is `work-issue`.
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
    'Siga a skill `.agents/skills/agent-work-issue/SKILL.md` por completo (Issue já claimada):',
    '1. Rode `pnpm i` se `node_modules` não existir.',
    planPath
      ? `2. Plano de intenção: \`${planPath}\` — abra-o; depois Plan mode e escreva \`docs/plans/<slug>-impl.md\` (engenharia deliberada; pode divergir da hipótese de direção se o aceite de produto se mantiver).`
      : '2. O body da Issue é a spec de intenção (não há plano linkado). Em Plan mode, escreva mesmo assim um `docs/plans/<id>-impl.md` a partir do body.',
    '3. Execute o impl plan. Gates: `pnpm gate:fast` na iteração; entrega com `pnpm push` (não `git push` nu). Comandos bare, nunca piped.',
    '4. Rode `/simplify` completo; `capture-review-debts` em modo autônomo (só expensive_lock ≥4).',
    `5. PR obrigatoriamente com \`gh pr create --base main\` e "Closes #${issueNumber}" no body (Ready, nunca draft). Escreva a entrada do changelog (\`docs/changelog/<data>-<id>.md\` + \`pnpm changelog:build\`) antes do push (OPS44).`,
    '6. `gh pr merge --auto --rebase <PR>` e acompanhe `gh pr checks <PR> --watch --required` até o merge. Falha de CI no seu PR é sua (docs/AGENT-OPS.md — "Dono do PR, dono do CI"): corrija na mesma branch.',
    '',
    '## Proibido',
    '',
    '- `DATABASE_URL` de prod ou `ALLOW_REMOTE_DB` — o setup local (`.cursor/cloud-setup.sh` + seed mínimo) cobre tudo.',
    `- Editar outras Issues \`in-progress\` ou trabalhar fora da Issue #${issueNumber}.`,
    '- Tratar o plano de intenção como contrato de engenharia — ele é intenção; o `*-impl.md` é a engenharia.',
    '',
    modelSlug
      ? `Modelo declarado da Issue: \`${modelSlug}\` — você foi spawnado nele (ou no fallback documentado pelo pool); o spawn do pool já fixa o modelo.`
      : 'A Issue não declara `model:` — você foi spawnado no default do pool (composer-2.5).',
    '',
    `Ao terminar — merge concluído ou falha terminal — comente na Issue #${issueNumber} o desfecho em uma linha e encerre.`,
  ].join('\n')
