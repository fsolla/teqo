# Migrar o CI e o paradigma de agentes do GitHub para o Forgejo

Status: registrado
Atualizado em: 2026-08-16
Issue: #1
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: A — N/A
Rascunho UI: N/A — sem UI
Appetite: ~2–3 dias eng; um outcome verificável
Responsável: —

## Intenção

O repo já vive no Forgejo (`git.solla.dev`) e o runner da workstation já executa os
workflows — mas por fallback: os YAMLs continuam em `.github/workflows/`, os scripts
`agent-*` falam `gh`→github.com, 59 arquivos de skills/rules descrevem fluxos GitHub,
os docs canônicos pinam GitHub Issues, e o repo GitHub existe defasado. Metade do
paradigma funciona por sorte (Forgejo lê `.github/workflows`), metade está quebrada
(`gh` ausente, tracker canônico apontando para um repo que não recebe push).
Queremos **zero dependência do GitHub**: CI, Issues, PRs, pool e docs rodando
nativamente no Forgejo.

## Persona e fluxo

- **Persona / contexto:** o dev (humano) e os agentes (pool, `work-issue`, claims) — mesa/casa, fluxo diário de entregas.
- **Job principal:** operar o repo de ponta a ponta no Forgejo, como hoje se fazia no GitHub.
- **Fluxo desejado:** push → CI verde no Forgejo Actions; register/claim/ready/status das Issues no Forgejo; PRs no Forgejo com auto-merge; pool supervisor rodando no Forgejo; docs e skills descrevendo o Forgejo.
- **Anti-goals de produto:** manter um meio-termo (tracker em um lugar, CI em outro) que exija dois contextos mentais; republicar o remote GitHub (isso re-dispara os builds Git da Vercel).

## Objetivo e aceite

- Workflows movidos para `.forgejo/workflows/` e verdes no Forgejo Actions (sem fallback do caminho `.github/`).
- Scripts `agent-*` operando contra o Forgejo (Issues/PRs/labels/Actions) — register/claim/ready/status/pool funcionais.
- Skills, rules e docs canônicos (`AGENTS.md`, `docs/AGENT-OPS.md`, `docs/roadmap.md`) descrevendo o Forgejo como fonte única.
- Secrets de CI existentes no Forgejo Actions; branch protection configurado no Forgejo.
- As Issues deste lote (OPS50/51/52) são as primeiras registradas no tracker Forgejo.
- Guardrails de produto: o deploy de produção (Vercel, até o cutover de hospedagem) continua gated pelo CI; o runner não é re-registrado sem necessidade (já operacional); nenhum push volta a acionar builds Git da Vercel.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** nenhuma de produto — é trabalho de infra/processo.
- **Forma:** N/A

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/*.yml` (8 arquivos, hoje lidos por fallback) → `.forgejo/workflows/`; `scripts/lib/agent-github.mjs` (coração `gh`) + `scripts/agent-*.mjs` + `scripts/lib/agent-pool-*.mjs`; `.agents/skills/**` e `.agents/rules/**` (referências a `gh pr`, github.com, "GitHub Issues" — 59 arquivos); `AGENTS.md`, `docs/AGENT-OPS.md`, `docs/roadmap.md`.
- **Precedente a olhar:** runner Forgejo já executando (workstation-runner v0.2.11, labels `host`/`ubuntu-latest`/`ubuntu-20.04`); MCP Forgejo autenticado no opencode; `docs/plans/agent-pool-orchestrator.md` (pool).
- **Risco de acoplamento:** o pool (Cursor Cloud) depende do tracker — a migração não pode deixar a fila invisível no meio do caminho; os workflows de merge (`agent-pr-ready-automerge`, `issue-done-on-main-merge`, `plan-issue-ready-on-main-merge`) chamam `gh` e precisam de equivalente Forgejo na mesma entrega.

## Dependências

- Nenhuma (fundação das outras duas deste lote; OPS51/OPS52 a declaram como `depends` suave)

## Fora de escopo

- Cutover de hospedagem (Vercel → homeserver, DNS pt.jorgesolla.com.br) — é infra §7.5–7.6, manual, outro lote.
- Migrar o **histórico** de Issues do GitHub para o Forgejo — o passado fica como arquivo; só o tracker daqui para frente é Forgejo.
- Substituir Vercel/Neon/Blob — OPS51/OPS52.

## Rabbit holes de produto

- **Migrar tudo (histórico, releases, wiki).** Se alguém "só completar": semanas de porte de dados sem valor. **Corte neste item:** tracker novo no Forgejo; GitHub congela como arquivo.
- **Suportar os dois trackers por um período.** Meio-termo que duplica bookkeeping e quebra a fila do pool. **Corte neste item:** uma fonte só (Forgejo), com o pool portado na mesma entrega.

## Questões em aberto (produto)

- **Como o agente conversa com o Forgejo?** **Opções:** A) `gh` apontado para `git.solla.dev` via `GH_HOST` | B) API nativa via scripts Node (padrão das libs existentes). **Recomendação:** B — consistente com o pool que já usa PATs, e `gh` não existe nas máquinas de trabalho.
- **O repo GitHub fica como espelho read-only ou morre?** **Opções:** A) arquivar | B) manter espelho. **Recomendação:** A — espelho convida push acidental e re-dispara Vercel. _(assumido — validar)_

## Referências

- Runner verificado 2026-08-16: `workstation-runner` online em git.solla.dev, agent-pool.yml verde a cada 10 min
- infra-solla: `STATE.md`, `plano-implementacao.md` §7.4 (pipeline Forgejo→Runner→registry→homeserver)
- `docs/AGENT-OPS.md` (paradigma de claim/PR/merge), `scripts/lib/agent-github.mjs`
