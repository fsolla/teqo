# C246 — Integridade do acervo no Garage: achar e recuperar as fotos quebradas

Status: rascunho
Atualizado em: 2026-10-01
Issue: #1418
Priority: P2
Impeccable: A — sem UI
Design UI: N/A — sem UI
Appetite: ~0,5–1 dia eng + ops; um outcome verificável — nenhuma foto pública serve mídia quebrada
Responsável: —

## Intenção

Ao publicar as 6.492 fotos (C242) e indexar os rostos, apareceram objetos corrompidos no bucket: as fotos **80** e **83** falham o download com _checksum mismatch_ e o proxy público `/fotos/<id>/midia` responde **500** para elas. Uma amostra de 20 ids achou 1 com erro, então o problema é raro, mas hoje o álbum pode exibir (e exibe) imagens quebradas. O acervo precisa de uma varredura de integridade e de um caminho de recuperação a partir do Flickr (a ficha guarda a `sourceUrl`), sem tocar em curadoria e com relatório honesto.

## Persona e fluxo

- **Persona / contexto:** assessoria/ops que publica o acervo; visitante que abre uma foto e vê imagem quebrada.
- **Job principal:** garantir que toda foto aprovada sirva arquivo; recuperar as que não servem.
- **Fluxo desejado:** roda a varredura → recebe a lista de objetos ilegíveis (com motivo) → recupera do Flickr (re-ingestão idempotente pelo `flickrId`) → roda o índice facial nas recuperadas → o álbum não tem mais mídia quebrada.
- **Anti-goals de produto:** baixar/reprocessar tudo por precaução; alterar curadoria; apagar objetos sem rastro; mexer no Flickr.

## Objetivo e aceite

- Varredura read-only de **todas** as fotos: detecta objeto ausente/corrompido (download com validação — o mesmo caminho que o índice facial usa) e emite receita com a lista e o motivo.
- Recuperação re-ingere do Flickr pelo `flickrId`/`sourceUrl`, para o objeto no bucket, sem duplicar linha nem sobrescrever campos curados; as fotos recuperadas voltam ao público pelo fluxo normal (`draft → approved`, com o canal já configurado).
- Fotos irrecuperáveis (fonte sumiu) saem do público com registro — nunca ficam quebradas.
- Reexecutar converge; relatório diz o que foi varrido, achado, recuperado e falhou.

## Dados (intenção)

- **Vou apresentar dados?** Contagens no recibo da CLI (varridas/achadas/recuperadas/falhas) — operador, não público.
- **Forma:** tabela de recibo (JSON/markdown), sem exposição pública.

## Dados da decisão (literais)

- **Achado em produção (2026-10-01):** fotos 80 e 83 com _checksum mismatch_ (`x-amz-checksum-crc32`), mídia 500; amostra 20 ids → 1 erro.
- **Fonte de recuperação:** `archivePhoto.sourceUrl` (Flickr) — re-ingestão existente (`archivePhotoIngest`), determinística pelo `flickrId`.
- **Sem tocar curadoria:** campos curados nunca são sobrescritos (mesma régua do C231/C232).

## Direção no codebase (hipótese)

- **Áreas prováveis:** CLI nova de varredura (reusar `downloadPrivateMediaToFile` + checksum/`headObject` no cliente S3 do bucket, ou o próprio caminho de download do índice), e um modo de recuperação que reusa `ingestArchivePhoto`; reuso das guardas de CLI (`TEQO_ENV`, `*_CONFIRM`, S3), recibos em `data/archive/reports/`.
- **Precedente:** `pnpm archive:catalog --verify` (inventário read-only), `pnpm media:recover` (C233/OPS52 — recuperação de objeto sem tocar no DB), ingestão Flickr C231.
- **Risco de acoplamento:** `publicationStatus` da foto recuperada e o índice facial (marker) precisam ser reprocessados; mídia privada passa pelo proxy e pela allowlist do otimizador.

## Dependências

- Duras: C231 (ingestão/collection) e C242/C240 (publicação/índice) — entregues.

## Fora de escopo

- Re-varredura de mídia pública do C233 (`media`), vídeos, outras plataformas.

## Rabbit holes de produto

- **"Só completar" re-ingerindo o acervo inteiro.** **Corte:** só o que a varredura acusar.
- **"Só completar" apagando fotos problemáticas.** **Corte:** recuperar primeiro; sair do público só quando a fonte não existir.

## Questões em aberto (produto)

- **Canal de saída para irrecuperáveis:** `draft` (some do público) com registro no recibo, ou `removed`? **Recomendação:** `draft` + registro (não é pedido de remoção de pessoa). _(assumido — validar)_

## Referências

- `docs/plans/acervo-fotos-flickr-ingestao.md` / `-impl.md` (C231)
- `docs/plans/album-fotos-publico-busca-impl.md` (C233 — proxy de mídia)
- `src/utilities/flickr/archivePhotoIngest.ts` · `src/utilities/privateMedia/privateMediaResponse.ts`

## Self-score (shaping)

5/5 — (1) outcome verificável (nenhuma mídia pública quebrada); (2) appetite pequeno, reusando ingestão e proxy; (3) persona/job/aceite claros; (4) direção com precedentes nomeados; (5) achado de produção registrado com literais.
