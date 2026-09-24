# C215 — Ingestão de falas da internet no acervo (descoberta, espelho e catálogo)

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1291
Priority: P1
Impeccable: A — N/A (dados/ops, sem UI)
Design UI: N/A — sem UI
Appetite: ~3–4 dias de engenharia + tempo de máquina; um outcome verificável — um lote de falas encontradas na web entra no catálogo com transcrição, facetas e mídia espelhada, reexecutável sem duplicar e com relatório honesto
Responsável: —

## Intenção

O acervo de falas do Solla hoje só enxerga a Câmara. O que o deputado disse em vídeo no YouTube, em Reels, em rádio e em áudio solto existe na internet e não existe para a busca: a assessoria não encontra "onde ele falou de X" fora do Plenário. O dono decidiu catalogar esse material com a mesma experiência do "Falas da Câmara" — mesmas facetas, mesmos filtros — e alimentar o catálogo a partir de uma varredura da web.

Este item entrega a esteira de ingestão: recebe um lote de achados (a descoberta é a skill do C218), baixa/espelha a mídia, transcreve, classifica e grava de forma idempotente, com relatório. A tela é o C216 e os cortes são o C217; aqui o acervo nasce e sobrevive a reexecução.

## Persona e fluxo

- **Persona / contexto:** coordenação técnica rodando a ingestão (uma vez no início, depois por janela); a consumidora final é a assessoria de comunicação, na tela do C216.
- **Job principal:** entregar um lote de achados da web e obter cada fala catalogada — transcrita, facetada, com mídia preservada — podendo reexecutar sem duplicar.
- **Fluxo desejado:** apontar o lote de achados (plataforma + URL + metadados que a descoberta já trouxe) → a esteira baixa a mídia, transcreve, classifica e grava → imprime relatório (achados, novos, atualizados, ignorados, falhas, tempo e custo de ASR) → a fala aparece no acervo com as mesmas facetas do "Falas da Câmara".
- **Anti-goals de produto:** não é crawler nem serviço de monitoramento (não descobre sozinho); não é CMS de mídia; não espelha nada para o público; não vira segundo cadastro de pessoa.

## Objetivo e aceite

- Cada fala da web vira registro com: data, duração, transcrição com timestamps, temas e alcance (mesmas facetas do "Falas da Câmara"), menções (municípios/pessoas/programas/projetos), proveniência da classificação, origem (plataforma + URL) e canal/autor.
- A mídia é espelhada para o acervo interno (player/download/cortes) e nunca vira URL pública; o arquivo é preservado.
- Reexecutar não duplica (chave natural por origem + id externo/URL canônica) nem sobrescreve curadoria manual; a ingestão aceita janela para a atualização incremental do C218.
- Relatório por execução: achados, novos, atualizados, ignorados, falhas, tempo e custo de ASR — falha não é maquiada.
- **Guardrails:** sem segundo cadastro de pessoa (menções são texto, como no C153); sem espelho público; sem PII; sem score de vaidade; sem publicação externa; não tocar o feed do site público nem a Central de Conteúdos (C211 é dono da peça; aqui é catálogo de fala); leitura restrita ao gate já existente (`canReadCommunicationCatalog`, fail-closed).

## Dados (intenção)

- **Vou apresentar dados?** Sim, derivado — facetas e menções alimentam a busca e os filtros do C216; aqui nenhum agregado é apresentado.
- **Decisões desbloqueadas:** a assessoria decide qual fala/trecho usar por tema, alcance, data, município citado e canal de origem.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: leitura relativa/local, sem dashboard de vaidade.

## Dados da decisão (literais)

- **Instrução do dono (verbatim, 2026-09-23):** "Você não deve se preocupar com direitos da mídia, faça o que for necessário para viabilizar a análise e download das mídias que forem encontradas." — supera o guardrail C212/C211-FOLLOWUP ("mídia de terceiro nunca baixada/persistida") **para este catálogo interno**. **Confirmado no gate (2026-09-24):** risco assumido e registrado.
- **Campos obrigatórios do catálogo:** data, duração, transcrição com timestamps, temas, alcance, menções (municípios/pessoas/programas/projetos), proveniência da classificação, origem (plataforma + URL), canal/autor.
- **Mídia espelhada:** privada e preservada, servida só ao acervo interno; nunca URL pública.
- **Idempotência:** chave natural por origem + id externo/URL canônica; curadoria manual nunca sobrescrita.
- **Relatório por execução:** achados · novos · atualizados · ignorados · falhas · tempo · custo de ASR.
- **Janela:** a ingestão aceita recorte temporal; a execução inicial cobre tudo que a descoberta alcançar.
- **Falha de download/transcrição:** fica fora da lista e aparece no relatório (reprocessar = rodar de novo).

## Direção no codebase (hipótese)

- **Áreas prováveis:** script de ingestão em `scripts/` no padrão de import idempotente; ASR em `src/utilities/ai/deepInfraTranscribe.ts`; classificação em `src/utilities/speech/speechClassifier.ts` (facetas em `src/lib/speechFacets.ts`); `src/utilities/media/ffmpeg.ts`; mídia privada em `src/utilities/privateMedia/privateMediaResponse.ts`; gate de leitura já existente.
- **Precedente a olhar:** `scripts/import-camara-speeches.mjs` (match por `sourceKey`, skip do já guardado, faceta manual preservada, `--dry-run`, `--date/--legislature/--all`, relatórios gitignored, guard de banco local + `*_CONFIRM=1`) e `src/utilities/speech/speechImport.ts` (upsert transacional); C211 (`contentPiece` com `sourceUrl`/`origin`) como vizinho que não se invade.
- **Risco de acoplamento:** `speech` é a fonte Câmara e seu `sourceKey` é identidade por contrato — a fala da web não pode quebrá-lo; `speechClassifier` e `deepInfraTranscribe` têm dono único — reusar, nunca duplicar.
- **Fatos verificados (ponto de partida):** não existe yt-dlp/gallery-dl no repo nem busca SERP no app; a pesquisa web é feita por subagentes de skill (padrão `research.json`). Ferramenta de download e destino do espelho são decisão do plano de implementação.

## Dependências

- Nenhuma dura — reusa ASR, classificador, ffmpeg e import idempotente já entregues (C153/C199/C211).
- C216 (tela), C217 (cortes) e C218 (skill de atualização) dependem deste.

## Fora de escopo

- Tela da fonte de falas na web (C216); cortes e links (C217); skill de atualização incremental (C218); paridade de filtros das gravações (C219).
- Diarização, edição de transcrição e publicação.
- Descoberta de achados (é a skill C218); publicação externa; feed do site; Central de Conteúdos.

## Rabbit holes de produto

- **"A ingestão descobre sozinha".** Se alguém "só completar": crawler genérico/serviço de monitoramento. **Corte neste item:** recebe lote de achados; a descoberta é C218.
- **"Baixar tudo de todos os perfis".** Se alguém "só completar": arquivo infinito e ruído. **Corte neste item:** ingere o lote que a descoberta entregar.
- **"Classificação perfeita antes de importar".** Se alguém "só completar": curadoria manual interminável. **Corte neste item:** classificação automática com proveniência + correção depois (padrão C153).
- **"Espelhar em qualidade máxima".** Se alguém "só completar": disco e tempo sem necessidade. **Corte neste item:** qualidade suficiente para transcrição/player/corte; decisão da implementação.
- **"Segundo pipeline de transcrição".** Se alguém "só completar": dois ASR, duas facetas divergindo. **Corte neste item:** donos únicos reusados.

## Questões em aberto (produto)

- **Direitos/ToS:** **Opções:** A) seguir a instrução do dono — scraping + download + espelho privado, com o guardrail C212/C211-FOLLOWUP registrado como superado neste catálogo | B) só caminhos oficiais — inviabiliza download/análise/cortes | C) híbrido (conta/canal próprios + anexo manual; terceiros só link). **Confirmado no gate (2026-09-24): A** — a instrução do dono prevalece; guardrail C212/C211-FOLLOWUP superado neste catálogo interno; risco assumido e registrado.
- **Plataformas v1:** **Opções:** A) YouTube + Instagram + áudio/rádio (RSS/MP3/embed) | B) + TikTok/Facebook/X. **Recomendação:** A — cobre o que existe hoje; o resto quando doer. _(confirmado no gate, 2026-09-24)_
- **Janela da varredura inicial:** **Opções:** A) tudo que a descoberta alcançar | B) desde 2011 (janela do acervo Câmara) | C) desde 2022. **Recomendação:** A — "tudo que for encontrado", como pediu o dono. _(confirmado no gate, 2026-09-24)_
- **Ferramenta de download e onde a mídia espelhada mora:** _adiada ao plano de implementação_ — restrição de produto: privada, preservada, servida só ao acervo; sem URL pública. _(confirmado no gate, 2026-09-24)_
- **Falha de download/transcrição:** **Opções:** A) item fica fora da lista e aparece no relatório | B) estado "Falhou" visível com reprocessar. **Recomendação:** A nesta fase — a lista só mostra o que está pronto; reprocessar é rodar de novo. _(confirmado no gate, 2026-09-24)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Design UI: N/A
- `docs/plans/catalogo-falas-solla.md` (C153 — catálogo e facetas) · `docs/plans/backfill-acervo-falas.md` (C155) · `docs/plans/central-conteudos-ingestao.md` (C211) · `docs/plans/central-conteudos-varredura-instagram.md` (C212 — §Achados, decisão anti-scraping)
- Arquivos-pista: `scripts/import-camara-speeches.mjs` · `src/utilities/speech/speechImport.ts` · `src/utilities/speech/speechClassifier.ts` · `src/lib/speechFacets.ts` · `src/utilities/ai/deepInfraTranscribe.ts` · `src/utilities/media/ffmpeg.ts` · `src/utilities/privateMedia/privateMediaResponse.ts` · `src/utilities/campaignAccess.ts`
- `AGENTS.md` (convenções de access, mídia privada e gate de leitura do acervo)
