# S28 — Busca por tema na Central de Conteúdos pública

Status: rascunho
Atualizado em: 2026-09-22
Issue: #1257
Priority: P2
Impeccable: B — encaixe no campo de busca e na lista da Central (S27)
Design UI: docs/plans/central-conteudos-busca-semantica-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável — buscar por sentido na Central pública devolve peças publicadas com proveniência e degradação honesta
Responsável: —

## Intenção

A Central de Conteúdos pública (S27) deixa o eleitor achar as peças por termo exato — mas o eleitor pensa por assunto, não por palavra: "fim da escala 6x1" e "saúde no subúrbio" não aparecem literalmente em toda peça que trata disso. Sem o modo por tema, a Central só confirma o que o eleitor já sabia procurar; não o ajuda a descobrir. Este item é a fatia de busca-por-tema da Central: a peça certa aparece pelo sentido, com honestidade sobre por que apareceu.

O precedente é interno e já está em produção: C192 (acervo de falas) provou o mecanismo — expansão do tema por LLM + busca lexical, modo visível, selo por resultado, vazio honesto, degradação com aviso. A diferença crítica aqui é a rota ser PÚBLICA e sem login: não existe limitador anônimo hoje e a expansão não é cacheada — custo aberto é o risco novo, não o mecanismo. P2: a Central já funciona por termo exato; o modo por tema cumpre a intenção do dono, mas não bloqueia o go-live.

## Persona e fluxo

- **Persona / contexto:** eleitor sem login, majoritariamente no celular, chegando de link de WhatsApp/Instagram ou de busca, querendo ver o que o Solla fez/falou sobre um assunto. Secundária: assessoria que procura peça para reenviar.
- **Job principal:** achar material sobre um tema pelo sentido, mesmo quando a peça não usa as palavras da busca.
- **Fluxo desejado:**
  1. Digita o tema no campo de busca da Central.
  2. Escolhe como buscar: termo exato (como hoje) ou por tema — a escolha é visível; "Termo exato" é o padrão.
  3. Recebe as peças; cada resultado por tema vem marcado ("Tema") com um indício curto e real de por que apareceu (trecho da descrição/transcrição).
  4. Abre a peça (fluxo público atual da Central) e lê/compartilha.
  5. Se nada servir, vazio honesto com saída (reformular, usar termo exato, limpar filtros) — nunca resultado "parecido" só para preencher a tela.
- **Anti-goals de produto:** não vira gerador gratuito de texto nem buscador geral do site; não expõe o acervo interno de falas, PII ou fala de terceiro fora de peça publicada; não troca a busca exata; não inventa resultado nem mostra score numérico.

### Esboço de fluxo (B)

```text
[Central pública] → digita tema → escolhe "Por tema" (modo visível; "Termo exato" é o padrão)
  → lista de peças publicadas; card por tema: selo "Tema" + "por que apareceu" (trecho real)
  → abre a peça → lê/compartilha
  → vazio honesto: reformular | usar termo exato | limpar filtros
  → tema indisponível/limite atingido: busca exata continua + aviso discreto
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-busca-semantica-ui-design.html`
- Por que B e não A: exige affordance nova (escolher o modo) e estados novos (selo/proveniência, vazio honesto, aviso de degradação) dentro do campo de busca e da lista que o S27 já entrega — sem rota nova. O HTML hi-fi é fonte de verdade do port.

## Objetivo e aceite

- Buscar um tema sem as palavras exatas (ex.: "fim da escala 6x1") devolve peças publicadas que tratam do tema, sobre o corpus da Central.
- Todo resultado deixa claro por que apareceu: "Tema" vs "Termo exato", com indício curto e real (trecho da descrição/transcrição) — sem score numérico nem "parecido" enganoso.
- "Termo exato" continua sendo o padrão e o comportamento de hoje não regride.
- Sem resultado quando nada serve: vazio honesto com saída (reformular/trocar modo/limpar filtros); nunca resultado inventado.
- Se o mecanismo por tema falhar/estiver indisponível, degrada para a busca exata com aviso discreto — nunca erro na cara nem resultado fantasma.
- Filtros da Central (cidade, região, categoria, instituição, etc.) seguem valendo junto com a busca, nos dois modos.
- **Guardrails:** a busca cobre SÓ peças publicadas da Central; nada do acervo interno, nada de PII, nada de fala de terceiro fora de peça publicada. A rota é pública: a busca por tema não pode virar custo aberto — precisa de limite de uso (mecanismo a critério da implementação) e as chamadas não podem ser disparadas por bot/crawler; sob abuso, o modo degrada e ninguém usa a Central como gerador gratuito de texto.

## Dados (intenção)

- **Vou apresentar dados?** N/A — resultado de busca não é métrica nem agregado; nenhuma decisão numérica é desbloqueada.
- **Decisões desbloqueadas:** N/A — a escolha do eleitor ("qual peça abrir/compartilhar") é qualitativa.
- **Forma:** N/A — sem superfície de dados; restrição de produto: o sinal do resultado é explicação qualitativa (trecho real), nunca score de confiança.

## Dados da decisão (literais)

- Modo visível no campo de busca: "Buscar por: Termo exato | Por tema"; "Termo exato" é o padrão.
- Resultado por tema marcado ("Tema") com indício curto e real de por que apareceu (trecho da descrição/transcrição); nunca score numérico nem "parecido" enganoso.
- Vazio honesto com saída: reformular · usar termo exato · limpar filtros.
- Degradação: sem chave, timeout ou limite de uso, a busca exata continua e um aviso discreto explica — nunca erro na cara nem resultado fantasma.
- Guardrail de custo/abuso: limite de uso obrigatório (mecanismo a decidir na implementação); chamada de tema não pode ser disparada por bot/crawler; sob abuso, o modo degrada.
- Corpus: só peças publicadas da Central; nada do acervo interno, nada de PII.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota pública da Central em `src/app/(frontend)/` (S27); componentes da Central (campo de busca/lista/card); `src/utilities/ai/` (expansão + limitador anônimo novo); `src/lib/` (normalização/sanitização); loader da coleção de peças do C211.
- **Reuso do C192 (pista, não contrato):** `src/utilities/ai/expandSpeechSearchTheme.ts` (contrato `null` em falha, timeout), `src/lib/speechThemeTerms.ts` (sanitização dos termos do LLM), `src/utilities/speech/speechListFilters.ts` (OR textual por termo), `src/lib/speechSearch.ts` (`normalizeForSearch` + espelho), `src/utilities/speech/speechListUrl.ts` (`mode=tema` só com `q`); UI para inspirar: `SpeechAcervoFilters.tsx`, `SpeechResultCard.tsx` (selo "Tema" + "Por que apareceu"), `SpeechThemeFallbackNotice.tsx`.
- **A diferença da rota pública (o que o executor não pode copiar):** o rate limit existente (`src/utilities/ai/rateLimit.ts`) é chaveado por `userId` e só roda atrás de auth — não serve aqui; a expansão não é cacheada; `DEEPSEEK_API_KEY` é global. Corpus provavelmente um `searchText` normalizado por peça (padrão `Speech.searchText`/`Recording.searchText`), com índice trigram como precedente (`src/migrations/20260913_001200_add_speech_segment_trgm_index.ts`).
- **Risco de acoplamento:** não expor acervo interno nem PII por descuido de `depth`/relação; não quebrar a busca exata nem o contrato de URL/filtros do S27; rota nova em `(frontend)` acorda os specs públicos no manifesto e2e (`scripts/lib/e2e-affected-manifest.mjs`).

## Dependências

- S27 (dura) — a página pública da Central e seu campo de busca/lista; sem ela não há onde encaixar o modo.
- C211 (dura) — as peças catalogadas (título, descrição, temas, transcrição); sem descrição/transcrição o "por que apareceu" não tem trecho real.
- C192 (soft) — mecanismo entregue e em produção; pista de reuso, não pré-requisito.

## Fora de escopo

- Busca por tema no acervo interno de falas — já é C192.
- Embeddings/pgvector e infra vetorial.
- Curadoria manual de sinônimos/ontologia.
- Busca por voz.
- Analytics de busca (termos que falham, cliques) — outro item se houver demanda.
- Busca global no site inteiro ou em outros corpora (posts, notícias).

## Rabbit holes de produto

- **Índice vetorial/infra nova.** Se alguém "só completar": pipeline de embedding, backfill, storage vetorial, sync. **Corte neste item:** reusar o caminho lexical do C192; cobertura/mecanismo são decisão da implementação.
- **"Sempre achar algo".** Se alguém "só completar": similaridade fraca enchendo a lista. **Corte:** vazio honesto; nunca "parecido" enganoso.
- **Curador de sinônimos/ontologia.** **Corte:** fora; vazio honesto e reformulação cobrem.
- **Acervo interno como corpus "porque é mais rico".** **Corte:** só peças publicadas da Central — anti-goal do C192 e regra de PII.

## Questões em aberto (produto)

- **Modo explícito ou automático?** **Opções:** A) automático no mesmo campo | B) modo visível ("Termo exato | Por tema"), exato como padrão | C) ação "buscar por tema" só quando pedida. **Recomendação:** B — o eleitor precisa saber o que pediu e por que o resultado apareceu; o padrão exato preserva o que já funciona. _(assumido — validar com produto)_
- **Como limitar custo/abuso numa página sem login?** **Opções:** A) limitador anônimo (IP/sessão) + degradação sob abuso | B) cachear a expansão e limitar por sessão | C) desafio de interação humana antes do modo. **Recomendação:** A + cache da expansão quando barato — degradar em vez de errar; o mecanismo exato fica na implementação. _(assumido — validar com produto)_
- **Como o resultado sinaliza "por tema"?** **Opções:** A) selo "Tema" por resultado + trecho real | B) aviso único no topo | C) só o modo ativo no campo. **Recomendação:** A — proveniência por peça sustenta a confiança; o modo no campo complementa. _(assumido — validar com produto)_
- **E se o mecanismo falhar/limite estourar?** **Opções:** A) degrada para termo exato com aviso discreto | B) erro pedindo nova tentativa | C) esconde o modo. **Recomendação:** A — nunca erro na cara nem resultado fantasma; o aviso mantém a honestidade. _(assumido — validar com produto)_

## Referências

- Design UI (gate): `docs/plans/central-conteudos-busca-semantica-ui-design.html` (+ assets em `central-conteudos-busca-semantica-ui-design-assets/`)
- Precedente C192: `docs/plans/acervo-busca-semantica.md` e `docs/plans/acervo-busca-semantica-impl.md`
- Planos irmãos: `docs/plans/central-conteudos-publica.md` (S27) · `docs/plans/central-conteudos-ingestao.md` (C211)
- Arquivos-pista: `src/utilities/ai/expandSpeechSearchTheme.ts`, `src/lib/speechThemeTerms.ts`, `src/utilities/ai/rateLimit.ts`, `src/utilities/speech/speechListFilters.ts`, `src/utilities/speech/speechListUrl.ts`, `src/lib/speechSearch.ts`, `src/components/campaign/speech/SpeechResultCard.tsx`, `src/components/campaign/speech/SpeechThemeFallbackNotice.tsx`, `scripts/lib/e2e-affected-manifest.mjs`
- `AGENTS-public.md` — convenções da rota pública (visibilidade fail-closed, cache/revalidação)

## Self-score

5/5 — um outcome verificável (achar por sentido com proveniência e degradação honesta) dentro do appetite; persona/job/aceite sem jargão; direção no codebase é hipótese com o reuso do C192 e a diferença da rota pública explícita; nenhuma decisão dura de engenharia (limite de uso e forma do corpus ficam na implementação).
