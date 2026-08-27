# Post-mortem: admin do Payload em tela branca — importMap órfão do handler S3

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor            |
| ------------------- | ---------------- |
| Data do post-mortem | 2026-08-26       |
| Severidade          | crítica          |
| Ambiente            | prod             |
| Issue(s)            | sem Issue        |
| PR do fix           | — (em andamento) |
| Detectado por       | humano           |

## Timeline

| Momento            | Data/hora       | Evento                                                                                                                                                                 |
| ------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-08-23      | commit 1c865bd8 (refactor "E1 simplify — pin loading/retry/stale-quirk no spec e tipo local") regenerou o importMap sem as envs S3\_\*, removendo a entrada do handler |
| Detecção           | 2026-08-26      | relato do usuário: admin em branco em produção                                                                                                                         |
| Correção mergeada  | em andamento    | PR ainda sem número                                                                                                                                                    |
| Deploy             | ainda não feito | dispatch manual do deploy.yml (só humano)                                                                                                                              |
| Verificado em prod | não             | aguarda deploy + confirmação do humano                                                                                                                                 |

## O bug

O admin do Payload em produção (jorgesolla1313.com.br/admin) abria em TELA BRANCA — tanto no login quanto no dashboard. Zero erros de console no browser, SSR HTML completo (200) e todos os assets 200, então não havia nenhum sinal visível no cliente. **Sintoma — não a causa.**

## Causa-raiz

O `src/app/(payload)/admin/importMap.js` commitado perdeu a entrada `@payloadcms/storage-s3/client#S3ClientUploadHandler` — removida no commit 1c865bd8 (2026-08-23, refactor "E1 simplify — pin loading/retry/stale-quirk no spec e tipo local"), que regenerou o importMap SEM as envs S3\_\*.

5-whys:

1. **Por que a tela fica branca?** Porque a raiz do Payload não monta: `getFromImportMap` (node_modules/payload/dist/bin/generateImportMap/utilities/getFromImportMap.js) retorna undefined para o handler `S3ClientUploadHandler` que o config serializado do admin referencia.
2. **Por que o handler não é encontrado?** Porque o importMap commitado não tem mais a entrada — o mapa é um artefato estático, não gerado em runtime.
3. **Por que a entrada sumiu do arquivo?** Porque o commit 1c865bd8 regenerou o importMap com `pnpm generate:importmap` sem as envs `S3_*` no ambiente.
4. **Por que sem as envs a entrada some?** Porque o plugin s3Storage é condicional em src/payload.config.ts (resolvedor src/utilities/mediaStorage.ts): sem `S3_*` o storage é local (dev/test/CI) e o mapa gerado é consistente para essa config; com `S3_*` setadas (produção, media no Garage) o config serializado do admin referencia o handler — que o mapa sem envs não inclui.
5. **Por que ninguém viu antes do deploy?** Porque dev/test/CI não têm `S3_*` — o importMap órfão é invisível em todo o loop local (o e2e do admin passa), e o smoke test do deploy só checa HTTP 200 (tela branca passa). O erro real (`getFromImportMap: PayloadComponent not found in importMap`) vai para o log do SERVIDOR via console.error silencioso — o browser mostra zero erros. E o guard planejado nas lições do OPS69 (CI que regenera com envs dummy e falha se divergir, depends #77/#87) nunca foi implementado.

Classe recorrente: OPS69 (2026-08-19), OPS72 (2026-08-19), OPS73 (2026-08-20) — esta é a 4ª recorrência.

**Reprodução:** local, servindo o build com envs S3*\* dummy no runtime → /admin/login branco (hidden div de 17 bytes, form ausente) + log do servidor com `getFromImportMap: PayloadComponent not found in importMap`; sem S3*\* → login renderiza. A mesma assinatura de prod foi verificada por instrumentação (chunk pushes, r.m, flight data, headers, HTML brotli).

## Correção

Regeneração do importMap com envs S3\_\* dummy — o diff foi de exatamente +2 linhas (import + entrada do handler). Resolve a **causa** (o artefato volta a ser consistente com o config que produção serializa), não o sintoma. Sem migration, sem mudança de access, sem UI.

## Verificação

- Teste de regressão: `tests/unit/importMapS3UploadHandler.unit.spec.ts` — falha se a entrada sumir do arquivo; vermelho sem o fix, verde com
- Guard: `scripts/check-importmap-s3.mjs` — regenera com S3\_\* dummy e sai 1 (com drift e restore do arquivo) se o commitado divergir; exit 1 sem o fix, exit 0 com
- Suíte: unit completa 284 arquivos / 2682 testes verdes; `tsc --noEmit` e lint exit 0
- E2E original: admin servido com S3\_\* dummy (PORT 4093) — login renderiza (título "Login - Payload", form Email/Senha), login admin@test.invalid funciona, dashboard "Painel de Controle - Payload" monta, log do servidor com 0 `getFromImportMap`, 0 erros de console
- CI: gate:fast verde (284 arquivos, 2682 testes)
- Prod: não verificado — aguarda deploy manual + confirmação do humano

## Prevenção

| Estratégia                                                                                                                                                                                                                                                                    | Custo  | Estado                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pin unit `importMapS3UploadHandler.unit.spec.ts` (falha se a entrada sumir)                                                                                                                                                                                                   | barata | implementada agora (mesmo PR)                                                                                                                                                                                                                                                                              |
| Guard `scripts/check-importmap-s3.mjs` no ci-pr.yml (content guards) e no job verify do deploy.yml                                                                                                                                                                            | barata | implementada agora (mesmo PR)                                                                                                                                                                                                                                                                              |
| Wrapper `scripts/generate-importmap.mjs` no `pnpm generate:importmap` (injeta S3\_\* dummy quando ausentes)                                                                                                                                                                   | barata | removida no follow-up (2026-08-27) — a mudança de package.json invalida a cache BuildKit da camada `deps` no homeserver e força reinstall cujo `postinstall` do `sharp@0.32.6` falha (timeout do libvips em objects.githubusercontent.com; 2 deploys falhos). Re-ligar junto com o hardening do Dockerfile |
| Contrato compartilhado `scripts/lib/importMapContract.mjs` (chave + prefixo do handler, chaves das envs S3)                                                                                                                                                                   | barata | implementada agora (mesmo PR)                                                                                                                                                                                                                                                                              |
| AGENTS.md: instrução das envs S3\_\* no generate:importmap + referência aos guards                                                                                                                                                                                            | barata | implementada agora (mesmo PR)                                                                                                                                                                                                                                                                              |
| Gerar o importMap no BUILD (prebuild com S3\_\* via BuildKit secrets) em vez de commitá-lo                                                                                                                                                                                    | cara   | documentada — não implementada neste fluxo                                                                                                                                                                                                                                                                 |
| Tornar o plugin s3Storage incondicional no config (adaptador local em dev)                                                                                                                                                                                                    | cara   | documentada — não implementada neste fluxo                                                                                                                                                                                                                                                                 |
| Smoke real de deploy: abrir /admin em headless e assertar o mount da raiz Payload (não só HTTP 200)                                                                                                                                                                           | cara   | documentada — não implementada neste fluxo                                                                                                                                                                                                                                                                 |
| Fail-fast/erro estruturado quando getFromImportMap retorna undefined (hoje é console.error silencioso no log do servidor)                                                                                                                                                     | cara   | documentada — não implementada neste fluxo                                                                                                                                                                                                                                                                 |
| Hardening da camada `deps` do Dockerfile (retry do `pnpm install` / libvips via apk / proxy do download do sharp) — qualquer mudança em package.json/pnpm-lock/pnpm-workspace busta a cache e o egress do homeserver para objects.githubusercontent.com não conclui downloads | cara   | documentada — não implementada neste fluxo                                                                                                                                                                                                                                                                 |

**Estratégia implementada:** pin unit que falha se o handler sumir do importMap; guard de CI+deploy que regenera com S3\_\* dummy e falha em divergência (drift + restore do arquivo); contrato compartilhado da chave/prefixo e das envs; doc no AGENTS.md. O wrapper do `generate:importmap` foi removido no follow-up (a mudança de package.json que o ligava quebrou o deploy — ver tabela); a proteção fica com o guard + pin.

**Estratégia documentada (cara):** gerar o importMap no build (elimina a classe: artefato gerado não drift; toca o pipeline do homeserver); tornar o s3Storage incondicional (estabiliza o importMap; muda storage local e caminho de media); smoke de deploy que abre /admin em headless e asserta o mount da raiz Payload; fail-fast estruturado quando getFromImportMap retorna undefined; hardening da camada `deps` do Dockerfile contra o reinstall completo no homeserver.

## Lições

- **Padrão "silencioso só em prod":** o bug não tem NENHUM sinal no loop local — dev/test/CI rodam sem S3\_\*, o importMap órfão é consistente para a config local, o e2e do admin passa, e o erro real sai como console.error no log do servidor enquanto o browser mostra zero erros. Quarta recorrência da mesma classe (OPS69/OPS72/OPS73). Diferenças de config entre prod e o loop local (envs condicionais) precisam de um espelho artificial (envs dummy) em pelo menos um ponto do pipeline.
- **Lição registrada sem enforcement não é lição:** o guard de CI (regenerar com envs dummy e falhar em divergência) já estava escrito nas lições do OPS69 com depends #77/#87 — e nunca foi implementado. O custo de 3 recorrências seguidas é exatamente o custo de anotar e não executar. Lições pós-incidente deveriam virar Issue/guard no mesmo fluxo, não item de backlog.
- **Smoke test que só checa HTTP 200 não é smoke de UI:** tela branca devolve 200 com SSR completo — o smoke do deploy validava transporte, não aplicação. Para apps que dependem de mount client-side (admin do Payload), o smoke precisa abrir a página em headless e assertar a montagem da raiz, ou o contrato precisa ser o log do servidor sem o erro conhecido.
