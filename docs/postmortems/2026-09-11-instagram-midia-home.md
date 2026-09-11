# Post-mortem: capas do Instagram quebradas e legendas longas esticando o card na home de campanha

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                     |
| ------------------- | --------------------------------------------------------- |
| Data do post-mortem | 2026-09-11                                                |
| Severidade          | alta (home pública em reta eleitoral; sem perda de dados) |
| Ambiente            | prod (sintoma) + dev/worktree (diagnóstico e fix)         |
| Issue(s)            | sem Issue (worktree `fix/2` do fluxo `/bug-fix`)          |
| PR do fix           | #940                                                      |
| Detectado por       | humano (relato do usuário)                                |

## Timeline

| Momento            | Data/hora  | Evento                                                                                                                                                                                                                                               |
| ------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-08-18 | commit `a638a8ac` (entrega S3 da seção de conteúdos do Instagram) criou o allowlist assumindo `*.cdninstagram.com` — `docs/plans/secao-conteudos-home-instagram-impl.md:110`; a data em que a Meta migrou a mídia para `*.fbcdn.net` não foi apurada |
| Detecção           | 2026-09-11 | relato do usuário: capas do Instagram sem carregar e legendas longas esticando o card na home pública                                                                                                                                                |
| Correção mergeada  | 2026-09-11 | commit `a83b6dd5` (fix) e commit `2dead731` (pré-requisito do gate) no PR #940 — merge não apurado no momento da escrita                                                                                                                             |
| Deploy             | pendente   | deploy é manual (`deploy.yml`, `workflow_dispatch`); não disparado até a escrita                                                                                                                                                                     |
| Verificado em prod | pendente   | depende do deploy manual + confirmação do humano                                                                                                                                                                                                     |

## O bug

Na seção "Acompanhe de perto" da home pública, os cards do Instagram apareciam, mas as capas/mídias não carregavam — o card renderizava com a moldura e os metadados, sem a imagem. Em paralelo, legendas longas do Instagram esticavam demais o card, sem limite visual nem ellipsis, quebrando o bento. **Sintoma — não a causa.**

## Causa-raiz

### Mídia (duas camadas)

1. **Host fora do allowlist:** a Instagram Graph API passou a servir a mídia de `*.fbcdn.net` (ex.: `https://instagram.fssa2-1.fna.fbcdn.net/v/...jpg?stp=...&_nc_ohc=...&oe=...`), mas `next.config.mjs` só permitia `https://*.cdninstagram.com/**`; o otimizador do Next respondia `400 "url" parameter is not allowed` para toda capa.
2. **Pattern com `search` pinado:** os patterns eram declarados como `new URL(...)`, que pina `search: ''`; o matcher do Next 15.4 (`next/dist/shared/lib/match-remote-pattern`, picomatch) exige igualdade estrita de `search`, então mesmo com o host certo a URL real (assinada, com query string) seria rejeitada.

5-whys:

1. **Por que a capa não carrega?** O otimizador responde 400 `"url" parameter is not allowed` para a URL de mídia.
2. **Por que o otimizador rejeita?** O host da URL (`*.fbcdn.net`) não está em `images.remotePatterns`.
3. **Por que o allowlist não cobre o host?** A suposição do host nasceu na entrega S3 (`docs/plans/secao-conteudos-home-instagram-impl.md:110`, commit `a638a8ac`, 2026-08-18), quando a Meta ainda servia de `cdninstagram`; a migração da Meta para `fbcdn` não foi detectada.
4. **Por que corrigir só o host não bastaria?** Porque `new URL()` pina `search: ''` e o matcher do Next 15.4 exige igualdade estrita — as URLs de mídia são assinadas (têm query string), então continuariam rejeitadas.
5. **Por que o loop local não pegou?** O stub e2e do Instagram serve as miniaturas de `localhost`; nenhum teste casava as URLs reais (host + assinatura) contra o allowlist de produção.

**Evidência:** em prod, `GET /_next/image?url=<fbcdn-url-assinada>&w=384&q=75` → `400` com body `"url" parameter is not allowed` (read-only via curl); a URL direta no CDN → `200 image/jpeg`. No dev local, o mesmo proxy → 400 antes e `200 image/jpeg 19695 bytes` depois do fix. O unit novo falhava sem o fix (2 hosts) e passa com.

### Texto

O `<h3>` do card (`src/components/CampaignContentCard.tsx`) não tinha clamp, e a legenda inteira do Instagram vira título (`toInstagramCardData` em `src/components/CampaignContentSection.tsx:77`). O card foi desenhado para títulos de artigo; em prod, o card em destaque tinha legenda de 370 caracteres.

5-whys:

1. **Por que o card estica?** O `<h3>` cresce com o texto, sem limite de linhas.
2. **Por que o texto é longo?** A legenda do Instagram vira título do card — a plataforma não tem título curto.
3. **Por que ninguém viu antes?** O fixture e2e do Instagram usava legenda curta; nenhum teste exercitava legenda longa.

**Evidência:** o e2e do clamp falhava com computed `-webkit-line-clamp: none` e passa com `3`.

## Correção

- `next.config.mjs`: os patterns do Instagram viram objetos planos `{ protocol: 'https', hostname: '*.cdninstagram.com' | '**.fbcdn.net', pathname: '/**' }` (sem `search`), cobrindo o host novo e as URLs assinadas.
- `src/components/CampaignContentCard.tsx`: `line-clamp-3` no título e `line-clamp-2` no subtítulo.
- Testes: novo `tests/unit/nextImageRemotePatterns.unit.spec.ts` (casa URLs assinadas reais contra `nextConfig.images.remotePatterns` com o matcher do próprio Next + seam parser→allowlist); stub e2e com legenda longa no reel (`tests/e2e/instagram-stub.mjs`) e asserção de clamp em `tests/e2e/frontend.e2e.spec.ts`.
- Pré-requisito descoberto no gate: `tests/unit/activityOverlay.unit.spec.tsx` era dependente da data (calendário abre no mês corrente; fixtures de agosto/2026) e quebrava a suíte unit full desde 01/09/2026 — sem o relógio fixo no mês do fixture (commit `2dead731`) nenhum PR passaria no gate. O wrapper `scripts/vitest-changed-or-full.mjs` roda full na prática por um `--` extra que o pnpm repassa ao vitest (o modo `changed` cai no full), o que expôs a falha.

Resolve as causas: o allowlist volta a aceitar os hosts reais com URL assinada e o card limita o texto independentemente do tamanho da legenda. Sem migration, sem mudança de access.

## Verificação

- Teste de regressão: `tests/unit/nextImageRemotePatterns.unit.spec.ts` — falha sem o fix (2 hosts) e passa com; e2e do clamp em `tests/e2e/frontend.e2e.spec.ts` — falha com `-webkit-line-clamp: none` e passa com `3`
- Suíte: unit full 2687 passed; int full 712 passed; e2e frontend do describe "Campaign home content section" 10/10 local; proxy real `200 image/jpeg`; typecheck/lint/format/knip/cycles/build verdes no `pnpm push` (gate:ci)
- CI: a preencher — não apurado no momento da escrita (PR #940)
- Prod: pendente (deploy manual + confirmação do humano)

## Prevenção

| Estratégia                                                                                                                                       | Custo  | Estado                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Guard unit do allowlist com URLs assinadas reais + seam parser→allowlist (`tests/unit/nextImageRemotePatterns.unit.spec.ts`)                     | barata | implementada agora (PR #940)                                                                                            |
| e2e de line-clamp com legenda longa (`tests/e2e/instagram-stub.mjs` + asserção em `tests/e2e/frontend.e2e.spec.ts`)                              | barata | implementada agora (PR #940)                                                                                            |
| Relógio fixo do teste de calendário (`tests/unit/activityOverlay.unit.spec.tsx`, commit `2dead731`)                                              | barata | implementada agora (pré-requisito do gate)                                                                              |
| Mapear `CampaignContentCard/Section` + `src/utilities/socialFeed/**` → spec `frontend` no `scripts/lib/e2e-affected-manifest.mjs`                | barata | deferida — não implementada neste PR (o arquivo é high-risk e força unit full; precisa vir depois do fix do calendário) |
| Corrigir o `--` extra do `scripts/vitest-changed-or-full.mjs` (o pnpm repassa o `--` ao vitest e o modo `changed` cai no full)                   | barata | deferida — não implementada neste PR                                                                                    |
| Re-host da capa do Instagram no sync (baixar e servir via S3/Garage + `/api/media/file/...`) para não depender de URL assinada que expira (`oe`) | cara   | documentada — não implementada neste fluxo                                                                              |
| Observabilidade do allowlist/idade do snapshot no painel de sync                                                                                 | cara   | documentada — não implementada neste fluxo                                                                              |

**Estratégia implementada:** guard unit do allowlist contra as URLs assinadas reais com o matcher do próprio Next (fecha a lacuna que o stub local não via); e2e de line-clamp com legenda longa; relógio fixo do teste de calendário para o gate voltar a passar.

**Estratégia documentada (cara):** re-host da capa do Instagram no sync (baixar e servir via S3/Garage + `/api/media/file/...`), eliminando a dependência de URL assinada que expira no snapshot (`oe`); observabilidade do allowlist/idade do snapshot no painel de sync. Gatilhos para promover: primeiro card 403 do proxy/CDN ou sync falho além do `oe`; nova migração de CDN da Meta.

## Lições

- **Allowlist de CDN externo envelhece sem guard:** a suposição do host nasceu no S3 e ficou correta até a Meta migrar a mídia para `fbcdn`. Um stub e2e que serve de `localhost` nunca cobre o host real; o guard útil é casar as URLs reais (host + assinatura) contra o allowlist com o matcher da própria ferramenta.
- **`new URL()` como pattern é uma armadilha silenciosa:** a forma "elegante" pina `search: ''` e muda a semântica do allowlist — só apareceu porque as URLs são assinadas. O contrato precisa de teste, não de leitura de código.
- **Teste dependente de data bloqueia o gate inteiro:** o `activityOverlay` quebrava a suíte unit full desde 01/09/2026 e o wrapper de `changed` caía no full por um `--` extra do pnpm — sem o fix do relógio, nenhum PR passaria. Dívida de teste de calendário é dívida de fluxo.
- **Fixture curta esconde bug de texto longo:** o e2e do Instagram usava legenda curta; a produção tinha 370 caracteres no card em destaque. Fixtures de UI de texto devem incluir o caso extremo que a fonte real entrega.
