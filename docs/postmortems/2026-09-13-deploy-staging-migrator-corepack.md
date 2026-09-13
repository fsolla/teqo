# Post-mortem: migrator baixa o pnpm do registry em runtime e derruba o primeiro deploy staging

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-13                                                                               |
| Severidade          | alta (bloqueou o deploy de produção; sem outage — produção permaneceu no build anterior) |
| Ambiente            | CI (job `deploy staging` do deploy manual, runner self-hosted no homeserver)             |
| Issue(s)            | sem Issue (fluxo `/bug-fix`; o registro é o post-mortem)                                 |
| PR do fix           | # a preencher                                                                            |
| Detectado por       | log                                                                                      |

## Timeline

| Momento            | Data/hora               | Evento                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-08-16              | commit `21b3c00d` ("chore(deploy): prepara imagem standalone para homeserver") introduz a stage `migrator` com `CMD ["pnpm", "migrate"]`; o defeito (dependência de egress no start do container) é latente desde então — o mesmo download de pnpm no start funcionou no migrator de produção em 2026-09-13 01:09:36 UTC (`teqo-1313-migrate`, run 34728680411), mascarando a falha |
| Detecção           | 2026-09-13 15:52:09 UTC | deploy run 34765554681 (main `67a40a6c`, PR #973 mergeado 15:24:11 UTC), job `deploy staging (teqo-staging)`: `[deploy] FAILED: migrations failed — restoring previous compose and image`, exit 1; `deploy production (teqo-1313)` skipped (`needs: [deploy-staging]`); o script restaurou o compose anterior (nada publicado); produção intocada                                   |
| Correção mergeada  | pendente                | PR # a preencher aguardando CI + auto-merge                                                                                                                                                                                                                                                                                                                                         |
| Deploy             | pendente                | re-dispatch manual do `deploy.yml` após o merge (a registrar)                                                                                                                                                                                                                                                                                                                       |
| Verificado em prod | pendente                | confirmação do humano após o deploy                                                                                                                                                                                                                                                                                                                                                 |

## O bug

O primeiro deploy staging desde a OPS103 (`b03b7bd9`, mergeado 2026-09-12 22:48 -03 / 2026-09-13 01:48 UTC) não passou: o job `verify` aprovou a suíte completa, mas o job `deploy staging (teqo-staging)` falhou nas migrations com `[deploy] FAILED: migrations failed — restoring previous compose and image` (exit 1, 2026-09-13 15:52:09 UTC), o `deploy production (teqo-1313)` ficou skipped pelo `needs: [deploy-staging]` e o script restaurou o compose ao estado anterior — nada foi publicado e produção permaneceu no build anterior (sem outage; nenhum usuário afetado). No log, o corepack anunciou `! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-10.11.0.tgz` às 15:52:05 e falhou às 15:52:08 com `Error: Error when performing the request to https://registry.npmjs.org/pnpm/-/pnpm-10.11.0.tgz`, `AggregateError [ETIMEDOUT]` para 104.16.x.x:443 (Cloudflare) e `ENETUNREACH` em IPv6. **Sintoma — não a causa.**

## Causa-raiz

A imagem do migrator (`Dockerfile`, stage `AS migrator`, `CMD ["pnpm", "migrate"]`) executa o `pnpm` via corepack no START do container, e o cache do corepack populado no build da stage `deps` (`RUN pnpm install --frozen-lockfile`) não é copiado para a imagem do migrator — o `COPY --from=deps` traz apenas `/app/node_modules`. Sem o cache, o corepack tenta baixar o pnpm do registry em runtime; o mesmo download funcionou minutos antes no build (`deps`, 15:46:24) e no container de manutenção de produção às 01:09:36 UTC, então a dependência de egress no registry passou despercebida até o container de manutenção do staging não ter esse egress disponível no momento. O motivo exato da ausência de egress no container do staging (config de rede do serviço no compose, egress transitório) é **não apurado** — o compose vive no homeserver (`~/stack/docker-compose.yml`), fora do repositório.

5-whys:

1. **Por que o deploy staging falhou?** As migrations falharam: o `pnpm migrate` não executou porque o corepack não conseguiu baixar o pnpm no start do container (`ETIMEDOUT` para o registry, `ENETUNREACH` em IPv6).
2. **Por que o corepack baixou o pnpm em runtime?** A imagem do migrator não carrega o cache do corepack: o `COPY --from=deps` copia só `/app/node_modules`, não o cache populado pelo `pnpm install` da stage `deps`.
3. **Por que isso derruba o container?** O egress do container de manutenção para o registry não é garantido; no staging ele não estava disponível às 15:52, e sem cache local o pnpm não sobe.
4. **Por que o caminho de produção não pegou o defeito?** O container de manutenção de produção tinha egress às 01:09:36 UTC e baixou o pnpm normalmente — a dependência de rede em runtime ficou latente.
5. **Por que o staging expôs agora?** Foi a primeira execução real desse caminho no ambiente novo desde a OPS103 (`b03b7bd9`), que criou o job `deploy-staging`; o primeiro run de verdade é que exercita o container de manutenção.

**Evidência:** prova offline local — `docker run --network none <imagem> pnpm --version` imprime `10.11.0` com o bake e falha sem ele com o erro exato do staging; o teste de regressão novo falha (RED) sem a linha `RUN corepack install`; no log, o mesmo download do pnpm consta com sucesso no build (`deps`, 15:46:24) e o erro no runtime é de rede (`ETIMEDOUT`/`ENETUNREACH`), não de versão ou lockfile.

## Correção

Sem migration e sem código de aplicação — o defeito era da imagem do migrator:

- `Dockerfile`: a stage `AS migrator` (`:18-29`) ganha `RUN corepack install` (`:28`) após o `COPY . .` (`:21`). O pnpm 10.11.0 (versão do `packageManager` no `package.json`) é baixado em BUILD time (quando a rede está disponível) e o cache do corepack passa a viajar na layer da imagem; o `pnpm migrate` em runtime não toca mais o registry.

Resolve a causa: o toolchain deixa de ser buscado na rede no start do container; a imagem é autossuficiente offline para executar as migrations.

## Verificação

- Teste de regressão: `tests/unit/deployScript.unit.spec.ts:142` "Dockerfile: the migrator bakes pnpm at build time (no runtime registry fetch)" — falha sem o fix (RED sem a linha `RUN corepack install`) e passa com
- Prova offline local: `docker run --network none <imagem> pnpm --version` → `10.11.0` com o bake; sem o bake o mesmo run offline falha com o erro exato do staging
- Suíte: `pnpm gate:fast` verde
- CI: pendente — PR # a preencher (check required `CI (PR) / checks`)
- Prod: pendente — re-dispatch manual do `deploy.yml` após o merge; confirmação do humano pendente (a registrar)

## Prevenção

| Estratégia                                                                       | Custo  | Estado                                                               |
| -------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| Assar o pnpm na imagem do migrator (`RUN corepack install`) + teste de regressão | barata | implementada agora (PR # a preencher)                                |
| Probe/healthcheck de egress pré-migration ou registry mirror interno             | cara   | documentada — não implementada neste fluxo; candidata a Issue futura |

**Estratégia implementada:** o pnpm é baixado no build e o cache do corepack viaja na imagem do migrator, com um teste unitário que pina a linha do `Dockerfile` — a imagem deixa de depender de egress no start do container, e a regressão passa a falhar na autoria, não no deploy.

**Estratégia documentada (cara):** probe/healthcheck de egress pré-migration ou um registry mirror interno (eliminaria a dependência de rede do registry de forma geral, não só do pnpm). Candidata a Issue futura — não implementada neste fluxo.

## Lições

- **Imagem de deploy que roda package manager no start carrega dependência de rede oculta:** se o container executa `pnpm`/`corepack` no boot, o toolchain precisa estar assado no build; egress de runtime não é contrato.
- **O caminho de produção mascara o defeito:** o container de manutenção de produção tinha egress na hora e baixou o pnpm sem drama — o sucesso de um ambiente não prova que o caminho é autossuficiente.
- **O primeiro run real de um ambiente novo é o melhor detector:** o staging estreou sob a OPS103 e expôs em minutos o que meses de produção vinham escondendo; exercitar o caminho novo cedo vale o susto.
- **Segunda falha da mesma cadeia no mesmo dia:** o deploy já tinha sido destravado pelo PR #973 (flake int); cada bloqueio consecutivo reforça que o verify/deploy precisa de diagnósticos que apontem a causa, não só o sintoma.
