# Agenda: canal de push do Google Calendar nunca registra (expiration string → Invalid time value)

Status: rascunho
Atualizado em: 2026-09-14
Issue: #1009
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável — canal de push registra e o vaivém do Google volta a ser imediato
Responsável: —

## Intenção

Quem opera a agenda vive no Google Calendar. O Teqo já espelha o que nasce
aqui (atividades criadas, editadas, canceladas aparecem lá), mas o caminho de
volta está morto: edições e cancelamentos feitos no Gmail **não** voltam para a
atividade em tempo real. Na prática, a coordenação/imprensa mexe no evento pelo
Google e o Teqo continua exibindo a versão antiga até alguém abrir a agenda e
disparar um sync manual.

Descobrimos isso ao vivo: a conexão Google está saudável, o espelho Teqo→Google
funciona, mas o canal de notificação Google→Teqo nunca foi registrado em
produção — `push_channel_id`/`push_channel_expires_at` vazios, `push_channel_error`
preenchido, e o log acusa `Invalid time value` alternando com `fetch failed`.
A causa é determinística: o Google devolve `expiration` como string (int64 em
JSON) e a leitura assume number, quebrando na conversão para data. É um defeito
pequeno com efeito grande: a direção Google→Teqo (C115) fica degradada, e o
usuário percebe como "a agenda não atualiza".

## Persona e fluxo

- **Persona / contexto:** coordenação e imprensa do mandato, na mesa, operando a
  agenda compartilhada direto no Google Calendar; esperam que o Teqo reflita o
  que fazem lá sem passo extra.
- **Job principal:** editar ou cancelar um evento no Google e ver a atividade
  correspondente no Teqo atualizar sozinha, em segundos.
- **Fluxo desejado:** (1) o Teqo registra o canal de push na primeira passada de
  sync; (2) o canal se renova sozinho perto de expirar; (3) uma edição feita no
  Gmail chega como notificação e a atividade aparece atualizada em segundos-minutos,
  sem clique em "Sincronizar agora".
- **Anti-goals de produto:** não criar uma segunda fonte de verdade da agenda,
  não pausar nem degradar o espelho Teqo→Google quando o canal falhar, não
  introduzir UI nova.

## Objetivo e aceite

- Após uma passada de sync, o canal de push está registrado: `pushChannelId` e
  `pushChannelResourceId` preenchidos, `pushChannelExpiresAt` preenchido e
  `pushChannelError` nulo.
- O canal se renova sozinho antes de expirar (lead de renovação já existente),
  sem intervenção humana.
- Editar ou cancelar no Gmail um evento espelhado reflete na atividade do Teqo
  em segundos-minutos, sem sync manual.
- Guardrail: falha ao registrar/renovar o canal **nunca** derruba o espelho
  Teqo→Google nem o restante do Teqo (comportamento best-effort atual mantido);
  o erro fica registrado para diagnóstico.
- Sem migração de schema, sem Consent, sem UI nova.

## Dados (intenção)

- **Vou apresentar dados?** Não — este item conserta a infraestrutura do espelho
  (registro/renovação do canal), sem superfície de dados nova nem métrica de
  produto a exibir. O "dado" observável é o estado do canal no banco, usado como
  verificação operacional, não como apresentação.
- **Decisões desbloqueadas:** N/A — nenhuma escolha de negócio depende deste
  item; o ganho é comportamento (sincronização imediata).
- **Forma:** N/A.

## Dados da decisão (literais)

- Contrato do Google: `events.watch` devolve `expiration` como **int64
  serializado em string** no JSON (ex.: `"expiration": "1757900000000"`); o
  client hoje tipa `GoogleWatchChannel.expiration: number | null`.
- A normalização deve acontecer **na borda da API** (client), para o resto do
  motor continuar recebendo number (ou null) — não espalhar coerção pelo consumidor.
- Fallback de TTL quando `expiration` vier ausente: `PUSH_CHANNEL_TTL_SECONDS`.
- Teste de regressão deve simular a resposta real com `"expiration": "<millis>"`
  (string entre aspas) e cobrir também `expiration` ausente/nulo → fallback.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/googleCalendarClient.ts` (tipo e parsing do
  watch) e `src/utilities/googleCalendarSync.ts` (único consumidor, conversão
  para ISO e catch que grava `pushChannelError`); teste de regressão em
  `tests/unit/googleCalendarClient.unit.spec.ts`, cujo stub hoje não modela
  `/watch` — a resposta real precisa ser representada.
- **Precedente a olhar:** C115 (canal de push) e C114 (espelho) para o contrato
  best-effort; `tests/int/googleCalendarSync.int.spec.ts` e os stubs int/e2e que
  hoje só devolvem number/null.
- **Risco de acoplamento:** não alterar o comportamento do espelho Teqo→Google
  nem o fail-open do canal; líder/assessor e demais perfis não são afetados.

## Dependências

- Nenhuma.

## Fora de escopo

- Investigar/retentar o `fetch failed` intermitente no mesmo passo
  (transporte) — registrar como observação; só vira trabalho se persistir
  depois do fix.
- Mudar o modelo de canal (ex.: renovação por cron dedicado, canal por usuário).
- OAuth / reconexão da conta Google.
- Qualquer UI de status do canal.

## Rabbit holes de produto

- **"Já que mexo no canal, melhoro o sync inteiro".** Se alguém "só completar":
  reescrever o loop de sync, adicionar full-sync periódico, mexer em OAuth.
  **Corte neste item:** corrigir o parsing do `expiration` e provar com teste;
  nada além.
- **"O `fetch failed` também é nosso".** Sem causa determinística, perseguir o
  erro de transporte agora vira debug aberto. **Corte:** registrá-lo melhor no
  `pushChannelError` e reavaliar se persistir.
- **"Mostrar o canal no admin".** Tentação de UI de diagnóstico. **Corte:** o
  aceite é verificação operacional (banco + edição real no Gmail).

## Questões em aberto (produto)

- **O `pushChannelError` deve carregar mais contexto quando a falha é de
  transporte?** **Opções:** A) manter só a mensagem; B) registrar a causa do
  fetch (`fetch failed` + detalhe/causa raiz) quando existir.
  **Recomendação:** B — ajuda o diagnóstico do `fetch failed` sem custo de
  produto, e não muda o guardrail. _(assumido — validar com produto)_

## Referências

- GitHub Issue [#1009](https://github.com/fsolla/teqo/issues/1009)
- Planos C115 (canal de push Google→Teqo) e C114 (espelho de agenda)
- `src/utilities/googleCalendarClient.ts` — tipo/retorno do `watchEvents`
- `src/utilities/googleCalendarSync.ts` — registro/renovação do canal e gravação do erro
- `tests/unit/googleCalendarClient.unit.spec.ts`, `tests/int/googleCalendarSync.int.spec.ts`
- `docs/ops/teqo-1313-deploy.md` — verificação em produção pós-deploy
- `AGENTS.md` — convenção de migrations (aqui: nenhuma)
