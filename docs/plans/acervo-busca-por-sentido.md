# C229 — Busca por sentido no acervo de falas

Status: rascunho
Atualizado em: 2026-09-25
Issue: #1360
Priority: P1
Impeccable: B — encaixe na tela existente (`/campanha/comunicacao/acervo`: modo "Por tema" com proveniência do resultado e ordenação; sem rota nova); design hi-fi obrigatório no gate
Design UI: docs/plans/acervo-busca-por-sentido-ui-design.html
Appetite: ~2–3 dias eng; um outcome verificável — buscar por sentido devolve a fala certa mesmo sem as palavras exatas, ordenada por proximidade, com evidência real e sem score
Responsável: —

## Intenção

A assessoria reportou, em resumo: a pesquisa "Por tema" do acervo não funciona como o esperado. Buscar "combate à oposição" deveria trazer os embates com o bolsonarismo e a direita; buscar "impeachment" deveria trazer a fala da votação do impeachment de Dilma. Não traz. O que existe é busca por termo: a IA expande a consulta em sinônimos/palavras-chave oficiais, o banco casa essas palavras no texto e a lista sai ordenada por data — a ordem não tem relação com o sentido. Daí a leitura do dono, que é exata: "parece busca por termo somada a matches em temas pré-definidos". A própria dica do seletor já promete "Encontra falas relacionadas pelo sentido" — é isso que este item faz ser verdade.

O C192 entregou o modo "Por tema" com expansão lexical + casamento literal, e a decisão de então (reforçada no C158 e no S28) fixou "embeddings/pgvector fora". Este item reabre esse anti-goal de propósito, **restrito ao acervo interno de falas**: o pedido literal do dono é busca semântica — o motor passa a ser similaridade por sentido (classe embeddings), e não mais a expansão de termos. Central pública (S28) e Sollinha (C158) seguem fora; viram sucessores se o motor provar.

P1: é o job diário de quem usa o acervo sob deadline de peça; nada bloqueia a operação (a busca exata continua), mas cada peça depende de achar a fala certa.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) — e também coordinator/candidate — na mesa, sob prazo curto, procurando a fala que embasa o vídeo/post.
- **Job principal:** achar a fala certa pelo sentido do que o deputado disse, mesmo sem lembrar as palavras e mesmo que ele tenha dito com outras.
- **Fluxo desejado:** digita o assunto e escolhe "Por tema" (modo já visível na tela) → lista ordenada por proximidade de sentido, data só como desempate, com trecho real de evidência e sem score → abre a fala e assiste/baixa, filtros e facetas valendo → nada serve = vazio honesto (reformular / termo exato / limpar filtros); motor fora = degrada para a busca lexical de hoje com aviso discreto.
- **Anti-goals de produto:** não inventa fala/minutagem/justificativa; não expõe score numérico; não regride a busca exata; não muda gate/RBAC nem expõe o acervo fora de `/campanha`; não mexe em cortes/player; não cobre gravações nem Central pública/Sollinha; não vira curadoria de sinônimos nem busca global.

### Esboço de fluxo (B)

```text
[acervo] → digita assunto → "Por tema" (modo visível)
  → lista por proximidade de sentido (data desempata) + trecho real de evidência (sem score)
  → abre a fala → assiste/baixa (filtros/facetas valendo)
  → vazio honesto: reformular | termo exato | limpar filtros
  → motor indisponível: degrada para a busca lexical de hoje com aviso discreto
```

### Design UI (B)

- Design UI (gate): `docs/plans/acervo-busca-por-sentido-ui-design.html` — por que B: muda o que a tela já mostra (ordem dos resultados, opção de ordenação e a evidência "por que apareceu" no card) e a leitura do seletor de modo, sem rota nem tela nova; o HTML hi-fi é o registro do aceite e a fonte de verdade do port, e consolida a copy da evidência.

## Objetivo e aceite

- Buscar "combate à oposição" devolve, no topo, as falas de embate com o bolsonarismo e a direita; buscar "impeachment" devolve a fala da votação do impeachment de Dilma entre outras — desde que a fala exista no acervo.
- O resultado vem ordenado por proximidade de sentido (data apenas como desempate), não por data; a ordenação explícita do usuário (data/duração) continua valendo quando escolhida.
- Cada resultado mostra um trecho real da fala — o mais próximo do tema — como evidência; nunca justificativa gerada por IA nem score numérico.
- A busca "Termo exato" permanece intacta e alcançável; nada que já funciona regride.
- Sem resultado quando nada serve: vazio honesto com saída (reformular, trocar modo, limpar filtros); nunca resultado "parecido" só para preencher a tela.
- Se o motor de sentido falhar ou estiver indisponível, degrada para a busca lexical de hoje com aviso discreto — nunca erro na cara do usuário nem resultado fantasma.
- Filtros/facetas seguem valendo no modo tema; a fala continua sendo a unidade do resultado (abrir/assistir/baixar intocado).
- **Guardrails:** quem não lê o acervo não lê (fail-closed no gate existente); leitura nova não alarga o gate; acervo segue interno; gravações e PII fora do recorte.

## Dados (intenção)

- **Vou apresentar dados?** Não — resultado de busca não é métrica nem agregado; o item muda o alcance da busca, não a leitura de números do acervo.
- **Decisões desbloqueadas:** N/A — a escolha da persona ("qual fala usar") é qualitativa; sem decisão numérica nomeável.
- **Forma:** N/A — restrição de produto: nenhum score numérico de confiança no resultado (número cru não ajuda o assessor e pode enganar).

## Dados da decisão (literais)

- Modo e selo: mantém "Termo exato | Por tema" no seletor existente (sem modo/rota nova) e o badge "Tema" nos resultados do modo tema.
- Modo tema: ordem padrão por proximidade de sentido, com data como desempate; ordenação explícita do usuário continua valendo.
- Rótulo consolidado no design: "Mais relevantes" (o default "Mais recentes" fica para o modo exato).
- Nenhum score numérico visível em nenhum estado.
- Corpus: falas do acervo (origem Câmara + internet); gravações enviadas ficam fora.
- Infra de IA: reuso da já contratada — sem novo provider pago, secret ou serviço vetorial dedicado.
- Evidência: rótulo consolidado no design "Trecho mais próximo do tema" (o anterior era "Por que apareceu").

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/ai/` (expansão atual sai do caminho principal), `src/utilities/speech/` (`speechListFilters`, `speechPageData`, `speechListUrl`, `speechViewModels`), `src/lib/` (ranking/normalização puros), `src/components/campaign/speech/` (modo, badge, evidência) e a rota do acervo; `scripts/` é onde a atualização do índice entra no fluxo de import manual.
- **Schema:** se a implementação exigir armazenamento de índice, é migration pelo fluxo normal do repo — shape fica no plano de implementação.
- **Precedente a olhar:** C192 (`docs/plans/acervo-busca-semantica.md` + `-impl.md`: modo, badge, degradação e evidência a evoluir) e as chamadas de IA com timeout/null em `src/utilities/ai/`; `scripts/import-web-speeches.mjs` (C225) como ponto onde o índice se atualiza.
- **Risco de acoplamento:** espelho puro `src/lib/speechSearch.ts` (C180) e contrato de URL (`speechListUrl`) não podem quebrar deep-link/ordenação/facetas; paginação continua por fala; gate de leitura intocado.

## Dependências

- Soft: C192/#1147 (modo/UI a evoluir); C155 e C225 (backfill e ingestão web — onde o índice se atualiza); C219 (gravações, só como decisão de cobertura).
- Duras: nenhuma.

## Fora de escopo

- Gravações enviadas (fonte própria, C219) — sucessor se o motor provar.
- Central pública (S28) e Sollinha/chat (C158) — anti-goal deles intacto aqui.
- Curadoria manual de sinônimos/expansão como motor.
- Analytics de busca (termos que falham, cliques).
- Serviço/banco vetorial dedicado e reindexação em tempo real — imports seguem manuais.
- Busca global (home-search) e dossiês/relatórios.

## Rabbit holes de produto

- **Índice vivo / reindexação em tempo real.** Se alguém "só completar": fila, job e sync a cada import. **Corte neste item:** a atualização do índice é passo do fluxo manual de import existente; sem infra de tempo real.
- **"Sempre achar algo".** Se alguém "só completar": similaridade fraca enchendo a lista ou um score para "explicar". **Corte neste item:** vazio honesto, sem score, evidência = trecho real.
- **Curador de sinônimos/ontologia.** Se alguém "só completar": o dicionário mantido à mão volta como motor. **Corte neste item:** o motor é sentido; expansão lexical no máximo degrada.
- **Semântica em todo o produto.** Se alguém "só completar": aplica à Central pública, ao Sollinha e aos dossiês. **Corte neste item:** só o acervo interno de falas; sucessores depois.

## Questões em aberto (produto)

- **O índice cobre só falas ou também gravações enviadas?** **Opções:** A) só falas do acervo (Câmara + internet), gravações fora | B) falas + gravações no mesmo índice | C) índice separado para gravações. **Recomendação:** A — o relato e o aceite são sobre o acervo de falas; gravações são fonte própria (C219) e entram como sucessor se o motor provar. _(assumido — validar com produto)_
- **A Central pública e o Sollinha entram?** **Opções:** A) não — só o acervo interno | B) Central pública também | C) Sollinha/chat também. **Recomendação:** A — a reabertura do anti-goal é restrita ao acervo; S28/C158 viram sucessores se o motor provar. _(assumido — validar com produto)_
- **A ordenação explícita do usuário sobrepõe a relevância no modo tema?** **Opções:** A) sim — relevância é o padrão, mas data/duração escolhidas mandam | B) relevância sempre vence | C) o seletor de ordenação some no modo tema. **Recomendação:** A — mantém o controle do assessor sem esconder o ganho do modo tema. _(assumido — validar com produto)_
- **Qual a evidência quando nenhum termo aparece no texto?** **Opções:** A) trecho real mais próximo do tema | B) só o selo "Tema", sem indício | C) manter o termo expandido quando existir e rótulo quando não. **Recomendação:** A — proveniência auditável, nunca explicação gerada por IA; o rótulo final sai no design. _(assumido — validar com produto)_
- **A expansão por LLM e as keywords oficiais deixam de ser o motor?** **Opções:** A) sim — o motor é similaridade por sentido e a expansão sai do caminho principal | B) híbrido silencioso (lexical + sentido) | C) mantém a expansão como motor. **Recomendação:** A — é o pedido literal e a razão do item; B/C são o comportamento que o dono rejeitou. _(assumido — validar com produto)_
- **A infra de IA já contratada serve para o índice de sentido?** **Opções:** A) reusar a infra existente (DeepInfra, que já atende ASR/chat) | B) provider novo só para embeddings | C) rodar modelo local sem provider. **Recomendação:** A — sem novo contrato, secret ou custo; se nenhum modelo entregar o aceite, a entrega degrada honestamente em vez de contratar. _(assumido — validar com produto)_
- **A degradação segue a de hoje?** **Opções:** A) mantém a busca lexical atual com o aviso discreto existente | B) erro pedindo nova tentativa | C) esconde o modo tema. **Recomendação:** A — nunca erro na cara do usuário nem resultado fantasma; o aviso preserva a honestidade.

## Referências

- GitHub Issue #1360
- Design UI (gate): `docs/plans/acervo-busca-por-sentido-ui-design.html`
- Precedente direto (a evoluir): `docs/plans/acervo-busca-semantica.md` (C192/#1147) + `-impl.md` — expansão lexical e rejeição de embeddings/pgvector que este item reabre.
- Anti-goals reabertos e mantidos fora: `docs/plans/sollinha-acervo-falas-trechos.md` (C158) e `docs/plans/central-conteudos-busca-semantica.md` (S28).
- Arquivos-pista: `src/utilities/ai/expandSpeechSearchTheme.ts` · `src/utilities/speech/speechListFilters.ts` · `src/utilities/speech/speechPageData.ts` · `src/utilities/speech/speechViewModels.ts` · `src/components/campaign/speech/SpeechResultCard.tsx` · `src/collections/Speech.ts`
- `AGENTS.md` — RBAC de `/campanha`, acervo interno e leader lockdown.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (achar a fala pelo sentido, ordenada por proximidade, com evidência real); (2) appetite ~2–3 dias comporta motor + ordenação + encaixe, com cobertura e storage no plano de implementação; (3) persona, job e aceite com os dois exemplos literais do dono; (4) direção no codebase é hipótese com precedentes nomeados; (5) zero decisão dura de engenharia (storage, provider/model, migration e chunking ficam no plano de implementação).
