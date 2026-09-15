# Impl: OPS109 — Painel de issues e planos no terminal (via SSH)

Status: aprovado (gate humano 2026-09-15)
Atualizado em: 2026-09-15
Issue: #1020
Intenção: docs/plans/ops109-painel-issues-no-terminal.md
Appetite restante: entregue

## Leitura da intenção

- **Outcome:** o mantenedor abre uma TUI no terminal (mesa ou SSH de laptop/celular), vê numa lista as issues com estado/prioridade/kind e a ação que esperam dele, filtra por estado (em andamento / aguardando / concluídas), seleciona uma issue e lê o plano de intenção e o de implementação renderizados — cada um com link e status legível ("aprovado" vs "aguardando aprovação") — além de abrir o rascunho UI no browser da máquina e anexar à sessão do agente daquela issue, tudo read-only e sem sair do terminal.
- **O que NÃO negociar:**
  - Read-only de ponta a ponta sobre o tracker e os planos (não claima, não relabela, não fecha, não comenta, não edita plano). Abrir browser/anexar sessão são navegação local, não escrita.
  - **A fonte é a mesma camada de leitura de Issues usada por `pnpm issue` / `pnpm agent:status`** — `scripts/lib/github-api.mjs` (`listIssues`) + `scripts/lib/agent-forgejo.mjs` (`parseFrontmatter`, `labelNames`, `priorityRank`). Sem cache paralelo, sem segunda fonte de verdade.
  - **A sessão do agente consome o contrato versionado do OPS110** (`pnpm agent:session list --json` = `{version, server, sessions:[{…state, status}]}` e `resolveSessionRef`); não iniciar run novo, não twinar o mecanismo de sessão.
  - "Nenhuma sessão ativa" e "sem plano / impl não criado" são **estados de primeira classe** — nunca célula vazia, nunca falha silenciosa.
  - Sem browser/display (SSH puro): **imprime o caminho** do `.html` para abrir manualmente; nunca crasha nem falha em silêncio.
  - Token ausente / rede fora = **mensagem clara, nunca stack trace**.
  - Terminal estreito (celular, ~46 col) continua utilizável.
  - Não duplicar `pnpm issue` / `pnpm agent:status`; não substituí-los.
- **O que reavaliar (hipóteses da intenção):**
  - "Nenhuma lib TUI instalada hoje" — **confirmado e mais severo**: `chalk`, `picocolors`, `marked`, `marked-terminal`, `markdown-it`, `cli-table3`, `boxen`, `ora`, `ink`, `blessed`, `string-width`, `strip-ansi`, `wrap-ansi` estão **todas ausentes** de `node_modules`. `react-markdown`/`remark-gfm` existem mas são browser/React — inúteis aqui. O plano assume ANSI/markdown à mão (decisão 1).
  - `extractPlanPath` (`scripts/lib/agent-pool-prompt.mjs:12`) casa **o primeiro** `docs/plans/*.md` do body — mas o body de uma Issue costuma linkar o **plano de intenção**, não o `-impl.md`. O impl é descoberto por convenção de arquivo irmão (`<slug>-impl.md`) + back-link `Intenção:`, não por varredura cega do body (decisão 4).
  - `loadStates` é **privado** dentro do CLI `scripts/agent-session.mjs:342` (não exportado pelo lib). Consumir via spawn do CLI é o contrato versionado; a alternativa de importar exige extrair `loadStates` para o lib (decisão 2).
  - `listIssues` **não pagina** (`scripts/lib/github-api.mjs:213`; `per_page: limit` + `page`, um GET). Todos os callers usam `limit: 200` — o mesmo teto deste CLI (decisão 6).
  - A linha `Status:` dos planos é **suja**: variantes `aprovado (gate humano <data>)`, `**entregue** (negrito)`, `entregue (2026-07-29)`, `plano — registrado (blocked até plano em main)`, `engenharia pronta, mesclada…`, `Fases 1–4 implementadas…`. O parser precisa normalizar negrito/backticks/sufixos e classificar por prefixo, preservando o valor cru visível (decisão 3).
  - Node 24 com type-stripping nativo importa `src/lib/slug.ts` de `.mjs` sem loader (já exercido por `scripts/lib/agent-session.mjs:21`), mas o painel não precisa disso — lógica pura em `.mjs`.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph Leitura read-only
    GH[github-api.listIssues<br/>state=all limit=200] --> VM
    SESS[agent-session list --json<br/>spawn do contrato OPS110] --> VM
    FS[docs/plans/*.md<br/>readFileSync] --> PARSER[parsePlanStatus<br/>parsePlanLinks]
  end
  VM[buildPanelViewModel<br/>puro: estado + ação + planos + sessão] --> ROWS[rows filtradas]
  PARSER --> VM
  ROWS --> TUI[TUI ANSI<br/>alternate screen + raw mode]
  TUI --> LIST[lista: estado·id·título·plano·prio<br/>filtro 1-4]
  TUI --> DETAIL[detalhe: resumo + planos<br/>+ ações w/s/o]
  DETAIL --> READER[leitor markdown<br/>render ANSI à mão]
  DETAIL -- w --> BROWSER[xdg-open/open<br/>fallback: imprime caminho]
  DETAIL -- s --> ATTACH[spawn agent-session attach --issue=N]
  LIST -- --json --> JSON[view model JSON<br/>não-interativo p/ CI/teste]
```

**Opções consideradas:** A) CLI novo `scripts/issues-tui.mjs` + libs puras em `scripts/lib/issues-panel.mjs`, TUI ANSI à mão, **zero dependência nova**; B) mesmo CLI mas com `marked` + `marked-terminal` + `cli-table3`/`picocolors`; C) `ink` (React no terminal) ou `blessed`.
**Recomendação:** **A** — o subconjunto de render exigido (headings, listas, tabelas simples, código, negrito, citação) cabe em ~150 linhas de ANSI à mão; zero-dep evita tocar `pnpm-lock`, mantém `knip` honesto (dep nova precisa ser realmente usada), não encarece `pnpm install`/CI e preserva o contrato de "roda em qualquer terminal SSH". O appetite ~1–2 dias não paga o custo de integrar/estilizar uma lib de markdown inteira para um subconjunto.
**Rejeitadas:**

- **B** (`marked` + `marked-terminal` + `cli-table3`/`picocolors`) — quatro deps só para um subconjunto; `marked-terminal` ainda arrasta `string-width`/`cli-table3`/`ansi-escapes` e traz um modelo de impressão imperativo difícil de truncar a 46 colunas; toda dep nova passa por auditoria de supply-chain e precisa de uso real sob `knip` (deps não usadas são block).
- **C** (`ink`/`blessed`) — React/layout engine inteiro para 5 telas; `blessed` está em manutenção irregular e `ink` exige JSX + reconciler, muito peso e superfície para uma ferramenta read-only. Gatilho de revisitação registrado na decisão 1.

### Componentes / mudanças

- **`scripts/lib/issues-panel.mjs`** (novo, puro, testável): a única fonte de derivação do painel.
  - `parsePlanStatus(markdown)` — extrai a linha `Status:` (aceita `**negrito**`, backticks, sufixos entre parênteses) e devolve `{ raw, normalized }`.
  - `classifyPlanStatus(raw)` — `aprovado*` → `'aprovado'`; `rascunho|registrado|blocked|plano — registrado` → `'aguardando'`; `em execução|executado|entregue|implementado|pronta|produção` → `'andou'`; desconhecido → `'desconhecido'` (fail-safe: mostra o cru, não inventa).
  - `parsePlanLinks(body, planPath?)` — a partir do path do plano de intenção, deriva `<slug>-impl.md` e `<slug>-ui-draft.html` por convenção de arquivo irmão, confirma a existência via `readFileSync`/`existsSync` injetado.
  - `buildPanelViewModel({ issues, sessions, plans })` — junta Issue + labels (`labelNames`/`priorityRank` de `agent-forgejo.mjs`), plano intenção/impl (status/classificação) e sessão OPS110 (`resolveSessionRef` de `agent-session.mjs`) num shape estável testável.
  - `issueAction(vm)` — a ação pendente do operador ("aguardando aprovação" / "em andamento" / "travada"), derivada de labels + status dos planos.
  - `filterByState(rows, key)` — `all | in-progress | waiting | done`.
  - `truncateToWidth(text, width)` — truncamento ANSI-safe com `…` para terminal estreito (largura baseline ~46).
  - Reusa **sem twin**: `labelNames`, `priorityRank`, `parseFrontmatter` (agent-forgejo), `extractPlanPath` (agent-pool-prompt), `resolveSessionRef` (agent-session).
- **`scripts/lib/ansi.mjs`** (novo, puro): helpers mínimos — `style`/`bold`/`dim`/`inverse`, códigos de cursor, `enterAlternateScreen`/`leaveAlternateScreen`, `stripAnsi`, `visibleWidth`. Sem dependência; só constante + string.
- **`scripts/lib/markdown-ansi.mjs`** (novo, puro): `renderMarkdown(md, { width })` — subconjunto: `#`..`######` (heading), listas `-`/`1.`, tabelas `|…|`, blocos ` ``` ` (dim/recuado), `**negrito**`/`*itálico*`, citação `> `. Retorna `string[]` de linhas para o leitor rolar. Sem parser completo — linhas desconhecidas passam cruas.
- **`scripts/issues-tui.mjs`** (novo, I/O fina): o CLI. Lê env (`GITHUB_TOKEN` via `github-api`), spawna `node scripts/agent-session.mjs list --json`, lê os `docs/plans/*.md` dos itens selecionados, monta o view model com o lib puro e desenha a TUI (alternate screen + raw mode). Subcomandos: `--json` (imprime o view model sem TUI — contrato não-interativo para teste/CI) e `--help`. Abre browser (`xdg-open`/`open`/`wslview`) e sessão (`spawnSync(node scripts/agent-session.mjs attach --issue=N …)`), com fallback.
- **`package.json`**: novo script `"issues:tui": "node scripts/issues-tui.mjs"` no mesmo padrão de `"issue"`/`"agent:status"`/`"agent:session"`.
- **Migration:** **sem migration** — nenhum schema/collection/global muda; `push:false` intocado.
- **Access / Consent:** não se aplica — tooling de terminal, sem acesso a banco, sem PII, sem `Consent`. Não toca `src/`. Nenhum helper de access novo.
- **UI:** **Impeccable C** (fluxo novo, ferramenta de terminal; sem UI de produto). Rascunho UI existente em `docs/plans/ops109-painel-issues-no-terminal-ui-draft.html` — **contrato visual, não código**: 5 cenas (lista 100col com filtro 1–4; detalhe com planos+ações `w`/`s`/`o`; leitor markdown com `Status:` no header e `%`; estados críticos sem token/vazio/sem ações; celular ~46col). O craft é a fidelidade ao rascunho via ANSI (cores funcionais de estado, acento de seleção). Sem ciclo shape→craft→critique→polish de browser — a verificação é aberta no próprio terminal.

### Dados → forma (se aplicável)

- **Forma:** **store completo + view model puro**. A camada pura (`issues-panel.mjs`) recebe os três insumos (`issues`, `sessions`, `plans`) e devolve um único shape — `{ rows: [{ number, id, title, state, priority, kind, depends, action, plan: { intention: {path, status, classification}, impl: {…} }, uiDraft: {path, exists}, session: {status, sessionID, branch, dir} | null, githubUrl }] }`. O CLI só faz I/O (fetch/spawn/read) e render.
- **Por quê:** o aceite de produto é todo leitura/derivação; concentrar a derivação num módulo puro torna testável por unit (`// @vitest-environment node`, import direto do `.mjs`) e mantém a camada de I/O fina — o padrão dominante pedido na intenção/diretrizes.
- **Rejeitadas:** A) derivar direto no CLI (I/O + lógica entrelaçados → intestável sem spawn/HTTP); B) derivar no render (acoplado ao terminal, impossível de exercitar em `--json`); C) cachear o view model em disco (segunda fonte que envelhece — anti-goal explícito).

## Decisões de engenharia

**1. Dependências: zero-dep hand-rolled vs libs.**
Opções: A) zero-dep — TUI ANSI à mão (`scripts/lib/ansi.mjs`) + render markdown ANSI à mão (`scripts/lib/markdown-ansi.mjs`); B) adicionar `marked` + `marked-terminal` + `cli-table3` + `picocolors`; C) adicionar `ink`/`blessed`.
Recomendação: **A** — o subconjunto pedido (headings, listas, tabelas, código, negrito, citação) é pequeno e estável; zero-dep não toca lockfile, mantém `knip` sem `ignoreDependencies` novo (deps não usadas são block), não infla `pnpm install`/CI e preserva "roda em qualquer terminal SSH". Node 24 ESM puro já é a convenção dos `scripts/*.mjs`.
Rejeitadas: B porque quatro deps (mais transitivas) para um subconjunto, com `marked-terminal` importando `string-width`/`cli-table3`/`ansi-escapes` e um modelo de impressão difícil de truncar a 46 col; C porque `ink` (JSX+reconciler) e `blessed` (peso/manutenção) são um framework inteiro para 5 telas read-only.
**Gatilho de revisitação:** se o painel passar a precisar de render semântico rico (syntax highlight, tabelas com quebra de célula, âncoras navegáveis) ou de mais de ~5 telas com estado complexo, reabrir e migrar para `marked`+`marked-terminal` (B) — a fronteira pura (`markdown-ansi.mjs`) isola a troca a um módulo.

**2. Onde vive a lógica: lib pura vs inline; e o `loadStates` do OPS110.**
Opções: A) lógica de derivação em `scripts/lib/issues-panel.mjs` (puro/testável) e I/O fino no CLI `scripts/issues-tui.mjs`; B) tudo inline no CLI; C) lib pura **e** importar o estado de sessão lendo o diretório `~/.local/state/teqo/agent-sessions/*.json` diretamente.
Recomendação: **A + consumir o contrato via spawn** — o CLI spawna `node scripts/agent-session.mjs list --json` (o contrato versionado que `docs/AGENT-OPS.md:71,73` já declara como "o contrato do OPS109") e passa o JSON para `buildPanelViewModel`, que usa `resolveSessionRef` importado de `scripts/lib/agent-session.mjs`. Isso **não duplica** a leitura do diretório de estado nem reimplementa `deriveSessionStatus`/health-por-HTTP: o painel não fala HTTP com o servidor de sessões.
Rejeitadas: B porque entrelaça I/O e derivação e mata o `--json` testável; C porque reler o diretório é exatamente o **twin** que a engineering-standards proíbe — `loadStates` é privado de propósito (`scripts/agent-session.mjs:342`) e duplicá-lo faria o painel driftar da derivação de status/health do OPS110. Se algum dia importar em vez de spawnar for necessário, o movimento correto é **extrair `loadStates` para `scripts/lib/agent-session.mjs`** (edit the owner) e reusar — registrado como gatilho.

**3. Parser do `Status:` e classificação de produto.**
Opções: A) novo `parsePlanStatus` que normaliza `**negrito**`/backticks/sufixos e classifica por prefixo, com valor **cru sempre visível**; B) regex literal só nas strings conhecidas; C) regex de `Status:` já existente em algum lib (não existe — confirmado: nenhum parser de `Status:` em `scripts/lib/*`).
Recomendação: **A** — a variedade real (193 `aprovado`, 192 `rascunho`, 72 `registrado`, 21 `em execução`/`entregue`, sufixos `(gate humano <data>)`, `**entregue**`, `plano — registrado (blocked até plano em main)`, e até frases como `Fases 1–4 implementadas…`) exige normalização. `classifyPlanStatus` mapeia por prefixo segundo a leitura de produto assumida (`aprovado*`=aprovado; `rascunho|registrado|blocked`=aguardando; `em execução|executado|entregue|implementado`=andou); desconhecido → `desconhecido` (fail-safe: exibe o cru, nunca inventa "aprovado").
Rejeitadas: B porque a lista de literais mudaria a cada plano novo e classificaria erroneamente `**entregue**`/`entregue (data)`; C porque não existe e criar duas regex seria o twin.
Nota: o header do leitor **sempre** mostra o `Status:` cru (rascunho UI cena 3: `Status: aprovado`), com a classificação como rótulo ao lado.

**4. Descoberta de plano intenção / impl / rascunho UI a partir do body + convenções.**
Opções: A) `extractPlanPath(body)` (reuso) para a intenção; derivar `<slug>-impl.md` e `<slug>-ui-draft.html` como irmãos por convenção e confirmar existência no disco; B) varrer todos os `docs/plans/*.md` procurando back-links `Issue: #N`/`Intenção:` (varredura do repo); C) assumir que o body lista os dois planos.
Recomendação: **A** — o body linka o plano de intenção (`Plano: [\`docs/plans/<slug>.md\`](…)`), e a intenção registra a convenção irmã: `-impl.md`(com back-link`Intenção: docs/plans/<slug>.md`) e `-ui-draft.html`. `extractPlanPath`já casa o link real; o impl/rascunho se derivam do mesmo`<slug>`. Quando o impl **não existe**, o estado é "impl não criado" (primeira classe) e o link do GitHub é a saída. Existência verificada com `existsSync` (a camada de I/O passa os paths existentes ao view model puro).
Rejeitadas: B porque varrer 777 planos por request é caro e ambíguo (um plano pode referenciar várias Issues); C porque o body só carrega o link da intenção e assumir o impl faria o painel mentir quando ele não existe.

**5. Contrato do comando e como o painel abre markdown/detalhe.**
Opções: A) `pnpm issues:tui` interativo (alternate screen + raw mode) **e** `pnpm issues:tui --json` não-interativo imprimindo o view model; navegação em telas full-screen com `enter`/`esc`/`w`/`s`/`o`/`1-4`/`r`/`q`; B) só interativo, sem `--json`; C) páginas de texto impressas (sem alternate screen, `less`-like) re-executando o CLI.
Recomendação: **A** — o rascunho UI cita `pnpm issues:tui` como nome do comando (cena 4: `GITHUB_TOKEN=… pnpm issues:tui`), então o nome fica. `--json` é o contrato **não-interativo** que permite testar o view model de ponta a ponta por spawn (sem TTY) e serve de escape para resposta scriptável; o interativo usa alternate screen (`\x1b[?1049h`) + raw mode (`process.stdin.setRawMode(true)`), restore garantido em `finally` (inclusive em `SIGINT`/erro) para nunca deixar o terminal em raw.
Rejeitadas: B porque um TUI sem contrato testável força testar via spawn de TTY (frágil) e não dá saída scriptável; C porque o `less`-like re-executaria o fetch a cada página (custo/token) e não tem estado de seleção.
Nota: o comando **não** substitui `pnpm issue`/`pnpm agent:status` — é um terceiro ponto de leitura, read-only, sobre a mesma camada.

**6. Paginação do `listIssues` (limit 100, sem loop).**
Opções: A) uma chamada `listIssues({ state: 'all', limit: 100 })` e **estado explícito** quando a resposta bate no teto; B) loop de paginação novo até esgotar; C) elevar o limite além de 100.
Recomendação: **A** — `scripts/lib/github-api.mjs` não pagina e `per_page` do GitHub é clampado em 100; o painel usa 100 como teto efetivo (`--limit` clampado) e, se `rows.length >= 100`, mostra um aviso ("mostrando as 100 mais recentes") em vez de fingir completude. Paginação real é uma mudança no **dono** (`github-api.mjs`), fora do appetite e sem evidência de necessidade hoje. _(Ajustado na execução: a hipótese original de 200 colidia com o teto de `per_page` do GitHub — 200 nunca chegava e o aviso nunca dispararia.)_
Rejeitadas: B porque adiciona paginação ao painel em vez do dono (twin) e não há caso que estoure 100 ainda; C porque `per_page` acima de 100 é ignorado pelo GitHub e elevaria custo sem resolver o teto.

**7. Abrir browser e sessão com fallback SSH.**
Opções: A) `spawnSync` de `xdg-open`/`open`/`wslview` para o `.html`, e `spawnSync(node scripts/agent-session.mjs attach --issue=N …)` para a sessão — ambos com fallback textual; B) só imprimir o caminho/comando (nunca tentar spawnar); C) `chromium.launch()` do Playwright (como os scripts de relatório).
Recomendação: **A** — humano está na máquina do repo (decisão assumida na intenção) e quer a ação de um toque. Browser: se `DISPLAY`/`WAYLAND_DISPLAY` ausentes e nenhum opener existir, **imprime o path absoluto** (nunca falha em silêncio). Sessão: reusa o CLI do OPS110 (sem reimplementar attach); o painel antes consulta o `list --json` — sem `session` para a Issue, mostra "nenhuma sessão ativa" e **não inicia run** (abrir-sessão só anexa).
Rejeitadas: B porque o gate humano pediu explicitamente "abrir no browser" (a ação existe); C porque Playwright headless não é "o browser padrão da máquina" e um `.html` de draft de UI deve abrir no browser do usuário.
Nota: o attach do painel é síncrono (`stdio: 'inherit'`) e, ao sair do TUI do agente, o painel retoma — o run do agente **não** é encerrado (OPS110).

## Fases verificáveis

1. **Tracer / leitura+derivação puros (quota ~40% do appetite)** — `scripts/lib/issues-panel.mjs` + `scripts/lib/markdown-ansi.mjs` + `scripts/lib/ansi.mjs` com os helpers puros e os unit tests correspondentes; `scripts/issues-tui.mjs --json` que já exercita o pipeline real (fetch GitHub + spawn `agent-session list --json` + leitura de planos) imprimindo o view model. Prova: `pnpm issues:tui --json` devolve rows com estado/ação/planos/sessão; unit verde.
2. **UI (quota ~45%)** — TUI interativa: lista (filtro 1–4, navegação `↑↓`/`enter`), detalhe (planos + ações `w`/`s`/`o`), leitor markdown rolável (`↑↓`/`pgup`/`pgdn`/`esc`), estados críticos (sem token, vazio, sem plano/impl, sem sessão, sem browser/display), truncamento a terminal estreito. Fidelidade ao rascunho UI. Prova: aberta no terminal (mesa e via SSH), com os cenários do rascunho reproduzidos à mão.
3. **Gates (quota ~15%)** — `pnpm gate:fast` (lint + typecheck + unit); `pnpm knip` (nenhuma dep nova a declarar, nenhum export morto); `pnpm gate:ci` conforme o repo; push via `pnpm push`. Registro: entrada em `docs/changelog/<data>-ops109.md`.

## Rabbit holes / Não escopo (engenharia)

- **Escrever no tracker/planos** — read-only é invariante; claim/relabel/close/comentar/editar plano mora nos comandos existentes.
- **Iniciar run novo** — o painel só anexa (attach) a um run existente via CLI do OPS110; nunca `agent:session start`.
- **Servidor web / ttyd / wetty / app mobile / tmux obrigatório** — o contrato é o terminal SSH puro.
- **Notificações / watch / daemon / burndown** — fora de escopo por produto.
- **Reimplementar `loadStates`/health HTTP do OPS110** — twin proibido; consome-se `list --json`. Se um dia importar for necessário, extrair `loadStates` para o lib (edit the owner).
- **Paginação do `listIssues`** — mudança de dono (`github-api.mjs`), sem evidência de necessidade; o painel clampa no teto de `per_page` do GitHub (100) e avisa quando a página enche.
- **Filtro de busca (`/`) na lista** — está no rodapé do rascunho UI, mas **não** está no aceite de produto; fica como polish barato na Fase 2 se sobrar appetite, sem virar requisito (gatilho: humano pedir).
- **Renomear `pnpm issue`/`agent:status`** — não substituir; o painel é um terceiro ponto de leitura.
- **`push:false`/migration** — nenhum schema muda; nada de migration.

## Débts do /simplify (triage)

- **Já resolvido no simplify (não reabrir):** scroll de um frame por linha no `paint` (sem `\n` final); overflow das linhas largas a 80/96 col e da linha estreita a 46 (limiar 96 + `padToWidth` sempre); capacidade do corpo estreito contando 2 linhas por item (`visibleWindow` puro, testado); leitor markdown em largura fixa 80 (agora largura dinâmica + truncamento); inverso da linha selecionada apagado pelo reset interno (`stripAnsi` antes do inverse); `--limit` acima do teto de 100 do GitHub (clamp + `truncated` honesto); classificação de `plano — registrado`; twin de frontmatter (`parseFrontmatter` de `agent-forgejo`); flags manuais (`parseEqualsFlags` + `dieWithLabel`); `sessionWarning` invisível na TUI; `wrap` local duplicado (`wrapInline`); `readKey` descartando teclas em lote e travando no EOF (`createKeyReader` com fila); ui-draft lido só para `Boolean` (`existsSync`); `planLabel`/`toJsonPayload` com branch morto; docs do ANSI e do reader; `DEFAULT_READER_WIDTH` não exportado.
- **Adiado com gatilho:** extrair `renderList`/`renderDetail`/`renderReader`/`paint` da CLI para lib pura testável e um smoke do `--json`/`--limit` — **gatilho:** nova regressão de layout ou 2º consumidor do render. (A matemática de janela já ficou pura/testada em `visibleWindow`; o restante foi verificado no tmux a 100 e 46 colunas.)
- **Explicitamente fora:** teste automatizado de TTY (a verificação ficou no tmux manual, custo/benefício fora do appetite); I/O no entrypoint é o desenho — `scripts/issues-tui.mjs` é a fronteira de I/O, os `scripts/lib/*.mjs` do painel são puros.

## Riscos e mitigação

- **Terminal em raw mode travado após crash** — restaurar (`stty`/`\x1b[?1049l` + `setRawMode(false)`) num `finally` e em handlers de `SIGINT`/`SIGTERM`/`uncaughtException`; testar matando o processo no meio.
- **Render ANSI quebrado em SSH/terminal estreito** — sem `string-width`, larguras calculadas por `visibleWidth` próprio (strip de sequências) e truncamento com `…`; a matemática de janela é unit-testada (`visibleWindow`) e o layout foi verificado no tmux a 100 e 46 colunas. Sem emoji/double-width décor — só o essencial.
- **`marked`-less render distorce tabelas/aninhamentos** — o subconjunto é deliberadamente conservador; linhas fora do subconjunto passam cruas (nunca somem). Gatilho de revisitação na decisão 1.
- **`GITHUB_TOKEN` ausente/401/rede fora** — capturar e renderizar mensagem clara (tela de erro da cena 4), nunca stack trace; `r` tenta de novo. O `github-api` já retry-a GET 5xx e lança em 4xx/sem token.
- **`agent-session list --json` indisponível (OPS110 ausente/CLI fora)** — o painel trata como "sem sessões" com aviso discreto; a Issue nunca quebra por causa disso (sessão é enriquecimento, não requisito de lista).
- **Teto de 100 issues** — `per_page` do GitHub é clampado em 100; aviso explícito "mostrando as 100 mais recentes" quando a página enche (decisão 6).
- **Custo/token da camada de leitura** — uma chamada `listIssues` por carga (não por navegação); planos lidos do disco local, não do GitHub. `r` recarrega por intenção do humano.
- **Deriva do contrato OPS110** — o `list --json` é versionado (`version` no payload); o painel pode avisar se `version` mudar, sem quebrar. Não reler o diretório de estado (decisão 2).
- **`knip` acusando exports não usados dos libs novos** — cada helper puro é exercitado por unit/spec importando o `.mjs` (o padrão do repo, ex.: `agentSession.unit.spec.ts`), o que satisfaz o `entry`/uso.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto: lista com estado/prio/kind/ação; filtro por estado; detalhe com intenção+impl (link + status legível); "sem plano"/"impl não criado" explícitos com link GitHub; leitor markdown renderizado com rolagem/volta; rascunho UI no browser com fallback de path; sessão ativa mostrada e anexável, "nenhuma sessão ativa" caso contrário (sem iniciar run); terminal estreito utilizável; token/rede = mensagem clara; read-only de ponta a ponta sobre a camada existente.
- [ ] Invariantes AGENTS/engineering-standards: identificadores em inglês (strings de UI/labels em pt); **edit the owner, don't twin** (reusa `github-api.mjs`, `agent-forgejo.mjs`, `agent-pool-prompt.mjs`, `agent-session.mjs`; consome o contrato OPS110 em vez de reler o dir de estado); nenhuma dep nova; sem migration/`push`; sem PII/DB; comandos bare no CI.
- [ ] Testes de domínio previstos: unit em `tests/unit/*.unit.spec.ts` (`// @vitest-environment node`, import direto dos `.mjs`) cobrindo `parsePlanStatus`/`classifyPlanStatus` (incluindo `**entregue**`, `aprovado (gate humano …)`, `blocked`, desconhecido), `parsePlanLinks` (impl/rascunho irmãos, ausência), `buildPanelViewModel` (shape, ação, "sem plano"/"impl não criado"/"nenhuma sessão ativa", teto de 200), `filterByState`, `markdown-ansi` (headings/listas/tabelas/código/negrito/citação passam; linhas cruas preservadas) e `truncateToWidth`/`visibleWidth`. Sem int test (sem access/write paths).

## Autoscore de decision-quality

**Score: 4.5 / 5.**

| Critério                                                      | Nota | Justificativa                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisões caras registradas (dependência, contrato, fronteira) | 1.0  | Decisões 1 (zero-dep vs libs, com gatilho), 5 (nome `pnpm issues:tui` + `--json` como contrato não-interativo), 2 (fronteira lib pura vs I/O; consumir `list --json` em vez de reler o dir) e 7 (browser/attach + fallback) são exatamente as reversões caras; cada uma com Opções/Recomendação/Rejeitadas. |
| Alternativas rejeitadas com motivo                            | 1.0  | Toda decisão (1–7) traz rejeitadas com porquê concreto (knip/supply-chain, twin proibido, teto de 200, raw-mode, paginação fora do dono).                                                                                                                                                                   |
| Barato empurrado para Não escopo/gatilho                      | 0.9  | Busca `/`, paginação, syntax highlight e extração de `loadStates` ficam com gatilho de revisitação explícito em vez de virar escopo; o appetite é respeitado.                                                                                                                                               |
| Depth check de reuso (sem twin)                               | 1.0  | Reusa `github-api.listIssues`, `agent-forgejo` (labels/frontmatter/priority), `agent-pool-prompt.extractPlanPath`, `agent-session.resolveSessionRef` e o contrato `list --json`; nomeia explicitamente o twin proibido (reler o dir de estado) e o dono correto (`edit the owner`).                         |
| Testabilidade / tracer cedo                                   | 0.6  | Fase 1 já entrega o pipeline real via `--json` (tracer bullet) e toda a derivação é pura/testável; perde meio ponto porque o TUI interativo em si só se verifica à mão (sem teste automatizado de TTY, aceitável para o appetite).                                                                          |

**Total: 4.5/5** (≥4 — pronto para o gate humano do impl plan).
