# Runbook — Feed do Instagram: validar/gerar o token (S11)

Issue: #115 · Entrega: S11 (painel de status da sincronização no admin)

## O que o painel mostra

Na global **Configurações → Feed de redes sociais**, o bloco "Instagram — estado
da sincronização" diz o estado da última tentativa:

| Estado                                  | Significado                                                               | Ação                                                               |
| --------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Sincronizado · há X min · N posts**   | Credenciais aceitas; posts no board "Acompanhe de perto"                  | Nenhuma                                                            |
| **Falha na última sincronização**       | A Graph API recusou a última tentativa; o texto diz o motivo e a correção | Corrigir conforme o motivo e clicar **Tentar sincronizar de novo** |
| **Instagram ainda não configurado**     | Falta token ou ID                                                         | Preencher os dois campos                                           |
| **Aguardando a primeira sincronização** | Configurado, nenhuma tentativa ainda                                      | Clicar **Tentar sincronizar de novo**                              |

O estado é atualizado no salvar (quando as credenciais mudam), em cada render da
home (cache de 5 min) e no clique do botão. A home pública nunca quebra quando a
API falha — o board segue com artigos + YouTube.

## Diagnóstico da ocorrência de 2026-08-19 (causa provável)

Produção mostrava picker vazio e nenhum card IG com token + ID preenchidos — o
fail-closed silencioso da S3 não dizia o porquê. A causa mais provável, na ordem:

1. **Token emitido via Facebook Login** (page token) — a `graph.instagram.com`
   recusa; o refresh automático não renova (o endpoint `refresh_access_token`
   só aceita tokens do Instagram Login).
2. **Token expirado/revogado**.
3. **ID do usuário errado** (não é o da conta Business/Creator vinculada).

**Confirmação em 1 clique:** no admin, **Tentar sincronizar de novo** — o painel
mostra o motivo exato devolvido pela API. Se a causa for a 1, aparece a mensagem
de token recusado com a correção; se for a 3, a mensagem de ID não reconhecido.

## Validar um token sem o admin

```bash
# O endpoint /me responde com o username e o tipo de conta se o token é válido
# para a Graph API do Instagram (Business/Creator):
curl -s "https://graph.instagram.com/me?fields=user_id,username&access_token=SEU_TOKEN"

# Teste o refresh (só tokens emitidos pelo Instagram Login passam):
curl -s "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=SEU_TOKEN"
```

- `/me` com `OAuthException` → token inválido/expirado ou emitido via
  **Facebook Login** (a Graph API do Instagram só aceita tokens do Instagram
  Login).
- `/me` ok mas o ID configurado não bate com `user_id` → corrigir o campo
  "ID do usuário".

## Gerar um token de longa duração (Instagram Login)

1. Acessar `developers.facebook.com` com a conta que administra a página →
   criar/usar um app do tipo **Business** (qualquer tipo serve para o fluxo de
   negócios, mas o app precisa estar em modo Live para uso fora do sandbox).
2. Produto **Instagram** → **Instagram Login with Basic Display** → **Gerar
   token** com a conta Business/Creator do @depjorgesolla.
3. Trocar o token de curta duração pelo de longa duração usando o
   **Long-Lived Token Exchange** da documentação do Instagram Basic Display
   (ou usar o endpoint `refresh_access_token` do passo anterior após a troca).
4. Colar o token e o ID numérico da conta no admin e clicar
   **Tentar sincronizar de novo**.

## O que NÃO fazer

- Não usar token da API Graph do Facebook (página) — o app recusa.
- Não colar o token em arquivos, Issues ou chat — o campo é admin-only e deve
  continuar.
- Não zerar o token para "testar" — o painel de status dispensa tentativa-e-erro.
