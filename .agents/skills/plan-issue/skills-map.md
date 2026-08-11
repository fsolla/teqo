# Skills de planejamento ↔ plan-issue

Inventário das skills de **planejamento de desenvolvimento de software** disponíveis no repo (`.agents/skills/` + espelhos `.claude/skills/`), e o que o `plan-issue` **absorve em silêncio** vs. o que fica fora (outra skill / `work-issue`).

**Regra:** `plan-issue` é o shaping + registro Teqo (plano em `docs/plans/` + Issue). Não vira tour das skills abaixo. Aplique princípios; não abra jornadas guiadas.

## Pipeline genérico (referência)

De `using-agent-skills` — só para orientar o *handoff*, não para reexecutar aqui:

```
interview-me → idea-refine → spec-driven → planning-and-task-breakdown
  → (implement: incremental + source-driven + doubt + TDD …)
```

No Teqo: **idea-refine / interview** antes se vago; **spec + plan + tasks** = este skill (um artefato); **implement+** = `work-issue`.

## Mapa

| Skill | O que emprestar ao plan-issue | NÃO fazer no plan-issue |
| ----- | ----------------------------- | ----------------------- |
| **idea-refine** | Se a ideia for vaga: HMW + 3–5 sharpening Qs + Not Doing + assumptions a validar **antes** do plano. Gate: “ainda não dá para registrar”. | Sessão divergente completa (5–8 variações); salvar em `docs/ideas/` |
| **interview-me** | Só se o usuário não sabe o que quer (rotear). | Extrair requirements longos aqui |
| **spec-driven-development** | Premissas explícitas; objetivos como critérios de aceite testáveis; Boundaries Always/Ask/Never Teqo; reframing de pedido vago → sucesso mensurável | Spec de 6 seções / `tasks/plan.md`; fase IMPLEMENT |
| **planning-and-task-breakdown** | Fatias **verticais**; fases S/M com aceite + verificação; grafo de deps; high-risk cedo; XL → bipartir `{id}-plan`/`{id}-exec` | `tasks/todo.md`; checkpoint humano entre cada fase na implementação |
| **incremental-implementation** | Tracer bullet = 1ª fase; risco-primeiro se incerteza; cada fase deixa o sistema compilável | Ciclo implement→test→commit (é `work-issue`) |
| **doubt-driven-development** | Em decisão **cara** (schema/access/Consent/URL imutável): CLAIM curto + adversarial self-check (ou Task) antes de travar | Doubt em cada bullet; cross-model CLI; doubt pós-código |
| **source-driven-development** | Se a Abordagem depende de API Payload/Next/WebAuthn: anotar “verificar docs na implementação” + versão em `package.json` | Fetch de docs e citações no plano |
| **documentation-and-adrs** | Decisões travadas = ADR-lite do item (contexto + rejeitadas). Repo-wide → apontar follow-up em `docs/` | Criar `docs/decisions/` novo sem precedente |
| **design-code-architecture** | Já destilado em [decision-quality.md](decision-quality.md) (caro/barato, depth, appetite) | Jornada de 8 fases / `ARCHITECTURE.md` |
| **37signals-way** | Appetite, rabbit holes, no-gos (= Não escopo), shaped pitch | Betting table / cool-down / abolir backlog GitHub |
| **continuous-discovery** / **mom-test** / **jobs-to-be-done** | Só se o item depende de evidência de usuário ainda inexistente → Issue `blocked` ou defer+gatilho | Rodar discovery / OST no fluxo de registro |
| **domain-driven-design** / **clean-architecture** / **software-design-philosophy** | Vocabulário, Dependency Rule, deep modules — via decision-quality sob demanda | Modelar bounded contexts do zero num item de lista |
| **test-driven-development** | Na fase: “Verify: pin unit/int …” | RED/GREEN no planning |
| **api-and-interface-design** | Contratos de action/URL no Abordagem quando há API nova | Desenhar OpenAPI completo |
| **context-engineering** | Plano cita arquivos reais (não dump do repo) | Carregar contexto de implementação aqui |

## Skills de build/review (fora do escopo de planejamento)

`frontend-ui-engineering`, `security-and-hardening`, `performance-optimization`, `code-review-and-quality`, `code-simplification`, `observability-and-instrumentation`, `shipping-and-launch`, `ci-cd-and-automation`, `git-workflow-and-versioning`, `deprecation-and-migration`, `debugging-and-error-recovery`, `browser-testing-with-devtools` — entram em `work-issue` / gates do repo, não no registro da Issue.

**Exceção de superfície:** o **rascunho UI/UX do gate** — HTML+Tailwind renderizado em PNG (`pnpm ui-draft:render`), [ui-draft-html.md](ui-draft-html.md) — é usado no `plan-issue` só quando o item muda UI. Não é implementação de `/campanha` nem substituto de Impeccable.

## Precedência quando conflita

1. Convenções Teqo (`AGENTS.md`, access, migrations, Consent fail-closed)  
2. Este skill + [decision-quality.md](decision-quality.md) + [data-presentation.md](data-presentation.md)  
3. Princípios das skills acima  
4. Templates genéricos (`tasks/plan.md`, etc.) — **não** usamos; o artefato canônico é `docs/plans/<slug>.md`
