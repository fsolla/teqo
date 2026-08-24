# Impl: Consolidar MCPs do opencode: global fica só com playwright + jina; penpot/postgres viram subagentes; GitHub MCP morre (CLI gh); forgejo/jobspy/office-word/stalwart re-homed para os projetos donos

Status: aprovado
Atualizado em: 2026-08-24
Issue: #857
Intenção: docs/plans/ops92-consolidar-mcps.md
Appetite restante: ~0,5–1 dia herdado (config-only + 2 subagentes + prosa; sem migration, sem testes novos; tracer bullet)

## Leitura da intenção

- **Outcome:** abrir o opencode no Teqo expõe só `jina` + `playwright` (e built-ins) no global; `penpot` e `postgres` vivem só em subagentes do repo Teqo; GitHub via `gh` CLI; cada projeto irmão expõe localmente só o MCP que usa — sessões baratas sem perder ferramenta quando chamada.
- **O que NÃO negociar:** anti-goals da intenção — NÃO criar gerenciador de MCPs; NÃO automatizar config global (continua manual do dono, como OPS89); NÃO criar config morta em projeto que não pediu; NÃO tocar `eur-lex`/`mcp-brasil` no `lei-mercados-digitais`; NÃO mexer em credenciais/tokens além de mover blocos; NÃO auditar/limpar configs fora dos destinos confirmados; freeze de migrations/LGPD/URLs não afetado.
- **O que reavaliar:** hipóteses de "Direção no codebase" — confirmadas com leitura ao vivo:
  - Global real `~/.config/opencode/opencode.jsonc` tem 7 MCPs (`github:false` + `jina` + `playwright` + `postgres` + `forgejo` + `stalwart` + `office-word` + `jobspy`) — remover 5 blocos inteiros, manter 2.
  - Repo Teqo `opencode.json` (10 linhas) hoje só `$schema` + `mcp.penpot` (`:4-8`, token em `.opencode/secrets/penpot-token` via `{file:…}`) — vai ganhar `postgres` irmão.
  - Subagentes existentes `.opencode/agent/*.md` (4 arquivos) — `design-vision*.md` com `mode: subagent` + `model: deepinfra/Qwen…`, `designer-campanha-solla.md` com `mode: all` — dão o precedente de frontmatter (`description`/`mode`/`model`/`temperature`).
  - Irmãos verificados: `jobs/opencode.json` só `provider` (herda tudo do global); `lei-mercados-digitais/opencode.json` só `eur-lex`+`mcp-brasil`; `infra-solla/opencode.jsonc` desliga `postgres:false` e herda `forgejo`/`stalwart`/`office-word` dos globais; `iara-pwa/opencode.jsonc` desliga `postgres:false` + `stalwart:false` (Issue #5 dela) e herda `forgejo`.
  - `scripts/worktree.mjs:239-258` (`copyOpendevSecrets`) copia `.opencode/secrets/*` — vira no-op se o repo não declarar `penpot` (mas penpot permanece declarado, então continua vivo).
  - Menções `(MCP|pnpm issue)` em skills: `.agents/skills/project-status/SKILL.md:25`, `.agents/skills/work-issue/SKILL.md:82` + `engineering-audit/SKILL.md:69` — trocar para `gh`/sem MCP.

## Abordagem recomendada

```mermaid
flowchart LR
  G["~/.config/opencode/opencode.jsonc\n(global, manual, fora do git)\nANTES 7 MCPs -> DEPOIS só jina + playwright\nREMOVE github/postgres/forgejo/stalwart/office-word/jobspy"] --> T["Sessão opencode no Teqo\nbuilt-ins + 2 MCPs globais"]
  R["opencode.json (repo Teqo)\nANTES só penpot (1)\nDEPOIS penpot + postgres\n + permission gate"] --> T
  R --> S1[".opencode/agent/penpot.md\nsubagent, permission: penpot/* allow"]
  R --> S2[".opencode/agent/postgres.md\nsubagent, permission: postgres/* allow"]
  S1 --> T
  S2 --> T
  T -->|usa quando precisa| GH["GitHub via gh CLI\n(gh 2.98 auth ok)"]
  G2["Re-homed (repos donos)\njobs/opencode.json -> jobspy\nlei/opencode.json -> forgejo+office-word\ninfra/opencode.jsonc -> forgejo+stalwart\niara/opencode.jsonc -> forgejo"] --> O["Sessões nesses repos\nexpõem só o dono"]
```

**Decisões caras (deliberadas com rejeitadas):**

### D1 — Onde declarar `penpot` + `postgres` (caro: muda quem paga contexto em toda sessão)

```
Opções: A | B | C
Recomendação: A — ambos em opencode.json do repo Teqo (commitado) + 2 subagentes no repo
Alternativas rejeitadas: B porque global voltaria a pagar contexto em TODO projeto (anula o outcome: abrir no Teqo custa mínimo mas abrir em jobs/lei também pagaria penpot/postgres); C porque remover postgres totalmente perde a ferramenta local deste projeto (banco teqo é ferramenta diária, não "outro projeto" — a intenção fixa "ficam no Teqo mas só dentro de subagentes")
```

- A mantém o princípio "edit the owner, don't twin" (OPS82/OPS89): repo é o dono de penpot (design do site) e do postgres local; global paga 0.
- B (global) foi cogitado no gate aberto — rejeitado exatamente pelo corte "repo Teqo (`opencode.json` + `.opencode/agent/*.md`)" registrado na intenção.
- C (matar postgres) barateia ainda mais mas remove capacidade que o plano de intenção marca como aceito explícito (`postgres` consulta o banco local).

### D2 — Gate de tools por agente: `permission` vs `tools` (caro: se errar o mecanismo, o gate é silenciosamente ignorado)

```
Opções: A | B | C
Recomendação: A — permission por agente (mecanismo vigente)
Alternativas rejeitadas: B porque AgentConfig.tools está deprecated no schema e opencode debug config já mostra agent.<nome>.permission vazio — tools seria ignorado sem erro visível, sessão primária continuaria vendo penpot/postgres e o outcome "só nos subagentes" falharia silenciosamente; C porque sem gate nenhum, penpot/postgres voltam a custar em toda sessão (anula D1)
```

- Validar na hora com `opencode debug config | grep -A2 permission` e `opencode debug agent penpot` / `postgres` — o executor valida o mecanismo vigente, sem inventar paralelo.
- Precedente: intenção já sinaliza "mecanismo oficial de gate … marcado como deprecated em favor de `permission` — o executor valida o mecanismo vigente na hora".

### D3 — Global manual vs automação (caro: automação reverte decisão de propriedade)

```
Opções: A | B
Recomendação: A — edição manual pelo dono, fora do git (mesmo padrão OPS89, sem CI lendo opencode.json)
Alternativas rejeitadas: B porque automatizar o global cria gerenciador de MCPs (rabbit hole nomeado da intenção) e acopla CI a arquivo fora do repo que nenhum gate valida estruturalmente — já provado que nenhum gate/CI lê opencode.json (OPS89: zero readFileSync/JSON.parse em tests/, zero match em .github/)
```

- Arquivo `~/.config/opencode/opencode.jsonc` é JSONC com comentários `//` pt-BR (estilo `cheapestinception`/`deepinfra`) — blocos removidos manualmente, validado com `opencode debug config` após.

### D4 — Destinos do re-home (caro: colocar no projeto errado cria config morta = mesmo desperdício)

```
Opções: A | B | C
Recomendação: A — só os destinos confirmados no gate 2026-08-24 (intenção "Questões em aberto"): forgejo -> lei-mercados-digitais + infra-solla + iara-pwa; jobspy -> jobs; office-word -> lei-mercados-digitais; stalwart -> só infra-solla
Alternativas rejeitadas: B porque adicionar stalwart em iara-pwa contradiz decisão versionada da própria iara-pwa (opencode.jsonc Issue #5 "e-mail pessoal; fora do fluxo de dev") — já desabilita stalwart; C porque adicionar office-word em infra-solla cria twin sem dono (intenção decide "não — só lei-mercados-digitais; AGENTS.md do infra-solla sai coerente sem office-word")
```

- Prova: `iara-pwa/opencode.jsonc: stalwart { enabled:false }` com comentário Issue #5; `infra-solla/AGENTS.md:65` lista hoje `office-word` em uso — vai sair da lista.
- `jobs/opencode.json` hoje sem `mcp` — herda tudo do global; após re-home, declara explicitamente só `jobspy`.

### D5 — Morte do GitHub MCP e validação (caro: se gh não cobre, perde capacidade)

```
Opções: A | B
Recomendação: A — remover bloco github do global e usar gh CLI (já autenticado, já fallback real nos scripts do repo)
Alternativas rejeitadas: B porque reativar GitHub MCP exige OAuth nunca autorizado desde 17/08 (bloco já com enabled:false) e duplicaria canal com gh — scripts/check-changelog-append-only.mjs e check-plans-only-pr-closes.mjs já provam gh como fallback
```

- Verificação ao vivo: `gh auth status` → `fsolla` logged in (GITHUB_TOKEN + keyring); `opencode debug config` após limpeza não lista `github` em `mcp`.

### Componentes / mudanças

- **`~/.config/opencode/opencode.jsonc` (global, FORA do repo — MANUAL, dono aplica; não commitar)** — remover 5 blocos de `mcp`: `github` (já `enabled:false` mas ainda declara tipo/url — deletar inteiro), `postgres`, `forgejo`, `stalwart`, `office-word`, `jobspy`. Mantém só `jina` + `playwright` + `provider` (`cheapestinference`/`deepinfra`/`vercel`) + `permission` + `model`/`compaction`. Validar com `opencode debug config` (deve listar só 2 MCPs globais + o repo penpot/postgres quando dentro do Teqo).
- **`opencode.json` (repo Teqo, raiz)** — de 10 linhas (`$schema` + `mcp.penpot`) para `penpot` + `postgres` como siblings em `mcp`. `postgres` bloco: `type:local, command: [npx -y @modelcontextprotocol/server-postgres, postgresql://teqo:teqo@localhost:5432/teqo], enabled:true` (mesmo command hoje no global). Adicionar `permission` top-level para gating (mecanismo A da D2): denegar por default na sessão primária e liberar por agente — validar schema vigente (`opencode debug config` deve mostrar `agent.penpot.permission` e `agent.postgres.permission` com allows). Sem `permission`, o Teqo voltaria a pagar 2 MCPs em toda sessão (anula D1 — B rejeitada).
- **`.opencode/agent/penpot.md` (novo)** — `mode: subagent`, `description` fixa "usa Penpot MCP para geometria do site", `model` herdado ou sem override, `permission` liberando `penpot:*`. Reusa frontmatter de `design-vision.md` (`mode: subagent`, `model: deepinfra/Qwen…`, `temperature: 0.2`) como precedente; não cria gerenciador dinâmico.
- **`.opencode/agent/postgres.md` (novo)** — `mode: subagent`, `description` "consulta o banco local teqo (read-only por padrão)", `permission` liberando `postgres:*`. Mesmo molde. O MCP aponta para `teqo` fixo (não `teqo_wt*` do worktree) — documentar limitação e nunca usar contra prod `teqo_1313` (guard `guard-dev-db`/`assertTestDatabase` continuam).
- **`scripts/worktree.mjs:239-258, 345`** — nenhuma mudança de código: `copyOpendevSecrets` continua copiando `.opencode/secrets/penpot-token`; com penpot ainda declarado no repo, não vira no-op. Só nota de verificação: sem penpot no repo, o `{file:.opencode/secrets/penpot-token}` dangling faria `opencode` recusar abrir — por isso penpot permanece declarado (intenção: "a cópia de secrets continua necessária — penpot permanece declarado no repo").
- **Projetos irmãos (edits commitados nesses repos, não no Teqo — listar como verificação cruzada; no Teqo o diff é só prosa/docs):**
  - `jobs/opencode.json` — adicionar `mcp.jobspy` (bloco hoje no global: `command: [.venv/bin/python, mcp/jobspy_server.py]`).
  - `lei-mercados-digitais/opencode.json` — adicionar `mcp.forgejo` + `mcp.office-word`; manter `eur-lex` + `mcp-brasil` intactos.
  - `infra-solla/opencode.jsonc` — declarar `mcp.forgejo` + `mcp.stalwart` locais (blocos copiados do global, com `FORGEJO_*`/`JMAP_*`); remover pin morto `"postgres": {enabled:false}` ; atualizar `AGENTS.md:65` para remover `office-word` da lista "Em uso" (fica `forgejo, jina, playwright, stalwart + locais airbnb/homeexchange/whatsapp`).
  - `iara-pwa/opencode.jsonc` — declarar `mcp.forgejo` local; limpar pins mortos `"postgres": {enabled:false}` e `"stalwart": {enabled:false}` (este último já é `enabled:false` proposital, mas com re-home global sem stalwart, o pin vira ruído — remover e deixar comentário da Issue #5).
- **Prosa/docs no Teqo:**
  - `AGENTS-infra.md:13` — atualizar frase que cita `.opencode/secrets/*` (ex.: `penpot-token`, referenciado pelo `opencode.json` MCP config → agora `penpot/postgres` gated por subagentes).
  - `docs/campanha/prompt-montagem-home.md:24` — atualizar "Use `penpotUtils` …" para "via subagente `penpot` (`penpot` MCP)" — hoje diz "MCP do Penpot (já configurado)" sem mencionar subagente.
  - `.agents/skills/project-status/SKILL.md:25` — trocar `MCP/pnpm issue` por `gh CLI / pnpm issue` (remove menção a MCP morto); `engineering-audit/SKILL.md:69` mesma limpeza.
  - `docs/campanha/plano-site-campanha-2026.md` se citar penpot MCP como ativo — verificar e atualizar.
- **Migration:** sem migration — config-only; nenhum schema Payload muda (`push:false` não tocado).
- **Access / Consent:** N/A — sem collection/PII; não afeta `CampaignUser`/`Consent` fail-closed.
- **UI:** N/A — Impeccable A (sem UI); TUI do opencode é consumidor de verificação, não produto.

### Dados → forma (se aplicável)

Não há dado de negócio. Forma é tooling de dev — a única "forma" deliberada é a de **gate** (D2: `permission` vs `tools`), já decidida acima com rejeitadas e gatilho de revisitação (se o schema estabilizar outro mecanismo, validar com `opencode debug config` antes de replicar).

## Fases verificáveis

1. **Tracer Teqo (repo + subagentes) — 40% do appetite** — `opencode.json` com `penpot`+`postgres` + `permission` gate; criar `.opencode/agent/penpot.md` + `postgres.md` (frontmatter no molde `design-vision*.md`). Verificar **dentro do Teqo**: `opencode debug config` lista `penpot`+`postgres` no `mcp` mas `agent penpot`/`postgres` têm `permission` allow; sessão primária `opencode debug agent build` não lista tools penpot/postgres; `node -e "JSON.parse(require('fs').readFileSync('opencode.json','utf8'))"` passa; `pnpm gate:fast` verde (nenhum teste lê `opencode.json` estruturalmente — já provado em OPS89). Push via `pnpm push` → CI `checks` verde.
2. **Global manual (dono) — condiciona o aceite, ordem recomendada: antes do merge** — remover do global os 5 blocos (`github`/`postgres`/`forgejo`/`stalwart`/`office-word`/`jobspy` — github já `false`, deletar). Verificar **fora de qualquer repo ou no Teqo após**: `opencode debug config` mostra só `jina`+`playwright` em `mcp` global; `gh auth status` continua `Logged in`; `opencode agent list` sem `github`. Se o dono não aplicar antes do merge, a janela é aceita (global com twin temporário vs Teqo já limpo — configs são merged, sem perda) — gatilho: aceitar fecha só com Fase 2 verde.
3. **Re-home irmãos (nos repos donos) — 30% do appetite, em PRs separados por repo** — `jobs` (+jobspy), `lei-mercados-digitais` (+forgejo+office-word), `infra-solla` (+forgejo+stalwart, remove postgres pin, AGENTS.md sem office-word), `iara-pwa` (+forgejo, limpa pins postgres/stalwart). Verificar por repo: `opencode debug config` dentro de cada repo lista só os MCPs donos + os 2 globais (`jina`/`playwright`); nenhum lista MCP de outro dono.
4. **Prosa + validação de ponta a ponta — 30% do appetite** — atualizar `AGENTS-infra.md`, `prompt-montagem-home.md`, `project-status/SKILL.md`, `engineering-audit/SKILL.md`; `grep -rn "MCP.*pnpm issue\|penpot MCP.*ativo" .agents docs AGENTS-infra.md` deve retornar só histórico ou nada; validar fluxo desejado: abrir opencode no Teqo → `Task` para `penpot` executa `penpotUtils.getPageById` com sucesso; `Task` para `postgres` executa `SELECT 1` no `teqo`; `gh issue view 857` funciona; `pnpm dev` sobe e `pnpm worktree next --stay --no-migrate` provisiona com `penpot-token` copiado (não "bad file reference").

## Rabbit holes / Não escopo (engenharia)

- NÃO criar gerenciador/descoberta dinâmica de MCPs — só 2 subagentes fixos (corte da intenção; D1-B/C já rejeitados).
- NÃO automatizar o global (script que reescreve `~/.config/opencode/opencode.jsonc`) — continua manual do dono (D3-B rejeitada; OPS89 já provou manual sem CI).
- NÃO editar credenciais/tokens em claro — mover blocos e só; validar lendo (`{env:…}` / `{file:…}` continuam referenciando env/arquivo, sem inline).
- NÃO tocar `eur-lex`/`mcp-brasil` no `lei-mercados-digitais` nem auditar/limpar configs de projetos fora da lista de 4 irmãos.
- NÃO reformatar JSONC globais além dos blocos removidos — tocar só `mcp.*`, manter `provider.*`/`permission`/`model`/`compaction`.
- NÃO alterar `scripts/worktree.mjs` — com penpot ainda no repo, a cópia de secrets não é no-op; mexer vira risco de "bad file reference".
- NÃO trocar `postgres` para `teqo_wt*` dinâmico — o MCP continua apontando para `teqo` fixo; worktrees com banco isolado usam `psql`/`DATABASE_URL` direto, não o MCP.

## Riscos e mitigação

- **Global JSONC inválido após edição manual** → loader do opencode falha alto; mitigar com `opencode debug config` imediatamente após colar e `python3 -m json.tool` não serve (JSONC) — usar `opencode debug config` como validator; manter backup do arquivo antes.
- **Token leak no debug** → `opencode debug config` no global imprime secrets resolvidos (`FORGEJO_ACCESS_TOKEN`, `JMAP_PASSWORD`, `penpot userToken`); não colar saída em Issue/PR/log; ao validar nos irmãos, redigir tokens (`grep` por `enabled` sem `debug` quando só precisa listar keys).
- **Permission gate silenciosamente ignorado (tools vs permission)** → sessão primária continuaria vendo penpot/postgres e o custo volta; mitigar validando `opencode debug agent penpot`/`postgres` e `opencode debug agent build` após D1; se o schema mudar, o plano volta a D2 com evidência (gatilho explícito).
- **Editar 4 repos irmãos cria config morta** → só os destinos confirmados no gate (D4); cada PR irmão verificado com `opencode debug config` dentro daquele repo (deve listar só dono + jina/playwright).
- **`scripts/worktree.mjs` vira no-op sem penpot** → não acontece porque penpot permanece declarado no repo Teqo (intenção trava); se alguém remover penpot do `opencode.json`, o worktree falha com "bad file reference" — gatilho de reversão imediata.
- **`postgres` MCP aponta para `teqo` fixo, não para `teqo_wt*` do worktree** → subagente postgres no worktree consulta o banco errado se o dev espera `teqo_wt`; documentar nos dois `.md` que o MCP é para `teqo` (main/shared) e que worktrees isolados devem usar `psql $DATABASE_URL` direto; nunca apontar `DATABASE_URL` para `teqo_1313` prod (guard `guard-dev-db`/`assertTestDatabase` continuam).
- **Global editado sem CI (sem rede de segurança automatizada)** → nenhum gate lê `opencode.jsonc` global; mitigar com verificação manual `opencode debug config` + `gh auth status` + `opencode agent list` na Fase 2; manter twin temporário (global+repo com mesmo bloco) até Fase 2 verde — configs são merged, sem janela de perda (só custo temporário).
- **Infra-solla AGENTS.md stale** → após re-home, `grep -n office-word AGENTS.md` deve dar zero; CI de `infra-solla` (`docker compose config -q`) não valida MCP, então a verificação é manual via `opencode debug config` naquele repo.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: Teqo expõe só `playwright`+`jina` no global; `penpot` e `postgres` só via subagentes no repo Teqo (com `permission` gate validado); GitHub via `gh` sem perda; cada irmão expõe só o dono (forgejo/jobspy/office-word/stalwart nos destinos confirmados); `pnpm dev`, `worktree next` e docs que citam penpot coerentes.
- [ ] Invariantes AGENTS/engineering-standards: sem twin — global é owner só de `jina`/`playwright`, cada repo é owner do seu MCP; sem gerenciador; sem automação do global; sem credencial inline; sem migration retroativa.
- [ ] Testes de domínio previstos: sem testes novos — config-only; `pnpm gate:fast` verde já cobre que nenhum teste lê `opencode.json` estruturalmente (OPS89); verificação é `opencode debug config` + `gh auth status` + `Task` penpot/postgres.
- [ ] Prosa/docs vivos sem menção stale a "MCP/ `pnpm issue`" (skills) nem "penpot MCP ativo" sem subagente.

## Self-score decision-quality

1. **Decisões caras têm rejeitadas?** Sim — D1 (A|B|C: B paga contexto em todo projeto, C perde ferramenta local), D2 (A|B|C: B é deprecated silencioso, C anula gate), D3 (A|B: B vira gerenciador contra anti-goal), D4 (A|B|C: B contradiz Issue #5 iara, C cria config morta), D5 (A|B: B reanima OAuth morto) — formato `Opções: A | B | C / Recomendação: … — porque … / Alternativas rejeitadas: … porque …` em todas.
2. **Cabe no appetite?** Sim — config-only + 2 subagentes + prosa + `opencode debug config`; ~0,5–1 dia herdado mantido; sem migration, sem testes novos; tracerbullet Fase 1 entrega Teqo isolado antes de tocar irmãos.
3. **Rabbit holes nomeados?** Sim — gerenciador de MCPs, automação do global, credenciais em claro, reformatar global inteiro, tocar eur-lex/mcp-brasil, auditar outros projetos, worktree.mjs, postgres dinâmico — todos com corte "não fazer" explícito.
4. **Depth check reusa?** Sim — reusa `opencode.json` existente (não duplica global), frontmatter de `.opencode/agent/design-vision*.md` (mode subagent/model/temperature), bloco `postgres` idêntico ao global, `copyOpendevSecrets` existente, `gh` CLI já fallback nos scripts, `permission` vigente (não inventa paralelo).
5. **Intenção (aceite de produto) permanece satisfeita?** Sim — engenharia não reescreveu outcome; só concretizou "penpot/postgres viram subagentes" + gate + re-home confirmado no gate 2026-08-24; nenhuma hipótese reavaliada muda resultado nem escopo.

**Score: 5/5** — gate ≥4 atendido.
