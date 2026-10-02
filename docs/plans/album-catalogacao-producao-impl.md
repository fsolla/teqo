# Impl: C245 — Catalogação do acervo em produção (município, atividade, legenda)

Status: aprovado
Atualizado em: 2026-10-01
Issue: #1417
Intenção: docs/plans/album-catalogacao-producao.md
Appetite restante: herdado — ~1 dia eng + tempo de máquina

## Leitura da intenção

- **Outcome:** o acervo publicado (6.492 fotos) deixa de ter só a faceta **Data**: (1) a camada **metadata** grava `catalog.municipality` e `catalog.themes` a partir do texto já ingerido, e `/fotos` passa a renderizar a faceta **Município** e o card com `data · município`; (2) a camada **IA**, quando o engine local subir, grava legenda/descrição/atividade/texto visível, e o card ganha legenda real e a faceta **Atividade**. Tudo com recibo, reexecução idempotente, curadoria vencendo e nada publicado automaticamente.
- **O que NÃO negociar:** metadata-only **nunca** escreve `catalog.people` (o C244 assume a faceta por facial); nenhuma proposta sobrescreve `curatedFields`; nada muda `publicationStatus`; a IA segue chamada só por endereço privado (guardrail PII); o marker da camada metadata não pode bloquear a fila da IA; reexecutar não duplica nem repaga; sem segunda curadoria e sem superfície nova.
- **O que reavaliar:** a hipótese da intenção sugeria reaproveitar `buildArchivePhotoCatalogWrite` para a camada metadata (`docs/plans/album-catalogacao-producao.md:45`). A engenharia reavalia: o builder da IA carrega semântica de `people`/`alt`/`catalogedAt` que o puro não pode ter — nasce um builder dedicado **no mesmo dono**, com o texto base e o mini-merge extraídos em helpers compartilhados para as duas camadas não divergirem. O marker `catalog.metadataCheckedAt` da hipótese é adotado como proposto.

## Abordagem recomendada

```mermaid
flowchart LR
  A[archivePhoto<br/>catalog vazio] --> C{fila metadata:<br/>metadataCheckedAt e catalogedAt ausentes}
  C --> D[texto base puro<br/>alt · título · descrição · álbuns · tags]
  D --> E[resolveMentionedMunicipalityId<br/>+ classifySpeechByGazetteer]
  E --> F[buildArchivePhotoMetadataCatalogWrite<br/>município + temas · source · metadataCheckedAt]
  F --> G[(transação: fresh-read curatedFields<br/>update context archivePhotoCatalog)]
  G --> H[hook deriva municipalitySlug<br/>e searchText]
  H --> I[POST /api/revalidate?tag=archivePhotos]
  A -.-> J[fila IA intacta:<br/>catalogedAt ausente]
  J --> K[archive:catalog --apply<br/>S3_* + ARCHIVE_VISION_*]
  K --> L[legenda · descrição · atividade<br/>texto visível · pessoas do texto]
  L --> G
  I --> M[/fotos: facetas Município e Atividade<br/>card data · município · atividade + legenda]
```

**Opções consideradas:** A) duas camadas no mesmo dono, marker próprio e builder puro dedicado (recomendada) | B) só IA quando o engine subir, reusando `catalogedAt`/`source` para adiantar o texto | C) script/SQL ad-hoc paralelo.
**Recomendação:** A — o produtor de `/fotos` já existe (C233) e o que falta é dado; a camada pura é derivável do texto já ingerido (sem modelo, sem mídia) e a IA entra depois pela mesma transação/guardas do C232, sem reabrir o que o puro marcou.
**Rejeitadas:** B porque reusar `catalogedAt` para metadata torna a fila da IA ambígua — ou a IA nunca pega uma linha `metadata` (o marker bloqueia o processamento futuro), ou passa a reabri-las e o `source` deixa de ser testemunho da passada que gravou (podendo virar `none` sem nenhuma mudança de conteúdo), além de um "nada a propor" do puro bloquear a IA para sempre; C porque duplicaria transação, curadoria, guardas e recibo — exatamente o "twin" que a doutrina proíbe.

### Componentes / mudanças

**Contrato puro (no dono atual, sem I/O e sem `server-only`)**

- **`archivePhotoCatalogText(source, extras?)`** (`src/lib/archivePhotoCatalog.ts`): junta/filtra o texto base da ficha (alt, título, descrição, álbuns, tags) com extras opcionais; a IA passa `suggestion.caption`/`visibleText` (hoje inline em `src/utilities/flickr/archivePhotoCatalog.ts:199-209`) e a metadata passa vazio. Um dono do join impede as duas camadas de divergirem.
- **`buildArchivePhotoMetadataCatalogWrite({ municipalityId, gazetteerThemes, curatedFields, currentCatalog, metadataCheckedAt })`** (`src/lib/archivePhotoCatalog.ts`): merge puro que só propõe `municipality` e `themes` — **nunca `people`**; respeita `curatedFields`; devolve `{ data: { catalog: { municipality?, themes?, source: 'metadata' | 'none', metadataCheckedAt } }, source }`; nunca toca `catalogedAt`. Reusa `archivePhotoThemesFrom` (`:176-183`) e o vocabulário `ArchivePhotoCuratedField` (`:62-74`).
- **`buildArchivePhotoCatalogWrite` (edit)** (`src/lib/archivePhotoCatalog.ts:406-520`): ganha `metadataCheckedAt` na entrada e o grava no `catalog` ao lado de `source`/`catalogedAt` — a passada de IA também marca a camada metadata, pois é nela que a derivação determinística de texto roda. Os helpers privados de "o que pode ser escrito" e `pick` (`:438-469`) passam a ser compartilhados pelos dois builders, sem mudar comportamento.
- **Testes do puro** (`tests/unit/archivePhotoCatalog.unit.spec.ts:26-50,195+`): factories `suggestion()`/`writeInput()` ganham `metadataCheckedAt`; novo describe do builder metadata (campos propostos, curated vence, `source`, markers, nunca `people`).

**Server-side Payload (mesmo arquivo dono do C232)**

- **`listArchivePhotoMetadataCatalogQueue` / `catalogArchivePhotoMetadata`** (`src/utilities/flickr/archivePhotoCatalog.ts`, `import 'server-only'` já no topo): fila `where { 'catalog.metadataCheckedAt': { exists: false }, 'catalog.catalogedAt': { exists: false } }` (o segundo termo protege legado/linha já catalogada), sem download/sharp/engine — só DB. Reusa `toItem`/`catalogSelect` (`:68-105`), `resolveMentionedMunicipalityId` (`src/utilities/municipality/municipalityMentionResolver.ts:15-38`), `classifySpeechByGazetteer` (`src/lib/speechGazetteer.ts:447`) e `archivePhotoCatalogText`; devolve o mesmo `ArchivePhotoCatalogResult`. Estágios de falha: `resolve` e `write`.
- **Núcleo transacional extraído (privado)** no mesmo arquivo: fresh-read `{ alt, curatedFields, catalog }` + `skip(doc)` + `payload.update` com `context: { archivePhotoCatalog: true }` + `withPayloadTransaction` (`src/utilities/payloadTransaction.ts`), parametrizado por um `buildWrite(doc)`; a derivação de texto (município/temas) compartilhada fica em `deriveArchivePhotoCatalogText`. `catalogArchivePhoto` (IA) e `catalogArchivePhotoMetadata` passam a chamá-lo; o comportamento externo da IA é inalterado (download → image → analyze → resolve continuam com os mesmos estágios nomeados).
- **Fila da IA** (`listArchivePhotoCatalogQueue`, `:113-143`): inalterada — continua sendo o único dono do `catalogedAt`; a IA passa a gravar `metadataCheckedAt` no write (via builder).

**Schema**

- **Campo `metadataCheckedAt`** no `catalogGroup` (`src/collections/ArchivePhoto.ts:53-153`), depois de `catalogedAt`: `date`, `index: true`, `admin.readOnly: true`, descrição de idempotência da camada sem IA ("preenchida não reprocessa o puro"). Precedente de marker só-de-batch: `faces.checkedAt/checkedKey` do C234 (`src/collections/ArchivePhoto.ts:311-337`; gravação em `src/utilities/faceIndex/faceDescriptorIndex.ts:243-252`).
- **Migration `add_archive_photo_metadata_checked`**: `pnpm migrate:create add_archive_photo_metadata_checked` gera `.ts`/`.json` + registro em `src/migrations/index.ts` (não editar à mão; última entrada hoje `20261001_040904_add_archive_photo_face`, `:563-565`). Aditiva: coluna `catalog_metadata_checked_at timestamp(3) with time zone` + índice `archive_photo_catalog_catalog_metadata_checked_at_idx`; `down` derruba índice e coluna — mesmo padrão de `src/migrations/20260926_132106_add_archive_photo_catalog.ts:39,54,72,81`. `push:false` (`src/payload.config.ts:173`); `pnpm generate:types` em seguida.

**CLI/ops**

- **`--metadata-only`** (`scripts/catalog-archive-photos.mjs` + `scripts/lib/archiveCatalogPlan.mjs:23-60`): seletor de camada em plan/`--apply`/`--verify`. No `--apply` metadata-only as guardas caem para `assertWriteConfirm` (`ARCHIVE_CATALOG_CONFIRM`) + `assertEnvironmentDatabaseTarget` (`scripts/lib/cli.mjs:312-320,238-301`), **sem** `mirroredMediaRequired` (`:197-202`) e **sem** `assertLocalVisionEndpoint`/`ARCHIVE_VISION_MODEL` (`:373-403`) — não há mídia nem engine no caminho. No modo IA, tudo como hoje.
- **Recibo/inventário layer-aware** (`scripts/lib/archiveCatalogPlan.mjs:72-195`): parser com `metadataOnly`; resumo ganha `layer: 'metadata' | 'ai'`; `summarizeArchiveCatalogInventory` passa a expor `metadata: { checked, pending }`, `ai: { cataloged, pending }`, `bySource`, cobertura (`withoutScene` sobre as linhas da IA, `withoutMunicipality` sobre as linhas verificadas pelo metadata) e `missingFilename`; as linhas humanas mostram **as duas camadas** e o exit do `--verify` é pela camada selecionada (`--metadata-only` → pendência metadata; sem flag → pendência IA).
- **Runbook §C245** em `docs/ops/teqo-1313-deploy.md`, antes de `## C242` (`:1455`): passo 1 metadata-only em produção (sem engine/S3); passo 2 `POST /api/revalidate?tag=archivePhotos` (o write no container de manutenção não busta o ISR do app — `revalidateTagSafely` no-op fora de request, `src/utilities/documents.ts:27-34`; tag allowlistada em `src/utilities/revalidateRequest.ts:15,38`; rota `src/app/(frontend)/api/revalidate/route.ts:84`); passo 3 IA quando o engine subir (subida já documentada em §C232, `:1411-1433`); verificação e rollback funcional (grupo aditivo; limpar no admin como em `:1451-1453`).
- **Changelog** `docs/changelog/<data>-c245.md` (parágrafo único iniciando `**C245 — ... (data):**`, molde `docs/changelog/2026-09-26-c232.md:1`; guard additions-only `scripts/check-changelog-append-only.mjs:105-115`).

- **Migration:** a acima (aditiva, 1 coluna + 1 índice; stop humano antes de executar no fluxo `--auto`).
- **Access / Consent:** intocados — `canReadArchivePhoto`/`payloadAdminOnly` e `publicationStatus` não mudam; o CLI continua o ator confiável com `overrideAccess: true` documentado (`src/utilities/flickr/archivePhotoCatalog.ts:132-133,232-233,265-266`). Sem Consent novo: não há coleta nova, biometria ou publicação.
- **UI:** nenhuma (Impeccable A) — a ficha usa o grupo `catalog` existente (campo novo readOnly) e as facetas/card do C233 (`src/lib/archivePhotoPublicCatalog.ts:264-300,308-317,337-369`) passam a renderizar quando houver dado; a superfície pública só reflete depois da revalidação da tag. Sem dispatch de designer.

### Dados → forma (se aplicável)

Não aplicável — a intenção declara que a catalogação não apresenta números; cobertura por camada é recibo operacional do `--verify`, não leitura pública.

## Decisões de engenharia

### D1 — Marker próprio da camada metadata

- **Opções:** A) coluna nova `catalog.metadataCheckedAt` (date, index, readOnly), com migration aditiva | B) reusar `catalog.catalogedAt` com `source=metadata`.
- **Recomendação:** A — a fila da IA é "`catalogedAt` ausente" (`src/utilities/flickr/archivePhotoCatalog.ts:126`) e precisa continuar sendo; o marker separado espelha o precedente C234 (`faces.checkedAt/checkedKey`, `src/collections/ArchivePhoto.ts:311-337`; int `tests/int/faceDescriptorIndex.int.spec.ts:138-143`).
- **Rejeitadas:** B porque faria a IA nunca pegar a linha `metadata` (ou exigiria reabri-la), tornando o `source` um recálculo — podendo virar `none` numa linha já gravada sem mudança de conteúdo (procedência desonesta) — e porque um "nada a propor" do puro bloquearia a IA permanentemente; `catalogedAt` segue chave exclusiva da IA e o `source` segue contando o que de fato entrou.

### D2 — Duas filas, duas semânticas

- **Opções:** A) fila metadata = `metadataCheckedAt` ausente **e** `catalogedAt` ausente; fila IA = `catalogedAt` ausente (inalterada); a passada de IA grava `metadataCheckedAt` junto | B) fila metadata = só `metadataCheckedAt` ausente | C) um único `--refresh`.
- **Recomendação:** A — a condição dupla evita reprocessar linha já catalogada pela IA (incluindo legado com `catalogedAt`, hoje zero em produção) e evita rebaixar `source`; a IA marca a camada metadata porque a derivação de texto roda dentro dela (linha que passou pela IA já passou pelo puro). `--verify` relata as duas camadas; `--metadata-only --verify` falha por pendência de metadata, sem a flag por pendência de IA, sempre listando as duas.
- **Rejeitadas:** B porque uma linha legada com `catalogedAt` entraria na fila de metadata e poderia recomputar `source` (`ai` → `metadata`/`none`); C porque não há necessidade de reprocessar e o refresh reabriria a porta para repagar tudo.

### D3 — Builder puro dedicado + texto base compartilhado

- **Opções:** A) `buildArchivePhotoMetadataCatalogWrite` novo no mesmo lib, com helpers de merge/texto compartilhados com o builder da IA | B) reusar `buildArchivePhotoCatalogWrite` com `suggestion` vazio | C) SQL direto.
- **Recomendação:** A — o builder novo só propõe `municipality`/`themes`, nunca `people`, devolve `source` honesto (`metadata|none`), grava `metadataCheckedAt` e nunca `catalogedAt`; `archivePhotoCatalogText` elimina a divergência do texto base (hoje inline em `src/utilities/flickr/archivePhotoCatalog.ts:199-209`). Os helpers privados de `pick`/`writes` são compartilhados (depth check: nenhum módulo novo nasce para copiar o que já existe).
- **Rejeitadas:** B porque reusar o builder da IA com sugestão vazia gravaria `catalogedAt` (bloqueando a fila da IA para sempre) e misturaria a semântica de `people`/`alt` da IA na camada que não pode tê-las; C porque joga fora transação, curadoria e os hooks que derivam `municipalitySlug`/`searchText`.

### D4 — Pipeline metadata no dono server-side, núcleo transacional único

- **Opções:** A) `listArchivePhotoMetadataCatalogQueue` + `catalogArchivePhotoMetadata` em `src/utilities/flickr/archivePhotoCatalog.ts`, com o núcleo fresh-read/skip/update/context extraído e compartilhado com a IA | B) pipeline em arquivo novo | C) duplicar o bloco transacional dentro do CLI.
- **Recomendação:** A — o dono server-side já é esse arquivo (C232) e o padrão "fresh-read dentro da transação + `context.archivePhotoCatalog` + bypass documentado" não pode existir em duas versões; a extração é privada (API pública inalterada) e os pipelines diferem só no que antecede a transação (download/sharp/analyze vs. nada) e no `shouldSkip` (`catalogedAt` para IA; `metadataCheckedAt || catalogedAt` para metadata). O item reusa o mesmo `ArchivePhotoCatalogItem`/`toItem`/`catalogSelect`.
- **Rejeitadas:** B cria o twin do pipeline no mesmo domínio; C tira transação/curadoria do dono e faz o CLI conhecer o shape da ficha.

### D5 — CLI `--metadata-only` com guardas por camada e recibo honesto

- **Opções:** A) `--metadata-only` como seletor de camada; apply metadata-only não exige `S3_*` nem engine; verify biplex com exit pela camada | B) comando novo (`archive:catalog:metadata`) | C) exigir as guardas completas mesmo no metadata-only.
- **Recomendação:** A — a camada pura não baixa mídia nem chama engine, então exigir S3/`ARCHIVE_VISION_*` só criaria bloqueio artificial em produção (o engine está fora do ar, que é o motivo do item); as guardas que importam (`ARCHIVE_CATALOG_CONFIRM`, `TEQO_ENV` com o nome exato do banco) continuam. O recibo carrega `layer` e o `--verify` mantém a leitura das duas camadas — metadata pendente não esconde IA pendente.
- **Rejeitadas:** B multiplica scripts e recibo; C atrasa a entrega de valor (município) atrás de um engine indisponível.

### D6 — Entrega e execução em produção

- **Opções:** A) ferramenta + runbook §C245 na mesma entrega; execução em produção como passo operacional pós-merge com revalidação da tag | B) executar o lote de produção nesta sessão | C) publicar direto pela UI.
- **Recomendação:** A — a sessão de implementação não escreve em produção (proibição da skill; DB de prod é stop): o runbook documenta metadata-only primeiro (sem engine), `revalidate` da tag `archivePhotos`, verify, e a IA quando o engine subir. Nenhuma UI nova (Impeccable A; sem dispatch de designer).
- **Rejeitadas:** B viola o guardrail de escrita em produção e o stop de banco; C não existe — a publicação é a C233 e continua ato humano.

### D7 — Testes

- **Opções:** A) unit do builder/texto; unit do parser/inventário/linhas layer-aware; guarda por subprocesso; int metadata→IA sobre `teqo_wt245_test`; sem e2e novo (OPS72) | B) e2e novo | C) só manual.
- **Recomendação:** A — cobre o que não pode falhar em silêncio: (i) unit `tests/unit/archivePhotoCatalog.unit.spec.ts` (builder metadata: município/temas, curated vence, `source`, `metadataCheckedAt`, nunca `people`; builder IA grava o marker); (ii) unit `tests/unit/archiveCatalogPlan.unit.spec.ts:16-141` (parser com `metadataOnly`, resumo com `layer`, inventário de duas camadas, linhas); (iii) `tests/unit/archiveCatalogCli.unit.spec.ts` (harness spawnSync `:12-36`): com `--metadata-only --apply`, `ARCHIVE_VISION_BASE_URL` pública setada e sem S3, o processo **não** morre nas guardas de engine/S3 — sem tocar banco real (porta local fechada; asserção nas mensagens ausentes `host público`/`S3_BUCKET`/`ARCHIVE_VISION_BASE_URL ausente`); (iv) int `tests/int/archivePhotoCatalog.int.spec.ts` (fixtures `:67-121`): metadata grava município/temas/marker e não grava `people`/`catalogedAt`; a linha sai da fila metadata e **continua** na fila IA; a IA depois grava caption/scene, preserva o município e reescreve o marker; linha legada (com `catalogedAt` e sem marker, escrita com `context.archivePhotoCatalog`) é excluída das duas filas; curadoria vence; falha da resolução (payload de teste que delega ao real mas lança no `find` da collection `municipality`) não escreve e a linha permanece na fila. Sem e2e novo: a superfície admin é stock e o álbum já é coberto (`frontendFotos`, OPS72).
- **Rejeitadas:** B porque o admin é stock e o álbum não muda (OPS72); C porque idempotência/curadoria/guardas são exatamente o risco do lote.

## Fases verificáveis

1. **Fase 1 — Contrato puro + schema** (quota ~0,25 dia): `archivePhotoCatalogText`, `buildArchivePhotoMetadataCatalogWrite`, `metadataCheckedAt` no builder da IA (e factories do unit), campo no `catalogGroup`; `pnpm migrate:create add_archive_photo_metadata_checked` (revisar diff à mão), `pnpm migrate` local, `pnpm generate:types`; unit do puro. Gate: `pnpm gate:fast`.
2. **Fase 2 — Pipeline metadata** (quota ~0,25 dia): fila/pipeline + núcleo transacional extraído em `src/utilities/flickr/archivePhotoCatalog.ts`; int metadata→IA no `teqo_wt245_test`. Gate: `pnpm gate:fast` + int local.
3. **Fase 3 — CLI layer-aware** (quota ~0,25 dia): parser/resumo/inventário/linhas, `--metadata-only`, guardas por camada; unit de `archiveCatalogPlan` e do subprocesso; plan/`--verify` contra o banco do worktree (read-only). Gate: `pnpm gate:fast`.
4. **Fase 4 — Ops e entrega** (quota ~0,25 dia): runbook §C245 antes de `## C242`, changelog `docs/changelog/<data>-c245.md`, plano no commit/PR. A execução em produção (metadata-only → revalidate → verify; IA quando o engine subir) fica documentada no runbook e **fora do run desta sessão**.

## Rabbit holes / Não escopo (engenharia)

- Engine de visão de terceiro, OCR dedicado, recorte/edição de imagem — produto já cortou (PII) e a intenção manda fora.
- `catalog.people` derivado de texto na camada metadata — o C244 assume a faceta por facial; escrever aqui seria inventar a segunda curadoria de pessoa.
- Reabrir linhas com `catalogedAt` (legado) ou criar `--refresh` — nenhuma linha legada existe hoje e a fila dupla de D2 já resolve o futuro.
- Backfill de `metadataCheckedAt` em linhas já catalogadas — sem demanda; a IA grava o marker quando roda.
- Superfície nova de revisão/fila de curadoria — Impeccable A; só nasce no gate.
- Env nova (`ARCHIVE_METADATA_*`) — a camada pura não precisa de engine/mídia.
- Segundo script/comando ou segunda fila para a metadata — o seletor `--metadata-only` é a camada.
- Otimizar o lote (paralelismo, bulk update) — 6,5k linhas DB-only cabem no tempo de máquina; medir antes.

## Adiado com gatilho (pós-simplify)

- **Predicado único de "metadata pendente"** (fila no `where`, `skip` transacional e inventário):
  hoje a mesma semântica mora em 3 mecânicas diferentes. **Gatilho:** um quarto
  consumidor em JS ou uma mudança da regra (novo marker/refresh) — aí extrair o
  predicado no dono. (cheap_polish, score 2)
- **Corrida metadata×IA no write** (o skip lê `catalogedAt`, mas um commit de IA entre o
  read e o update da metadata poderia rebaixar o `source`): as camadas rodam
  serializadas por ops (runbook) e o `source` da IA não é sobrescrito por mutação de
  campos; **gatilho:** se as camadas passarem a rodar concorrentes, trocar por update
  condicional por marcador. (cheap_polish, score 2)
- **Teste de falha de resolução** espião no primeiro `payload.find`: **gatilho:** próxima
  edição do pré-transação de `catalogArchivePhotoMetadata` — estreitar o stub por
  collection. (cheap_polish, score 2)

## Riscos e mitigação

1. **Migration no fluxo `--auto`** — é aditiva e pequena (1 coluna + 1 índice), mas o fluxo para para confirmação humana antes de executá-la; o diff gerado é revisado à mão contra o snapshot e aplicado primeiro no banco do worktree; nenhuma migration entregue é reescrita.
2. **Escrita em produção fora de hora** — o run desta sessão não escreve em produção; os guardas `ARCHIVE_CATALOG_CONFIRM` + `TEQO_ENV=production`/`teqo_1313` continuam, e o passo 1 do runbook roda no serviço de manutenção com o env file do stack.
3. **Cache ISR não bustado pelo CLI** — o write no container não tem request scope (`src/utilities/documents.ts:27-34`); sem o passo 2 (`POST /api/revalidate?tag=archivePhotos`) as facetas não aparecem. O runbook fixa a ordem: apply → revalidate → verify.
4. **`undefined` vs `null` e curadoria** — Payload ignora `undefined` e nunca limpa; os builders nunca devolvem `null` para "não escrever" (só `undefined`/omitido), e o fresh-read dentro da transação garante que uma edição humana concorrente vence (precedente C234 `faces`, `tests/int/faceDescriptorIndex.int.spec.ts:138-143`).
5. **Marker bloqueando a IA** — a fila da IA continua sendo só `catalogedAt`; o int metadata→IA prova que a linha marcada pelo metadata volta à fila da IA e que a IA mantém município/temas.
6. **CI high-risk** — a migration e a edição de `src/collections/ArchivePhoto.ts` puxam unit/int full + e2e curado, e `src/utilities/flickr` mapeia para `frontendFotos`/`frontendFotosSelfie` (`scripts/lib/e2e-affected-manifest.mjs:57,224-239`); manter o PR focado. `scripts/lib/archiveCatalogPlan.mjs` é pinado (`scripts/lib/test-affected-core.mjs:46`) e o invariante de closure segue fechado (`tests/unit/ciSkipInvariants.unit.spec.ts:192-216`).
7. **Cobertura parcial do texto** — município/atividade só entram quando o texto (ou a visão) sustenta; o `--verify` reporta `withoutMunicipality`/`withoutScene` por camada e nada é inventado.
8. **Spec de subprocesso tocando banco** — o caso metadata-only usa porta local fechada e asserção nas mensagens ausentes; nunca aponta para um banco real.
9. **Contrato do `--verify` antigo** — a saída muda (duas camadas) e o exit passa a depender da flag; o runbook e o changelog citam a mudança para o operador.

## Aceite de engenharia

- [ ] Builder metadata puro cobre o aceite: só `municipality`/`themes`, nunca `people`; `curatedFields` vence; `source` ∈ `metadata|none`; grava `metadataCheckedAt`, nunca `catalogedAt`; o builder da IA grava `metadataCheckedAt` junto do `catalogedAt`.
- [ ] Fila metadata = `metadataCheckedAt` ausente e `catalogedAt` ausente; fila IA inalterada; int prova o ciclo metadata→IA (município/temas preservados, caption/scene depois, legado excluído, curadoria vence, falha não escreve).
- [ ] `/fotos` exibe **Município** após a camada metadata (via `municipalitySlug` derivado no hook + revalidação da tag) e **Atividade**/legenda após a camada IA; `curatedFields` sempre vence; nada é publicado.
- [ ] Migration `add_archive_photo_metadata_checked` gerada, revisada, aplicada local, index registrado, tipos regenerados; `push:false` mantido.
- [ ] `--metadata-only` em plan/apply/verify; apply metadata-only exige só `ARCHIVE_CATALOG_CONFIRM` + `TEQO_ENV`; verify sempre lista as duas camadas e o exit é pela selecionada.
- [ ] Runbook §C245 antes de `## C242` (metadata-only → revalidate `archivePhotos` → verify → IA quando o engine subir; rollback) e changelog `docs/changelog/<data>-c245.md` entregues; nenhuma UI nova.
- [ ] Access/Consent intocados; bypass `overrideAccess` documentado; sem env nova; sem segundo pipeline/script.
- [ ] Gates: `pnpm gate:fast`, int local, e2e curado do CI verdes; deploy staging-primeiro; execução em produção documentada e fora da sessão.

## Self-score (decision-quality)

1. Decisões caras com rejeitadas? **Sim** — D1–D7 têm opções, recomendação e rejeitadas explícitas (marker vs `catalogedAt`, builder dedicado vs reuso, guardas por camada, etc.).
2. Abordagem cabe no appetite? **Sim** — ~1 dia de engenharia em 4 fases de ~0,25 dia; o tempo de máquina (6,5k linhas DB-only, depois IA quando o engine subir) fica fora do código.
3. Rabbit holes nomeados? **Sim** — terceiro/OCR, pessoas por texto, refresh/legado, backfill, superfície nova, env nova, segundo script, otimização prematura do lote.
4. Depth check: reusa shells/helpers? **Sim** — fila/item/select, `resolveMentionedMunicipalityId`, `classifySpeechByGazetteer`, `withPayloadTransaction`, contexto/hook do `archivePhotoCatalog`, guardas de `cli.mjs`, precedente C234 de marker, CLI/recibo C232, revalidação da tag existente.
5. Intenção permanece satisfeita? **Sim** — o outcome (facetas e card com dados reais, duas camadas, idempotente, curadoria vence, nada publicado) não muda; a engenharia só escolhe como.

**Score: 5/5.**
