# Impl: OPS38 — Changelog-AGENTS truncado em main (restaurar do histórico)

Status: aprovado (gate humano 2026-08-10)
Atualizado em: 2026-08-10
Issue: #629
Intenção: body da Issue (sem plano linkado — body é a spec)
Appetite restante: ~0,25 dia eng (docs-only; exploração já consumida, execução é minutos)

## Leitura da intenção

- **Outcome:** `docs/CHANGELOG-AGENTS.md` volta ao main com TODAS as entradas (as ~113 clobberadas restauradas do histórico + as 4 escritas depois do truncamento re-anexadas), sem duplicar nem alterar texto (fonte: git); branches em voo que editam o arquivo coordenadas (OPS37 #624, OPS30 #615).
- **O que NÃO negociar:** texto canônico vindo do git (nunca redigitar); uma entrada por entrega; sem reordenar/reorganizar o arquivo; sem editar Issues in-progress.
- **O que reavaliar:** a letra da Issue ("re-anexar OPS35/OPS33/OPS34/OPS28") está **desatualizada/parcial** — OPS34 e OPS28 **nunca saíram** do arquivo (estão na base boa, byte-idênticas); as entradas realmente perdidas no processo são **OPS35, OPS33, B195 e D9** (escritas após o truncamento, presentes no arquivo truncado atual). A fonte única de verdade é o inventário git abaixo.

## Caracterização (inventário verificado no git)

- **Base boa (última íntegra):** `0b520fdb` (merge OPS28, PR #614) — **246 linhas, 120 entradas**. Byte-idêntica a `0047d263` (commit OPS28) e a `07479f17^` (pai do merge OPS35).
- **Truncamento 1 (o evento):** merge `07479f17` (OPS35, PR #621) — a branch OPS35 (`1f31d1b6`, baseada em `b4278f16` que tinha as 246 linhas) sobrescreveu o arquivo com uma cópia de **10 linhas** (só OPS28, OPS34, OPS35) na resolução de conflito → 246 → 10.
- **Truncamento 2:** merge `f460dac6` (OPS33, PR #623) — a branch OPS33 (`f0f5b73f`) tinha o arquivo **completo (248 linhas)**; a resolução do merge descartou o lado da branch e manteve a cópia truncada de main + entrada OPS33 → 12 linhas.
- **Depois:** B195 (merge `a2d02227`, PR #622) → 14 linhas; D9 (merge `48707d0b`, PR #630, atual main) → 18 linhas.
- **Estado atual de main (18 linhas, 7 entradas):** B195, OPS33, D9, B193, OPS28, OPS34, OPS35.
  - **B193/OPS28/OPS34** já estão na base boa **byte-idênticos** (md5 verificado) → NÃO duplicar.
  - **B195/OPS33/D9/OPS35** são as 4 entradas pós-truncamento a re-anexar (md5 verificados byte-idênticos às fontes de branch: OPS35 = `1f31d1b6`, OPS33 = `f0f5b73f`).
- **Ordem canônica do arquivo:** mais nova no topo (verificado: base boa começa com OPS28 #614, depois OPS34 #613 — ordem de merges). Ordem de merge das 4 re-anexadas (mais nova primeiro): **D9 (#630) → B195 (#622) → OPS33 (#623) → OPS35 (#621)**, acima da base boa (que começa em OPS28 #614).

## Abordagem recomendada

```mermaid
flowchart LR
  A[Base boa 0b520fdb: 246 linhas, 120 entradas] --> D[+4 entradas re-anexadas no topo<br/>D9, B195, OPS33, OPS35]
  B[4 entradas extraídas verbatim<br/>do main atual (md5 vs fontes OK)] --> D
  D --> E[diff vs 0b520fdb = só as 4 linhas novas]
  E --> F[grep sanidade + format:check + gate:fast]
  F --> G[commit + push + PR Closes #629]
  G --> H[Nota de coordenação no PR:<br/>OPS37 #624 e OPS30 #615 re-anexam<br/>sua entrada no topo após rebase]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — restauração verbatim da base boa `0b520fdb` + re-anexação das 4 entradas pós-truncamento no topo, na ordem de merge (D9, B195, OPS33, OPS35). Única opção que devolve o arquivo íntegro sem reordenar nem editar texto.
**Rejeitadas:**

- B — executar a letra da Issue ("re-anexar OPS35/OPS33/OPS34/OPS28"): OPS34/OPS28 já estão na base boa; re-anexá-los criaria duplicatas. A Issue foi escrita observando o arquivo truncado, não o inventário de merges.
- C — reconstruir por concatenação de todos os commits de changelog: reescrita completa com risco de drift e sem necessidade (a base boa `0b520fdb` já contém 120 entradas íntegras).
- D — adicionar guarda automatizada de presença de entradas no CHANGELOG: precedente D8 rejeitou ("processo = revisar diff em merges que o toquem"); ver Rabbit holes.

### Componentes / mudanças

- **`docs/CHANGELOG-AGENTS.md`** (único arquivo): `git show 0b520fdb:docs/CHANGELOG-AGENTS.md` → novo conteúdo base; extrair as 4 entradas do main atual com `grep -oP` e colar verbatim no topo (acima da OPS28), separadas por linha em branco, na ordem D9 → B195 → OPS33 → OPS35. Diff final vs `0b520fdb` = exatamente +4 linhas de entrada (+4 blanks).
- **`docs/plans/changelog-agents-truncado-ops35-ops33-impl.md`** (este plano, incluído no commit — padrão D8).
- **Migration:** sem migration.
- **Access / Consent:** não se aplica.
- **UI:** não se aplica (docs-only; CI `build-affected` pula o build).

## Fases verificáveis

1. **Fonte + colagem** — `git show 0b520fdb:docs/CHANGELOG-AGENTS.md > docs/CHANGELOG-AGENTS.md`; extrair as 4 entradas do arquivo atual com `grep` (linhas completas) e prependê-las verbatim.
2. **Verificação de integridade** — `git diff 0b520fdb -- docs/CHANGELOG-AGENTS.md` mostra **só** as 4 entradas + blanks; `grep -c '^\*\*Recently resolved'` = 124 (120 + 4); cada uma das 7 entradas do arquivo atual presente exatamente 1× (B193/OPS28/OPS34 via base boa, sem duplicata); nenhuma entrada da base boa ausente (diff não mostra remoções).
3. **Sanidade** — `pnpm format:check` (Prettier é a autoridade; `pnpm format` se necessário); `pnpm gate:fast`.
4. **Entrega** — commit + push; PR `--base main` com `Closes #629` + auto-merge; `gh pr checks --watch --required`. Nota de coordenação no PR (ver Riscos).

## Rabbit holes / Não escopo (engenharia)

- **Não criar guarda automatizada de presença de entradas** no CHANGELOG (precedente D8, `restaurar-entradas-changelog-b183-c102-impl.md`: "processo = revisar diff em merges que o toquem"). O processo recomendado (e repetido nesta entrega): revisar o diff do CHANGELOG em todo rebase/merge de branch que o toque — foi exatamente o que não aconteceu nos merges #621/#623.
- Não reordenar a seção nem reorganizar o arquivo.
- Não tocar branches de OPS37 (#624) e OPS30 (#615) — só coordenar via nota no PR.
- Não editar outras Issues in-progress; não criar Issue nova.

## Riscos e mitigação

- **Conflito com branches em voo (OPS37 #624, OPS30 #615)** — ambas editam o CHANGELOG sobre a versão truncada (OPS30 `8a459a11`: baseada em main pré-OPS28, 246 linhas + entrada OPS30; OPS37 `7c17d437`: baseada em main truncado pós-B195). Mitigação: nota no PR mandando rebasear e **re-anexar a própria entrada no topo do arquivo restaurado** (nunca resolver mantendo o lado da branch). Se um dos merges cair antes do meu, rebasear e re-aplicar a colagem (a colagem é idempotente por conteúdo).
- **Drift de transcrição na colagem** → colagem via `git show`/`grep` (nunca redigitar) + verificação por md5 e diff (fase 2).
- **gate:fast lento (docs-only muda nada)** → rodar mesmo assim (exigência da skill); esperado green em lint/typecheck/unit.

## Aceite de engenharia

- [ ] Aceite da Issue ainda coberto (arquivo íntegro restaurado; entradas pós-truncamento re-anexadas; texto canônico intacto)
- [ ] Invariantes AGENTS/engineering-standards (docs-only; sem migration/access/Consent/DB)
- [ ] Testes de domínio previstos: nenhum (docs); verificação por diff + grep + format:check + gate:fast
