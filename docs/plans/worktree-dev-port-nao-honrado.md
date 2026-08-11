# OPS40 — worktree dev: `PORT` do `.env.local` não é honrado pelo `next dev`

Status: rascunho
Atualizado em: 2026-08-11
Issue: (OPS40 — a registrar)
Priority: P2
Model: composer-2.5
Impeccable: A — sem UI
Appetite: ~2–4h eng; um outcome verificável — dois worktrees em `pnpm dev` simultâneos não colidem na porta

## Intenção

O contrato de ambientes paralelos (OPS24/OPS26/OPS28, AGENTS.md "Per-worktree environments") promete um dev-server por worktree em `3100+slot` (ex.: C116 → 3216). O provisionador escreve `PORT=<port>` no `.env.local` do worktree — mas **`next dev` (Next 15.4.11) não honra `PORT` vindo de arquivo `.env`**: o startup log mostra "Local: http://localhost:3000" com `PORT=3216` presente no `.env.local` (evidência colhida na sessão do C116, 2026-08-11). Consequência: dois agentes com `pnpm dev` rodando colidem na porta 3000 (ou um rouba a porta do outro), quebrando o isolamento que o modelo paralelo vende. O e2e escapa do defeito porque o `playwright.config.ts` injeta `PORT` **explicitamente no env do webServer** — o caminho manual (`pnpm dev`) é o exposto.

## Objetivo e aceite

- `pnpm dev` num worktree provisionado sobe em `3100+slot` (a porta do `.env.local`), não em 3000.
- Dois worktrees com `pnpm dev` simultâneos não colidem (cada um na sua porta).
- O e2e (webServer com `PORT` explícito) e o main repo (`pnpm dev` em 3000) ficam intactos.
- O mecanismo escolhido não depende de o usuário lembrar `-p <port>`.

## Direção no codebase (hipótese)

- `package.json` script `dev` (`node scripts/guard-dev-db.mjs && cross-env NODE_OPTIONS=--no-deprecation next dev`) — o script pode derivar a porta do `.env.local` e passar `next dev -p <port>` (ou ler `process.env.PORT` — o cross-env repassa env do processo; o problema é o `next dev` ignorar env-file, então a porta precisa ir como **flag CLI**).
- Candidatos: (a) wrapper `scripts/dev.mjs` que lê `PORT` do `.env.local` (ou `process.env.PORT` via dotenv) e executa `next dev -p <port>`; (b) trocar `cross-env ... next dev` por `next dev -p "$PORT"` — mas `PORT` do arquivo `.env.local` não está no shell — precisaria de carga explícita; (c) o próprio Next respeitar `PORT` de env-file (upstream — não controlável).
- Verificar se o prewarm/setup e2e (que também usa `pnpm dev` como webServer command em dev-mode) não depende do comportamento atual.

## Fora de escopo

- Mudar como o Next resolve porta (upstream).
- Re-provisionar worktrees existentes (o `.env.local` já tem a porta certa; só o dev server a ignora).

## Rabbit holes

- Carregar `.env.local` duas vezes (guard + script) com ordens conflitantes — o wrapper deve ler a MESMA fonte que o provisionador escreveu (variável `PORT` do arquivo).
- Quebrar o e2e dev-mode: o webServer passa `PORT` no env do processo — se o script novo der prioridade ao `.env.local` sobre o env do processo, o e2e perderia a porta forçada. O wrapper deve dar prioridade ao `process.env.PORT` real (o que o webServer injeta) e cair no `.env.local` só quando ausente.

## Referências

- `scripts/lib/worktree-env.mjs` (escreve `PORT=${env.devPort}` no `.env.local`)
- `scripts/guard-dev-db.mjs` (preflight do `pnpm dev`)
- `playwright.config.ts` webServer (`env: { PORT: webServerPort }` — precedente do env explícito)
- Evidência da sessão C116: log `next dev` com "Local: http://localhost:3000" e `.env.local` com `PORT=3216`
