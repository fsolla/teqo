---
name: catalogo-falas-web
description: 'Atualiza o catálogo de falas do acervo a partir da web: lê a data da última execução, descobre o que apareceu desde então nas plataformas do C215 (YouTube, Instagram, rádio/áudio), cura falsos positivos (“revisar” não ingere até confirmação), entrega o lote à esteira de ingestão (pnpm falas-web:import) e devolve o recibo (período, achados, novos, ignorados, falhas, custo/tempo); rodada manual, incremental e sem duplicar.'
---

# Catálogo de falas web — atualização incremental (C218)

`/catalogo-falas-web` atualiza o catálogo de falas do acervo desde a **última
execução bem-sucedida**: descobre o que apareceu na web no período (descoberta
por busca, plataformas do C215), cura o que a descoberta achou errado, entrega o
lote à esteira de ingestão do C215 (`pnpm falas-web:import`) e imprime o recibo.
Rodada **manual** (sem agendador, sem UI).

A skill **só orquestra**: descobrir é dela; baixar, transcrever, classificar,
espelhar e deduplicar é do C215 (`scripts/import-web-speeches.mjs`,
`src/lib/webSpeech.ts`, `src/utilities/speech/*`). Nada de segunda esteira.

## Quando usar

- A comunicação precisa do acervo atualizado com o que saiu na web desde a
  última rodada; o operador roda a skill quando decidir.
- Quem executa: o **orquestrador** (agente principal) + um sub-agente de
  **descoberta** por rodada (`.opencode/agent/catalogo-falas-web.md`) + o CLI do
  C215. Precedente das skills de conteúdo: `.agents/skills/dossie-solla-cidade/SKILL.md`.
- Primeira execução (sem `data/falas-web/last-run.json`) = **varredura inicial
  completa**; as seguintes são incrementais.

## Argumentos (`$ARGUMENTS`)

| Invocação | O que faz |
| --- | --- |
| `/catalogo-falas-web` | rodada incremental (ou varredura inicial, sem estado) |
| `/catalogo-falas-web --limit <n>` | rodada processando no máximo `n` achados; a cauda continua no lote e não é ingerida (o recibo diz como terminar) |
| `/catalogo-falas-web revisar` | lista numerada de `review` + `pending` do estado; não descobre, não ingere, não muda o estado |
| `/catalogo-falas-web aprovar <índice\|sourceKey\|url\|todos>` | promove de `review` (mais os `pending`) para um lote e ingere na mesma invocação; o watermark **não** muda |
| `/catalogo-falas-web descartar <índice\|sourceKey\|url\|todos>` | remove de `review`/`pending` com o motivo no recibo; nada é ingerido |

Uma rodada por vez: não rode duas invocações simultâneas (o estado não tem
lock). Sem argumento desconhecido: pare e mostre as opções — nunca trate um
argumento não reconhecido como rodada.

## Pipeline (etapas)

1. **Ler o estado.** `data/falas-web/last-run.json` (gitignored; contrato
   abaixo). Sem o arquivo: `from = null`, `initial = true`. Com o arquivo:
   `from = lastRunAt`. Estado ilegível/corrompido → **pare** (fail-closed) com o
   caminho e a saída ("remova/renomeie o arquivo para forçar a varredura
   inicial") — nunca trate corrompido como ausente em silêncio.
2. **Descobrir (sub-agente).** Dispare a Task com
   `.opencode/agent/catalogo-falas-web.md` informando a janela já resolvida
   (`from`/`initial` e `to = agora`, o instante do despacho) e receba **só o
   recibo curto** (seção "Recibo da descoberta"). O sub-agente escreve o
   artefato datado `data/falas-web/discovery-<stamp>.json` (contrato abaixo) com
   `window.to` = o `to` recebido. O orquestrador lê o artefato do disco para
   auditar (etapa 3) — nunca peça o corpo ao subagente.
3. **Curar.** Leia o artefato do disco (é o produto auditável — não confie só no
   recibo) e audite cada `findings[]`: URL da plataforma declarada, data dentro
   da janela, indício de que é fala do titular. Qualquer dúvida → **não inclua
   no lote** e registre em `review` do estado (etapa 8) com o motivo (critérios
   abaixo). A curadoria decide **relevância e autenticidade**; nunca faceta
   (tema/alcance/menções são do classificador do C215).
4. **Montar o lote.** `pending` do estado vai **primeiro** (retry), depois os
   `findings` aprovados; sem duplicar URL. Se o lote ficar vazio (sem achados e
   sem pendências), **pule o CLI** e emita o recibo a partir do artefato
   ("nada novo no período"), ainda avançando o estado. Senão, grave
   `data/falas-web/batch-<stamp>.json` no contrato **exato** do C215
   (`{ generatedAt, findings }`) — não reimplemente o parser.
5. **Planejar (obrigatório).** `pnpm falas-web:import --findings <lote>
   --dry-run` (com o mesmo `--limit <n>` da etapa 6) e leia o relatório JSON
   (`data/falas-web/reports/falas-web-<stamp>.json`). O `plannedEntries` dá o
   `sourceKey` de cada entrada **na ordem do lote** e o `invalid`/`duplicates`
   valida a curadoria. Se `invalid > 0` ou `duplicates > 0`: **não ingira**,
   **não avance o watermark** e relate no recibo os ofensores com o motivo
   (índice + erro) — o conserto é da descoberta/curadoria; isso **não** vira
   `review` (item de schema não se resolve por `aprovar`) e o estado fica como
   está.
6. **Ingerir.** `pnpm falas-web:import --findings <lote>` (com `--limit <n>` se
   a rodada pediu). Guarde o código de saída e o caminho do relatório impresso.
   Exit 0 = sucesso total/parcial; exit 1 = nenhum achado entrou (falha
   sistêmica ou todos os achados falharam).
7. **Recibo.** Imprima o bloco literal abaixo com as regras de preenchimento por
   modo, sempre derivado do **JSON do relatório** (nunca do stdout nem de
   memória). Sem relatório — CLI morreu antes de gravar —, declare a falha da
   rodada e não invente números (a exceção é o lote vazio da etapa 4).
8. **Gravar o estado.** Por **último**, sempre que houver o que atualizar
   (watermark, `pending` ou `review`), com escrita atômica (arquivo temporário +
   `mv` para `data/falas-web/last-run.json`): `lastRunAt` só avança quando a
   rodada importou com exit 0 (ou pulou o CLI por lote vazio); `pending` acumula
   as falhas do lote considerado (com `attempts`); `review` acumula o que
   aguarda confirmação. Falha de planejamento (etapa 5) e falha sistêmica **não**
   avançam o watermark. Nada de PII (URLs/títulos públicos e motivos
   operacionais apenas).

## Contrato do estado (`data/falas-web/last-run.json`, gitignored)

```jsonc
{
  "version": 1,
  "lastRunAt": "2026-09-24T18:00:00.000Z",   // janela superior (window.to) da última rodada importada com exit 0
  "lastStateAt": "2026-09-24T18:07:12.000Z", // quando este estado foi gravado (inclusive em rodada com falhas)
  "lastDiscoveryPath": "data/falas-web/discovery-2026-09-24T18-00-00-000Z.json",
  "lastBatchPath": "data/falas-web/batch-2026-09-24T18-03-00-000Z.json",
  "lastReportPath": "data/falas-web/reports/falas-web-2026-09-24T18-03-05-000Z.json",
  "pending": [
    {
      "sourceKey": "web:youtube:abc123",        // quando conhecido (vem do plannedEntries do dry-run)
      "finding": { "platform": "youtube", "url": "https://www.youtube.com/watch?v=abc123", "publishedAt": "2026-09-12" },
      "reason": "download: HTTP 403",
      "attempts": 1,
      "addedAt": "2026-09-24T18:07:12.000Z"
    }
  ],
  "review": [
    {
      "sourceKey": "web:instagram:xyz",         // opcional (item que não passou por um dry-run pode não ter)
      "finding": { "platform": "instagram", "url": "https://www.instagram.com/reel/xyz/", "publishedAt": "2026-09-10" },
      "reason": "não confirmado como fala do titular (compilado de terceiro)",
      "flaggedAt": "2026-09-24T18:07:12.000Z"
    }
  ]
}
```

- `lastRunAt` é o `window.to` da descoberta — nunca o fim do import: o que for
  publicado durante a esteira cai na próxima janela, não no vão.
- `lastStateAt` é só o carimbo da gravação: "sucesso" do incremental é o
  `lastRunAt` ter avançado.
- `lastReportPath` é `null` quando a rodada pulou o import (lote vazio).
- `pending`/`review` carregam o finding integral (reentrega sem depender de
  artefatos antigos) e o `sourceKey` quando conhecido — sem ele,
  `revisar`/`aprovar`/`descartar` operam por índice ou URL.
- `pending` = falhas do relatório (`failures[].sourceKey` mapeado pela ordem do
  `plannedEntries`) com `reason` (e o estágio quando houver); `attempts`
  incrementa a cada reentrega. Ciclo: a cada rodada/`aprovar`, o que entrar
  (criado/atualizado/pulado) sai de `pending`/`review`; o que falhar fica (ou
  entra) em `pending`; a cauda de `--limit` **não** vira pending (fica no lote);
  `duplicates`/`invalid` **não** viram pending (não melhoram por repetição — o
  conserto é na curadoria/descoberta).
- Retry: os `pending` vão primeiro no próximo lote; o skip/atualização é
  decidido pelo C215 (`findSpeechImportState`). Nada é descartado
  automaticamente — `descartar` é o caminho explícito.

## Contrato do artefato de descoberta (`data/falas-web/discovery-<stamp>.json`)

`stamp` = `generatedAt` ISO com `:`/`.` trocados por `-` (mesmo shape do report
do C215). Um artefato = um escritor: só o sub-agente escreve (o orquestrador
lê, audita e cura; não reescreve).

```jsonc
{
  "generatedAt": "2026-09-24T18:00:00.000Z",
  "window": { "from": "2026-09-01T00:00:00.000Z", "to": "2026-09-24T18:00:00.000Z", "initial": false },
  "queries": ["\"Jorge Solla\" after:2026-09-01", "site:youtube.com \"Jorge Solla\"", "..."],
  "findings": [
    { "platform": "youtube", "url": "https://www.youtube.com/watch?v=abc123", "externalId": "abc123", "publishedAt": "2026-09-12", "title": "…", "channel": "…" }
  ],
  "review": [
    { "finding": { "platform": "instagram", "url": "https://www.instagram.com/p/xyz/", "publishedAt": "2026-09-10" }, "reason": "…" }
  ],
  "notes": ["limites declarados: rádio sem arquivo direto não virou finding; Instagram fora da janela descartado"]
}
```

- Plataformas v1 = as do C215 (`youtube|instagram|radio|audio`), com queries
  pelo nome do deputado e variações e âmbito de data na janela.
- Rádio/áudio só viram `finding` com `mediaUrl` direta (o schema do C215 a
  exige); sem ela, entram em `notes` (limite declarado) — nunca em `review`
  (aprovar não pode gerar `invalid`).
- `findings` não tem URL duplicada (duplicata no lote faz a skill parar na
  etapa 5 — a regra é dela; o C215 apenas reporta `duplicates` e segue).

## Curadoria e "revisar"

Critérios para mandar a `review` (relevância/autenticidade, **nunca schema** —
item inválido para o C215 não se resolve por `aprovar`):

- não é fala do titular (homônimo, menção, compilado de terceiro);
- data não confirmável dentro da janela;
- provável duplicata semântica por outra URL (sinalizada; dedupe cross-URL está
  fora do escopo do C215);
- metadados que o agente não conseguiu confirmar.

O que está em `review` não é ingerido até confirmação (`aprovar`).

Modes (numeração única da listagem de `revisar` — `pending` primeiro, depois
`review`, em sequência; numa sessão nova, rode `revisar` antes de
`aprovar`/`descartar`):

- `revisar` — leia o estado e liste, numerado: `pending` primeiro, depois
  `review`, cada um com `sourceKey` (quando houver), plataforma, título/URL e
  motivo. Não escreva nada.
- `aprovar <alvo>` — resolva o alvo (índice da listagem, `sourceKey`, URL ou
  `todos`), **imprima o mapeamento antes de agir**, monte o lote com os
  aprovados + os `pending` e rode as etapas 4–8 da rodada (sem descoberta). O
  `lastRunAt` **não** muda; o que entrar (criado/atualizado/pulado) sai de
  `pending`/`review`; o que falhar vira `pending`.
- `descartar <alvo>` — remova da lista; o recibo lista o que saiu com o motivo
  registrado no item; nada é ingerido; nada além das listas muda.

## Recibo (literal)

```text
[catalogo-falas-web] período: <lastRunAt | "varredura inicial"> → <window.to>
achados: N · revisar: N
novos: N · atualizados: N · ignorados: N · inválidos: N · duplicados: N
falhas: N (pendentes para a próxima rodada)
  - <sourceKey> (<stage>): <motivo>
custo/tempo: <rodada> · ASR <tempo> (~US$ <custo>) · LLM US$ <custo>
estado: data/falas-web/last-run.json (lastRunAt → <window.to>)
```

Regras de preenchimento por modo:

- **Rodada com descoberta:** `período` = `lastRunAt` anterior (ou "varredura
  inicial") → `window.to`; `achados` = `findings` do artefato; `revisar` =
  tamanho de `review` no estado **depois** da rodada; o resto vem do relatório do
  C215 (`created/updated/skipped/invalid/duplicates/failures/asrSeconds/
  asrCostUsd/llmCostUsd/durationMs`).
- **`aprovar`/`descartar`:** `período: — (sem descoberta)`; `achados` = entradas
  do lote montado; `revisar` = tamanho de `review` no estado depois; `estado` sem
  a seta do watermark (não muda).
- **Lote vazio (etapa 4):** zeros no import; `estado` com a seta (watermark
  avança).
- **Exit 1/sem relatório (fora do lote vazio):** `falhas: N` com o motivo da
  rodada; `estado: inalterado`.

## Recibo da descoberta

O sub-agente devolve **só** este recibo curto (≤ ~15 linhas) — **nunca** o
corpo do artefato (`findings`/`review`):

```jsonc
{
  "status": "ok",              // ou "failed"
  "artifactPath": "data/falas-web/discovery-2026-09-24T18-00-00-000Z.json",
  "generatedAt": "2026-09-24T18:00:00.000Z",
  "window": { "from": "2026-09-01T00:00:00.000Z", "to": "2026-09-24T18:00:00.000Z", "initial": false },
  "findingsCount": 7,
  "reviewCount": 2,
  "byPlatform": { "youtube": 5, "instagram": 1, "radio": 1, "audio": 0 },
  "notes": ["…"],
  "failureReason": "…"         // opcional (só quando status = failed)
}
```

`status: "failed"` não escreve artefato parcial; a rodada reporta a falha da
descoberta e mantém o estado (watermark e listas) intacto — nada de recobrir a
janela com números falsos.

## Falhas, watermark e retry

- **Exit 0** (criou/atualizou/pulou ≥1): sucesso total ou parcial. `lastRunAt`
  avança para `window.to`; falhas viram `pending` para a próxima rodada.
- **Exit 1** (nenhum achado entrou): falha sistêmica. `lastRunAt` **não** avança;
  o lote considerado vira `pending` inteiro (a rodada seguinte recobre a mesma
  janela); o recibo explica o motivo.
- **CLI não roda / sem relatório**: mesma regra do exit 1; declare a falha e não
  invente números.
- **`--limit <n>`**: M = `findings` do relatório (o lote) e N = `planned`
  (considerados); o que ficou fora do corte continua no `batch-<stamp>.json`; o
  recibo diz "restam M−N achados no lote <path>; rode `pnpm falas-web:import
  --findings <path>` para terminar" (o CLI pula o que já está completo).

## Fronteira (o que a skill NÃO faz)

- Não baixa mídia, não transcreve, não classifica facetas, não espelha, não faz
  dedupe própria — tudo isso é do C215.
- Não lê o banco para "pular o que já está no catálogo": a garantia é janela +
  skip por estado do C215 (`sourceKey` unique).
- Não agendada, sem fila e sem monitoramento contínuo; uma rodada por vez.
- Nunca exporta `FALAS_WEB_IMPORT_CONFIRM` nem contorna as guardas do CLI
  (`assertLocalDatabase`); alvo não-local é recusado pelo próprio CLI.
- Nada commitado: tudo em `data/falas-web/` é gitignored.

## Troubleshooting

- **Estado corrompido**: fail-closed. Remova/renomeie
  `data/falas-web/last-run.json` para forçar a varredura inicial (perde o
  watermark e as listas).
- **yt-dlp ausente/desatualizado**: o CLI orienta (`pipx install yt-dlp`); a
  skill reporta a falha e mantém `pending`. Não instale nada pela skill.
- **Banco local fora do ar**: `pnpm db:start` no worktree; o CLI recusa alvo
  não-local sem a flag de confirmação.
- **Plataforma bloqueada (ex.: Instagram sem login)**: falha do achado vira
  `pending`; se for crônica, use `descartar`.
- **Varredura inicial grande**: use `--limit` e termine o lote com o caminho
  impresso; o recibo declara o que ficou de fora.
- **Cauda de `--limit` órfã**: pegue o `batch-*.json` mais recente em
  `data/falas-web/` e rode `pnpm falas-web:import --findings <path>` — o CLI
  pula o que já está completo.
- **Achado válido mas duvidoso**: não force a ingestão — registre em `review`
  (estado) e confirme depois com `aprovar`.

## Referências

- Ingestão (dono da esteira): `docs/plans/acervo-falas-web-ingestao.md` e
  `docs/plans/acervo-falas-web-ingestao-impl.md` (C215);
  `scripts/import-web-speeches.mjs`; contrato do lote em `src/lib/webSpeech.ts`.
- Sub-agente de descoberta: `.opencode/agent/catalogo-falas-web.md`.
- Precedentes de skill: `.agents/skills/dossie-solla-cidade/SKILL.md` (research
  por subagente + recibo curto) e `.agents/skills/reels-tutoriais/SKILL.md`.
- Intenção/impl desta skill: `docs/plans/skill-catalogo-falas-web.md` e
  `docs/plans/skill-catalogo-falas-web-impl.md`.
