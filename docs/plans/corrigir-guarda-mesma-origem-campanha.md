# Corrigir guarda de mesma-origem do CSRF em /campanha atrás do túnel

Status: rascunho
Atualizado em: 2026-08-25
Issue: #913
Priority: P1
Impeccable: A — N/A (correção de guarda server-side; sem UI nova)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; sem migration, sem collection; um outcome verificável
Responsável: —

## Intenção

Em produção, salvar a estimativa de votos de um município (`/campanha/municipios/pledge-estimated-votes`) falha com "Requisição inválida." para o coordenador. A mensagem vem da guarda de CSRF de mesma-origem que todo `POST /campanha/**` compartilha: ela compara o header `Origin` do navegador com `request.url` **diretamente**. Atrás do túnel Cloudflare (homeserver), `request.url` chega com a origem interna (ex.: `http://localhost:3000`), enquanto o navegador envia `Origin: https://jorgesolla1313.com.br` → mismatch → 403 "Requisição inválida."

O repositório já tem um resolvedor de origem pública consciente de proxy (`src/utilities/campaignInviteOrigin.ts`, via `x-forwarded-proto`/`x-forwarded-host` e `NEXT_PUBLIC_SITE_URL`), mas a guarda ignora esse padrão e confia no `request.url` cru. A correção é alinhar a guarda a esse padrão.

## Persona e fluxo

- **Persona / contexto:** coordenador (ou assessor) editando a célula "estimativa de votos" de um município no `/campanha`, em produção (atrás do túnel).
- **Job principal:** alterar a estimativa e ver o salvamento automático confirmar, sem erro.
- **Fluxo desejado:** abrir popover → mudar valor → autosave → "Estimativa atualizada." (sem "Requisição inválida.").
- **Anti-goals de produto:** não relaxar a guarda para aceitar qualquer origem (continua CSRF); não quebrar dev/local (`localhost` ainda casa); não mover a lógica para cada rota.

### Esboço de fluxo

```text
[coordenador edita estimativa] → POST /campanha/municipios/pledge-estimated-votes
  → guarda de mesma-origem compara Origin c/ origem pública resolvida (proxy-aware)
  → 200 + "Estimativa atualizada."  (hoje: 403 "Requisição inválida.")
```

## Objetivo e aceite

- O autosave de estimativa de votos (e, por tabela, todo `POST /campanha/**` que passa pela mesma guarda) funciona em produção atrás do túnel, sem "Requisição inválida.".
- A guarda continua rejeitando origens cruzadas (CSRF mantido).
- Em dev/test local (`localhost`, com ou sem TLS), a guarda continua aprovando as requisições do próprio app.
- Não há regressão em `campaignInviteOrigin.ts` nem em outras rotas que o usam.

## Dados (intenção)

- **Vou apresentar dados?** Não (correção de comportamento de guarda; sem métrica nova).
- **Decisões desbloqueadas:** o executor usa o resolvedor de origem já existente no repo, não inventa outro.
- **Forma:** adiada ao plano de implementação.

## Dados da decisão (literais)

- A guarda de mesma-origem (`src/utilities/sameOriginRequest.ts`, consumida por `src/utilities/campaignJsonMutationRoute.ts`) deve resolver a origem "do servidor" usando os **mesmos** campos do padrão estabelecido em `src/utilities/campaignInviteOrigin.ts`: `x-forwarded-proto` + `x-forwarded-host` (ou `host` como fallback), caindo para `NEXT_PUBLIC_SITE_URL` em produção — e não `request.url` cru.
- O `Origin` do navegador continua comparado a essa origem resolvida; ausência de `Origin` (navegação same-site) continua aprovando.
- `localhost`/`127.0.0.1` (dev/test) deve continuar casando com a origem resolvida local.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/sameOriginRequest.ts` (alvo da correção), `src/utilities/campaignJsonMutationRoute.ts` (consumidor), `src/utilities/campaignInviteOrigin.ts` (precedente a reutilizar).
- **Precedente a olhar:** `campaignInviteOrigin.ts` já resolve origem pública atrás de proxy — reutilizar, não duplicar.
- **Risco de acoplamento:** manter a guarda como ponto único (o `tests/unit/codebaseConventions.unit.spec.ts` exige que rotas passem por `campaignJsonMutationRoute`); não espalhar a correção nas rotas.

## Dependências

- Nenhuma (bug isolado na guarda).

## Fora de escopo

- Mudança de UI das células de voto (popover/sheet) — não há alteração visual.
- Outros problemas de autosave (ex.: schema, acesso por role) — separar em Issue própria se confirmados.

## Rabbit holes de produto

- **Relaxar a guarda para aceitar qualquer origem.** Se alguém "só completar": abre CSRF em cookie-auth. **Corte neste item:** só alinhar a origem resolvida ao padrão do repo; rejeição de cross-origin permanece.
- **Criar um segundo resolvedor de origem.** **Corte:** reutilizar `campaignInviteOrigin`/padrão existente.

## Questões em aberto (produto)

- **Ajustar a guarda para comparar contra `NEXT_PUBLIC_SITE_URL` em produção, ou contra os headers `x-forwarded-*`?** **Recomendação:** usar os headers `x-forwarded-*` com fallback para `NEXT_PUBLIC_SITE_URL` (espelha `campaignInviteOrigin`) — cobre o túnel e dev local. _(assumido — validar com produto no gate)_.

## Referências

- `src/utilities/sameOriginRequest.ts` — guarda atual (linha 9-16, retorna "Requisição inválida." em `campaignJsonMutationRoute.ts:100`).
- `src/utilities/campaignJsonMutationRoute.ts` — wrapper único das rotas JSON de `/campanha`.
- `src/utilities/campaignInviteOrigin.ts` — resolvedor de origem pública proxy-aware já existente.
- `src/app/(campaign)/campanha/(app)/municipios/pledge-estimated-votes/route.ts` — rota que falha em prod.
