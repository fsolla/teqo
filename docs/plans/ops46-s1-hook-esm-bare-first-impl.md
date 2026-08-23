# OPS46-S1 — hook ESM mapeia next/cache incondicionalmente (impl)

Fonte: issue #789 (body = spec). Débito capturado na revisão estrutural do OPS46 (PR #787).

## Problema

`tests/helpers/e2eEsmResolve.mjs` remapeia `next/cache` → `next/cache.js` **sem tentar a
resolução bare primeiro**. Quando o `next` publicar um `exports` map (major bump), o remap
pode mascarar um erro de resolução real (fail-loud vira fail-silent).

## Abordagem recomendada

No branch `specifier === 'next/cache'`:

1. `await nextResolve(specifier, context)` primeiro.
2. Só no rejeito com `error.code === 'ERR_MODULE_NOT_FOUND'`, remapear para
   `next/cache.js` (comportamento atual do fallback).
3. Qualquer outro erro propaga — fail-loud preservado.

Branch `react-server` (injeção de conditions) intocado: o issue só cita o remap, e a injeção
não mascarava erro (apenas adiciona condição, espelhando `--conditions=react-server`).

## Fases

1. Editar `tests/helpers/e2eEsmResolve.mjs` (~5 linhas; hook já é `async`, então `await`
   dentro do try/catch é válido e necessário para capturar a rejeição).
2. Spec unit `tests/unit/e2eEsmResolve.unit.spec.ts` (padrão do repo: vitest importa `.mjs`
   direto, ex. `agentPoolModels.unit.spec.ts`): três casos com `nextResolve` mockado —
   bare-ok não remapeia; bare `ERR_MODULE_NOT_FOUND` remapeia para `next/cache.js`; erro de
   outro código propaga. O repo já testa helpers `.mjs` dessa forma; a regressão
   fail-loud→fail-silent é exatamente o tipo que merece pin.
3. `pnpm gate:fast` (lint + typecheck + unit).
4. Sanity opcional (OPS72, discricionário): `pnpm exec playwright test --list` para provar
   que a coleta de testes segue funcionando com o hook carregado.

## Alternativas rejeitadas

- **Remover o remap de vez**: quebraria `playwright test` bare (VS Code extension, `--list`,
  ad-hoc) até o next publicar exports map — a razão de existir do hook (OPS46) continuaria
  pendente.
- **Checar `error.message` por `next/cache`**: spec do issue pede só `ERR_MODULE_NOT_FOUND`;
  o branch já é escopado ao specifier, e o fallback propaga erros próprios. Menos código.

## Riscos

- **Catch largo (baixo)**: um `ERR_MODULE_NOT_FOUND` de import transitivo dentro da
  resolução de `next/cache` dispararia o remap — mas só dentro do branch `next/cache`, e o
  fallback `next/cache.js` propaga seus próprios erros. Mascaramento residual mínimo,
  dentro do spec.
- **Esquecer `await` no try (nulo)**: sem `await` o try não captura rejeição — a spec
  unit cobre o caso.

## Gatilho de reavaliação

Bump major do `next`: quando o exports map existir, a resolução bare passa e o fallback fica
morto — o remap pode então ser removido.
