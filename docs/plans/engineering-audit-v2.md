# OPS98 — Skill engineering-audit v2: autônoma, sub-agentes e ponte para o fluxo de Issues

Status: rascunho
Atualizado em: 2026-08-24
Issue: #903
Priority: P2
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

A skill `/engineering-audit` é o mecanismo periódico (Pass N) de consolidar o débito técnico acumulado pelo trabalho paralelo dos agentes. Ela funciona, mas parou no tempo: o arquivo é da era pré-GitHub e cada Pass ainda roda como "audit solitário" — sessão longa com o canon inteiro inline, varredura na mão e remediação P0/P1 executada na mesma sessão. Esse modo de remediação in-session é resquício do agent-pool (morto desde OPS65; a própria skill admite "nada a pausar").

O repo já evoluiu ao redor dela: plan-issue/work-issue receberam decomposição em sub-agentes com contexto mínimo e output limitado (commit 0822cca8), improve-code-quality virou metaskill que invoca a skill-fonte em vez de re-explicar método, e skills enxutas movem detalhe para `reference/` consultado sob demanda. O audit é a única skill pesada que não seguiu esse padrão.

**Decisões do produto (2026-08-24):**

1. O audit deve rodar **de forma autônoma, sem supervisão** ("vou rodar enquanto durmo"). O modo autônomo não é uma variante — é o modo primário. E o ciclo completo dentro da mesma execução noturna: avaliar → propor melhorias → sub-agentes criam o planejamento das melhorias (padrão plan-issue) → sub-agentes executam a implementação.
2. **Entrega = UM único PR Ready, SEM auto-merge**, com TODAS as implementações feitas. O **relatório do que foi feito e os porquês é a descrição deste PR**. Cada entrega em commits separados para facilitar exploração (soft — não é hard requirement). A execução só termina quando o PR estiver com **CI green e mergeable (sem conflitos)** — pronto para mesclar; o humano apenas explora o PR e mescla pela manhã.

## Persona e fluxo

- **Persona / contexto:** o humano dispara `/engineering-audit` antes de dormir e acolhe pela manhã: retrato consolidado (três artefatos) + backlog de melhorias já planejado + melhorias já implementadas/mergeadas pelos sub-agentes. Sem humano disponível para gates intermediários.
- **Job principal:** um Pass autônomo que produz os três artefatos sólidos, registra as melhorias como Issues rastreáveis, cria os `-impl` delas via sub-agentes e entrega as implementações via PRs Ready + auto-merge.
- **Fluxo desejado:** dispara o audit → precheck → canon sob demanda → varredura por sub-agentes paralelos (output limitado) → triagem consolidada no orquestrador → três artefatos commitados na branch → sub-agentes escritores criam os `-impl` das melhorias priorizadas → sub-agentes implementadores executam em série, cada entrega como commit(s) separados na MESMA branch → **um único PR Ready (base `main`, sem auto-merge)** cuja descrição é o relatório completo (o que foi feito e o porquê) → loop de correção autônomo até **CI green + mergeable** → para. Humano explora o PR e mescla.
- **Anti-goals de produto:** não mudar o MÉTODO de auditoria (smells, triagem P0–P3, guardrails do passo 4b continuam); não tocar docs históricos imutáveis (`entrega-engenharia-p4/p5.md`, `IMPROVE-CODE-QUALITY-PLAN.md` histórico); sem produto/UI/site.

## Objetivo e aceite

- **Autônomo-first:** a skill declara explicitamente o contrato de execução sem supervisão — nenhum passo depende de confirmação humana durante a noite; o humano é o gate FINAL (explora o PR e mescla); o modo interativo (desktop) vira fallback documentado, não o caminho canônico.
- **Entrega única e controlada:** UM PR Ready, base `main`, **sem auto-merge** — com todas as implementações da noite. Descrição do PR = relatório completo (achados com números, artefatos, decisões autônomas e justificativas, bloqueios). Commits separados por entrega quando possível (soft). Estado terminal: required check verde + mergeable (rebase em `main` se conflito; loop de correção até verde; se inviável após esforço limitado, para gracefully e documenta no relatório).
- **Exclusão do safety-net (infra pequena, no escopo):** hoje todo PR same-repo Ready recebe auto-merge armado (`agent-pr-ready-automerge.yml` → `github-pr-automerge.mjs`; só draft é veto). O PR do audit precisa de caminho de exclusão determinístico (label ou prefixo de branch, ex. `audit/*`) no veredicto do script + linha correspondente em `.agents/rules/agent-pr-workflow.mdc`. Sem isso, "Ready sem auto-merge" é impossível.
- Cada Pass consome sessão enxuta: fases pesadas (varredura, consolidação) rodam em sub-agentes com input mínimo e limite duro de output (contrato "Quando/Input/Task/Output", estilo plan-issue/work-issue); o agente principal orquestra, valida e grava.
- Nenhum conhecimento se perde no enxugamento: todo conteúdo de referência (canon/precedents/rejected-with-reason, smells, táticas de consolidação) continua acessível sob demanda em arquivos `reference/` dentro da pasta da skill; a leitura do canon ANTES de julgar continua OBRIGATÓRIA.
- Método re-explicado inline aponta a skill-fonte canônica em vez de duplicá-la (mesmo padrão da metaskill improve-code-quality).
- Melhorias priorizadas são planejadas por sub-agentes escritores (`-impl`) e implementadas por sub-agentes em série na mesma branch — sem Issues/PRs por entrega (o par ledger + PR único é o registro; Issue só para o que ficar pendente/bloqueado).
- Modo solitário/precheck obsoleto sai do caminho principal (reduzido a nota histórica curta apontando OPS65).
- Menções externas vivas atualizadas: `.agents/rules/agent-pr-workflow.mdc` (exceção audit: Ready sem auto-merge, merge humano) e conferência em `docs/GUARDRAILS.md` / capture-review-debts.
- Guardrails de produto preservados: harvest de misses → `GUARDRAILS.md`; severidades P0–P3 e classificação de guarda determinística (passo 4b) intactas.

## Dados (intenção)

- **Vou apresentar dados?** Não — chore interna de tooling; nenhuma superfície de dados ao usuário final.
- **Decisões desbloqueadas:** humano + gate — aprovar o novo formato do Pass (autônomo, sub-agentes ponta a ponta, PR único sem auto-merge com relatório na descrição).
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/engineering-audit/SKILL.md` (hoje 182 linhas; alvo indicativo ~90–110) + arquivos `reference/` dentro da própria skill (canon/precedents, smells, consolidação — nomes exatos ficam no -impl); `scripts/github-pr-automerge.mjs` + `.github/workflows/agent-pr-ready-automerge.yml` (exclusão do audit no veredicto — label ou prefixo de branch); `.agents/rules/agent-pr-workflow.mdc:34`; conferência em `docs/GUARDRAILS.md:3,5` e `.agents/skills/capture-review-debts/SKILL.md:114`.
- **Precedentes a olhar:** commit 0822cca8 (decomposição em sub-agentes em plan-issue/work-issue); `improve-code-quality/SKILL.md` (metaskill que invoca a skill dona; detalhe pesado em arquivo de referência); `code-simplification` (método enxuto + guia sob demanda em `reference/`); `concise-output` (contrato de output enxuto); blocos "Quando/Input mínimo/Task verbo+proibição/Output limite duro" (`plan-issue/SKILL.md:32-51`, `work-issue/SKILL.md:17-61`); `agent-work-issue` (execução autônoma, §Prep Cloud sem Docker, loop até CI verde).
- **Risco de acoplamento:** nenhum script/workflow ATIVO depende de remediação P0/P1 in-session (verificado); a exclusão do audit no safety-net é adição de veredicto (skip → exit 0), não altera o comportamento dos demais PRs; manter o harvest → `GUARDRAILS.md`; a escada de classes de guardrail deve APONTAR `docs/GUARDRAILS.md` em vez de re-explicar; docs históricos intocáveis; textos dormentes do agent-pool (`scripts/agent-pool.mjs`, `agent-pool/SKILL.md`) ficam como estão.

## Dependências

- Nenhuma dura. Suaves: OPS65 (pool morto — contexto do modo solitário obsoleto), OPS71/OPS76 (GitHub single host — paradigma claim→PR vigente + auto-merge nativo), padrão de sub-agentes já commitado (0822cca8).

## Fora de escopo

- Mudar o método de auditoria em si (smells, severidades P0–P3, passo 4b) — Issue própria se um dia for preciso.
- Reescrever ou apagar docs históricos (`entrega-engenharia-p4/p5.md`, conteúdo histórico de `IMPROVE-CODE-QUALITY-PLAN.md`).
- Limpeza/remoção dos scripts e skills dormentes do agent-pool.
- Qualquer mudança no site/admin/campanha (produto).
- Executar remediações específicas neste item — o v2 é a máquina; as correções são entregues pelo PR único que ela produz.

## Rabbit holes de produto

- **Reorganizar vira redesenhar o método.** Se alguém "só completar" movendo texto para referência, acaba retocando smells/severidades/táticas no caminho. **Corte neste item:** mover conteúdo verbatim primeiro; qualquer ajuste de método é Issue separada.
- **Branch única vira geradora infinita de trabalho.** Sem freio, o Pass implementa dezenas de melhorias e o PR vira intragável. **Corte:** teto duro de implementações por Pass (número exato no -impl; sugestão: só P0/P1 viram implementação na noite; P2/P3 seguem só ledger como hoje) e execução serial (um sub-agente por vez na branch — sem corridas).
- **Enxugar = perder o canon crítico.** Sem precedents e rejected-with-reason carregados antes de julgar, o audit reproposta ideias já rejeitadas (ex.: ports-and-adapters NO-GO). **Corte:** carga do canon continua obrigatória antes da triagem — muda só o local (arquivo sob demanda), nunca a obrigatoriedade.
- **PR único gigante e inexplorável.** Muitas entregas num PR só pode esconder riscos. **Mitigações:** commits separados por entrega (soft), relatório-na-descrição com índice commit→achado, teto de escopo por Pass — e o humano mantém o poder final: não mesclar.
- **Exclusão do safety-net mal feita vira furo permanente.** Se o skip for amplo demais, outros PRs de agente perdem o auto-merge sem ninguém notar. **Corte:** exclusão restrita (prefixo `audit/*` ou label dedicada), com teste do veredicto incluído na entrega.

## Questões em aberto (produto)

- ~~Achado P0 mantém alguma exceção?~~ **Resolvido pelo produto:** tudo é implementado dentro da mesma branch/PR único; nada de trabalho fora dela.
- ~~Modo solitário sai totalmente ou vira nota histórica?~~ **Resolvido:** nota histórica curta apontando OPS65.
- ~~Os três artefatos continuam sendo o registro do Pass?~~ **Resolvido:** sim — artefatos = retrato consolidado comparável entre Passes, commitados na mesma branch.
- ~~Issues por entrega?~~ **Resolvido pelo produto (PR único):** sem Issues nem PRs por entrega — o registro é o par ledger + PR único com relatório na descrição; Issue só para pendências/bloqueios que sobrevivem ao Pass.
- **Teto de implementações por Pass e critério:** sugestão P0/P1 → implementação autônoma na noite; P2/P3 → só ledger. Confirmar aqui ou deixar para o -impl decidir com números.

## Referências

- GitHub Issue: #903 (registrada via `pnpm agent:register`)
- `.agents/skills/engineering-audit/SKILL.md` — alvo da revisão (182 linhas; zero `reference/`)
- Commit 0822cca8 — otimização de tokens aplicada a plan-issue/work-issue
- `.agents/skills/improve-code-quality/SKILL.md` · `code-simplification` (+ guia em `reference/`) · `concise-output/SKILL.md`
- `.agents/skills/plan-issue/SKILL.md:32-51` · `work-issue/SKILL.md:17-61` · `agent-work-issue/SKILL.md` — padrões canônicos de sub-agentes e execução autônoma
- Menções vivas: `.agents/rules/agent-pr-workflow.mdc:34` · `docs/GUARDRAILS.md:3,5` · `.agents/skills/capture-review-debts/SKILL.md:114`
- `docs/AGENT-OPS.md` — paradigma vigente (o audit como gerador de Issues/guardrails)
