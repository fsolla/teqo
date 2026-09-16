# OPS114 — plan-issue: design hi-fi obrigatório no gate (substitui o rascunho low-fi)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1057
Priority: P2
Impeccable: A — N/A (muda doutrina de ferramenta de agentes, não UI de produto)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; uma varredura de referências + reescrita cirúrgica da skill
Responsável: —

## Intenção

O gate do `plan-issue` nasceu vendendo um **rascunho UI low-fi** (HTML descartável, sem assets) para validar item que muda UI. Com o sub-agente `designer` (OPS113), o gate pode entregar **design hi-fi** — HTML+Tailwind com assets SVG — que é **fonte de verdade do port** (classe-a-classe), não rascunho descartável. Enquanto os dois caminhos coexistem, a skill aponta para o artefato velho, o escritor do plano carrega doutrina de UI que não é mais dele e o gate pede um PNG que já não existe (o renderizador `scripts/render-ui-draft.mjs` foi removido em 2026-08-21). Este item aposenta o low-fi e faz a skill apontar para o design hi-fi — sem tocar UI de produto.

## Persona e fluxo

- **Persona / contexto:** quem invoca `/plan-issue` (agente principal, mesa, iterando um lote) e o humano que valida o lote no gate, abrindo o design no browser.
- **Job principal:** transformar uma ideia que muda UI em design hi-fi revisável + Issue rastreável, sem virar implementação.
- **Fluxo desejado:** ideia classificada B/C/D → explorador traz findings → escritor escreve o plano (sem gerar UI) → `designer` produz o design por ideia UI (paralelo) → orquestrador grava os arquivos no disco → plano aponta `Design UI:`/seção com link e cenas (390/1280/estados) → gate abre o HTML, itera, confirma.
- **Anti-goals de produto:** não migrar planos antigos; não transformar o design em protótipo funcional; não criar um segundo pipeline de design paralelo ao `designer`; não mexer no painel.

## Objetivo e aceite

- **Outcome:** para item que muda UI (B/C/D), o gate exige `docs/plans/<slug>-ui-design.html` + `docs/plans/<slug>-ui-design-assets/*.svg` produzidos pelo sub-agente `designer`; o escritor do plano não gera mais UI.
- O frontmatter do plano usa `Design UI:` (antes `Rascunho UI:`) e o corpo usa a seção `### Design UI (B/C/D)` com link do HTML + cenas (390/1280/estados); PNG embutido deixa de ser exigência.
- Nenhuma referência a `ui-draft-html.md`, `-ui-draft.html` ou "Rascunho UI" sobra fora de `docs/plans/**` e `docs/changelog/**`.
- Planos antigos e seus `-ui-draft.html`/PNGs ficam intactos (não renomear, não migrar).
- Guardrails: o design não carrega lógica de negócio/fetch/persistência (JS só de apresentação — modal/tabs/toggle, teto da doutrina) nem nomeia componente final (não vira implementação); doutrina do gate continua fora de `docs/plans/`.

## Dados (intenção)

- **Vou apresentar dados?** Não — mudança de doutrina de ferramenta de agentes.
- **Decisões desbloqueadas:** o executor de um item UI decide o port olhando o HTML hi-fi (classe-a-classe) em vez de reconstruir de rascunho descartável.
- **Forma:** _adiada ao plano de implementação_.

## Dados da decisão (literais)

- **Artefato obrigatório (B/C/D):** `docs/plans/<slug>-ui-design.html` + `docs/plans/<slug>-ui-design-assets/*.svg`, produzido pelo sub-agente `designer` (OPS113); o orquestrador grava no disco.
- **Rename de doutrina:** `.agents/skills/plan-issue/ui-draft-html.md` → `.agents/skills/plan-issue/ui-design-html.md` (conteúdo hi-fi entregue no OPS113; se ainda existir com o nome velho, `git mv` aqui, sem tocar no conteúdo elevado).
- **Rename de campo/seção:** `Rascunho UI:` → `Design UI:`; `### Rascunho UI (B/C/D)` → `### Design UI (B/C/D)`.
- **Edits em `.agents/skills/plan-issue/SKILL.md`:** `:26` (regra dura 4), `:42` (input do escritor — remove a doutrina de UI), `:60` (checklist do gate), `:100` (Passo 3c — remove `ui-draft-html.md`), `:112` (Passo 3d — dispatch do `designer` em paralelo por ideia UI + gravação dos arquivos), `:119` (gate — link do `-ui-design.html` + cenas 390/1280/estados).
- **Edits em `.agents/skills/plan-issue/intention-template.md`:** `:15` (campo), `:32–33` (comentário do esboço, aponta para `ui-design-html.md`), `:39–45` (seção + path), `:98` (remove "PNGs embutidos" órfão), `:106–107` (notas A vs B/C/D).
- **Edits em `.agents/skills/plan-issue/shaping.md:56` e `skills-map.md:42`:** link da doutrina + vocabulário "design hi-fi de gate".
- **Fora do sweep (imutável/outro dono):** `docs/plans/**` e `docs/changelog/**` (inclui `docs/CHANGELOG-AGENTS-HISTORY.md`); `scripts/lib/issues-panel.mjs:100` e `scripts/issues-tui.mjs` (retrocompat do painel = OPS116).
- **Sem mudança:** `.opencode/commands/plan-issue.md` (delega à skill) — confirmar por grep no fim.
- **Prettier:** `docs/plans/` **não** está no `.prettierignore` — o HTML/SVG novos do `designer` precisam passar `pnpm format:check`.
- **Precedente sem doc:** `docs/design-refs/latest/*.html|.png` (11 pares) — ver pergunta aberta.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/plan-issue/` (SKILL.md, intention-template.md, shaping.md, skills-map.md, `ui-design-html.md`); leitura de `docs/plans/` e `docs/design-refs/`.
- **Precedente a olhar:** OPS108 (flag `--auto` na skill) e OPS109/OPS110 (skill + painel) — mudança de comportamento de skill é doc-only, sem código de app.
- **Risco de acoplamento:** o painel resolve o irmão `-ui-draft.html` por convenção; não tocar — só deixar o nome novo documentado para o OPS116 implementar a retrocompat.

## Dependências

- **OPS113 (dura):** cria o sub-agente `designer` e eleva a doutrina hi-fi; sem ele não há produtor do artefato.
- **OPS116 (suave, mesmo lote):** retrocompat do painel para `-ui-design.html`; não bloqueia este item, mas sem ele o painel não abre o design novo.

## Fora de escopo

- Migrar/renomear planos antigos (`-ui-draft.html` e PNGs).
- Painel/CLI e seus testes (`scripts/lib/issues-panel.mjs`, `scripts/issues-tui.mjs`) — OPS116.
- Gates de implementação (`work-issue`/`agent-work-issue`) — continuam lendo o plano como está.
- Mover/limpar `docs/design-refs/` (vira pergunta aberta, não ação).
- UI de produto e `/impeccable`.

## Rabbit holes de produto

- **"Já que estamos mexendo, migra os planos antigos."** Acervo imutável vira PR gigante. **Corte neste item:** retrocompat fica no OPS116; aqui só o nome novo.
- **"O designer pode escrever o componente direto."** Vira implementação antes do gate. **Corte neste item:** output só em `docs/plans/<slug>-ui-design.*`.
- **"Embutir PNG no plano de novo."** O renderizador não existe mais (HTML-only desde 2026-08-21). **Corte neste item:** o humano abre o HTML; crítica usa screenshots do app renderizado (OPS115).

## Questões em aberto (produto)

- **`docs/design-refs/latest/` vira a casa de designs compartilhados?** **Opções:** A) `design-refs` guarda design compartilhado/reusado por mais de um item (par `.html`+`.png`) e o design de item mora com o plano (`-ui-design.html`); B) unificar tudo em `design-refs`, desligando o irmão do plano; C) manter o precedente informal e não documentar. **Recomendação:** A — preserva o contrato "o design viaja com o plano/Issue", reconhece os 11 pares existentes como precedente de design compartilhado e documenta a convenção na doutrina. Hoje `docs/design-refs/latest/` não tem doc de convenção, e a paleta dos UX Pilot é referência **não** aplicável (`.agents/rules/projects/nucleos-eleitorais.mdc:183`). _(assumido — validar no gate)_

## Fases (ordem de entrega)

1. **F1 — Skill (owner):** reescrever `.agents/skills/plan-issue/SKILL.md` (regra dura 4, input do escritor, checklist, Passo 3c, Passo 3d com dispatch do `designer`, Passo 4/gate) e confirmar/renomear a doutrina para `ui-design-html.md`.
2. **F2 — Template e vizinhos:** `intention-template.md` (campo, seção, notas), `shaping.md:56`, `skills-map.md:42`.
3. **F3 — Sweep + prova:** varredura de referências fora de `docs/plans`/`docs/changelog` (zero), `format:check`, confirmação de que `.opencode/commands/plan-issue.md` não muda e walkthrough de um item UI fictício pelo fluxo novo.

## Verificação

- Varredura dupla (`ui-draft`, `Rascunho UI`) restrita a `!docs/plans/**` e `!docs/changelog*/**` → vazio; resultado colado no PR.
- `git diff --name-only <base>...HEAD` → nada sob `docs/plans/` nem `docs/changelog/`.
- `pnpm format:check` verde (markdown, HTML e SVG).
- Leitura do `SKILL.md` final: escritor não recebe doutrina de UI; 3d dispatcha `designer`; gate mostra `-ui-design.html` + cenas.

## Riscos

- **Doutrina ainda no nome antigo (OPS113 incompleto).** Fail-closed: não linkar arquivo inexistente; se o OPS113 não entregou `ui-design-html.md`, este item fica bloqueado pelo `depends` em vez de adivinhar o path.
- **Referência oculta ao low-fi.** Mitigação: varredura dupla por nome e por vocabulário, com exclusões explícitas.
- **Sweep vazar para arquivos imutáveis.** Mitigação: checar `git diff --name-only` contra `docs/plans/` e `docs/changelog/`.
- **Prettier vermelho em HTML/SVG novo.** Mitigação: `pnpm format` antes do commit; `format:check` na verificação.

## Referências

- GitHub Issue #OPS114 (a registrar; placeholder)
- Design UI (gate): N/A
- `.agents/skills/plan-issue/SKILL.md` · `intention-template.md` · `shaping.md` · `skills-map.md` — arquivos a editar primeiro
- `.agents/skills/plan-issue/ui-draft-html.md` (atual) → `ui-design-html.md` (novo, OPS113)
- `docs/design-refs/latest/` — 11 pares `.html`+`.png`; `.agents/rules/projects/nucleos-eleitorais.mdc:183`
- `AGENTS.md` — convenção "edit the owner, don't twin" e operação das skills
