# Guide — Testar o feed do Instagram na home pública (S3)

Como o feed do Instagram chega à home e como validar cada peça do quebra-cabeça
quando "os posts não aparecem".

## Como funciona (o caminho que um post percorre)

1. A home de campanha renderiza o board **"Acompanhe de perto"**
   (`CampaignContentSection`). Ele só aparece se houver **algum** card visível
   (artigos + YouTube + Instagram).
2. O render chama `getInstagramFeed()` (`src/utilities/socialFeed/instagramFeedView.ts`),
   cacheado por 5 min na tag `social-feed`.
3. Ele lê a global **Configurações → Feed de redes sociais**
   (`/admin/globals/social-feed-settings`). Se `enabled` **e** `instagramEnabled`
   **e** token **e** user id estiverem preenchidos, chama a Instagram Graph API
   (`GET /{userId}` para o username e `GET /{userId}/media` para os posts).
4. Sucesso → grava o snapshot cru na global e o status de sincronização; o board
   mostra os posts elegíveis (menos os marcados em "Itens excluídos").
5. Falha → grava o **motivo** no status e o board cai no último snapshot (ou fica
   sem cards IG). **A home nunca quebra** — o erro é invisível na home, ele vive
   no painel de status do admin.

## O sinal mais rápido: o painel de status (admin)

Em `/admin` → **Configurações → Feed de redes sociais**, o bloco **"Instagram —
estado da sincronização"** é o diagnóstico em 1 clique:

| Painel mostra                           | Significado                                    | Ação                                                               |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| **Sincronizado · há X min · N posts**   | Credenciais aceitas; cards devem estar na home | Conferir a home (cache de 5 min)                                   |
| **Falha na última sincronização**       | A Graph API recusou; o texto diz o motivo      | Seguir a correção do texto e clicar **Tentar sincronizar de novo** |
| **Instagram ainda não configurado**     | Falta token ou user id                         | Preencher os dois campos                                           |
| **Aguardando a primeira sincronização** | Configurado, nunca tentou                      | Clicar **Tentar sincronizar de novo**                              |

O status é atualizado: no salvar da global (quando as credenciais mudam), em cada
render da home e no botão **Tentar sincronizar de novo**.

## Validar o token fora do admin

```bash
# Se responder com username + user_id, o token é válido para a Graph API do IG:
curl -s "https://graph.instagram.com/me?fields=user_id,username&access_token=SEU_TOKEN"

# Testa o refresh (só token emitido pelo Instagram Login passa):
curl -s "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=SEU_TOKEN"
```

- `/me` com `OAuthException` → token inválido/expirado **ou emitido via Facebook
  Login** (a Graph API do Instagram só aceita tokens do Instagram Login).
- `/me` ok mas o `user_id` devolvido não bate com o campo **"ID do usuário"** →
  corrigir o campo.

## Testar a home pública

1. Conferir o painel de status primeiro (acima).
2. Abrir a home e procurar o board "Acompanhe de perto". Os cards do Instagram
   têm badge **Instagram**, capa quadrada (1:1), legenda e data, e abrem o post
   em nova aba (`instagram.com`).
3. **Lembrete de cache:** o feed é cacheado por 5 min. Depois de salvar a global
   no admin o cache é invalidado sozinho; se a mudança foi feita direto no banco
   ou via seed, invalidar manualmente:
   ```bash
   curl -X POST "https://<dominio>/api/revalidate?tag=social-feed" \
     -H "x-revalidate-secret: $REVALIDATE_SECRET"
   ```
4. **A seção inteira pode estar ausente** por outro motivo: o board só renderiza
   se houver pelo menos um card (artigo visível, YouTube ou IG). Um feed IG vazio
   com artigos e YouTube desligados esconde a seção inteira — não é bug do IG.

## Testar localmente (stub determinístico)

Os e2e rodam contra um stub local da Graph API (`tests/e2e/instagram-stub.mjs`)
que responde `/media`, `/user`, `/refresh_access_token` e thumbnails com um
fixture fixo, com estados alternáveis:

```bash
pnpm test:e2e -- frontend.e2e.spec.ts   # inclui "renders the Instagram feed with exclusions"
```

O stub permite alternar estados (`ok | fail | invalid-token`) via
`POST /__stub/state` — útil para reproduzir fail-closed e snapshot sem rede.
Em dev manual, aponte `INSTAGRAM_API_BASE_URL` para o stub para exercitar o
fluxo sem tocar na API real.

## Checklist de "configurei e não aparece"

- [ ] Checkbox **Feed ativo** (`enabled`) marcado.
- [ ] Checkbox **Instagram ativo** (`instagramEnabled`) marcado.
- [ ] **Token de acesso** preenchido e emitido pelo **Instagram Login** (Basic
      Display), NÃO pela Facebook Login (page token) — este é o erro mais comum; o
      endpoint de refresh também recusa tokens do Facebook.
- [ ] **ID do usuário** é o numérico da conta Business/Creator (o `/me` acima
      confirma o `user_id` certo).
- [ ] O servidor alcança `graph.instagram.com` (em produção o container precisa
      de saída para a internet; localmente, proxy/firewall bloqueando também dá
      "Não foi possível falar com a API").
- [ ] O painel de status mostra **Sincronizado** (não "Falha" nem "Não configurado").
- [ ] Home publicada há mais de 5 min (ou cache invalidado via `?tag=social-feed`).
- [ ] Há ao menos um card visível no board (a seção inteira some com tudo vazio).
- [ ] Os posts não estão marcados em **Itens excluídos** (post de grade etc.).

Qualquer estado de falha, o painel de status mostra o motivo em linguagem de
produto — é por onde começar antes de culpar a configuração.

## Referências

- Runbook de token: `docs/ops/instagram-feed-token-runbook.md`
- Código: `src/utilities/socialFeed/instagramFeed.ts` (fetch/parse/erros),
  `instagramFeedView.ts` (loader cacheado), `instagramSync.ts` (sync do hook),
  `src/globals/SocialFeedSettings.ts` (campos do admin),
  `src/components/admin/InstagramSyncStatusPanel.tsx` (painel de status)
- Stub e2e: `tests/e2e/instagram-stub.mjs`, `tests/helpers/socialStub.ts`
