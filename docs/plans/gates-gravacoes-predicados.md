# C202 — Gates de upload/retry/delete de gravações usam os predicados do dono

Status: rascunho
Atualizado em: 2026-09-18
Issue: C202
Depende de: C199 (#1166)
Priority: P2
Impeccable: A (só backend)
Appetite: ~0,5 dia eng — trocar o gate de leitura pelos predicados de escrita onde a ação é escrita

## Contexto

O C199 entregou `src/utilities/access/recordings.ts` com três predicados: `canReadRecording`, `canUploadRecording` e `canDeleteRecording` — os dois últimos existem justamente para que ampliar a leitura não conceda upload/delete. Mas as rotas e ações de gravação gateiam por `canReadCommunicationCatalog(actor.role)` (o predicado de papel da vertical), que hoje é equivalente aos três. O desvio é silencioso: uma futura ampliação da leitura (ex.: `advisor` ganha leitura do acervo) passaria a valer para upload/retry/delete sem tocar no dono.

## Abordagem

Expor no dono (`utilities/access/recordings.ts`) um predicado de papel compartilhado (ou usar os `Access` existentes via um helper de rota que receba o usuário fresco), e consumi-lo nas superfícies de escrita:

- `POST .../gravacoes/enviar` (`route.ts` — gate cru de sessão e origem).
- `retryRecordingForActor`, `deleteRecordingForActor` (`actions/recording.ts`).
- `labelRecordingSpeakerForActor` (`actions/recording.ts`; absorvido do C200 #1167 — a action gateia no action-level com `canReadCommunicationCatalog` enquanto a collection usa `canUploadRecording`).
- `getRecordingStatusesForActor` é leitura: mantém `canReadCommunicationCatalog`.

Rejeitadas: duplicar o corpo dos predicados nas rotas (gêmeo); criar um quarto predicado (o dono já tem os três).

## Fases

1. Helper/consumo no dono + rotas/ações; unit dos predicados e int de matriz de papéis (communicator/coordinator/candidate passam; advisor/leader negados) já existentes no `tests/int/recording.int.spec.ts` continuam a rede.
2. Gates — `pnpm gate:fast`; push via `pnpm push`.

## Rabbit holes / Não escopo

- Renomear `canReadCommunicationCatalog` (fora: o predicado é da vertical e está estável).
- Enforcement por coleção (já existe: os `Access` das três collections).
- Mudança de comportamento visível: nenhuma esperada hoje (os conjuntos coincidem).

## Riscos

- Divergência futura coberta por teste de matriz de papéis no int, que passa a apontar o predicado de escrita.

## Aceite de engenharia

- [ ] Upload/retry/delete gateados pelo predicado de escrita do dono; status/leitura pelo de leitura.
- [ ] Matriz de papéis verde no int; nenhuma regressão de comportamento.
