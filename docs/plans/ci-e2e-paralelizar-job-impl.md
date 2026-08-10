# Impl: CI e2e — paralelizar o job (cadeia serial só em dev + sharding do e2e)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #599
Intenção: docs/plans/ci-e2e-paralelizar-job.md
Appetite restante: herdado (~1 dia eng; entrega é ~5 arquivos, sem migration/UI)

## Leitura da intenção

- **Outcome:** job `e2e` do `ci.yml` cai de ~10 min para ≤ ~6 min de wall time
  (mesmo conjunto de testes, mesma confiança); cadeia de projetos + prewarm do
  `setup` continuam existindo **só em dev**; workers do CI explícitos, default
  local intocado; sem classe nova de flake.
- **O que NÃO negociar:** nenhuma spec de produto removida/alterada (campaign/
  frontend/admin); dev local (`pnpm test:e2e` sem CI/E2E_PROD) idêntico; main
  e PR full rodam a suite completa; cobertura inalterada.
- **O que reavaliar:** a hipótese listava `scripts/gate-ci.mjs` e
  `scripts/run-e2e-affected.mjs` como áreas. **Não serão tocados**: ambos
  delegam a `pnpm test:e2e`, e a cadeia condicional mora no config — a
  paridade local com CI vem de graça (gate-ci já seta `CI=1 E2E_PROD=1` → modo
  prod → sem cadeia). Colocar sharding nesses scripts duplicaria política de
  CI na máquina local sem ganho (shard é paralelismo de _runners_ de CI).

### Medição de base (real, run 31412425553 do ci.yml, 2026-08-10)

Job e2e completo: **435 s** (17:07:16 → 17:14:31). Decomposição por step:

| Fase                               | Tempo     |
| ---------------------------------- | --------- |
| setup/checkout/tooling             | ~17 s     |
| pnpm install (cache)               | 5 s       |
| install playwright chromium        | 19 s      |
| migrate + seed:minimal             | 13 s      |
| **build (`.next/e2e`)**            | **172 s** |
| **testes (suite full, 2 workers)** | **196 s** |

(A intenção citava 617–635 s — runs mais lentos do mesmo dia; a decomposição
acima é a mais recente e é a linha de base usada aqui.)

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph ci.yml[ci.yml (main) — e2e sempre full]
    E2E1[e2e shard 1<br/>build + test --shard=1/2] --> C1[checks]
    E2E2[e2e shard 2<br/>build + test --shard=2/2] --> C1
  end
  subgraph ci-pr.yml[ci-pr.yml (PR)]
    S[scope job<br/>e2e_mode + e2e_matrix] --> P1[e2e full: matrix [1,2]<br/>--shard=N/2]
    S --> P2[e2e selected: matrix [1]<br/>specs sem shard]
    P1 --> CP[checks]
    P2 --> CP
  end
  subgraph config[playwright.config.ts]
    C[isProdMode = CI ou E2E_PROD=1<br/>→ sem projeto setup, sem dependencies<br/>dev → cadeia + prewarm atuais]
  end
  P1 -. roda sobre .-> C
  E2E1 -. roda sobre .-> C
```

**Opções consideradas:** A) build por shard (cada runner compila) · B) job de
build + artefato `.next/e2e` compartilhado · C) 3 shards já de início
**Recomendação:** **A com 2 shards** — porque a medição real decide: por shard
= 54 s (fixo) + 172 s (build) + ~98 s (196/2) ≈ **324 s ≈ 5,4 min**; e com a
cadeia removida os testes encolhem mais (~120–150 s full → ~75 s por shard),
chegando a ~5 min. O caminho crítico do pipeline (max entre e2e/build/int)
passa de 435 s para ~300–330 s.
**Rejeitadas:** **B** porque os shards só podem começar depois do build
terminar: wall = build 172 + upload + download + teste/2 ≫ A (a transferência
de um `.next` inteiro supera o build paralelo de cada shard); o `build` job do
ci.yml **não** serve (compila `.next` default e o servidor e2e usa
`.next/e2e` via `NEXT_DIST_DIR` — mudar isso é mexer no contrato do webServer
para nada). **C** porque o ganho é marginal (~30 s a mais) ao custo de um
runner e de mais pressão de quota; fica como gatilho de revisitação se o wall
por shard passar de ~6,5 min ou a distribuição de testes ficar desbalanceada.

### Componentes / mudanças

- **`playwright.config.ts`**: hoist de `isProdMode = Boolean(process.env.CI)
|| process.env.E2E_PROD === '1'` (mesma condição do `webServer.command`
  atual — agora reusada lá e nos projects). Em prod mode: projeto `setup`
  **removido** do array de projects e `dependencies` de campaign/frontend/
  admin viram `[]` (o `setup.e2e.spec.ts` fica sem project → Playwright ignora
  arquivo não casado, sem erro). Em dev: estrutura idêntica à de hoje
  (cadeia `setup → campaign → frontend → admin`, `fullyParallel: false` do
  admin preservado nos dois modos). Comentário no config explica o porquê.
- **`scripts/lib/test-affected-core.mjs`**: novo `e2eShardConfig(mode)` puro →
  `'full'` retorna `{ matrix: [1, 2], total: 2 }`; `'selected'`/`'none'`
  retornam `{ matrix: [1], total: 1 }` — com comentário da medição e do
  gatilho de 3 shards. (Módulo já é o dono da seleção e2e da CI, já unitado.)
- **`scripts/ci-scope.mjs`**: output JSON ganha `e2e_shards` (resultado do
  helper acima).
- **`.github/workflows/ci.yml`**: job `e2e` vira matrix `shard: [1, 2]`
  (`fail-fast: false`; comentário apontando o single-source em
  test-affected-core); step de teste vira `pnpm test:e2e -- --shard=${{ matrix.shard }}/2`;
  env de job `PLAYWRIGHT_WORKERS: 2` explícito (aceite #4).
- **`.github/workflows/ci-pr.yml`**: job `scope` emite `e2e_matrix` +
  `e2e_shards`; job `e2e` usa `strategy.matrix.shard: ${{ fromJson(...) }}`
  (full → `[1,2]`, selected → `[1]` — selected continua num runner só: pagar
  2 builds por 3 specs é desperdício); step full com
  `--shard=${{ matrix.shard }}/${{ needs.scope.outputs.e2e_shards }}`; step
  selected inalterado; env de job `PLAYWRIGHT_WORKERS: 2`.
- **Migration:** nenhuma (sem schema).
- **Access / Consent:** N/A.
- **UI:** N/A (Impeccable A — infra de CI/testes).

### Nota de aceite — o spec `setup` e "nenhuma spec removida"

O `setup.e2e.spec.ts` não é removido nem alterado: ele vira **dev-only** (já é
documentado como prewarm dev-only no próprio config e no issue). Em CI ele é
custo puro (25 requisições de prewarm contra um build de produção, sem
compile), e nenhum spec de produto depende dele em prod. A suite completa de
produto (campaign/frontend/admin) roda em main e PR full, intacta.

## Fases verificáveis

1. **Infra (config + workflows + helper)** — as 5 mudanças acima, num único
   commit de CI (sem migration, sem UI).
2. **Verificação local** —
   - `pnpm exec playwright test --list` (dev): setup presente, deps `[setup]`/
     `[campaign]`/`[frontend]`; `CI=1 pnpm exec playwright test --list`: sem
     projeto setup, sem deps.
   - `pnpm test:unit` (pin novo do `e2eShardConfig`) + `pnpm gate:fast`.
   - Smoke e2e dev de uma spec `campaign*` + uma `admin` (prova que o modo dev
     segue com cadeia e prewarm).
3. **Verificação CI** — o próprio PR exercita o novo matrix em full
   (`playwright.config.ts` está em `HIGH_RISK_EXACT` → e2e_mode full):
   conferir 2 shards rodando em paralelo e `checks` verde. Pós-merge: medir o
   job e2e do ci.yml e registrar antes/depois no changelog.

## Rabbit holes / Não escopo (engenharia)

- Subir workers do CI além de 2 (aceite pede explícito, não maior).
- Shard por família/afinidade (corte da intenção — `--shard` padrão).
- Sharding do modo `selected` do PR (gatilho: wall selected recorrente > 10
  min).
- Otimizar o job `build`/`int` (fora do escopo da intenção).
- Mexer em `gate-ci.mjs`/`run-e2e-affected.mjs` (paridade herda do config).
- Reduzir `timeout-minutes` dos jobs (sem ganho de aceite, risco de
  falso-positivo em run lento).

## Riscos e mitigação

- **Desbalanceamento de shard** (Playwright distribui por test ID): aceitável
  com fullyParallel; gatilho de 3 shards se o wall passar de ~6,5 min.
- **Famílias interleaved em prod** (antes: campaign → frontend → admin
  seriadas): servidor é build de produção (sem compile race); specs são
  auto-contidas (fixtures por spec + advisory locks do testDatabaseLease); o
  número de workers por run não muda (2) — a classe de flake por carga não
  cresce. A run do PR full valida.
- **`fromJson` de matrix com output vazio no ci-pr**: o job `scope` sempre
  emite `e2e_matrix` válido (`[1]` no mínimo) antes do `e2e` avaliar o matrix
  (que já depende de `scope`); job com `e2e_mode == 'none'` é skipado pelo
  `if:` existente — o matrix de `[1]` nunca dispara run extra.
- **Drift do número 2 entre ci.yml (literal) e `e2eShardConfig`**: comentários
  cruzados nos dois arquivos + entrada do changelog; mudar para 3 é editar os
  dois pontos apontados.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (mapa: wall ≤ ~6 min ✓,
      suite completa em main/PR-full ✓, dev intocado ✓, workers explícitos ✓,
      flakes: mesma carga por run)
- [x] Invariantes AGENTS/engineering-standards (sem migration, sem access,
      sem UI; gate:fast + gate de CI no fechamento)
- [x] Testes previstos: unit do `e2eShardConfig` + `--list` nos dois modos +
      smoke e2e dev + run do PR full (2 shards)
