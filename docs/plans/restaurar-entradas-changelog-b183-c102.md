# Restaurar entradas B183/C102 perdidas do docs/CHANGELOG-AGENTS.md

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-10
Issue: #<D8>
Priority: P3
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (docs)
Appetite: ~0,25 dia eng; sem migration/collection/Consent/UI

## Contexto (achado no rebase da B185)

O merge do C104 (PR #537) baseou-se num snapshot antigo do `docs/CHANGELOG-AGENTS.md` e **removeu do main** as entradas "Recently resolved" de **B183** (Issue #501, auto-zoom iOS) e **C102** (Issue #498, sidebar mobile staff). Verificado: `git show origin/main:docs/CHANGELOG-AGENTS.md` não contém B183 nem C102; ambas existem intactas em `8c79eddf:docs/CHANGELOG-AGENTS.md` (linhas 9 e 11), anteriores à perda.

## Objetivo e aceite

- As duas entradas (B183 e C102, datadas 2026-08-09) voltam ao `docs/CHANGELOG-AGENTS.md` no main, **na posição cronológica correta** (após D6, antes de B179 — mesma ordem relativa de `8c79eddf`), sem duplicar nem alterar o texto (fonte: `git show 8c79eddf:docs/CHANGELOG-AGENTS.md`).
- Nenhuma outra entrada é tocada (B185/C104/D6 e demais permanecem como estão).
- Sem Issue nova por entrada — uma única restauração.

## Abordagem

- **Opções:** A) restaurar as 2 entradas do histórico (recomendada); B) reescrever do zero (risco de drift do texto original); C) não restaurar (débito de contexto permanente para agentes futuros).
- **Recomendação: A** — o texto canônico está no git; restaurar é colar do commit fonte com verificação de diff.
- **Fonte exata:** `git show 8c79eddf:docs/CHANGELOG-AGENTS.md | sed -n '9p;11p'`.

## Fases verificáveis

1. `git show 8c79eddf:docs/CHANGELOG-AGENTS.md` → extrair as 2 linhas.
2. Inserir no `docs/CHANGELOG-AGENTS.md` atual (entre D6 e B179); `git diff` confirma: +2 linhas, nada removido.
3. Grep de sanidade: `grep -c "B183\|C102" docs/CHANGELOG-AGENTS.md` = 2; `grep -c "C104"` = 1 (sem duplicação); format:check; gate:fast.
4. Push → PR → merge.

## Rabbit holes / Não escopo

- Não criar guarda automatizada de presença de entradas (processo: revisar diff do CHANGELOG em merges que o toquem).
- Não restaurar outras entradas nem reorganizar o arquivo.
- Não reabrir B183/C102 como entregas (as Issues originais estão done/in-prod; só o registro de contexto sumiu).
