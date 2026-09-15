# OPS109 — Painel de issues e planos no terminal (via SSH)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1020
Priority: P2
Impeccable: C — fluxo novo (ferramenta de terminal; sem UI de produto)
Rascunho UI: docs/plans/ops109-painel-issues-no-terminal-ui-draft.html
Appetite: ~1–2 dias eng
Responsável: —

## Intenção

> _"Ferramenta local (TUI preferida) para visualizar o andamento de cada issue — em andamento / concluídas / aguardando —, abrir os planos de intenção e de implementação e ver se estão aprovados ou aguardando aprovação. Tem que funcionar via SSH de outro dispositivo (laptop/celular); exibir os planos (markdown) estilizados para leitura fácil."_

Hoje o andamento se lê em pedaços: `pnpm issue all` dá contadores e lista, `pnpm agent:status` dá fila e grafo, mas **nenhum** dos dois lê os planos — para saber se o plano de intenção ou o impl está aprovado é preciso abrir o arquivo no editor ou o GitHub no browser. Fora da mesa (laptop/celular via SSH), isso vira atrito: o mantenedor quer responder "o que anda, o que espera aprovação, o que travou, o que vem depois" em segundos, e ler o plano sem trocar de contexto. Prioridade **P2**: ferramenta de operação, sem incidente ou bloqueio de produto.

No gate, o humano somou duas ações à ferramenta: abrir os rascunhos UI do item no browser padrão da máquina e abrir a sessão do agente que está rodando aquela issue.

## Persona e fluxo

- **Persona / contexto:** o próprio mantenedor (fsolla), navegando de laptop/celular via SSH ou na mesa; pressa de conferir o estado antes de decidir o próximo passo.
- **Job principal:** saber em segundos o que está em andamento, o que espera aprovação, o que travou e o que a próxima Issue fará — e ler o plano sem sair do terminal.
- **Fluxo desejado:** abre o painel no terminal do dispositivo → lista de issues com estado/prioridade/kind e a ação pendente → filtra por estado (em andamento / concluídas / aguardando) → seleciona uma issue → vê o resumo e, para cada plano (intenção e impl), o link e o status (aprovado / aguardando aprovação) → abre o markdown renderizado (títulos, listas, tabelas, código, negrito) → se a issue tiver rascunho UI, abre o `.html` no browser padrão da máquina → se houver run de agente ativo para a issue, abre a sessão dele (attach) → rola e volta → sai.
- **Anti-goals de produto:** read-only sobre tracker e planos (não claima, não relabela, não edita Issue/plano; abrir no browser e anexar à sessão são navegação local, não escrita); não é web/server/browser de produto; não cria segunda fonte de verdade nem duplica `agent:status`; não inicia run novo (o abrir-sessão só anexa a um run existente); sem dashboard de vaidade — cada painel responde a uma decisão do operador.

### Esboço de fluxo (B/C/D)

```text
[SSH] → [lista: issues × estado/prio/kind/ação] → [filtro por estado]
      → [issue: resumo + planos (intenção/impl) + status] → [markdown renderizado]
      → [rascunho UI: abre no browser da máquina] → [sessão do agente: attach]
      → [rolar / voltar] → [sair]
cenários: issue sem plano · impl não criado · sem rascunho UI · sem sessão ativa ·
          sem browser/display · terminal estreito · sem token/sem rede (erro claro)
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/ops109-painel-issues-no-terminal-ui-draft.html` — mock do terminal com cenas estáticas (lista, detalhe com planos + ações de rascunho UI e sessão, leitor de markdown, vazio/sem token, terminal estreito).

## Objetivo e aceite

- O painel lista as issues rastreáveis com estado, prioridade e kind, mais a ação que esperam do operador (ex.: "aguardando aprovação", "em andamento", "travada").
- Filtrar por estado responde "em andamento / concluídas / aguardando" sem sair do painel.
- Issue selecionada mostra o plano de intenção e o de implementação, cada um com link e status legível de relance ("aprovado" vs "aguardando aprovação"); "sem plano" e "impl ainda não criado" se explicam sozinhos, com o link do GitHub como saída.
- Markdown do plano abre renderizado para leitura (títulos, listas, tabelas, código, negrito), com rolagem e volta.
- Issue com rascunho UI (`docs/plans/<slug>-ui-draft.html`) abre o arquivo no browser padrão da máquina; sem browser/display (SSH puro), imprime o caminho para abrir manualmente — nunca falha em silêncio. Sem rascunho, a ação se explica (é classe A / não tem UI).
- Issue com run de agente ativo mostra isso na lista e no detalhe e abre a sessão existente (attach); sem run, o estado diz "nenhuma sessão ativa" — o painel não inicia run. Depende do OPS110.
- Terminal estreito (celular) continua utilizável; token ausente ou rede fora vira mensagem clara — nunca stack trace/crash.
- Guardrail: read-only sobre tracker e planos de ponta a ponta; a fonte é a mesma camada de leitura de Issues usada por `pnpm issue`/`pnpm agent:status`.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o painel é a apresentação.
- **Decisões desbloqueadas:**
  - Mantenedor escolhe a próxima Issue a trabalhar vendo estado + prioridade + o que vem na fila.
  - Mantenedor vê o que está travado e decide o que destravar.
  - Mantenedor vê se um plano (intenção ou impl) espera aprovação e decide aprovar ou não.
  - Mantenedor revisa o rascunho UI da issue e decide se interfere no run em andamento — sem sair do painel.
- **Forma:** _adiada ao plano de implementação_ — restrições de produto: leitura de relance na lista, detalhe só sob seleção; sem métricas agregadas de vaidade.

## Dados da decisão (literais)

- Labels de estado da Issue: `ready`, `in-progress`, `blocked`, `done`, `in-prod`.
- Outros labels lidos: `prio:P0`, `prio:P1`, `prio:P2`, `prio:P3`, `kind:*`, `needs:*`.
- Status de plano (linha `Status:` dos `docs/plans/*.md` e `*-impl.md`): `rascunho`, `registrado`, `aprovado` (às vezes com sufixo `(gate humano <data>)`), `em execução`, `executado`, `entregue`, `blocked`.
- Link do plano no body da Issue: ``Plano: [`docs/plans/<slug>.md`](docs/plans/<slug>.md)``.
- Back-links: o plano de intenção tem `Issue: #N`; o `-impl.md` tem `Intenção: docs/plans/<slug>.md`.
- Rascunho UI é arquivo irmão do plano: `docs/plans/<slug>-ui-draft.html`.
- Sessão do agente da Issue: quem define como descobrir/endereçar é o OPS110 (dependência dura) — aqui só se consome; "nenhuma sessão ativa" é estado de primeira classe.
- Leitura de produto (assumida): `aprovado*` = aprovado; `rascunho`/`registrado`/`blocked` = aguardando; `em execução`/`executado`/`entregue` = já andou — valor cru do `Status:` sempre visível.

## Direção no codebase (hipótese)

- **Áreas prováveis:** scripts top-level (`scripts/*.mjs`) com exposição em `package.json` no padrão de `issue`/`agent:status`; leitura de Issues em `scripts/lib/github-api.mjs` (`listIssues`, exige `GITHUB_TOKEN`), parse de frontmatter/labels/grafo em `scripts/lib/agent-forgejo.mjs` (`parseFrontmatter`, `labelNames`, `issuesById`) e extração do path do plano em `scripts/lib/agent-pool-prompt.mjs` (`extractPlanPath`). Nenhuma lib TUI instalada hoje (Node 24 ESM).
- **Precedente a olhar:** `scripts/issue.mjs` (flags, `dieAgent`, saída compacta), `scripts/agent-status.mjs` (contadores/fila) e `docs/AGENT-OPS.md` (tabela de comandos e labels).
- **Risco de acoplamento:** reusar a camada de leitura existente (sem cache paralelo), read-only sobre tracker/planos, render de markdown de terminal (`react-markdown`/`remark-gfm` são de browser e não servem), sem servidor web — precisa funcionar num terminal SSH comum. Abrir o rascunho UI depende do browser da máquina (hipótese: `xdg-open`/`open`; sem display, imprimir o caminho); abrir a sessão depende do mecanismo do OPS110 (dependência dura, sem twinar).

## Dependências

- **OPS110 (dura)** — abrir a sessão do agente só existe depois que o run persistente/endereçável do OPS110 existir; até lá o painel mostra "nenhuma sessão ativa".
- Nenhuma outra.

## Fora de escopo

- Escrita no tracker/planos (claim/relabel/close/comentar/editar plano) — destino: comandos existentes.
- Iniciar run novo pelo painel — o abrir-sessão só anexa a um run existente; disparar run fica para o fluxo normal (worktree/skill).
- Servidor web, browser de produto, app mobile, `tmux` obrigatório — o terminal SSH puro é o contrato; o browser local só é chamado para exibir o rascunho `.html`.
- Notificações, watch/daemon em background, histórico/analytics — destino: outro item, se pedido.
- Gráficos de time/burndown — vaidade sem decisão nomeável.
- Substituir `pnpm issue`/`pnpm agent:status` — eles continuam.

## Rabbit holes de produto

- **"Já que lista issues, claima daqui."** Escrita puxa lock/labels e quebra o contrato read-only. **Corte neste item:** só visualizar.
- **"Já que renderiza markdown, edita o plano."** Editor concorrente é outro produto. **Corte neste item:** leitura e navegação.
- **"Expõe com ttyd/wetty no navegador do celular."** Traz servidor, porta e auth — o pedido é SSH. **Corte neste item:** roda no terminal do cliente.
- **"Cacheia local pra economizar token."** Vira segunda fonte que envelhece. **Corte neste item:** sempre a camada existente.

## Questões em aberto (produto)

- **Issue sem plano ou com impl não criado — como representar?** **Opções:** A) estado explícito "sem plano"/"impl não criado" + link do GitHub | B) omitir a seção. **Recomendação:** A — nunca célula vazia. _(assumido — validar no gate)_
- **"Aguardando aprovação" inclui `em execução`?** **Opções:** A) não, só `rascunho`/`registrado`/`blocked` | B) todo status não-`aprovado`. **Recomendação:** A. _(assumido)_
- **Onde o painel roda?** **Opções:** A) na máquina do repo (com `GITHUB_TOKEN`) acessada por SSH | B) homeserver. **Recomendação:** A — o token já vive lá e nada novo é hospedado. _(assumido)_
- **Sem browser/display (SSH puro) ao abrir o rascunho UI?** **Opções:** A) imprimir o caminho para abrir manualmente | B) só avisar que falhou. **Recomendação:** A — o caminho colado no terminal do cliente resolve. _(assumido)_

## Referências

- GitHub Issue #1020
- Rascunho UI (gate): `docs/plans/ops109-painel-issues-no-terminal-ui-draft.html`
- `docs/plans/ops110-attach-detach-runs-agent.md` — de onde vem a sessão endereçável (dependência dura)
- `scripts/lib/github-api.mjs`, `scripts/lib/agent-forgejo.mjs`, `scripts/lib/agent-pool-prompt.mjs` (`extractPlanPath`), `scripts/issue.mjs`, `scripts/agent-status.mjs` — pistas de leitura, não contrato
- `docs/AGENT-OPS.md` (comandos e labels) e `AGENTS.md` (convenções de scripts/CI)
