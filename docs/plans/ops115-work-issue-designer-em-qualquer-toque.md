# OPS115 — work-issue/agent-work-issue: designer em qualquer toque de design + crítica visual fail-closed

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1058
Priority: P2
Impeccable: A — N/A (skills/regras de agente; sem UI de produto)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

O designer vira agente próprio (OPS113/OPS114), mas enquanto ninguém o chamar ele não muda nada: hoje as duas skills de execução tratam UI como um item de checklist ("shape → craft → critique → polish", `work-issue/SKILL.md:143-144`) e o implementador improvisa estrutura visual quando o caminho aperta. A intenção é fechar esse vão: **qualquer toque de design nos dois fluxos passa pelo designer**, e **qualquer diff que muda UI só é certificado com crítica visual contra o app renderizado** — quando o designer não está disponível, o item desce de tier explicitamente e não se auto-certifica; sign-off humano.

"Qualquer toque de design" tem fronteira: decidir estrutura visual é do designer; portar isso para o markup, fiar dados, rotas, queries e copy é do implementador. O que não pode continuar é o silêncio — um diff visual sem veredito do designer.

## Persona e fluxo

- **Persona / contexto:** quem roda as skills (fsolla na sessão humana; workers do pool quando reativados) e o agente implementador, que hoje decide layout no meio do código sem um dono visual.
- **Job principal:** garantir que todo toque visual nasça do designer e seja conferido contra o app renderizado antes de fechar — sem transformar trabalho não-visual em cerimônia.
- **Fluxo desejado:** item UI entra no work-issue com o design do plano → trigger dispara → designer estende o artefato **antes** de implementar (ou adapta o design aprovado quando ele não puder ser seguido como está) → implementador porta → no fim, diff que muda UI passa por crítica do designer com screenshots (390/1280 + estados) → veredito registrado; sem veredito válido, `DEGRADED` + sign-off humano.
- **Anti-goals de produto:** virar passo obrigatório para item sem UI; dar ao designer a caneta de wiring/estado; duplicar a `/impeccable`; pular design em silêncio; pinar `model:` em commands; ressuscitar o pool.

## Objetivo e aceite

- As duas skills exigem o designer nos 4 triggers: (a) superfície/estado visual novo que o design do plano não cobre (designer estende o artefato antes de implementar); (b) design aprovado não pode ser seguido como está (designer propõe a adaptação; implementador nunca improvisa estrutura visual); (c) ao final, qualquer diff que muda UI — crítica contra o app renderizado (screenshots 390/1280 + estados); (d) ícones/ilustrações saem do designer.
- Non-triggers seguem com o implementador: fiação de dados/lógica no markup aprovado, hooks/rotas/queries, copy, port mecânico de seção aprovada, bug que restaura o design aprovado, reuso de tokens/componentes já especificados.
- **Fail-closed:** diff que muda UI sem crítica válida do designer não é certificado — desce de tier explícito, marca `DEGRADED` no artefato e no PR, e para em sign-off humano; nunca "segue sem".
- Fallback ladder documentada na skill e aplicada no dispatch do designer (valores literais abaixo), com o tier usado registrado no PR.
- Artefato vivo: o designer pode estendê-lo durante o work-issue; mudança material vs o aprovado no gate volta ao humano no PR.
- Ownership repo-wide: uma linha em `engineering-standards.mdc` (vizinha de "Edit the owner, don't twin") declara que decisão de estrutura visual pertence ao designer; o implementador só porta.
- Guardrails: commands seguem proibidos de `model:` (OPS101); `/impeccable` é referenciada, nunca duplicada; o pool continua dormente.

## Dados (intenção)

- **Vou apresentar dados?** Não — `Dados: N/A`: processo de agente, sem superfície de dados de campanha.
- **Decisões desbloqueadas:** N/A.
- **Forma:** N/A.

## Dados da decisão (literais)

- Ladder (descer, nunca pular): `openai/gpt-5.6-sol` → `openai/gpt-6-astra` (mesmo pool Plus) → `opencode-go/deepseek-v4.1-flash` (flat; tier `designer-degraded`) → `deepseek/deepseek-flash` (direto, inline pelo orquestrador).
- Tier degradado marca `DEGRADED` no artefato e no PR e **não** certifica: veredito certificado só sai dos tiers primários; no degradado, sign-off humano.
- Crítica com screenshots 390 e 1280 + estados críticos, via Playwright. Sem browser/Cloud (`agent-work-issue`), não há certificação → `DEGRADED`, jamais "pulei por falta de browser".
- Rota canônica de crítica: `/impeccable` (`shape`/`critique`/`polish`) — referenciar, não duplicar.
- `model:` pinado é proibido nos commands (OPS101); `--model` do `agent:register` (`scripts/agent-register.mjs:20,46`) é metadata de pool dormente e não entra aqui; no `work-issue` a sessão humana não verifica modelo (`:96-98`).
- O design do plano é o artefato do OPS114 (`docs/plans/<slug>-ui-design.html` + `-ui-design-assets/*.svg`).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/work-issue/SKILL.md` (decomposição `:13-61`, checklist `:65-76`, Passo 4 `:136-155`), `.agents/skills/agent-work-issue/SKILL.md` (`:24-31`, `:33-43`, `:75-79`), `.agents/skills/work-issue/execution-pipeline.md` (ordem `:15`, deltas por ator `:89-92` — dono da mecânica compartilhada), `.agents/rules/engineering-standards.mdc` (`:46-51`, linha nova vizinha do `:50`). Possível encaixe em `.agents/skills/work-issue/engineering-brief.md` (tabela "skills sob demanda") e citação em `docs/AGENT-OPS.md`.
- **Precedente a olhar:** a própria decomposição em sub-agentes das duas skills; `agent-work-issue` (deltas do pool); `.agents/skills/impeccable/SKILL.md:41-48` como catálogo de comandos.
- **Risco de acoplamento:** editar os donos (duas skills + pipeline), nunca twinar; agente designer e formato do artefato são de OPS113/OPS114; o mecanismo do fail-closed (gate da skill? postcondição? hook?) fica no impl plan; o safety net `agent-pr-ready-automerge.yml` arma auto-merge em qualquer PR ready — a tensão com o sign-off humano precisa de decisão lá.

## Dependências

- **OPS113 (dura)** — o agente `designer`; sem ele não há a quem despachar.
- **OPS114 (dura)** — o aparato de design do lote; este item só conecta os fluxos e torna o designer obrigatório.

## Fora de escopo

- Criar ou ajustar o agente designer e o formato do artefato (OPS113/OPS114).
- Reescrever a `/impeccable` ou criar uma segunda skill de crítica visual.
- Pinar `model:` nos commands ou reativar o pool supervisor (OPS65).
- Redesenhar UI de produto, tokens ou shells — este item não toca produto.
- Exigir designer em item sem UI (classe A).

## Rabbit holes de produto

- **"Já que tem designer, todo commit passa por ele."** Vira imposto sobre trabalho não-visual. **Corte neste item:** non-triggers explícitos; default é não despachar.
- **"O designer decide a solução."** Inverte ownership e atropela engenharia. **Corte neste item:** designer decide estrutura visual; wiring/estado/rotas são do implementador.
- **"Sem designer agora, segue e revisa depois."** É exatamente o silêncio que o item existe para matar. **Corte neste item:** fail-closed com `DEGRADED` + humano.
- **"Reescreve a impeccable dentro da skill."** Twin de um dono que já existe. **Corte neste item:** referência à skill canônica.
- **"Aproveita e religa o pool."** Orquestração de agentes não é o pedido. **Corte neste item:** pool dormente, nada de supervisor.

## Questões em aberto (produto)

- **Como o fluxo autônomo entrega o sign-off humano no tier degradado sem violar o contrato "nunca Draft; PR ready + auto-merge"?** **Opções:** A) o PR degradado se declara `DEGRADED` e o impl plan escolhe o mecanismo que o mantém fora do auto-merge (veto à la `audit/*` ou não-ready); B) degradado interrompe antes de abrir PR e comenta na Issue; C) degradado só existe no `work-issue` (no autônomo, ausência de tier primário = `blocked`). **Recomendação:** A — preserva a entrega rastreável (PR) e torna o sign-off um estado visível; o caminho concreto fica no impl plan. _(assumido — validar no gate)_
- **Onde o trigger (a) é detectado — no impl plan ou durante a execução?** **Opções:** A) no impl plan, que já lista as superfícies; B) durante a execução, quando a superfície nova aparece no código. **Recomendação:** os dois — o plan antecipa; a execução não pode encontrar superfície nova e improvisar sem despachar o designer. _(assumido)_
- **`engineering-brief.md` ganha linha de design na tabela "skills sob demanda"?** **Opções:** A) sim, apontando o agente designer; B) não, o gatilho vive nas skills. **Recomendação:** A se o impl plan achar que ajuda explorador/escritor; acessório, não aceite. _(assumido)_

## Fases (ordem de entrega)

1. **Ownership:** a linha da rule em `engineering-standards.mdc`, vizinha do "Edit the owner, don't twin".
2. **Triggers + ladder:** triggers/non-triggers e a ladder nas duas skills, com a mecânica compartilhada no `execution-pipeline.md` (deltas por ator).
3. **Fail-closed:** crítica final obrigatória + `DEGRADED`/sign-off humano costurados no fechamento de cada fluxo.

## Verificação

- `pnpm gate:fast` verde; diff só de docs/skills/regras (sem migration, schema, access ou UI).
- Asserções no PR: triggers (a)–(d) e non-triggers presentes nas duas skills; ladder com os 4 slugs; `DEGRADED`; linha de ownership na rule; `/impeccable` citada sem conteúdo duplicado.
- Walkthrough no PR: item UI hipotético mostrando onde cada fluxo exige o designer antes de implementar e no fechamento; degradação simulada mostra o caminho `DEGRADED` + humano.
- Sem UI de produto → Impeccable A, sem rascunho UI.

## Riscos

- **Pulo silencioso do design** (o pior caso): ladder explícita + `DEGRADED` + tier registrado no PR; nunca inferir "não precisava".
- **`DEGRADED` fechar por auto-merge:** o safety net arma qualquer PR ready — o sign-off humano precisa sobreviver a ele; mecanismo é decisão explícita do impl plan.
- **Cerimônia em item não-visual:** non-triggers listados; default é não despachar; o trigger (a) tem que nomear a superfície nova.
- **Bloat das skills:** texto curto; mecânica no pipeline; impeccable por referência.
- **Drift entre os dois fluxos:** a mecânica compartilhada vive no `execution-pipeline.md`; cada skill declara só o delta.

## Referências

- GitHub Issue #OPS115 (a registrar; plano nasce `blocked`)
- `.agents/skills/work-issue/SKILL.md` (`:13-61`, `:65-76`, `:96-98`, `:136-155`) e `.agents/skills/agent-work-issue/SKILL.md` (`:24-31`, `:33-43`, `:75-79`) — os dois donos
- `.agents/skills/work-issue/execution-pipeline.md` (`:15`, `:89-92`) — dono da mecânica compartilhada
- `.agents/rules/engineering-standards.mdc` (`:46-51`) — onde entra a linha de ownership
- `.agents/skills/impeccable/SKILL.md` (`:1-3`, `:41-48`) — crítica visual canônica
- `scripts/agent-register.mjs` (`:20`, `:46`) e `.opencode/commands/work-issue.md` — pin de modelo proibido nos commands (OPS101); pool dormente
- `.github/workflows/agent-pr-ready-automerge.yml` + `scripts/github-pr-automerge.mjs` — safety net que arma auto-merge em PR ready (tensão do `DEGRADED`)
- `AGENTS.md` — convenções de skills/regras e changelog da entrega
