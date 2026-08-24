# Skills e docs: codificar a pirâmide de testes (unit primeiro, int depois, E2E só com benefício real por fluxo)

Status: rascunho
Atualizado em: 2026-08-24
Issue: #838
Priority: P2
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Revisar as skills de desenvolvimento do repo e os docs de teste para codificar, nos donos certos, a pirâmide de testes na ordem unit → int → e2e-com-benefício: preferir testes unitários para lógica pura, integração para fronteiras Payload/DB, e E2E **somente** quando o fluxo tiver benefício real (fluxo crítico de usuário, navegação/UX ou contrato de URL que as camadas inferiores não cobrem). É um meta-chore de guia de agente: não muda código de produto, não muda UI, não muda schema, e mantém a política OPS72 intacta.

## Persona e fluxo

- **Persona / contexto:** agentes que executam entregas (`work-issue`/`agent-work-issue`) e quem revisa (`code-review-and-quality`), apoiados por `test-driven-development` e `engineering-audit`.
- **Job principal:** escolher o nível de teste certo para cada mudança, com a ordem explícita unit→int→e2e-com-benefício, sem inventar métrica de gate.
- **Fluxo desejado:** ao planejar/executar uma entrega, consultar a skill que já orienta a escolha de nível → decidir o nível pela natureza da mudança (lógica pura→unit; cruza boundary API/DB→int; fluxo crítico/contrato de URL/UX real→e2e) → seguir a política OPS72 para rodar/gatear (local discricionário, CI `selected`, full só no verify do deploy) → na revisão, validar que o nível escolhido é o certo.
- **Anti-goals de produto:** NÃO virar um rewrite massivo de skills nem uma "cartilha de boas práticas" genérica; NÃO introduzir regra dura de % de cobertura nem proibição de e2e; NÃO mudar gate nem CI.

## Objetivo e aceite

- Ao planejar qualquer entrega, a decisão de nível de teste é orientada pela ordem unit→int→e2e-com-benefício, e a política OPS72 continua a valer intacta.
- O dono natural da pirâmide (`test-driven-development`) fica ancorado ao contexto Teqo (camadas de `tests/`, política OPS72), sem recriar a definição do zero.
- As skills de execução (`work-issue`) e de revisão (`code-review-and-quality`) enunciam a preferência de nível, ao lado das políticas de e2e já existentes.
- `docs/TESTING.md` e a linha das 3 camadas do mapa de codebase explicitam a ordem de preferência unit→int→e2e-com-benefício.
- Guardrails: política OPS72 intacta (gate local, CI blast radius `selected`, full só no verify do deploy); nenhuma regra de % de cobertura; nenhuma proibição de e2e.

## Dados (intenção)

- **Vou apresentar dados?** Não — meta-chore de guias; sem métrica de produto.
- **Decisões desbloqueadas:** N/A

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `.agents/skills/test-driven-development/SKILL.md` — reforçar a pirâmide existente (§144–186) e ancorar ao contexto Teqo; é o dono natural da ideia.
  - `.agents/skills/work-issue/SKILL.md` + `execution-pipeline.md` — adicionar a preferência de nível à política e2e OPS72 já documentada.
  - `.agents/skills/agent-work-issue/SKILL.md` — delegado ao pipeline; sem preferência própria (ação mínima ou nenhuma).
  - `.agents/skills/browser-testing-with-devtools/SKILL.md` — reconhecer verificação em browser como caso legítimo de "e2e com benefício real" (unit não testa CSS/layout/rendering real).
  - `.agents/skills/improve-code-quality/SKILL.md` e `.agents/skills/code-review-and-quality/SKILL.md` — checklist de nível de teste.
  - `.agents/skills/ci-cd-and-automation/SKILL.md` — diagrama genérico unit→integration→e2e; confirmar que não precisa de mudança (é exemplo, não regra do repo).
  - `.agents/skills/engineering-audit/SKILL.md` — avaliação por classes; sem preferência de nível (ação mínima ou nenhuma).
  - `.agents/rules/codebase-map.mdc` (L26) e `docs/TESTING.md` — explicitar a ordem de preferência na definição das 3 camadas.
  - `AGENTS.md`/`AGENTS-infra.md` — só gates e política OPS72; sem pirâmide explícita (ação mínima ou nenhuma).
- **Precedente a olhar:** OPS87 (#833) e OPS88 (#834) são engineering-e2e/CI — NÃO sobrepostos; `docs/TESTING.md` já materializa a preferência na prática ("maioria do comportamento de campanha pinada na camada int"; CI nunca full e2e) — o trabalho é codificar/fortalecer, não criar política nova.
- **Risco de acoplamento:** manter política OPS72 intacta (gate local, CI `selected`, full no verify); não criar guard que vigie conteúdo de skill neste item (os guards `tests/unit/opencodeCommands.unit.spec.ts` e `agentPoolPrompt.unit.spec.ts` acoplam comando↔skill por nome; `codebaseConventions.unit.spec.ts` não varre `.agents/skills` — decisão de engenharia, não deste plano).

## Dependências

- Nenhuma

## Fora de escopo

- OPS87/OPS88 (engineering de e2e/CI) — itens separados e não sobrepostos.
- Guards que vigiem conteúdo de skill (não criar neste item).
- Rewrite massivo de skills ou "cartilha de boas práticas" genérica.

## Rabbit holes de produto

- **Risco:** virar "documentação de boas práticas" sem dente → corte: mudança mínima, só nos donos listados, sem novo documento canônico.
- **Risco:** tocar na política OPS72 ao reescrever trechos de `work-issue`/`execution-pipeline.md` → corte: edição cirúrgica, preservando gate local/CI `selected`/full no verify.
- **Risco:** gastar tempo "harmonizando" skills que já estão consistentes (ex.: `agent-work-issue` é só delegação) → corte: ação mínima ou nenhuma onde não há lacuna real.

## Questões em aberto (produto)

- **Onde fixar a âncora canônica da pirâmide?** **Opções:** `test-driven-development` como dono da definição (A) | `docs/TESTING.md` como única fonte (B) | ambos. **Recomendação:** A — `test-driven-development` é o dono da definição, com `docs/TESTING.md` como referência operacional, evitando duplicação entre skills.
- **`browser-testing-with-devtools` ganha rótulo explícito de "e2e com benefício real"?** **Recomendação:** sim, uma linha de justificativa no fluxo desejado, sem mudar a skill.
- **`AGENTS.md`/`AGENTS-infra.md` recebem a pirâmide?** **Recomendação:** ação mínima — só se houver uma linha curta já dedicada a testes que a receba naturalmente; sem bloco novo.

## Referências

- `.agents/skills/test-driven-development/SKILL.md` (§144–186: pirâmide + Decision Guide)
- `.agents/skills/work-issue/SKILL.md` e `execution-pipeline.md` (política e2e OPS72)
- `.agents/skills/agent-work-issue/SKILL.md`, `browser-testing-with-devtools/SKILL.md`, `improve-code-quality/SKILL.md`, `code-review-and-quality/SKILL.md`, `ci-cd-and-automation/SKILL.md`, `engineering-audit/SKILL.md`
- `docs/TESTING.md`, `.agents/rules/codebase-map.mdc`, `AGENTS.md`, `AGENTS-infra.md`
- `tests/unit/opencodeCommands.unit.spec.ts`, `tests/unit/agentPoolPrompt.unit.spec.ts`, `tests/unit/codebaseConventions.unit.spec.ts` (contexto de guards, sem ação neste item)
