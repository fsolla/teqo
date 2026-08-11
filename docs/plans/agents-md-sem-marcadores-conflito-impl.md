# Impl: AGENTS.md em main com marcadores de conflito commitados (região Per-worktree environments — merge do OPS33)

Status: aprovado
Atualizado em: 2026-08-11
Issue: #689
Intenção: sem plano de intenção — o body da Issue é a spec (chore pré-existente descoberto no gate do OPS40)
Appetite restante: herdado (chore P2, docs-only — appetite curto)

## Leitura da intenção

- **Outcome:** origin/main's `AGENTS.md` carrega ZERO artefatos de conflito (marcadores, lados duplicados); o bullet "Per-worktree environments" existe exatamente uma vez com o texto superset (OPS28 + OPS31 + OPS33). Verificação da Issue: `git show origin/main:AGENTS.md | grep -n '<<<<<<<'` → vazio.
- **O que NÃO negociar:** nada de produto aqui; frozen do repo: migrations (não tocadas), código de runtime (não tocado), histórico de merges (não reescrito). Escopo docs + guardrail de CI.
- **O que reavaliar:** a hipótese da Issue ("manter o lado `9e18bec8`, descartar o HEAD") foi **validada por diff completo** — ver evidência abaixo. O rótulo do marcador é enganoso (o lado "theirs" não é o blob cru `9e18bec8:AGENTS.md`, e sim o texto de main pós-OPS28/OPS31 + adições OPS33), mas a decisão de conteúdo é a mesma.

## Evidência (coletada no Plan mode)

- Conflito presente em origin/main == HEAD local (`1ed585a0`): linhas 37–40 do `AGENTS.md`:
  - L37: `  <<<<<<< HEAD` (indentado 2 espaços — por isso a verificação coluna-0 da Issue só achou 1 linha)
  - L38: lado HEAD = bullet pré-OPS33 (contém OPS28 + OPS31, sem claim) — com artefato `- # ` (hífen+hash) do resolve mal feito
  - L39: lado "theirs" = superset (OPS28 + OPS31 + OPS33: sentença de claim, `--issue N`, prompt citado, "(the claim still happens)")
  - L40: `  > > > > > > > 9e18bec8 (OPS33: …)` (marcador de fechamento com espaços + indentado; o `=======` do conflito original foi removido no commit)
- **Superset provado:** diff de L38 (normalizada `- # `) vs L39 (normalizada `- `) → **única** diferença são as sentenças OPS33 em L39. Manter L39 é perda zero.
- **Único arquivo afetado:** scan whitespace-tolerant de todos os arquivos trackeados em origin/main (`^\s*<<<<<<< `, `^\s*>>>>>>> `) → só `AGENTS.md`.
- **Origem:** o commit OPS33 f0f5b73f entrou com o arquivo já conflitado (o resolve do conflito OPS33×OPS28/OPS31 foi commitado com marcadores); OPS37 (7c17d437) herdou o estado sujo (branch cortada depois, não tocou a região).

## Abordagem recomendada

```mermaid
flowchart LR
  A[Editar AGENTS.md: remover L37+L38+L40] --> B[git diff: só 3 linhas removidas]
  B --> C[Guardrail: spec codebaseConventions]
  C --> D[CHANGELOG-AGENTS: entrada OPS41]
  D --> E[Gates + PR auto-merge]
```

**Opções consideradas:** A (edição direta do working tree) | B (checkout do blob histórico `9e18bec8:AGENTS.md` e re-aplicar) | C (manter lado HEAD e re-adicionar texto OPS33 à mão)
**Recomendação:** **A** — a região conflitada é a única diferença entre o working tree e qualquer versão histórica; edição de 3 linhas com diff verificável.
**Rejeitadas:** B (o blob `9e18bec8` é um commit irmão do OPS33 fora da história de main — difere de L39 em OPS28/OPS31 e faltaria re-aplicar o merge; mais risco de regressão que o valor de "fonte canônica"); C (reescrever texto OPS33 à mão reintroduz risco de erro de cópia).

### Componentes / mudanças

- **`AGENTS.md`** (raiz): remover L37 (marcador abertura), L38 (lado HEAD pré-OPS33 com artefato `- # `), L40 (marcador fechamento espaçado). Manter L39 (superset). Resultado: bullet único com o texto OPS33 completo.
- **`tests/unit/codebaseConventions.unit.spec.ts`**: novo describe `"no conflict markers in committed files"` — o owner natural dos guards programáticos de convenção (o artefato entrou em main **duas** vezes: esta e a janela que o OPS38 restaurou). Varre o working tree (exclui `.git`, `node_modules`, `.next`, `data/`), falha em `^\s*<<<<<<< `, `^\s*>>>>>>> ` e na forma corrompida commitada `^\s*(> ){7}` (o `=======` original foi removido no artefato e é ambíguo com setext — não entra na regra). Allowlist-style para caso legítimo futuro (prosa que cite marcadores), mesmo padrão do `banned campaign terminology`.
- **Migration:** sem migration (nenhum schema).
- **Access / Consent:** nenhum.
- **UI:** nenhuma.

## Fases verificáveis

1. **Fix do AGENTS.md** — remover as 3 linhas; verificar: `git diff` mostra exatamente −3 linhas (sem tocar no resto), `grep -n '<<<<<<<' AGENTS.md` vazio, região re-renderiza como um bullet.
2. **Guardrail + CHANGELOG** — describe novo na spec; entrada curta "Recently resolved (2026-08-11): OPS41 …" em `docs/CHANGELOG-AGENTS.md` (padrão das entradas OPS36/OPS37).
3. **Gates** — `pnpm gate:fast` (lint + typecheck + test:unit — a spec nova roda aqui), `pnpm format:check` (Prettier), `pnpm exec knip`, `pnpm check:cycles`. Int/e2e não se aplicam (zero `src/`, zero runtime). Push via `pnpm push` → PR em main com auto-merge.

## Rabbit holes / Não escopo (engenharia)

- Reconstruir o histórico de merges OPS33/OPS37 (dois commits homônimos `9e18bec8`/`f0f5b73f`, resolução confusa) — história frozen, irrelevante para o fix.
- Caçar `=======` como separador de conflito — ambíguo com setext heading; o vetor real (git commitando arquivo conflitado) sempre carrega `<<<<<<<`/`>>>>>>>`.
- Regra de pre-commit hook git — o guardrail em vitest roda em CI e local (`pnpm test`), suficiente.

## Riscos e mitigação

- **Perda de conteúdo na resolução:** mitigado — superset provado por diff e verificação pós-fix (diff = −3 linhas).
- **Reincidência (3ª vez):** mitigado pelo guardrail — qualquer merge futuro que commite marcadores falha no `test:unit` do CI.
- **Falso positivo do guardrail em prosa legítima:** mitigado — allowlist no padrão da spec de termos banidos.

## Aceite de engenharia

- [x] Aceite de produto da intenção coberto (zero marcadores em origin/main; bullet único superset)
- [x] Invariantes AGENTS/engineering-standards (docs-only; migrations/histórico intocados)
- [x] Guardrail de regressão testado (o próprio teste falharia no estado atual — validar rodando contra o arquivo sujo antes do fix)
