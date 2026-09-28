# Post-mortem: upload de gravações recusado pelo teto do edge Cloudflare

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-28                                                                              |
| Severidade          | alta (bloqueia subir gravações reais de horas no acervo de comunicação em produção)     |
| Ambiente            | produção (sintoma e diagnóstico read-only) + worktree `fix/14` (correção e verificação) |
| Issue(s)            | sem Issue (relato humano direto no `/bug-fix`)                                          |
| PR do fix           | #— (aberto neste worktree)                                                              |
| Detectado por       | humano (operador da campanha)                                                           |

## Timeline

| Momento            | Data/hora                     | Evento                                                                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-09-18                    | O C199 (gravações enviadas no acervo, commit d0f606a5) entrou com upload de arquivo inteiro em um único request; qualquer upload acima de ~100 MB já era recusado pelo edge do Cloudflare. O C199-large (remoção do teto de 4 GiB, commit 57b0d168, deploy verde em 2026-09-26 17:40) não mudou isso. |
| Detecção           | 2026-09-28, hora não apurada  | O humano relatou que subir um `.mp4` de 6 GB em `/campanha › Acervo › Gravações › "Enviar gravação"` "está falhando"; o diálogo mostra erro genérico e a mensagem exata na tela é não apurada.                                                                                                        |
| Diagnóstico        | 2026-09-28                    | Reprodução read-only em produção: `curl -sSI https://jorgesolla1313.com.br/` → `server: cloudflare`; `POST` de 150 MB para um caminho inexistente (`/__cf-upload-limit-probe-does-not-exist`, não escreve nada) → `413 Payload Too Large` da Cloudflare, encerrando após ~3,2 MB enviados.            |
| Correção mergeada  | pendente                      | Correção implementada e verificada localmente; PR aberto neste worktree, CI pendente.                                                                                                                                                                                                                 |
| Deploy             | pendente                      | O merge dispara o deploy; produção depende de approve humano no environment `production`.                                                                                                                                                                                                             |
| Verificado em prod | pendente — confirmação humana | Pendente a confirmação do humano de que o upload de 6 GB funciona em produção.                                                                                                                                                                                                                        |

## O bug

Em produção, em `/campanha › Acervo › Gravações › "Enviar gravação"`, o envio de um `.mp4` de 6 GB falhava. A mensagem exata exibida na tela é não apurada; o diálogo mostra um erro genérico. O arquivo real de 6 GB não foi reproduzido localmente (não se faz upload de 6 GB em dev sem S3) — a recusa foi demonstrada de forma read-only em produção pelo probe de 150 MB, que o edge corta em `413` após ~3,2 MB.

## Causa-raiz

O diálogo enviava o arquivo INTEIRO em um único XHR (`xhr.send(file)`). Esse request único morre no edge do Cloudflare (tunnel de produção), que responde `413` antes do app ver o corpo. O único teto modelado era do app — o antigo `RECORDING_MAX_BYTES = 4 GiB`, removido no C199-large — e o limite do edge nunca foi nomeado nem parametrizado. Nenhum teste da suíte atravessa o edge (unit/int/e2e batem em localhost) e não existia invariante de "corpo por request < teto do proxy".

Origem `file:line` pré-fix:

- `src/components/campaign/recording/RecordingUploadDialog.tsx:164` (`xhr.send(file)`).
- `src/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/enviar/route.ts:85` (`body: request.body`).
- `src/utilities/recordings/recordingUpload.ts` (stream único, sem teto).

### 5 whys

1. Por que o upload de 6 GB falha? Porque o diálogo enviava o arquivo inteiro em um único XHR (`xhr.send(file)`).
2. Por que o request único falha? Porque ele morre no edge do Cloudflare, que responde `413 Payload Too Large` antes do app ver o corpo.
3. Por que o limite do edge não era tratado? Porque o único teto modelado era do app (o antigo `RECORDING_MAX_BYTES = 4 GiB`, removido no C199-large); o limite do edge nunca foi nomeado nem parametrizado.
4. Por que a suíte não pegou? Porque nenhum teste atravessa o edge (unit/int/e2e batem em localhost) e não existia invariante de "corpo por request < teto do proxy".
5. Por que isso passou? Sistêmico: limites de proxy/edge ficaram fora do orçamento de request do produto, e a validação de arquivos multi-GB foi por tipo/declaração — produção virou o único teste real.

## Correção

Upload fatiado ponta a ponta. `src/lib/recording.ts` ganhou `RECORDING_UPLOAD_CHUNK_BYTES = 16 MiB` e `RECORDING_UPLOAD_EDGE_LIMIT_BYTES = 100 MiB`.

`src/utilities/recordings/recordingUploadSession.ts` (novo) passou a ser o dono do estado da sessão em disco: `os.tmpdir()/recording-upload-<id>` com um `.session.json` de `{uploadName, expectedBytes}` mais o arquivo anexado e um `.placeholder/` interno.

`src/utilities/recordings/recordingUpload.ts` foi refatorado em três operações: `startRecordingUpload` (cria a linha `uploading` e a sessão após o preflight de disco), `receiveRecordingChunk` (anexa a parte exigindo `index === floor(receivedBytes / chunkSize)`, aplica o teto por request, faz heartbeat do `updatedAt` contra o reaper de 1 h e finaliza a mídia privada + job quando os bytes recebidos igualam o tamanho declarado) e `abortRecordingUpload` (condicional, só a linha ainda `uploading`).

As rotas ficaram `POST .../gravacoes/enviar` (bodyless, devolve `chunkSize`) e `POST/DELETE .../gravacoes/enviar/[id]` (parte crua com `?index=`, abort idempotente). O diálogo fatia com `file.slice` e envia as partes em ordem, com progresso agregado e aborto da sessão em erro/unmount (DELETE com `keepalive`). O reaper (`src/utilities/recordings/recordingJob.ts`) e `deleteRecordingForActor` removem o dir da sessão. Sem migration e sem mudança de schema.

## Verificação

- Teste de regressão: protocolo de upload fatiado em `tests/int/recording.int.spec.ts` (multi-parte, fora de ordem, parte grande, tamanho excedido, seam multipart, falha S3, reaper, start/chunk/abort idempotente); unit pina `RECORDING_UPLOAD_CHUNK_BYTES < RECORDING_UPLOAD_EDGE_LIMIT_BYTES`.
- Suíte: `pnpm gate:fast` verde (lint + typecheck + 4.943 unit em 448 arquivos); `pnpm test:int tests/int/recording.int.spec.ts` 31/31; `pnpm test:e2e campaignSpeechAcervo.e2e.spec.ts -g "upload routes refuse"` 3 passed (2 setup + 1 alvo); `pnpm build` verde; `pnpm knip`, `pnpm check:cycles` e `pnpm format:check` verdes.
- Verificador independente (sub-agente): reconfirmou unit 14/14, int 31/31, e2e 3 passed e o `413` read-only de produção; a caça a lacunas achou 4 pontos menores, dos quais 1 vazamento real foi corrigido (dir órfão quando a criação da sessão falha no start) e os outros 3 são corridas/limpezas best-effort documentadas.
- CI: pendente no PR.
- Prod: pendente de approve humano no environment `production` e da confirmação do humano de que o upload de 6 GB funciona.

## Prevenção

| Estratégia                                                                                                                                                      | Custo  | Estado                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| Unit pinando `RECORDING_UPLOAD_CHUNK_BYTES < RECORDING_UPLOAD_EDGE_LIMIT_BYTES` (aumento acima do teto do edge quebra o build)                                  | barata | implementada neste PR                      |
| Testes int do protocolo fatiado (multi-parte, fora de ordem, parte grande, tamanho excedido, seam multipart, falha S3, reaper, rotas idempotentes)              | barata | implementada neste PR                      |
| Guardas e2e cross-origin/advisor nas duas rotas                                                                                                                 | barata | implementada neste PR                      |
| Preflight de disco no start (`statfs(tmpdir())` com margem de 512 MiB, via `recordingUploadFitsInDisk`, unit-testado)                                           | barata | implementada neste PR                      |
| Mapeamento do `413` no diálogo para copy honesta (`RECORDING_UPLOAD_REJECTED_MESSAGE`)                                                                          | barata | implementada neste PR                      |
| Retomada de upload (resume) por parte                                                                                                                           | cara   | documentada — não implementada neste fluxo |
| Upload direto ao Garage S3 por URL pré-assinada (corpo sai do edge)                                                                                             | cara   | documentada — não implementada neste fluxo |
| Observabilidade/alerta de `413` no edge (Cloudflare analytics) e smoke de >100 MB em staging atrás do tunnel                                                    | cara   | documentada — não implementada neste fluxo |
| Fatiar também a Central de Conteúdos (`src/utilities/content/contentPieceUpload.ts`, `ContentPieceUploadDialog.tsx:158`, `ContentPieceAttachFileButton.tsx:72`) | cara   | documentada — não implementada neste fluxo |

**Estratégia implementada:** o corpo nunca mais atravessa o edge em um request único — o diálogo fatia em 16 MiB, o teto do edge (100 MiB) virou constante nomeada com teste que impede o chunk de crescer acima dele, o protocolo fatiado tem cobertura int/e2e, o start faz preflight de disco antes de horas de upload e o `413` do edge vira copy honesta no diálogo.

**Estratégia documentada (cara):** resume por parte; upload direto ao Garage por URL pré-assinada; observabilidade de `413` no edge com smoke de >100 MB em staging atrás do tunnel; e o mesmo fatiamento na Central de Conteúdos, que sofre do MESMO `413` acima de ~100 MB e tem teto de produto de 4 GiB (`src/lib/contentPiece.ts:159`). Anexos de demanda (10 MB) e avatar (2 MB) estão abaixo do teto do edge e não são afetados.

## Lições

- A suíte inteira roda em localhost e nunca atravessou o edge — o limite do proxy não era fronteira nomeada no produto.
- A remoção do teto do app no C199-large deu a falsa sensação de que "qualquer tamanho passa"; o teto do edge sempre esteve lá, invisível.
- O diálogo tinha um erro genérico que escondia a recusa do edge — o app nem via o request, então nenhuma mensagem do app podia ser verdadeira.
- A feature nasceu com o caso real de "horas de plenária", mas o único teste de tamanho era o cap declarado, nunca o caminho real de bytes.
