# Impl: P6-2 — page-gate dodge on /campanha/perfil

Status: aprovado
Atualizado em: 2026-08-25
Intenção: docs/plans/entrega-engenharia-p6.md
Appetite restante: 0.5 dia

## Leitura da intenção

- **Outcome:** `perfil/page.tsx` passa a obter o ator pelo `requireCampaignPageActor` (P3-I), e o guard de convenção deixa de ser dodge-ável por variante de nome de `getCampaignUser*`.
- **O que NÃO negociar:** sem migration, sem mudança de URL (`/campanha/perfil`), guard classe 3, líder "as good or better" (nunca tela em branco).
- **O que reavaliar:** gate `noLeader` em /perfil quebraria reset de senha e self-service do líder (`redefinir-senha/page.tsx:31`, `esqueci-senha/page.tsx:20`, `actions/password.ts:137` redirecionam para `/campanha/perfil`) — **sem gate** (precedente `meus-contatos/page.tsx:16`).

## Abordagem recomendada

**Opções consideradas:** A | B | C
**Recomendação:** **C** — `requireCampaignPageActor` ganha opção `withAvatar?: boolean`; a página chama só o helper e o guard alarga o regex sem allowlist.
**Rejeitadas:** A (mantém a chamada variante na página — exige allowlist + 1 leitura extra por request); B (manter só `getCampaignUserWithAvatar` + redirect hand-rolled — perpetua a divergência P3-I).

### Componentes / mudanças

- **`requireCampaignPageActor`** (`src/utilities/campaignPageActor.ts`): opção `withAvatar?: boolean` — `const getter = options.withAvatar ? getCampaignUserWithAvatar : getCampaignUser`. Ambos retornam `AuthenticatedCampaignUser | null`; avatar só populado em runtime. Comentário justificando (shell de perfil renderiza `avatarUrl`; avatar depth-0 vira número ID). Atualizar doc-block das gates.
- **`perfil/page.tsx`**: `requireCampaignPageActor({ withAvatar: true })`; remove `redirect` manual, check `if (!user)` e import de `getCampaignUserWithAvatar`. VERIFICAR antes: nenhum outro `page.tsx` de `(app)` casa o regex alargado (`grep -rn "getCampaignUser[A-Za-z0-9]*(" src/app/\(campaign\)/campanha/\(app\) --include="page.tsx"`).
- **Guard** (`tests/unit/codebaseConventions.unit.spec.ts:528-548`): regex → `/getCampaignUser[A-Za-z0-9]*\(/` + prosa atualizada; `allowlist` continua vazia.
- **Testes:** caso unit novo no spec de gate de página/ator (`withAvatar: true` usa o getter de avatar e redireciona quando null).
- **Migration:** sem migration. **Access/Consent:** sem mudança.

## Fases verificáveis

1. **Helper + página** — `withAvatar` + troca na página + caso unit.
2. **Guard** — alargar regex; `pnpm vitest run tests/unit/codebaseConventions.unit.spec.ts` bare.
3. **Gates** — `pnpm gate:fast`; push via `pnpm push`.

## Rabbit holes / Não escopo

- Migrar o layout para `requireCampaignPageActor` (layout não é route page; fora do finding).
- Gate `noLeader` em /perfil (decisão de produto, não engenharia).
- Derivar `getCampaignUserWithAvatar` de `getCampaignUser` via `depth` opcional (refactor além do finding).

## Riscos e mitigação

- Dois getters, mesmo tipo de retorno — `tsc --noEmit` valida.
- Guard alargado pegando página futura legítima: fail-closed é desejado; saída = allowlist com razão.
- Regressão de avatar: `withAvatar: true` preserva o comportamento atual.

## Aceite de engenharia

- [x] Aceite de produto coberto (perfil alcançável por todos os roles autenticados)
- [x] Invariantes AGENTS/engineering-standards (sem migration, URL intacta, prologue único)
- [x] Testes previstos: caso unit `withAvatar` + spec de convenção verde

Self-score decision-quality: 5/5
