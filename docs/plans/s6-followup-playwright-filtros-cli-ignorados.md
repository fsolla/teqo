# Impl: S6-FOLLOWUP — CLI Playwright ignora `--grep` e filtros posicionais; `test:e2e:affected` roda a suíte completa

Status: registrado
Atualizado em: 2026-08-18
Issue: #(a criar — S6-FOLLOWUP, depends S6)
Priority: P2
Appetite: ~0,5 dia

## Problema

O binário `playwright` 1.58.2 instalado no repo ignora **`--grep`/`-g` e filtros posicionais de arquivo**:

- `pnpm test:e2e frontend -g "static grids on desktop"` → roda 164 testes (a suíte toda), não 2.
- Reproduzido com config mínima no mesmo binário (`--grep alpha` roda o teste `beta`; posicional `a.spec.ts` idem).
- `--list frontend` lista todos os projetos; `--project=frontend --no-deps` **funciona** (único filtro que respeita).

## Consequência

`pnpm test:e2e:affected` (`scripts/run-e2e-affected.mjs`) passa paths completos (`tests/e2e/<name>.e2e.spec.ts`) como posicionais → hoje roda a **suíte completa silenciosamente** em vez dos specs afetados. CI não é afetado (usa `--shard`, caminho diferente). Iteração local depende de `--project=<família> --no-deps`.

## Correção proposta (a validar no gate)

1. **Diagnóstico da causa**: inspecionar por que `cliGrep`/`cliArgs` não chegam ao runner (o código em `lib/program.js`/`loadUtils.js` está correto — hipótese: parsing do commander consumindo os args, ou bug do build 1.58.2). Verificar se há fix upstream (changelog/issue do Playwright) e se um pin/bump resolve.
2. **Fixo mínimo no repo** (independente do diagnóstico):
   - `run-e2e-affected.mjs` deixa de depender de posicional: família → `--project=<família>` (mapa spec→projeto), `--no-deps` quando o gate não precisa da cadeia; ou gera o comando por arquivo se um mecanismo alternativo funcionar (`--test-list` investigado: também não filtrou no repro — descartado sem fix do binário).
   - Documentar no AGENTS.md/playwright.config.ts o contorno `--project=X --no-deps` para iteração local.
3. **Teste**: unit do `run-e2e-affected` (invocation args) + smoke manual do comando gerado (contagem de testes).

## Não escopo

- Não mudar os specs nem o CI (`--shard` funciona).
- Não trocar o runner (Playwright é o framework do repo).

## Aceite

- `pnpm test:e2e:affected` roda só os specs afetados (contagem verificável).
- Comando de iteração local documentado.
