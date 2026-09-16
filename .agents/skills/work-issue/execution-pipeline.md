# Pipeline de execução compartilhada (work-issue / agent-work-issue)

Mecânica comum de execução → fechamento das duas skills do fluxo (humano e
workers do pool). O corpo mora aqui; cada skill declara os **deltas do seu
ator** e referencia este material — nenhuma é "base" da outra.

## Executar

**Nível de teste:** unit primeiro (lógica pura, `tests/unit`) → int para fronteiras Payload/DB (`tests/int`) → e2e só com benefício real por fluxo que as camadas inferiores não cobrem (`tests/e2e`). Dono da definição: skill `test-driven-development`.

Ordem:

1. **Schema/server** — migrations (`payload-migrations`), utilities, actions,
   testes de domínio. Invariantes do engineering-brief.
2. **UI** — se Impeccable B/C/D: a estrutura visual é do `designer` (§Design);
   porte o artefato aprovado classe-a-classe. Tokens `data-theme='campaign'`;
   shells existentes.
3. **E2E local afetado (OPS72, discricionário)** — antes do push, rode
   localmente os e2e que você **criou** + os da **mesma superfície afetada**
   (você decide quais). Ver §E2E local afetado.
4. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push` (não
   `git push` nu).

Tracer bullet cedo se o item for grande. Inclua o `*-impl.md` no commit da
entrega.

## E2E local afetado (OPS72)

Política de e2e: **local = discricionário, CI/PR = blast radius, main = full
antes do deploy**.

- **O que rodar:** os specs e2e que o diff **criou** (novos `.e2e.spec.ts`) +
  os da mesma superfície trabalhada (o `E2E_AFFECTED_MANIFEST` mapeia
  `src/` → specs; a mecânica do CI é a mesma). **É discricionário: você
  decide quais rodar** — não é um gate mecânico e não está no `gate:push`.
- **Ferramenta:** `pnpm test:e2e:affected` (espelho local do classifier:
  modo `none`/`selected`/`full` conforme o diff; roda `migrate` +
  `db:seed:minimal` antes). Alternativa para specs diretas:
  `pnpm test:e2e --no-deps -- tests/e2e/<spec>.e2e.spec.ts` (ou
  `--no-deps --project=<família>`).
- **CI/PR:** roda só o **blast radius** detectado (`ci-scope.mjs`, modo
  `selected`) — nunca `full`. Diff high-risk (schema/lockfile/harness)
  classifica **`curated`** (OPS86): o PR roda o conjunto curado de e2e —
  nunca zero; o full fica para o `verify` do deploy (o run nasce no merge —
  OPS104) antes de publicar e, nesse mesmo diff, o espelho local roda full. Arquivo de área
  de risco sem entry no manifesto (`src/utilities/access`, `src/lib/schemas`,
  `campaignPushClient`, `src/utilities/ai`) classifica `unmapped-risk` e o PR
  **falha** listando os arquivos — a correção é adicionar a entry no
  `E2E_AFFECTED_MANIFEST` (`scripts/lib/e2e-affected-manifest.mjs`).
  Unit/int `changed` passam por `scripts/vitest-changed-or-full.mjs`:
  seleção vazia cai na suíte full — nunca verde com 0 testes.
- **Limitação da #72 (S3-FOLLOWUP):** e2e local com `--no-deps` + projetos
  paralelos (`--project=a --project=b`) colide no `seedTestUser` (delete +
  create concorrentes nos `beforeAll` → `ValidationError: email` e falhas
  fantasma). Use `--workers=1` ou a cadeia padrão de projetos. Só afeta o
  local: no CI/prod mode a cadeia de deps dos projects é descartada (as
  famílias rodam em paralelo) e os runs selecionados filtram por arquivo —
  quase sempre uma família — então o seed não colide.

## Design (triggers, non-triggers, crítica final)

Item que **muda UI** (Impeccable B/C/D) tem dono visual: o agente `designer`
(`.opencode/agent/designer.md`), com a doutrina `.agents/skills/plan-issue/ui-design-html.md`
como fonte única do artefato `docs/plans/<slug>-ui-design.html`
(+ `-ui-design-assets/*.svg`). O implementador porta o design aprovado
classe-a-classe; **nunca improvisa estrutura visual** (data/routes/queries/copy
seguem com ele).

**Triggers (dispatch do `designer`) — a lista fechada da intenção:**

- **(a) Superfície/estado visual novo** que o design do plano não cobre → o
  `designer` **estende o artefato antes** de o implementador mexer no markup.
  Detectado no impl plan (que lista as superfícies) **e** na execução
  (superfície que só aparece no código) — nunca inferir "não precisava".
- **(b) O design aprovado não pode ser seguido como está** → o `designer`
  propõe a adaptação; o implementador não decide a estrutura.
- **(c) No fechamento, todo diff que muda a estrutura visual** → crítica do
  `designer` contra o app **renderizado** (screenshots 390/1280 + estados
  críticos). Os non-triggers abaixo **não** acionam (c).
- **(d) Ícones/ilustrações** próprios → saem do `designer` (SVG na doutrina).

**Non-triggers (segue com o implementador, sem dispatch):** fiação de
dados/lógica no markup aprovado, hooks/rotas/queries, copy, port mecânico de
seção aprovada, bug que restaura o design aprovado, reuso de
tokens/componentes já especificados. O default é **não despachar**.

**Fora do `designer` frontier de vez (proibição, não non-trigger):** smoke/
validação de `permission`/guard/frontmatter do próprio agente, teste de visão/
sanidade de imagem, exploração (`@explore`), review geral (`@general`), escrita
de plano/PR/changelog. Esses workers rodam no **modelo padrão da sessão** (ou no
`designer-degraded`, barato, quando o alvo é o guard dos agentes de design) —
nunca no pin frontier. Gate de dispatch e lista fechada: `ui-design-html.md`
§Escopo de dispatch.

**Crítica final (fail-closed).** Sem tier primário **não há certificação**. A
ladder e a regra do `DEGRADED` são as de `ui-design-html.md` — a
indisponibilidade **desce o tier** e registra `Design tier: <slug>` no PR;
nunca pula o design em silêncio. Tier degradado marca `DEGRADED` no artefato e
no PR e **não certifica**: para em sign-off humano.

- **`work-issue` (humano presente, sem `--auto`):** com crítica certificada,
  registre `Design tier:` no PR e siga. Com `DEGRADED`/tier não-primário,
  **pare antes do `pnpm push`** — apresente a crítica `DEGRADED` + screenshots
  e aguarde sign-off explícito; só então o PR nasce Ready com
  `Design tier: DEGRADED (<slug>)` + o registro do sign-off no body.
- **`agent-work-issue` (autônomo) e `work-issue --auto`:** não há humano para o
  sign-off ⇒ **não abra PR**; comente o resultado na Issue e flip para
  `blocked` (mesmo precedente da divergência material). `DEGRADED` nunca vira
  "segue sem".

## /simplify + débitos

1. Rode o comando `/simplify` completo (2 reviewers paralelos via Task —
   revisor estrutural + revisor de qualidade, ver `work-issue` SKILL.md)
   no diff da sessão.
2. Aplique fixes pontuais que preservem comportamento.
3. Rode `capture-review-debts` no modo do ator (ver deltas). Nunca edite a
   Issue `in-progress` atual para absorver débitos.

## Fechar em main

1. Branch do ator (ver deltas) — nunca crie branch nova fora dela.
2. **Changelog da entrega (OPS44, OPS85):** escreva `docs/changelog/<data>-<id>.md`
   (ex. `2026-08-13-ops44.md`) — uma entrada curta no formato do agregado. É o
   único registro commitado: **não rode `pnpm changelog:build` nem commite o
   agregado** (ele é gitignored desde OPS85). Opcional: `pnpm changelog:read`
   para conferir a leitura completa localmente (seed do HISTORY). O diff
   commitado é só a entrada nova.
3. **`pnpm push -u origin HEAD`** — origin é o **GitHub** (OPS71; o tracker de
   Issues também vive no GitHub — OPS76).
4. PR no **GitHub** via `GITHUB_TOKEN=<PAT> node scripts/github-pr.mjs --head <branch> --title "<id> — <título>" --body-file <arquivo>` — **Ready** (nunca draft; o script não tem flag draft), base `main`, body com `Closes #<N>` (ou `Related #N` em plans-only). Em Cursor Cloud: `ManagePullRequest` com `draft: false`.
5. O safety net `agent-pr-ready-automerge.yml` arma o **auto-merge nativo do
   GitHub** (`enablePullRequestAutoMerge`, rebase) — o servidor mergea quando
   o required check `CI (PR) / checks` fica verde; nada a armar.
6. No merge, o workflow `issue-done-on-main-merge.yml` flipa `done`/`in-prod`
   **no GitHub** (lê o body do PR via API do GitHub, escreve no tracker por
   `GITHUB_TOKEN`). Comente na Issue o desfecho em uma linha.

## Deltas por ator

| Ator | Branch | UI | `capture-review-debts` | Cloud |
| ---- | ------ | --- | ---------------------- | ----- |
| **Humano** (`work-issue`) | `<Code>-<slug>` (worktree; nunca crie branch nova na sessão) | §Design — `designer` nos triggers (a/b/d) e crítica final (c); port classe-a-classe; `DEGRADED` ⇒ para antes do push (sign-off humano) | **autônomo** — decide o destino dos achados (registrar/absorver/deferir/descartar) pela triage da skill; sem pausa para o humano | n/a (máquina do humano) |
| **Pool** (`agent-work-issue`) | `agent/<id>-<slug>` (worktrees Cursor podem já ter criado) | §Design — `designer` nos triggers (a/b/d) e crítica final (c); port classe-a-classe; `DEGRADED` ⇒ sem PR (comenta Issue + `blocked`) | **autônomo** — só `expensive_lock` com score ≥4 (Issues novas com `depends`); score ≤3 / cheap_polish / defer_trigger → defer no `*-impl.md` ou descarte | `ManagePullRequest` com `draft: false` (salvo `DEGRADED` ⇒ sem PR); Prep Cloud no Passo 0 |
