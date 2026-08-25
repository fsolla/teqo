# Skill `/testing-audit` — auditoria autônoma da suíte de testes com implementação das melhorias

Status: rascunho
Atualizado em: 2026-08-24
Issue: #898
Priority: P2
Impeccable: A — N/A
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável — uma noite de execução autônoma termina com relatório honesto da suíte + melhorias de baixo risco já implementadas e verificadas
Responsável: —

## Intenção

A suíte de testes cresceu bem além do que os guias contemplavam (unit foi de 117 para 220 specs; int 95; e2e 44) e ninguém fez uma passada de saúde sobre o acervo: há duplicatas prováveis, testes de integração que poderiam ser unitários, E2E caros cobrindo o que camadas de baixo já garantem e testes de pouco valor misturados aos essenciais. Ao mesmo tempo, as noites da máquina estão ociosas. Esta entrega cria uma skill de repo que converte essa janela morta em dívida de teste paga: disparo a auditoria antes de dormir e, pela manhã, encontro um relatório que explica tudo o que foi feito e o porquê, com as melhorias seguras já aplicadas — cada uma provada verde antes e depois — prontas para revisão. O que não for seguro executar sozinho vira proposta documentada no mesmo relatório, nunca código aplicado às cegas.

## Persona e fluxo

- **Persona / contexto:** o próprio mantenedor — à noite, antes de dormir (dispara e vai embora); na manhã seguinte, revisando (lê o relatório, julga o diff).
- **Job principal:** "acordar com um retrato honesto da suíte, as melhorias seguras já aplicadas e um registro do porquê de cada decisão".
- **Fluxo desejado:**
  1. Dispara a skill (`/testing-audit`) e vai dormir.
  2. Durante a noite, ela inventaria e mede a suíte, despacha leitores paralelos por camada (unit → int → e2e), sintetiza disposições (mesclar / mover camada abaixo / reforçar / remover / ferramenta) e executa as melhorias seguras em sequência, provando suíte verde antes e depois de cada passo.
  3. Passo que quebrar e não se consertar sozinho → revert do passo e registro no relatório (fail-closed).
  4. De manhã: lê o relatório final — que registra toda ação tomada e sua razão — e revisa o trabalho em pedaços lógicos, decidindo o que aceitar.
- **Anti-goals de produto:** não vira rewrite da suíte; não cria segundo cadastro de métricas vaidosas; não muda CI/gates; não registra Issues em massa no tracker.

## Objetivo e aceite

- Relatório final obrigatório que conta **tudo o que foi feito e o porquê**: cada melhoria aplicada (com evidência verde antes/depois), cada passo revertido (com o motivo da falha), cada proposta não executada (com a razão) — lido sozinho, ele explica a noite inteira.
- Entrega da noite: **um único PR draft** com tudo; **a descrição do PR é o relatório final**; fixes separados por commit quando possível (preferência, não requisito duro).
- O mesmo relatório traz os números do retrato: contagens e tempos por camada, duplicatas, candidatos a mover/reforçar/remover — cada item com disposição e justificativa.
- Melhorias seguras implementadas como código, cada passo com a suíte relevante verde antes e depois.
- Itens intocáveis preservados: testes de consentimento/LGPD fail-closed, access control/RBAC e lockdown de liderança não podem ser removidos nem enfraquecidos autonomamente.
- Remoção autônoma só com prova forte (duplicata comprovada, teste morto de feature removida); na dúvida, vira proposta no relatório.
- Política de seleção de E2E e gates de CI intactos; nenhum percentual de cobertura vira regra dura.
- Passos que falharam foram revertidos e registrados — nada fica quebrado pela manhã.
- O diff amanhece revisável em pedaços lógicos, não num blob único.

## Dados (intenção)

- **Vou apresentar dados?** Não — as métricas da suíte são o conteúdo do relatório desta entrega, não dado de produto apresentado a usuários.

## Direção no codebase (hipótese)

- **Áreas prováveis:** nova skill `.agents/skills/testing-audit/SKILL.md` (+ espelho de comando seguindo o padrão dos comandos existentes e o guard que os pina); fases internas inspiradas em `engineering-audit` (forma da auditoria: rubrica, disposições, artefatos) e `agent-work-issue` (sub-agentes implementadores autônomos).
- **Critérios de nível:** apontar para os já codificados pelo OPS90 (#838, mergeado) — guia de pirâmide na skill de TDD (§144–198) e `docs/TESTING.md` — sem redefini-los.
- **Ferramentas:** cobertura first-party (@vitest/coverage-v8) como opção do toolkit; instalar ou não fica na implementação — métricas baratas (duração, contagens, títulos duplicados) antes das caras.
- **Precedente a olhar:** plano OPS90 (#838); plans `testes-afetados-pr` e ops86 (política de seleção — intocável aqui).
- **Risco de acoplamento:** o guard de comandos pina work-issue/plan-issue por nome — seguir o padrão ao acrescentar comando novo; nunca editar a política OPS72/`ci-scope` neste item.

## Dependências

- Nenhuma.

## Fora de escopo

- Mutation testing na rotina (fica como menção experimental no toolkit).
- Mudanças em CI, gates ou na política de seleção de E2E.
- Regra dura de percentual de cobertura (anti-goal herdado do OPS90).
- Reescrita massiva de specs existentes.
- Chase de flakes além do registro no relatório.

## Rabbit holes de produto

- **Auditoria infinita que nunca executa.** Se alguém "só completar": a skill passa a noite toda lendo e o relatório nasce sem nenhuma melhoria aplicada. **Corte:** teto de tempo/passes fixo no desenho da skill — auditoria termina, implementação começa.
- **Zelo eliminador removendo teste de valor duvidoso.** Se alguém "só completar": a rede de proteção sai enfraquecida silenciosamente. **Corte:** só prova forte remove (duplicata comprovada, teste morto); o resto vira proposta no relatório.
- **Instalação de arsenal de ferramentas pesadas.** Se alguém "só completar": mutation testing, linters de teste e dashboards engolem o appetite. **Corte:** apenas first-party e opcional; métricas baratas primeiro.
- **Relatório que esconde decisões.** Se alguém "só completar": a manhã começa com um diff sem explicação. **Corte:** o relatório é artefato de aceite — sem ele, a execução noturna não conta como completa.

## Decisões (gate 2026-08-24)

- **Entrega noturna = PR draft único ao fim**, com todo o conjunto do trabalho; **a descrição do PR é o relatório final**; fixes separados por commit quando possível (preferência, não requisito duro); sem auto-merge armado. O relatório também vive como artefato próprio referenciado pelo PR.
- **Remoções autônomas permitidas só com prova forte** (duplicata comprovada, teste morto de feature removida); guardrail da rede de proteção intocável (consentimento/LGPD, RBAC, lockdown de liderança); caso dúvido vira proposta no relatório.
- **Cobertura sim nesta 1ª versão:** instalar @vitest/coverage-v8 como devDependency opcional atrás de flag — first-party e barato, base objetiva para identificar "teste de pouco valor".

## Referências

- GitHub Issue #— (após registro)
- Arquivos-pista (abrir nesta ordem): `.agents/skills/engineering-audit/SKILL.md`, `.agents/skills/agent-work-issue/SKILL.md`, `.agents/skills/test-driven-development/SKILL.md` (§144–198), `docs/TESTING.md`, `scripts/ci-scope.mjs`, `tests/unit/opencodeCommands.unit.spec.ts`
- Plano precedente: `docs/plans/ops90-skills-piramide-testes.md` (#838, mergeado em main)
- Pesquisa (parcimônia): claude-caliper (skills/test-audit — rubricas e dispositions), dotclaude (audit-tests — verificar proteção, não inferir pelo nome), vitest.dev/guide/coverage
- `AGENTS.md` — convenções de skills/comandos do repo
