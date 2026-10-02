# C244 — Filtro "Pessoa pública" por reconhecimento facial no álbum

Status: rascunho
Atualizado em: 2026-10-02
Issue: #1416
Implementação: docs/plans/album-pessoa-facial-impl.md
Priority: P1
Impeccable: B — muda a origem da faceta/card que já existem em `/fotos` (sem tela nova)
Design UI: N/A — a faceta e a linha "Quem aparece" já foram desenhadas no C233; muda a origem do dado
Appetite: ~2–3 dias eng + curadoria dos descritores de referência + aval jurídico registrado
Responsável: —

## Intenção

Hoje a faceta **Pessoa pública** do álbum (`/fotos?pessoa=<slug>`) sai do **texto** da ficha (`catalog.people`, derivado de título/álbum/legenda pelo C232): mostra fotos em que o nome foi _escrito_, não em que a pessoa _aparece_. A decisão do dono (2026-10-01) é que o filtro siga o **reconhecimento facial**: listar as fotos em que aquela pessoa realmente aparece. O C240 já deixou o motor e o índice de rostos em produção (18k descritores anônimos); falta a camada de **figuras curadas**: descritores de referência das pessoas públicas do catálogo (Solla, Lula, Jerônimo, Geraldinho, Wagner, Júlio Pinheiro e os 53 deputados estaduais), o vínculo foto↔figura no lote e a faceta lendo esse vínculo em vez do texto.

Isto é identificação biométrica de pessoas nomeadas — permitida **apenas** para o catálogo curado de figuras públicas, com o aval jurídico declarado que abriu o índice do C240; nunca para terceiros, nunca inferida de rosto para quem não está no catálogo.

## Persona e fluxo

- **Persona / contexto:** visitante que quer as fotos de uma figura (ex.: Lula, Jerônimo) para rever/guardar; assessoria que quer medir presença por pessoa.
- **Job principal:** filtrar o álbum por pessoa e ver **só as fotos em que ela aparece**.
- **Fluxo desejado:** abre `/fotos` → escolhe "Pessoa pública: Lula" → grade traz só fotos com o rosto de Lula (mesmo sem o nome escrito na ficha) → abre a foto em contexto; a linha "Quem aparece" lista as figuras curadas reconhecidas naquela foto.
- **Anti-goals de produto:** identificar/nomear terceiros; virar diretório de rostos; buscar por rosto de outra pessoa; score/percentual; vídeo.

### Design UI (B)

- N/A — a superfície (`pessoa` na URL, chip, card "Quem aparece") é a do C233; o item muda a origem do dado e o texto vazio da faceta quando não há figuras reconhecidas.

## Objetivo e aceite

- A faceta `pessoa` lista **apenas figuras do catálogo curado** com ≥1 foto aprovada reconhecida; a grade da URL `?pessoa=<slug>` traz exatamente essas fotos (por rosto, não por texto).
- "Quem aparece" no card/overlay mostra só figuras curadas reconhecidas na foto; nunca nome de terceiro.
- Despublicar/remover uma foto tira-a da faceta e do "Quem aparece" imediatamente; desligar o kill switch fecha tudo.
- Opt-out (C240 "Minha presença") remove o rosto do índice — e, se uma figura sair do catálogo/for removida, deixa de aparecer na faceta.
- Nada de score; nenhuma superfície promete "todas as fotos"; o texto vazio da faceta explica que só entram figuras reconhecidas com curadoria.
- **Guardrails:** Consent/LGPD fail-closed (o aviso do índice e o consentimento da consulta continuam sendo o gate); sem cruzamento com `Contact`/leadership; referência biométrica de figura é curada e auditável.

## Dados (intenção)

- **Vou apresentar dados?** Não — o resultado é a lista de fotos; nenhum número de semelhança.
- **Forma:** N/A — sem score/percentual em nenhum estado.

## Dados da decisão (literais)

- **Origem do filtro — decisão do dono (2026-10-01): facial.** A faceta passa a ler o vínculo foto↔figura do índice facial; o `catalog.people` (texto) pode continuar como conteúdo da ficha, mas não governa o filtro.
- **Catálogo inicial (curadoria):** Jorge Solla; Luiz Inácio Lula da Silva ("Lula"); Jerônimo Rodrigues ("Jerônimo"); Geraldo Júnior ("Geraldinho"); Jaques Wagner ("Wagner"); Júlio Pinheiro; + os 53 deputados estaduais do roster S30 (já no catálogo).
- **Referências:** cada figura precisa de descritor(es) de referência (retratos oficiais/arquivo, curadoria humana); a origem e o aval são registrados no runbook (mesmo caminho do consentimento do índice do C240).
- **Sem terceiros:** rostos que não casam com o catálogo continuam anônimos no índice; nunca são nomeados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** collection nova de figuras (`faceFigure`: nome curado + descritores de referência, admin-only) sobre o padrão do antigo `faceSubject`; `scripts/lib/faceEngine.mjs` + `pnpm faces:enroll-figure` (referência) e `faces:index` estendido para gravar o vínculo foto↔figura (o marker `faces.checkedKey` passa a incluir a revisão das figuras); a faceta/card em `src/lib/archivePhotoPublicCatalog.ts` trocam a fonte de `pessoa`; leitura pública em `archivePhotoReads`.
- **Precedente a olhar:** C240 (`faceIndex`, purge por despublicação, opt-out), histórico A/C do C234 (`faceSubject.matchedPhotos`), `publicFigureCatalog` (slugs/aliases), catálogo público do C233.
- **Risco de acoplamento:** a faceta é contrato público (URL/chip) — o valor `pessoa` não muda, só a origem; `catalog.people` continua na ficha (texto) para não quebrar a Central/curadoria; migration aditiva; o índice atual (18k rostos) precisa ser reprocessado ao introduzir figuras (marker novo).

## Dependências

- Duras: C240 (índice facial e opt-out) e C233 (álbum/faceta) — entregues; C232 (ficha curada) para o catálogo.
- Duras de produto: aval jurídico do uso biométrico para figuras nomeadas (o dono declarou na sessão de 2026-10-01; registrar no runbook).

## Fora de escopo

- Nomear terceiros ou qualquer pessoa fora do catálogo curado; busca por rosto de outra pessoa; API pública de reconhecimento; vídeo; ranking/score por figura.

## Rabbit holes de produto

- **"Só completar" identificando todos os rostos.** **Corte:** só o catálogo curado; o resto segue anônimo.
- **"Só completar" com score por figura.** **Corte:** sem número em nenhum estado.
- **"Só completar" automático sem curadoria.** **Corte:** figura só entra com referência curada e revisão humana; falso positivo é tratado como débito de curadoria, não como dado.

## Questões em aberto (produto)

- **Origem das referências faciais de cada figura?** Retratos oficiais/arquivo do mandato (assessoria), 1–3 por pessoa; quem aprova. _(assumido — validar)_
- **A faceta facial substitui o texto (decisão do dono) — e o `people` de texto sai do card?** **Recomendação:** sim para a faceta; manter o campo na ficha como conteúdo, sem aparecer como "Quem aparece" para não confundir as duas origens. _(assumido — validar)_
- **Falsos positivos (limiar):** manter 0.45 e revisar por exceção, com lista de revisão no runbook. _(assumido — validar)_

## Referências

- `docs/plans/busca-selfie-escopo-b.md` (C240 — índice anônimo; este item adiciona a camada curada)
- `docs/plans/album-fotos-publico-busca.md` (C233 — faceta/card desenhados)
- `docs/plans/acervo-fotos-catalogacao-ia.md` (C232 — de onde vem `catalog.people`)
- `src/lib/publicFigureCatalog.ts` · `src/lib/archivePhotoPublicCatalog.ts`

## Self-score (shaping)

5/5 — (1) outcome verificável (filtrar por pessoa e ver só as fotos em que ela aparece, por rosto); (2) appetite comporta reuso do motor do C240 + curadoria de referências; (3) persona/job/aceite claros; (4) direção no codebase com donos e precedentes nomeados; (5) decisões de produto registradas (facial, catálogo, sem terceiros).
