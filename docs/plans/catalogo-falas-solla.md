# Catálogo de falas do Solla: import idempotente e busca textual

Status: rascunho
Atualizado em: 2026-09-12
Issue: #955
Priority: P1
Impeccable: A — N/A (dados; a superfície de produto é o C154)
Rascunho UI: N/A — sem UI
Appetite: ~2–3 dias; um outcome verificável — o acervo da 57ª legislatura existe no banco, com transcrição, segmentos com minutagem e facetas filtráveis, e pode ser reimportado sem duplicar
Responsável: —

## Intenção

O acervo de falas precisa existir antes de virar tela. Este item cria a base de dados do catálogo e o import idempotente que a popula a partir das fontes da Câmara: transcrição oficial, sumário, palavras-chave, segmentos com minutagem e facetas curadas (tema/alcance) mais menções extraídas (municípios, pessoas, programas, projetos). A 57ª legislatura entra como prova de ponta a ponta; o histórico completo é o C155. O texto oficial da taquigrafia é a fonte de leitura; a transcrição ASR entra para dar a minutagem que o texto oficial não tem.

## Persona e fluxo

- **Persona / contexto:** agente/coordenação técnica rodando o import; o consumidor final é o assessor de comunicação (UI no C154).
- **Job principal:** rodar o import uma vez e obter o acervo da 57ª legislatura com cobertura e falhas reportadas, podendo re-rodar a qualquer momento sem duplicar.
- **Fluxo desejado:** executar o script → ele varre os discursos, casa evento/trecho, baixa e transcreve, classifica e grava → imprime relatório (processados, com vídeo, sem trecho, falhas, custo).
- **Anti-goals de produto:** não é CMS de vídeo genérico; não é UI; não espelha mídia; não normaliza pessoas citadas como `Contact`.

## Objetivo e aceite

- Cada discurso do Solla vira um registro com: data/hora, legislatura, ano, duração, fase do discurso, tipo de sessão, quem presidia, sumário, transcrição oficial, **keywords oficiais preservadas**, segmentos com timestamps, facetas de tema/alcance e menções (municípios/pessoas/programas/projetos), além dos links do VOD (reproduzir/baixar) e do evento.
- Reexecutar o import não duplica registros (chave natural por áudio+trecho) e atualiza o que mudou.
- Relatório por execução: total, com vídeo, sem trecho, falhas, tempo e custo de transcrição.
- A busca textual por palavra funciona sobre os segmentos (acentos/variações ok) e é o motor do C154.
- **Guardrails:** facetas têm proveniência (`gazetteer | llm | manual`); keyword crua nunca é substituída pela faceta; leitura restrita a `communicator`, `coordinator` e `candidate`; nenhum espelhamento de vídeo nesta fase.

## Dados (intenção)

- **Vou apresentar dados?** Sim, derivado — a superfície é o C154; aqui o compromisso é que as facetas existem, são filtráveis e as menções são pesquisáveis.
- **Decisões desbloqueadas:** o assessor decide qual fala/trecho cortar por tema, alcance, ano, fase e município citado.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição: leitura relativa/local (nada de dashboard de vaidade).

## Dados da decisão (literais)

- **Temas (facetas de política pública):** Saúde · Educação · Cultura · Esporte · Segurança Pública · Meio Ambiente · Economia e Trabalho · Direitos Humanos e Assistência Social · Infraestrutura e Transporte · Ciência e Tecnologia · Política e Instituições · Agricultura e Agropecuária · Habitação e Cidades · Comunicação e Mídia · Igualdade Racial · Mulheres e Gênero · Juventude · Pessoa com Deficiência.
- **Alcance:** Bahia · Brasil · Internacional (multi-seleção).
- **Proveniência da classificação:** `classifiedBy`: `gazetteer | llm | manual`.
- **Papel leitor:** `communicator` ("Assessor de Comunicação") + `coordinator`/`candidate`.
- **Fontes:** as mesmas do C152 (discursos, eventos, trecho/VOD, Deep Infra `openai/whisper-large-v3`, US$ 0,00045/min; licença CC BY 4.0 com crédito).
- **Escopo desta prova:** 57ª legislatura (2023+); histórico completo no C155.

## Direção no codebase (hipótese)

- **Áreas prováveis:** collections novas em `src/collections/` (discurso + segmento), módulo de access em `src/utilities/access/` reexportado por `src/utilities/campaignAccess.ts`, migration + `pnpm generate:types`, script `scripts/…` no padrão de `scripts/recover-media.mjs` (guard de banco local, `--dry-run`, relatório) e índice de busca no padrão `pg_trgm` já existente.
- **Precedente a olhar:** `src/migrations/20260719_020000_add_contact_trgm_index.ts` (índice trigram), `scripts/recover-media.mjs` (script idempotente), `src/utilities/ai/deepInfraTranscribe.ts`.
- **Risco de acoplamento:** não criar um "segundo cadastro de pessoa" para as menções; usar os catálogos existentes de municípios/deputados como gazetteer.

## Dependências

- **C152** (piloto da fonte) — decide endpoints/fallbacks antes de modelar.

## Fora de escopo

- UI/busca do assessor (C154).
- Backfill 2011–2026 e import de produção (C155).
- Espelhamento no S3 e geração de clipes.
- Comissões/audiências (a API de discursos cobre Plenário).
- Agendamento recorrente do import.
- Busca semântica/IA (item futuro próprio).

## Rabbit holes de produto

- **"Normalizar pessoas citadas como `Contact`."** Se alguém "só completar": segundo cadastro de pessoa paralelo. **Corte neste item:** menções como texto pesquisável; normalização é conversa futura.
- **"Classificação perfeita antes de importar."** Se alguém "só completar": taxonomia infinita e curadoria manual de mil discursos. **Corte neste item:** facetas com proveniência + correção manual depois.
- **"Baixar os vídeos para o S3 já."** Se alguém "só completar": ~6 GB e pipeline de mídia. **Corte neste item:** links do VOD da Câmara; espelho é fase própria.
- **"Transcrever por segmento e classificar cada segmento."** Se alguém "só completar": custo/ruído sem ganho — o discurso é a unidade. **Corte neste item:** segmentos herdam as facetas do discurso.

## Questões em aberto (produto)

- **Qual LLM classifica as facetas?** **Opções:** A) DeepSeek flash do Sollinha, com saída validada | B) modelo barato da Deep Infra (mesma chave da transcrição) | C) só gazetteers. **Recomendação:** A, com validação e fallback C. _(assumido — validar no gate)_
- **Classificar no nível do discurso ou do segmento?** **Opções:** A) discurso (segmento herda) | B) segmento. **Recomendação:** A. _(assumido)_
- **Onde rodar a primeira importação?** **Opções:** A) banco local de dev (recomendado; produção é C155) | B) já em produção. **Recomendação:** A. _(assumido)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI: N/A
- `AGENTS.md` ("Campaign Municípios model", convenções de access) · `src/utilities/campaignAccess.ts` · `src/lib/municipalityCatalog.ts`
- Pesquisa do planejamento (2026-09-12): keywords oficiais ruidosas (268 distintas em 47 discursos) — preservar cruas e usar como insumo do classificador.
