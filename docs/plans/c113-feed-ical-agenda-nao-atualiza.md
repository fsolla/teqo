# C113 — Feed iCal da agenda congela na criação do link: eventos novos não aparecem

Status: rascunho
Atualizado em: 2026-08-10
Issue: #631
Priority: P1
Model: composer-2.5
Impeccable: A — N/A sem UI (defeito de servidor; superfície intacta)
Canvas UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável

## Intenção

A promessa central do "link de import" (C16) é sincronizar: quem assina o link recebe a agenda da campanha e ela acompanha o dia a dia. Hoje o feed só exporta os eventos que já existiam **no momento da criação do link** — compromissos criados depois nunca aparecem na agenda pessoal de quem assinou. A sincronia está quebrada no primeiro elo: o servidor serve um snapshot congelado do feed.

Observação (direção, não diagnóstico fechado — quem executa confirma): a rota que serve o iCal é uma `GET` handler do Next.js **sem nenhuma marcação de dinamismo** (`force-dynamic`/`revalidate`), e o App Router cacheia respostas `GET` de route handlers por padrão; a primeira busca (no momento em que o link é assinado/aberto) vira o conteúdo servido para sempre. O header `Cache-Control: public, max-age=3600` na resposta ainda instrui clientes/CDN a guardar por 1h. A query do feed (`loadFeedActivities`) roda viva contra o banco a cada request — o problema é o elo entre a resposta e quem a consome, não a leitura.

## Persona e fluxo

- **Persona / contexto:** coordenação/assessoria cria o link e distribui para a rede (ex.: Google Calendar); quem assina quer a agenda da campanha viva no celular.
- **Job principal:** assinar uma vez e todo compromisso novo (e toda edição/cancelamento) aparecer na agenda pessoal, sem nova ação.
- **Fluxo desejado:** criar link → assinar no Google Calendar → criar um compromisso em `/campanha/agenda` → dentro da cadência de atualização do cliente (Google re-busca feeds públicos periodicamente), o compromisso aparece na agenda pessoal. Edição de título/horário e cancelamento refletem igualmente (o `UID` estável = `slug` do evento já dá isso no formato iCal).
- **Anti-goals de produto:** não é sync bidirecional (a agenda pessoal do assinante não volta para a campanha); não é push em tempo real; não é controlar a cadência do Google Calendar.

### Esboço de fluxo (A — omitido; sem UI)

## Objetivo e aceite

- Um compromisso criado **depois** da criação do link aparece no iCal servido pelo mesmo link (prova: `GET` no URL do feed → criar atividade → `GET` de novo → ambos os eventos presentes; o primeiro `GET` quente não basta).
- O feed responde com sinais de frescor para re-busca: sem cache agressivo do nosso lado (`no-cache`/curto + `ETag`/`Last-Modified` para revalidação barata em 304) e `X-PUBLISHED-TTL` como dica de intervalo — o servidor nunca é o elo que segura conteúdo velho; a cadência restante é a do cliente externo.
- Edição e cancelamento de compromissos já exportados refletem no feed (sem dados antigos, sem evento fantasma).
- Revogação e escopo do criador (C16/C96) seguem **fail-closed** — a correção de frescor não abre feed para criador sem acesso nem vaza evento de município fora do escopo.
- Nenhuma ação extra de quem assinou nem novo deploy para refletir mudanças futuras de agenda.

## Dados (intenção)

- **Vou apresentar dados?** Não — o feed é exportação iCal para consumidor externo (Google Calendar); não há superfície nem decisão de apresentação neste item.
- **Decisões desbloqueadas:** nenhuma — é correção de comportamento. `Dados: N/A` (a forma é o formato iCal existente; o que muda é a frescura).

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota `src/app/(campaign)/campanha/agenda/ical/[secret]/route.ts` (a única resposta que serve o conteúdo do feed; sem `dynamic`/`revalidate`, e o header `Cache-Control` de 1h está aqui); `src/utilities/calendarFeed.ts` (query/geração — já lê o banco vivo a cada request; provavelmente não é o problema, mas é onde o teste de dois GETs se ancora).
- **Precedente a olhar:** `docs/plans/c92-corrigir-criacao-link-import-agenda.md`, `docs/plans/c96-ical-feed-intersect-scope-read.md`, `docs/plans/c98-corrigir-geracao-link-import-agenda-impl.md` (a verificação da geração; o impl C98 manteve explicitamente "server/route/collection do feed" fora de escopo — este item é o dono desse espaço agora). Teste existente `tests/e2e/campaignAgendaFeed.e2e.spec.ts` prova o primeiro `GET` (quente) — falta a prova do segundo.
- **Risco de acoplamento:** rota pública sem auth (o segredo é a credencial) — qualquer mudança de cache/headers mantém fail-closed e o escopo do criador; leader lockdown e demais access intocados; sem migration.

## Dependências

- Nenhuma dura. Suaves: nenhuma em aberto (C16/C92/C93/C96/C98 entregues e em prod).

## Fora de escopo

- Cadência/velocidade de atualização do **Google Calendar** (cliente externo — cadência dele; registrar expectativa, não controlar).
- **Push / atualização sem GET** (escrever nos calendários dos assinantes via API do Google Calendar): arquitetura diferente do "link de import" (OAuth por assinante, escopo novo) — registrar como item futuro se a mesa quiser, não neste defect.
- Sync bidirecional ou push em tempo real (C16 não promete).
- Qualquer mudança de schema/collection/UI; refino de copy do diálogo de link.

## Rabbit holes de produto

- **"Sincronia instantânea".** Se alguém "só completar": tentar controlar a cadência de re-busca do Google ou adicionar polling agressivo. **Corte neste item:** o feed precisa estar vivo no servidor; o cliente externo busca quando quer.
- **"Re-gerar o link" como workaround de suporte.** Criar feed novo a cada reclamação só mascara o defeito. **Corte:** o aceite é o mesmo link continuar vivo — re-gerar não é correção.

## Questões em aberto (produto)

- **Qual latência de atualização o assinante pode esperar?** **Opções:** A) a cadência de re-busca do próprio Google Calendar, com o feed vivo no servidor (tipicamente poucas horas; assinante pode usar "atualizar agora" manual quando precisar imediato) | B) exigir que o assinante atualize manualmente sempre. **Recomendação:** A — a promessa do C16 é "sync por link", não push; o aceite do servidor (dois `GET`s) prova exatamente o que controlamos, e o `X-PUBLISHED-TTL`/headers de frescor são a melhor tentativa dentro do padrão iCal (Google ignora a dica para feeds públicos; não há API de "re-busque agora" no lado do assinante). _(assumido — validar)_

## Referências

- GitHub Issue #631
- Canvas UI (gate): N/A
- `src/app/(campaign)/campanha/agenda/ical/[secret]/route.ts` — primeiro arquivo a abrir
- `src/utilities/calendarFeed.ts` — geração/query do feed
- `tests/e2e/campaignAgendaFeed.e2e.spec.ts` — cobertura existente (primeiro GET)
- Plans C92/C96/C98 — histórico do link de import
