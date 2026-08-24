# Consolidar MCPs do opencode: global fica só com playwright + jina; penpot/postgres viram subagentes; GitHub MCP morre (CLI gh); forgejo/jobspy/office-word/stalwart re-homed para os projetos donos

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-24
Issue: #857
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia, config-only (global + arquivos locais + 2 subagentes + docs)
Responsável: —

## Intenção

Cada MCP declarado no config global do opencode soma tokens de contexto em **toda** sessão do agente, mesmo quando a ferramenta não é usada. O global de hoje carrega sete MCPs, e quase todos são específicos de um projeto ou já estão mortos na prática: o GitHub MCP está desativado desde 17/08 (OAuth nunca autorizado — `gh` CLI já é o fallback real), e forgejo/jobspy/office-word/stalwart só têm dono em projetos irmãos. Quero chegar a um estado em que abrir o opencode no Teqo custa o mínimo de contexto: **apenas playwright + jina no global**. O resto vai para o lugar que o usa — Penpot e Postgres ficam no Teqo mas só dentro de subagentes dedicados (são ferramentas deste projeto: design do site e banco local), e os demais voltam para os repositórios que os consomem.

## Persona e fluxo

- **Persona / contexto:** dono do repo/opencode local (fsolla), abrindo sessões do opencode em vários projetos na mesma máquina.
- **Job principal:** abrir uma sessão do opencode no Teqo com o menor contexto possível, sem perder acesso a ferramentas quando precisar delas.
- **Fluxo desejado:** abre o opencode no Teqo → sessão expõe só jina, playwright e as tools padrão; precisa desenhar/cobrir o mapa do site → chama o subagente `penpot`, que enxerga o MCP; precisa checar o banco local → chama o subagente `postgres`; precisa de GitHub → usa `gh` no terminal ou scripts do repo.
- **Anti-goals de produto:** esta entrega NÃO é um gerenciador de MCPs, não automatiza o config global (continua edição manual do dono, como o OPS89), e não vira auditoria/limpeza geral de configs de outros projetos.

## Objetivo e aceite

- Abrir o opencode no Teqo expõe apenas playwright + jina (e built-ins) — nenhum MCP de GitHub, forgejo, jobspy, office-word ou stalwart ativo.
- O subagente `penpot` consegue usar as tools do Penpot numa sessão do Teqo.
- O subagente `postgres` consegue consultar o banco local `teqo` numa sessão do Teqo.
- Tarefas de GitHub funcionam via `gh` CLI (instalado e autenticado), sem perder nenhuma capacidade que o MCP morto teria.
- Cada projeto dono tem seu MCP local funcionando (decisões do gate): forgejo em `lei-mercados-digitais`, `infra-solla` e `iara-pwa` (os três têm o tracker de Issues no Forgejo e usam o MCP); jobspy em `jobs`; office-word em `lei-mercados-digitais` (só — o infra-solla perde e seu AGENTS.md sai coerente); stalwart em `infra-solla` (só — a iara-pwa já desabilita stalwart no próprio `opencode.jsonc`, decisão Issue #5 dela: "e-mail pessoal").
- Nada quebra: dev server, launch de worktrees (a cópia de secrets continua necessária — penpot permanece declarado no repo) e a documentação que cita o penpot MCP como ativo fica coerente com o novo desenho.

## Dados (intenção)

- **Vou apresentar dados?** Não — é tooling de desenvolvimento, sem dado de negócio.
- **Decisões desbloqueadas:** N/A — nenhuma decisão de produto depende deste item.
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `~/.config/opencode/opencode.jsonc` (global, não commitado — edição manual, fora do git), `opencode.json` do repo Teqo (MCPs penpot/postgres com tools gated), novos `.opencode/agent/penpot.md` e `.opencode/agent/postgres.md` (subagentes, precedente nos subagentes existentes do repo), e os configs dos projetos irmãos — `jobs/opencode.json` (adicionar jobspy), `lei-mercados-digitais/opencode.json` (adicionar forgejo + office-word), `infra-solla/opencode.jsonc` (declarar forgejo + stalwart; remover pin morto de postgres; AGENTS.md sem office-word), `iara-pwa/opencode.jsonc` (declarar forgejo; limpar pins mortos de postgres/stalwart).
- **Precedente a olhar:** OPS89 (mesmo padrão: edição manual do global, nenhum gate/CI lê `opencode.json` estruturalmente — já provado); subagentes existentes em `.opencode/agent/*.md`; `scripts/worktree.mjs` (cópia de secrets que vira no-op).
- **Risco de acoplamento:** o mecanismo oficial de gate de tools por agente (`tools` + `agent.<nome>.tools`) está marcado como deprecated no schema em favor de `permission` — o executor valida o mecanismo vigente na hora, sem inventar paralelo.

## Dependências

- Nenhuma.

## Fora de escopo

- Não mexer em auth/credenciais além do necessário para mover os blocos (nenhum token novo).
- Não tocar nos MCPs eur-lex / mcp-brasil do `lei-mercados-digitais`.
- Não automatizar o config global (continua manual).
- Não auditar nem "limpar" configs de projetos que não recebem MCP nesta entrega.

## Rabbit holes de produto

- **Subagente que vira gerenciador de MCPs.** Se alguém "só completar": nasce um sistema de descoberta/habilitação de MCPs, o oposto da simplificação. **Corte neste item:** dois subagentes fixos (penpot, postgres), nada dinâmico.
- **Mexer no que não é do item.** Se alguém "só completar": edita credenciais em claro ou reestrutura configs de projetos irmãos além dos blocos nomeados. **Corte neste item:** mover os blocos e só; validar a config lendo, não reformatando.
- **Re-home forçado.** Se alguém "só completar": coloca forgejo/stalwart em projetos cujo dono não confirmou uso, criando config morta — o mesmo desperdício que estamos eliminando. **Corte neste item:** só os destinos confirmados no gate.

## Questões em aberto (produto)

Todas resolvidas no gate de 2026-08-24:

- **Um item único ou split?** **Decisão:** único OPS92.
- **Forgejo: destinos?** **Decisão:** `lei-mercados-digitais` (único que vive só no Forgejo) + `infra-solla` e `iara-pwa` (ambos usam o MCP ativamente — tracker de Issues no Forgejo, confirmado nos AGENTS.md de cada um).
- **Stalwart no `iara-pwa`?** **Decisão:** não — a iara-pwa já desabilita stalwart no próprio `opencode.jsonc` (Issue #5 dela, "e-mail pessoal; fora do fluxo de dev da Iara"); re-homar lá contradiria a decisão versionada do projeto. Stalwart vai só para `infra-solla` (dono do server). Reaproveita o mesmo server — nada duplicado.
- **Subagentes penpot/postgres: repo Teqo ou global?** **Decisão:** repo Teqo (`opencode.json` + `.opencode/agent/*.md`).
- **office-word também no infra-solla?** **Decisão:** não — só `lei-mercados-digitais`; o AGENTS.md do infra-solla é atualizado para remover office-word da lista de "em uso".
- **Corrigir as menções "(MCP/`pnpm issue`)" nas skills?** **Decisão:** sim.

## Referências

- `~/.config/opencode/opencode.jsonc` — global atual (GitHub desativado, jina, playwright, postgres, forgejo, stalwart, office-word, jobspy).
- `opencode.json` (repo Teqo) — `$schema` + `mcp.penpot` com token em `.opencode/secrets/` (gitignored).
- `scripts/worktree.mjs` (linhas ~239–258, 345) — cópia de `.opencode/secrets/*`; vira no-op sem penpot no config.
- `AGENTS-infra.md` e `docs/campanha/prompt-montagem-home.md` — citam o penpot MCP como ativo; atualizar se o desenho mudar.
- `scripts/check-changelog-append-only.mjs` e `scripts/check-plans-only-pr-closes.mjs` — precedentes de `gh` CLI como fallback.
- Projetos irmãos: `lei-mercados-digitais/opencode.json` (eur-lex + mcp-brasil), `infra-solla/opencode.jsonc` (usa forgejo/stalwart/office-word herdados; pins postgres), `iara-pwa/opencode.jsonc` (usa forgejo; desabilita postgres/stalwart — Issue #5 dela), `jobs/opencode.json` (só provider).
- `AGENTS.md` — Teqo não usa Forgejo (zero refs nos workflows).
