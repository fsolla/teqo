# Modelos das flags do worktree: `--zen` → Space Bunny Free e `--free` → Space Bunny Alpha

Status: rascunho
Atualizado em: 2026-09-25
Issue: #1342
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5 dia, uma troca values-only no mapa fixo
Responsável: —

## Intenção

Os atalhos de modelo do provisionamento de worktree devem acompanhar os modelos escolhidos para a equipe: Space Bunny Free pelo OpenCode Zen e Space Bunny Alpha pelo OpenRouter. A mudança afeta duas entradas do mesmo mapa, sem alterar o fluxo de seleção nem o contrato dos worktrees.

## Persona e fluxo

- **Persona / contexto:** pessoa desenvolvedora ou operadora que cria um worktree e escolhe o modelo da sessão ao digitar a flag.
- **Job principal:** usar `--zen` ou `--free` e abrir a sessão no modelo correspondente sem decorar IDs ou consultar o catálogo antes.
- **Fluxo desejado:** escolher `next`, `plan`, `new` ou `fix`, informar uma das flags e reconhecer no modelo da sessão o valor fixo associado.
- **Anti-goals de produto:** não criar seletor, flag, alias, fallback ou mapa novo; não revisar as outras opções do catálogo; não persistir preferência.

## Objetivo e aceite

- `pnpm worktree next|plan|new|fix --zen` abre a sessão em Space Bunny Free pelo OpenCode Zen.
- `pnpm worktree next|plan|new|fix --free` abre a sessão em Space Bunny Alpha pelo OpenRouter.
- Código, ajuda, comandos, skills e pin unitário que exibem o mapa chegam à mesma associação, sem contrato divergente.
- O preset sem flag, as demais flags, o fail-high para flags múltiplas e a variante `max` permanecem inalterados.
- Planos e changelogs antigos continuam como registro histórico e não são reescritos.

## Dados (intenção)

- **Vou apresentar dados?** Não. É uma troca de configuração, sem métrica ou visualização.
- **Decisões desbloqueadas:** a pessoa confia que cada flag abre o modelo que o nome anuncia.
- **Forma:** N/A. O formato técnico fica para o plano de implementação.

## Dados da decisão (literais)

| Flag     | Valor atual                                | Valor novo                             |
| -------- | ------------------------------------------ | -------------------------------------- |
| `--zen`  | `opencode/muse-spark-1.3-contributor-free` | `opencode/space-bunny-free`            |
| `--free` | `openrouter/openrouter/free`               | `openrouter/stealth/space-bunny-alpha` |

- `--zen` deve mostrar Space Bunny Free do provider OpenCode Zen (`opencode`).
- `--free` deve mostrar Space Bunny Alpha do provider OpenRouter (`openrouter`).
- Os dois modelos aceitam a variante `max`; `MODEL_VARIANT` continua sendo `max`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs`, `scripts/worktree.mjs`, `.agents/shell/worktree.sh`, `.opencode/commands/worktree.md`, `.agents/skills/worktree-next-issue/SKILL.md` e `tests/unit/worktree.unit.spec.ts`.
- **Precedente a olhar:** OPS112 trocou `--zen` no mesmo mapa; OPS100 introduziu `--free`; OPS127 aplica `max` à sessão e permanece ortogonal.
- **Risco de acoplamento:** `WORKTREE_MODEL_MAP` é o owner do contrato. Alterações paralelas, aliases ou exceções por purpose criariam dois caminhos para a mesma escolha.

## Dependências

- Nenhuma.

## Fora de escopo

- Mudar o preset sem flag, o parser, a precedência ou o guardrail at-most-one.
- Revisar `cheap`, `pro`, `go`, `alibaba` ou `glm`, adicionar aliases ou configurar fallback.
- Alterar `MODEL_VARIANT`, o ciclo de sessões ou a forma como o modelo é transportado.
- Tocar schema, migration, Payload, Consent, URL pública ou UI.
- Editar planos e changelogs históricos.

## Rabbit holes de produto

- **Criar um mapa paralelo.** Isso faria duas fontes dizerem qual modelo cada flag abre. **Corte:** manter o mapa existente como único owner.
- **Adicionar aliases para os modelos antigos.** O pedido é uma troca direta, não uma política de compatibilidade. **Corte:** os valores antigos saem sem alias.
- **Reescrever o cardápio inteiro.** Isso mistura a troca pedida com outra decisão sobre o catálogo. **Corte:** mudar somente `zen` e `free`.

## Questões em aberto (produto)

- Nenhuma. Os providers, os nomes e os IDs foram definidos no pedido e conferidos no catálogo local.

## Referências

- `scripts/lib/worktree.mjs:55-81` (owner do mapa e da resolução)
- `scripts/worktree.mjs:22-30` e `scripts/worktree.mjs:992-996` (docblock e ajuda derivada)
- `.agents/shell/worktree.sh:23-28` (documentação viva do launcher)
- `.opencode/commands/worktree.md:7` (comando `/worktree`)
- `.agents/skills/worktree-next-issue/SKILL.md:32-34` (contrato do lançamento)
- `tests/unit/worktree.unit.spec.ts:469-523` (pin do mapa e das flags)
- `docs/changelog/2026-09-15-ops112.md` (precedente de `--zen`)
- `docs/changelog/2026-08-27-ops100.md` (precedente de `--free`)
- `AGENTS.md` e `AGENTS-infra.md` (convenções do projeto)
- Design UI: N/A, sem UI.

## Self-score (shaping)

1. **Fatia:** 5/5. As duas flags formam um único outcome verificável.
2. **Apetite:** 5/5. A troca cabe em ~0,5 dia sem ampliar o mecanismo.
3. **Persona e aceite:** 5/5. Quem usa, o que precisa alcançar e as garantias preservadas estão explícitos.
4. **Direção no codebase:** 5/5. Os caminhos são hipóteses para a implementação, não um desenho técnico fechado.
5. **Decisões de engenharia:** 5/5. O plano fixa apenas intenção, literais, guardrails e limites.

**Total: 5/5.**
