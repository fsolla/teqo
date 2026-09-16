# OPS: knip carrega o payload.config.ts com erro (importMap commitado) e roda com análise degradada

Status: rascunho
Atualizado em: 2026-09-16
Issue: a registrar — OPS124
Priority: P3
Impeccable: A — sem UI
Appetite: ~30 min eng; sem schema, sem deploy

## Intenção

`pnpm knip` imprime `ERROR: Error loading src/payload.config.ts (This module cannot be imported from a Client Component module. It should only be used from a Server Component.)` e **sai com código 0** — acontece no CI (run `35099887216`) e local, sempre que `src/app/(payload)/admin/importMap.js` está no working tree. Esse arquivo está **commitado** (apesar de `knip.json`/OPS99/`.gitignore` o tratarem como artefato de build), importa componentes client e faz o knip carregar `payload.config.ts`; o `server-only` resolve para o entry que lança sob as condições padrão (não `react-server`), e a regra `paths.server-only` do `knip.json` não está sendo aplicada ao specifier de pacote. Sem o arquivo, o knip completa (com 2 unresolved imports esperados de `[[...segments]]`). Por sair 0, o gate fica verde com o knip **degradado em silêncio**: um ERROR que ninguém lê e uma análise possivelmente incompleta (o entry falhou ao carregar).

Correção de rumo (2026-09-16): durante o C178 eu supus que isso quebrava `pnpm push`/`gate:ci` local; na prática o exit é 0 e o push não é afetado. O problema real é o erro silencioso/análise degradada.

## Fases verificáveis

1. **Diagnóstico + fix** — confirmar a causa (mapping `paths.server-only` não aplicado vs. `importMap.js` commitado) e corrigir: (a) fazer o mapeamento funcionar (ou trocar por `compilerOptions.paths`/condição `react-server` no knip) e/ou (b) destrackear o `importMap.js` (OPS99 diz que não deveria estar commitado — foi commitado em `fea6c645`/`b03cec7c` para corrigir o admin em branco). Provar: `pnpm knip` sem a linha `Error loading src/payload.config.ts` e com a análise completa (um export morto de teste é detectado).
2. **Gate** — `pnpm gate:fast` + `pnpm push`; sem tocar no pipeline de CI além do necessário.

## Já resolvido no simplify/critique (não reabrir)

- Confirmado que o comportamento é idêntico no CI e local (o `importMap.js` está commitado, então o CI também vê o arquivo) e que o exit code é 0 — não é um gate quebrado.

## Explicitamente fora

- Mudar a ordem do CI (knip antes do build já é o caso; e o build não é o gerador do arquivo no repo).
- Limpar outros pontos do `knip.json`.

## Self-score (decisão)

4/5 — fix barato e reversível, causa-raiz nomeada (com correção de rumo registrada), prova objetiva (o ERROR some + export morto detectado), sem risco de produção.
