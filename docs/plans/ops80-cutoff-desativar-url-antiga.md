# Cutoff de transição (fase 1) — desativar o acesso ao site pela URL pt.jorgesolla.com.br (congelar a fonte)

Status: rascunho
Atualizado em: 2026-08-23
Issue: #796
Priority: P1
Impeccable: A — sem UI
Rascunho UI: N/A — sem UI
Appetite: ~1 dia eng; um outcome verificável (a URL antiga deixa de servir o app — fonte congelada, sem escritas novas)
Responsável: —

## Intenção

A transição acabou: o site novo vive em `jorgesolla1313.com.br` (homeserver + túnel Cloudflare), mas `pt.jorgesolla.com.br` continua no ar servindo o app pela plataforma antiga (Vercel) — DUAS fontes de verdade, tráfego dividido, e qualquer dado gravado na URL antiga fica órfão da nova. **Fase 1 do cutoff (este item):** o site deixa de ser servido pela URL antiga — o que **congela a fonte** (nenhuma escrita nova na plataforma antiga). O redirecionamento NÃO entra aqui: ele acontece só DEPOIS da última migração de dados (OPS79), na fase 2 (OPS81) — decisão do humano, para ninguém cair no domínio canônico antes de ele ter os dados finais.

## Persona e fluxo

- **Persona / contexto:** (1) time de campanha — assessores e lideranças que ainda usam `pt.jorgesolla.com.br/campanha`; (2) ops/eng — hoje obrigada a manter e vigiar duas plataformas.
- **Job principal:** congelar a plataforma antiga — parar de servir o app pela URL antiga e impedir qualquer escrita nova — abrindo caminho para a última migração (OPS79) sobre uma fonte estável.
- **Fluxo desejado:** o cutoff desliga o app na URL antiga (fonte congelada) → OPS79 captura o estado final e traz para a nova → (fase 2, OPS81) a URL antiga passa a redirecionar para a canônica. Neste item, a URL antiga fica num estado de transição (fora do ar/sem interação), não servindo o app nem ainda redirecionando.
- **Anti-goals de produto:** não deixar a URL antiga servindo o app em qualquer pedaço; não redirecionar já (redirect é OPS81, pós-migração); não interromper o acesso do time a `/campanha` **no domínio canônico** (que segue no ar normalmente).

## Objetivo e aceite

- `pt.jorgesolla.com.br` deixa de servir o app — um acesso pela URL antiga **não** inicia mais sessão, formulário ou qualquer escrita (fonte congelada).
- Nenhuma escrita nova é possível via URL antiga a partir do cutoff — o gap "dados novos entre a última migração e a desativação" fica estruturalmente impossível.
- A URL antiga **não** redireciona ainda para o canônico (isso é OPS81, após OPS79) — estado de transição aceito, janela curta.
- A vertical de campanha no domínio canônico (`jorgesolla1313.com.br/campanha`) continua funcionando sem regressão.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** o cutoff é uma decisão de política (uma única fonte de verdade), não de dado.
- **Forma:** *adiada ao plano de implementação* — sem restrição de produto além do acima.

## Direção no codebase (hipótese)

- **Áreas prováveis:** superfície que referencia `pt.jorgesolla.com.br` no repo — scripts de verificação (`scripts/check-push-chain.mjs`), testes unit/int (WebAuthn config, json mutation route, multi-phones, aiMarkdownLinks), docs históricos (ops50/51, c98-impl, revalidate-secret, push-notificacoes, c115, CUTOVER-MAIN-ONLY) e personas de agentes (`.opencode/agent/`). A desativação em si é infra de hosting (Vercel/DNS), fora do app.
- **Precedente a olhar:** histórico de OPS50 (remoção de artefatos Vercel), OPS51/OPS52 (cutover adiado, "Excluir a store do Vercel Blob — só após cutover estável").
- **Risco de acoplamento:** a URL canônica (`NEXT_PUBLIC_SITE_URL`) já é obrigatória em prod e governa invite, calendarFeed, syncs, passwordReset e WebAuthn — o executor deve manter o app 100% canônico e não criar caminhos dependentes da URL antiga.

## Dependências

- **Nenhuma** — este item é o PRIMEIRO da sequência do cutoff (desativação → migração → redirect).
- OPS79 (migração) **depende** deste: a fonte precisa estar congelada antes da última migração.

## Fora de escopo

- Última migração de dados (OPS79) — roda depois, sobre a fonte congelada.
- Redirecionamento da URL antiga (OPS81) — só após a migração.
- Cancelamento financeiro das contas Neon/Vercel — decisão de infra pós-cutoff, fora deste item.
- Remoção de `@vercel/analytics`/`@vercel/speed-insights` — não relacionada ao domínio.
- SEO/canonical tags do site público — não é este item.

## Rabbit holes de produto

- **Manter a plataforma antiga viva "por precaução".** Se alguém "só completar" mantendo a Vercel no ar, seguem duas fontes de verdade e o congelamento não acontece. **Corte neste item:** a URL antiga deixa de servir o app; ponto.
- **Já redirecionar na fase 1.** Apressar o redirect deixaria o canônico (ainda sem a migração) como destino de quem vem da URL antiga — exatamente o gap de dados intermediários que o humano quer evitar. **Corte:** o redirect é OPS81, após OPS79.
- **SEO/canonical vira redesenho.** Melhorar ranking/`<link rel=canonical>` do site público é outro esforço. **Corte neste item:** foco na transição de domínio; SEO é plano próprio.

## Questões em aberto (produto)

- **O que a URL antiga deve responder no intervalo até o redirect (OPS81)?** **Opções:** (A) estado neutro estático (hold: "site em migração", sem formulários/escritas); (B) fora do ar (não responde / erro). **Recomendação:** (A) — informa quem caiu de paraquedas sem servir o app nem aceitar escrita; janela curta, em seguida OPS79 migra e OPS81 redireciona. _(assumido — validar com produto)_
- **Como efetivar a desativação?** **Opções:** (A) remover o domínio/alias da plataforma antiga (Vercel) e derrubar o deployment; (B) repontar DNS para estado morto. **Recomendação:** decisão do executor; o requisito é o app não servir a URL antiga e nenhuma escrita ser possível.

## Referências

- Estado vivo (2026-08-23): `pt.jorgesolla.com.br` responde 200 via Vercel; `jorgesolla1313.com.br` responde 200 via Cloudflare (túnel do homeserver); sem host-redirect no app.
- Superfície que referencia a URL antiga no repo: `scripts/check-push-chain.mjs:13,47,49`; `tests/unit/campaignWebAuthnConfig.unit.spec.ts:17-52`; `tests/unit/campaignJsonMutationRoute.unit.spec.ts:27,54`; `tests/int/campaignMultiPhones.int.spec.ts:336`; `tests/unit/aiMarkdownLinks.unit.spec.ts:66`; `.opencode/agent/designer-campanha-solla.md:9,21`; `.opencode/agent/solla-comunicacao.md:19`.
- Docs históricos do cutover: `docs/plans/ops50*`, `ops51*`, `ops52-...-impl.md` (linha 104 — Vercel Blob pós-cutover), `CUTOVER-MAIN-ONLY.md`.
- `AGENTS.md` (Teqo context) — OPS50 removeu artefatos Vercel; `NEXT_PUBLIC_SITE_URL` obrigatória em prod via `getCampaignInviteBaseURL`.
