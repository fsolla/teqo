# Gravações enviadas no acervo de comunicação

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1166
Priority: P2
Impeccable: C — fluxo novo na vertical `/campanha/comunicacao/acervo` (upload + nova fonte + detalhe)
Design UI: docs/plans/acervo-gravacoes-enviadas-ui-design.html
Appetite: ~3–4 dias eng; um outcome verificável — a assessoria sobe uma plenária/debate e a gravação fica pesquisável no acervo, com player e transcrição
Responsável: —

## Intenção

O acervo de falas só tem o que a Câmara publica. Mas a comunicação do mandato também grava plenárias, debates e material próprio que hoje fica em pastas e celulares — sem transcrição, sem busca e sem lugar comum. Quem precisa de um trecho continua garimpando vídeo no olho.

Este item permite que a assessoria envie um arquivo de gravação e o transforme numa fonte pesquisável dentro do acervo: transcrição com timestamps ao longo de toda a gravação, busca textual que alcança a fala de qualquer pessoa presente (não só o Solla — requisito, não efeito colateral), player que abre no trecho e download do arquivo. É o primeiro passo da linha; separar/rotular quem falou é o C200.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`), na mesa, lidando com arquivos longos (horas) de plenárias e debates; `coordinator`/`candidate` usam o mesmo acervo. Busca e leitura também acontecem em campo.
- **Job principal:** guardar uma gravação própria no acervo e, depois, achar nela a fala/trecho que embasa a peça — de qualquer pessoa que falou.
- **Fluxo desejado:** abre o acervo → alterna para "Gravações enviadas" → "Enviar gravação" (arquivo local, título e data) → acompanha o estado → com "Pronto", busca por assunto e lê o trecho com timestamps → abre o detalhe: player, transcrição clicável, "Baixar" → se falhou, "Reprocessar transcrição".
- **Anti-goals de produto:** não é editor de vídeo/transcrição; não expõe o acervo; não publica nada; não cria cadastro de pessoa; não é CMS de vídeo genérico.

### Esboço de fluxo (C)

```text
[acervo /campanha/comunicacao/acervo]
  → alternador de fonte: "Falas da Câmara" | "Gravações enviadas"
  → "Enviar gravação" → arquivo local + título/data → estado visível na lista
  → (Enviando → Processando → Pronto | Falhou)
  → Pronto: busca textual alcança a fala de qualquer pessoa → abre o detalhe
  → player + transcrição clicável (clique posiciona o player) + "Baixar"
  → Falhou: "Reprocessar transcrição"
[outcome: gravação própria pesquisável no acervo, sem depender de fora]
```

### Design UI (C)

- Design UI (gate): `docs/plans/acervo-gravacoes-enviadas-ui-design.html` — alternador de fonte, envio com estados, lista e detalhe (player + transcrição + download), na linguagem visual do `/campanha`. Por que C: fluxo novo (upload + nova fonte + detalhe), mesmo sem rota de topo nova.

## Objetivo e aceite

- `communicator` — e `coordinator`/`candidate` — envia um arquivo de vídeo local e acompanha o processamento até "Pronto"; `advisor`/`leader` não têm acesso (fail-closed).
- A gravação vira uma fonte do acervo em `/campanha/comunicacao/acervo`, com alternador visível "Falas da Câmara" × "Gravações enviadas"; a fonte nova tem busca própria, sem as facetas da Câmara.
- A busca textual encontra a fala de qualquer pessoa da gravação, com trecho e timestamps; a unidade do resultado é a gravação.
- Detalhe da gravação: player, transcrição clicável por segmento (clique posiciona o player, como no acervo atual), "Baixar" e "Reprocessar transcrição" no estado "Falhou".
- Estados de processamento visíveis e honestos; a falha preserva o arquivo e permite reprocessar.
- Gravação só é servida para quem tem acesso ao acervo — nunca URL pública — reusando o dono do mecanismo de mídia privada definido no C193.
- **Guardrails:** sem diarização/rotulagem de pessoa (C200), sem corte/clipe, sem publicação externa, sem segundo cadastro de pessoa, sem score/vaidade; transcrição somente leitura em v1.

## Dados (intenção)

- **Vou apresentar dados?** N/A — resultados de busca não são métrica nem agregado; não desbloqueiam decisão numérica.
- **Decisões desbloqueadas:** N/A — a escolha da persona ("qual fala/trecho usar") é qualitativa.
- **Forma:** N/A — restrição de produto: nenhum score de relevância/similaridade exposto como número.

## Dados da decisão (literais)

- **Papel:** `communicator` = "Assessor de Comunicação"; `coordinator`/`candidate` também. Mesmo gate de leitura do acervo (`speechCatalog`); `advisor`/`leader` fora.
- **Fontes (rótulos):** "Falas da Câmara" (acervo atual) e "Gravações enviadas" (novo), no mesmo `/campanha/comunicacao/acervo` via alternador; detalhe da gravação em rota própria sob o acervo, `/campanha/comunicacao/acervo/gravacoes/[id]`.
- **Gestos:** "Enviar gravação" (upload) · "Reprocessar transcrição" · "Baixar" (arquivo) · player no detalhe.
- **Estados de processamento:** "Enviando" (arquivo subindo; ainda não pesquisável) · "Processando" (transcrevendo; ainda não pesquisável) · "Pronto" (pesquisável: player, transcrição e download) · "Falhou" (transcrição não saiu; arquivo preservado e "Reprocessar transcrição" disponível). A gravação aparece na lista com o estado desde o envio.
- **Transcrição:** timestamps por segmento; clique no segmento posiciona o player — mesmo comportamento do acervo atual.
- **Entrada:** arquivo de vídeo local (mp4/mov/mkv e afins); erro claro acima do limite; gravações de horas são o caso real — o valor do limite é decisão da implementação.
- **Apagar:** com confirmação; remove a gravação (e sua transcrição/mídia) sem tocar nas falas da Câmara.
- **Dependência dura:** C193 (mídia privada/servir autenticado); C200 (separação por pessoa) depende deste.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/comunicacao/acervo/` (página atual + sub-rota nova), `src/components/campaign/speech/` (alternador, lista, filtros, player, detalhe), `src/utilities/speech/` (`speechPageData.ts`, `speechListFilters.ts`, `speechListUrl.ts`, `speechViewModels.ts`), `src/utilities/access/speeches.ts` (leitura), `src/utilities/campaignPageActor.ts` (gate `speechCatalog`), esteira de mídia (`Media`/`mediaStorage.ts` como referência, respeitando o dono do C193).
- **Precedente a olhar:** C174 (segunda fonte já entra na mesma busca via OR de ids), `speechCutJob.ts` (status + step + disparo pós-resposta + reaper preguiçoso), `speechPosterJob.ts` (single-flight), import CSV de apoiadores (enviar → processar → confirmar), route handler multipart `src/app/(campaign)/campanha/api/ai-transcribe/route.ts`, CLI da Câmara (`scripts/import-camara-speeches.mjs` + `scripts/lib/camaraFetch.mjs`) para o padrão de ASR com timestamps.
- **Risco de acoplamento:** (1) mídia privada é do C193 — não criar mecanismo gêmeo; `Media` continua leitura pública (contrato pinado em teste); (2) upload de vídeo de horas não cabe no default de server action (1 MB) — decisão do plano de implementação; (3) regra de chrome/regex do acervo pode capturar `gravacoes` como id (mesma armadilha anotada no C194); (4) nav pinada `[Acervo, Cortes]` e C184/#1106 mexem nos mesmos arquivos — nada de item de nav novo; (5) contrato de URL da lista atual (`q|year|topic|scope|phase|municipality|duration|page`) não pode quebrar deep-links.

## Dependências

- **C193 (dura):** mecanismo de mídia privada e servir autenticado. O C199 pode possuir o upload de arquivo grande; o _servir privado_ é do C193 — sem ele fechado, a fatia privada não entra.
- **C153/C154 (entregues):** base do acervo (dados, busca, rota, gate).
- **C184/#1106 (soft):** conflito de nav/sub-itens — serializar.
- **C200 (futuro):** depende deste; não bloqueia a fatia.

## Fora de escopo

- Diarização/rotulagem por pessoa (C200).
- Link/YouTube/download automático por URL.
- Cortes/clipes (C167/C174 são da Câmara).
- Busca semântica (C192).
- Edição de transcrição.
- Publicação externa/espelhamento em rede social.
- Dossiês/Sollinha.
- Comissões/outras fontes e classificação por tema/alcance.

## Rabbit holes de produto

- **Virar editor.** Se alguém "só completar": cortar, corrigir, legendar, remixar. **Corte neste item:** transcrição somente leitura; a única "edição" é reprocessar a transcrição inteira.
- **Diarização no v1.** Se alguém "só completar": rotular quem falou em horas de áudio. **Corte neste item:** C200; a busca textual geral já resolve o job.
- **Espelhar/publicar.** Se alguém "só completar": derivar para redes ou galeria. **Corte neste item:** arquivo interno; nada sai do acervo.
- **Segundo cadastro de pessoa.** Se alguém "só completar": transformar falante em `Contact`. **Corte neste item:** sem rótulo de pessoa em v1.
- **Merge unificado das fontes.** Se alguém "só completar": lista única Câmara+gravações e entrada no `home-search`. **Corte neste item:** alternador dentro do acervo; a busca global não entra.
- **Fila/infra de processamento.** Se alguém "só completar": pipeline genérico, tempo real, chunking. **Corte neste item:** processamento inteiro com estado visível.

## Questões em aberto (produto)

- **Forma da segunda fonte?** **Opções:** A) duas fontes no mesmo acervo, com alternador e busca própria | B) merge das duas numa lista única | C) rota separada fora do acervo. **Recomendação:** A — as facetas da Câmara não se aplicam à gravação e o merge multi-coleção é caro; o alternador mantém "acervo pesquisável" sem fingir homogeneidade. _(assumido — validar no gate)_
- **Transcrição editável em v1?** **Opções:** A) somente leitura | B) correção manual inline. **Recomendação:** A — correção vira curadoria; se doer, item próprio. _(assumido — validar no gate)_
- **Quem apaga uma gravação?** **Opções:** A) qualquer um dos três papéis com acesso, com confirmação | B) só `coordinator`/`candidate`. **Recomendação:** A — a assessoria é dona do acervo no dia a dia; apagar não toca nas falas da Câmara e é confirmado. _(assumido — validar no gate)_
- **Gravação que falhou fica visível?** **Opções:** A) sim, com "Falhou" e "Reprocessar transcrição" | B) só aparece quando "Pronto". **Recomendação:** A — falha silenciosa faz o arquivo sumir sem explicação. _(assumido — validar no gate)_
- **O que a assessoria preenche ao enviar?** **Opções:** A) título obrigatório + data da gravação | B) só o arquivo. **Recomendação:** A — sem isso a lista vira pilha de `IMG_…`; uploader e duração são automáticos. _(assumido — validar no gate)_

## Referências

- GitHub Issue #1166
- Design UI (gate): `docs/plans/acervo-gravacoes-enviadas-ui-design.html` (+ assets em `docs/plans/acervo-gravacoes-enviadas-ui-design-assets/`)
- Planos irmãos: `docs/plans/catalogo-falas-solla.md` (C153) · `docs/plans/acervo-videos-comunicacao.md` (C154) · `docs/plans/acervo-busca-semantica.md` (C192) · `docs/plans/reels-reel-privado.md` (C193) · `docs/plans/reels-biblioteca.md` (C194)
- Arquivos-pista: `src/app/(campaign)/campanha/(app)/comunicacao/acervo/page.tsx` · `src/components/campaign/speech/` · `src/utilities/speech/speechPageData.ts` · `src/utilities/speech/speechListFilters.ts` · `src/utilities/speech/speechListUrl.ts` · `src/lib/speechSearch.ts` · `src/collections/SpeechSegment.ts` · `src/utilities/speech/speechCutJob.ts` · `scripts/import-camara-speeches.mjs`
- `AGENTS.md` — RBAC de `/campanha`, acervo interno e leader lockdown
