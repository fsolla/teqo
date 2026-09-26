# C232 — Catalogação com IA do acervo de fotos

Status: rascunho
Atualizado em: 2026-09-26
Issue: #1367
Priority: P2
Impeccable: B — encaixe de curadoria na ficha/lista existentes do admin/Central, sem rota pública nova; se o gate pedir superfície de revisão própria, o design nasce no gate (HTML abaixo)
Design UI: N/A — superfície admin (ficha/lista existentes); design próprio só se o gate pedir: `docs/plans/acervo-fotos-catalogacao-ia-ui-design.html`
Appetite: ~2 dias eng + tempo de processamento em lote (6,5k fotos)
Responsável: —

## Intenção

O acervo de fotos entrou para dentro de casa (C231) e virou uma pilha de 6,5k imagens sem ficha: achar a foto da plenária em Vitória da Conquista ou do Solla com uma liderança em Feira é garimpo manual. Cada foto precisa virar encontrável — legenda, atividade, local, pessoas públicas presentes, texto de faixas/placas (OCR) e descrição semântica. A IA pré-cataloga em lote; a curadoria humana revisa e vence a IA; nome de pessoa nunca é inventado de rosto. Sem isso, o álbum público (C233) não tem por onde buscar.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`; `coordinator`/`candidate` também) na mesa, diante de um lote de milhares de fotos e do pouco tempo de revisão.
- **Job principal:** transformar o acervo bruto em acervo encontrável — conferir e corrigir a pré-catalogação da IA, sem revisar tudo do zero.
- **Fluxo desejado:** o lote é catalogado → cada foto ganha ficha pré-catalogada (legenda, atividade/cena, local, pessoas, texto visível, temas, descrição semântica) → a assessoria abre a lista/ficha, revisa e corrige o que importa → a correção permanece (a IA não sobrescreve) → encontra a foto por local/data/atividade/pessoa/termo → recibo honesto do lote ao fim.
- **Anti-goals de produto:** não é o álbum público (C233) nem a busca facial (C234); não inventa nome de pessoa; não expõe nada ao público; não cria segundo cadastro de pessoa; não vira CMS de fotos com edição de imagem.

### Esboço de fluxo (B)

```text
[acervo C231] → passe de catalogação em lote (IA)
  → por foto: legenda/descrição · atividade/cena · local (gazetteer) · pessoas públicas (catálogo curado) · texto visível (OCR) · temas · descrição semântica
  → ficha pré-catalogada revisável na lista/ficha existentes
  → assessoria revisa e corrige → correção vence a IA
  → busca interna por local/data/atividade/pessoa/termo
  → recibo do lote: processadas · puladas · falharam com motivo (reexecutável, sem duplicar)
[outcome: 6,5k fotos encontráveis — sem nome inventado e sem nada publicado]
```

### Design UI (B)

- Design UI: N/A — a curadoria acontece na ficha/lista existentes (superfície admin); não há tela nova a desenhar. Se o gate concluir que a revisão do lote precisa de fila/galeria própria, o design nasce no gate em `docs/plans/acervo-fotos-catalogacao-ia-ui-design.html`.

## Objetivo e aceite

- Toda foto do acervo ganha ficha pré-catalogada revisável (ou estado honesto de "nada a propor"), com: legenda/descrição pt-BR, atividade/cena, local, pessoas públicas, texto visível, temas e descrição semântica.
- A busca interna por local, data, atividade, pessoa pública e termo funciona sobre o catálogo — e nada disso é exposto ao público.
- Curadoria vence a IA: reexecutar o passe nunca sobrescreve campo já editado por humano.
- O passe é em lote, não interativo: falha de uma foto não derruba o lote; ao fim há recibo honesto "processadas / puladas / falharam com motivo"; reexecutar não duplica nem reprocessa o que já está catalogado.
- Nenhum nome de pessoa é inferido de rosto; pessoas só do catálogo curado e com confirmação humana. Rosto, quando marcado, é presença (tag de cena) — sem identificação biométrica.
- **Guardrails:** acervo interno (gate de leitura coerente com a Central); PII/rostos de cidadãos não vão a terceiro sem decisão explícita e contrato; provider reservado aos agentes de design não entra no app.

## Dados (intenção)

- **Vou apresentar dados?** Não — catalogação não é métrica; o recibo do lote (processadas/puladas/falharam) é operacional, não agregado de leitura.
- **Decisões desbloqueadas:** N/A — a decisão da assessoria é editorial (revisar/corrigir/usar a foto), não numérica.
- **Forma:** adiada ao plano de implementação — restrição de produto: nenhum score/confiança numérico exposto na ficha; o recibo do lote é só contagem honesta.

## Dados da decisão (literais)

- Por foto, a IA deve propor: **legenda/descrição pt-BR**, **atividade/cena**, **local** (município pelo gazetteer existente; Salvador/zona ambíguo → null), **pessoas públicas** (só do catálogo curado `publicFigureCatalog` — nunca inferir nome de rosto sem confirmação humana), **texto visível** (OCR de faixas/placas/banners), **tags/temas** do vocabulário existente e **descrição semântica/embedding** para busca futura.
- **Curadoria vence a IA:** campo já curado por humano nunca é sobrescrito (precedente `curatedFields`).
- **Processamento em lote, não interativo**: falha por foto não derruba o lote; recibo honesto "processadas / puladas / falharam com motivo"; reexecução idempotente por foto.
- **Face/rosto**: nesta fatia, no máximo detectar **presença de pessoa/rosto** como tag de cena — **sem identificação biométrica** (isso é C234). Nome de pessoa só por catálogo curado e revisão humana.
- **Engine de visão a decidir na implementação** (não fixar fornecedor aqui): opções local/self-hosted vs API de terceiro; restrição de produto: PII/rostos de cidadãos não vão para terceiro sem decisão explícita e contrato; provider reservado aos agentes de design não entra no app.
- Curadoria/edição por assessoria no admin, com gate de leitura coerente com a Central de Conteúdos.

## Direção no codebase (hipótese)

- **Áreas prováveis:** catalogação `src/utilities/content/` (C230 já usa esse pipeline — reusar, não duplicar engine); job/agendador sem cron como `contentPieceJob.ts`/`contentPieceScheduler.ts`; `src/utilities/ai/` (chamadas com timeout e fallback); `src/lib/speechFacets.ts` (temas), `src/lib/publicFigureCatalog.ts` (pessoas), `src/lib/speechGazetteer.ts` (municípios); access `src/utilities/access/contentPieces.ts` + barrel; grupo admin `'Comunicação'`; migration via `pnpm migrate:create` (`push:false`).
- **Precedente a olhar:** C211/C220/C230 (pipeline, ficha e curadoria que vence IA), C226 (passo que não derruba o job), C153 (classificador + gazetteer), C231 (dono do acervo — shape fica lá).
- **Risco de acoplamento:** não criar segundo engine de catalogação; `curatedFields` é o mecanismo de precedência; `src/utilities/ai` e `src/lib/schemas` são prefixes de risco fail-closed no CI (pins `contentPieceCataloging.unit.spec.ts`, `expandSpeechSearchTheme.unit.spec.ts`); `openai/*` fica fora do app (OPS123).

## Dependências

- **Dura:** C231 — sem o acervo dentro de casa não há lote nem ficha.
- **Soft:** C211/C220/C230 (pipeline e precedentes de curadoria), C153 (classificador), C226 (job isolado), C229 (embedding restrito ao acervo de falas como precedente).

## Fora de escopo

- Álbum público (C233) e busca facial/identificação biométrica (C234).
- Vídeos, saneamento/tratamento de imagem, analytics de acervo.
- Publicação de qualquer foto; edição/recorte de imagem; segundo cadastro de pessoa.

## Rabbit holes de produto

- **"Só completar" rotulando cada rosto manualmente.** Se alguém "só completar": revisão identidade a identidade de 6,5k fotos = semana de trabalho. **Corte neste item:** a IA pré-cataloga; o humano revisa por exceção; rosto é tag de cena (identidade é C234).
- **Reescrever a taxonomia de temas.** Se alguém "só completar": nova ontologia para o acervo. **Corte neste item:** vocabulário existente (`speechFacets`).
- **API de visão de terceiro sem decisão de PII.** Se alguém "só completar": manda foto de cidadão para fora "para testar". **Corte neste item:** engine decidido na implementação sob a restrição de produto; sem decisão explícita e contrato, nada de PII para terceiro.
- **Catalogar tudo com humano em vez de IA.** Se alguém "só completar": descrição manual foto a foto. **Corte neste item:** lote com IA + curadoria por exceção.

## Questões em aberto (produto)

- **Engine de visão?** **Opções:** A) local/self-hosted | B) API de terceiro | C) híbrido (local para tudo sensível). **Recomendação:** A — o lote não é interativo e roda em casa; PII/rostos não saem sem contrato; se a qualidade não fechar o aceite, reabre com B/C e decisão explícita de PII. _(assumido — validar com produto)_
- **Quanto de curadoria humana por foto no v1?** **Opções:** A) amostragem | B) 100% revisado | C) por exceção (baixa confiança + o que for usado). **Recomendação:** C — 100% de 6,5k é semana de trabalho e amostragem não protege o que importa; campo de pessoa sempre passa por confirmação humana. _(assumido — validar com produto)_
- **Foto sem metadado de local (geotag raro)?** **Opções:** A) gazetteer só pelo texto de álbum/título/OCR | B) não tentar (null) | C) pedir local à assessoria. **Recomendação:** A — tentar pelo texto disponível; sem sinal, null honesto; nunca chutar. _(assumido — validar com produto)_

## Referências

- GitHub Issue [#1367](https://github.com/fsolla/teqo/issues/1367)
- Design UI: N/A — superfície admin; design próprio só se o gate pedir: `docs/plans/acervo-fotos-catalogacao-ia-ui-design.html`.
- Planos irmãos: C231 (dependência dura) · `central-conteudos-importar-perfil.md` (C230) · `central-conteudos-link-instagram.md` (C220) · `central-conteudos-ingestao.md` (C211) · `acervo-busca-por-sentido.md` (C229).
- Arquivos-pista: `src/utilities/content/contentPieceCataloging.ts` · `contentPieceJob.ts` · `contentPieceScheduler.ts` · `src/collections/ContentPiece.ts` (`curatedFields`) · `src/lib/publicFigureCatalog.ts` · `src/lib/speechFacets.ts` · `src/lib/speechGazetteer.ts` · `src/utilities/ai/themeSearchGuard.ts` · `rateLimit.ts` · `scripts/lib/e2e-affected-manifest.mjs`.
- `AGENTS.md` — convenções do repo (sem segundo cadastro de pessoa; PII; provider reservado aos agentes de design).

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — 6,5k fotos pré-catalogadas, buscáveis e com curadoria que permanece.
2. Appetite declarado e a intenção cabe? **Sim** (~2 dias eng + lote; fila de revisão/UI nova, treino de modelo e terceiro sem decisão cortados).
3. Persona + job + aceite claros sem jargão de stack? **Sim**.
4. Direção no codebase é hipótese? **Sim** — áreas e precedentes, sem schema/signature/fornecedor.
5. Zero decisões duras de engenharia no plano? **Sim** — engine, storage da descrição semântica, shape dos campos e migration ficam no plano de implementação.

**Score: 5/5.**
