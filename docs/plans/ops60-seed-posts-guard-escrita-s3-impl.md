# Impl: OPS60 — Guard de intenção explícita para escrita no bucket via `db:seed:posts`

Status: aprovado (gate humano 2026-08-18)
Atualizado em: 2026-08-18
Issue: #49 (OPS60)
Intenção: docs/plans/ops60-seed-posts-guard-escrita-s3.md
Appetite restante: herdado (~0,5 dia — um outcome verificável; sem migration/UI)

## Leitura da intenção

- **Outcome:** o modo sync (padrão) do `pnpm db:seed:posts` só escreve media no
  bucket S3 das envs `S3_*` com **intenção explícita** — `SEED_MEDIA_CONFIRM=1`
  (mesmo padrão `isTruthyEnv` da #37) — e recusa com mensagem clara sem ela;
  `--dry-run` segue desprotegido (não escreve). O risco fechado: um worktree
  que receba credenciais `S3_*` de prod (cópia all-or-nothing do
  `worktree-env.mjs`) rodando o seed contra DB local sobrescreveria covers no
  bucket de **prod** — a mesma classe de risco que a #37 fechou para
  `media:recover`, ainda aberta no seed.
- **O que NÃO negociar:** fail-closed (sem flag → sem escrita no bucket, em
  qualquer cenário de DB/alvo); comportamento local sem `S3_*` (→ disk) e o
  upload via admin/CI de prod intactos; `--dry-run` sem fricção nova; guard no
  dono (`isTruthyEnv` em `cli.mjs`) — sem twin.
- **O que reavaliar:** a alternativa do aceite "**ou recusa apontar para bucket
  não-local**" — ver Opções (B).

## Abordagem recomendada

```mermaid
flowchart LR
  A[pnpm db:seed:posts] -->|parse args --dry-run| B{mode == sync?}
  B -->|não| C[segue — dry-run não escreve, sem guard]
  B -->|sim| D{S3_* completo?<br/>resolveS3StorageEnv.enabled}
  D -->|não| E[segue sem guard — storage local (disk)]
  D -->|sim| F{SEED_MEDIA_CONFIRM true/1?}
  F -->|não| G[die com o comando correto — antes de DB/rede]
  F -->|sim| H[guards existentes + echo do alvo + sync]
```

**Opções consideradas (forma do guard):**

- **A — Env flag `SEED_MEDIA_CONFIRM` (truthy `true|1` via `isTruthyEnv`)
  obrigatória no sync quando o storage S3 está ativo**
  (`resolveS3StorageEnv(process.env).enabled`). **Recomendada.**
- B — Recusar bucket não-local: allowlist de endpoints/buckets "locais" e die
  para qualquer outro alvo.
- C — Guard incondicional no sync (mesmo com storage local).

**Recomendação: A** — paridade total com o guard da #37 (`MEDIA_RECOVER_CONFIRM`)
e com o guard de DB (`ALLOW_REMOTE_DB`): funciona em runbook não-interativo
(SSH, `set -a; source teqo-1313.env`), a condição usa o dono já existente
(`resolveS3StorageEnv` — sem nova lógica de leitura de env), e a escrita que o
guard protege é exatamente a escrita no bucket (media via adapter S3), deixando
o fluxo dev local intocado.

**Rejeitadas:** B (o "local" do Garage é ambíguo por construção — o endpoint
varia por contexto: `host.docker.internal:3900` dentro do compose,
`100.119.220.31:3900` na workstation/tailnet, `127.0.0.1:3900` no host do
homeserver; uma allowlist de hosts teria que errar em algum lugar ou bloquear o
sync de prod legítimo — o guard da #37 já provou que a env flag é o padrão do
repo); C (quebraria o fluxo dev local: todo `db:seed:posts` exigiria a flag
mesmo sem bucket; o aceite pede explicitamente o comportamento local intacto).

### Componentes / mudanças

- **`scripts/seed-posts.mjs`** (extensão do dono — comportamento dev local
  inalterado; paridade estrutural com `scripts/recover-media.mjs:79-85`):
  - Constante `SEED_MEDIA_CONFIRM_FLAG = 'SEED_MEDIA_CONFIRM'`; import de
    `isTruthyEnv` (de `./lib/cli.mjs`) e `resolveS3StorageEnv` (de
    `../src/utilities/mediaStorage.ts`).
  - Imediatamente após o parsing de args/modo e **antes** de
    `assertLocalDatabase` / `getPayload` (fail fast — zero DB, zero rede):
    ```js
    const storage = resolveS3StorageEnv(process.env) // throws em S3_* parcial (fail-closed, mesmo contrato do boot)
    if (mode === 'sync' && storage.enabled && !isTruthyEnv(process.env[SEED_MEDIA_CONFIRM_FLAG])) {
      die(
        'o sync ESCREVE media no bucket S3 das envs S3_* — exige confirmação explícita de intenção.\n' +
          `  Re-rodar com: ${SEED_MEDIA_CONFIRM_FLAG}=1 pnpm db:seed:posts\n` +
          '  (ou use --dry-run para planejar sem escrever).',
      )
    }
    ```
  - Echo do alvo ganha `Bucket`/`Endpoint` quando `storage.enabled` (paridade
    com o `targetSummary` do `recover-media.mjs`).
  - Bloco de comentário do header (safety model + usage) atualizado para
    documentar o guard.
  - O gate vale para sync com QUALQUER alvo de DB (local ou remoto) — o risco
    é a escrita no bucket, não a origem dos dados (mesma decisão da #37).
- **`package.json`:** nada — a flag é env, não arg do script.
- **Migration:** nenhuma. **Access / Consent:** intocados. **UI:** N/A
  (Impeccable A — conteúdo/operação).
- **Docs:** runbook do `docs/plans/ops58-sincronizar-posts-prod-impl.md`
  (passo 3 do runbook ganha `SEED_MEDIA_CONFIRM=1` + nota OPS60; passo 2
  pre-flight ganha nota de que o dry-run segue sem a flag — não escreve);
  nota curta no AGENTS.md (§ "Seeding news content" — sync com
  `S3_*` exige `SEED_MEDIA_CONFIRM=1`; `--dry-run` segue sem flag); entrada
  `docs/changelog/2026-08-18-ops60.md` + `pnpm changelog:build`.

## Fases verificáveis

1. **Guard no script** — `seed-posts.mjs` (gate + echo + header doc).
   Validação de comportamento contra o DB local do worktree:
   - Sem `S3_*`: `pnpm db:seed:posts` e `pnpm db:seed:posts --dry-run` seguem
     exatamente como hoje (sem flag exigida).
   - Com `S3_*` fake (ex.: `S3_BUCKET=teqo-media-test
S3_ENDPOINT=http://127.0.0.1:9 S3_ACCESS_KEY_ID=x S3_SECRET_ACCESS_KEY=x`):
     sync → exit 1 com a mensagem do guard, **antes** de qualquer escrita
     (conferir via contagem de posts/tags antes/depois — zero delta);
     `--dry-run` com as mesmas envs → segue plan-only sem exigir flag.
2. **Docs + changelog** — runbook OPS58 (passo 3 + nota), AGENTS.md,
   `docs/changelog/2026-08-18-ops60.md`, `pnpm changelog:build` +
   `pnpm changelog:check`.
3. **Gates finais** — `pnpm gate:fast`, `pnpm format:check`, `pnpm exec knip`,
   `pnpm check:cycles`, `pnpm test` (unit+int), `pnpm build` local; PR → CI
   verde → merge em `main` (deploy automático OPS53).

## Rabbit holes / Não escopo (engenharia)

- **Testar o sync com S3 ponta a ponta** — impossível por contrato (sem
  `S3_*` de prod nesta máquina; e o guard bloqueia o caminho por design); a
  prova do caminho liberado é o runbook do homeserver (padrão OPS52 fase 3).
- **Teste unitário do gate inline** — mesmo padrão do `recover-media.mjs`
  (parse inline, sem teste dedicado; decisões OPS52-media-guard e OPS58); a
  semântica do flag já é unit-testada em `cliEnvFlags.unit.spec.ts`.
- **Guard para `--dry-run`** — não: não escreve; o aceite pede explicitamente
  preservar a semântica atual do dry-run.
- **Banir re-escritas `=== '1'`/`=== 'true'` de env-read** no
  `codebaseConventions` — defer registrado na intenção (gatilho: 4º site ou
  refactor dos 3 existentes); não reabrir.

## Riscos e mitigação

- **R1 — S3\_\* parcial no env local derruba o seed.** Já acontece hoje: o
  `payload.config.ts` resolve `mediaStorage` no import e aborta em config
  parcial (fail-closed de boot, OPS52); a chamada de `resolveS3StorageEnv` no
  guard tem o mesmo contrato e ocorre depois desse import — comportamento
  inalterado, agora com mensagem explícita do dono.
- **R2 — Runbook de prod desatualizado manda rodar o sync sem a flag e o
  guard recusa (fricção na próxima execução).** Mitigação: runbook OPS58
  editado no mesmo PR; mensagem do die exibe o comando correto.
- **R3 — A flag vaza para outros modos (dry-run).** Mitigação: condição
  restrita a `mode === 'sync' && storage.enabled`; o dry-run é validado com
  `S3_*` fake na fase 1.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: sync com `S3_*` recusa sem
      `SEED_MEDIA_CONFIRM=1` (fail-closed); dry-run e storage local
      desprotegidos; admin/CI de prod intocados
- [ ] Invariantes AGENTS/engineering-standards: identificadores em inglês;
      guard reusado do dono (`isTruthyEnv`/`resolveS3StorageEnv`) sem twin;
      zero migration/access/Consent
- [ ] Testes/validação de domínio: die do guard com `S3_*` fake (zero delta
      de rows no DB local); dry-run com `S3_*` fake segue plan-only; gates da
      checklist do AGENTS
- [ ] Docs: runbook OPS58 atualizado (comando real com a flag) + nota
      AGENTS.md + changelog
