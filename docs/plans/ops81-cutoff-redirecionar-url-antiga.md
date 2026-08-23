# Cutoff de transição (fase 2) — redirecionar pt.jorgesolla.com.br/campanha para jorgesolla1313.com.br/campanha

Status: rascunho
Atualizado em: 2026-08-23
Issue: #798
Priority: P1
Impeccable: A — sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável (a URL antiga termina na canônica, com path preservado)
Responsável: —

## Intenção

Depois da desativação (OPS80, que congelou a fonte) e da última migração de dados (OPS79), falta a **fase 2 do cutoff**: dar vida útil à URL antiga como mero redirecionador. Quem ainda acessar `pt.jorgesolla.com.br/campanha` — bookmarks, links de WhatsApp/QR, material impresso — cai direto na vertical de campanha do domínio canônico `jorgesolla1313.com.br/campanha`. O redirecionamento vem SÓ depois da migração, por decisão do humano: assim ninguém cai no canônico antes de ele ter os dados finais (nenhum "dado intermediário" fica de fora da leitura).

## Persona e fluxo

- **Persona / contexto:** (1) time de campanha — assessores e lideranças com bookmarks/links antigos, em campo, acessando `/campanha` no celular; (2) visitante público com link antigo (WhatsApp/QR/email antigo); (3) ops/eng — fecha o cutoff com uma única fonte de verdade.
- **Job principal:** quem ainda usar a URL antiga chega ao destino certo na canônica — especialmente `/campanha` — sem página morta e sem dados faltando.
- **Fluxo desejado:** usuário abre/digita a URL antiga → é redirecionado para a URL canônica preservando o path (`/campanha` → `/campanha`) → segue navegando em `jorgesolla1313.com.br` com os dados finais já migrados.
- **Anti-goals de produto:** não deixar a URL antiga servindo o app em qualquer pedaço; não redirecionar antes da migração (a ordem desativação→migração→redirect é decisão do humano); não transformar o cutoff num redesenho de SEO/canonical.

## Objetivo e aceite

- `pt.jorgesolla.com.br/campanha` redireciona para `jorgesolla1313.com.br/campanha` preservando o destino — o time segue operando com links antigos, sem perder sessão de trabalho.
- Idealmente toda rota da URL antiga redireciona para a canônica com path preservado (o resto do site também deixa de ter URL morta) — `/campanha` é o caso obrigatório.
- A URL antiga continua **não** servindo o app (nenhuma escrita possível — fonte segue congelada).
- A vertical de campanha no domínio canônico continua funcionando — WebAuthn e sessão seguem válidas no host que serve a página (rpID/origin casam com o domínio canônico), sem regressão.
- Ops/eng deixa de manter a URL antiga como plataforma viva (deixa de existir decisão de "qual URL é a canônica").

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** nenhuma decisão de produto depende de métrica aqui; o cutoff é uma decisão de política (uma única fonte de verdade), não de dado.
- **Forma:** *adiada ao plano de implementação* — sem restrição de produto além do acima.

## Direção no codebase (hipótese)

- **Áreas prováveis:** infra de hosting da URL antiga (o redirecionador roda fora do app — Cloudflare/DNS/host estático; o repo não tem host-redirect hoje, sem `src/middleware.ts`/`proxy.ts`; todos os `redirect()` são por path relativo). Superfície de repo a rever: `scripts/check-push-chain.mjs`, testes unit/int que pinam a URL antiga e docs/personas de agentes (`.opencode/agent/`).
- **Precedente a olhar:** histórico de OPS50 (remoção de artefatos Vercel), OPS51/OPS52 (cutover adiado).
- **Risco de acoplamento:** a URL canônica (`NEXT_PUBLIC_SITE_URL`) já é obrigatória em prod e governa invite, calendarFeed, syncs, passwordReset e WebAuthn — o executor deve manter o app 100% canônico e não criar caminhos dependentes da URL antiga.

## Dependências

- **OPS79 (dura)** — o redirecionamento só acontece DEPOIS da última migração: quem cair no canônico precisa já ver os dados finais. Sem isso, o redirect criaria o exato gap de dados intermediários que a ordem desativação→migração→redirect evita.
- OPS80 (desativação) é pré-requisito estrutural da sequência (já concluído quando este item roda).

## Fora de escopo

- Desativação da URL antiga (OPS80) — já feita, fase 1.
- Última migração de dados (OPS79) — já feita, entre as duas fases.
- Cancelamento financeiro das contas Neon/Vercel — decisão de infra pós-cutoff, fora deste item.
- Remoção de `@vercel/analytics`/`@vercel/speed-insights` — não relacionada ao domínio.
- SEO/canonical tags do site público — não é este item.

## Rabbit holes de produto

- **Redirecionar só `/campanha`.** Deixaria o resto da URL antiga morto sem destino — usuário com link antigo de artigo/capa cairia em erro. **Corte neste item:** path preservado para todas as rotas; `/campanha` é o caso obrigatório, o resto é grátis.
- **Redirecionar antes da migração.** Apressar o redirect devolveria o canônico sem os dados finais para quem vem da URL antiga. **Corte:** ordem travada — desativação (OPS80) → migração (OPS79) → redirect (este item).
- **SEO/canonical vira redesenho.** Melhorar ranking/`<link rel=canonical>` do site público é outro esforço. **Corte neste item:** foco na transição de domínio; SEO é plano próprio.

## Questões em aberto (produto)

- **Redirecionar TODAS as rotas da URL antiga ou só `/campanha`?** **Opções:** (A) todas as rotas, preservando path; (B) só `/campanha`. **Recomendação:** (A) — `/campanha` é caso obrigatório; o resto é grátis e elimina qualquer URL morta. _(assumido — validar com produto)_
- **Onde terminar o redirecionamento?** **Opções:** (A) no nível de hosting/DNS (fora do app); (B) dentro do app. **Recomendação:** (A) — o app continua 100% canônico e o cutoff não depende de deploy; decisão de onde exatamente é do executor. _(assumido — validar com produto)_

## Referências

- Estado vivo (2026-08-23): `pt.jorgesolla.com.br` responde 200 via Vercel (antes da fase 1); `jorgesolla1313.com.br` responde 200 via Cloudflare (túnel do homeserver); sem host-redirect no app.
- Superfície que referencia a URL antiga no repo: `scripts/check-push-chain.mjs:13,47,49`; `tests/unit/campaignWebAuthnConfig.unit.spec.ts:17-52`; `tests/unit/campaignJsonMutationRoute.unit.spec.ts:27,54`; `tests/int/campaignMultiPhones.int.spec.ts:336`; `tests/unit/aiMarkdownLinks.unit.spec.ts:66`; `.opencode/agent/designer-campanha-solla.md:9,21`; `.opencode/agent/solla-comunicacao.md:19`.
- Docs históricos do cutover: `docs/plans/ops50*`, `ops51*`, `ops52-...-impl.md` (linha 104 — Vercel Blob pós-cutover), `CUTOVER-MAIN-ONLY.md`.
- `AGENTS.md` (Teqo context) — OPS50 removeu artefatos Vercel; `NEXT_PUBLIC_SITE_URL` obrigatória em prod via `getCampaignInviteBaseURL`.
