# C192 — Busca semântica no acervo de falas

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1147
Priority: P1
Impeccable: B — encaixe na tela do acervo (`/campanha/comunicacao/acervo`: omnibox, lista e vazio existentes)
Design UI: docs/plans/acervo-busca-semantica-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável — buscar por tema sem as palavras exatas devolve falas do acervo com proveniência do resultado e fallback honesto
Responsável: —

## Intenção

A assessoria de comunicação trabalha com o acervo de falas (997 discursos em produção) sob prazo de peça, e a busca atual só acha o que o deputado literalmente falou: "Defesa do SUS" retorna falas em que essas palavras aparecem, não as falas em que ele defende o SUS com outras palavras. O job real — achar a fala certa por tema/sentido — continua garimpo manual, mesmo com o acervo já pesquisável (C153/C154/C155).

O C158 declarou busca semântica/embeddings como fora de escopo ("item futuro se houver demanda"). A demanda chegou: os assessores pediram explicitamente. Este item reabre aquele anti-goal de propósito, restrito ao acervo.

P1: ataca o job central de quem usa o acervo todo dia sob deadline; não é P0 porque a busca lexical de hoje continua funcionando e não há bloqueio operacional.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) — e também coordinator/candidate — na mesa, sob prazo curto de peça, procurando a fala que embasa o vídeo/post.
- **Job principal:** encontrar a fala certa por tema/sentido, mesmo quando o deputado não usou as palavras da busca.
- **Fluxo desejado:**
  1. Abre o acervo e digita o tema ("defesa do SUS", "saúde no subúrbio") no campo de busca.
  2. Escolhe como buscar: termo exato (como hoje) ou por tema — a escolha é visível, o usuário sabe o que pediu.
  3. Recebe a lista de falas; cada resultado por tema vem sinalizado, com um indício curto de por que apareceu (trecho/tema), para não virar caixa preta.
  4. Abre a fala e assiste/baixa como já faz hoje.
  5. Se nada servir, recebe um vazio honesto com saída (reformular, voltar ao termo exato, limpar filtros) — nunca resultado "parecido" só para preencher a tela.
- **Anti-goals de produto:** não inventa fala nem minutagem; não troca a busca exata por caixa preta; não muda gate/RBAC do acervo; não mexe em cortes/player/pipeline; não expõe o acervo fora de `/campanha`; não vira curador de sinônimos nem busca global.

### Esboço de fluxo (B)

```text
[acervo] → digita tema → escolhe "por tema" (modo visível)
  → lista com resultados sinalizados (por tema vs termo exato)
  → abre a fala no acervo → assiste/baixa
  → vazio honesto: reformular | termo exato | limpar filtros
```

### Design UI (B)

- Design UI (gate): `docs/plans/acervo-busca-semantica-ui-design.html`
- Por que B e não A: a mudança exige affordance nova (escolher o modo de busca) e estado novo (sinal de resultado por tema e vazio honesto) dentro da tela existente — sem rota nova. Design hi-fi obrigatório no gate e fonte de verdade do port.

## Objetivo e aceite

- Buscar um tema sem as palavras exatas (ex.: "defesa do SUS") devolve falas que defendem o SUS ainda que sem a expressão, sobre o recorte do acervo que resolve o job.
- Todo resultado deixa claro por que apareceu: termo exato vs tema, com indício curto (trecho/tema) — sem "parecido" enganoso.
- Busca exata continua alcançável com o comportamento de hoje; nada que já funciona regride.
- Sem resultado quando nada serve: vazio honesto com saída (reformular/trocar modo/limpar filtros); nunca resultado inventado.
- Se o mecanismo por tema falhar/estiver indisponível, degrada para a busca lexical de hoje com aviso discreto — nunca erro na cara do usuário nem resultado fantasma.
- Filtros/facetas atuais (tema, alcance, fase, ano, município, duração) seguem valendo junto com a busca.
- A fala continua sendo a unidade do resultado; abrir/assistir/baixar é o fluxo atual do acervo, intocado.
- **Guardrails:** quem não lê o acervo não lê (fail-closed, `user` + access control no caminho); leitura nova não alarga o gate; acervo segue interno.

## Dados (intenção)

- **Vou apresentar dados?** N/A — resultados de busca não são métrica/agregado nem desbloqueiam decisão numérica; o item muda o alcance da busca, não a leitura de números do acervo.
- **Decisões desbloqueadas:** N/A — a escolha da persona ("qual fala usar") é qualitativa.
- **Forma:** N/A — sem superfície de dados; restrição de produto: o sinal do resultado é explicação qualitativa, nunca score numérico de confiança (número cru não ajuda o assessor e pode enganar).

## Dados da decisão (literais)

- N/A — a intenção não fixa ID, env, modelo ou string exata de produto. O rótulo do modo (termo exato ↔ tema) e o sinal no resultado são copy/estado a validar no design hi-fi do gate e a detalhar no plano de implementação.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota `src/app/(campaign)/campanha/(app)/comunicacao/acervo/page.tsx`; `src/components/campaign/speech/` (filtros, lista, cards); `src/utilities/speech/` (`speechListFilters.ts`, `speechPageData.ts`, `speechListUrl.ts`, `speechOmnibox.ts`); espelho puro `src/lib/speechSearch.ts`; `src/utilities/access/speeches.ts` se houver leitura nova.
- **Precedente a olhar:** C154 (busca/facetas e o `where` montado em `speechListFilters.ts`); C158 (`docs/plans/sollinha-acervo-falas-trechos.md` — reabertura do anti-goal) e `src/utilities/ai/rerankSpeechExcerpts.ts` (rerank com timeout/fallback null); `src/utilities/ai/deepInfraTranscribe.ts` (REST OpenAI-compatible) como pista de mecanismo — sem contrato.
- **Risco de acoplamento:** o espelho `speechSearch.ts` (C180) precisa acompanhar a semântica nova; contrato de URL da lista (`speechListUrl`) não pode quebrar deep-links nem a OR dos cortes (C174); paginação continua por fala; gate de leitura intocado.

## Dependências

- Entregues (duras, satisfeitas): C153/C154/C155 (catálogo, acervo e backfill — 997 discursos em produção); C174 (cortes) e C180 (espelho) tocados de leve.
- Soft: C158/#982 (rerank sobre candidatos textuais no Sollinha) — insight reutilizável; não bloqueia nem é pré-requisito.
- Nenhuma dura bloqueante.

## Fora de escopo

- Busca semântica no Sollinha/chat, busca global e dossiês/relatórios — o recorte é o acervo.
- Exposição pública do acervo ou compartilhamento externo.
- Curadoria manual de sinônimos/ontologia e tagueamento em massa (se doer, outro item).
- Mudanças em cortes, player e pipeline de import/ASR.
- Trocar a busca exata pela semântica — a exata permanece.
- Analytics de busca do acervo (termos que falham, cliques) — outro item se houver demanda.

## Rabbit holes de produto

- **Índice vetorial de todo o acervo / infra nova.** Se alguém "só completar": pipeline de embedding, backfill dos 997 discursos, storage vetorial, sync contínuo. **Corte neste item:** a fatia é a que resolve o job dos assessores; cobertura e mecanismo são decisão do plano de implementação, sem reindexar tudo para provar valor.
- **Híbrido silencioso.** Se alguém "só completar": semântica automática no mesmo campo sem o usuário saber. **Corte:** modo visível + sinal por resultado; honestidade > recall.
- **"Sempre achar algo".** Se alguém "só completar": similaridade fraca enchendo a lista. **Corte:** vazio honesto; nunca "parecido" enganoso.
- **Curador de sinônimos/ontologia.** **Corte:** fora; vazio honesto e reformulação cobrem.
- **Semântica em todo o produto.** **Corte:** só o acervo.

## Questões em aberto (produto)

- **Modo explícito ou híbrido automático?** **Opções:** A) híbrido automático no mesmo campo | B) modo visível no campo, termo exato como padrão e "por tema" explícito | C) campo exato + ação "buscar por tema" só quando pedida. **Recomendação:** B — o usuário precisa saber o que pediu e por que o resultado apareceu; o padrão exato preserva o que já funciona (honestidade > recall enganoso). _(assumido — validar com produto)_
- **Como o resultado sinaliza "por tema" vs "termo exato"?** **Opções:** A) selo por resultado ("Tema"/"Termo exato") com indício curto | B) aviso único no topo da lista | C) só o modo ativo no campo. **Recomendação:** A — o selo por item sustenta a confiança em cada fala; o modo ativo no campo complementa, não substitui. _(assumido — validar com produto)_
- **E se o mecanismo por tema falhar/estiver indisponível?** **Opções:** A) degrada para a busca lexical de hoje com aviso discreto | B) erro pedindo nova tentativa | C) esconde o modo. **Recomendação:** A — nunca erro na cara do usuário nem resultado fantasma; o aviso mantém a honestidade do que está sendo mostrado. _(assumido — validar com produto)_
- **Semântica cobre falas ou trechos (segmentos)?** **Opções:** A) falas (unidade da lista hoje) | B) falas + trechos | C) trechos com link para a fala. **Recomendação:** A — o job é "qual fala serve"; recorte fino de trecho é o job do C158 no Sollinha. O matching pode considerar o texto dos segmentos por dentro, mas o resultado continua sendo a fala. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1147
- Design UI (gate): `docs/plans/acervo-busca-semantica-ui-design.html` (+ assets em `docs/plans/acervo-busca-semantica-ui-design-assets/`)
- Plano que reabrimos: `docs/plans/sollinha-acervo-falas-trechos.md` (C158/#982) — anti-goal "não vira busca semântica"
- Planos irmãos: `docs/plans/acervo-videos-comunicacao.md` (C154), `docs/plans/catalogo-falas-solla.md` (C153), `docs/plans/backfill-acervo-falas.md` (C155)
- Arquivos-pista: `src/app/(campaign)/campanha/(app)/comunicacao/acervo/page.tsx`, `src/components/campaign/speech/SpeechAcervoFilters.tsx`, `src/utilities/speech/speechListFilters.ts`, `src/utilities/speech/speechPageData.ts`, `src/lib/speechSearch.ts`, `src/collections/Speech.ts`
- `AGENTS.md` — RBAC de `/campanha`, acervo interno e leader lockdown
