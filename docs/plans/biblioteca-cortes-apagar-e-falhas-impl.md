# Impl: Biblioteca de cortes: apagar um corte e não acumular cortes falhados

Status: aprovado
Atualizado em: 2026-09-16
Issue: #1105
Intenção: docs/plans/biblioteca-cortes-apagar-e-falhas.md
Appetite restante: herdado (~1 dia eng) — sem corte. O item cabe: uma autorização de delete, uma action de delete, uma action de retry que **reusa** o dono C167, duas ilhas de UI e o endurecimento do guard de rotas.

## Leitura da intenção

- **Outcome:** em `/campanha/comunicacao/acervo/cortes` (lista) e `/campanha/comunicacao/acervo/cortes/[id]` (detalhe), `communicator`/`coordinator`/`candidate` apagam um corte com confirmação explícita — avisando o link público `/corte/<id>` quando `published` — e um corte `failed` nunca fica como item morto: aparece com "Tentar novamente" acionável. `advisor`/`leader` negados (fail-closed); o admin do Payload segue podendo apagar.
- **O que NÃO negociar:** hard delete apenas (sem soft delete/lixeira/desfazer); sem lote; sem editor de vídeo; sem métricas nem leitura nova de coleções; gate `speechCatalog`, `canReadSpeechCut` (published-only para o leitor não-gate) e `leader` lockdown intocados; `/corte/<id>` continua dono C167 (aqui só o efeito de apagar); retry é por request (`retryOf`) na **mesma row**, nunca duplica; `create`/`update` seguem `canReadSpeech` e o delete nasce com a mesma audiência.
- **O que reavaliar (hipóteses do explorador que a engenharia corrige):**
  - O hint "`[id]/route.ts` (DELETE)" **não é viável**: `[id]/` já tem `page.tsx`, e o App Router proíbe `page.tsx` + `route.ts` no mesmo segmento ("Conflicting route and page"). O handler DELETE vai para um sub-segmento irmão de `publicacao`/`texto`: `[id]/apagar/route.ts`.
  - O artefato de design cobre lista (A), confirmações (B/C) e mobile (D), mas **não tem cena do detalhe**; o designer estende em paralelo. O plano lista a superfície do detalhe e trata o artefato como fonte visual de verdade, reusando os mesmos componentes/copy.
  - "Extrair retry reusável" tem duas leituras (reusar o endpoint `cortar` com `{retryOf}` vs extrair `retrySpeechCutForActor` + rota `[id]/retry`). A escolha está em Decisões de engenharia.

## Abordagem recomendada

```mermaid
flowchart LR
  G[acervo gate: communicator / coordinator / candidate] --> L[Lista /cortes]
  G --> D[Detalhe /cortes/id]
  L -->|Apagar - publicado, despublicado ou falhou| DELR[DELETE /cortes/id/apagar]
  D -->|Apagar| DELR
  L -->|Tentar novamente - failed| RET[POST /cortes/id/retry]
  D -->|Tentar novamente - failed| RET
  DELR --> OG{isSameOriginRequest + gate + canDeleteSpeechCut}
  OG -->|denied| FORB[400 fail-closed]
  OG -->|ok| DEL[payload.delete overrideAccess:false]
  DEL -->|afterDelete revalidateTag| PUB[/corte/id responde 404]
  RET --> RG{gate speechCatalog + status failed}
  RG -->|nao failed| ERR[400: so corte que falhou]
  RG -->|ok| RJ[retrySpeechCut: MESMA row -> processing + job]
  RJ --> REFRESH[card e detalhe voltam a processar]
```

**Opções consideradas:** A (novo `canDeleteSpeechCut` + `DELETE [id]/apagar` + extrair `retrySpeechCutForActor` + manter `failed` listado) | B (reusar `canReadSpeech` e o endpoint `cortar` com `{retryOf}`, sem rota nova) | C (bypass `overrideAccess:true` na action, delete só-admin na collection)
**Recomendação:** A — porque cada superfície tem um dono nomeado (access no collection, transport na família `[id]/*`, retry no mesmo módulo C167 via extração, UI nas ilhas existentes) e porque só A protege o efeito público (`afterDelete` já revalida; o link vira 404) sem afrouxar o `where` de leitura.
**Rejeitadas:** B — `canReadSpeech` como predicado de delete faz a semântica de leitura virar autoridade de escrita (um futuro alargamento de leitura concederia delete em silêncio) e expor `{retryOf}` como contrato da biblioteca acopla o card à união create/retry do diálogo; C — `overrideAccess:true` sem predicado dono é o caminho paralelo que o brief proíbe e some com a auditoria.

### Decisões de engenharia

**1. Autorização do delete**

- **Opções:** A) novo `canDeleteSpeechCut` (admin Payload OU `canReadSpeechCatalog`) | B) reusar `canReadSpeech` | C) manter `payloadAdminOnly` e fazer o delete da campanha com `overrideAccess:true` após gate no action.
- **Recomendação:** **A** — `src/utilities/access/speeches.ts` ganha `canDeleteSpeechCut` com o mesmo predicado de audiência (`isPayloadAdmin || canReadSpeechCatalog(currentUser.role)`), re-exportado pelo barrel `campaignAccess.ts` e ligado em `SpeechCut.access.delete`. O action ainda repete o gate fresco (`canReadSpeechCatalog`) para responder a mensagem de domínio; o access do collection é a segunda camada (defense in depth) e é ele que sustenta o `/api` do Payload.
- **Rejeitadas:** **B** porque reaproveitar um predicado de leitura como autoridade de escrita é uma decisão silenciosa de segurança (o nome não conta a verdade; `canDeleteX` é o padrão do repo — `canDeleteOwnNotifications`, `canDeleteCalendarFeed`); **C** porque um `overrideAccess:true` sem dono no collection precisa de comentário de bypass e vira o "gêmeo" que o engineering-brief manda evitar.

**2. Transport do delete (e o conflito de rota)**

- **Opções:** A) `DELETE` em `[id]/apagar/route.ts`, irmão de `publicacao`/`texto`, com `isSameOriginRequest` manual | B) `POST` via `campaignJsonMutationRoute` em `[id]/apagar` com body `{cutId}` | C) server action chamada direto do client.
- **Recomendação:** **A**. O detalhe já usa route handlers por sub-segmento e o client já fala JSON com `postCampaignJson`; DELETE sem corpo usa o `id` do segmento. Como `campaignJsonMutationRoute` constrói **só POST** e o sweep de convenções só guarda `export const POST`, este handler: (a) chama `isSameOriginRequest(request)` e devolve 403; (b) valida `strictDecimalInteger(id)`; (c) reusa o **mesmo** mapeador/envelope de erro exportado de `campaignJsonMutationRoute.ts` (editar o dono, não re-escrever o envelope); (d) `dynamic = 'force-dynamic'`. O sweep é **estendido para `export const DELETE`** em `codebaseConventions.unit.spec.ts` (escopo `src/app/(campaign)`, exigindo `isSameOriginRequest(`), porque o guard que falha aberto é exatamente a linha que a sexta rota esquece.
- **Rejeitadas:** **B** porque POST para apagar destoa do verbo e o item não precisa de corpo (o id já está no path); **C** porque o padrão do detalhe é JSON por route handler (publicação/texto), e chamada direta de server action sairia do guard de origem compartilhado.
- **Nota de rota:** `[id]/route.ts` **não existe e não pode existir** ao lado de `[id]/page.tsx`; o sub-segmento `apagar/` é obrigatório, não cosmético.

**3. Corte `failed`: manter listado com retry no card**

- **Opções:** A) manter `failed` na lista (`buildSpeechCutListWhere` segue `{}`) e renderizar "Tentar novamente" no card e no detalhe | B) dropar `failed` do `where` da lista.
- **Recomendação:** **A** — o design aprovado decide retry no nível do card (Cena A: card `Falhou` com "Tentar novamente" + "Abrir corte" + "Apagar"). `buildSpeechCutListWhere` e `parseSpeechCutListParams`/serialize/`paramNameSet` **não mudam** (sem faceta nova, sem mudança de URL; o unit `speechCutListUrl.unit.spec.ts:75-85` segue verde).
- **Rejeitadas:** **B** porque contradiz o design aprovado e remove o caminho de recuperação de onde a pessoa vê a falha (o C169 existe justamente para falha honesta + retry por row).

**4. Reuso do retry (não twinar o C167)**

- **Opções:** A) extrair a action exportada `retrySpeechCutForActor({cutId})` (delegando à `retrySpeechCut` privada já existente) + rota `POST [id]/retry/route.ts` via `campaignJsonMutationRoute` | B) o card chama o endpoint existente `/campanha/comunicacao/acervo/cortar` com `{retryOf: cutId}` | C) segunda action/rota com lógica própria.
- **Recomendação:** **A** — o que se extrai é uma casca fina: parse (`speechCutRetryRequestSchema`), gate fresco `canReadSpeechCatalog`, e delegação à `retrySpeechCut(payload, actor, cutId)` **existente** (que já exige `status === 'failed'`, reusa a row e reinicia o job). `saveSpeechCutForActor` continua chamando a privada no ramo `retryOf` (sem duplo parse). O que **fica**: a `retrySpeechCut` privada e o diálogo intocados.
- **Rejeitadas:** **B** porque `retryOf` é o contrato privado de seleção do diálogo e vira acoplamento do card à união create/retry; **C** é o twin proibido.

**5. Órfão de `media` no delete**

- **Opções:** A) adiar (não apagar `media`/objeto S3 no delete) com gatilho | B) apagar `media` na mesma transação do delete do corte.
- **Recomendação:** **A** — `payload.delete` do corte **não** cascateia para `media` (relação separada; o MP4 e o objeto no bucket ficam). O retry já deixa órfão do mesmo jeito (`retrySpeechCut` zera `media: null` sem apagar o anterior), então o delete **não introduz classe nova** de resíduo. Adiar mantém o appetite e evita escrita multi-collection + delete S3 + risco de apagar arquivo compartilhado.
- **Rejeitadas:** **B** porque exige transação sobre `media` + `speechCut`, tratamento de falha do S3 e decisão de propriedade do arquivo — caro de reverter sem sinal de produto.
- **Gatilho de revisitação:** auditoria de órfãos ou sinal de custo/crescimento do bucket → item próprio de limpeza corte→media (e retry→media).

**6. Apagar enquanto `processing`**

- **Opções:** A) não renderizar "Apagar" enquanto `status === 'processing'` | B) permitir em todos os status.
- **Recomendação:** **B** — a Cena E do artefato aprovado é explícita: "Publicado, despublicado e processando: 'Apagar' no mesmo extremo direito". O dono da estrutura visual decidiu; o delete não é escondido por estado. O job em background que ainda segura a row apenas falha e loga se a row sumir (o `after` do Next contém a rejeição) — resíduo possível é um `media` órfão, já coberto pela Decisão 5.
- **Rejeitadas:** **A** porque contraria o design aprovado (trigger b) e esconderia a saída definitiva justamente de quem quer cancelar um processamento travado.
- **Gatilho de revisitação:** se o job passar a ter efeito colateral caro (upload/registro externo), reavaliar com cancelamento explícito do job.

### Componentes / mudanças

**Servidor / acesso**

- **`canDeleteSpeechCut`** (`src/utilities/access/speeches.ts`): novo predicado (admin Payload OU `canReadSpeechCatalog`), o dono da autorização. Reusa `isPayloadAdmin`/`getFreshCampaignUser` de `access/shared`.
- **Barrel** (`src/utilities/campaignAccess.ts:172`): re-exporta `canDeleteSpeechCut`.
- **`SpeechCut`** (`src/collections/SpeechCut.ts:51-56`): `access.delete = canDeleteSpeechCut`; remove o import de `payloadAdminOnly` (deixa de ser usado no arquivo — evita lint/knip).
- **Schemas** (`src/lib/schemas/speechCut.ts`): `speechCutCutIdRequestSchema` (`{ cutId: positiveRelationshipId }`), tipo inferido — **um** schema reusado pelo DELETE e pelo retry (o `speechCutStatusRequestSchema` existente tem a mesma forma mas nome de poll; não duplicar). Reusa `SPEECH_CUT_FORBIDDEN_MESSAGE`/`SPEECH_CUT_NOT_FOUND_MESSAGE`/`SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE`/`SPEECH_CUT_GENERIC_ERROR_MESSAGE` (sem literal novo).
- **Actions** (`src/app/(campaign)/campanha/actions/speech.ts`): `deleteSpeechCutForActor({cutId})` (parse → gate fresco → `loadSpeechCutForActor` → `payload.delete({ collection:'speechCut', id, user: actor, overrideAccess:false })`; **single-collection, sem transação**) e `retrySpeechCutForActor({cutId})` (parse → gate fresco → delega a `retrySpeechCut`). Devolvem `{ deleted: true }` / `SpeechCutViewModel`.
- **Envelope de erro** (`src/utilities/campaignJsonMutationRoute.ts`): exportar o mapeador de erro já existente (`campaignJsonMutationErrorResponse`) para o handler DELETE reusar 401/400 e `safeMessages`, sem re-escrever o envelope.

**Rotas**

- **`DELETE`** (`src/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/[id]/apagar/route.ts`): `isSameOriginRequest` → 403; `strictDecimalInteger(id)`; chama `deleteSpeechCutForActor`; responde `SpeechCutDeleteResponse`; `dynamic = 'force-dynamic'`.
- **`POST`** (`.../cortes/[id]/retry/route.ts`): `campaignJsonMutationRoute({ bodySchema: speechCutRetryRequestSchema, safeMessages: [FORBIDDEN, NOT_FOUND, RETRY_NOT_FAILED], genericMessage })`.
- **Tipos** (`.../cortes/[id]/types.ts`): `SpeechCutDeleteResponse = { status:'success'; deleted: true } | { status:'error'; message }` e `SpeechCutRetryResponse = { status:'success'; cut: SpeechCutViewModel } | { status:'error'; message }`.

**Client / contrato**

- **`deleteCampaignJson`** (`src/lib/campaignJsonRequest.ts`): variante DELETE do preâmbulo JSON (`credentials:'same-origin'`, `Accept`), ao lado de `postCampaignJson` — edita o dono do transporte, não cria módulo.
- **`campaignPaths.ts`**: `campaignSpeechCutDeleteHref(id)` e `campaignSpeechCutRetryHref(id)` (endpoints internos) para o card e o detalhe não repetirem string.

**UI (Impeccable B — shells existentes; shape→craft→critique→polish)**

- **`SpeechCutDeleteDialog`** (`src/components/campaign/speech/SpeechCutDeleteDialog.tsx`, client): `AlertDialog` de `@/components/ui/AlertDialog` (precedente C168), copy literal do artefato. `published`: título "Apagar este corte?", corpo "O link público /corte/<id> deixa de funcionar para quem já recebeu. Esta ação não pode ser desfeita."; demais: mesmo título, corpo "Esta ação não pode ser desfeita."; botões "Cancelar" / "Apagar" (destructive, com `Spinner`). Props: `{ cutId, publicPath, status, onDeleted?, redirectAfterDelete? }` — na lista `onDeleted` faz `router.refresh()`; no detalhe redireciona para `CAMPAIGN_COMMUNICATION_CORTES` (a row some).
- **`SpeechCutRetryButton`** (novo, client): mostra "Tentar novamente" só quando `failed`; POST em `campaignSpeechCutRetryHref(id)` via `postCampaignJson`; `Spinner` + erro; `router.refresh()`.
- **`SpeechCutLibraryCardActions`** (novo, client island): "Abrir corte" (`campaignSpeechCutDetailHref`), "Copiar link" (só `published`, `CopyLinkButton`), "Tentar novamente" (`failed`), "Apagar" à direita (destructive, em todos os status — Cena E). Grid mobile do design (Cena D).
- **`SpeechCutLibraryCard.tsx`** (server): passa a renderizar a ilha de ações (mantém o card RSC).
- **Detalhe** (`.../cortes/[id]/page.tsx`): ilha de ações no topo (Apagar + Tentar novamente quando `failed`), usando os mesmos componentes. Superfície não desenhada no artefato atual — a cena do detalhe é extensão em paralelo; sem estilo novo, mesma copy/componentes.
- **`SpeechCutPublicationPanel.tsx`** (`:136-140`): troca o beco "Refaça o corte no acervo de falas" por copy que aponta para a ação "Tentar novamente" (a ação vive na ilha do detalhe; o painel não chama o job).

**Testes**

- **Unit**: `tests/unit/codebaseConventions.unit.spec.ts` (sweep estendido a `export const DELETE` sob `(campaign)`, exigindo `isSameOriginRequest(`); novo `tests/unit/speechCutDeleteDialog.unit.spec.tsx` (copy publicado vs não publicado, Cancelar/Apagar, DELETE na URL certa, erro); `speechCutCardActions.unit.spec.tsx` (`failed` → "Tentar novamente" no endpoint de retry; todos os status com Apagar). `speechCutListUrl.unit.spec.ts` **sem mudança** (pina `where === {}`).
- **Int**: `tests/int/speechCut.int.spec.ts` (describe C168) — `deleteSpeechCutForActor` remove a row e ela some de `loadSpeechCutAcervoPageData`; `advisor`/`leader` negados (`SPEECH_CUT_FORBIDDEN_MESSAGE`); delete de `published` **não** apaga `media` (documenta o órfão); `retrySpeechCutForActor` só em `failed`, mesma row → `processing`, job disparado, `published` rejeitado; delete via collection access com `overrideAccess:false` (communicator ok, advisor/leader negados).
- **E2E**: `tests/e2e/campaignSpeechCut.e2e.spec.ts` (describe C168) — communicator `DELETE /campanha/comunicacao/acervo/cortes/<id>/apagar` → 200, some da lista e `/corte/<id>` → 404; `advisor`/`leader` → 400 `não tem acesso ao acervo`; `POST .../<id>/retry` em corte `failed` → 200 `processing`.

### Dados → forma (se aplicável)

Não aplicável — a intenção já decide que é estado do item, não painel (sem contadores/métricas). Nenhuma leitura agregada nova; a lista continua card-based com o sistema de listas existente (`SpeechCutLibraryFilters`/`CampaignListPendingBoundary` intocados).

## Fases verificáveis

1. **Tracer / server+access (≈meio dia):** `canDeleteSpeechCut` + barrel + `SpeechCut.access.delete` + schemas + `deleteSpeechCutForActor`/`retrySpeechCutForActor` + rotas `apagar`/`retry` + export do mapeador de erro + sweep DELETE do `codebaseConventions` + int/unit de autorização, remoção e retry. Prova: `pnpm test` (unit+int) verde; `payload.delete` com `overrideAccess:false` negando advisor/leader.
2. **UI (≈meio dia):** `deleteCampaignJson`, helpers de path, `SpeechCutDeleteDialog`, `SpeechCutRetryButton`, `SpeechCutCardActions`, edição do card e do detalhe, ajuste da copy `failed` do painel; unit dos componentes e extensão do e2e. Prova: card `failed` com retry, confirmação com aviso quando `published`, `/corte/<id>` vira 404 após apagar.
3. **Gates:** `pnpm gate:fast` (lint → format → typecheck → knip → cycles → unit → int); e2e no conjunto curado do CI; push via `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- **Limpeza do órfão de `media`/S3** (delete e retry) — adiada com gatilho (Decisão 5); sem `payload.delete` de `media` e sem transação multi-collection aqui.
- **Soft delete / lixeira / desfazer / restauração** — anti-goal de produto.
- **Apagar ou tentar em lote** — anti-goal de produto.
- **Apagar `processing`** — adiado com gatilho (Decisão 6); sem cancelamento de job.
- **Faceta/filtro de status na URL** — desnecessário (failed segue listado); não tocar `parseSpeechCutListParams`/serialize/`paramNameSet`/`buildSpeechCutListWhere`.
- **Wrapper genérico `campaignDeleteRoute`** — 1 call site; não abstrair. A segurança vem do `isSameOriginRequest` explícito + sweep estendido.
- **Retry na seção "Cortes desta fala"** (C174) — fora; a action extraída torna barato depois, se pedido.
- **Métricas/telemetria de exclusão**, comentários, coleções/kits — fora.
- **Mudar `/corte/<id>` (C167)** além do efeito do delete, o gate `speechCatalog` e o `where` published-only de `canReadSpeechCut` — intocados.

### Explicitamente fora (triage pós-`/simplify`)

- **`deleteCampaignJson` repete o preâmbulo do `postCampaignJson`** (score 2, cheap_polish) — **defer, gatilho:** fatorar um `sendCampaignJson(url, init)` no mesmo módulo quando surgir o **2º** chamador bodyless/DELETE (hoje 1 call site; DRY prematuro).
- **Slug `[id]/retry` em inglês ao lado de `publicacao`/`texto`/`apagar`** (score 2, cheap_polish) — **defer, gatilho:** renomear para um slug pt-BR se a superfície de endpoints do corte for tocada de novo ou ganhar um irmão.
- **Tipo de opções do envelope re-declarado inline** (`campaignJsonMutationRoute`) — descartado (polish de tipo, sem custo de comportamento).
- **`[id]` do retry não lido no path** (o `cutId` vem do body) e **pré-leitura antes do delete** — descartados: convenção pré-existente da família (`publicacao`/`texto`) e produtor deliberado da mensagem de domínio, respectivamente.
- **`canDeleteSpeechCut` textualmente igual a `canReadSpeech`** e **`speechCutCutIdRequestSchema` igual em forma ao `speechCutStatusRequestSchema`** — mantidos de propósito (Decisões 1 e 3): o nome do predicado é a fronteira de escrita e o schema de status tem semântica de poll.

## Riscos e mitigação

- **Conflito `page.tsx` + `route.ts`** em `[id]/` → sub-segmento `[id]/apagar/route.ts` obrigatório; coberto pelo build (falha explícita) e citado no plano.
- **DELETE sem guard de origem falha aberto** → `isSameOriginRequest` manual + sweep estendido para `export const DELETE` (escopo `(campanha)`, allowlist do REST do Payload) para uma rota futura não repetir o erro.
- **Audiência do delete divergir** → predicado nomeado + gate fresco no action + collection access; int pinando advisor/leader negados e admin preservado.
- **Link público**: apagar `published` quebra `/corte/<id>` já distribuído → confirmação com aviso verbatim; `afterDelete` (`SpeechCut.ts:64-68`) revalida o tag `document_speechCut:<id>`, então a página passa a 404 (não serve cache velho).
- **Corrida com o job em `processing`** → delete desabilitado nesse estado (Decisão 6) com gatilho de revisitação.
- **Retry duplicando corte** → `retrySpeechCutForActor` delega à `retrySpeechCut` existente (reusa a row; recusa não-`failed`); diálogo C167 intocado.
- **Regressão no `where`/URL da lista** → nenhuma mudança em `speechCutListUrl.ts`; unit existente pina `{}`.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto: apagar com confirmação (aviso do link quando `published`); `failed` nunca morto (card + detalhe com "Tentar novamente"); `communicator`/`coordinator`/`candidate` + admin do Payload podem; `advisor`/`leader` fail-closed; hard delete sem undo/lote/métricas.
- [ ] Invariantes AGENTS/engineering-standards: Local API com `user` em `overrideAccess:false`; delete é single-collection (sem transação) e o órfão de media está nomeado como não-escopo com gatilho; sem `Consent`/PII novo; gate `speechCatalog`/`leader` lockdown e `/corte/<id>` (C167) intocados; copy pt-BR / identificadores em inglês.
- [ ] Testes de domínio previstos onde access/write paths mudam: int (delete/retry/autorização/remoção/órfão), unit (diálogo/card/sweep DELETE) e e2e (HTTP delete+retry+negação).
- [ ] **Migration:** **sem migration** — nenhum campo/schema muda (`access.delete` é config de runtime, não coluna). Confirmado: `SpeechCut` não ganha campo; nada de `pnpm migrate:create`.

## Self-score (decision-quality)

5/5 — (1) as decisões caras (autorização, transport, retry, órfão, processamento) têm opções e rejeitadas explícitas; (2) cabe no appetite herdado (~1 dia; uma action de delete, uma de retry que delega ao dono, duas ilhas de UI); (3) rabbit holes nomeados (media/S3, lote, soft delete, `processing`, faceta de status, wrapper genérico); (4) depth check respeitado — reusa `AlertDialog`, `copyLink`, `withPayloadTransaction`/padrão de erros, `campaignJsonMutationRoute`, `loadSpeechCutForActor` e a `retrySpeechCut` existente, sem twinar o C167; (5) o outcome de produto permanece idêntico — a engenharia só escolheu o como, corrigindo a rota inviável sem mudar o aceite.
