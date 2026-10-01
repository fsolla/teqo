# Post-mortem: home da campanha lenta — masters AVIF 4K servindo recortes de 177–747px

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Data do post-mortem | 2026-10-01                                                                                             |
| Severidade          | alta (degradação mensurável de segundos na página principal; sem indisponibilidade nem perda de dados) |
| Ambiente            | prod                                                                                                   |
| Issue(s)            | sem Issue                                                                                              |
| PR do fix           | [#1421](https://github.com/fsolla/teqo/pull/1421)                                                      |
| Detectado por       | humano (relato na sessão de 2026-10-01 ~19:30 -03; confirmou a lentidão na própria máquina)            |

## Timeline

| Momento               | Data/hora             | Evento                                                                                                                                                                                                                                          |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável       | 2026-08-16 00:49 -03  | Commit `7ddc281f` (`feat(site): publica home da campanha Jorge Solla 1313`) publica o hero com os 5 masters AVIF de 3840px (14–22MP) — a home passou a gerar derivados caros no otimizador.                                                     |
| Detecção              | 2026-10-01 ~19:30 -03 | Humano relata "Images are loading slowly in jorgesolla1313.com.br" e confirma a lentidão na própria máquina. Medição em prod: `/_next/image` com TTFB ~1,6s em miniaturas 256w; um request de `RUI - 2-2.avif&w=256` pendurou >120s. Sem Issue. |
| Correção implementada | 2026-10-01            | Worktree `fix/15`: 5 masters regerados, `minimumCacheTTL` 14400, srcs/sizes do hero corrigidos, aviso no gerador e 3 guards. Benchmark pós-fix: 38–171ms por miniatura (soma 381ms, 11× mais rápido); `pnpm gate:fast` verde.                   |
| Correção mergeada     | pendente              | PR [#1421](https://github.com/fsolla/teqo/pull/1421) aberto em 2026-10-01 com o fix, os guards e este post-mortem; merge pendente do required check + auto-merge.                                                                               |
| Deploy                | pendente              | Merge em `main` dispara o deploy; produção só após approve humano no environment `production`.                                                                                                                                                  |
| Verificado em prod    | pendente              | Aguardando deploy e confirmação do humano.                                                                                                                                                                                                      |

## O bug

Em produção, a home da campanha (`jorgesolla1313.com.br`) entregava imagens lentamente: `/_next/image` respondia com TTFB ~1,6s nas miniaturas de 256w, e um request de `RUI - 2-2.avif&w=256` chegou a ficar pendurado por mais de 120s. O hero usa 5 imagens eager/preload (4 aliados + o retrato `priority`), e a home referenciava 23 URLs únicas de `/_next/image`. As evidências de cache mostravam o motivo da recorrência: `cache-control: public, max-age=60, must-revalidate` com `x-nextjs-cache: STALE` e `cf-cache-status: DYNAMIC` (o Cloudflare não cacheia `/_next/image`). O sintoma afetava a página principal inteira, sem indisponibilidade nem perda de dados. **Sintoma — não a causa.**

## Causa-raiz

Os masters dos aliados estavam em `public/`: `Jeronimo.avif` 3840×5760 (3,60 MB), `Lula.avif` 3840×3786 (1,57 MB), `JOA00162.avif` 3840×5757 (1,44 MB), `RUI - 2-2.avif` 3840×5757 (1,05 MB) e `WAGNER - 2-9 final.avif` 3840×5757 (1,03 MB) — 14–22MP, todos exibidos entre 177px e 747px (CSS: aliado ≤211px, Lula ≤284px, retrato ≤702px). Esses masters foram gerados pelo default do `pnpm images:resize` (`--max-width` avif 3840, o "2x desktop" de `scripts/lib/imageResize.mjs`) aplicado a recortes pequenos de hero. O otimizador do Next decodifica o master inteiro a cada derivado: benchmark sharp local com os masters antigos deu 0,67–1,13s de CPU por miniatura 256w (Jeronimo 1130ms, Lula 672ms, JOA00162 880ms, RUI 837ms, WAGNER 805ms; soma 4324ms). O download cru de `JOA00162` levou 7,24s numa medição.

A recorrência vem do cache: o default de `images.minimumCacheTTL` é 60s (`node_modules/next/dist/shared/lib/image-config.js:56`), o cache é volátil (container recriado no deploy, sem volume para `.next/cache/images`) e o Cloudflare não cacheia `/_next/image` (`DYNAMIC`) — ou seja, sharp regenerava praticamente toda miniatura a cada janela de TTL no homeserver. Commit que publicou a home/hero com esses masters: `7ddc281f` (2026-08-16 00:49 -0300).

### 5 whys

1. Por que a home estava lenta? Porque cada derivado de `/_next/image` custava ~0,7–1,1s de CPU (TTFB ~1,6s; um request >120s).
2. Por que custava isso? Porque o sharp decodifica o master AVIF inteiro (até 22MP) para produzir cada derivado, mesmo um de 256w.
3. Por que o master era 3840px? Porque o default do `pnpm images:resize` ("2x desktop") foi aplicado a recortes pequenos de hero.
4. Por que regenerava sempre? Porque o TTL default de 60s + cache volátil no container + Cloudflare `DYNAMIC` não seguram nenhuma geração.
5. Por que passou? Porque nenhum teste/guard olhava dimensões e bytes dos masters nem o TTL da entrega de imagem; o default do gerador parecia razoável e a home publicada não foi medida contra o otimizador real.

## Correção

- **Masters regerados** com `pnpm images:resize` (avif, default q60): aliados 768px, Lula 1024px, retrato 1536px → total 350,9 KB (vs 8,7 MB).
- **`next.config.mjs:10`**: `images.minimumCacheTTL: 14400` — o cache do otimizador deixa de expirar em 60s.
- **`src/components/CampaignHero.tsx`**: srcs do hero sem percent-encoding (`/RUI - 2-2.avif`, `/WAGNER - 2-9 final.avif`) e `sizes` corrigidos para o CSS real (caps 211px, 284px e 747px).
- **`scripts/resize-images.mjs`**: aviso quando a saída ≥2000px + nota no USAGE.

Resolve a causa: o master deixa de dimensionar o custo por derivado (masters pequenos), o cache deixa de expirar em 60s (TTL 4h) e a entrega do hero passa a pedir as larguras que o CSS realmente usa.

## Verificação

- Teste de regressão: `tests/unit/imageDelivery.unit.spec.ts` — teto 1600×2400 dos masters do hero, orçamento de dimensão de todo asset local literal do `src` entregue via `next/image`, TTL ≥3600 — e caso novo em `tests/unit/campaignHero.unit.spec.tsx` (src sem `%`): vermelhos sem o fix (3 falhas: 3840>1600, TTL null, `%`), verdes com.
- Verificação independente confirmou stash/pop limpo (sem o fix os guards falham; com o fix passam).
- Benchmark pós-fix: 38–171ms por miniatura (soma 381ms, 11× mais rápido que os 4324ms dos masters antigos).
- Suíte: `pnpm gate:fast` verde (460 arquivos / 5100 testes); e2e `tests/e2e/frontend.e2e.spec.ts` 42 passed (rodado duas vezes, antes e depois dos `sizes`).
- CI: pendente (PR ainda não aberto).
- Prod: pendente (merge/deploy/confirmação humana ainda não aconteceram).

## Prevenção

| Estratégia                                                                                                                                                                                                      | Custo  | Estado                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| Guards no `imageDelivery.unit.spec` (teto 1600×2400, orçamento de dimensão de todo asset local literal do `src` entregue via `next/image`, TTL ≥3600)                                                           | barata | implementada agora (este PR)                  |
| Caso no `campaignHero.unit.spec.tsx` exigindo src sem `%`                                                                                                                                                       | barata | implementada agora (este PR)                  |
| Aviso no `scripts/resize-images.mjs` quando a saída ≥2000px + nota no USAGE                                                                                                                                     | barata | implementada agora (este PR)                  |
| Cache Rule Cloudflare para `/_next/image*` (infra, fora do repo)                                                                                                                                                | cara   | documentada — não implementada neste fluxo    |
| Volume persistente para `.next/cache/images` no compose/deploy                                                                                                                                                  | cara   | documentada — não implementada neste fluxo    |
| Observabilidade de p95/TTFB de `/_next/image` + alerta                                                                                                                                                          | cara   | documentada — não implementada neste fluxo    |
| Lote de assets públicos fora do orçamento (`fundo.avif` 2063px ainda passa por `next/image`, `BG.jpg` 21,6MP/CSS, Pranchetas 2400², `.webp` irmãos 1920px sem uso, `LULA_E_SOLLA.png` 859KB, `SOLLA.png` 559KB) | cara   | documentada — Issue de conteúdo com QA visual |

**Estratégia implementada:** os 3 guards de regressão (teto de dimensão dos masters do hero, orçamento de dimensão de todo asset local literal do `src` entregue via `next/image` e piso de TTL) + o caso de src sem `%` + o aviso do gerador quando a saída passa de 2000px.

**Estratégia documentada (cara):** Cache Rule do Cloudflare para `/_next/image*` (infra, fora do repo); volume persistente para `.next/cache/images` no compose/deploy; observabilidade de p95/TTFB com alerta; e o lote de assets públicos fora do orçamento — candidato a Issue de conteúdo com QA visual.

## Lições

- **Default de ferramenta é para o caso comum, não para o asset:** `--max-width 3840` ("2x desktop") aplicado a recortes de 177–747px gerou masters de 14–22MP. O otimizador paga por área do master, não pelos bytes que o usuário baixa — a miniatura continua pequena, o CPU é que explode.
- **Self-hosted muda o contrato do cache de imagem:** TTL default de 60s + cache efêmero no container + CDN que não cacheia `/_next/image` = regeneração perpétua. Nenhum dos três (TTL maior, volume, cache no edge) estava configurado.
- **Teste de entrega de imagem mede o que o usuário recebe:** dimensão do master, orçamento de bytes e TTL teriam pegado o bug no PR do hero; teste de fumaça não mede performance. Nomes com espaço/`%` no `src` também viraram contrato testado.
- **A detecção foi humana e ~6 semanas depois do commit:** nada media TTFB/`/_next/image` em prod, então a lentidão era visível mas não alertável — é exatamente a prevenção cara registrada (observabilidade).
- **Reduzir a exibição não reduz a decodificação enquanto o master fica:** `sizes` e CSS definem o derivado; o custo por derivado é governado pelo master.
