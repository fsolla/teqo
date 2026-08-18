# Impl: S6-FOLLOWUP — CLI Playwright 1.58.2 ignora `-g` e posicionais sem `--`; `test:e2e:affected` roda a suíte completa

Status: registrado
Atualizado em: 2026-08-18
Issue: #58 (S6-FOLLOWUP, depends S6)
Priority: P2
Appetite: ~0,5 dia

## Problema (evidência empírica, binário do repo `playwright@1.58.2`)

| Invocação                                                             | Resultado                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `playwright test --config=X frontend -g "grade"`                      | **164 testes** (filtros ignorados)                                                               |
| `playwright test --config=X a.spec.ts` (repro mínimo)                 | **todos** os testes rodam (posicional ignorado)                                                  |
| `playwright test --config=X --grep alpha` (repro)                     | **todos** os testes rodam (grep ignorado)                                                        |
| `playwright test --config=X -- tests/e2e/frontend.e2e.spec.ts`        | **11 testes** (filtro funciona!) — gate:ci usa esta forma                                        |
| `pnpm test:e2e:affected -- tests/e2e/campaignHomeActions.e2e.spec.ts` | **173 testes** — `run-e2e-affected.mjs` passa os paths SEM `--` → suíte completa silenciosamente |

Padrão: (1) posicionais só filtram quando precedidos de `--`; (2) a presença de `-g`/`--grep` quebra a filtragem inteira (até o posicional companheiro); (3) `--list` não respeita nenhum filtro. Reproduzido em config mínima com o mesmo binário (não é do repo).

## Correção

1. **`scripts/run-e2e-affected.mjs`** (fix determinístico): inserir `--` antes dos paths — `playwrightArgs.push('--', ...specs)`. Verificação: contagem de testes do comando gerado (unit do invocation args + smoke `--list`-less com contagem).
2. **`-g`**: investigar causa no commander/playwright (upgrade/pin pode resolver — verificar changelog upstream 1.58.x/1.59); enquanto isso, documentar em `playwright.config.ts`/AGENTS.md: título-filtro → `--project=<família> --no-deps` (único mecanismo que respeita filtro hoje).
3. **`--list`**: pino de expectativa nos docs (lista sem filtros é ruído).

## Não escopo

- Não mudar specs, CI (`--shard` funciona) nem trocar de runner.
- Não tocar o `gate:ci` (já usa a forma `--` que funciona).

## Aceite

- `pnpm test:e2e:affected` roda só os specs afetados (contagem verificada).
- Comandos de iteração documentados; se `-g` seguir quebrado após investigação, workaround registrado.
