# Backfill 2011–2026 + import de produção do acervo de falas

Status: rascunho
Atualizado em: 2026-09-12
Issue: #957
Priority: P2
Impeccable: A — N/A (dados/ops, sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias + tempo de máquina; um outcome verificável — o acervo completo (54ª–57ª) está em produção com relatório de cobertura por legislatura
Responsável: —

## Intenção

O C153 prova o acervo com a 57ª legislatura; o valor pleno da vertical é o histórico — "o Solla sempre defendeu isso" só existe se as falas de 2011–2023 estiverem no catálogo. Este item roda o pipeline no acervo completo (~1.011 discursos) e coloca em produção, com relatório honesto de cobertura: quantos têm vídeo, quantos caíram no fallback, o que ficou de fora e por quê.

## Persona e fluxo

- **Persona / contexto:** agente/coordenação técnica rodando o import completo uma vez; a assessoria consome o resultado no Acervo (C154).
- **Job principal:** rodar o backfill, ver o relatório por legislatura e ter os dados disponíveis em produção.
- **Fluxo desejado:** executar o import completo (54ª–57ª) → acompanhar o relatório (processados, sem trecho, falhas) → validar uma amostra no Acervo → registrar pendências.
- **Anti-goals de produto:** não é o momento de expandir fonte (comissões), nem de automatizar recorrência, nem de corrigir sessão faltante à mão.

## Objetivo e aceite

- 54ª–57ª processadas com o pipeline do C153; idempotente em reexecução.
- Relatório por legislatura: total, processados, com vídeo, sem trecho, falhas, custo de transcrição e tempo.
- Dados disponíveis em produção (a vertical C154 os enxerga).
- Links do VOD validados na amostra (reprodução e download) e pendências documentadas (sessões sem trecho, limitações de fonte antiga).
- **Guardrail:** nenhuma escrita fora do acervo; nada de mídia espelhada nesta fase; crédito CC BY mantido.

## Dados (intenção)

- **Vou apresentar dados?** Sim, derivado — o relatório de cobertura é insumo de decisão sobre o que falta; a superfície de consulta é o C154.
- **Decisões desbloqueadas:** coordenação decide se vale buscar fallback para sessões sem trecho e se o acervo já é suficiente para a produção de conteúdo.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição: cobertura relatada por legislatura, sem maquiar falha como sucesso.

## Dados da decisão (literais)

- **Acervo esperado (API, em 2026-09-12):** 54ª = 1 · 55ª = 362 · 56ª = 414 · 57ª = 234 (total ~1.011 discursos).
- **Fonte/transcrição:** as mesmas do C152/C153 (`vod.camara.leg.br`; Deep Infra `openai/whisper-large-v3`, US$ 0,00045/min; licença CC BY 4.0).
- **Escopo de fonte:** Plenário apenas (a API de discursos não cobre comissões).
- **Idempotência:** chave natural por áudio+trecho (mesma do C153).

## Direção no codebase (hipótese)

- **Áreas prováveis:** mesmo script do C153 (parametrizado por legislatura/período) + execução no ambiente de produção (homeserver) no padrão de manutenção já documentado em `docs/ops/teqo-1313-deploy.md`.
- **Precedente a olhar:** `scripts/recover-media.mjs` (relatório e guard), `scripts/deploy-homeserver.sh` (execução no runner self-hosted).
- **Risco de acoplamento:** produção é dado real — executar com guard explícito e idempotência comprovada antes.

## Dependências

- **C153** (pipeline e catálogo) — sem ele não há o que rodar.
- C154 (opcional) — não bloqueia os dados, mas é a validação visual recomendada antes de considerar o acervo entregue.

## Fora de escopo

- Comissões/audiências e outras fontes (YouTube próprio, redes).
- Agendamento recorrente do import (avaliar depois; se doer, item próprio).
- Espelhamento de mídia no S3 e geração de clipes.
- Correção manual de sessões sem trecho.
- Busca semântica (item futuro próprio).

## Rabbit holes de produto

- **"Cobrir comissões agora."** Se alguém "só completar": segunda fonte, segundo parser, segundo modelo. **Corte neste item:** Plenário apenas; comissões é item futuro.
- **"Completar à mão as sessões sem trecho."** Se alguém "só completar": curadoria manual interminável. **Corte neste item:** relatar e seguir.
- **"Automatizar o refresh semanal."** Se alguém "só completar": scheduler/worker sem demanda. **Corte neste item:** execução manual documentada.

## Questões em aberto (produto)

- **Incluir a 54ª legislatura (1 discurso)?** **Opções:** A) sim, por completude | B) não, irrelevante. **Recomendação:** A — custo zero e o relatório fica íntegro. _(assumido)_
- **O que fazer com sessões sem trecho?** **Opções:** A) fallback YouTube quando houver VOD | B) só reportar. **Recomendação:** A quando viável, B documentado; sem trabalho manual. _(assumido — depende do C152)_
- **Publicar o acervo completo antes ou depois do C154?** **Opções:** A) importar produção após o C154 validar a experiência | B) importar em paralelo. **Recomendação:** A — evita mexer em produção sem consumidor pronto. _(assumido)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI: N/A
- `docs/ops/teqo-1313-deploy.md` (execução em produção) · C153 (pipeline) · C154 (consumidor)
- Pesquisa do planejamento (2026-09-12): contagens por legislatura e confirmação do MP4 por trecho no VOD da Câmara.
