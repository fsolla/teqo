# Acabar com o warning do pnpm sobre `pnpm.onlyBuiltDependencies` ignorado

Status: registrado
Atualizado em: 2026-08-17
Issue: #12
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~2–4 h eng; um outcome verificável
Responsável: —

## Intenção

Todo comando pnpm no terminal imprime, antes de executar:

```
[WARN] The "pnpm" field in package.json is no longer read by pnpm.
The following keys were ignored: "pnpm.onlyBuiltDependencies".
See https://pnpm.io/settings for the new home of each setting.
```

Desde o pnpm 10, o campo `pnpm` do `package.json` não é mais lido — os
settings migraram para `pnpm-workspace.yaml` (ou `.npmrc`). Além do ruído em
toda sessão de terminal (dev, CI, builds do Docker), o warning diz que a
allowlist `onlyBuiltDependencies` (`sharp`, `esbuild`, `unrs-resolver`) está
**sendo ignorada hoje**: a intenção original de permitir os build scripts
desses pacotes não chega ao pnpm. Queremos o warning sumindo e a allowlist
voltando a valer, no lugar canônico que o próprio pnpm aponta.

## Persona e fluxo

- **Persona / contexto:** dev e agentes (pool, worktrees) — todo comando pnpm, incluindo CI e build da imagem do homeserver (OPS53).
- **Job principal:** rodar qualquer comando pnpm sem a linha de warning, com a config de build scripts honrada.
- **Fluxo desejado:** `pnpm install` / `pnpm dev` / CI / `docker build` → sem `[WARN]`; `pnpm config get onlyBuiltDependencies` retorna os 3 pacotes; `sharp`/`esbuild`/`unrs-resolver` continuam com seus builds permitidos.
- **Anti-goals de produto:** reconfigurar pnpm além do que o warning cita; mudar versão/packageManager; mexer em `.npmrc` (`legacy-peer-deps`, `include`) ou na política de approve de build scripts de outros pacotes.

## Objetivo e aceite

- Nenhum comando pnpm (install/dev/scripts, CI Forgejo, estágio `deps` do Dockerfile) imprime mais o warning do campo `pnpm` em package.json.
- `pnpm config get onlyBuiltDependencies` retorna `sharp`, `esbuild`, `unrs-resolver` (a allowlist passa a ser honrada — ela não é hoje).
- Build e suíte completa verdes (mesmos passos do checklist local do `AGENTS.md`), incluindo `pnpm install --frozen-lockfile` sem tocar o grafo de dependências.
- Imagem Docker continua construindo o app (estágio `deps` copia o novo arquivo de config).
- Guardrail: `.npmrc`, `packageManager` e o restante do `package.json` ficam intocados.

## Dados (intenção)

Dados: N/A — configuração de ferramenta; nenhuma métrica/UI envolvida.

## Direção no codebase (hipótese)

- **Áreas prováveis:** raiz do repo — `package.json` (remover o campo `pnpm`), novo `pnpm-workspace.yaml` (raiz, com `onlyBuiltDependencies`), `Dockerfile` (estágio `deps` copia `pnpm-workspace.yaml` para a imagem).
- **Precedente a olhar:** pnpm docs (https://pnpm.io/settings — novo home dos settings); planos OPS50/51/53 (que tocaram CI/Dockerfile recentemente).
- **Risco de acoplamento:** `Dockerfile` é compartilhado com OPS53 (deploy homeserver, ainda `blocked`) — se os dois executarem próximos, coordenar o estágio `deps`. Verificado: nenhum script/skill lê o campo `pnpm` do package.json além do próprio pnpm; nada referencia `pnpm-workspace.yaml` hoje; `pnpm install --frozen-lockfile` deve seguir passando (grafo inalterado).

## Dependências

- Nenhuma. (OPS53 só se sobrepõe no arquivo Dockerfile se executar em paralelo.)

## Fora de escopo

- Mover outros settings (`legacy-peer-deps`, `include`) do `.npmrc` para `pnpm-workspace.yaml` — sem item, só se um warning futuro pedir.
- Atualizar pnpm / `packageManager` — fora de escopo.
- Renomear ou re-approvar build scripts de outros pacotes — fora de escopo.

## Rabbit holes de produto

- **Migração ampla de config.** Se alguém "só completar", move tudo que existe para o YAML novo e muda comportamento não reclamado. **Corte neste item:** apenas `onlyBuiltDependencies`, que é exatamente o que o warning cita.
- **Mudar a política de build scripts.** A tentação de trocar a allowlist por `dangerouslyAllowAllBuilds` etc. **Corte:** manter a allowlist como está, só realocada.

## Questões em aberto (produto)

- **Onde hospedar a config?** **Opções:** (A) `pnpm-workspace.yaml` — novo home canônico, é o destino que o próprio warning aponta; (B) `.npmrc` — ainda suportado, mas caminho legado para esse tipo de setting. **Recomendação:** A. _(assumido — validar com produto)_
- **ID OPS54 ok?** Último OPS usado é o 53 (registrado 2026-08-17). **Recomendação:** sim, próximo da trilha. _(assumido — validar)_

## Referências

- pnpm settings: https://pnpm.io/settings
- `package.json` (campo `pnpm` nas linhas 187–193), `Dockerfile` (estágio `deps`), `.npmrc`
- `docs/plans/ops53-ci-deploy-homeserver.md` (compartilha o Dockerfile)
