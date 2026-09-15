# OPS108 — Modo autônomo por flag nas skills plan-issue e work-issue

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1018
Priority: P2
Impeccable: A — N/A (arquivos de skills/comandos; sem UI de produto)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; uma flag com semântica única nas duas skills + comandos
Responsável: —

## Intenção

> "Possibilidade de rodar as skills `plan-issue` e `work-issue` de forma autônoma, passando flag que sinaliza que o agente não precisa esperar por confirmação do plano, e pode auto-aprovar o que ele próprio recomendar."

Hoje os dois fluxos param por definição: `plan-issue` fecha o lote num GATE que exige confirmação explícita antes de qualquer Issue/PR; `work-issue` escreve o plano de implementação e para até confirmação explícita antes de codar. Isso é o comportamento certo para colaborar, mas o dono do processo quer também poder **disparar os dois sem supervisão quando ele escolher** — deixar o agente seguir, auto-aprovar a própria recomendação e entregar (Issue registrada / execução até PR), reservando ao humano só o que o repo já exige (CI, auto-merge no servidor, aprovação de produção).

O pedido não é remover os gates — é tornar a pausa **opt-out por invocação**, com a flag explícita carregando a intenção. Sem flag, nada muda.

## Persona e fluxo

- **Persona / contexto:** o operador do paradigma (hoje o `fsolla`), de mesa, disparando um lote de ideias ou uma Issue já claimada quando não quer acompanhar passo a passo.
- **Job principal:** iniciar o fluxo e voltar depois com ele concluído até onde o repo permite — Issue registrada ou PR de entrega aberto.
- **Fluxo desejado:** invoca com a flag → o agente explora, escreve o plano, aprova a própria recomendação e segue (registro + PR no plan-issue; execução até PR no work-issue) → o humano revisa o resultado no fim, e só é interrompido antes se um invariante duro aparecer.
- **Anti-goals de produto:** não virar o default (autonomia é opt-in por invocação); não criar skill gêmea nem segundo fluxo; não mexer no contrato de claim, no pool dormente nem no launch de worktree; não auto-aprovar produção nem qualquer gate que o repo trata como humano.

## Objetivo e aceite

- Com a flag, `plan-issue` conduz o lote do overview até o registro (Issues + PR dos planos) **sem** esperar confirmação humana; sem a flag, o GATE atual permanece idêntico.
- Com a flag, `work-issue` cria/apresenta o plano de implementação, o marca como aprovado e executa até o PR **sem** pausa; sem a flag, a pausa atual permanece idêntica.
- **Pode auto-aprovar (recomendação do próprio agente, dentro do que a skill já decide):** conteúdo e fatiamento dos planos, prioridade, dependências, abordagem técnica, cortes de escopo já previstos nas skills e os literais de dados que o próprio plano recomenda (registrados como assumidos, para validação posterior).
- **Continua parando (invariantes duros do repo, valem mesmo com a flag):** Consent/LGPD fail-closed, migração de schema, contrato de URL público, shapes públicos e produção (aprovação humana do environment). Divergência material de produto → o agente para e reporta: no `work-issue` a Issue vira `blocked` (precedente do fluxo autônomo); no `plan-issue` o item não é registrado e fica fora do lote até decisão humana.
- Flag ausente ou desconhecida → comportamento atual preservado (fail-safe de compatibilidade).
- O claim continua sendo contrato do ambiente: o modo autônomo do `work-issue` não claima Issue nenhuma.

## Dados (intenção)

- **Vou apresentar dados?** Não — **Dados: N/A**: sem superfície de dados de campanha; o item muda só o fluxo das skills e dos comandos que as invocam.
- **Decisões desbloqueadas:** N/A — nenhuma decisão de campanha depende disso.
- **Forma:** N/A — nada a apresentar.

## Dados da decisão (literais)

- Flag única `--auto` nas duas skills (decidido no gate 2026-09-15). Ela remove a pausa das skills; nunca os invariantes duros. Atenção: o `--auto` do CLI do opencode é outro conceito (auto-aprovar permissões de ferramenta) — a skill deve deixar a distinção explícita no texto.
- Sem a flag, os dois GATEs atuais permanecem exatamente como estão (pausa explícita).
- Lista fechada de auto-aprovação: planos/fatiamento, prioridade, dependências, abordagem técnica, cortes já permitidos pelas skills, literais recomendados pelo próprio plano.
- Lista fechada de parada dura: Consent/LGPD fail-closed, migração de schema, contrato de URL público, shapes públicos, produção; divergência material de produto.
- Escopo: as duas skills + os dois comandos que as invocam; claim, pool e launch de worktree intocados.
- ID reservado **OPS108**; kind **chore**; sem UI (Impeccable A).

## Direção no codebase (hipótese)

- **Áreas prováveis:** os dois documentos de skill (`plan-issue` e `work-issue`) e os dois comandos que as invocam (`.opencode/commands/`) — a flag tende a viajar no texto já repassado hoje (o único flag documentado hoje é `--issue <N>`); os comandos ganham só a menção que a torna descobrível.
- **Precedente a olhar:** `agent-work-issue` (fluxo autônomo de ponta a ponta; único freio = divergência material de produto → `blocked`) e `engineering-audit` (modo primário autônomo; humano é gate final). `docs/plans/engineering-audit-v2-impl.md:41` lista o que fica fora da noite por construção — mesma lista de parada dura.
- **Risco de acoplamento:** editar o dono, não twinar (nada de skill nova). O claim é do ambiente (`worktree next`/`pnpm agent:claim`) e não pode ser puxado para a skill; `agent-work-issue` continua sendo o contrato do pool dormente.

## Dependências

- Nenhuma dura. Soft (fora deste item): o launch de worktree hoje monta `/work-issue --issue <N>` no prompt — um dia pode carregar a flag junto, mas isso é mudança de outro dono.

## Fora de escopo

- Mudar o contrato de claim, o pool dormente ou o launch de worktree (dependência futura citada acima).
- Tornar autonomia o default ou ter modo autônomo implícito por heurística.
- Um terceiro fluxo/skill gêmeo; espelhos `.claude/`/`.cursor/`.
- Auto-aprovar CI, auto-merge ou produção: os gates de servidor continuam como estão.
- Consolidar `agent-work-issue` com `work-issue --auto` (pergunta em aberto abaixo).

## Rabbit holes de produto

- **"Já que existe flag, deixa ligado sempre."** Autonomia silenciosa remove os gates de colaboração que protegem o lote em construção. **Corte neste item:** opt-in por invocação; sem flag, pausa idêntica à de hoje.
- **"A flag pula tudo, inclusive o que o repo trava."** Um modo que atravessa Consent/migração/URL/produção vira bypass de LGPD e de banco. **Corte neste item:** a lista de parada dura nunca é afetada pela flag.
- **"Faz uma skill só para autônomo."** Twin do mesmo fluxo cria drift entre dois donos. **Corte neste item:** a própria skill ganha o modo; nenhum fluxo paralelo.

## Questões em aberto (produto)

- **No `plan-issue` autônomo, divergência material de produto achada na exploração: registra bloqueada ou deixa fora?** **Opções:** A) não registra e reporta no resumo final (itens restantes seguem) · B) registra `blocked` com o motivo. **Recomendação:** A — preserva a regra "nada no tracker antes do gate" e mantém o item barato de retomar; a Issue nasce quando o humano decidir. _(assumido — validar)_
- **`work-issue --auto` vira o mesmo que `agent-work-issue`?** **Opções:** A) mantê-los separados neste item (contrato do pool vs. sessão humana) · B) consolidar num só. **Recomendação:** A agora; a convivência fica documentada e a consolidação é item futuro se os dois divergirem. _(assumido — validar)_

## Referências

- GitHub Issue #1018
- `.agents/skills/plan-issue/SKILL.md` — ciclo, "nada no tracker antes do gate", Passo 4 (GATE) e Passo 5 (registro)
- `.agents/skills/work-issue/SKILL.md` — Passo 3 (impl plan + GATE humano) e o "Proibido" que preserva claim/CI
- `.opencode/commands/plan-issue.md` e `.opencode/commands/work-issue.md` — wrappers que repassam `$ARGUMENTS`
- `.agents/skills/agent-work-issue/SKILL.md` — precedente autônomo (impl plan `aprovado`; divergência → `blocked`)
- `.agents/skills/engineering-audit/SKILL.md` — modo autônomo com humano como gate final
- `docs/plans/engineering-audit-v2-impl.md` (l.41) e `docs/AGENT-OPS.md` — o que o repo mantém humano por construção
