# C245 — Catalogação do acervo em produção (município, atividade, legenda)

Status: rascunho
Atualizado em: 2026-10-01
Issue: #1417
Priority: P2
Impeccable: A — sem UI nova (as facetas/cards do C233 já existem; faltam os dados)
Design UI: N/A — sem UI
Appetite: ~1 dia eng + tempo de máquina; um outcome verificável — o álbum mostra município/atividade e o card ganha legenda real
Responsável: —

## Intenção

Depois de publicar as 6.492 fotos (C242), a única faceta que aparece em `/fotos` é **Data** e o card mostra só título/metadados básicos do Flickr. Causa verificada em produção (2026-10-01): a **catalogação do C232 nunca rodou lá** — `catalog.*` está 100% vazio (`scene=0`, `municipio=0`, `caption=0`, `catalogedAt=0`). Os dados existem (título, descrição, tags, 6.2k álbuns do Flickr, `searchText`), mas não foram derivados para a ficha; e a parte de IA (legenda/atividade a partir da imagem) exige o engine de visão local, que não está de pé.

Este item entrega o caminho de catalogação em produção em duas camadas: **(1) metadata-only** (sem modelo): município pelo gazetteer, temas, e o que o texto sustentar; **(2) IA de visão** (legenda/descrição/atividade/texto visível) com o engine local documentado no runbook. O C244 (pessoa por facial), quando aprovado, toma o lugar do "pessoas" derivado de texto.

## Persona e fluxo

- **Persona / contexto:** visitante que procura "fotos em Feira de Santana" ou "de plenária"; assessoria que abre a ficha e quer legenda/atividade reais.
- **Job principal:** navegar o álbum por município/atividade e ver no card o que a foto é, onde e quando.
- **Fluxo desejado:** abre `/fotos` → as facetas Município e Atividade aparecem com valores reais → filtra → o card mostra `data · município · atividade` e legenda; a ficha no admin traz a proposta com procedência (`metadata`/`ia`).
- **Anti-goals de produto:** inventar nome de pessoa; publicar proposta de IA sem revisão por exceção; criar segunda curadoria.

## Objetivo e aceite

- Rodar a catalogação no acervo de produção (metadata-only primeiro; IA quando o engine estiver no ar) com recibos e reexecução idempotente.
- `/fotos` passa a exibir as facetas `Município` e `Atividade` quando houver valores; os cards ganham legenda quando houver (curadoria vence a IA).
- Nenhuma proposta sobrescreve campo curado (`curatedFields`); nada é publicado; a IA só é chamada por endereço privado (guardrail PII).
- Reexecutar não duplica nem repaga o que já está catalogado; o marker da camada metadata não pode bloquear a camada IA (design no impl).

## Dados (intenção)

- **Vou apresentar dados?** Não — a ficha exibe valores; sem números agregados.
- **Forma:** N/A.

## Dados da decisão (literais)

- **Estado verificado (2026-10-01):** produção com `catalog.*` zerado e searchText populado; a entrega pode derivar do texto sem modelo.
- **Engine de visão:** Ollama/host privado (`ARCHIVE_VISION_*`), hoje fora do ar; o runbook documenta como subir e rodar a camada IA.
- **Pessoas:** no metadata-only, não escrever `catalog.people` (o C244 assume a faceta pelo facial); temas/município seguem.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/catalog-archive-photos.mjs` + `src/utilities/flickr/archivePhotoCatalog.ts` (modo `--metadata-only` reaproveitando `resolveMentionedMunicipalityId`, `classifySpeechByGazetteer`, `archivePhotoThemesFrom` e o write transacional com `buildArchivePhotoCatalogWrite`); marker próprio (ex.: `catalog.metadataCheckedAt`) para não colidir com o `catalogedAt` da IA; runbook do engine de visão.
- **Precedente:** C232 (pipeline e guardas), C230 (writes por CLI + bust de cache via `/api/revalidate`).
- **Risco de acoplamento:** o skip por `catalogedAt` da IA precisa continuar válido; a curadoria (`curatedFields`) sempre vence; facetas públicas dependem de revalidação da tag `archivePhotos`.

## Dependências

- Duras: C232 (pipeline) e C242 (acervo publicado) — entregues.
- Soft: C244 (se aprovado antes, o metadata-only não escreve pessoas).

## Fora de escopo

- OCR dedicado, recorte/edição de imagem, segunda curadoria, superfície nova de revisão.

## Rabbit holes de produto

- **"Só completar" catalogando com terceiro/híbrido.** **Corte:** só engine local privado (PII).
- **"Só completar" publicando direto a proposta da IA.** **Corte:** publica é ato humano; a IA propõe.

## Questões em aberto (produto)

- **Subir o engine de visão agora ou só metadata-only?** **Recomendação:** metadata-only já; IA quando o host local estiver disponível. _(assumido — validar)_

## Referências

- `docs/plans/acervo-fotos-catalogacao-ia.md` / `-impl.md` (C232)
- `docs/plans/album-fotos-publico-busca.md` (C233 — facetas/cards)
- `docs/ops/teqo-1313-deploy.md` (runbook do engine)

## Self-score (shaping)

5/5 — (1) outcome verificável (facetas e cards com dados reais no ar); (2) appetite pequeno, reusando o dono; (3) persona/job/aceite claros; (4) direção com precedentes; (5) decisão de camadas registrada.
