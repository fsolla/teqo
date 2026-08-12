# C115 follow-up — corrida do snapshot de eventos + hermeticidade da suíte int do motor

Status: rascunho
Atualizado em: 2026-08-11
Issue: <preenchido pelo agent:register>
Priority: P3
Model: cursor-grok-4.5-high
Appetite: ~0,5–1 dia eng

## Contexto

Débitos do gate de revisão do C115 (três revisores /simplify), mesclados num
lote único por terem o mesmo pai (#636) e superfície contígua (motor de sync +
suas specs). O C115 entregou asserções resilientes a atividades ambiente —
estas fases atacam a raiz e a corrida remanescente, em ordem (lock/race antes
de higiene de teste).

## F1 — Snapshot `lastSeenEventIds` com last-writer-wins pode ressuscitar remoção permanente (race)

**Achado:** `recordSyncState` recarrega e sobrescreve o snapshot; duas passadas
concorrentes (webhook + hook de atividade em instâncias Vercel distintas) cada
uma grava o snapshot da própria visão remota. Se a passada B (visão antiga,
iniciada antes de A criar o evento X) grava por último, X cai do snapshot; o
usuário então remove X permanentemente no Google e a passada seguinte trata
como "nunca criado" → recria o evento — a remoção é desfeita e não converge
para a intenção do usuário (as escritas de evento convergem por conteúdo —
D3/C114 — mas este estado novo não).

**Fases propostas (a decidir no impl):**

- A) **compare-and-swap otimista**: gravar o snapshot só se o `lastSuccessAt`
  lido na passada ainda for o mesmo (re-leitura + condição na escrita) —
  barato, sem lock.
- B) advisory lock por passada (precedentes `postgresTransactionLocks`) —
  mais forte, mas serializa passadas (aceitável: passadas são segundos).
- C) aceitar e documentar (janela de minutos, rara) — rejeitada na triage:
  write path, piso de score.

**Testes:** int com stub — duas passadas sobrepostas (client com delay
injetável) + remoção permanente após a corrida → a remoção NÃO é ressuscitada.

## F2 — Hermeticidade da suíte int contra atividades ambiente

**Achado:** o motor espelha a janela inteira (espelho cheio, por design) e
arquivos irmãos (`homeSearchActivities`, `campaignSuggestions`, …) mantêm
atividades na janela pelo arquivo inteiro (`fixtures.own` limpa no afterAll) —
as passadas do `googleCalendarSync.int.spec.ts` absorvem esses eventos nas
contagens globais. Mitigado na entrega por asserções resilientes
(`ownEvents(...)`), mas a raiz permanece: qualquer outra spec nova sensível à
janela morde de novo.

**Fases propostas (a decidir no impl):**

- A) cleanup por teste nos arquivos irmãos (afterEach com prefixo próprio —
  toca specs alheias, mínimo e cirúrgico).
- B) helper compartilhado de "atividades da janela com prefixo" para specs que
  criam atividades de passagem.
- C) documentar a convenção no header do `googleCalendarSync.int.spec.ts`.

**Testes:** suíte int completa ×N sem falhas de contagem.

## Já resolvido no simplify (não reabrir)

- Reopen re-cancelado (snapshot com ids deletados pelo motor → `removedEventIds`
  separado).
- Ramo `cancelled` sem regra do relógio (reopen perdia).
- Reverse write com `req.user` herdado (autoria + gate do deputado) → user
  stripped + hook skip da própria escrita.
- Baseline do relógio `updatedAt` → `lastMirroredChangeAt` (campo + carimbo).
- Canal órfão quando `stopChannel` falha após o watch → novo canal persistido
  antes do stop.
- `startEndEquals` duplicado → `googleStartEndInstantEquals` exportado.
- Linhas múltiplas do `googleCalendarSync` → create admin-only + leitura
  prefere linha configurada.
- Bootstrap do Payload pago por scanner → pre-filter de secret/headers.
- Staff lendo credenciais do webhook (latente) → `read: false` nos identity
  fields.
- Rotação de segredo do canal por criação.
- Cobertura: all-day reverso, caminhos 200 do webhook (e2e), dialog/feed
  (render tests), slug congelado, `defaultColumns` + copy do dialog.

## Explicitamente fora

- **Token do canal igual ao secret da URL** (P3 do revisor 2): mitigado — o
  fator independente é o par `channelId`+`resourceId` (DB-held, `read: false`);
  URL leak sozinho não forja entrega. Reavaliar só se um leak de URL acontecer
  em produção.
- **Escopo do reverse = ACL do calendário** (qualquer editor do calendário pode
  cancelar qualquer `confirmado`): decisão de produto travada na intenção
  ("permissões por calendário, não por evento, em v1") — o modelo é o do
  compartilhamento do Google. Documentar no runbook de ops como consequência
  assumida.
- **Truncamento silencioso de título >160**: cap do formulário, by design.
- **Evento órfão para atividade remarcada além do lookahead de 365d**:
  comportamento da janela herdado do C114, fora do aceite. Gatilho: quando a
  agenda oficial precisar de horizonte maior.
- **Rate limit por IP no webhook**: o pre-filter barato rejeita scanner noise
  antes do Payload; Vercel absorve o resto.

## Referências

- Impl C115: `docs/plans/c115-google-calendar-edicao-bidirecional-impl.md`
- Issue pai: #636
