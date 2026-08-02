# Template de plano de intenção (`docs/plans/<slug>.md`)

Plano de **produto/intenção** — o que o humano quer, para quem, e como saber que deu certo. **Não** é plano de engenharia: quem executa (`work-issue` / `agent-work-issue`) cria o `docs/plans/<slug>-impl.md` depois, com liberdade de reavaliar a abordagem técnica.

Shaping: [shaping.md](shaping.md). Dados (só decisão de produto): [data-presentation.md](data-presentation.md).

````markdown
# <Título do item em pt-BR>

Status: rascunho
Atualizado em: <YYYY-MM-DD>
Issue: #<N> (após `pnpm agent:register`; senão "—")
Priority: <P0 | P1 | P2 | P3>
Model: <slug model-selection>
Impeccable: <A | B | C | D> — <N/A sem UI | encaixe em tela X | fluxo novo em Y>
Appetite: <ex.: ~0,5–1 dia eng; um outcome verificável>
Responsável: —

## Intenção

<Por que isso existe agora. Problema ou oportunidade em prosa curta — voz do humano, não da stack.>

## Persona e fluxo

- **Persona / contexto:** <quem usa, onde (campo/mesa), estado de espírito>
- **Job principal:** <uma frase — o que precisa conseguir>
- **Fluxo desejado:** <passos em linguagem de usuário; o que vê / faz / decide>
- **Anti-goals de produto:** <o que esta entrega NÃO deve virar (ex.: spreadsheet mode, segundo cadastro de pessoa)>

### Esboço de fluxo (B/C/D)

<!-- ASCII de jornada, não layout de implementação. Omitir se A ou só controle isolado. -->

\```text
[início] → … → [outcome]
\```

## Objetivo e aceite

- <Outcome verificável em linguagem de produto, um por bullet>
- <Guardrails de produto que valem para o item: ex. "liderança não vê estimativas", "fail-closed se faltar consentimento" — sem nomear migration/collection>

## Dados (intenção)

<!-- Sempre presente. Sem métrica: "Dados: N/A — <por quê>". -->

- **Vou apresentar dados?** <Não | Sim, só aggregate para outro consumidor | Sim, superfície neste item>
- **Decisões desbloqueadas:** <ator + escolha; uma por bullet. Sem decisão nomeável → corte vaidade.>
- **Forma:** *adiada ao plano de implementação* — aqui só restrições de produto (ex.: "sem % estadual absoluto", "leitura relativa/local").

## Direção no codebase (hipótese)

<!-- Soft. Revisável. Sem signatures, sem "criar collection X", sem mermaid de solução. -->

- **Áreas prováveis:** <rotas `/campanha/…`, pastas `src/components/campaign/<domínio>/`, `src/utilities/<domínio>/`, `src/lib/…`>
- **Precedente a olhar:** <plano/Issue/arquivo análogo, se houver>
- **Risco de acoplamento:** <uma linha — o que o executor deve respeitar (ex.: leader lockdown, lista B18)>

## Dependências

- <IDs duros/suaves ou "Nenhuma">

## Fora de escopo

- <Exclusões de produto, com destino (outro ID/plano) quando houver>

## Rabbit holes de produto

- **<Risco>.** Se alguém “só completar”: <explosão de escopo>. **Corte neste item:** <…>.

## Questões em aberto (produto)

<!-- Opções + Recomendação de produto. Nunca pergunta sem posição. -->

- **<Pergunta>?** **Opções:** A | B | C. **Recomendação:** <…>. _(assumido — validar com produto)_ quando couber.

## Referências

- GitHub Issue #<N>
- <arquivos/rotas úteis para o executor abrir primeiro — como pista, não contrato>
- `AGENTS.md` / `docs/ARCHITECTURE.md` — só se o item toca convenção já travada no repo
````

Notas:

- Alvo: ~60–100 linhas. Mais que isso costuma significar engenharia vazando para a intenção.
- Classe **A:** `Impeccable: A — N/A`; omita esboço de fluxo.
- Não rode `/impeccable` aqui.
- Self-score shaping ≥4/5 antes de gravar.
