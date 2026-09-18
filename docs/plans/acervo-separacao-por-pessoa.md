# C200 — Separar falas por pessoa nas gravações enviadas

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1167
Priority: P3
Impeccable: C — fluxo novo no acervo (rotulagem de falantes no detalhe + faceta "Pessoa" na fonte de gravações enviadas)
Design UI: docs/plans/acervo-separacao-por-pessoa-ui-design.html
Appetite: ~2–3 dias eng; um outcome verificável — a assessoria identifica quem fala numa gravação enviada e filtra o acervo pelas falas de uma pessoa
Responsável: —

## Intenção

As gravações enviadas ao acervo (C199) não têm só fala do Solla: plenárias e debates têm várias vozes, e a transcrição sai como um bloco único. A busca geral já cobre esse texto inteiro, mas não responde à pergunta que a assessoria faz o tempo todo: "o que **fulano** disse nesta gravação?". Este item é a camada de quem-falou-o-quê: a transcrição passa a vir dividida por agrupamento de falante, a assessoria identifica quem é cada voz e o acervo ganha um recorte por pessoa.

O guardrail é duro e vem do próprio pedido: separar por áudio é **agrupamento acústico** ("Falante 1", "Falante 2", …), e a identificação é **humana** — a assessoria ouve e rotula. Nada de voiceprint, nada de casar voz com pessoa conhecida, nada de identificar terceiros por biometria. Rótulo não preenchido continua "Falante N"; nunca se inventa identidade.

P3: melhora real o garimpo, mas depende do C199 e não bloqueia operação — o acervo segue útil com a busca geral enquanto isso.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) — e também `coordinator`/`candidate` — na mesa, montando peça com prazo curto, garimpando em plenárias/debates enviados pela equipe; não é editor de transcrição nem curador de cadastro.
- **Job principal:** achar as falas de uma pessoa específica dentro de uma gravação e conseguir recortar as gravações em que ela fala.
- **Fluxo desejado:**
  1. Abre o acervo na fonte "Gravações enviadas" e abre uma gravação.
  2. A transcrição aparece dividida em "Falante 1", "Falante 2", … — sem nome inventado, sem sugestão automática de identidade.
  3. Ouve o trecho e usa "Identificar falante" para rotular o agrupamento (ex.: "Falante 2" → "Dep. Jorge Solla"); o rótulo vale para todas as falas daquele agrupamento naquela gravação.
  4. Volta à lista e usa a faceta "Pessoa" para ver só as gravações com falas daquela pessoa; a busca geral continua cobrindo a transcrição inteira.
  5. Abre o trecho e assiste/baixa como já faz hoje.
- **Anti-goals de produto:** não vira biometria/identificação automática de voz; não cria cadastro de pessoas paralelo ao `Contact`; não troca nem esvazia a busca geral; não edita transcrição; não reprocessa o acervo antigo sozinho.

### Esboço de fluxo (C)

```text
[acervo: fonte "Gravações enviadas"] → abre a gravação
  → transcrição dividida em "Falante 1", "Falante 2", … (sem nome inventado)
  → ouve + "Identificar falante" → rótulo vale para todas as falas daquele agrupamento
  → volta à lista → faceta "Pessoa" recorta as gravações com falas daquela pessoa
  → abre o trecho, assiste/baixa → [outcome: a fala da pessoa certa na mão]
```

### Design UI (C)

- Design UI (gate): `docs/plans/acervo-separacao-por-pessoa-ui-design.html` (+ assets em `docs/plans/acervo-separacao-por-pessoa-ui-design-assets/`) — a produzir pelo designer.
- Por que C: há affordance nova no detalhe (rotular agrupamento) e estado novo na lista (faceta "Pessoa" só na fonte de gravações enviadas, com rótulos por gravação), dentro da tela existente. Design hi-fi obrigatório no gate e fonte de verdade do port.

## Objetivo e aceite

- Gravações enviadas (C199) têm a transcrição dividida por agrupamento de falante; o rótulo default é "Falante 1", "Falante 2", … (sempre com número).
- A assessoria rotula um agrupamento com "Identificar falante" no detalhe da gravação; o rótulo passa a valer para todas as falas daquele agrupamento naquela gravação.
- A faceta "Pessoa" existe na fonte "Gravações enviadas" e recorta as gravações em que aquele rótulo aparece; a busca geral continua alcançando a transcrição inteira, como hoje.
- Rótulo não preenchido permanece "Falante N"; o produto nunca sugere, infere ou completa identidade.
- Reprocessar a transcrição de uma gravação não perde os rótulos já feitos (ou exige re-vinculação clara e avisada) — requisito de produto, não detalhe técnico.
- Escopo de aplicação: gravações novas a partir deste item; reprocessar/diarizar as antigas é ação explícita, nunca automática.
- **Guardrails:** sem biometria de voz; identificação é humana; sem segundo cadastro de pessoa (rótulo é texto, não `Contact`); gate fail-closed do acervo (`communicator` + `coordinator`/`candidate`; demais negados); acervo segue interno; sem score de confiança de "quem falou" na UI.

## Dados (intenção)

- **Vou apresentar dados?** N/A — o filtro por pessoa é recorte de conteúdo/conteúdo editorial, não métrica nem agregado.
- **Decisões desbloqueadas:** N/A — a escolha da persona ("qual fala usar") é qualitativa.
- **Forma:** N/A — sem superfície de dados; restrição de produto: agrupamento é acústico e aproximado, então nada de confiança numérica por falante (número cru engana e sugere precisão que não existe).

## Dados da decisão (literais)

- **Rótulo default dos agrupamentos:** "Falante 1", "Falante 2", … (sempre com número; nunca nome inventado).
- **Ação de curadoria:** "Identificar falante" (rotular), no detalhe da gravação.
- **Faceta:** "Pessoa", na fonte "Gravações enviadas" do acervo.
- **Fonte:** "Gravações enviadas" (a fonte que o C199 popula).
- **Papéis:** `communicator` ("Assessor de Comunicação") + `coordinator`/`candidate`; demais negados (fail-closed) — mesmo gate do acervo.
- **Guardrail literal:** sem biometria de voz; identificação humana; sem segundo cadastro de pessoa.
- **Dependência dura:** C199.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/comunicacao/acervo/…` (lista + detalhe); `src/components/campaign/speech/SpeechAcervoFilters.tsx` e `src/components/campaign/shared/CampaignHeaderFilterPopover.tsx` (faceta multi-seleção reutilizável); `src/utilities/speech/speechListUrl.ts` (`SpeechFilterOptions` e params/URLs da lista), `speechListFilters.ts`, `speechOmnibox.ts`, `speechPageData.ts`; `src/utilities/ai/deepInfraTranscribe.ts` e o import (`src/utilities/speech/speechImport.ts`); `src/utilities/access/speeches.ts` (gate).
- **Precedente a olhar:** C154 (filtros/facetas do acervo), C153 (menções como texto; anti-goal de normalizar pessoa), C192 (recorte adicional na mesma tela), `src/collections/SpeechSegment.ts` (segmento hoje sem locutor, admin-hidden, substituído em bloco no import).
- **Risco de acoplamento:** o reprocessamento do import substitui os segmentos em bloco — um rótulo por trecho só sobrevive se o reprocessamento carregar/re-aplicar; o contrato de URL da lista sustenta deep-links e a faceta nova não pode quebrar as existentes; busca geral, cortes e gate de leitura intocados.

## Dependências

- **C199** (dura, bloqueante) — sem as gravações transcritas não há o que separar.
- Soft: C192 (busca semântica) compartilha a tela e a organização de filtros; não bloqueia nem é pré-requisito.

## Fora de escopo

- Biometria/voiceprint e qualquer identificação automática de pessoa.
- `Contact`/segundo cadastro de pessoa.
- Edição/correção de transcrição e correção de erros de ASR.
- Cortes/clipes e biblioteca de cortes.
- Busca semântica (C192) — recorte ortogonal sobre a mesma tela.
- Publicação externa, compartilhamento e Sollinha/dossiês.
- Backfill automático de diarização nas gravações antigas.

## Rabbit holes de produto

- **Virar reconhecimento biométrico.** Se alguém "só completar": voiceprint, match automático voz↔pessoa, identificação de terceiros. **Corte neste item:** agrupamento acústico + rótulo humano; nada automático.
- **Cadastro de pessoas/vozes.** Se alguém "só completar": diretório de falantes, entidade nova, merge entre gravações. **Corte:** rótulo é texto por gravação; sem unificação automática.
- **Transcrição perfeita por falante.** Se alguém "só completar": correção de sobreposição, refino de palavras, edição de texto. **Corte:** agrupamento é aproximado; fala sobreposta pode cair no agrupamento errado e a assessoria re-rotula.
- **Identificar automaticamente autoridades.** Se alguém "só completar": inferir "quem presidia" ou "o deputado" por heurística. **Corte:** se quiserem marcar presidência, é rótulo humano como qualquer outro.

## Questões em aberto (produto)

- **Qual provedor/etapa faz a diarização?** **Opções:** A) provedor com diarização nativa no pipeline de transcrição | B) etapa de diarização sobre o áudio já transcrito | C) diarização local no homeserver. **Recomendação:** decisão do plano de implementação, com custo por minuto medido e fallback honesto — o ASR atual (Whisper large-v3) **não** entrega diarização; sem a etapa, a transcrição volta a bloco único (nunca fingir separação). _(assumido — validar no gate)_
- **Reprocessar as gravações antigas?** **Opções:** A) backfill automático de todo o acervo | B) ação explícita por gravação | C) não oferecer. **Recomendação:** B — o custo por minuto não justifica varrer tudo agora, e reprocessar pode mexer em rótulos já feitos; quando rodar, é avisado e não perde rótulo. _(assumido — validar no gate)_
- **Mesma pessoa em gravações diferentes?** **Opções:** A) unificação automática por voz (biometria — proibida) | B) texto livre por gravação, sem unificação; o filtro casa pelo texto do rótulo | C) diretório sugerido + merge manual (item futuro). **Recomendação:** B — sem segunda fonte de identidade nem matching biométrico; se as variações de nome ("Solla" vs "Dep. Jorge Solla") fragmentarem o filtro, é curadoria, outro item se doer. _(assumido — validar no gate)_
- **O que mostrar quando o agrupamento é ruim (sobreposição/ruído)?** **Opções:** A) esconder a separação quando a qualidade for baixa | B) mostrar mesmo aproximada, com aviso discreto de que o agrupamento é automático | C) permitir marcar "não sei quem falou". **Recomendação:** B (+ C se couber no design) — transparência sobre o limite; esconder quebra a confiança no que apareceu. _(assumido — validar no gate)_

## Referências

- GitHub Issue #1167
- Design UI (gate): `docs/plans/acervo-separacao-por-pessoa-ui-design.html` (+ assets em `docs/plans/acervo-separacao-por-pessoa-ui-design-assets/`)
- Dependência: C199 (upload de gravações no acervo — a definir planos irmãos)
- Planos irmãos: `docs/plans/acervo-videos-comunicacao.md` (C154), `docs/plans/catalogo-falas-solla.md` (C153), `docs/plans/acervo-busca-semantica.md` (C192)
- Arquivos-pista: `src/components/campaign/speech/SpeechAcervoFilters.tsx`, `src/components/campaign/shared/CampaignHeaderFilterPopover.tsx`, `src/utilities/speech/speechListUrl.ts`, `src/utilities/speech/speechImport.ts`, `src/collections/SpeechSegment.ts`, `src/utilities/ai/deepInfraTranscribe.ts`
- `AGENTS.md` — RBAC de `/campanha`, acervo interno, LGPD/consentimento fail-closed
