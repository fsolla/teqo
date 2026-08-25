# Skill /react-audit com ciclo fechado plan→implement de anti-patterns React/Next.js

Status: rascunho
Atualizado em: 2026-08-24
Issue: #901
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~1,5–2 dias eng; um outcome verificável
Responsável: —

## Intenção

Hoje a auditoria de código (engineering-audit) varre o repo inteiro, é read-only no sweep, e as remediações P2/P3 viram apenas ledger/plano — não existe um ciclo fechado que (a) mire especificamente anti-patterns de React/Next.js, (b) aponte as fontes oficiais (react.dev, nextjs.org) como referência e (c) feche o loop: planejar o fix e implementá-lo, sem humano. Em pré-campanha os agentes trabalham em paralelo e queremos que o react-audit rode sozinho (provavelmente de madrugada), encontre anti-patterns, proponha e implemente os fixes, e os agentes que rodam o audit tenham o Context7 MCP à mão para consultar a documentação oficial vigente. A skill **não faz merge sozinha**: ao final entrega **um único PR** com todos os fixes (cada fix num commit separado), **ready mas sem auto-merge**, CI green e mergeable, e a **descrição do PR é o relatório** — o que foi feito e o porquê de cada decisão. O ciclo termina quando esse PR está pronto para o humano explorar e mesclar.

## Persona e fluxo

- **Persona / contexto:** agente autônomo (ou humano dev) rodando a skill à noite, fora do horário de trabalho, sem ninguém assistindo a execução; o humano revisa **na manhã seguinte**, com calma.
- **Job principal:** varrer o repo por anti-patterns de React/Next.js, planejar e implementar os fixes, e entregar **um PR final único** (ready, sem auto-merge, CI green, mergeable) cuja descrição documenta tudo o que foi feito e por quê — para o humano explorar commit a commit e mesclar quando quiser.
- **Fluxo desejado:** (1) a skill abre o sweep focado em anti-patterns React/Next, mapeando cada achado a file:line; (2) para cada fix, um subagente escritor planeja (plano impl + Issue trackeável) com fonte oficial de referência; (3) um subagente implementador aplica o fix com o gate completo do repo; (4) **todos os fixes vão para a mesma branch, cada um num commit separado** (commits atômicos e legíveis para exploração); (5) ao final, a skill abre **um único PR** para `main`, ready e **sem auto-merge**, com CI green e sem conflitos; (6) a **descrição do PR é o relatório consolidado** (o que foi feito + porquês, estado de cada fix, follow-ups); (7) a entrega termina quando esse PR está green/mergeable/sem conflitos — o humano explora e mescla. Rejeição/edição do PR = humano comenta e a skill ajusta na branch; o histórico dos commits preserva o ledger.
- **Anti-goals de produto:** NÃO virar sweep geral de qualidade (é do engineering-audit) nem "cartilha genérica de boas práticas"; NÃO automatizar a config global da máquina (anti-goal OPS92); NÃO tocar convenções travadas (URLs públicas, Consent/LGPD, migrations shipped); NÃO armar auto-merge nem mesclar em `main` sem humano — a revisão humana é parte do fluxo.

## Objetivo e aceite

- Sweep focado e complementar ao engineering-audit (não re-varre qualidade geral), cada achado com file:line, família de anti-pattern e fonte oficial.
- Cada fix implementado com o gate completo do repo (tsc/lint/format/knip/cycles/unit+int/build + e2e da superfície afetada) e o próprio commit.
- **Um único PR final** aberto para `main`, estado **ready**, **sem auto-merge** armado, **sem conflitos** (mergeable) e com **CI green** ao encerrar a skill.
- **Commits separados por fix** (atômicos, com mensagem descritiva) para o humano explorar a mudança de cada anti-pattern isoladamente.
- **A descrição do PR é o relatório de auditoria**: (i) o que foi varrido e quando, (ii) cada achado com file:line e fonte oficial, (iii) por fix: planejado/implementado/rejeitado/adiado e **o porquê** (decisão, gate, custo, sobreposição com dono existente), (iv) estado final do PR e (v) recomendações de follow-up com destino (Issue/ledger).
- Skill funcional mesmo sem o Context7 (fallback a links oficiais), com a declaração global do MCP documentada como passo de setup manual do dono da máquina.
- A entrega **só termina** quando o PR final está green/mergeable/sem conflitos/sem auto-merge — se o CI ainda estiver rodando ou houver conflito, a skill continua até estabilizar.

## Dados (intenção)

- **Vou apresentar dados?** Não — tooling de desenvolvimento, sem dado de negócio.
- **Decisões desbloqueadas:** N/A
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/react-audit/SKILL.md` (novo); catálogo de anti-patterns já codificado em `.agents/rules/engineering-standards.mdc` (client boundary :24-28, caching ladder :34-43), `.agents/rules/codebase-map.mdc:26`, achados de `engineering-audit` (B14/B34, RSC payload, effects doing derived state); subagentes em `.opencode/agent/*.md`; contexto de merge/deploy em `docs/AGENT-OPS.md` e `.github/workflows/agent-pr-ready-automerge.yml` (que NÃO deve ser usado — PR final fica sem auto-merge).
- **Precedente a olhar:** `.agents/skills/engineering-audit/SKILL.md` (audit read-only; o modo autônomo dele usa auto-merge — aqui divergimos: PR único ready sem auto-merge); `agent-work-issue/SKILL.md` (plan→execute→simplify→PR sem pausa); `work-issue/SKILL.md` (uso de Task com subagentes); `docs/plans/react-19-form-reset-campanha.md` (C140 — fatia de fix React 19 já entregue).
- **Risco de acoplamento:** médio — a skill não muda produto, mas o PR final de fix que ela gera atravessa o gate CI completo e pode esbarrar em áreas com donos existentes; fixes seguem "editar o dono, não twinar". O relatório (descrição do PR) é o fio de auditoria — sem ele o audit roda e "some" de madrugada.

## Dependências

- Nenhuma.

## Fora de escopo

- Sweep geral de qualidade (permanece no engineering-audit).
- Mudança no gate/deploy (CI/auto-merge vigentes ficam como estão).
- Automação da config global (declaração do Context7 é passo manual documentado).
- Revisão/correção das convenções travadas (URLs públicas, Consent/LGPD, migrations shipped).

## Rabbit holes de produto

- **Sweep virar "cartilha genérica".** Se alguém "só completar" a skill com boas práticas descoladas do repo, ela perde o valor de auditoria. **Corte neste item:** cada anti-pattern precisa de file:line do repo + fonte oficial; sem mapeamento, não vira fix.
- **Escopo inflar para qualidade geral.** Se o escritor "só completar" com temas fora de React/Next, vira um segundo engineering-audit. **Corte neste item:** enumeração fixa de famílias (client boundary, RSC payload, estado/efeitos, forms/state, caching, server actions, streaming, next/image/fonts, a11y de componentes) e PRs só para esses achados.
- **Depender do Context7.** Se o MCP não estiver disponível, a skill não pode parar. **Corte neste item:** fallback a links oficiais e doc de setup manual; o MCP é aceleração, não requisito.
- **Relatório morar só na branch, longe do PR.** Se o relatório for um arquivo que o PR não carrega na descrição, o humano não vê o "porquê" sem abrir o diff. **Corte neste item:** a descrição do PR É o relatório; os commits separados dão a navegação por fix; o relatório também pode viver como arquivo em `docs/` dentro do próprio PR quando fizer sentido, mas nunca no lugar da descrição.
- **Fixes que tocam donos travados.** **Corte neste item:** precheck read-only (como engineering-audit) + gate do repo; achado que esbarra em dono travado vira follow-up no relatório, não muda o PR.

## Questões em aberto (produto)

- Escopo do sweep: focado em anti-patterns React/Next (recomendado — complementar ao engineering-audit). Posicionado.
- Context7: declarar globalmente na máquina do dono, fora do git (precedente OPS89/OPS92); NÃO no repo Teqo (custo de contexto vs. outcome OPS92). Executor valida o mecanismo vigente (shape do bloco mcp remote) e documenta o passo manual. Posicionado.
- Autonomia: execução autônoma da skill, mas **entrega = PR final único ready sem auto-merge** (nada mergeia em `main` sem humano); a skill estabiliza o PR até CI green + mergeable + sem conflitos e termina. Divergência deliberada do modo autônomo do engineering-audit (que usa auto-merge): aqui o humano quer revisar antes de mesclar. Posicionado.
- Fontes: react.dev/learn, react.dev/reference, nextjs.org/docs e nextjs.org/learn como contexto da skill; versões reais (package.json) conferidas na implementação. Posicionado.
- Relatório: **a descrição do PR é o relatório** (o que foi feito + porquês, estado de cada fix, follow-ups), escrito ao final do ciclo antes de abrir o PR, e atualizado se o humano pedir mudanças. Posicionado.

## Referências

- GitHub Issue #901
- `.agents/skills/engineering-audit/SKILL.md`; `.agents/skills/agent-work-issue/SKILL.md`; `.agents/skills/work-issue/SKILL.md`
- `.agents/rules/engineering-standards.mdc`; `.agents/rules/codebase-map.mdc`
- `docs/AGENT-OPS.md`; `.github/workflows/agent-pr-ready-automerge.yml`
- `docs/plans/react-19-form-reset-campanha.md`
