# C247 — Ligar/desligar globais públicos fora do admin (revalidação + ops)

Status: rascunho
Atualizado em: 2026-10-01
Issue: #1419
Priority: P3
Impeccable: A — sem UI
Design UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável — a ops muda uma flag pública por CLI e o site reflete sem depender do admin
Responsável: —

## Intenção

Na abertura do C242 as ops descobriram um atrito real: o update do global `photoAlbum` (canal de remoção, `selfieSearchEnabled`) foi feito por CLI/script, mas o **cache do global** (`unstable_cache`, tag `global_photoAlbum`) só é revalidado pelo `afterChange` **dentro do processo Next** — a allowlist do `POST /api/revalidate` não cobre tags de globais (só `global_privacy-policy` e afins). Na prática: a ops não consegue ligar/desligar a busca por selfie por CLI; precisou do clique no admin. Este item dá à ops um caminho de primeira classe, com guardas, para flags públicas operadas fora do admin.

## Persona e fluxo

- **Persona / contexto:** operador (homeserver/CLI) que precisa abrir/fechar uma superfície pública sem depender do navegador/admin.
- **Job principal:** mudar a flag e ver o efeito no site em segundos, com registro e rollback.
- **Fluxo desejado:** roda o comando com a flag nova e as guardas → grava o global pelo Local API → busta a(s) tag(s) do global no servidor → confere em `/fotos`, `/fotos/encontre` e na home.
- **Anti-goals de produto:** abrir SQL cru; criar segundo caminho de permissão; expor segredo no log.

## Objetivo e aceite

- Comando de ops (ex.: `pnpm ops:global photoAlbum --selfie-search on`) que atualiza o global com `overrideAccess` e **revalida a tag do global** no processo servidor (via allowlist do `/api/revalidate` derivada de `getGlobalCacheTag`, ou rota de ops dedicada com segredo).
- Efeito visível em ≤60 s em `/fotos`, `/fotos/encontre` e na home (entrada/seção), sem restart.
- Guardas de escrita existentes (`TEQO_ENV` casando o banco, `*_CONFIRM=1` fora do dev local), recibo e rollback (mesmo comando com o valor anterior).
- A allowlist continua fechada: só tags de globais/superfícies explicitamente permitidas; nada de tag arbitrária.

## Dados (intenção)

- **Vou apresentar dados?** Não — operação.

## Dados da decisão (literais)

- **Achado da abertura do C242 (2026-10-01):** update de global por CLI não revalida o cache do servidor; a ops teve de usar o admin para ligar `selfieSearchEnabled`.
- **Allowlist atual:** `posts`, `global_privacy-policy`, `election-tse`, `municipality-catalog`, `social-feed`, `archivePhotos`, `contentPieces` — sem tags de globais operacionais.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/revalidateRequest.ts` (allowlist derivada de `getGlobalCacheTag` para os globais públicos operacionais), `src/utilities/globals.ts` (tag owner), script novo `scripts/ops-global.mjs` (padrão de guardas/recibos das CLIs).
- **Precedente:** `SocialFeedSettings` (revalidação de global) e as CLIs de ops do C230/C242 (`assertEnvironmentDatabaseTarget`, `assertWriteConfirm`).
- **Risco de acoplamento:** allowlist é superfície de segurança do endpoint; manter a lista explícita e testada (unit) e nunca aceitar tag arbitrária; o script precisa do segredo do endpoint no ambiente do alvo.

## Dependências

- Nenhuma dura (independente); nasceu do C242.

## Fora de escopo

- UI de ops, botões no admin, exposição de flags ao público.

## Rabbit holes de produto

- **"Só completar" com uma API genérica de revalidação.** **Corte:** allowlist fechada por tag explícita.
- **"Só completar" gravando por SQL.** **Corte:** sempre Local API (hooks/versões).

## Questões em aberto (produto)

- **Quais globais entram na allowlist?** **Recomendação:** os operacionais públicos (`photoAlbum`, `site-settings`, `home-page`, `metadata`) — nada além. _(assumido — validar)_

## Referências

- `docs/plans/busca-selfie-escopo-b-impl.md` (C242 — o atrito observado)
- `src/utilities/revalidateRequest.ts` · `src/utilities/globals.ts` · `src/app/(frontend)/api/revalidate/route.ts`

## Self-score (shaping)

5/5 — (1) outcome verificável (flag muda por CLI e o site reflete); (2) appetite pequeno; (3) persona/job/aceite claros; (4) direção com donos e precedentes; (5) achado real de ops registrado.
